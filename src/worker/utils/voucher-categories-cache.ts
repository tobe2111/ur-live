/**
 * 🧾 교환권 카테고리 목록 캐시(SESSION_KV) — 키와 수명을 한 곳에. 2026-11-18 대표 승인 "해줘" [UNLOCK_LOADING].
 *   라이브: 하루 151번 다시 계산(1회 7,016줄 · 74ms) · KV 쓰기 최대 288회/일(무료 1천의 약 29%). 목록은 KT 동기화 때만 바뀐다.
 *   ⇒ 6시간 살리고, KT 동기화(`kt-alpha-catalog-sync.ts` `afterCatalogSync`)가 성공하면 지운다.
 *   ⚠️ 응답의 Cache-Control 헤더는 잠금 항목이라 그대로다(브라우저·엣지 신선도는 종전과 같다) — 바뀌는 것은 서버 안 KV 수명뿐.
 */
export const VOUCHER_CATEGORIES_CACHE_KEY = 'vouchers_categories_v5'
export const VOUCHER_CATEGORIES_KV_TTL_S = 6 * 60 * 60
