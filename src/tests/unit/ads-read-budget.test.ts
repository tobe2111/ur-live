/**
 * 📉 유어애즈 일일 읽기 예산 차단기 — 2026-09-02 (D1 계정 일일 읽기 한도 사고 후속).
 *
 * 지키는 것:
 *   ① 순수 — UTC 자정 경계 · env 파싱(기본 150만, 0=끔) · 누적/리셋 · 초과 판정
 *   ② 원장 처리(`handleBudgetRequest`) — `?rr=` 가 있을 때만 더하고 저장, 날이 바뀌면 0 에서
 *   ③ 게이트 — 원장을 못 읽으면 **넘은 것으로**(fail-closed) · 예산 0 이면 원장을 묻지 않는다
 *   ④ 배선 — cron 진입이 `paused` 에 `|| budget.over` 를 합친다 · DO 알람이 정지 게이트 **다음**에 예산 게이트를 둔다 ·
 *      회차 뒤 원장에 보고한다(알람 DO · self-beat 양쪽) · DO fetch 에 `/budget` 라우트 · 예산 하트비트
 *   ⑤ 이름 — 원장 DO 이름이 알람 레인 등록부와 겹치지 않는다(겹치면 `alarm()` 이 원장 인스턴스를 레인으로 돌린다)
 *   ⑥ ✍️ **쓰기 축**(2026-09-02 추가) — 요금을 실제로 터뜨릴 뻔한 축이다:
 *      `09-02 00~13시 쓴 행 시간당 210만~780만 → 월 4.8억 · 유료 포함분 5,000만 → 9.5배 ≈ 월 $427`
 *      읽기 차단기만으로는 못 막는다(포함분 비율이 읽기 250억 : 쓰기 5,000만 = 500배 차이).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  utcDay, resolveReadBudget, applyRead, budgetOver, handleBudgetRequest, readBudgetState, reportReadUsage,
  DEFAULT_DAILY_READ_BUDGET, READ_BUDGET_DO, READ_BUDGET_STORAGE_KEY, budgetBeatFields,
  resolveWriteBudget, writeBudgetOver, budgetBlocked, DEFAULT_DAILY_WRITE_BUDGET,
} from '@/worker-ads/read-budget'
import { ALARM_LANE_NAMES } from '@/worker-ads/lane-alarm-runners'
import { laneEntryBlock, pauseExempt, PAUSE_EXEMPT_PATHS } from '@/worker-ads/lane-pause'

const INDEX = readFileSync('src/worker-ads/index.ts', 'utf8')
const ALARM = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')
const SELF_BEAT = readFileSync('src/worker-ads/self-beat.ts', 'utf8')

const D1 = Date.UTC(2026, 8, 2, 23, 59, 0)   // 2026-09-02 23:59 UTC
const D2 = Date.UTC(2026, 8, 3, 0, 1, 0)     // 2026-09-03 00:01 UTC (= 09:01 KST)

function memStorage(init?: Record<string, unknown>) {
  const m = new Map<string, unknown>(Object.entries(init ?? {}))
  return {
    m,
    get: async <T,>(k: string) => m.get(k) as T | undefined,
    put: async (k: string, v: unknown) => { m.set(k, v) },
  }
}

describe('read-budget — 순수', () => {
  it('① UTC 자정이 경계다(09:00 KST)', () => {
    expect(utcDay(D1)).toBe('2026-09-02')
    expect(utcDay(D2)).toBe('2026-09-03')
  })
  it('① env 파싱 — 기본 150만, 0/음수/쓰레기는 각각 끔/끔/기본', () => {
    expect(resolveReadBudget({})).toBe(DEFAULT_DAILY_READ_BUDGET)
    expect(resolveReadBudget(undefined)).toBe(DEFAULT_DAILY_READ_BUDGET)
    expect(resolveReadBudget({ ADS_DAILY_READ_BUDGET: ' 2000000 ' })).toBe(2_000_000)
    expect(resolveReadBudget({ ADS_DAILY_READ_BUDGET: '0' })).toBe(0)
    expect(resolveReadBudget({ ADS_DAILY_READ_BUDGET: '-5' })).toBe(0)
    expect(resolveReadBudget({ ADS_DAILY_READ_BUDGET: 'abc' })).toBe(DEFAULT_DAILY_READ_BUDGET)
    expect(resolveReadBudget({ ADS_DAILY_READ_BUDGET: '' })).toBe(DEFAULT_DAILY_READ_BUDGET)
  })
  it('① 누적은 같은 날에만, 날이 바뀌면 0 에서 — 음수/NaN 은 안 더한다', () => {
    const a = applyRead(null, 100, D1)
    expect(a).toEqual({ day: '2026-09-02', used: 100, written: 0 })
    expect(applyRead(a, 50, D1)).toEqual({ day: '2026-09-02', used: 150, written: 0 })
    expect(applyRead(a, 50, D2)).toEqual({ day: '2026-09-03', used: 50, written: 0 })
    expect(applyRead(a, -9, D1).used).toBe(100)
    expect(applyRead(a, Number.NaN, D1).used).toBe(100)
  })
  it('① 초과 = 오늘 누적 ≥ 예산. 어제 값은 오늘 초과가 아니다. 예산 0 은 절대 초과 아님', () => {
    const s = { day: '2026-09-02', used: 1_500_000 }
    expect(budgetOver(s, 1_500_000, D1)).toBe(true)
    expect(budgetOver({ ...s, used: 1_499_999 }, 1_500_000, D1)).toBe(false)
    expect(budgetOver(s, 1_500_000, D2)).toBe(false)
    expect(budgetOver(s, 0, D1)).toBe(false)
    expect(budgetOver(null, 10, D1)).toBe(false)
  })
})

describe('read-budget — 원장 처리', () => {
  it('② rr 가 있으면 더하고 저장, 없으면 읽기만(저장 안 함)', async () => {
    const st = memStorage()
    const v1 = await handleBudgetRequest(new URL('https://x/budget?rr=1000'), st, {}, D1)
    expect(v1).toMatchObject({ day: '2026-09-02', used: 1000, budget: DEFAULT_DAILY_READ_BUDGET, over: false })
    expect(st.m.get(READ_BUDGET_STORAGE_KEY)).toEqual({ day: '2026-09-02', used: 1000, written: 0 })
    const before = st.m.size
    const v2 = await handleBudgetRequest(new URL('https://x/budget'), st, {}, D1)
    expect(v2.used).toBe(1000)
    expect(st.m.size).toBe(before)
  })
  it('② 날이 바뀌면 읽기만 해도 0 으로 보인다(어제 누적으로 오늘을 막지 않는다)', async () => {
    const st = memStorage({ [READ_BUDGET_STORAGE_KEY]: { day: '2026-09-02', used: 9_000_000 } })
    const v = await handleBudgetRequest(new URL('https://x/budget'), st, {}, D2)
    expect(v).toMatchObject({ day: '2026-09-03', used: 0, over: false })
  })
  it('② 예산에 닿으면 over', async () => {
    const st = memStorage()
    const v = await handleBudgetRequest(new URL('https://x/budget?rr=7'), st, { ADS_DAILY_READ_BUDGET: '7' }, D1)
    expect(v.over).toBe(true)
  })
})

describe('read-budget — 게이트(fail-closed)', () => {
  const fakeNs = (handler: (url: string) => Response | Promise<Response>) => ({
    ADS_LANE: {
      idFromName: (n: string) => n,
      get: () => ({ fetch: async (url: string) => handler(url) }),
    },
  })
  it('③ 원장이 없거나(바인딩 없음) 죽었으면 over=true + unknown', async () => {
    expect(await readBudgetState({})).toMatchObject({ over: true, unknown: true })
    expect(await readBudgetState(fakeNs(() => { throw new Error('boom') }))).toMatchObject({ over: true, unknown: true })
  })
  it('③ 예산 0(두 축 다) 이면 원장을 묻지 않고 over=false', async () => {
    let asked = 0
    const v = await readBudgetState({ ...fakeNs(() => { asked++; return Response.json({}) }), ADS_DAILY_READ_BUDGET: '0', ADS_DAILY_WRITE_BUDGET: '0' })
    expect(v.over).toBe(false)
    expect(asked).toBe(0)
  })
  it('③ 정상 응답을 그대로 읽는다 · 보고는 rr>0 일 때만 원장에 간다', async () => {
    const calls: string[] = []
    const env = fakeNs((url) => { calls.push(url); return Response.json({ day: '2026-09-02', used: 42, over: false }) })
    expect(await readBudgetState(env)).toMatchObject({ used: 42, over: false })
    await reportReadUsage(env, 0)
    await reportReadUsage(env, undefined)
    expect(calls.length).toBe(1)
    await reportReadUsage(env, 12.9)
    expect(calls[1]).toContain('/budget?rr=12')
    expect(budgetBeatFields({ day: 'd', used: 1, written: 0, budget: 2, writeBudget: 3, over: false, writeOver: false, unknown: true }))
      .toEqual({ used: 1, budget: 2, over: false, written: 0, wbudget: 3, wover: false, unknown: true })
  })
})

describe('read-budget — 배선', () => {
  it('④ cron 진입 — 원장 1회 조회가 paused 에 합쳐지고, 예산 하트비트를 남긴다', () => {
    expect(INDEX).toMatch(/const budget = await readBudgetState\(env\)/)
    expect(INDEX, '쓰기 축까지 함께 보는 단일 판정이어야 한다').toMatch(/const paused = lanesPaused\(env\) \|\| budgetBlocked\(budget\)/)
    expect(INDEX).toMatch(/adsBeat\(READ_BUDGET_BEAT, true, 0, undefined, 120, budgetBeatFields\(budget\)\)/)
    expect(INDEX.indexOf('const budget = await readBudgetState(env)')).toBeLessThan(INDEX.indexOf('const kick = ('))
  })
  it('④ DO 알람 — 정지 게이트 다음, 레인 조회 전에 예산 게이트(체인은 잇는다) · 회차 뒤 보고', () => {
    const alarm = ALARM.slice(ALARM.indexOf('async alarm()'))
    const pauseAt = alarm.indexOf('if (lanesPaused(this.env)) {')
    const budgetAt = alarm.indexOf('if (budgetBlocked(await readBudgetState(this.env))) {')
    const laneAt = alarm.indexOf('const lane = lookupAlarmLane(this.lane)')
    expect(pauseAt).toBeGreaterThan(0)
    expect(budgetAt).toBeGreaterThan(pauseAt)
    expect(laneAt).toBeGreaterThan(budgetAt)
    expect(alarm.slice(budgetAt, laneAt)).toMatch(/setAlarm\(t0 \+ resolveInterval\(undefined, this\.env\)\)/)
    expect(alarm, '쓴 행도 보고해야 원장이 쓰기를 센다').toMatch(/this\.ctx\.waitUntil\(reportReadUsage\(this\.env, this\.meter\.rr, this\.meter\.rw\)\)/)
  })
  it('④ DO fetch 에 /budget 라우트 — 순수 처리기에 저장소를 넘긴다', () => {
    expect(ALARM).toMatch(/if \(url\.pathname === READ_BUDGET_PATH\) return Response\.json\(await handleBudgetRequest\(url, this\.ctx\.storage, this\.env\)\)/)
    expect(ALARM.indexOf('READ_BUDGET_PATH) return')).toBeLessThan(ALARM.indexOf("if (url.pathname !== '/start')"))
  })
  it('④ cron 경로 레인(self-beat)도 회차 읽기량을 원장에 보고한다', () => {
    expect(SELF_BEAT).toMatch(/await reportReadUsage\(env, readEnvMeter\(env\)\?\.rr, readEnvMeter\(env\)\?\.rw\)/)
  })
  it('⑤ 원장 DO 이름은 레인 이름과 겹치지 않는다', () => {
    expect(ALARM_LANE_NAMES).not.toContain(READ_BUDGET_DO)
  })
})

describe('✍️ 쓰기 예산 — 요금을 터뜨린 축', () => {
  it('기본값이 유료 포함분 안이다 — 150만/일 × 30 = 4,500만 < 5,000만', () => {
    expect(DEFAULT_DAILY_WRITE_BUDGET * 30).toBeLessThan(50_000_000)
    // 그리고 정상 수집(실측 월 3,200만)은 이 예산 안에서 돌아야 한다 — 너무 조이면 수집이 멈춘다.
    expect(DEFAULT_DAILY_WRITE_BUDGET * 30).toBeGreaterThan(32_000_000)
  })

  it('env 규약이 읽기와 같다(빈값/이상값=기본, 0 이하=끔)', () => {
    expect(resolveWriteBudget({ ADS_DAILY_WRITE_BUDGET: ' 900000 ' })).toBe(900_000)
    expect(resolveWriteBudget({ ADS_DAILY_WRITE_BUDGET: '0' })).toBe(0)
    expect(resolveWriteBudget({ ADS_DAILY_WRITE_BUDGET: 'abc' })).toBe(DEFAULT_DAILY_WRITE_BUDGET)
    expect(resolveWriteBudget({})).toBe(DEFAULT_DAILY_WRITE_BUDGET)
  })

  it('🔒 **읽기 없이 쓰기만** 한 회차도 세진다 — 전수 UPDATE 가 정확히 그 모양이다', async () => {
    const st = memStorage()
    const v = await handleBudgetRequest(new URL('https://x/budget?rr=0&rw=3000000'), st, {}, D1)
    expect(v.written, 'rr>0 일 때만 저장하면 이 회차는 한 행도 안 세진다').toBe(3_000_000)
    expect(v.writeOver).toBe(true)
    expect(st.m.get(READ_BUDGET_STORAGE_KEY)).toBeTruthy()
  })

  it('🔒 날이 바뀌면 쓰기도 0 에서 다시 — 읽기와 같은 경계', () => {
    const day1 = applyRead(null, 10, D1, 1_400_000)
    expect(writeBudgetOver(day1, DEFAULT_DAILY_WRITE_BUDGET, D1)).toBe(false)
    const more = applyRead(day1, 0, D1, 200_000)
    expect(more.written).toBe(1_600_000)
    expect(writeBudgetOver(more, DEFAULT_DAILY_WRITE_BUDGET, D1)).toBe(true)
    expect(writeBudgetOver(more, DEFAULT_DAILY_WRITE_BUDGET, D2), '자정이 지나면 풀린다').toBe(false)
  })

  it('🔒 게이트는 **어느 축이든** 넘으면 멈춘다', () => {
    const base = { day: '2026-09-02', used: 0, written: 0, budget: 1, writeBudget: 1 }
    expect(budgetBlocked({ ...base, over: false, writeOver: false })).toBe(false)
    expect(budgetBlocked({ ...base, over: true, writeOver: false }), '읽기 초과').toBe(true)
    expect(budgetBlocked({ ...base, over: false, writeOver: true }), '쓰기 초과').toBe(true)
  })

  it('🔒 원장을 못 읽으면 쓰기도 넘은 것으로(fail-closed)', async () => {
    const v = await readBudgetState({}) // ADS_LANE 바인딩 없음
    expect(v.writeOver).toBe(true)
    expect(v.unknown).toBe(true)
  })

  it('🔒 한쪽만 켜도 원장을 묻는다 — 읽기를 껐다고 쓰기가 무제한이 되면 안 된다', async () => {
    const v = await readBudgetState({ ADS_DAILY_READ_BUDGET: '0' })
    expect(v.writeOver, '읽기만 끈 상태에서 쓰기 감시가 사라지면 그게 사고다').toBe(true)
  })

  it('🔒 둘 다 꺼야 원장을 안 묻는다(완전 해제)', async () => {
    const v = await readBudgetState({ ADS_DAILY_READ_BUDGET: '0', ADS_DAILY_WRITE_BUDGET: '0' })
    expect(v.over).toBe(false); expect(v.writeOver).toBe(false); expect(v.unknown).toBeUndefined()
  })

  it('🔗 배선 — 회차가 쓴 행도 보고하고, 게이트가 두 축을 함께 본다', () => {
    expect(ALARM, '알람 DO 가 rw 를 안 보내면 원장이 영원히 0 이다').toMatch(/reportReadUsage\(this\.env, this\.meter\.rr, this\.meter\.rw\)/)
    expect(SELF_BEAT).toMatch(/reportReadUsage\(env, readEnvMeter\(env\)\?\.rr, readEnvMeter\(env\)\?\.rw\)/)
    expect(INDEX, 'cron 진입 게이트가 쓰기 축을 봐야 한다').toMatch(/budgetBlocked\(budget\)/)
    expect(ALARM, '알람 게이트도 같은 판정을 써야 한다').toMatch(/budgetBlocked\(await readBudgetState\(this\.env\)\)/)
  })

  it('🔗 하트비트에 쓰기 축이 실린다 — 안 보이면 넘었는지 알 수 없다', () => {
    const f = budgetBeatFields({ day: '2026-09-02', used: 1, written: 2, budget: 3, writeBudget: 4, over: false, writeOver: true })
    expect(f).toMatchObject({ written: 2, wbudget: 4, wover: true })
  })
})

/**
 * 🚧 **레인 진입 초크포인트** (2026-09-02 라이브 실측으로 드러난 구멍).
 *
 * 차단기가 `over=true` 를 띄운 뒤에도 레인이 계속 돌았다 — 레인을 띄우는 길이 셋(cron `kick` ·
 * DO 알람 · **자기-체인 `SELF.fetch`**)인데 게이트가 앞 둘에만 있었기 때문이다. 같은 구멍이
 * 수동 정지 스위치(`ADS_LANES_PAUSED`)에도 있었다 — 껐다고 믿는 동안 체인은 돈다.
 *
 * ⚠️ 이 시험이 **못 막는 것**: 미들웨어가 실제로 Hono 요청에서 도는지(vitest 에서 워커를 못 올린다).
 *    그건 아래 `🔗 배선` 의 소스 단언이 대신 본다 — 마운트 경로와 순서까지.
 */
