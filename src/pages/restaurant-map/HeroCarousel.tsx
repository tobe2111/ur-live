/**
 * 🛡️ 2026-05-02: TD-018 분할 — RestaurantMapPage 의 "오늘의 핫딜" 가로 캐러셀.
 *   할인율 TOP5 카드. 부모는 heroDeals 배열 + 위치/라이브 정보 + 클릭 핸들러를 props 로 전달.
 */
import { MapPin, Radio } from 'lucide-react'
import { distanceKm } from './utils'
import type { Restaurant } from './types'

interface Props {
  heroDeals: Restaurant[]
  userLoc: { lat: number; lng: number } | null
  liveSellerIds: Set<number>
  onSelect: (r: Restaurant) => void
}

export default function HeroCarousel({ heroDeals, userLoc, liveSellerIds, onSelect }: Props) {
  if (heroDeals.length === 0) return null
  return (
    <div className="mb-3 -mx-3 px-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1">
          <span className="text-amber-500">⚡</span> 오늘의 핫딜
        </p>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{heroDeals.length}곳</span>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {heroDeals.map(r => {
          const discount = Math.round((1 - r.price / r.original_price) * 100)
          return (
            <button
              key={`hero-${r.id}`}
              onClick={() => onSelect(r)}
              className="shrink-0 w-[140px] rounded-2xl bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1A1A1A] overflow-hidden text-left active:scale-[0.97] transition-transform"
            >
              <div className="relative aspect-square bg-pink-50">
                {r.image_url ? (
                  <img src={r.image_url} alt="" loading="lazy" decoding="async"
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><span className="text-3xl">🍽️</span></div>
                )}
                <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                  -{discount}%
                </span>
                {r.seller_id && liveSellerIds.has(r.seller_id) && (
                  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                    <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{r.restaurant_name}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  {userLoc && r.restaurant_lat && r.restaurant_lng
                    ? `${distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng).toFixed(1)}km`
                    : (r.restaurant_address || '주소 미등록')}
                </p>
                <p className="text-[12px] font-extrabold text-gray-900 dark:text-white mt-1">{r.price?.toLocaleString()}원</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
