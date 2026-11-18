/**
 * 🗺️ 2026-11-18 지도 카테고리 칩의 **아이콘 없는** 정의 — `voucher-types.ts` 에서 떼어 냈다.
 *   워커(`worker/utils/map-first-screen.ts`)가 서버 첫 화면 칩 글자를 같은 표로 그리는데, 아이콘 모듈(.tsx)을
 *   끌어오면 워커 번들·타입검사에 React 아이콘이 딸려 들어왔다. 화면은 `voucher-types.ts` 가 여기에 아이콘을 얹어 쓴다.
 *
 * ⚠️ key 는 반드시 `@/shared/constants/voucher-categories` 의 VOUCHER_CATEGORIES + 'all' 과 일치.
 */

/** 'all'(전체) + 실제 카테고리. VOUCHER_CATEGORIES 와 1:1. */
export type MapVoucherType = 'all' | 'meal_voucher' | 'beauty_voucher' | 'stay_voucher' | 'home_voucher' | 'etc_voucher'

export interface MapVoucherLabel {
  key: MapVoucherType
  labelKey: string
  defaultLabel: string
  /**
   * 🗺️ 2026-08-19 (대표 — "카카오맵처럼 한 줄 안에 모든 카테고리"): PC 좌측 400px 패널은
   *   7칸을 한 줄에 넣으므로 칸당 ~53px 다. '뷰티·헬스'(5자)는 그 폭에서 잘린다.
   *   ⇒ **좁은 자리 전용 짧은 라벨**. 없으면 `defaultLabel` 을 쓴다(대부분 이미 짧다).
   *   ⚠️ 카테고리 자체를 줄이는 게 아니다 — 넓은 지도 오버레이는 계속 긴 라벨을 쓴다.
   */
  shortLabel?: string
}

/** 칩 정의 — 헬스는 '뷰티·헬스'(beauty)에, 반려·액티비티는 '기타'(etc)에 통합됨. */
export const MAP_VOUCHER_LABELS: MapVoucherLabel[] = [
  { key: 'all', labelKey: 'map.voucher.all', defaultLabel: '전체' },
  { key: 'meal_voucher', labelKey: 'map.voucher.meal', defaultLabel: '식사' },
  { key: 'beauty_voucher', labelKey: 'map.voucher.beauty', defaultLabel: '뷰티·헬스', shortLabel: '뷰티' },
  { key: 'stay_voucher', labelKey: 'map.voucher.stay', defaultLabel: '숙소' },
  { key: 'home_voucher', labelKey: 'map.voucher.home', defaultLabel: '생활' },
  { key: 'etc_voucher', labelKey: 'map.voucher.etc', defaultLabel: '기타' },
]
