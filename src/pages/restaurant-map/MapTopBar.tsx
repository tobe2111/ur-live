import { useRef, useState, useEffect } from 'react'
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
 *   카테고리 칩(내 주변 + 전체/식사/뷰티/…) 가로 스크롤을 *상단*으로 올리고,
 *   검색은 작은 아이콘 버튼 → 탭 시 인라인 입력으로 확장(기존 검색/히스토리 재사용).
 *   정렬은 FilterSheet 로 위임(인라인 제거 — 시안에 상단 정렬 없음).
 *   기존 MapSearchHeader(full 검색바) + 시트 내 SheetFilterBar(칩) 를 대체.
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
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchFocused(false)
  }

  return (
    <div className="absolute top-0 left-0 right-0 z-40 px-3 pt-3 pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* 좌측: 홈이면 로고, 아니면 뒤로가기 */}
        {home ? (
          <Link
            to="/"
            aria-label={t('nav.home', { defaultValue: '홈' })}
            className="w-10 h-10 flex items-center justify-center shrink-0"
          >
            <span className="drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)] dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
              <UrDealLogo size={20} />
            </span>
          </Link>
        ) : (
          <button
            onClick={() => navigate(-1)}
            aria-label={t('map.search.back', { defaultValue: '뒤로가기' })}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md shadow-md shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
        )}

        {searchOpen ? (
          /* ── 검색 확장 입력 ── */
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') { pushSearchHistory(search); (e.target as HTMLInputElement).blur() } }}
              placeholder={t('restaurantMap.searchPlaceholder')}
              aria-label={t('map.search.ariaLabel', { defaultValue: '검색' })}
              className="w-full pl-10 pr-9 py-2.5 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md rounded-full text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-md"
            />
            <button
              onClick={() => { if (search) { setSearch('') } else { closeSearch() } }}
              aria-label={t('map.search.clearAria', { defaultValue: '검색어 지우기' })}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
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
        ) : (
          /* ── 칩 가로 스크롤 + 검색 아이콘 ── */
          <>
            <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar items-center">
              {/* 필터 */}
              <button
                onClick={onOpenFilter}
                aria-label={t('map.sheet.filterAria', { defaultValue: '지역·카테고리 필터 열기' })}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-md transition-all ${
                  activeFilterCount > 0
                    ? 'bg-pink-500 text-white'
                    : 'bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md text-gray-700 dark:text-gray-200'
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
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-md transition-all ${
                  nearMeMode
                    ? 'bg-pink-500 text-white'
                    : 'bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md text-pink-600 dark:text-pink-400'
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
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-semibold shrink-0 shadow-md transition-all ${
                    voucherType === v.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span>{v.emoji}</span>
                  <span>{t(v.labelKey, { defaultValue: v.defaultLabel })}</span>
                </button>
              ))}
            </div>
            {/* 검색 아이콘 버튼 */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label={t('map.search.ariaLabel', { defaultValue: '검색' })}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md shadow-md shrink-0 relative"
            >
              <Search className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              {search && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pink-500" />}
            </button>
            {/* 홈: 알림/장바구니 */}
            {home && (
              <>
                <button
                  onClick={() => navigate('/notifications')}
                  aria-label={t('mainHome.ariaNotifications', { defaultValue: '알림' })}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md shadow-md shrink-0"
                >
                  <Bell className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                </button>
                <button
                  onClick={() => navigate('/cart')}
                  aria-label={t('mainHome.ariaCart', { defaultValue: '장바구니' })}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md shadow-md shrink-0"
                >
                  <ShoppingCart className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
