import CatIcon from './CatIcon'
import RestaurantRow from './RestaurantRow'
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
            <div className="w-[88px] h-[88px] rounded-lg bg-gray-100 dark:bg-[#1D1F29] animate-pulse shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
              <div className="h-3.5 w-2/3 rounded bg-gray-100 dark:bg-[#1D1F29] animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-gray-100 dark:bg-[#1D1F29] animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-[#1D1F29] animate-pulse mt-1" />
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
