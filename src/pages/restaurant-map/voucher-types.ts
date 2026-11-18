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
import { GridIcon, MealLineIcon, BeautyLineIcon, StayLineIcon, HomeServiceLineIcon, TicketStubIcon } from '@/components/icons/urdeal-icons'

import { MAP_VOUCHER_LABELS, type MapVoucherType, type MapVoucherLabel } from './voucher-labels'
export type { MapVoucherType } from './voucher-labels'

export interface MapVoucherDef extends MapVoucherLabel {
  /** 유어딜 선 아이콘 컴포넌트(urdeal-icons). `<v.icon size={15} />` 로 그린다. */
  icon: typeof GridIcon
}

/** 아이콘 — 글자·순서는 `voucher-labels.ts`(워커와 같은 표). */
const ICON_BY_KEY: Record<MapVoucherType, typeof GridIcon> = {
  all: GridIcon,
  meal_voucher: MealLineIcon,
  beauty_voucher: BeautyLineIcon,
  stay_voucher: StayLineIcon,
  home_voucher: HomeServiceLineIcon,
  etc_voucher: TicketStubIcon,
}

export const MAP_VOUCHER_DEFS: MapVoucherDef[] = MAP_VOUCHER_LABELS.map((d) => ({ ...d, icon: ICON_BY_KEY[d.key] }))

/** 카테고리별 빈 상태 문구. */
export const MAP_EMPTY_MSG: Record<MapVoucherType, string> = {
  all: '딜을 찾지 못했어요',
  meal_voucher: '맛집을 찾지 못했어요',
  beauty_voucher: '뷰티·헬스를 찾지 못했어요',
  stay_voucher: '숙소를 찾지 못했어요',
  home_voucher: '이사·청소 업체를 찾지 못했어요',
  etc_voucher: '해당 딜을 찾지 못했어요',
}
