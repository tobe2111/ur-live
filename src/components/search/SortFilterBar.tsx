import { ChevronDown } from 'lucide-react'

interface SortFilterBarProps {
  totalResults: number
  sortBy: 'relevance' | 'price_low' | 'price_high' | 'newest'
  onSortChange: (value: 'relevance' | 'price_low' | 'price_high' | 'newest') => void
}

const sortLabels: Record<string, string> = {
  relevance: '관련도순',
  price_low: '낮은가격',
  price_high: '높은가격',
  newest: '최신순',
}

export default function SortFilterBar({ sortBy, onSortChange }: SortFilterBarProps) {
  return (
    <div className="flex items-center justify-end mb-4">
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
  )
}
