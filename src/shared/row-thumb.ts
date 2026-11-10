/**
 * 🖼️ 이용권 줄(`pages/restaurant-map/RestaurantRow`) 썸네일의 변환 옵션 SSOT (2026-11-10).
 *   검색 결과 시드의 첫 줄 사진을 워커가 응답 헤더 preload 로 당긴다(`worker/utils/search-thumb-preload.ts`).
 *   preload 주소는 줄이 그리는 `<img src>` 와 **글자 하나 다르지 않아야** 한다 — 다르면 브라우저가 미리 받은 것을 버리고 다시 받는다.
 *   그래서 줄과 워커가 이 옵션 하나로 `cfImage` 를 부른다(88px 칸 @2x).
 */
export const ROW_THUMB_OPTS = { width: 176, quality: 85, format: 'auto' } as const
