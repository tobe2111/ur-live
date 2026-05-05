import { MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatNumber } from '@/utils/format'
import { distanceKm } from './utils'
import type { Restaurant } from './types'

interface Props {
  loading: boolean
  filtered: Restaurant[]
  selected: Restaurant | null
  userLoc: { lat: number; lng: number } | null
  onSelect: (r: Restaurant) => void
}

export default function RestaurantList({ loading, filtered, selected, userLoc, onSelect }: Props) {
  const navigate = useNavigate()

  if (loading) {
    return (
      /* 🛡️ 2026-04-30 CLS: 단일 스피너 → 카드 skeleton 으로 교체.
         실제 결과 카드와 같은 높이 (90px) 를 유지해 layout shift 0 */
      <div className="space-y-3 pb-8" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1A1A1A]">
            <div className="w-[72px] h-[72px] rounded-xl bg-gray-100 dark:bg-[#1A1A1A] animate-pulse shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
              <div className="h-3.5 w-2/3 rounded bg-gray-100 dark:bg-[#1A1A1A] animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-gray-100 dark:bg-[#1A1A1A] animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-[#1A1A1A] animate-pulse mt-1" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16">
        <MapPin className="w-14 h-14 text-gray-200 mx-auto mb-4" />
        <p className="text-gray-900 dark:text-white font-bold">맛집을 찾지 못했어요</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">다른 지역이나 검색어를 시도해보세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-8">
      {filtered.map(r => {
        const discount = r.original_price > r.price ? Math.round((1 - r.price / r.original_price) * 100) : 0
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className={`w-full flex gap-3 p-3.5 rounded-2xl text-left transition-all ${
              selected?.id === r.id
                ? 'bg-pink-50 border-2 border-pink-300 shadow-sm'
                : 'bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1A1A1A] hover:shadow-md'
            }`}
          >
            {r.image_url ? (
              <img src={r.image_url} alt="" className="w-[72px] h-[72px] rounded-xl object-cover shrink-0" loading="lazy" />
            ) : (
              <div className="w-[72px] h-[72px] rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
                <span className="text-2xl">🍽️</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{r.restaurant_name}</p>
                {discount > 0 && (
                  <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    -{discount}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate flex items-center gap-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {r.restaurant_address || '주소 미등록'}
                {userLoc && r.restaurant_lat && r.restaurant_lng && (
                  <span className="ml-1 font-semibold text-pink-500 shrink-0">
                    · {distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng).toFixed(1)}km
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{r.name}</p>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-base font-extrabold text-gray-900 dark:text-white">{r.price?.toLocaleString()}원</span>
                {r.original_price > r.price && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{formatNumber(r.original_price)}원</span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/products/${r.id}`) }}
              className="self-center px-3.5 py-2 bg-pink-500 text-white text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-transform"
            >
              구매
            </button>
          </button>
        )
      })}
    </div>
  )
}
