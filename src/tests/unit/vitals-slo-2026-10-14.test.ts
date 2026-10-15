/**
 * 📈 실사용 성능 SLO 일일 감시 (2026-10-14) — 근거는 `src/worker/utils/vitals-slo.ts` 머리말.
 *   실사용 수치가 쌓이기만 하고 아무도 안 봐서, 교환권 CLS 0.14 를 사람이 우연히 찾았다.
 *
 * 🪟 2026-10-15 — **하루 → `WINDOW_DAYS` 일 누적 창**으로 재조준했다. 불변식은 그대로이고
 *   앵커만 옮겼다. 이유는 라이브가 냈다: 하루 단위 첫 회차가 `"판정 0건(표본 부족 30)"` 이었고
 *   (표본 20을 넘긴 화면이 **하나도 없었다**) 7일 누적이면 판정 가능 조합이 **0 → 6개**다.
 *
 * 고정하는 것:
 *   ① 위반(SLO 초과) · 회귀(직전 창 대비 +25% 그리고 절대 변화) · 표본 부족 · colo 제외
 *   ② cron 이 KV 를 읽어 **창**을 판정하고, 위반이 있을 때 어드민 알림을 낸다 · KV 없으면 '판정 불가' 로 남긴다
 *   ③ 배선 — scheduled.ts 슬롯이 slotCron(자기 주기)으로 돈다
 *   ④ **창** — 표본을 모아서 한 번 p75 를 낸다(일별 p75 평균 아님) · 창 길이를 늘리는 쪽으로 못 간다
 *   ⑤ **판정 0건은 통과가 아니다** — 알림을 내고, '수집 멎음'(표본 0)과 '트래픽 부족'을 가른다
 * ⚠️ 못 막는 것: 원인 커밋 · 표본 적은 화면 · 알림을 사람이 안 보는 것 · 창이 어제의 급변을 섞는 것.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { evaluateVitals, p75, poolDays, MIN_SAMPLES, WINDOW_DAYS } from '@/worker/utils/vitals-slo'

const many = (v: number, n = MIN_SAMPLES) => Array.from({ length: n }, () => v)

describe('① 판정', () => {
  it('p75', () => { expect(p75([1, 2, 3, 4])).toBe(4); expect(p75([])).toBeNull() })
  it('SLO 초과는 위반', () => {
    const r = evaluateVitals({ CLS: { '/vouchers': many(140) } }, {})
    expect(r.findings.map((f) => [f.page, f.kind])).toEqual([['/vouchers', 'breach']])
  })
  it('SLO 안이어도 직전 창보다 크게 나빠지면 회귀', () => {
    const r = evaluateVitals({ LCP: { '/map': many(2000) } }, { LCP: { '/map': many(1450) } })
    expect(r.findings.map((f) => f.kind)).toEqual(['regression'])
  })
  it('작은 흔들림은 회귀가 아니다', () => {
    expect(evaluateVitals({ LCP: { '/map': many(1550) } }, { LCP: { '/map': many(1450) } }).findings).toEqual([])
    // 비율은 넘지만(+40%) 절대 변화가 작다(40ms < 50) — 빠른 화면의 잡음
    expect(evaluateVitals({ INP: { '/': many(140) } }, { INP: { '/': many(100) } }).findings).toEqual([])
  })
  it('기준선이 얇으면 회귀로 치지 않는다 — 얇은 기준선과 비교하면 잡음이다', () => {
    const thinBase = { LCP: { '/map': many(1450, MIN_SAMPLES - 1) } }
    expect(evaluateVitals({ LCP: { '/map': many(2000) } }, thinBase).findings).toEqual([])
  })
  it('표본 부족은 판정하지 않고 센다 · colo 는 제외 · 본 표본 수를 돌려준다', () => {
    const r = evaluateVitals({ TTFB: { '/': many(5000, 3), 'colo:ICN': many(5000) } }, {})
    // samples 가 3 인 것이 핵심 — colo 를 빼고 센다. 이 값이 '수집 멎음(0)' 과 '트래픽 부족' 을 가른다.
    expect(r).toMatchObject({ findings: [], judged: 0, thin: 1, samples: 3 })
    expect(evaluateVitals({}, {}).samples).toBe(0)
  })
})

describe('② cron', () => {
  function fakeKv(data: Record<string, number[]>) {
    return {
      list: async ({ prefix }: { prefix: string }) => ({ keys: Object.keys(data).filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
      get: async (k: string) => (data[k] ? JSON.stringify(data[k]) : null),
    }
  }
  const NOW = Date.parse('2026-10-15T00:20:00Z')
  /** 판정 창(어제부터 WINDOW_DAYS 일)에 같은 값을 날마다 깔아, 창 누적 표본이 문턱을 넘게 한다. */
  function spreadWindow(metric: string, page: string, value: number, perDay = 4, from = 1) {
    const out: Record<string, number[]> = {}
    for (let d = from; d < from + WINDOW_DAYS; d++) {
      const day = new Date(NOW - d * 86_400_000).toISOString().slice(0, 10)
      out[`vitals:${day}:${metric}:${page}`] = Array.from({ length: perDay }, () => value)
    }
    return out
  }
  it('창 누적 위반을 어드민 알림으로 낸다 — 하루치로는 문턱을 못 넘는다', async () => {
    const notify = vi.fn(async () => {})
    vi.doMock('@/features/notifications/api/dashboard-notifications.routes', () => ({ createDashboardNotification: notify }))
    vi.resetModules()
    const { runVitalsSlo } = await import('@/worker/cron/vitals-slo')
    // 하루 4개씩 × 창 7일 = 28 ≥ MIN_SAMPLES. 어느 하루도 혼자서는 20을 못 넘는다.
    const out = await runVitalsSlo({ DB: {}, ANALYTICS_KV: fakeKv(spreadWindow('CLS', '/vouchers', 140)) } as never, NOW)
    expect(out).toContain('위반 1')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(String((notify.mock.calls[0] as unknown[])[5])).toContain('/vouchers CLS p75 0.14')
    vi.doUnmock('@/features/notifications/api/dashboard-notifications.routes')
  })
  it('⑤ 판정 0건이면 조용히 넘기지 않고 알림을 낸다 — 감시가 이상 없음과 구분돼야 한다', async () => {
    const notify = vi.fn(async () => {})
    vi.doMock('@/features/notifications/api/dashboard-notifications.routes', () => ({ createDashboardNotification: notify }))
    vi.resetModules()
    const { runVitalsSlo } = await import('@/worker/cron/vitals-slo')
    // 표본은 있는데 전부 얇다 = 트래픽 부족
    const thin = await runVitalsSlo({ DB: {}, ANALYTICS_KV: fakeKv({ 'vitals:2026-10-14:LCP:/': many(3000, 3) }) } as never, NOW)
    expect(thin).toContain('판정 0건')
    expect(thin).toContain('트래픽 부족')
    expect(thin).not.toContain('수집이 멎었다')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(String((notify.mock.calls[0] as unknown[])[4])).toContain('판정을 못 했다')

    // 표본이 0 이면 수집이 멎은 것 — 같은 메시지로 묶지 않는다(멀쩡한 수집기를 찾아보게 된다)
    notify.mockClear()
    const dead = await runVitalsSlo({ DB: {}, ANALYTICS_KV: fakeKv({}) } as never, NOW)
    expect(dead).toContain('수집이 멎었다')
    expect(dead).not.toContain('트래픽 부족')
    expect(notify).toHaveBeenCalledTimes(1)
    vi.doUnmock('@/features/notifications/api/dashboard-notifications.routes')
  })
  it('창 안이면 통과할 때는 알림을 안 낸다', async () => {
    const notify = vi.fn(async () => {})
    vi.doMock('@/features/notifications/api/dashboard-notifications.routes', () => ({ createDashboardNotification: notify }))
    vi.resetModules()
    const { runVitalsSlo } = await import('@/worker/cron/vitals-slo')
    const out = await runVitalsSlo({ DB: {}, ANALYTICS_KV: fakeKv(spreadWindow('LCP', '/', 1200)) } as never, NOW)
    expect(out).toContain('판정 1')
    expect(out).toContain('위반 0')
    expect(notify).not.toHaveBeenCalled()
    vi.doUnmock('@/features/notifications/api/dashboard-notifications.routes')
  })
  it('KV 가 없으면 이상 없음이 아니라 판정 불가로 남긴다', async () => {
    const { runVitalsSlo } = await import('@/worker/cron/vitals-slo')
    expect(await runVitalsSlo({ DB: {} } as never, NOW)).toMatch(/^skip:/)
  })
})

