/**
 * 🔬 **유어딜 예약분을 상수 → 계정 실측으로** (2026-10-06, 대표 *"예약분 실측 자동으로 하자."*).
 *
 * ## 이 조가 지키는 것
 * 월 쓰기 예산은 포함분(5,000만)에서 **유어딜 몫을 먼저 뗀다**(포함분은 DB 가 아니라 계정 단위).
 * 그 몫이 손으로 적은 상수였고 유어애즈 원장은 자기 쓰기만 세므로, 본진이 커지면 **에러 없이
 * 청구서로만** 드러났다 — 10/6 실측이 이미 그 자리였다(본진 월 1,373,461 = 옛 예약분의 91.6%).
 * 이제 CF GraphQL 로 계정 전체를 읽어 예약분을 **스스로** 만든다.
 *
 * ## 🔴 틀릴 때 손해 보는 쪽은 유어애즈여야 한다
 * 대표 하드 제약은 **초과 $0**("$5 이상을 넘으면 절대 안돼")이다. 그래서 실측을 못 읽거나 낡으면
 * **상수(실측의 4.4배)로 되돌아간다** — fail-open(예약분 0)으로 가면 그게 곧 청구서다.
 * 아래 ②가 그 방향을 네 가지 결함으로 고정한다.
 *
 * ⚠️ **이 시험이 못 보는 것**
 * · CF 가 실제로 저 숫자를 주는가 — 네트워크는 안 탄다(`fetchAccountUsage` 는 응답 파싱만 시험한다).
 *   라이브 판정은 하트비트 `rsv` 와 CF 분석 대조뿐이다.
 * · CF 집계 지연(수 분)으로 MTD 가 **낮게** 보일 때의 과소추정 — 성장계수 1.3 · 바닥 2M · 버퍼 4M
 *   세 겹이 덮는 설계이고, 그 세 겹 중 하나라도 빠지면 아래 ②-③·②-④ 가 빨간불이 된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ACCT_GROWTH_FACTOR, ACCT_MIN_RESERVE, ACCT_RETRY_MS, ACCT_STALE_MS, OWN_D1_IDS,
  accountUsageBody, effectiveReserve, parseAccountUsage, projectOtherMonth,
  type AccountUsage,
} from '@/worker-ads/account-usage'
import { utcDaysInMonth, utcMonthElapsedDays } from '@/worker-ads/budget-calendar'
import {
  MONTHLY_SAFETY_BUFFER, MONTHLY_WRITE_ALLOWANCE, URDEAL_MONTHLY_RESERVE, MONTH_SPENT_FLOOR,
  effectiveWriteBudget, handleBudgetRequest, applyRead, budgetBeatFields,
  monthlyDerivedWriteBudget, utcDaysLeftInMonth,
} from '@/worker-ads/read-budget'

const OCT1 = Date.parse('2026-10-01T06:00:00Z')
const OCT16 = Date.parse('2026-10-16T06:00:00Z')
/** 🔬 10/1~10/5 완결 5일 CF 실측 — 본진(= ads DB 둘을 뺀 나머지) 하루 44,305 행. */
const URDEAL_PER_DAY = 44_305
const ADS_LEADS = OWN_D1_IDS[0]
const ADS_COMPANY = OWN_D1_IDS[1]
const MAIN_DB = 'd9530ba6-7a26-4c02-9295-3ce5aef112a3'

const fresh = (other: number, at = OCT16, ads = 0): AccountUsage => ({ month: '2026-10', other, ads, at })
const mem = (init?: unknown) => {
  let v = init
  return { async get<T>() { return v as T }, async put(_k: string, val: unknown) { v = val }, peek: () => v }
}
const url = new URL('https://x/budget')
const post = new URL('https://x/budget?rr=10&rw=10&lane=collect')

