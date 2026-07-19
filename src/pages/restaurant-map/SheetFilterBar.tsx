import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigation, ArrowUpDown, Heart, SlidersHorizontal, ChevronDown } from 'lucide-react'
import type { SortBy } from './types'
import { type MapVoucherType, MAP_VOUCHER_DEFS } from './voucher-types'
import SortSheet from './SortSheet'

const SORT_LABEL: Record<SortBy, { labelKey: string; def: string }> = {
  distance: { labelKey: 'restaurantMap.sort.distance', def: '가까운 순' },
  discount: { labelKey: 'restaurantMap.sort.discount', def: '할인율 순' },
  price: { labelKey: 'restaurantMap.sort.price', def: '낮은 가격 순' },
  rating: { labelKey: 'restaurantMap.sort.rating', def: '평점 순' },
}

interface Props {
  activeFilterCount: number
  onOpenFilter: () => void
  nearMeMode: boolean
  requestNearMe: () => void
  voucherType: MapVoucherType
  setVoucherType: (v: MapVoucherType) => void
  filteredCount: number
  /** 🗺️ 2026-07-15: 지도 뷰포트에 보이는 딜 수(있으면 "이 지역 N · 전체 M" 표기). 미지정=전체만. */
  viewportCount?: number | null
  userLoc: { lat: number; lng: number } | null
  sortBy: SortBy
  setSortBy: (v: SortBy) => void
  favorites: number[]
  showFavoritesOnly: boolean
  setShowFavoritesOnly: (fn: (v: boolean) => boolean) => void
  // 🗺️ 2026-06-22 (대표 시안): 칩을 상단(MapTopBar)으로 올린 지도 모드에선 칩 줄 숨기고 count/정렬만.
  hideChips?: boolean
}

/**
 * 바텀 시트 상단 sticky 필터 행 + 결과 카운트 + 정렬 select.
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function SheetFilterBar({
  activeFilterCount,
  onOpenFilter,
  nearMeMode,
  requestNearMe,
  voucherType,
  setVoucherType,
  filteredCount,
  viewportCount = null,
  userLoc,
  sortBy,
  setSortBy,
  favorites,
  showFavoritesOnly,
  setShowFavoritesOnly,
  hideChips = false,
}: Props) {
  const { t } = useTranslation()
  const [sortOpen, setSortOpen] = useState(false)
  // "이 지역 N · 전체 M" — 뷰포트 수가 전체보다 적을 때만 이중 표기(지도가 특정 영역을 보고 있을 때).
  const showViewport = viewportCount != null && viewportCount < filteredCount

  return (
    <div className="px-3 pb-2 border-b border-gray-100 dark:border-[#2A3446] shrink-0">
      {!hideChips && (
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenFilter}
          aria-label={t('map.sheet.filterAria', { defaultValue: '지역·카테고리 필터 열기' })}
          className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold shrink-0 transition-all ${
            activeFilterCount > 0
              ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
              : 'bg-white dark:bg-[#0F151D] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2A3446]'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white dark:bg-[#0F151D]/25 text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar">
          {/* 🛡️ Phase 5: '내 주변' 퀵필터 — GPS prompt + 거리순 자동 */}
          <button
            onClick={requestNearMe}
            aria-pressed={nearMeMode}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold shrink-0 transition-all border ${
              nearMeMode
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40'
            }`}
          >
            <Navigation className="w-3 h-3" />
            <span>{t('restaurantMap.nearMe')}</span>
          </button>
          {MAP_VOUCHER_DEFS.map(v => (
            <button
              key={v.key}
              onClick={() => setVoucherType(v.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold shrink-0 transition-all ${
                voucherType === v.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 dark:bg-[#1A2334] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#2A3446]'
              }`}
            >
              <span>{v.emoji}</span>
              <span>{t(v.labelKey, { defaultValue: v.defaultLabel })}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">
            {showViewport ? (
              <>
                <span className="font-bold text-gray-900 dark:text-white">{t('map.sheet.thisArea', { defaultValue: '이 지역' })} {viewportCount}</span>{t('map.sheet.count', { defaultValue: '곳' })}
                <span className="ml-1 text-gray-400 dark:text-gray-500">· {t('map.sheet.total', { defaultValue: '전체' })} {filteredCount}{t('map.sheet.count', { defaultValue: '곳' })}</span>
              </>
            ) : (
              <><span className="font-bold text-gray-900 dark:text-white">{filteredCount}</span>{t('map.sheet.count', { defaultValue: '곳' })}</>
            )}
            {userLoc && sortBy === 'distance' && <span className="ml-1 text-pink-500">{t('map.sheet.nearMeLabel', { defaultValue: '📍 내 위치 기준' })}</span>}
          </span>
          {favorites.length > 0 && (
            <button
              onClick={() => setShowFavoritesOnly(v => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                showFavoritesOnly
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-white dark:bg-[#0F151D] text-pink-500 border-pink-200'
              }`}
            >
              <Heart className="w-2.5 h-2.5" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
              {favorites.length}
            </button>
          )}
        </div>
        {/* 🗺️ 2026-07-15 (대표 — "우리 서비스 팝업으로"): OS 네이티브 select → 인앱 바텀시트(SortSheet). */}
        <button
          onClick={() => setSortOpen(true)}
          aria-label={t('map.sheet.sortAria', { defaultValue: '정렬' })}
          className="flex items-center gap-1 text-[12px] font-semibold text-gray-700 dark:text-gray-200 px-2 py-1 rounded-lg active:bg-gray-100 dark:active:bg-[#1A2334]"
        >
          <ArrowUpDown className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          <span>{t(SORT_LABEL[sortBy].labelKey, { defaultValue: SORT_LABEL[sortBy].def })}</span>
          <ChevronDown className="w-3 h-3 text-gray-400 dark:text-gray-500" />
        </button>
      </div>
      {sortOpen && (
        <SortSheet sortBy={sortBy} setSortBy={setSortBy} hasUserLoc={!!userLoc} onClose={() => setSortOpen(false)} />
      )}
    </div>
  )
}
