interface SortFilterBarProps {
  totalResults: number
  sortBy: 'relevance' | 'price_low' | 'price_high' | 'newest'
  onSortChange: (value: 'relevance' | 'price_low' | 'price_high' | 'newest') => void
}

export default function SortFilterBar({ totalResults, sortBy, onSortChange }: SortFilterBarProps) {
  return (
    <div className="mb-4 pb-4 border-b border-[#e5e5ea]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[15px] text-[#6e6e73]">
          총 <span className="font-semibold text-[#1d1d1f]">{totalResults}</span>개 상품
        </p>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as any)}
          className="px-3 py-2 text-[13px] border border-[#e5e5ea] rounded-lg bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
        >
          <option value="relevance">관련도순</option>
          <option value="price_low">낮은 가격순</option>
          <option value="price_high">높은 가격순</option>
          <option value="newest">최신순</option>
        </select>
      </div>
    </div>
  )
}
