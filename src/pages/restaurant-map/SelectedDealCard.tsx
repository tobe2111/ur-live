import { useRef } from 'react'
import { MapPin, X, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import { distanceKm, nearKmLabel } from './utils'
import { stripStorePrefix } from '@/utils/deal-title'
import type { Restaurant } from './types'

/**
 * 🗺️ 2026-06-22 (대표 시안 — 야놀자식): 선택 시 하단에 뜨는 **납작한 가로형 카드**.
 *   기존 320px 세로 시트(SelectedFocusCard) 대신 ~132px 카드 → 지도 영역 대폭 확대.
 *   좌우 스와이프(또는 ‹ › 버튼)로 인접 딜 이동 + 지도 recenter(부모 onPrev/onNext).
 *   카드 탭 → 상세, X → 선택 해제(리스트 복귀).
 */
export default function SelectedDealCard({
  selected,
  userLoc,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  position,
  total,
}: {
  selected: Restaurant
  userLoc: { lat: number; lng: number } | null
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  position: number
  total: number
}) {
  const navigate = useNavigate()
  const touchX = useRef<number | null>(null)
  // 🖥️ 2026-07-15 (대표 — "PC 좌우 스와이프 안 됨"): 마우스 드래그도 스와이프로. 드래그 발생 시
  //   뒤이어 발화되는 카드 click(상세 이동)을 삼킨다(draggedRef).
  const pointerX = useRef<number | null>(null)
  const draggedRef = useRef(false)

  const discount = selected.original_price > selected.price
    ? Math.round((1 - selected.price / selected.original_price) * 100)
    : 0
  const dist = userLoc && selected.restaurant_lat && selected.restaurant_lng
    ? distanceKm(userLoc.lat, userLoc.lng, selected.restaurant_lat, selected.restaurant_lng)
    : null
  const thumb = cfImage(selected.image_url, { width: 200, height: 200, fit: 'cover', format: 'auto' })

  const applySwipe = (dx: number) => {
    if (Math.abs(dx) < 50) return
    if (dx < 0 && hasNext) onNext()      // 왼쪽으로 스와이프 → 다음
    else if (dx > 0 && hasPrev) onPrev() // 오른쪽으로 스와이프 → 이전
  }
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    applySwipe(dx)
  }
  // 🖥️ 마우스 드래그(PC) — pointer 이벤트로 터치와 동일하게 좌우 스와이프.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return // 터치는 위 onTouch* 가 처리(중복 방지)
    pointerX.current = e.clientX
    draggedRef.current = false
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerX.current == null) return
    const dx = e.clientX - pointerX.current
    pointerX.current = null
    if (Math.abs(dx) >= 50) { draggedRef.current = true; applySwipe(dx) }
  }
  // 드래그 후 뒤이어 오는 카드 click(상세 이동)을 삼킨다.
  const onCardClick = () => {
    if (draggedRef.current) { draggedRef.current = false; return }
    navigate(`/products/${selected.id}`)
  }
  // ⌨️ 키보드 좌우 화살표(PC 접근성).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && hasPrev) { e.preventDefault(); onPrev() }
    else if (e.key === 'ArrowRight' && hasNext) { e.preventDefault(); onNext() }
  }

  return (
    <div
      className="absolute left-0 right-0 lg:left-[400px] z-30 px-3 pointer-events-none"
      style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <div
        className="ur-content-wide pointer-events-auto relative rounded-2xl border border-gray-100 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] shadow-[0_8px_28px_rgba(0,0,0,0.18)] select-none lg:cursor-grab lg:active:cursor-grabbing focus:outline-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label="선택한 딜 — 좌우 화살표로 이동"
      >
        {/* 좌우 이동 버튼 (스와이프 대체) */}
        {hasPrev && (
          <button
            onClick={onPrev}
            aria-label="이전 딜"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 dark:bg-[#1A2334]/90 shadow text-gray-700 dark:text-gray-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={onNext}
            aria-label="다음 딜"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 dark:bg-[#1A2334]/90 shadow text-gray-700 dark:text-gray-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onClose}
          aria-label="선택 해제"
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-gray-100/90 dark:bg-[#1A2334]/90 text-gray-500 dark:text-gray-400"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <button onClick={onCardClick} className="w-full flex gap-3 p-3 text-left">
          {thumb ? (
            <img src={thumb} alt="" className="w-[92px] h-[92px] rounded-xl object-cover shrink-0" loading="eager" />
          ) : (
            <div className="w-[92px] h-[92px] rounded-xl bg-gray-100 dark:bg-[#1A2334] flex items-center justify-center shrink-0"><span className="text-2xl">🍽️</span></div>
          )}
          <div className="flex-1 min-w-0 pr-6 py-0.5">
            {/* 🎨 2026-07-02 (대표 — UI 우선순위): 이용권명(name)이 제목, 매장명은 위치 줄로 강등. */}
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-gray-900 dark:text-white text-[15px] truncate">{stripStorePrefix(selected.name, selected.restaurant_name) || selected.restaurant_name}</p>
              {selected.rating > 0 && (
                <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-500 shrink-0">
                  <Star className="w-3 h-3" fill="currentColor" />{selected.rating.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {selected.name && selected.restaurant_name && (
                <span className="shrink-0 font-semibold text-gray-500 dark:text-gray-400">{selected.restaurant_name} ·</span>
              )}
              <span className="truncate">{selected.restaurant_address || '주소 미등록'}</span>
              {dist != null && nearKmLabel(dist) && <span className="ml-1 font-semibold text-gray-600 dark:text-gray-300 shrink-0">· {nearKmLabel(dist)}</span>}
            </p>
            <div className="flex items-baseline gap-1.5 mt-2">
              {discount > 0 && <span className="text-[13px] font-extrabold text-brand dark:text-[#EF6E85] shrink-0">{discount}%</span>}
              {selected.original_price > selected.price && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500 line-through">{formatNumber(selected.original_price)}원</span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">쿠폰가</span>
              <span className="text-[18px] font-extrabold text-gray-900 dark:text-white">{formatNumber(selected.price)}원~</span>
            </div>
          </div>
        </button>

        {/* 위치 인디케이터 (n / total) */}
        {total > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-white/80 dark:bg-[#0F151D]/80 px-1.5 rounded-full">
            {position} / {total}
          </div>
        )}
      </div>
    </div>
  )
}
