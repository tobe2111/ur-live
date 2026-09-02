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
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  utcDay, resolveReadBudget, applyRead, budgetOver, handleBudgetRequest, readBudgetState, reportReadUsage,
  DEFAULT_DAILY_READ_BUDGET, READ_BUDGET_DO, READ_BUDGET_STORAGE_KEY, budgetBeatFields,
} from '@/worker-ads/read-budget'
import { ALARM_LANE_NAMES } from '@/worker-ads/lane-alarm-runners'

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
    expect(a).toEqual({ day: '2026-09-02', used: 100 })
    expect(applyRead(a, 50, D1)).toEqual({ day: '2026-09-02', used: 150 })
    expect(applyRead(a, 50, D2)).toEqual({ day: '2026-09-03', used: 50 })
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
    expect(st.m.get(READ_BUDGET_STORAGE_KEY)).toEqual({ day: '2026-09-02', used: 1000 })
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
  it('③ 예산 0 이면 원장을 묻지 않고 over=false', async () => {
    let asked = 0
    const v = await readBudgetState({ ...fakeNs(() => { asked++; return Response.json({}) }), ADS_DAILY_READ_BUDGET: '0' })
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
    expect(budgetBeatFields({ day: 'd', used: 1, budget: 2, over: false, unknown: true })).toEqual({ used: 1, budget: 2, over: false, unknown: true })
  })
})

describe('read-budget — 배선', () => {
  it('④ cron 진입 — 원장 1회 조회가 paused 에 합쳐지고, 예산 하트비트를 남긴다', () => {
    expect(INDEX).toMatch(/const budget = await readBudgetState\(env\)/)
    expect(INDEX).toMatch(/const paused = lanesPaused\(env\) \|\| budget\.over/)
    expect(INDEX).toMatch(/adsBeat\(READ_BUDGET_BEAT, true, 0, undefined, 120, budgetBeatFields\(budget\)\)/)
    expect(INDEX.indexOf('const budget = await readBudgetState(env)')).toBeLessThan(INDEX.indexOf('const kick = ('))
  })
  it('④ DO 알람 — 정지 게이트 다음, 레인 조회 전에 예산 게이트(체인은 잇는다) · 회차 뒤 보고', () => {
    const alarm = ALARM.slice(ALARM.indexOf('async alarm()'))
    const pauseAt = alarm.indexOf('if (lanesPaused(this.env)) {')
    const budgetAt = alarm.indexOf('if ((await readBudgetState(this.env)).over) {')
    const laneAt = alarm.indexOf('const lane = lookupAlarmLane(this.lane)')
    expect(pauseAt).toBeGreaterThan(0)
    expect(budgetAt).toBeGreaterThan(pauseAt)
    expect(laneAt).toBeGreaterThan(budgetAt)
    expect(alarm.slice(budgetAt, laneAt)).toMatch(/setAlarm\(t0 \+ resolveInterval\(undefined, this\.env\)\)/)
    expect(alarm).toMatch(/this\.ctx\.waitUntil\(reportReadUsage\(this\.env, this\.meter\.rr\)\)/)
  })
  it('④ DO fetch 에 /budget 라우트 — 순수 처리기에 저장소를 넘긴다', () => {
    expect(ALARM).toMatch(/if \(url\.pathname === READ_BUDGET_PATH\) return Response\.json\(await handleBudgetRequest\(url, this\.ctx\.storage, this\.env\)\)/)
    expect(ALARM.indexOf('READ_BUDGET_PATH) return')).toBeLessThan(ALARM.indexOf("if (url.pathname !== '/start')"))
  })
  it('④ cron 경로 레인(self-beat)도 회차 읽기량을 원장에 보고한다', () => {
    expect(SELF_BEAT).toMatch(/await reportReadUsage\(env, readEnvMeter\(env\)\?\.rr\)/)
  })
  it('⑤ 원장 DO 이름은 레인 이름과 겹치지 않는다', () => {
    expect(ALARM_LANE_NAMES).not.toContain(READ_BUDGET_DO)
  })
})
