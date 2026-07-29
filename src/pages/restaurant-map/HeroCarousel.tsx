/**
 * 🛡️ 2026-05-02: TD-018 분할 — RestaurantMapPage 의 "오늘의 핫딜" 가로 캐러셀.
 *   할인율 TOP5 카드. 부모는 heroDeals 배열 + 위치/라이브 정보 + 클릭 핸들러를 props 로 전달.
 */
import { MapPin, Radio } from 'lucide-react'
import { cfImage } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { distanceKm, nearKmLabel } from './utils'
import { stripStorePrefix } from '@/utils/deal-title'
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
              className="shrink-0 w-[140px] rounded-2xl bg-white dark:bg-[#0F151D] border border-gray-100 dark:border-[#2A3446] overflow-hidden text-left active:scale-[0.97] transition-transform"
            >
              <div className="relative aspect-square bg-pink-50 dark:bg-pink-900/20">
                {r.image_url ? (
                  <img src={cfImage(r.image_url, { width: 280, quality: 85, format: 'auto' }) || r.image_url} alt="" loading="lazy" decoding="async"
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><span className="text-3xl">🍽️</span></div>
                )}
                {/* 🎨 2026-07-19 (대표 — 브랜드 컬러 통일): 할인 뱃지 순수 빨강 → 웜 로즈 brand 토큰. */}
                <span className="absolute top-1.5 left-1.5 bg-brand text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                  -{discount}%
                </span>
                {r.seller_id && liveSellerIds.has(r.seller_id) && (
                  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                    <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <div className="p-2">
                {/* 🎨 2026-07-02 (대표 — UI 우선순위): 이용권명(name)이 제목, 매장명은 보조 줄로. */}
                <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{stripStorePrefix(r.name, r.restaurant_name) || r.restaurant_name}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{r.restaurant_name}</span>
                  {userLoc && r.restaurant_lat && r.restaurant_lng && (() => {
                    const l = nearKmLabel(distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng))
                    return l && <span className="shrink-0">· {l}</span>
                  })()}
                </p>
                <p className="text-[12px] font-extrabold text-gray-900 dark:text-white mt-1">{formatNumber(r.price ?? 0)}원</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
