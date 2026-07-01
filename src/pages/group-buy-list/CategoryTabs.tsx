// 🧱 2026-06-29 TD: GroupBuyListPage god 파일 분해 — 카테고리 탭(verbatim 추출). 동작 불변.
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { SetURLSearchParams } from 'react-router-dom'
import type { CategoryFilter } from './types'

export default function CategoryTabs({ category, setCategory, navigate, searchParams, setSearchParams }: {
  category: CategoryFilter
  setCategory: Dispatch<SetStateAction<CategoryFilter>>
  navigate: (to: string) => void
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
}) {
  const { t } = useTranslation()
  return (
        <div className="ur-content-wide px-4 lg:px-8 mt-4 overflow-x-auto no-scrollbar">
          {/* 🛡️ 2026-05-17: 카테고리 4종 통합 + 온라인/오프라인 대분류 라벨 표시.
                탭 순서: [전체] [🏪 오프라인 4종] [🛍️ 온라인]
                health/pet/activity 는 마이그레이션 0255 가 자동 변환 — UI 에선 제거. */}
          <div className="flex gap-2 min-w-max">
            {([
              { key: 'all', label: t('groupBuy.categoryAll', { defaultValue: '전체' }) },
              { key: 'meal_voucher', label: t('groupBuy.categoryMealVoucher', { defaultValue: '🍽️ 이용권' }) },
              { key: 'beauty_voucher', label: t('groupBuy.categoryBeauty', { defaultValue: '💇 미용' }) },
              { key: 'stay_voucher', label: t('groupBuy.categoryStay', { defaultValue: '🏨 숙소' }) },
              { key: 'etc_voucher', label: t('groupBuy.categoryEtc', { defaultValue: '🎯 기타' }) },
              { key: 'general', label: t('groupBuy.categoryGeneral', { defaultValue: '🛍️ 온라인 (배송)' }) },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  // 🛡️ 숙소(stay_voucher)는 products.price=0 + 위치·객실이 product_stay_info 별도 테이블이라
                  //   그리드 카드로는 ₩0·정보누락으로 깨짐 → 전용 /stays(객실·날짜·가격 join) 페이지로.
                  if (tab.key === 'stay_voucher') { navigate('/stays'); return }
                  setCategory(tab.key)
                  // 🧭 2026-06-17: URL 도 동기화 — PC 사이드바/딥링크와 단일 소스(공유·뒤로가기 지원).
                  const next = new URLSearchParams(searchParams)
                  if (tab.key === 'all') next.delete('category'); else next.set('category', tab.key)
                  setSearchParams(next, { replace: true })
                }}
                className={`px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap border transition-colors ${
                  category === tab.key
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                    : 'bg-white dark:bg-transparent text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#2A2A2A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
  )
}
