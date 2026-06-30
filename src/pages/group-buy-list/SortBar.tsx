// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 총개수 + 정렬 드롭다운 바(verbatim 추출). 동작 불변.
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { SORT_LABELS } from './constants'
import type { SortOption, MainTab } from './types'

export default function SortBar({ mainTab, currentCount, sortBy, setSortBy, showSortDropdown, setShowSortDropdown }: {
  mainTab: MainTab
  currentCount: number
  sortBy: SortOption
  setSortBy: Dispatch<SetStateAction<SortOption>>
  showSortDropdown: boolean
  setShowSortDropdown: Dispatch<SetStateAction<boolean>>
}) {
  const { t } = useTranslation()
  return (
      <div className={`ur-content-wide px-4 lg:px-8 ${mainTab === 'seller' ? 'mt-3' : 'mt-4'} flex items-center justify-between`}>
        <span className="text-[12px] text-gray-500 dark:text-gray-400">
          {t('groupBuy.totalCount', { defaultValue: '총 {{count}}개', count: currentCount })}
        </span>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowSortDropdown((v) => !v)}
            className="flex items-center gap-1 text-[13px] text-gray-700 dark:text-gray-300 font-semibold"
            aria-label={t('groupBuy.sortAria', { defaultValue: '정렬 기준 선택' })}
            aria-haspopup="menu"
            aria-expanded={showSortDropdown}
          >
            {SORT_LABELS[sortBy]}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                showSortDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>
          {showSortDropdown && (
            <div role="menu" className="absolute top-full right-0 mt-1 w-36 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#2A2A2A] rounded-xl shadow-lg z-30 overflow-hidden">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  role="menuitemradio"
                  aria-checked={sortBy === opt}
                  onClick={() => {
                    setSortBy(opt)
                    setShowSortDropdown(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 text-[13px] ${
                    sortBy === opt
                      ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#121212]'
                  }`}
                >
                  {SORT_LABELS[opt]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
  )
}