describe('① CF 응답 → 실측', () => {
  it('유어애즈 DB 둘만 ads, 나머지는 전부 other 로 센다', () => {
    const json = {
      data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [
        { sum: { rowsWritten: 100 }, dimensions: { date: '2026-10-01', databaseId: ADS_LEADS } },
        { sum: { rowsWritten: 20 }, dimensions: { date: '2026-10-01', databaseId: ADS_COMPANY } },
        { sum: { rowsWritten: 7 }, dimensions: { date: '2026-10-01', databaseId: MAIN_DB } },
        { sum: { rowsWritten: 3 }, dimensions: { date: '2026-10-01', databaseId: 'some-other-d1' } },
      ] }] } },
    }
    const got = parseAccountUsage(json, '2026-10', OCT16)
    expect(got).toEqual({ month: '2026-10', other: 10, ads: 120, at: OCT16 })
  })

  it('🔴 모양이 다르거나 CF 가 errors 를 주면 null — 추측한 숫자로 예약분을 정하지 않는다', () => {
    expect(parseAccountUsage({ errors: [{ message: 'Authentication error' }] }, '2026-10', OCT16)).toBeNull()
    expect(parseAccountUsage({ data: { viewer: { accounts: [] } } }, '2026-10', OCT16)).toBeNull()
    expect(parseAccountUsage({ data: { viewer: { accounts: [{}] } } }, '2026-10', OCT16)).toBeNull()
    expect(parseAccountUsage(null, '2026-10', OCT16)).toBeNull()
  })

  it('그룹이 빈 배열인 것은 정상(월초에 아직 쓴 행이 없음) — 0 으로 읽는다', () => {
    const got = parseAccountUsage({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [] }] } } }, '2026-10', OCT1)
    expect(got).toEqual({ month: '2026-10', other: 0, ads: 0, at: OCT1 })
  })

  it('🔒 본문에 토큰이 안 들어간다 — 토큰은 헤더 전용이고 이 값은 로그에 실려도 안전해야 한다', () => {
    const body = JSON.stringify(accountUsageBody('acct-tag-123', '2026-10-01', '2026-10-16'))
    expect(body).toContain('acct-tag-123')
    expect(body.toLowerCase()).not.toContain('bearer')
    expect(body).not.toContain('cf_api_token')
  })

  it('🔒 이 모듈은 아무것도 로그하지 않는다 — 실패는 null 로만 말한다(자격증명 유출면 0)', () => {
    const src = readFileSync('src/worker-ads/account-usage.ts', 'utf-8')
    expect(src).not.toMatch(/\bconsole\s*\./)
    // 토큰이 밖으로 나가는 유일한 경로는 fetch 헤더 하나다.
    expect(src.match(/creds\.token/g)?.length ?? 0).toBe(1)
  })

  it('🧭 유어애즈 DB 목록이 wrangler-ads.toml 과 일치한다 — 드리프트면 그 DB 쓰기가 유어딜 몫이 된다', () => {
    const toml = readFileSync('wrangler-ads.toml', 'utf-8')
    for (const binding of ['ADS_DB', 'ADS_COMPANY_DB']) {
      const m = new RegExp(`binding\\s*=\\s*"${binding}"[\\s\\S]{0,200}?database_id\\s*=\\s*"([0-9a-f-]+)"`).exec(toml)
      expect(m, `${binding} 를 wrangler-ads.toml 에서 못 찾았다`).toBeTruthy()
      expect(OWN_D1_IDS).toContain(m![1])
    }
    // 본진 DB 는 **일부러** 빠져 있다 — 유어애즈가 본진에 쓰는 하트비트까지 유어딜 몫으로 잡는다(안전한 방향).
    expect(OWN_D1_IDS).not.toContain(MAIN_DB)
    expect(OWN_D1_IDS.length).toBe(2)
  })
})

