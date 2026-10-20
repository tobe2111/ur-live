/**
 * 🏷️ 2026-07-19 (대표 UI v2 P2 — 카드 제목 중복 제거): 제목이 매장명 프리픽스로 시작하면
 * 메뉴명만 남긴다(매장명은 카드 아랫줄 한 곳에만). 제거 결과가 비면(제목=매장명) 원제목 유지.
 * 표시 전용 — 데이터/DB 무변경.
 */
export function stripStorePrefix(title?: string | null, store?: string | null): string {
  const t = (title || '').trim()
  const s = (store || '').trim()
  if (!t || !s || s.length < 2) return t
  if (!t.toLowerCase().startsWith(s.toLowerCase())) return t
  const rest = t.slice(s.length).replace(/^[\s\-–—·:|,]+/, '').trim()
  return rest || t
}

/**
 * 🔎 **카드 사진의 이름(`alt`)** — "매장명 권종명" (2026-10-11 대표 신고 · SEO)
 *
 * 🩸 왜 생겼나 (실측): 대표가 Google 이미지에서 **헤이춘천 사진**을 눌렀더니 출처가
 *   `urdeal.kr` 인데 제목이 사이트 기본값(*"유어딜 - 우리 동네 맛집·카페·뷰티 이용권 할인"*)이었다.
 *   *"이용권 명칭이 뜨게 해야 노출이 되지 않겠어?"*
 *
 *   추적하니 그 사진이 **진짜 `<img>` 로 렌더되는 곳은 홈·목록 카드뿐**이다(상세 히어로는
 *   CSS `background-image` — 아래 ⚠️). 그래서 Google 은 그 사진을 **목록 페이지**에 귀속시키고,
 *   목록 페이지 제목은 매장·권종을 한 글자도 안 말한다.
 *
 *   그런데 카드의 `alt` 마저 `p.name` 뿐이었다 — `"주말 1박 숙박권 (스탠다드 룸)"`.
 *   그 문자열은 **호텔 수십 곳이 공유**하므로 사진에 붙은 유일한 이름이 *어느 매장인지 안 말한다.*
 *   ⇒ `"헤이춘천 주말 1박 숙박권 (스탠다드 룸)"`.
 *
 * ⚠️ **상품명이 매장명으로 시작하는 경우**가 있어 그냥 이으면 `"헤이춘천 헤이춘천 …"` 이 된다.
 *   위 `stripStorePrefix`(카드 제목이 이미 쓰는 그 함수)를 거쳐 **같은 규칙으로** 중복을 없앤다.
 *
 * ⚠️ **이 함수가 못 고치는 것**: 사진의 *귀속 페이지*. 상세 히어로가 `<img>` 가 되기 전까지는
 *   Google 이 여전히 목록 페이지를 출처로 본다(제목도 그 페이지 것). 그건 별건이다.
 */
export function cardImageAlt(
  name?: string | null,
  store?: string | null,
  fallback?: string | null,
): string {
  const s = (store || '').trim()
  const body = stripStorePrefix(name, store)
  if (s && body) return `${s} ${body}`
  return body || s || (fallback || '').trim()
}
