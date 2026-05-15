/**
 * 🛡️ 2026-05-15: Web Vitals 자동 수집 (web-vitals 패키지 없이 직접 PerformanceObserver).
 *
 * 페이지 로드 시 1회 호출하면 LCP/CLS/FID/INP/TTFB 측정 후 sendBeacon 으로 백엔드 KV 카운터에 기록.
 * 백엔드 sampling 1% 라 traffic 영향 0. App.tsx 또는 main.tsx 에서 1회 호출.
 */

let reported = false

function send(name: string, value: number, page: string) {
  try {
    const body = JSON.stringify({ name, value, page })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/vitals', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/analytics/vitals', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
        .catch(() => { /* silent */ })
    }
  } catch { /* silent */ }
}

export function reportWebVitals(): void {
  if (reported || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
  reported = true
  const page = window.location.pathname

  // TTFB
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav) send('TTFB', nav.responseStart - nav.requestStart, page)
  } catch { /* unsupported */ }

  // LCP — 가장 큰 paint 의 마지막 entry (페이지 떠날 때 확정)
  try {
    let lcpValue = 0
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number }
      lcpValue = last.renderTime || last.loadTime || last.startTime
    })
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true })
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && lcpValue > 0) {
        send('LCP', lcpValue, page)
        lcpObs.disconnect()
      }
    }, { once: true })
  } catch { /* unsupported */ }

  // CLS — visibilitychange 시점 누적값
  try {
    let clsValue = 0
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
        if (!e.hadRecentInput) clsValue += e.value || 0
      }
    })
    clsObs.observe({ type: 'layout-shift', buffered: true })
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        send('CLS', Math.round(clsValue * 1000), page)  // CLS 는 0-1 범위 → ×1000 정수화
        clsObs.disconnect()
      }
    }, { once: true })
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
