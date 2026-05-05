import { Radio, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Restaurant } from './types'

interface Props {
  selected: Restaurant
  liveSellerIds: Set<number>
  onClose: () => void
}

export default function SelectedPeekCard({ selected, liveSellerIds, onClose }: Props) {
  const navigate = useNavigate()
  return (
    <div className="absolute left-3 right-3 z-30" style={{ bottom: 'calc(18vh + 80px)' }}>
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl shadow-xl border border-gray-100 dark:border-[#1A1A1A] p-3.5 relative">
        <button onClick={onClose} aria-label="닫기" className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#1A1A1A]">
          <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
        </button>
        <div className="flex gap-3 pr-6">
          {selected.image_url ? (
            <img src={selected.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" loading="lazy" decoding="async" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
              <span className="text-xl">🍽️</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
              <span className="truncate">{selected.restaurant_name}</span>
              {selected.seller_id && liveSellerIds.has(selected.seller_id) && (
                <span className="inline-flex items-center gap-0.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                </span>
              )}
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-extrabold text-gray-900 dark:text-white">{selected.price?.toLocaleString()}원</span>
              {selected.original_price > selected.price && (
                <span className="text-[10px] bg-red-500 text-white font-bold px-1 py-0.5 rounded">
                  -{Math.round((1 - selected.price / selected.original_price) * 100)}%
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(`/products/${selected.id}`)}
            className="self-center px-3 py-2 bg-pink-500 text-white text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-transform"
          >
            구매
          </button>
        </div>
      </div>
    </div>
  )
}
