/**
 * 🔔 **성능 경고는 페이지 로드당 한 번, 최종값으로** — `PerformanceMonitor.trackPageLoad` 불변식.
 *
 * ## 왜 생겼나 (2026-10-07 — 라이브 Sentry envelope 을 실제로 뜯어보고 나온 결함)
 * 로그인 상태 `urdeal.kr/map` 을 **한 번** 열었을 때 envelope POST 5건이 갔고, 그중 event 둘이
 * 전부 같은 경고였다: `Slow LCP on app: 3524ms` 와 `Slow LCP on app: 4140ms`.
 * 원인은 네 지표 전부 `captureMessage` 를 **옵저버 콜백마다** 쏘던 것이다 —
 * LCP 는 entry 마다, **CLS 는 레이아웃 시프트마다**(0.1 을 넘긴 뒤로는 시프트 하나가 경고 1건),
 * INP 는 배치마다. 느린 화면일수록 이슈 트래커가 같은 경고로 묻히고, 게다가 **중간값**이 가서
 * 읽는 사람이 최종값보다 작은 숫자를 본다.
 *
 * 형제 파일 `lib/web-vitals-report.ts` 는 이미 올바른 모양(마지막 값 · `sent` 가드 · disconnect)을
 * 갖고 있었다 ⇒ 같은 지표의 리포터가 두 벌인데 한쪽만 맞던 상태였다.
 *
 * ## 무엇을 재는가
 * **동작**이다 — 소스 문자열이 아니라 가짜 `PerformanceObserver` 로 entry 를 여러 번 먹이고
 * `captureMessage` 가 **몇 번** 불리는지 센다. 이 수정은 통째로 런타임 분기라
 * 소스 검사로는 "고쳐졌다" 를 말할 수 없다(2026-10-06 CSRF 단일비행에서 배운 것 —
 * 소스엔 멀쩡히 보이는데 6회 그대로였다).
 *
 * ## ❌ 이 시험이 못 보는 것
 * - 실제 브라우저의 `pagehide`/`visibilitychange` 발화 시점(여기선 이벤트를 직접 쏜다).
 * - breadcrumb 쪽은 **일부러** entry 마다 남긴다 — 그건 로컬 흔적이라 중복이 비용이 아니다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const captureMessage = vi.fn()
const addBreadcrumb = vi.fn()
vi.mock('@sentry/react', () => ({ captureMessage, addBreadcrumb, captureException: vi.fn() }))

type Cb = (list: { getEntries: () => unknown[] }) => void
/** 가짜 옵저버 — 만들어진 순서대로 잡아 두고 테스트가 직접 entry 를 먹인다. */
const made: Array<{ cb: Cb; types: string[]; disconnected: boolean }> = []
class FakePO {
  cb: Cb
  rec: { cb: Cb; types: string[]; disconnected: boolean }
  constructor(cb: Cb) { this.cb = cb; this.rec = { cb, types: [], disconnected: false }; made.push(this.rec) }
  observe(opts: { entryTypes?: string[]; type?: string }) {
    this.rec.types = opts.entryTypes ?? (opts.type ? [opts.type] : [])
  }
  disconnect() { this.rec.disconnected = true }
}

function feed(type: string, entries: unknown[]) {
  for (const o of made) if (o.types.includes(type) && !o.disconnected) o.cb({ getEntries: () => entries })
}
/** captureMessage 는 동적 import 의 `.then` 안에서 불린다 — 마이크로태스크를 비워야 보인다. */
const settle = () => new Promise<void>((r) => setTimeout(r, 0))

