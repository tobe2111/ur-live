// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 텍스트 검색 input(verbatim 추출). 동작 불변.
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

export default function SearchBar({ searchQuery, setSearchQuery }: {
  searchQuery: string
  setSearchQuery: Dispatch<SetStateAction<string>>
}) {
  const { t } = useTranslation()
  return (
      <div className="ur-content-wide px-4 lg:px-8 mt-3">
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('groupBuy.searchPlaceholder', { defaultValue: '공구명/매장명 검색' })}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-[#2A2A2A] rounded-full text-sm bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-white/30"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
  )
}
