/**
 * 🗺️ 지도 마커 알약 안에 들어가는 **카테고리 선 아이콘의 raw SVG** (2026-09-09).
 *
 * ## 왜 별도 파일인가
 * 지도 오버레이(`map-overlays.ts`)는 카카오 CustomOverlay 라 **HTML 문자열**을 만든다 —
 * React 컴포넌트인 `urdeal-icons.tsx` 를 그대로 못 쓴다.
 *
 * ## 🔴 그래서 이건 거울이다 (베끼는 게 아니라)
 * 같은 카테고리가 칩에선 이 그림, 마커에선 저 그림이면 그건 버그가 아니라 **거짓말**이다
 * (이 레포는 정의가 갈려 이미 여러 번 당했다 — 홈 섹션↔피드 카드, 서버 정렬↔클라 할인율).
 * 그래서 `map-marker-icons.test.ts` 가 **여기 path 문자열이 `urdeal-icons.tsx` 안에 실제로
 * 존재하는지** 대조한다. 아이콘 모양을 고치려면 두 곳을 같이 고쳐야 빨간불이 안 뜬다.
 *
 * 계약은 `urdeal-icons` 와 동일 — 24 뷰박스 · `currentColor` · `fill:none` · stroke 1.6 · round.
 */

/** `voucher-types.ts` 의 칩 4종과 1:1 (VOUCHER_CATEGORIES + 기타 폴백). */
const MAP_ICON_INNER: Record<string, string> = {
  // MealLineIcon
  meal_voucher:
    '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 1-3 3.5-3 6.5V12h3zM17 12v9"/>',
  // BeautyLineIcon
  beauty_voucher:
    '<circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/><path d="M9 15 19 4M15 15 5 4"/>',
  // StayLineIcon
  stay_voucher:
    '<path d="M3 19V9a2 2 0 0 1 2-2h2v4h10V9h2a2 2 0 0 1 2 2v8M3 15h18"/><rect x="7" y="7" width="10" height="4" rx="1"/>',
  // TicketStubIcon — 절취선은 마커 크기(13px)에서 뭉개져 뺀다(칩은 15px 라 유지).
  etc_voucher:
    '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/>',
}

/** 표에 없는 카테고리는 '기타' 티켓으로 — 그림을 지어내지 않는다(`dealCategoryMeta` 와 같은 태도). */
export function mapMarkerIconSvg(category: string | undefined | null, px: number): string {
  const inner = MAP_ICON_INNER[category || ''] || MAP_ICON_INNER.etc_voucher
  return `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;">${inner}</svg>`
}

/** 테스트가 `urdeal-icons.tsx` 와 대조하는 대상. */
export const MAP_ICON_INNER_FOR_TEST = MAP_ICON_INNER