describe('성능 경고 중복 — trackPageLoad (2026-10-07)', () => {
  beforeEach(() => {
    made.length = 0
    captureMessage.mockClear()
    addBreadcrumb.mockClear()
    vi.stubEnv('PROD', true)
    vi.stubGlobal('PerformanceObserver', FakePO)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules() })

  async function start() {
    const { PerformanceMonitor } = await import('@/lib/performance-monitor')
    PerformanceMonitor.trackPageLoad('test')
    return PerformanceMonitor
  }
  const msgs = () => captureMessage.mock.calls.map((c) => String(c[0]))

  it('⓪ 측정기 자기검사 — 옵저버가 실제로 붙었다', async () => {
    await start()
    // 0개면 아래 단언들이 전부 "아무 일도 안 일어났으니 통과" 가 된다.
    expect(made.length).toBeGreaterThanOrEqual(3)
    expect(made.flatMap((o) => o.types)).toContain('largest-contentful-paint')
  })

  it('① LCP entry 가 여럿이어도 경고는 1건 — 그리고 **최종값**이다', async () => {
    await start()
    feed('largest-contentful-paint', [{ renderTime: 3524 }])
    feed('largest-contentful-paint', [{ renderTime: 4140 }])
    await settle()
    expect(msgs()).toHaveLength(0)          // flush 전엔 안 보낸다
    window.dispatchEvent(new Event('pagehide'))
    await settle()
    const lcp = msgs().filter((m) => m.includes('Slow LCP'))
    expect(lcp).toHaveLength(1)
    expect(lcp[0]).toContain('4140')        // 3524(중간값)가 아니라 최종값
  })

  it('② CLS 는 시프트마다 쏘지 않는다 (종전 최악의 자리)', async () => {
    await start()
    for (let i = 0; i < 8; i++) feed('layout-shift', [{ value: 0.05, hadRecentInput: false }])
    await settle()
    window.dispatchEvent(new Event('pagehide'))
    await settle()
    expect(msgs().filter((m) => m.includes('High CLS'))).toHaveLength(1)
  })

  it('③ INP 도 상호작용마다 쏘지 않는다', async () => {
    await start()
    for (const d of [250, 300, 280]) feed('event', [{ duration: d }])
    await settle()
    window.dispatchEvent(new Event('pagehide'))
    await settle()
    const inp = msgs().filter((m) => m.includes('Slow INP'))
    expect(inp).toHaveLength(1)
    expect(inp[0]).toContain('300')         // max
  })

  it('④ 트리거가 둘 다 와도 보고는 1건 (10초 폴백 → 그 뒤 pagehide)', async () => {
    // 🩸 첫 판은 `pagehide` 를 **두 번** 쏘아 "두 번 flush" 를 흉내 냈는데, 그 리스너는
    //   `{ once: true }` 라 두 번째가 아무 일도 안 했고 `visibilitychange` 도 jsdom 의
    //   `visibilityState`('visible') 때문에 그냥 반환했다 ⇒ flush 가 **한 번도 두 번 불린 적이
    //   없는데** "두 번 불러도 1건" 을 단언하고 있었다(주입 검증이 잡았다 — 오늘 이 클래스 셋째).
    //   실제로 둘 다 오는 경로는 **서로 다른 트리거**다: 10초 폴백이 먼저 보내고, 그 뒤 사용자가 떠난다.
    await start()
    feed('largest-contentful-paint', [{ renderTime: 9000 }])
    await settle()
    vi.advanceTimersByTime(10000)        // flush ①
    await settle()
    expect(msgs()).toHaveLength(1)
    window.dispatchEvent(new Event('pagehide'))   // flush ② — 가드가 없으면 여기서 또 간다
    await settle()
    expect(msgs()).toHaveLength(1)
  })

  it('④-2 visibilitychange→hidden 도 보고를 보낸다 (경로가 살아 있는가)', async () => {
    await start()
    feed('largest-contentful-paint', [{ renderTime: 7000 }])
    await settle()
    // jsdom 기본은 'visible' — 'hidden' 으로 바꿔야 그 분기가 실제로 돈다.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(msgs().filter((m) => m.includes('Slow LCP'))).toHaveLength(1)
  })

  it('⑤ pagehide 가 안 와도 10초 폴백이 보낸다 (카카오 인앱·사파리)', async () => {
    await start()
    feed('largest-contentful-paint', [{ renderTime: 5000 }])
    await settle()
    expect(msgs()).toHaveLength(0)
    vi.advanceTimersByTime(10000)
    await settle()
    expect(msgs().filter((m) => m.includes('Slow LCP'))).toHaveLength(1)
  })

  it('⑥ flush 뒤에는 옵저버를 끊는다 (앱 수명 내내 들고 있지 않는다)', async () => {
    await start()
    window.dispatchEvent(new Event('pagehide'))
    await settle()
    expect(made.filter((o) => o.disconnected).length).toBeGreaterThanOrEqual(3)
  })

  it('⑦ 임계 미달이면 아무것도 안 보낸다 (경고가 늘 가는 것이 아니다)', async () => {
    await start()
    feed('largest-contentful-paint', [{ renderTime: 1200 }])
    feed('layout-shift', [{ value: 0.01, hadRecentInput: false }])
    await settle()
    window.dispatchEvent(new Event('pagehide'))
    await settle()
    expect(msgs()).toHaveLength(0)
    // 그래도 breadcrumb 은 남는다 — 바뀐 것은 보고뿐이다.
    expect(addBreadcrumb.mock.calls.length).toBeGreaterThan(0)
  })
})
