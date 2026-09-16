/**
 * 🗺️ 2026-06-23 (대표 — 카테고리 필터 4종 정리): 동네딜 지도 카테고리 칩의 **단일 소스(SSOT)**.
 *
 * 배경: 데이터/서버는 2026-05-17 에 카테고리를 6→4 로 통합(`VOUCHER_CATEGORIES` =
 *   meal/beauty/stay/etc)했는데, UI 칩(MapTopBar·SheetFilterBar)이 옛 6종(헬스/반려/액티비티)을
 *   그대로 노출 → 그 칩들은 서버가 미인식해 필터가 안 먹고 전체가 나오던 버그.
 *   여기 한 곳에서 칩/타입/빈문구를 정의해 4곳(MapTopBar/SheetFilterBar/RestaurantList/페이지)이
 *   공유 → UI↔데이터 드리프트 재발 방지.
 *
 * ⚠️ key 는 반드시 `@/shared/constants/voucher-categories` 의 VOUCHER_CATEGORIES + 'all' 과 일치.
 *
 * 🗺️ 2026-09-02 (대표 "B안으로 진행해줘"): `emoji` → `icon`. 칩 아이콘은 하단 탭과 같은
 *   유어딜 선 아이콘(24 그리드·1.6). 이모지는 색이 제각각이라 지도 위에서 지도색과 섞였고,
 *   표면 규칙 ⑥(이모지 0)에도 어긋났다.
 */
import { GridIcon, MealLineIcon, BeautyLineIcon, StayLineIcon, TicketStubIcon } from '@/components/icons/urdeal-icons'

/** 'all'(전체) + 실제 4종 카테고리. VOUCHER_CATEGORIES 와 1:1. */
export type MapVoucherType = 'all' | 'meal_voucher' | 'beauty_voucher' | 'stay_voucher' | 'etc_voucher'

export interface MapVoucherDef {
  key: MapVoucherType
  labelKey: string
  defaultLabel: string
  /** 유어딜 선 아이콘 컴포넌트(urdeal-icons). `<v.icon size={15} />` 로 그린다. */
  icon: typeof GridIcon
  /**
   * 🗺️ 2026-08-19 (대표 — "카카오맵처럼 한 줄 안에 모든 카테고리"): PC 좌측 400px 패널은
   *   7칸을 한 줄에 넣으므로 칸당 ~53px 다. '뷰티·헬스'(5자)는 그 폭에서 잘린다.
   *   ⇒ **좁은 자리 전용 짧은 라벨**. 없으면 `defaultLabel` 을 쓴다(대부분 이미 짧다).
   *   ⚠️ 카테고리 자체를 줄이는 게 아니다 — 넓은 지도 오버레이는 계속 긴 라벨을 쓴다.
   */
  shortLabel?: string
}

/** 칩 정의 — 헬스는 '뷰티·헬스'(beauty)에, 반려·액티비티는 '기타'(etc)에 통합됨. */
export const MAP_VOUCHER_DEFS: MapVoucherDef[] = [
  { key: 'all', labelKey: 'map.voucher.all', defaultLabel: '전체', icon: GridIcon },
  { key: 'meal_voucher', labelKey: 'map.voucher.meal', defaultLabel: '식사', icon: MealLineIcon },
  { key: 'beauty_voucher', labelKey: 'map.voucher.beauty', defaultLabel: '뷰티·헬스', icon: BeautyLineIcon, shortLabel: '뷰티' },
  { key: 'stay_voucher', labelKey: 'map.voucher.stay', defaultLabel: '숙소', icon: StayLineIcon },
  { key: 'etc_voucher', labelKey: 'map.voucher.etc', defaultLabel: '기타', icon: TicketStubIcon },
]

/** 카테고리별 빈 상태 문구. */
export const MAP_EMPTY_MSG: Record<MapVoucherType, string> = {
  all: '딜을 찾지 못했어요',
  meal_voucher: '맛집을 찾지 못했어요',
  beauty_voucher: '뷰티·헬스를 찾지 못했어요',
  stay_voucher: '숙소를 찾지 못했어요',
  etc_voucher: '해당 딜을 찾지 못했어요',
}
