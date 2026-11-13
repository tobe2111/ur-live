/**
 * ⭐ 서버 첫 화면 별점(★★★★★ 두 겹) 클래스·비율 — 홈 카드·상세 첫 화면이 같이 쓴다.
 *   2026-11-13 따로 뗐다: 상세 첫 화면이 이 셋 때문에 홈 첫 화면 모듈을 통째로 import 해서 표면 CSS 생성기가
 *   홈 카드 클래스까지 끌고 왔다(숙소 상세 표면 42KB > 상한 40KB). 값은 `HOME_FS_CLASS.star*` 가 이것을 가리킨다.
 */
export const STAR_FS = {
  wrap: 'relative inline-block shrink-0 leading-none select-none align-middle',
  base: 'text-gray-300 dark:text-gray-600',
  fill: 'absolute left-0 top-0 overflow-hidden whitespace-nowrap text-yellow-400',
} as const

export function starFillPct(value: number): number {
  return Math.max(0, Math.min(100, (value / 5) * 100))
}