describe('④ 창', () => {
  it('poolDays 는 표본을 이어 붙인다 — 일별 p75 를 평균하지 않는다', () => {
    const pooled = poolDays([
      { LCP: { '/': [100, 200] } },
      { LCP: { '/': [300] }, CLS: { '/': [5] } },
    ])
    expect(pooled).toEqual({ LCP: { '/': [100, 200, 300] } , CLS: { '/': [5] } })
    expect(poolDays([])).toEqual({})
  })
  it('창 누적이 문턱을 넘기면 판정된다 — 하루씩 보면 전부 얇다', () => {
    const perDay = Array.from({ length: WINDOW_DAYS }, () => ({ LCP: { '/': many(3000, 4) } }))
    for (const d of perDay) expect(evaluateVitals(d, {}).judged).toBe(0)       // 하루: 4개 → 얇다
    expect(evaluateVitals(poolDays(perDay), {}).judged).toBe(1)                // 창: 28개 → 판정
  })
  it('창 길이를 늘리는 방향으로 못 간다 — 둔감한 감시는 침묵과 같다', () => {
    // 늘리려면 이 단언을 고쳐야 한다. 고치려는 세션은 유틸 머리말의 ⚠️ 를 먼저 읽을 것.
    expect(WINDOW_DAYS).toBeLessThanOrEqual(7)
    expect(WINDOW_DAYS).toBeGreaterThanOrEqual(1)
  })
  it('cron 이 직전 창을 기준선으로 읽는다 — 같은 창을 두 번 읽지 않는다', () => {
    const c = readFileSync('src/worker/cron/vitals-slo.ts', 'utf8')
    expect(c).toContain('readWindow(kv, nowMs, 1)')
    expect(c).toContain('readWindow(kv, nowMs, 1 + WINDOW_DAYS)')
  })
})

describe('③ 배선', () => {
  it('scheduled.ts 가 자기 주기로 돌린다', () => {
    const s = readFileSync('src/worker/scheduled.ts', 'utf8')
    expect(s).toMatch(/slotOpen\(\{ minute: 20, hour: 0 \}\)\) \{\s*ctx\.waitUntil\(slotCron\('20 0 \* \* \*'\)\('vitals-slo'/)
  })
})