describe('레인 진입 초크포인트 — 체인까지 막는다', () => {
  const over = async () => true
  const never = async () => { throw new Error('원장을 물으면 안 되는 자리에서 물었다(서브리퀘스트 낭비)') }

  it('🚧 예산을 넘으면 레인 경로를 막는다 — 체인이 다시 들어와도', async () => {
    expect(await laneEntryBlock('/__ads/collect-chain', {}, over)).toBe('budget')
    expect(await laneEntryBlock('/__ads/enrich-influencer', {}, over)).toBe('budget')
  })

  it('🚧 수동 정지가 이기고, 그때는 원장을 묻지도 않는다', async () => {
    expect(await laneEntryBlock('/__ads/collect', { ADS_LANES_PAUSED: 'true' }, never)).toBe('paused')
  })

  it('🚧 면제 경로는 통과하고 원장을 묻지 않는다 — 약속과 관측', async () => {
    for (const p of ['/__ads/consented-reminder', '/__ads/inbound-onboarding', '/__ads/health', '/__ads/silence-digest']) {
      expect(await laneEntryBlock(p, { ADS_LANES_PAUSED: 'true' }, never), p).toBe('')
    }
  })

  it('🚧 멈춘 이유를 보는 창은 절대 막히면 안 된다', () => {
    // 이걸 막으면 "멈춘 이유를 볼 수 없는 상태로 멈춘다" — 이 레포가 반복해 당한 모양이다.
    for (const p of ['/__ads/health', '/__ads/alert-test', '/__ads/probe-public-data', '/__ads/silence-digest']) {
      expect(pauseExempt(p), `${p} 가 면제에서 빠지면 정지 중 관측이 통째로 죽는다`).toBe(true)
    }
    expect(PAUSE_EXEMPT_PATHS.has('/__ads/collect'), '수집 레인이 면제로 새 들어오면 차단기가 무의미하다').toBe(false)
  })

  it('🚧 평시엔 통과한다 — 게이트가 늘 막으면 그건 정지지 차단기가 아니다', async () => {
    expect(await laneEntryBlock('/__ads/collect', {}, async () => false)).toBe('')
  })

  it('🔗 배선 — `/__ads/*` 에, self-beat **뒤**에 붙어 있고, 200 으로 돌려준다', () => {
    const beat = INDEX.indexOf("app.use('/__ads/*', selfBeatMiddleware())")
    const gate = INDEX.indexOf('laneEntryBlock(')
    expect(beat, 'self-beat 미들웨어 마운트를 못 찾았다(경로가 바뀌었나)').toBeGreaterThan(-1)
    expect(gate, '초크포인트가 사라졌다 — 체인이 다시 예산을 태운다').toBeGreaterThan(-1)
    expect(gate, '막힌 회차도 하트비트를 남겨야 침묵 감시가 죽음으로 오인하지 않는다').toBeGreaterThan(beat)
    expect(INDEX.slice(gate - 400, gate), '초크포인트는 `/__ads/*` 전체에 걸려야 한다').toMatch(/app\.use\('\/__ads\/\*'/)
    // 5xx 로 막으면 체인 부모가 실패로 읽고 재시도한다 — 그게 또 부하다.
    expect(INDEX.slice(gate, gate + 400)).toMatch(/c\.json\(\{ ok: true, skipped: blocked \}\)/)
  })
})
