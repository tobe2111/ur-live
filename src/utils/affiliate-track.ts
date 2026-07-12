/**
 * 🧭 2026-06-10 (링크샵×교환권 적립 루프): 큐레이터 추천(aff/ref) 저장 + 구매 후 적립 발사.
 *
 * 물리상품(ProductDetailPage ?ref=)과 동일한 localStorage 키를 공유 — 교환권/공구 상세는 ?aff= 로 진입.
 * 적립은 서버 /api/affiliate/track 이 전부 검증(주문 소유자·금액 서버값·상품 referral_enabled·중복 차단).
 */
import api from '@/lib/api'

const KEY = 'affiliate_ref'
const EXP_KEY = 'affiliate_ref_expires'
// 🧭 2026-07-12 (WP-C — 블로거 영입 트랙): 어트리뷰션 윈도우 24h→7d. 네이버 블로그는 롱테일
//   유입(글 발행 뒤 며칠~몇 주 후 클릭·구매)이라 24h 로는 인플 귀속이 유실됨. ProductDetailPage
//   와 동일 상수(4곳 동기). 비-머니(귀속 타이밍만) — 서버 /track 검증·중복차단 불변.
const REF_TTL_MS = 7 * 24 * 60 * 60 * 1000
const REF_TTL_SEC = 7 * 24 * 60 * 60

/** ?aff=/?ref= 값 저장 (7d) — ProductDetailPage 와 동일 포맷. */
export function storeAffiliateRef(ref: string | null | undefined): void {
  if (!ref || !/^\d{1,12}$/.test(ref)) return
  try {
    // 본인 추천 자기적립 방지 — 내 user_id 면 저장 안 함
    const myId = localStorage.getItem('user_id')
    if (myId && myId === ref) return
    localStorage.setItem(KEY, ref)
    localStorage.setItem(EXP_KEY, String(Date.now() + REF_TTL_MS))
    document.cookie = `affiliate_ref=${ref}; path=/; max-age=${REF_TTL_SEC}; SameSite=Lax`
  } catch { /* storage unavailable */ }
}

/** 구매 성공 후 적립 시도 — fail-soft(적립 실패가 구매 UX 를 막지 않음). 서버가 중복/자격 전부 검증. */
export function fireAffiliateTrack(orderId: number | null | undefined, productId: number, productName?: string): void {
  try {
    if (!orderId || !Number.isFinite(orderId)) return
    const ref = localStorage.getItem(KEY)
    const exp = Number(localStorage.getItem(EXP_KEY) || 0)
    if (!ref || !exp || Date.now() > exp) return
    const myId = localStorage.getItem('user_id')
    if (myId && myId === ref) return
    void api.post('/api/affiliate/track', {
      referrer_id: ref,
      order_id: orderId,
      product_id: productId,
      product_name: productName || null,
    }).catch(() => { /* 적립 best-effort */ })
  } catch { /* noop */ }
}
