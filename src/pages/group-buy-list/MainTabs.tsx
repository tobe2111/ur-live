// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 메인 탭 스위처(verbatim 추출). 동작 불변.
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { MainTab, CategoryFilter, SortOption } from './types'

export default function MainTabs({ mainTab, setMainTab, setCategory, setSortBy }: {
  mainTab: MainTab
  setMainTab: Dispatch<SetStateAction<MainTab>>
  setCategory: Dispatch<SetStateAction<CategoryFilter>>
  setSortBy: Dispatch<SetStateAction<SortOption>>
}) {
  const { t } = useTranslation()
  return (
      <div className="ur-content-wide px-4 lg:px-8 mt-4">
        <div className="flex border-b border-gray-200 dark:border-[#1A1A1A]">
          <button
            onClick={() => { setMainTab('seller'); setCategory('all'); setSortBy('popular') }}
            className={`flex-1 pb-2.5 text-[14px] font-semibold text-center transition-colors border-b-2 ${
              mainTab === 'seller'
                ? 'text-gray-900 dark:text-white border-gray-900 dark:border-white'
                : 'text-gray-400 dark:text-gray-600 border-transparent'
            }`}
          >
            {t('groupBuy.tabSeller', { defaultValue: '동네 공구' })}
          </button>
          <button
            onClick={() => { setMainTab('community'); setCategory('all'); setSortBy('popular') }}
            className={`flex-1 pb-2.5 text-[14px] font-semibold text-center transition-colors border-b-2 ${
              mainTab === 'community'
                ? 'text-gray-900 dark:text-white border-gray-900 dark:border-white'
                : 'text-gray-400 dark:text-gray-600 border-transparent'
            }`}
          >
            {t('groupBuy.tabCommunity', { defaultValue: '같이 모으기' })}
          </button>
        </div>
      </div>
  )
}
