import { memo, useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { distanceKm, regionShort, stripStorePrefix } from './utils'
import FcfsBadge from '@/features/group-buy/FcfsBadge'
import type { Restaurant } from './types'
import { type MapVoucherType, MAP_EMPTY_MSG } from './voucher-types'

interface Props {
  loading: boolean
  filtered: Restaurant[]
  selected: Restaurant | null
  userLoc: { lat: number; lng: number } | null
  onSelect: (r: Restaurant) => void
  /** 🎯 선착순: id→{spots,appliedDisplay}. 있으면 추첨 배지 표시(응모는 카드 탭 → 상세). */
  fcfsMap?: Map<number, { spots: number; appliedDisplay: number }>
  /** @deprecated 2026-07-03 카드 내 응모 버튼 제거 — 상세에서 응모. 호출부 호환 위해 유지(미사용). */
  onApplyFcfs?: (productId: number) => void
  /** 빈 상태 문구를 카테고리에 맞게 표시 (기본 all). */
  voucherType?: MapVoucherType
}

export default function RestaurantList({ loading, filtered, selected, userLoc, onSelect, fcfsMap, voucherType = 'all' }: Props) {

  if (loading) {
    return (
      /* 🛡️ 2026-04-30 CLS: 단일 스피너 → 카드 skeleton 으로 교체. layout shift 0.
         🎨 2026-06-22 (대표 — 당근 리스트형): 카드 박스 제거 → full-bleed 행 + 구분선 skeleton. */
      <div className="divide-y divide-gray-100 dark:divide-[#2C2F35]" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-4">
            <div className="w-[88px] h-[88px] rounded-lg bg-gray-100 dark:bg-[#1A1C21] animate-pulse shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
              <div className="h-3.5 w-2/3 rounded bg-gray-100 dark:bg-[#1A1C21] animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-gray-100 dark:bg-[#1A1C21] animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-[#1A1C21] animate-pulse mt-1" />
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
        <p className="text-gray-900 dark:text-white font-bold">{MAP_EMPTY_MSG[voucherType] || MAP_EMPTY_MSG.all}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">다른 지역이나 검색어를 시도해보세요</p>
      </div>
    )
  }

  /* 🎨 2026-06-22 (대표 — "당근처럼 가로 줄을 다 쓰는 리스트형"): 플로팅 카드 → full-bleed 행.
     · 카드 박스(rounded/border/shadow/gap) 제거 → 항목 사이 hairline divider(divide-y)
     · 썸네일 72→88px, '구매' 버튼 제거 → 줄 전체 탭(onSelect). 리스트모드=상세이동 / 지도모드=포커스+SelectedFocusCard 구매CTA
     · 색상 B&W 통일(분홍→흑백, SelectedFocusCard 정합). 선착순 '지원'은 기능상 유지(탭=네비와 다른 액션). */
  return (
    <IncrementalRows filtered={filtered} selected={selected} userLoc={userLoc} onSelect={onSelect} fcfsMap={fcfsMap} voucherType={voucherType} />
  )
}

const PAGE = 40

/** ⚡ 2026-07-12 (대표 "더 개선" — 리스트 렉): 전량 DOM 렌더(최대 500행×이미지) → 40행씩 점진 렌더.
 *  홈(`/`)이 리스트 모드라 지도 컬링만으론 부족했던 남은 렉 원인. 센티넬 도달 시 +40(무한 스크롤). */
function IncrementalRows({ filtered, selected, userLoc, onSelect, fcfsMap, voucherType }: {
  filtered: Restaurant[]
  selected: Restaurant | null
  userLoc: { lat: number; lng: number } | null
  onSelect: (r: Restaurant) => void
  fcfsMap?: Map<number, { spots: number; appliedDisplay: number }>
  voucherType: MapVoucherType
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE)
  useEffect(() => { setVisibleCount(PAGE) }, [voucherType])  // 카테고리 전환 시 처음부터
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const hasMore = filtered.length > visibleCount
  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => {
      if (es[0]?.isIntersecting) setVisibleCount(v => v + PAGE)
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, visibleCount])

  return (
    <div className="divide-y divide-gray-100 dark:divide-[#2C2F35]">
      {filtered.slice(0, visibleCount).map(r => (
        <RestaurantRow key={r.id} r={r} isSelected={selected?.id === r.id} userLoc={userLoc} onSelect={onSelect} fcfs={fcfsMap?.get(r.id)} />
      ))}
      {hasMore && <div ref={sentinelRef} className="h-10" aria-hidden />}
    </div>
  )
}

/** ⚡ 행 memo — 부모 재렌더(선택/필터/추첨맵 변경) 시 무관한 행 재조정 차단(GroupBuyFeedCard 패턴). */
const RestaurantRow = memo(function RestaurantRow({ r, isSelected, userLoc, onSelect, fcfs }: {
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
          ? 'bg-gray-50 dark:bg-[#1A1C21]'
          : 'hover:bg-gray-50/60 dark:hover:bg-[#0E0E0E] active:bg-gray-100 dark:active:bg-[#161616]'
      }`}
    >
      {r.image_url ? (
        /* 🚑 2026-07-02 (대표 신고 "전체적으로 느림"): raw 원본(네이버 1MB급) → cfImage 리사이즈(88px@2x) */
        <img src={cfImage(r.image_url, { width: 176, quality: 85, format: 'auto' }) || r.image_url} alt="" className="w-[88px] h-[88px] rounded-lg object-cover shrink-0" loading="lazy" onError={(e) => cfImageOnError(e.currentTarget, r.image_url)} />
      ) : (
        <div className="w-[88px] h-[88px] rounded-lg bg-gray-100 dark:bg-[#1A1C21] flex items-center justify-center shrink-0">
          <span className="text-2xl">🍽️</span>
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
