/**
 * 🆕 2026-06-29 (대표 — "먼저 분석하고 결정"): 경량 퍼널 계측 클라이언트.
 *
 *   유어딜 소비자 이탈 지도 6지점을 익명으로 기록 → 어드민 `/admin/funnel` 에서 실제 이탈률 확인.
 *   - 비블로킹: navigator.sendBeacon (실패해도 UX 무영향, fire-and-forget)
 *   - 개인정보 0: 익명 랜덤 device id(ur_fid, localStorage) — 개인 식별 불가
 *   - D1 부담 최소: app_open 은 **세션당 1회**(sessionStorage 가드) → 페이지뷰마다 안 씀
 */
const FID_KEY = 'ur_fid'
const SESSION_OPEN_KEY = 'ur_funnel_opened'

export type FunnelEvent =
  | 'app_open'
  | 'login_wall_shown'
  | 'login_succeeded'
  | 'checkout_started'
  | 'payment_succeeded'
  | 'empty_region_shown'

function getFid(): string {
  try {
    let fid = localStorage.getItem(FID_KEY)
    if (!fid) {
      const b = crypto.getRandomValues(new Uint8Array(12))
      fid = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(FID_KEY, fid)
    }
    return fid
  } catch {
    return 'anon'
  }
}

export function trackFunnel(event: FunnelEvent, meta?: Record<string, unknown>): void {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return
    // app_open 은 세션당 1회만 (페이지뷰마다 X → D1 쓰기 상한 = 세션 수)
    if (event === 'app_open') {
      if (sessionStorage.getItem(SESSION_OPEN_KEY)) return
      sessionStorage.setItem(SESSION_OPEN_KEY, '1')
    }
    const payload = JSON.stringify({ event, fid: getFid(), meta: meta ?? undefined })
    const url = '/api/funnel/track'
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))
    } else {
      void fetch(url, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => { /* ignore */ })
    }
  } catch {
    /* 계측 실패가 UX 를 막지 않음 */
  }
}
