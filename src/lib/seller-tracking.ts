/**
 * 🛡️ 2026-05-21 Phase D: 셀러 트래킹 attribution helper.
 *
 * 사용:
 *   1. 셀러가 /browse?seller=123 또는 /group-buy/45?seller=123 링크 공유
 *   2. 유저가 진입 시 captureTrackingFromUrl() 호출 → sessionStorage 저장
 *   3. 결제 endpoint 호출 시 getPurchaseRef() 로 ref 첨부(?seller= 와 ?ref= 중 나중 것)
 *   4. 백엔드가 referral_commissions INSERT (이미 인프라)
 *
 * 영구성:
 *   - sessionStorage (탭 닫으면 초기화 — 영구 X 의도)
 *   - 24시간 만료 (저장 시점 + 24h)
 *   - URL 에 ?seller= 있으면 우선 (재진입 시 새 셀러로 갱신)
 *   - 자기 자신 셀러 토큰이면 저장 안 함 (셀러가 자기 링크로 가짜 attribution 방지)
 */
import { readAffiliateRef } from '@/utils/affiliate-ref-store'
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

/** `?seller=` 로 들어온 값(탭 세션 · 24시간). 만료면 지운다. */
function readSessionSeller(now: number): { id: string; at: number } | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as TrackingData
    if (!data?.seller_id) return null
    if (now - data.saved_at > TTL_MS) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return { id: data.seller_id, at: data.saved_at }
  } catch {
    return null
  }
}

/**
 * 결제 요청 본문의 `ref` — **마지막에 연 소개 링크** (2026-10-11 대표 *"마지막 링크를 우선으로 해줘"*).
 *
 * 소개 링크는 두 가지 모양으로 들어온다: 매장 공유 `?seller=`(여기 sessionStorage) · 딜·유어샵·핀 `?ref=`/`?aff=`
 * (`affiliate-ref-store`). 종전엔 이 함수가 앞의 것만 돌려줬고 서버는 본문을 헤더보다 먼저 읽어서, 옛 매장 링크를
 * 먼저 열었다가 딜 링크로 사도 **먼저 연 쪽**이 이겼다. 이제 둘의 들어온 시각을 비교해 **나중 것**을 낸다.
 * (종전 이름 `getTrackedSellerId` — 매장 공유 링크만 돌려주던 시절 이름이라 2026-10-11 바꿨다. 호출부 3곳 함께.)
 */
export function getPurchaseRef(): string | null {
  if (typeof window === 'undefined') return null
  const now = Date.now()
  const seller = readSessionSeller(now)
  const aff = readAffiliateRef(now)
  if (seller && aff) return aff.at >= seller.at ? aff.ref : seller.id
  return seller?.id ?? aff?.ref ?? null
}

export function clearTrackedSeller(): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(KEY) } catch { /* graceful */ }
}
