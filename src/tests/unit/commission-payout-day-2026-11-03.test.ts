/**
 * 📅 커미션 월 정산일 — 2026-11-03 대표 확정
 *   *"인플루언서 정산은 월 1회 정해진 날로 묶자"* · *"10일로 할까? 에이전시도 같은 날로 해주고."*
 *   결재 `docs/decisions/2026-11-03-settlement-structure.md`
 *
 * 고정하는 것:
 *   ① 날짜 규칙(KST 기준 · 기본 10 · 범위 밖은 기본값) — 순수 함수를 실제로 돌린다.
 *   ② 인플루언서 cron 이 지급 대기를 **정산일에만** 올린다(성숙은 매일).
 *   ③ 같은 정산일에 에이전시 몫도 자동 신청으로 묶는다.
 *   ④ 화면 둘(인플루언서·에이전시)이 같은 SSOT 로 날짜를 그린다(안내와 실지급이 갈리지 않게).
 *
 * ⚠️ 못 보는 것: 어드민이 그날 실제로 송금했는지(사람 일) · 토스 지급대행(별도 게이트).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  resolveCommissionPayoutDay, isCommissionPayoutDay, nextCommissionPayoutDate,
  commissionPayoutPeriod, COMMISSION_PAYOUT_DAY_DEFAULT,
} from '@/shared/commission-payout-day'

const kst = (iso: string) => Date.parse(`${iso}+09:00`)
const read = (p: string) => readFileSync(p, 'utf8')

describe('① 날짜 규칙', () => {
  it('기본값은 10일이다(대표 확정)', () => {
    expect(COMMISSION_PAYOUT_DAY_DEFAULT).toBe(10)
    expect(resolveCommissionPayoutDay(undefined)).toBe(10)
    expect(resolveCommissionPayoutDay('')).toBe(10)
  })
  it('없는 날이 있는 29~31 과 0·음수·문자는 기본값', () => {
    for (const v of ['0', '-1', '29', '31', 'abc', null]) expect(resolveCommissionPayoutDay(v)).toBe(10)
    expect(resolveCommissionPayoutDay('15')).toBe(15)
    expect(resolveCommissionPayoutDay(28)).toBe(28)
  })
  it('KST 로 판정한다 — UTC 9일 15시 = KST 10일 0시', () => {
    expect(isCommissionPayoutDay(Date.parse('2026-11-09T15:00:00Z'), 10)).toBe(true)
    expect(isCommissionPayoutDay(Date.parse('2026-11-09T14:59:59Z'), 10)).toBe(false)
    // cron 04:00 KST(= 전날 19:00 UTC)가 정산일을 맞힌다
    expect(isCommissionPayoutDay(Date.parse('2026-11-09T19:00:00Z'), 10)).toBe(true)
  })
  it('다음 정산일 — 오늘이 정산일이면 오늘, 지났으면 다음 달, 12월 → 이듬해 1월', () => {
    expect(nextCommissionPayoutDate(kst('2026-11-03T12:00:00'), 10)).toBe('2026-11-10')
    expect(nextCommissionPayoutDate(kst('2026-11-10T23:00:00'), 10)).toBe('2026-11-10')
    expect(nextCommissionPayoutDate(kst('2026-11-11T00:00:00'), 10)).toBe('2026-12-10')
    expect(nextCommissionPayoutDate(kst('2026-12-20T00:00:00'), 10)).toBe('2027-01-10')
  })
  it('회차 키는 KST 월', () => {
    expect(commissionPayoutPeriod(Date.parse('2026-11-30T16:00:00Z'))).toBe('2026-12')
  })
})

describe('② 인플루언서 cron — 지급 대기는 정산일에만', () => {
  const src = read('src/worker/cron/influencer-payout.ts')
  it('정산일이 아니면 지급 대기 전에 돌아간다', () => {
    const gate = src.indexOf('isCommissionPayoutDay(Date.now(), payoutDay)')
    const queue = src.indexOf('// 2) 송금 대상 인플루언서 추출')
    const mature = src.indexOf("SET status = 'available'")
    expect(gate).toBeGreaterThan(0)
    expect(mature).toBeGreaterThan(0)
    expect(mature).toBeLessThan(gate) // 성숙은 매일(게이트보다 앞)
    expect(gate).toBeLessThan(queue)  // 지급 대기는 게이트 뒤
    expect(src.slice(gate, queue)).toMatch(/return/)
  })
  it('설정 키를 SSOT 상수로 읽는다(문자열 복제 금지)', () => {
    expect(src).toMatch(/COMMISSION_PAYOUT_DAY_KEY/)
  })
})

describe('③ 에이전시 — 같은 날 자동 신청', () => {
  it('cron 정산일 블록이 autoRequestAgencyPayouts 를 부른다', () => {
    const src = read('src/worker/cron/influencer-payout.ts')
    const gate = src.indexOf('isCommissionPayoutDay(Date.now(), payoutDay)')
    const call = src.indexOf('autoRequestAgencyPayouts(DB)')
    expect(call).toBeGreaterThan(gate)
  })
  it('자동 신청은 게이트 OFF 면 아무것도 안 하고, 이미 신청한 에이전시는 건너뛴다', () => {
    const src = read('src/worker/utils/agency-share-payout.ts')
    const fn = src.slice(src.indexOf('export async function autoRequestAgencyPayouts'))
    const body = fn.slice(0, fn.indexOf('\n}\n'))
    expect(body).toMatch(/isAgencySharePayoutEnabled\(DB\)\)\) return/)
    expect(body).toMatch(/NOT IN \(SELECT agency_id FROM agency_share_payouts WHERE status = 'requested'\)/)
    expect(body).toMatch(/AGENCY_PAYOUT_MIN/)
  })
})

describe('④ 화면이 같은 SSOT 를 쓴다', () => {
  it('인플루언서 정산 화면 · 에이전시 정산 시트', () => {
    expect(read('src/pages/InfluencerSettlementPage.tsx')).toMatch(/nextCommissionPayoutDate\(/)
    expect(read('src/pages/agency-console/AgencyPayoutSheet.tsx')).toMatch(/commissionPayoutDayLabel\(/)
  })
  it('서버가 설정값을 내려준다(어드민이 바꾸면 화면도 바뀐다)', () => {
    expect(read('src/features/group-buy/api/marketing.routes.ts')).toMatch(/payout_day: resolveCommissionPayoutDay/)
    expect(read('src/features/agency-console/api/agency-payout.routes.ts')).toMatch(/payoutDay: resolveCommissionPayoutDay/)
  })
})

// ── ⑤ 매장 월간 명세서 (대표 "4번도 해") ─────────────────────────────────────
import { previousKstMonth, statementMessage } from '@/worker/utils/store-monthly-statement'

describe('⑤ 매장 월간 명세서', () => {
  it('지난달은 KST 기준 — 11월 10일 04시 KST 면 10월 1일 0시 ~ 11월 1일 0시(KST)', () => {
    const r = previousKstMonth(Date.parse('2026-11-09T19:00:00Z'))
    expect(r.period).toBe('2026-10')
    expect(r.label).toBe('2026년 10월')
    expect(r.start).toBe('2026-09-30 15:00:00')
    expect(r.end).toBe('2026-10-31 15:00:00')
  })
  it('1월이면 지난해 12월', () => {
    expect(previousKstMonth(Date.parse('2027-01-10T00:00:00+09:00')).period).toBe('2026-12')
  })
  it('빈 명세서는 보내지 않는다', () => {
    expect(statementMessage({ sellerId: 1, period: '2026-10', label: '2026년 10월', paidByUrdeal: [], payByStore: [] })).toBeNull()
  })
  it('직접 보낼 것과 유어딜이 대신 보낸 것을 나눠 적는다', () => {
    const m = statementMessage({
      sellerId: 1, period: '2026-10', label: '2026년 10월',
      paidByUrdeal: [{ kind: 'referral', name: '소개 지원', amount: 3000 }],
      payByStore: [{ kind: 'agency', name: '에이전시 A', amount: 12000, pct: 10 }],
    })!
    expect(m.message).toMatch(/직접 보내 주세요: 에이전시 A 12,000원\(10%\)/)
    expect(m.message).toMatch(/정산금에서 빠진 금액\(유어딜이 대신 지급\): 소개 지원 3,000원/)
  })
  it('영입 커미션(유어딜 돈)은 싣지 않고, 같은 달 두 번 보내지 않는다(UNIQUE + INSERT OR IGNORE)', () => {
    const src = read('src/worker/utils/store-monthly-statement.ts')
    expect(src).toMatch(/COALESCE\(a\.source, ''\) != 'store_intro'/)
    expect(src).toMatch(/UNIQUE INDEX IF NOT EXISTS idx_store_monthly_statements_seller_period ON store_monthly_statements\(seller_id, period\)/)
    expect(src).toMatch(/INSERT OR IGNORE INTO store_monthly_statements/)
  })
  it('정산일 블록에서 보낸다', () => {
    const src = read('src/worker/cron/influencer-payout.ts')
    expect(src.indexOf('sendStoreMonthlyStatements(DB, Date.now())')).toBeGreaterThan(src.indexOf('isCommissionPayoutDay(Date.now(), payoutDay)'))
  })
})

// ── ⑥ 대외 문구가 코드와 같은 날짜를 말한다 (대표 "서비스페이지에도 … 소개서에도") ─────────
import { PARTNER_FACTS } from '@/shared/partners-facts'
import { commissionPayoutDayLabel } from '@/shared/commission-payout-day'
import { SETTLE_DAYS_AFTER_WEEK_SUNDAY } from '@/worker/utils/settlement-schedule'

describe('⑥ 서비스 페이지·소개서의 정산일 = 코드', () => {
  const deckFact = (k: string) => {
    const body = read('docs/business/proposals/deck-common.mjs')
    const m = body.slice(body.indexOf('export const FACTS')).match(new RegExp(`\\b${k}:\\s*'([^']*)'`))
    if (!m) throw new Error(`deck-common FACTS 에 ${k} 없음`)
    return m[1]
  }
  it('커미션 정산일 — 랜딩·덱 모두 SSOT 기본값(매월 10일)', () => {
    const label = commissionPayoutDayLabel(COMMISSION_PAYOUT_DAY_DEFAULT)
    expect(label).toBe('매월 10일')
    expect(PARTNER_FACTS.commissionPayoutDay).toBe(label)
    expect(deckFact('influencerPayoutDay')).toBe(label)
  })
  it('매장 정산일 — 목요일(일요일 + 4일)이고 랜딩·덱이 같은 말을 한다', () => {
    expect(SETTLE_DAYS_AFTER_WEEK_SUNDAY).toBe(4)
    expect(PARTNER_FACTS.storePayoutDay).toBe('매주 목요일')
    expect(deckFact('storePayoutDay')).toBe(PARTNER_FACTS.storePayoutDay)
    expect(deckFact('storePayoutRange')).toBe(PARTNER_FACTS.storePayoutRange)
  })
  it('옛 "매월 1일" 이 대외 문구에 남지 않는다', () => {
    for (const f of [
      'src/shared/landing-faq.ts', 'src/pages/InfluencerTermsPage.tsx',
      'docs/business/proposals/urdeal-agency-proposal.build.mjs',
      'docs/business/proposals/urdeal-merchant-association-deck.build.mjs',
    ]) expect(read(f), f).not.toMatch(/매월 1일에 (보냅니다|정산합니다)|매월 1일 확정 잔액/)
  })
})
