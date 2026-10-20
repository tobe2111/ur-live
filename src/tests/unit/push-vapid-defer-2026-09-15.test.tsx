/**
 * 🔔 안 쓸 요청을 첫 화면에서 받아 오던 것 〔2026-09-15〕
 *
 * `PushNotificationSetup` 은 구독(`subscribe`)을 8초 미뤄 두었는데, **VAPID 키 조회는
 * 안 미뤘다.** 그래서 권한이 `'default'`(=아직 안 물어본 대다수)인 사람도 진입할 때마다
 * `/api/push/vapid-public-key` 를 받아 놓고 바로 다음 줄에서 돌아섰다 — **결과를 쓰지 않는 요청**.
 * 지연 의도가 절반만 적용돼 있던 것이다.
 *
 * ## 이 시험이 재는 것
 * 소스 문자열이 아니라 **fetch 가 실제로 나갔는가**. 순서를 다시 뒤집으면 빨간불이 된다.
 *
 * ## 못 막는 것
 * - 실제 구독이 되는지(브라우저 권한이 필요하다)
 * - 8초 뒤 subscribe 의 동작
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@/lib/in-app-warning', () => ({
  isPWAStandalone: () => true,          // 인앱 차단 분기를 건너뛴다(이 시험의 관심사가 아니다)
  isFeatureBlockedSync: () => false,
}))

const fetchSpy = vi.fn()

function setPermission(p: NotificationPermission) {
  // jsdom 엔 Notification 이 없다 — 이 컴포넌트가 읽는 최소한만 세운다.
  ;(globalThis as unknown as { Notification: unknown }).Notification = { permission: p }
}

/**
 * ⚠️ 모듈을 **매번 새로** 불러온다. `_vapidKeyPromise` 가 모듈 스코프 메모라서, 한 번 받아 오면
 *    다음 시험에선 fetch 가 안 나간다 — 그대로 두면 시험끼리 서로의 결과를 오염시킨다.
 */
async function mount() {
  vi.resetModules()
  const { default: Push } = await import('@/components/PushNotificationSetup')
  render(<Push />)
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchSpy.mockReset().mockResolvedValue({ ok: true, json: async () => ({ publicKey: 'k' }) })
  vi.stubGlobal('fetch', fetchSpy)
  ;(navigator as unknown as { serviceWorker: unknown }).serviceWorker = { ready: new Promise(() => {}) }
  ;(window as unknown as { PushManager: unknown }).PushManager = function () {}
  try { localStorage.setItem('user_id', '1') } catch { /* private mode */ }
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const vapidCalls = () => fetchSpy.mock.calls.filter(c => String(c[0]).includes('vapid-public-key')).length

describe('권한이 없으면 VAPID 키를 받아 오지 않는다', () => {
  it("🔴 'default'(아직 안 물어봄) — 요청 0건. 받아도 쓸 데가 없다", async () => {
    setPermission('default')
    await mount()
    expect(vapidCalls(), '권한도 없는데 첫 화면에서 키를 받아 왔다').toBe(0)
  })

  it("'denied' — 요청 0건", async () => {
    setPermission('denied')
    await mount()
    expect(vapidCalls()).toBe(0)
  })

  it("🔴 'granted' 면 **받아 온다** — 자가치유(구독 재조정)가 그 키를 쓴다", async () => {
    // ⚠️ 이 검사가 없으면 위 둘은 "fetch 를 통째로 지워도" 초록이 된다.
    setPermission('granted')
    await mount()
    expect(vapidCalls(), 'granted 인데 키를 안 받으면 알림 구독이 영구 두절된다').toBe(1)
  })
})
