/**
 * 🖼️ 이용권 줄(`pages/restaurant-map/RestaurantRow`) 썸네일의 변환 옵션 SSOT (2026-11-10).
 *   검색 결과 시드의 첫 줄 사진을 워커가 응답 헤더 preload 로 당긴다(`worker/utils/search-thumb-preload.ts`).
 *   preload 주소는 줄이 그리는 `<img src>` 와 **글자 하나 다르지 않아야** 한다 — 다르면 브라우저가 미리 받은 것을 버리고 다시 받는다.
 *   그래서 줄과 워커가 이 옵션 하나로 `cfImage` 를 부른다(88px 칸 @2x).
 */
export const ROW_THUMB_OPTS = { width: 176, quality: 85, format: 'auto' } as const

/**
 * 🎫 이용권 줄의 **클래스 SSOT** (2026-11-10 — 검색 결과 줄을 서버가 그린다 `worker/utils/search-first-screen.ts`).
 *   줄(`RestaurantRow`)과 워커가 이 상수 하나를 읽는다 — 두 벌로 적으면 하나만 고치는 날 마운트 때 줄이 튄다(에러 0).
 *   값은 줄에 있던 리터럴 **그대로**다(지도 목록 시각 변화 0). 이 파일은 `vite.config.ts` `MAP_ROW_MODULES` 에 이미 있다(청크 순환 방지).
 */
export const ROW_CLS = {
  btn: 'w-full flex gap-3 py-4 text-left transition-[background-color,transform] duration-150 active:scale-[0.985] motion-reduce:active:scale-100',
  btnSelected: 'bg-brand/[0.06] dark:bg-brand/[0.14]',
  btnIdle: 'hover:bg-gray-50/60 dark:hover:bg-[#0E0E0E] active:bg-gray-100 dark:active:bg-[#161616]',
  thumb: 'w-[88px] h-[88px] rounded-lg object-cover shrink-0',
  thumbEmpty: 'w-[88px] h-[88px] rounded-lg bg-gray-100 dark:bg-[#1D1F29] flex items-center justify-center shrink-0',
  body: 'flex-1 min-w-0',
  title: 'font-bold text-gray-900 dark:text-white text-[15px] truncate',
  store: 'text-[12px] text-gray-500 dark:text-gray-400 mt-1 truncate',
  addr: 'text-[12px] text-gray-400 dark:text-gray-500 mt-1 truncate flex items-center gap-1',
  pin: 'w-3 h-3 shrink-0',
  priceRow: 'flex items-baseline gap-2 mt-2',
  discount: 'text-[16px] font-bold text-sale',
  price: 'text-[16px] font-bold text-gray-900 dark:text-white',
  original: 'text-[12px] text-gray-400 dark:text-gray-500 line-through',
} as const
export const ROW_NO_ADDRESS = '주소 미등록'
/** 핀 아이콘(`PinIcon`)과 같은 그림 — 워커가 같은 path 로 그린다(시험이 아이콘 소스와 대조). */
export const ROW_PIN = { path: 'M12 20.8s6.6-5.9 6.6-10.4a6.6 6.6 0 1 0-13.2 0C5.4 14.9 12 20.8 12 20.8z', cx: '12', cy: '10.2', r: '2.5' } as const
