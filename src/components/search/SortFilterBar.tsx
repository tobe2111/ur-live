/**
 * 🔎 2026-09-03 (대표 — 검색 QA): **아무것도 안 거르던 칩 5개를 제거**했다.
 *
 * `카테고리 · 3만원 이하 · 무료배송 · 브랜드 · 평점 4★↑` 는 눌리면 색만 바뀌고 "필터 2개 적용"
 * 이라고 **말까지 했지만**, 목록은 한 줄도 안 바뀌었다(로컬 state 토글이 전부 — 상위로 전달 자체가
 * 없었다). 작동하지 않는 컨트롤은 없느니만 못하다 — 사용자는 "필터가 고장났다"가 아니라
 * **"이 서비스엔 그 조건에 맞는 게 없다"** 고 읽는다.
 *
 * 게다가 절반은 여기 있을 수도 없는 것이었다: `/search` 는 **이용권만** 보여주는데
 * `무료배송`·`브랜드`·`3만원 이하` 는 배송 상품의 개념이다.
 *
 * 실제로 동작하는 정렬(관련도·가격·최신)은 그대로 둔다. 진짜 필터가 필요해지면 그때
 * **상위 상태로 올려서** 붙일 것 — 다시 로컬 토글로 만들지 말 것.
 */
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'

interface SortFilterBarProps {
  totalResults: number
  sortBy: 'relevance' | 'price_low' | 'price_high' | 'newest'
  onSortChange: (value: 'relevance' | 'price_low' | 'price_high' | 'newest') => void
}

export default function SortFilterBar({ totalResults, sortBy, onSortChange }: SortFilterBarProps) {
  const { t } = useTranslation()

  return (
    <div className="mb-4">
      {/* Result count + Sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[13px] text-gray-600 dark:text-gray-300">{t('browse.totalResultsPrefix', { defaultValue: '총' })}</span>
          {/* 🎨 2026-09-04: `text-red-500` → 잉크. 빨강은 이 레포에서 **기능 신호**(오류·위험)로 예약돼 있다 —
              검색 결과 개수는 그냥 숫자다. 강조는 굵기로 충분하다. */}
          <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">{totalResults}</span>
          <span className="text-[13px] text-gray-600 dark:text-gray-300">{t('browse.totalResultsSuffix', { defaultValue: '개' })}</span>
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
            className="appearance-none pr-6 pl-3 py-1.5 text-[12px] font-semibold text-gray-900 dark:text-white bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="relevance">{t('browse.sortRelevance', { defaultValue: '관련도순' })}</option>
            <option value="price_low">{t('browse.sortPriceLow', { defaultValue: '낮은가격' })}</option>
            <option value="price_high">{t('browse.sortPriceHigh', { defaultValue: '높은가격' })}</option>
            <option value="newest">{t('browse.sortNewest', { defaultValue: '최신순' })}</option>
          </select>
          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
        </div>
      </div>
    </div>
  )
}