describe('② 예약분 — 틀릴 때 손해 보는 쪽은 유어애즈', () => {
  it('🔴 실측이 없으면 상수로 되돌아간다 (fail-open 금지 — 예약분 0 은 곧 청구서다)', () => {
    expect(effectiveReserve(undefined, OCT16, URDEAL_MONTHLY_RESERVE)).toBe(URDEAL_MONTHLY_RESERVE)
    expect(effectiveReserve(null, OCT16, URDEAL_MONTHLY_RESERVE)).toBe(URDEAL_MONTHLY_RESERVE)
  })

  it('🔴 다른 달 실측이면 못 쓴다 — 지난달 숫자로 이번 달 예약분을 정하면 안 된다', () => {
    const last = { month: '2026-09', other: 1_000_000, ads: 0, at: OCT16 }
    expect(effectiveReserve(last, OCT16, URDEAL_MONTHLY_RESERVE)).toBe(URDEAL_MONTHLY_RESERVE)
  })

  it('🔴 낡은 실측이면 못 쓴다 (추정이라서) — 경계 바로 안쪽은 쓴다', () => {
    const stale = fresh(URDEAL_PER_DAY * 15, OCT16 - ACCT_STALE_MS - 1)
    expect(effectiveReserve(stale, OCT16, URDEAL_MONTHLY_RESERVE)).toBe(URDEAL_MONTHLY_RESERVE)
    const justOk = fresh(URDEAL_PER_DAY * 15, OCT16 - ACCT_STALE_MS + 1_000)
    expect(effectiveReserve(justOk, OCT16, URDEAL_MONTHLY_RESERVE)).not.toBe(URDEAL_MONTHLY_RESERVE)
  })

  it('실측이 있으면 추정 × 성장계수, 단 바닥(2M) 아래로는 안 내려간다', () => {
    const mtd = Math.round(URDEAL_PER_DAY * utcMonthElapsedDays(OCT16))
    const projected = projectOtherMonth(mtd, OCT16)
    // 10/6 실측 기준 31일 추정은 1,373,461 근처여야 한다(월 중간에서도 같은 값으로 수렴).
    expect(projected).toBeGreaterThan(1_300_000)
    expect(projected).toBeLessThan(1_450_000)
    const r = effectiveReserve(fresh(mtd), OCT16, URDEAL_MONTHLY_RESERVE)
    expect(r).toBe(Math.max(ACCT_MIN_RESERVE, Math.ceil(projected * ACCT_GROWTH_FACTOR)))
    // 오늘 크기에서는 바닥이 이긴다 — 즉 평시 예약분은 2,000,000 이고 상수(6,000,000)보다 작다.
    expect(r).toBe(ACCT_MIN_RESERVE)
    expect(r).toBeLessThan(URDEAL_MONTHLY_RESERVE)
  })

  it('🔑 유어딜이 커지면 예약분이 **스스로** 커진다 — 대표 "사용자 많아지는 것도 감안"', () => {
    const small = effectiveReserve(fresh(URDEAL_PER_DAY * 15), OCT16, URDEAL_MONTHLY_RESERVE)
    const big = effectiveReserve(fresh(URDEAL_PER_DAY * 15 * 10), OCT16, URDEAL_MONTHLY_RESERVE)
    expect(big).toBeGreaterThan(small)
    // 상수를 넘어서까지 따라간다 — 상수가 천장이면 그 지점부터 다시 청구서로만 드러난다.
    expect(big).toBeGreaterThan(URDEAL_MONTHLY_RESERVE)
  })

  it('🔴 성장계수와 바닥이 둘 다 살아 있다 — 하나라도 1/0 이면 여백이 사라진다', () => {
    expect(ACCT_GROWTH_FACTOR).toBeGreaterThanOrEqual(1.2)
    expect(ACCT_MIN_RESERVE).toBeGreaterThan(1_373_461)   // 10/6 실측 월 합계보다 커야 의미가 있다
    expect(MONTHLY_SAFETY_BUFFER).toBeGreaterThan(0)
  })

  it('추정은 월말에 실측으로 수렴한다 (남은 날이 0 이면 더 보태지 않는다)', () => {
    const end = Date.parse('2026-10-31T23:59:00Z')
    expect(utcDaysInMonth(end)).toBe(31)
    // 23:59 에도 남은 조각(1분)이 있어 정확히 같지는 않다 — 0.003% 안이면 수렴한 것이다.
    expect(projectOtherMonth(5_000_000, end)).toBeGreaterThanOrEqual(5_000_000)
    expect(projectOtherMonth(5_000_000, end)).toBeLessThan(5_000_200)
    expect(projectOtherMonth(0, OCT16)).toBe(0)
  })
})

