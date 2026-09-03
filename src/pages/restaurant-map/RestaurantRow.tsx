/**
 * 🎫 이용권 목록 **행(row)** — 소비자 표면의 SSOT.
 *
 * 2026-09-03 (대표 — *"검색에 이용권 UI 가 원래 쓰는 것대로 안 나오네. 5줄짜리 말이야"*):
 * `/search` 가 **쇼핑용 2열 카드**(장바구니 ➕·무료배송 칩)를 쓰고 있었다. 결과는 이용권만 나오는데
 * 그리는 옷이 배송 상품 것이었다. 홈(지도 목록)이 이미 쓰던 이 행을 **같은 파일에서** 쓰게 해
 * 두 표면이 갈리지 않게 한다.
 *
 * ⚠️ 마크업은 홈에서 쓰던 것 **그대로**다(옮기기만 했다). 홈은 최고 트래픽 표면이라 시각 변화 0 이
 * 이 이동의 조건이었다. 검색은 `userLoc=null`(거리 없음) · `fcfs` 미전달 · `isSelected=false` 로
 * 넘기면 그만이라 **새 prop 이 하나도 필요 없다**.
 */
import { memo } from 'react'
import { MapPin } from 'lucide-react'
import CatIcon from './CatIcon'
import { formatNumber } from '@/utils/format'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { distanceKm, regionShort, stripStorePrefix } from './utils'
import FcfsBadge from '@/features/group-buy/FcfsBadge'
import type { Restaurant } from './types'

export const RestaurantRow = memo(function RestaurantRow({ r, isSelected, userLoc, onSelect, fcfs }: {
  r: Restaurant
  isSelected: boolean
  userLoc: { lat: number; lng: number } | null
  onSelect: (r: Restaurant) => void
  fcfs?: { spots: number; appliedDisplay: number }
}) {
  const discount = r.original_price > r.price ? Math.round((1 - r.price / r.original_price) * 100) : 0
  // 🗺️ 2026-07-19 (대표 — 거리 표시 로직): 10km 이상 원거리 딜은 "42km" 강조가 "동네딜" 컨셉과
  //   충돌 → 지역명("서울 중구") 우선, 거리는 흐린 보조 표기로 강등. 근거리(<10km)는 기존 강조 유지.
  const dist = userLoc && r.restaurant_lat && r.restaurant_lng
    ? distanceKm(userLoc.lat, userLoc.lng, r.restaurant_lat, r.restaurant_lng)
    : null
  const isFar = dist != null && dist >= 10
  return (
    <button
      onClick={() => onSelect(r)}
      className={`w-full flex gap-3 py-4 text-left transition-colors ${
        isSelected
          ? 'bg-gray-50 dark:bg-[#1D1F29]'
          : 'hover:bg-gray-50/60 dark:hover:bg-[#0E0E0E] active:bg-gray-100 dark:active:bg-[#161616]'
      }`}
    >
      {r.image_url ? (
        /* 🚑 2026-07-02 (대표 신고 "전체적으로 느림"): raw 원본(네이버 1MB급) → cfImage 리사이즈(88px@2x) */
        <img src={cfImage(r.image_url, { width: 176, quality: 85, format: 'auto' }) || r.image_url} alt="" className="w-[88px] h-[88px] rounded-lg object-cover shrink-0" loading="lazy" onError={(e) => cfImageOnError(e.currentTarget, r.image_url)} />
      ) : (
        <div className="w-[88px] h-[88px] rounded-lg bg-gray-100 dark:bg-[#1D1F29] flex items-center justify-center shrink-0">
          <CatIcon cat={r.category} className="w-7 h-7 text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {/* 🎨 2026-07-02 (대표 — UI 우선순위): 이용권명(r.name)을 볼드 제목으로, 매장명은 보조 줄로.
            🎨 2026-07-03 (대표 — "칙칙해"): 제목 옆 흐린 회색 추첨 배지 제거 → 가격 아래 소셜프루프
            라인(FcfsBadge)으로 전용 줄에 배치(긴 제목 안 찌그러뜨림).
            🏷️ 2026-07-19 (대표 — 제목 중복 제거): 제목의 "매장명 · " 프리픽스 제거 — 매장명은 아랫줄 한 곳에만. */}
        <p className="font-bold text-gray-900 dark:text-white text-[15px] truncate">{stripStorePrefix(r.name, r.restaurant_name)}</p>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{r.restaurant_name}</p>
        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5 truncate flex items-center gap-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          {isFar
            ? (regionShort(r.restaurant_address) || r.restaurant_address || '주소 미등록')
            : (r.restaurant_address || '주소 미등록')}
          {dist != null && (isFar ? (
            <span className="ml-1 shrink-0">· {Math.round(dist)}km</span>
          ) : (
            <span className="ml-1 font-semibold text-gray-600 dark:text-gray-300 shrink-0">
              · {dist.toFixed(1)}km
            </span>
          ))}
        </p>
        <div className="flex items-baseline gap-1.5 mt-1.5">
          {/* 🎨 2026-07-19 (대표 — 브랜드 컬러 통일): 순수 빨강 → 웜 로즈 brand 토큰(라이트/다크 var 보정). */}
          {discount > 0 && (
            <span className="text-[16px] font-extrabold text-brand-text">{discount}%</span>
          )}
          <span className="text-[16px] font-extrabold text-gray-900 dark:text-white">{formatNumber(r.price)}원</span>
          {r.original_price > r.price && (
            <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{formatNumber(r.original_price)}원</span>
          )}
        </div>
        {fcfs && <div className="mt-2"><FcfsBadge info={fcfs} /></div>}
      </div>
    </button>
  )
})

export default RestaurantRow
