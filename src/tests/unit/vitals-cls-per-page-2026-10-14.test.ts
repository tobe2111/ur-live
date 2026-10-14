/**
 * 📏 실사용자 CLS 는 **그 페이지 몫만**, 표준 방식으로 잰다 〔2026-10-14〕
 *
 * ## 무엇이 틀렸나
 * 어드민 속도 기록에 `CLS:/my-vouchers` p75 **0.721** 이 찍혔다(홈이 고치기 전 0.197 이었으니 3배 이상).
 * 하네스로 지갑을 그대로 재면 **0.012** 였고, 지갑에 들어온 뒤 하단 `홈` 을 누르면 **0.711** 이 나왔다 —
 * 0.699 가 **홈에서** 난 것이다. 원인은 계측 코드였다:
 *   ① 모든 밀림을 끝없이 더했다(표준은 가장 나쁜 5초 창 하나)
 *   ② 앱 안에서 다른 화면으로 옮겨가도 계속 셌다(SPA 는 문서가 그대로라 관측이 이어진다)
 *   ③ 이름은 **처음 연 페이지**로 붙였다
 * 그래서 지표가 엉뚱한 화면을 가리켰다. 그대로 두면 멀쩡한 지갑을 고치게 된다.
 *
 * ## 못 막는 것
 * - 서버 쪽 요약(p75)은 무접촉이다 — 이미 쌓인 옛 표본은 그대로 섞여 있다(날짜가 바뀌면 빠진다).
 * - LCP·INP 는 첫 입력에서 멈추므로 이 문제가 없다(이 시험의 범위 밖).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Entry = { value: number; startTime: number; hadRecentInput?: boolean }
let observers: Array<{ cb: (l: { getEntries: () => Entry[] }) => void; type: string; disconnected: boolean }> = []
const blobs: Blob[] = []
let sent: Array<{ name: string; value: number; page: string }> = []

const goTo = (p: string) => { (window.location as { pathname: string }).pathname = p }

function emit(type: string, entries: Entry[]) {
  for (const o of observers) if (o.type === type && !o.disconnected) o.cb({ getEntries: () => entries })
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  observers = []
  blobs.length = 0
  sent = []
  class FakePO {
    private rec: (typeof observers)[number]
    constructor(cb: (l: { getEntries: () => Entry[] }) => void) {
      this.rec = { cb, type: '', disconnected: false }
      observers.push(this.rec)
    }
    observe(o: { type: string }) { this.rec.type = o.type }
    disconnect() { this.rec.disconnected = true }
  }
  vi.stubGlobal('PerformanceObserver', FakePO)
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (_u: string, b: Blob) => { blobs.push(b); return true },
  })
  // 테스트 셋업이 window.location 을 평범한 객체로 바꿔 둬서 history 로는 경로가 안 바뀐다 — 직접 바꾼다.
  ;(window.location as { pathname: string }).pathname = '/my-vouchers'
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); goTo('/') })

const flushBeacons = async () => {
  await vi.advanceTimersByTimeAsync(1100)
  sent = await Promise.all(blobs.map(async (b) => JSON.parse(await b.text())))
}

describe('① 표준 세션 창 — 모두 더하지 않는다', async () => {
  const { createClsTracker } = await import('@/lib/web-vitals-report')

  it('1초 넘게 끊기면 새 창 — 보고값은 가장 큰 창', () => {
    const t = createClsTracker()
    t.add(0.1, 0); t.add(0.1, 500)        // 창 A = 0.2
    t.add(0.15, 3000)                       // 2.5초 끊김 → 창 B = 0.15
    expect(t.value()).toBeCloseTo(0.2)
  })

  it('창은 5초를 넘지 않는다 — 계속 조금씩 밀려도 무한히 쌓이지 않는다', () => {
    const t = createClsTracker()
    for (let ms = 0; ms <= 20000; ms += 900) t.add(0.05, ms)
    expect(t.value()).toBeLessThanOrEqual(0.05 * 6 + 1e-9)
  })

  it('밀림이 없으면 0', () => {
    expect(createClsTracker().value()).toBe(0)
  })
})

describe('② 그 페이지 몫만 — 앱 안에서 다른 화면으로 가면 확정하고 멈춘다', () => {
  it('이동 뒤의 밀림은 처음 연 페이지에 안 붙는다 (지갑 0.012 / 홈 0.699 재현)', async () => {
    const { reportWebVitals } = await import('@/lib/web-vitals-report')
    reportWebVitals()
    emit('layout-shift', [{ value: 0.0117, startTime: 1845 }])
    goTo('/')           // 하단 '홈'
    emit('layout-shift', [{ value: 0.6992, startTime: 5800 }])
    await flushBeacons()
    const cls = sent.filter((s) => s.name === 'CLS')
    expect(cls, 'CLS 를 한 번만 보낸다').toHaveLength(1)
    expect(cls[0].page).toBe('/my-vouchers')
    expect(cls[0].value, '홈의 밀림이 지갑 점수로 들어갔다').toBe(12)
  })

  it('밀림이 더 없어도 이동하면 1초 안에 보낸다 (관측 콜백이 안 와도)', async () => {
    const { reportWebVitals } = await import('@/lib/web-vitals-report')
    reportWebVitals()
    emit('layout-shift', [{ value: 0.05, startTime: 300 }])
    goTo('/map')
    await flushBeacons()
    const cls = sent.filter((s) => s.name === 'CLS')
    expect(cls).toHaveLength(1)
    expect(cls[0].value).toBe(50)
  })

  it('입력 직후의 밀림은 세지 않는다', async () => {
    const { reportWebVitals } = await import('@/lib/web-vitals-report')
    reportWebVitals()
    emit('layout-shift', [{ value: 0.3, startTime: 100, hadRecentInput: true }, { value: 0.02, startTime: 200 }])
    window.dispatchEvent(new Event('pagehide'))
    await flushBeacons()
    const cls = sent.filter((s) => s.name === 'CLS')
    expect(cls).toHaveLength(1)
    expect(cls[0].value).toBe(20)
  })
})
