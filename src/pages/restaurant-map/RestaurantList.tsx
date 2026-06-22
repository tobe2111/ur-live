import { MapPin } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { distanceKm } from './utils'
import type { Restaurant } from './types'

interface Props {
  loading: boolean
  filtered: Restaurant[]
  selected: Restaurant | null
  userLoc: { lat: number; lng: number } | null
  onSelect: (r: Restaurant) => void
  /** 🎯 선착순: id→{spots,appliedDisplay}. 있으면 배지 + '지원' 버튼. */
  fcfsMap?: Map<number, { spots: number; appliedDisplay: number }>
  onApplyFcfs?: (productId: number) => void
}

export default function RestaurantList({ loading, filtered, selected, userLoc, onSelect, fcfsMap, onApplyFcfs }: Props) {

  if (loading) {
    return (
      /* 🛡️ 2026-04-30 CLS: 단일 스피너 → 카드 skeleton 으로 교체. layout shift 0.
         🎨 2026-06-22 (대표 — 당근 리스트형): 카드 박스 제거 → full-bleed 행 + 구분선 skeleton. */
      <div className="divide-y divide-gray-100 dark:divide-[#1A1A1A]" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-4">
            <div className="w-[88px] h-[88px] rounded-lg bg-gray-100 dark:bg-[#1A1A1A] animate-pulse shrink-0" />
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
        <MapPin className="w-14 h-14 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
        <p className="text-gray-900 dark:text-white font-bold">맛집을 찾지 못했어요</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">다른 지역이나 검색어를 시도해보세요</p>
      </div>
    )
  }

  /* 🎨 2026-06-22 (대표 — "당근처럼 가로 줄을 다 쓰는 리스트형"): 플로팅 카드 → full-bleed 행.
     · 카드 박스(rounded/border/shadow/gap) 제거 → 항목 사이 hairline divider(divide-y)
     · 썸네일 72→88px, '구매' 버튼 제거 → 줄 전체 탭(onSelect). 리스트모드=상세이동 / 지도모드=포커스+SelectedFocusCard 구매CTA
     · 색상 B&W 통일(분홍→흑백, SelectedFocusCard 정합). 선착순 '지원'은 기능상 유지(탭=네비와 다른 액션). */
  return (
    <div className="divide-y divide-gray-100 dark:divide-[#1A1A1A]">
      {filtered.map(r => {
        const discount = r.original_price > r.price ? Math.round((1 - r.price / r.original_price) * 100) : 0
        const fcfs = fcfsMap?.get(r.id)
        const isSelected = selected?.id === r.id
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className={`w-full flex gap-3 py-4 text-left transition-colors ${
              isSelected
                ? 'bg-gray-50 dark:bg-[#121212]'
                : 'hover:bg-gray-50/60 dark:hover:bg-[#0E0E0E] active:bg-gray-100 dark:active:bg-[#161616]'
            }`}
          >
            {r.image_url ? (
              <img src={r.image_url} alt="" className="w-[88px] h-[88px] rounded-lg object-cover shrink-0" loading="lazy" />
            ) : (
              <div className="w-[88px] h-[88px] rounded-lg bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center shrink-0">
                <span className="text-2xl">🍽️</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-gray-900 dark:text-white text-[15px] truncate">{r.restaurant_name}</p>
                {discount > 0 && (
                  <span className="text-[10px] bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold px-1.5 py-0.5 rounded-md shrink-0">
                    -{discount}%
                  </span>
                )}
              </div>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1 truncate flex items-center gap-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {r.restaurant_address || '주소 미등록'}
                {userLoc && r.restaurant_lat && r.restaurant_lng && (
                  <span className="ml-1 font-semibold text-gray-600 dark:text-gray-300 shrink-0">
                    · {distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng).toFixed(1)}km
                  </span>
                )}
              </p>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{r.name}</p>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-[16px] font-extrabold text-gray-900 dark:text-white">{formatNumber(r.price)}원</span>
                {r.original_price > r.price && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{formatNumber(r.original_price)}원</span>
                )}
              </div>
              {fcfs && (
                <span className="inline-flex self-start items-center gap-1 mt-1.5 text-[10px] font-extrabold text-gray-900 dark:text-white bg-gray-900/10 dark:bg-white/15 px-2 py-0.5 rounded-full">
                  ⚡ 선착순 {formatNumber(fcfs.appliedDisplay)}/{formatNumber(fcfs.spots)}명
                </span>
              )}
            </div>
            {fcfs && onApplyFcfs && (
              <button
                onClick={(e) => { e.stopPropagation(); onApplyFcfs(r.id) }}
                className="self-center px-3.5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-transform"
              >
                지원
              </button>
            )}
          </button>
        )
      })}
    </div>
  )
}
