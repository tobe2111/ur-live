/**
 * 🛡️ 2026-05-21 Phase D: 셀러 트래킹 attribution helper.
 *
 * 사용:
 *   1. 셀러가 /browse?seller=123 또는 /group-buy/45?seller=123 링크 공유
 *   2. 유저가 진입 시 captureTrackingFromUrl() 호출 → sessionStorage 저장
 *   3. 결제 endpoint 호출 시 getTrackedSellerId() 로 ref_seller_id 첨부
 *   4. 백엔드가 referral_commissions INSERT (이미 인프라)
 *
 * 영구성:
 *   - sessionStorage (탭 닫으면 초기화 — 영구 X 의도)
 *   - 24시간 만료 (저장 시점 + 24h)
 *   - URL 에 ?seller= 있으면 우선 (재진입 시 새 셀러로 갱신)
 *   - 자기 자신 셀러 토큰이면 저장 안 함 (셀러가 자기 링크로 가짜 attribution 방지)
 */
const KEY = 'ur_tracking_seller_v1'
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

interface TrackingData {
  seller_id: string
  saved_at: number
}

export function captureTrackingFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const sellerId = params.get('seller') || params.get('ref_seller')
    if (!sellerId) return
    // 형식 검증 (숫자만)
    if (!/^\d+$/.test(sellerId)) return
    // 자기 자신 attribution 차단
    const ownSellerId = localStorage.getItem('seller_id')
    if (ownSellerId && String(ownSellerId) === sellerId) return
    const data: TrackingData = { seller_id: sellerId, saved_at: Date.now() }
    sessionStorage.setItem(KEY, JSON.stringify(data))
    // 🛡️ 2026-05-21 Phase D-4: 클릭 기록 (funnel 측정용). 실패 silent.
    //   상품 page 진입이면 product_id 도 함께. /group-buy/45?seller=N → product_id=45.
    const productMatch = window.location.pathname.match(/^\/(?:group-buy|products|g)\/(\d+)/)
    const productId = productMatch ? Number(productMatch[1]) : undefined
    fetch('/api/referral/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller_id: sellerId, product_id: productId }),
      keepalive: true,
    }).catch(() => { /* 통계 실패 무시 */ })
  } catch { /* graceful */ }
}

export function getTrackedSellerId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as TrackingData
    if (!data?.seller_id) return null
    if (Date.now() - data.saved_at > TTL_MS) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return data.seller_id
  } catch {
    return null
  }
}

export function clearTrackedSeller(): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(KEY) } catch { /* graceful */ }
}
