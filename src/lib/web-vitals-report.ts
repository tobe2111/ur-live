/**
 * 🛡️ 2026-05-15: Web Vitals 자동 수집 (web-vitals 패키지 없이 직접 PerformanceObserver).
 *
 * 페이지 로드 시 1회 호출하면 LCP/CLS/FID/INP/TTFB 측정 후 sendBeacon 으로 백엔드 KV 카운터에 기록.
 * 백엔드 sampling 1% 라 traffic 영향 0. App.tsx 또는 main.tsx 에서 1회 호출.
 */

import { CLS_SOURCE_MIN, clsSourceString } from '@/shared/cls-source'

let reported = false

/**
 * 🤖 2026-10-14: 자동화 브라우저(Playwright·Selenium·CI 하네스)는 보고하지 않는다.
 *   실측 — 그날 `/map` LCP 10.9초 표본의 데이터센터가 전부 미국(EWR·IAD·ORD …)이고 한국(ICN)은 0 이었다.
 *   우리가 라이브를 재려고 띄운 헤드리스 브라우저가 미국에서 카카오 타일(한국 CDN)을 받느라 느렸던 것이
 *   "실사용자 지표" 로 집계됐다. 사람의 브라우저는 `navigator.webdriver` 가 false 다(표준 — WebDriver 명세).
 */
export function isAutomatedBrowser(): boolean {
  try { return typeof navigator !== 'undefined' && navigator.webdriver === true } catch { return false }
}

function send(name: string, value: number, page: string, extra?: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ name, value, page, ...extra })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/vitals', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/analytics/vitals', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
        .catch(() => { /* silent */ })
    }
  } catch { /* silent */ }
}

/**
 * 📏 CLS 세션 창 — 구글·web-vitals 와 같은 정의(2026-10-14).
 *   밀림이 1초 넘게 끊기거나 창이 5초를 넘으면 새 창을 연다. 보고값은 **가장 큰 창**이다.
 *   모두 더하면 오래 머문 사람일수록 점수가 커져서, 화면이 나쁜 것과 오래 본 것을 구분하지 못한다.
 */
export function createClsTracker() {
  let max = 0, cur = 0, first = 0, last = 0
  return {
    add(value: number, t: number) {
      if (cur > 0 && t - last < 1000 && t - first < 5000) { cur += value; last = t }
      else { cur = value; first = t; last = t }
      if (cur > max) max = cur
    },
    value: () => max,
  }
}


/**
 * 🔬 2026-10-19 — LCP 를 **어디서 시간이 갔는지** 넷으로 쪼갠다(구글 web-vitals 의 attribution 과 같은 정의).
 *
 * 왜: 실사용 SLO 가 홈 LCP p75 3.5초를 사흘째 경보했는데 **고칠 곳을 고를 근거가 없었다** — 저장하는 것이
 *   숫자 하나라서, 그게 서버가 늦은 탓인지(TTFB) · 사진을 늦게 알아챈 탓인지 · 사진이 무거운 탓인지 ·
 *   그려 줄 코드가 늦은 탓인지 구분이 안 됐다. 라이브 실험실 측정(느린 4G·CPU 4배)은 1.2~1.4초라
 *   실사용 3.5초와 거리가 멀다 ⇒ 추측으로 고치지 말고 실사용 표본에서 쪼개 본다.
 *
 *   ttfb = 첫 바이트 · lrd = 그 뒤 사진 요청을 시작하기까지 · ld = 사진 받는 시간 · erd = 받은 뒤 그리기까지
 *   (글자가 LCP 면 lrd·ld 는 0 이고 erd 가 전부). 넷의 합 = LCP.
 */
export interface LcpBreakdown { ttfb: number; lrd: number; ld: number; erd: number; img: 0 | 1 }

