import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface FilterChip {
  id: string
  label: string
  active: boolean
}

interface SortFilterBarProps {
  totalResults: number
  sortBy: 'relevance' | 'price_low' | 'price_high' | 'newest'
  onSortChange: (value: 'relevance' | 'price_low' | 'price_high' | 'newest') => void
}

const defaultFilters: FilterChip[] = [
  { id: 'category', label: '카테고리', active: false },
  { id: 'price_30k', label: '3만원 이하', active: false },
  { id: 'free_ship', label: '무료배송', active: false },
  { id: 'brand', label: '브랜드', active: false },
  { id: 'rating', label: '평점 4★↑', active: false },
]

export default function SortFilterBar({ totalResults, sortBy, onSortChange }: SortFilterBarProps) {
  const [filters, setFilters] = useState<FilterChip[]>(defaultFilters)

  const toggleFilter = (id: string) => {
    setFilters(prev => prev.map(f =>
      f.id === id ? { ...f, active: !f.active } : f
    ))
  }

  const activeCount = filters.filter(f => f.active).length

  return (
    <div className="mb-4">
      {/* Filter chips - horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4">
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => toggleFilter(filter.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all border ${
              filter.active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            <span>{filter.label}</span>
            {filter.active && <X className="w-3.5 h-3.5" />}
          </button>
        ))}
      </div>

      {/* Result count + Sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[13px] text-gray-600">총</span>
          <span className="text-[13px] font-extrabold text-red-500">{totalResults}</span>
          <span className="text-[13px] text-gray-600">개</span>
          {activeCount > 0 && (
            <span className="ml-1.5 text-[11px] text-gray-400">필터 {activeCount}개 적용</span>
          )}
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
            className="appearance-none pr-6 pl-3 py-1.5 text-[12px] font-semibold text-gray-900 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="relevance">관련도순</option>
            <option value="price_low">낮은가격</option>
            <option value="price_high">높은가격</option>
            <option value="newest">최신순</option>
          </select>
          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>
    </div>
  )
}
