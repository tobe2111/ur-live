import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Search, X } from 'lucide-react'
import { storage } from '@/shared/utils/storage'

interface Props {
  search: string
  setSearch: (v: string) => void
  searchFocused: boolean
  setSearchFocused: (v: boolean) => void
  searchHistory: string[]
  setSearchHistory: (v: string[]) => void
  pushSearchHistory: (q: string) => void
}

/**
 * 상단 floating glass 검색바 + 최근 검색어 드롭다운.
 * 🛡️ TD-006 추출 (2026-05-06) — RestaurantMapPage 분할.
 */
export default function MapSearchHeader({
  search,
  setSearch,
  searchFocused,
  setSearchFocused,
  searchHistory,
  setSearchHistory,
  pushSearchHistory,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="absolute top-0 left-0 right-0 z-40 px-3 pt-3 pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => navigate(-1)}
          aria-label={t('map.search.back', { defaultValue: '뒤로가기' })}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-[#0A0A0A]/95 backdrop-blur-md shadow-md shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter') { pushSearchHistory(search); (e.target as HTMLInputElement).blur() } }}
            placeholder={t('restaurantMap.searchPlaceholder')}
            aria-label={t('map.search.ariaLabel', { defaultValue: '검색' })}
            className="w-full pl-10 pr-9 py-2.5 bg-white/95 backdrop-blur-md rounded-full text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-md"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="검색어 지우기" className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </button>
          )}
          {/* 🛡️ Phase 5: 검색 히스토리 dropdown — focus 시 + 입력값 비어있을 때만 */}
          {searchFocused && !search && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-xl border border-gray-100 dark:border-[#1A1A1A] overflow-hidden z-10">
              <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-[#1A1A1A]">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">{t('restaurantMap.recentSearch')}</span>
                <button
                  onClick={() => { setSearchHistory([]); storage.setJSON('restaurant_search_history', []) }}
                  className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300"
                >
                  {t('map.search.deleteAll', { defaultValue: '전체 삭제' })}
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {searchHistory.map((q) => (
                  <button
                    key={q}
                    onMouseDown={(e) => { e.preventDefault(); setSearch(q); pushSearchHistory(q) }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#1A1A1A] flex items-center gap-2"
                  >
                    <Search className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" />
                    <span className="truncate">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
