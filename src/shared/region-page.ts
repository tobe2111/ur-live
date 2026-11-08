/**
 * 🗺️ 지역 착지(`/region/:sido[/:sigungu]`) 머리의 **모양 SSOT** — 화면(`pages/region/RegionPage.tsx`)과 워커 첫 화면
 * (`worker/utils/region-first-screen.ts`)이 같은 칩·문구·클래스·숫자 계산을 쓴다(2026-11-08 대표 *"계속 최적화"*).
 * 두 벌이면 마운트 때 첫 화면이 튄다. React·아이콘을 import 하지 않는다(워커 번들).
 */
import type { RegionRef, SidoStat } from './constants/region-slugs'

export const REGION_CATEGORY_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'meal_voucher', label: '식사' },
  { key: 'beauty_voucher', label: '뷰티' },
  { key: 'stay_voucher', label: '숙소' },
  { key: 'home_voucher', label: '생활' },
  { key: 'etc_voucher', label: '기타' },
] as const
export type RegionCategoryKey = typeof REGION_CATEGORY_CHIPS[number]['key']

/** 이 지역의 진행 중 딜 수 — 통계가 아직 없으면 0(화면과 같은 계산). */
export function regionDealCount(regions: readonly SidoStat[], ref: RegionRef): number {
  const s = regions.find(r => r.sido === ref.sido)
  return ref.sigungu ? (s?.sigungu.find(g => g.sigungu === ref.sigungu)?.count ?? 0) : (s?.count ?? 0)
}

export const REGION_COPY = {
  subSuffix: ' · 온라인 결제 후 매장에서 바로 사용',
  empty: '아직 이 지역에 진행 중인 딜이 없어요. 다른 지역을 둘러보세요.',
  map: '지도에서 보기',
} as const

export const REGION_CLS = {
  page: 'bg-white dark:bg-[#11141C] min-h-[100dvh]',
  wrap: 'max-w-[1600px] mx-auto px-5 lg:px-10 pt-4 lg:pt-6',
  crumbs: 'flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 mb-3 flex-wrap',
  crumb: 'inline-flex items-center gap-1',
  crumbLast: 'font-bold text-gray-900 dark:text-white',
  crumbLink: 'hover:underline',
  header: 'mb-5',
  h1: 'text-[24px] lg:text-[28px] font-bold tracking-tight text-gray-900 dark:text-white',
  sub: 'mt-2 text-[13px] lg:text-[15px] text-gray-500 dark:text-gray-400',
  subNum: 'text-gray-900 dark:text-white',
  chips: 'flex items-center gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide',
  chipBase: 'shrink-0 px-4 py-2 rounded-full text-[13px] font-medium border transition-colors',
  chipOn: 'bg-brand text-white border-brand',
  chipOff: 'bg-white dark:bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2C2F35] hover:bg-gray-50 dark:hover:bg-white/[0.04]',
  mapLink: 'shrink-0 ml-auto inline-flex items-center gap-1 px-4 py-2 rounded-full text-[13px] font-medium border border-line text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors',
} as const
