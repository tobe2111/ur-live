import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Search, X, Bell, ShoppingCart, Navigation, SlidersHorizontal } from 'lucide-react'
import { storage } from '@/shared/utils/storage'
import UrDealLogo from '@/components/brand/UrDealLogo'

type VoucherType = 'all' | 'meal_voucher' | 'beauty_voucher' | 'health_voucher' | 'pet_voucher' | 'stay_voucher' | 'activity_voucher'

interface Props {
  search: string
  setSearch: (v: string) => void
  searchFocused: boolean
  setSearchFocused: (v: boolean) => void
  searchHistory: string[]
  setSearchHistory: (v: string[]) => void
  pushSearchHistory: (q: string) => void
  voucherType: VoucherType
  setVoucherType: (v: VoucherType) => void
  nearMeMode: boolean
  requestNearMe: () => void
  activeFilterCount: number
  onOpenFilter: () => void
  home?: boolean
}

const VOUCHER_TYPE_DEFS: Array<{ key: VoucherType; labelKey: string; defaultLabel: string; emoji: string }> = [
  { key: 'all', labelKey: 'map.voucher.all', defaultLabel: '전체', emoji: '✨' },
  { key: 'meal_voucher', labelKey: 'map.voucher.meal', defaultLabel: '식사', emoji: '🍽️' },
  { key: 'beauty_voucher', labelKey: 'map.voucher.beauty', defaultLabel: '뷰티', emoji: '💇' },
  { key: 'health_voucher', labelKey: 'map.voucher.health', defaultLabel: '헬스', emoji: '💪' },
  { key: 'pet_voucher', labelKey: 'map.voucher.pet', defaultLabel: '반려', emoji: '🐶' },
  { key: 'stay_voucher', labelKey: 'map.voucher.stay', defaultLabel: '숙소', emoji: '🏨' },
  { key: 'activity_voucher', labelKey: 'map.voucher.activity', defaultLabel: '액티비티', emoji: '🎯' },
]

/**
 * 🗺️ 2026-06-22 (대표 시안 — 야놀자식): 지도 위 상단 플로팅 바.
 *   Row1 = 깔끔한 **흰 네모(둥근 사각) 검색 박스**(레퍼런스 룩) + (홈)알림/장바구니.
 *   Row2 = 카테고리 칩(내 주변 + 전체/식사/뷰티/…) 흰 알약 가로 스크롤 + 필터.
 *   기존 full MapSearchHeader + 시트 내 칩(SheetFilterBar)을 대체. 정렬은 FilterSheet 위임.
 */
export default function MapTopBar({
  search,
  setSearch,
  searchFocused,
  setSearchFocused,
  searchHistory,
  setSearchHistory,
  pushSearchHistory,
  voucherType,
  setVoucherType,
  nearMeMode,
  requestNearMe,
  activeFilterCount,
  onOpenFilter,
  home = false,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="absolute top-0 left-0 right-0 z-40 px-3 pt-3 pointer-events-none">
      <div className="ur-content-wide pointer-events-auto space-y-2">
        {/* ── Row 1: 흰 네모박스 검색바 ── */}
        <div className="flex items-center gap-2">
          {home ? (
            <Link
              to="/"
              aria-label={t('nav.home', { defaultValue: '홈' })}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] shadow-sm shrink-0"
            >
              <UrDealLogo size={20} />
            </Link>
          ) : (
            <button
              onClick={() => navigate(-1)}
              aria-label={t('map.search.back', { defaultValue: '뒤로가기' })}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] shadow-sm shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
          )}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') { pushSearchHistory(search); (e.target as HTMLInputElement).blur() } }}
              placeholder={t('restaurantMap.searchPlaceholder')}
              aria-label={t('map.search.ariaLabel', { defaultValue: '검색' })}
              className="w-full h-11 pl-11 pr-9 bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-200 dark:border-[#2A2A2A] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label={t('map.search.clearAria', { defaultValue: '검색어 지우기' })} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </button>
            )}
            {/* 최근 검색어 dropdown */}
            {searchFocused && !search && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-xl border border-gray-100 dark:border-[#1A1A1A] overflow-hidden z-10">
                <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A]">
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t('restaurantMap.recentSearch')}</span>
                  <button
                    onClick={() => { setSearchHistory([]); storage.setJSON('restaurant_search_history', []) }}
                    className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {t('map.search.deleteAll', { defaultValue: '전체 삭제' })}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {searchHistory.map((q) => (
                    <button
                      key={q}
                      onMouseDown={(e) => { e.preventDefault(); setSearch(q); pushSearchHistory(q) }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#121212] flex items-center gap-2"
                    >
                      <Search className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {home && (
            <>
              <button
                onClick={() => navigate('/notifications')}
                aria-label={t('mainHome.ariaNotifications', { defaultValue: '알림' })}
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] shadow-sm shrink-0"
              >
                <Bell className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              </button>
              <button
                onClick={() => navigate('/cart')}
                aria-label={t('mainHome.ariaCart', { defaultValue: '장바구니' })}
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] shadow-sm shrink-0"
              >
                <ShoppingCart className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              </button>
            </>
          )}
        </div>

        {/* ── Row 2: 카테고리 칩 (흰 알약) ── */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar items-center">
          {/* 필터 */}
          <button
            onClick={onOpenFilter}
            aria-label={t('map.sheet.filterAria', { defaultValue: '지역·카테고리 필터 열기' })}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-sm border transition-all ${
              activeFilterCount > 0
                ? 'bg-pink-500 text-white border-pink-500'
                : 'bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#2A2A2A]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[15px] h-3.5 px-1 rounded-full bg-white/25 text-[10px] font-bold">{activeFilterCount}</span>
            )}
          </button>
          {/* 내 주변 */}
          <button
            onClick={requestNearMe}
            aria-pressed={nearMeMode}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-sm border transition-all ${
              nearMeMode
                ? 'bg-pink-500 text-white border-pink-500'
                : 'bg-white dark:bg-[#0A0A0A] text-pink-600 dark:text-pink-400 border-gray-200 dark:border-[#2A2A2A]'
            }`}
          >
            <Navigation className="w-3 h-3" />
            <span>{t('restaurantMap.nearMe')}</span>
          </button>
          {/* 카테고리 칩 */}
          {VOUCHER_TYPE_DEFS.map(v => (
            <button
              key={v.key}
              onClick={() => setVoucherType(v.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-sm border transition-all ${
                voucherType === v.key
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                  : 'bg-white dark:bg-[#0A0A0A] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2A2A2A]'
              }`}
            >
              <span>{v.emoji}</span>
              <span>{t(v.labelKey, { defaultValue: v.defaultLabel })}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
