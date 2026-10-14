/**
 * 📈 실사용 성능 SLO 일일 감시 (2026-10-14) — 근거는 `src/worker/utils/vitals-slo.ts` 머리말.
 *   실사용 수치가 쌓이기만 하고 아무도 안 봐서, 교환권 CLS 0.14 를 사람이 우연히 찾았다.
 *
 * 고정하는 것:
 *   ① 위반(SLO 초과) · 회귀(지난 7일 대비 +25% 그리고 절대 변화) · 표본 부족 · colo 제외
 *   ② cron 이 KV 를 읽어 어제를 판정하고, 위반이 있을 때만 어드민 알림을 낸다 · KV 없으면 '판정 불가' 로 남긴다
 *   ③ 배선 — scheduled.ts 슬롯이 slotCron(자기 주기)으로 돈다
 * ⚠️ 못 막는 것: 원인 커밋 · 표본 적은 화면 · 알림을 사람이 안 보는 것.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { evaluateVitals, p75, MIN_SAMPLES } from '@/worker/utils/vitals-slo'

const many = (v: number, n = MIN_SAMPLES) => Array.from({ length: n }, () => v)

describe('① 판정', () => {
  it('p75', () => { expect(p75([1, 2, 3, 4])).toBe(4); expect(p75([])).toBeNull() })
  it('SLO 초과는 위반', () => {
    const r = evaluateVitals({ CLS: { '/vouchers': many(140) } }, {})
    expect(r.findings.map((f) => [f.page, f.kind])).toEqual([['/vouchers', 'breach']])
  })
  it('SLO 안이어도 지난 7일보다 크게 나빠지면 회귀', () => {
    const r = evaluateVitals({ LCP: { '/map': many(2000) } }, { LCP: { '/map': [1400, 1500, 1450] } })
    expect(r.findings.map((f) => f.kind)).toEqual(['regression'])
  })
  it('작은 흔들림은 회귀가 아니다', () => {
    expect(evaluateVitals({ LCP: { '/map': many(1550) } }, { LCP: { '/map': [1400, 1500, 1450] } }).findings).toEqual([])
    // 비율은 넘지만(+40%) 절대 변화가 작다(40ms < 50) — 빠른 화면의 잡음
    expect(evaluateVitals({ INP: { '/': many(140) } }, { INP: { '/': [100, 100, 100] } }).findings).toEqual([])
  })
  it('표본 부족은 판정하지 않고 센다 · colo 는 제외', () => {
    const r = evaluateVitals({ TTFB: { '/': many(5000, 3), 'colo:ICN': many(5000) } }, {})
    expect(r).toMatchObject({ findings: [], judged: 0, thin: 1 })
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
  it('어제 위반을 어드민 알림으로 낸다', async () => {
    const notify = vi.fn(async () => {})
    vi.doMock('@/features/notifications/api/dashboard-notifications.routes', () => ({ createDashboardNotification: notify }))
    vi.resetModules()
    const { runVitalsSlo } = await import('@/worker/cron/vitals-slo')
    const out = await runVitalsSlo({ DB: {}, ANALYTICS_KV: fakeKv({ 'vitals:2026-10-14:CLS:/vouchers': many(140) }) } as never, NOW)
    expect(out).toContain('위반 1')
    expect(notify).toHaveBeenCalledTimes(1)
    expect(String((notify.mock.calls[0] as unknown[])[5])).toContain('/vouchers CLS p75 0.14')
    vi.doUnmock('@/features/notifications/api/dashboard-notifications.routes')
  })
  it('KV 가 없으면 이상 없음이 아니라 판정 불가로 남긴다', async () => {
    const { runVitalsSlo } = await import('@/worker/cron/vitals-slo')
    expect(await runVitalsSlo({ DB: {} } as never, NOW)).toMatch(/^skip:/)
  })
})

describe('③ 배선', () => {
  it('scheduled.ts 가 자기 주기로 돌린다', () => {
    const s = readFileSync('src/worker/scheduled.ts', 'utf8')
    expect(s).toMatch(/slotOpen\(\{ minute: 20, hour: 0 \}\)\) \{\s*ctx\.waitUntil\(slotCron\('20 0 \* \* \*'\)\('vitals-slo'/)
  })
})
