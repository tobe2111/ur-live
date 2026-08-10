/**
 * 🧭 2026-06-10 (링크샵×교환권 적립 루프): 큐레이터 추천(aff/ref) 저장 + 구매 후 적립 발사.
 *
 * 물리상품(ProductDetailPage ?ref=)과 동일한 localStorage 키를 공유 — 교환권/공구 상세는 ?aff= 로 진입.
 * 적립은 서버 /api/affiliate/track 이 전부 검증(주문 소유자·금액 서버값·상품 referral_enabled·중복 차단).
 */
import api from '@/lib/api'
import { getAnonId } from '@/utils/anon-id'

const KEY = 'affiliate_ref'
const EXP_KEY = 'affiliate_ref_expires'
// 📡 유입 클릭 이벤트 클라 dedup — 같은 ref 재발사 억제(서버도 INSERT OR IGNORE 로 이중 방어).
const INFLOW_SENT_KEY = 'ur_inflow_sent_v1'
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
    // 📡 2026-07-13 (데이터 감사 2단계): 유입 클릭 이벤트 서버 발사 — 완결고리 '유입' 노드.
    //   전환 안 해도 인플루언서→방문자 유입이 서버에 보존(구매 전 유실 0). 같은 ref 는 1회만(dedup).
    fireInflowClick(ref)
  } catch { /* storage unavailable */ }
}

// 📣 2026-08-09 (캠페인 신청 페이지): URL 의 캠페인 코드(?c= 또는 ?campaign=)를 유입 클릭에 태운다.
//   inflow_clicks.campaign 컬럼·서버 파라미터는 2026-07-13 부터 있었으나 클라가 안 보내 항상 NULL 이던 것.
//   서버가 normalizeAcqSource 로 재검증하므로 여기선 형식만 거른다(fail-soft).
function campaignFromUrl(): string | undefined {
  try {
    const q = new URLSearchParams(location.search)
    const v = (q.get('c') || q.get('campaign') || '').trim().toLowerCase()
    return /^[a-z0-9][a-z0-9-]{0,39}$/.test(v) ? v : undefined
  } catch { return undefined }
}

/**
 * 📣 2026-08-09: 유입 클릭만 기록(어필리에이트 귀속 없음) — 루트(/?ref=) 등 상세 밖 랜딩용.
 *   affiliate_ref 저장(구매 귀속)은 건드리지 않아 머니 경로 무접촉 — 데이터 수집만.
 *   서버 share_url(affiliate.routes)·캠페인 완료화면이 발급하는 `urdeal.kr/?ref=` 링크가
 *   지금까지 inflow_clicks 에 안 남던 갭(전역 캡처 부재)을 닫는다.
 */
export function captureInflowRef(ref: string | null | undefined): void {
  try {
    if (!ref || !/^\d{1,12}$/.test(ref)) return
    const myId = localStorage.getItem('user_id')
    if (myId && myId === ref) return // 본인 링크 진입은 무귀속
    fireInflowClick(ref)
  } catch { /* noop */ }
}

/** 유입 클릭 서버 발사 — fail-soft·1회(ref별). 서버가 (anon_id, ref) UNIQUE 로 이중 방어. */
function fireInflowClick(ref: string): void {
  try {
    if (localStorage.getItem(INFLOW_SENT_KEY) === ref) return // 같은 ref 이미 발사
    const anonId = getAnonId()
    void api.post('/api/acquisition/inflow', {
      anon_id: anonId,
      ref,
      ref_type: 'curator',
      campaign: campaignFromUrl(),
      path: (typeof location !== 'undefined' ? location.pathname : '').slice(0, 200),
    }).then(() => {
      try { localStorage.setItem(INFLOW_SENT_KEY, ref) } catch { /* noop */ }
    }).catch(() => { /* best-effort */ })
  } catch { /* noop */ }
}

/**
 * 📡 2026-07-13 (데이터 감사 2단계): 로그인/가입 후 익명 유입 클릭을 유저에 귀속(bind).
 *   멱등(서버는 user_id IS NULL 인 행만 UPDATE) — 마운트마다 호출돼도 무해. fail-soft.
 */
export function bindInflowClicksIfLoggedIn(loggedIn: boolean): void {
  try {
    if (!loggedIn) return
    const anonId = getAnonId()
    void api.post('/api/acquisition/inflow/bind', { anon_id: anonId }).catch(() => { /* best-effort */ })
  } catch { /* noop */ }
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