export function lcpBreakdown(
  lcp: number,
  ttfb: number,
  resource: { requestStart?: number; startTime: number; responseEnd: number } | null,
  isImage: boolean,
): LcpBreakdown {
  const t = Math.max(0, Math.min(ttfb, lcp))
  if (!resource) return { ttfb: Math.round(t), lrd: 0, ld: 0, erd: Math.round(lcp - t), img: isImage ? 1 : 0 }
  const reqStart = Math.min(lcp, Math.max(t, resource.requestStart || resource.startTime))
  const resEnd = Math.min(lcp, Math.max(reqStart, resource.responseEnd))
  return {
    ttfb: Math.round(t),
    lrd: Math.round(reqStart - t),
    ld: Math.round(resEnd - reqStart),
    erd: Math.round(lcp - resEnd),
    img: isImage ? 1 : 0,
  }
}

export function reportWebVitals(): void {
  if (reported || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
  if (isAutomatedBrowser()) return
  reported = true
  const page = window.location.pathname

  // TTFB
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav) {
      send('TTFB', nav.responseStart - nav.requestStart, page)
      // 📡 2026-10-12 (대표 *"마트 새 폰으로 첫 페이지가 10초"* — 이 환경에서 재현 불가):
      //   위 TTFB 는 **요청을 보낸 뒤부터**라 DNS·연결·암호화(새 기기에서 가장 비싼 부분)가 빠져 있다.
      //   CONN = 이동 시작 → 연결 완료(리다이렉트·DNS·TCP·TLS 전부). 첫 방문이면 0 이 아니다.
      send('CONN', Math.max(0, nav.connectEnd), page)
      // 어느 데이터센터가 응답했나 — 워커가 `Server-Timing: colo;desc="ICN"` 를 싣는다(css-first-boot.ts).
      //   페이지 자리에 `colo:XXX` 로 보내 같은 표본 저장소에서 데이터센터별 TTFB 분포를 본다.
      const colo = (nav.serverTiming || []).find((t) => t.name === 'colo')?.description
      if (colo) send('TTFB', nav.responseStart, `colo:${colo}`)
    }
  } catch { /* unsupported */ }

  // LCP — 가장 큰 paint 의 마지막 entry (페이지 떠날 때 확정)
  try {
    let lcpValue = 0
    let lcpEntry: (PerformanceEntry & { url?: string; element?: Element | null }) | null = null
    // 🧭 2026-10-19: 미리 그려 둔(prerender) 페이지는 **사용자가 연 순간**부터 잰다 — web-vitals 와 같은 정의.
    //   빼지 않으면 백그라운드에서 그려 둔 시간이 LCP 에 얹혀 실제보다 늦게 집계된다.
    const nav0 = performance.getEntriesByType('navigation')[0] as (PerformanceNavigationTiming & { activationStart?: number }) | undefined
    const activation = Math.max(0, nav0?.activationStart || 0)
    // 🙈 2026-10-19: **처음부터 숨은 채 열린 탭**(카톡 링크를 길게 눌러 새 탭 · 백그라운드 탭)은 그려지지 않으니
    //   LCP 가 보는 사람과 무관하게 길어진다. web-vitals 는 이런 표본을 버린다 — 우리도 같은 규칙.
    let hiddenAt = document.visibilityState === 'hidden' ? 0 : Infinity
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hiddenAt = Math.min(hiddenAt, performance.now()) }, { once: true })
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number; url?: string; element?: Element | null }
      lcpValue = last.renderTime || last.loadTime || last.startTime
      lcpEntry = last
    })
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true })
    // 📈 2026-09-02: LCP 를 `visibilitychange→hidden` 에만 보내면 카카오 인앱/사파리처럼 그 이벤트가 안 오는
    //   환경에서 **영영 안 보낸다**(실측: 4일간 LCP 표본 0, TTFB 만 있었다). `pagehide` 와 로드 후 10초 폴백을 더한다
    //   — LCP 는 첫 입력/스크롤 뒤 확정되므로 10초면 최종값이다. 한 번만 보낸다(`sent` 가드).
    let sent = false
    const flush = () => {
      if (sent || lcpValue <= 0) return
      sent = true
      lcpObs.disconnect()
      if (hiddenAt <= lcpValue) return // 그려지기 전에 숨었다 — 보는 사람의 LCP 가 아니다
      const lcp = Math.max(0, lcpValue - activation)
      let parts: LcpBreakdown | undefined
      try {
        const ttfb = Math.max(0, (nav0?.responseStart || 0) - activation)
        const url = lcpEntry?.url || ''
        const res = url
          ? (performance.getEntriesByName(url, 'resource')[0] as PerformanceResourceTiming | undefined)
          : undefined
        parts = lcpBreakdown(lcp, ttfb, res ? {
          requestStart: Math.max(0, res.requestStart - activation),
          startTime: Math.max(0, res.startTime - activation),
          responseEnd: Math.max(0, res.responseEnd - activation),
        } : null, !!url)
      } catch { /* 쪼개기 실패는 LCP 보고를 막지 않는다 */ }
      send('LCP', lcp, page, parts ? { parts } : undefined)
    }
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() }, { once: true })
    addEventListener('pagehide', flush, { once: true })
    setTimeout(flush, 10000)
  } catch { /* unsupported */ }

  // CLS — 표준 방식(가장 나쁜 세션 창) · **이 페이지에 머무는 동안만**
  //   🩸 2026-10-14: 예전엔 ① 모든 밀림을 **끝없이 더했고** ② 사람이 앱 안에서 다른 화면으로 옮겨가도
  //   계속 세면서 ③ 이름은 **처음 연 페이지**로 붙였다. 그래서 `/my-vouchers` 에 CLS 0.721 이 찍혔는데,
  //   재현해 보니 지갑 자신은 0.012 이고 0.699 는 **홈 탭을 누른 뒤 홈에서** 난 것이었다. 지표가 엉뚱한
  //   화면을 가리키면 엉뚱한 화면을 고치게 된다. ⇒ 경로가 바뀌는 순간 그 값으로 확정해 보내고 멈춘다.
  try {
    const cls = createClsTracker()
    let clsSent = false
    // 🔬 2026-10-20: 가장 큰 밀림 한 건의 요소를 기억한다(`shared/cls-source`) — 실험실에서 재현 안 되는 실사용 CLS 의 원인.
    let worst = 0, worstSrc = ''
    const flushCls = () => {
      if (clsSent) return
      clsSent = true
      const v = Math.round(cls.value() * 1000)  // CLS 는 0-1 범위 → ×1000 정수화
      send('CLS', v, page, v >= CLS_SOURCE_MIN && worstSrc ? { src: worstSrc } : undefined)
      clsObs.disconnect()
    }
    const clsObs = new PerformanceObserver((list) => {
      if (clsSent) return
      // 앱 안 이동(SPA)은 문서가 그대로라 관측이 이어진다 — 이 페이지 몫이 아니므로 받기 전에 끊는다.
      if (window.location.pathname !== page) { flushCls(); return }
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean; sources?: Parameters<typeof clsSourceString>[0] }
        if (e.hadRecentInput) continue
        cls.add(e.value || 0, e.startTime)
        if ((e.value || 0) > worst) {
          worst = e.value || 0
          try { worstSrc = clsSourceString(e.sources, e.startTime, window.innerWidth, window.scrollY) } catch { /* 원인 기록 실패는 CLS 보고를 막지 않는다 */ }
        }
      }
    })
    clsObs.observe({ type: 'layout-shift', buffered: true })
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCls() }, { once: true })
    addEventListener('pagehide', flushCls, { once: true })
    // 이동은 이벤트가 따로 없다(pushState) — 밀림이 없으면 관측 콜백도 안 오므로 가볍게 확인한다.
    const navCheck = setInterval(() => {
      if (clsSent) { clearInterval(navCheck); return }
      if (window.location.pathname !== page) { clearInterval(navCheck); flushCls() }
    }, 1000)
  } catch { /* unsupported */ }

  // INP (replaces FID) — first-input 으로 fallback
  try {
    const fidObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { processingStart?: number }
        if (e.processingStart) send('INP', e.processingStart - e.startTime, page)
      }
    })
    fidObs.observe({ type: 'first-input', buffered: true })
  } catch { /* unsupported */ }
}

export function reportFunnel(event: 'view' | 'click' | 'join' | 'success', product_id?: number): void {
  if (isAutomatedBrowser()) return
  try {
    const body = JSON.stringify({ event, product_id, page: window.location.pathname })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/funnel', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/analytics/funnel', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
        .catch(() => { /* silent */ })
    }
  } catch { /* silent */ }
}