describe('③ 초과 $0 — 실측 예약분에서도 포함분을 넘을 수 없다', () => {
  it('🔴 유어애즈가 남은 날을 꽉 써도 포함분을 못 넘는다 — 예약분이 어떤 값이어도', () => {
    const daysLeft = utcDaysLeftInMonth(OCT16)
    for (const other of [0, URDEAL_PER_DAY * 15, 10_000_000, 30_000_000]) {
      const reserve = effectiveReserve(fresh(other), OCT16, URDEAL_MONTHLY_RESERVE)
      // 🔑 몫은 **실제 역산 함수**로 구한다(시험이 자기 산수를 검사하지 않게).
      const daily = monthlyDerivedWriteBudget(0, OCT16, MONTHLY_WRITE_ALLOWANCE, reserve)
      if (daily === MONTH_SPENT_FLOOR) {
        // 🩸 **알려진 틈**: 유어딜 추정만으로 포함분이 차면 유어애즈는 바닥값(30,000/일)만 쓴다.
        //    0 을 돌려주면 이 파일에서 그건 "끔"(무제한)이라 정반대가 되므로 0 으로 못 만든다.
        //    즉 이 구간에서 계정 초과를 막는 것은 예산이 아니라 **유어딜 쪽 조치**다.
        expect(reserve + MONTHLY_SAFETY_BUFFER).toBeGreaterThanOrEqual(MONTHLY_WRITE_ALLOWANCE)
        continue
      }
      expect(daily * daysLeft + reserve + MONTHLY_SAFETY_BUFFER).toBeLessThanOrEqual(MONTHLY_WRITE_ALLOWANCE)
    }
  })

  it('🔑 지출은 원장과 실측 중 **큰 쪽** — 보고 안 된 쓰기로 예산을 속일 수 없다', () => {
    const st = {
      day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 1_000_000,
      acct: { month: '2026-10', other: 0, ads: 20_000_000, at: OCT16 },
    }
    const honest = { ...st, acct: { ...st.acct, ads: 0 } }
    expect(effectiveWriteBudget({}, st, OCT16)).toBeLessThan(effectiveWriteBudget({}, honest, OCT16))
  })

  it('실측 예약분이 작아지면 유어애즈 하루 예산이 커진다 (상수 6M 시절보다 회복)', () => {
    const withAcct = { day: '2026-10-01', used: 0, written: 0, month: '2026-10', writtenMonth: 0, acct: fresh(0, OCT1) }
    const noAcct = { day: '2026-10-01', used: 0, written: 0, month: '2026-10', writtenMonth: 0 }
    expect(effectiveWriteBudget({}, withAcct, OCT1)).toBeGreaterThan(effectiveWriteBudget({}, noAcct, OCT1))
  })

  it('🔴 유어딜이 폭증하면 유어애즈가 굶는다 — 그 방향이 맞다(본진이 우선)', () => {
    const huge = { day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 0, acct: fresh(40_000_000) }
    const normal = { day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 0, acct: fresh(URDEAL_PER_DAY * 15) }
    expect(effectiveWriteBudget({}, huge, OCT16)).toBeLessThan(effectiveWriteBudget({}, normal, OCT16))
  })
})

describe('④ 배선 — 원장이 실측을 들고 있고, 보고와 집행이 같은 셈을 쓴다', () => {
  it('🔒 `mleft`·`rsv` 가 역산식과 같은 예약분을 쓴다', async () => {
    const st = mem({ day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 3_000_000, acct: fresh(URDEAL_PER_DAY * 15) })
    const v = await handleBudgetRequest(url, st, {}, OCT16)
    expect(v.reserve).toBe(ACCT_MIN_RESERVE)
    expect(v.monthLeft).toBe(MONTHLY_WRITE_ALLOWANCE - v.reserve! - MONTHLY_SAFETY_BUFFER - 3_000_000)
    expect(v.writeBudget).toBe(Math.floor((v.monthLeft as number) / (v.daysLeft as number)))
    expect(budgetBeatFields(v).rsv).toBe(ACCT_MIN_RESERVE)
  })

  it('🔬 갱신은 **보고(POST)에서만** — 게이트의 읽기 경로에 CF API 지연을 얹지 않는다', async () => {
    let calls = 0
    const refresh = async () => { calls++; return fresh(123, OCT16) }
    const st = mem({ day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 0 })
    await handleBudgetRequest(url, st, {}, OCT16, refresh)
    expect(calls, 'GET(조회)에서 불리면 모든 레인 진입이 느려진다').toBe(0)
    await handleBudgetRequest(post, st, {}, OCT16, refresh)
    expect(calls).toBe(1)
    expect((st.peek() as { acct?: AccountUsage }).acct?.other).toBe(123)
  })

  it('🔬 갱신 간격 안에는 다시 안 부른다 — 지나면 부른다', async () => {
    let calls = 0
    const refresh = async () => { calls++; return fresh(1, OCT16) }
    const st = mem({ day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 0 })
    await handleBudgetRequest(post, st, {}, OCT16, refresh)
    await handleBudgetRequest(post, st, {}, OCT16 + ACCT_RETRY_MS - 1_000, refresh)
    expect(calls, '매 보고가 CF 를 부르면 모든 회차에 지연이 붙는다').toBe(1)
    await handleBudgetRequest(post, st, {}, OCT16 + ACCT_RETRY_MS + 1_000, refresh)
    expect(calls).toBe(2)
  })

  it('🩸 실패해도 시도 시각을 적는다(재시도 폭풍 방지) + 옛 실측을 지우지 않는다', async () => {
    let calls = 0
    const refresh = async () => { calls++; return null }
    const st = mem({ day: '2026-10-16', used: 0, written: 0, month: '2026-10', writtenMonth: 0, acct: fresh(777) })
    await handleBudgetRequest(post, st, {}, OCT16, refresh)
    const saved = st.peek() as { acct?: AccountUsage; acctAt?: number }
    expect(saved.acctAt).toBe(OCT16)
    expect(saved.acct?.other, '실패가 실측을 지우면 예약분이 상수로 떨어진다').toBe(777)
    await handleBudgetRequest(post, st, {}, OCT16 + 1_000, refresh)
    expect(calls).toBe(1)
  })

  it('🔬 실측은 날·달 경계를 넘어 살아남는다 (매일 자정에 상수로 떨어지지 않는다)', () => {
    const prev = { day: '2026-10-16', used: 9, written: 9, month: '2026-10', writtenMonth: 9, acct: fresh(555), acctAt: OCT16 }
    const next = applyRead(prev, 1, Date.parse('2026-10-17T00:30:00Z'), 1, 'collect')
    expect(next.acct?.other).toBe(555)
    expect(next.acctAt).toBe(OCT16)
    const nextMonth = applyRead(prev, 1, Date.parse('2026-11-01T00:30:00Z'), 1, 'collect')
    expect(nextMonth.acct?.other, '달이 바뀌어도 들고 간다 — 월 키로 걸러지므로 오용되지 않는다').toBe(555)
    // 11월엔 10월 실측을 **쓰지 않는다**(월이 달라 폴백).
    expect(effectiveReserve(nextMonth.acct, Date.parse('2026-11-01T00:30:00Z'), URDEAL_MONTHLY_RESERVE))
      .toBe(URDEAL_MONTHLY_RESERVE)
  })
})
