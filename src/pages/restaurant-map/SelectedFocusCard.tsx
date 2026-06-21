import { MapPin, X, Navigation } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatNumber } from '@/utils/format'
import { distanceKm } from './utils'
import type { Restaurant } from './types'

/**
 * 🗺️ 2026-06-20 (대표 — "카드 선택 시 뭐 나오는게 좋을까"): 선택 시 리스트 대신 '선택된 1개'만 포커스.
 *   지도는 그 핀으로 이동(selectAndPan) + 시트엔 이 카드 1장(구매/길찾기/닫기). 리스트와 배타적(중복 0).
 */
export default function SelectedFocusCard({
  selected,
  userLoc,
  onClose,
}: {
  selected: Restaurant
  userLoc: { lat: number; lng: number } | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const discount = selected.original_price > selected.price
    ? Math.round((1 - selected.price / selected.original_price) * 100)
    : 0
  const dist = userLoc && selected.restaurant_lat && selected.restaurant_lng
    ? distanceKm(userLoc.lat, userLoc.lng, selected.restaurant_lat, selected.restaurant_lng)
    : null
  const kakaoTo = selected.restaurant_lat && selected.restaurant_lng
    ? `https://map.kakao.com/link/to/${encodeURIComponent(selected.restaurant_name || '매장')},${selected.restaurant_lat},${selected.restaurant_lng}`
    : null

  return (
    <div className="relative rounded-2xl border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-3.5 shadow-sm">
      <button
        onClick={onClose}
        aria-label="선택 해제"
        className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <button onClick={() => navigate(`/products/${selected.id}`)} className="w-full flex gap-3 text-left">
        {selected.image_url ? (
          <img src={selected.image_url} alt="" className="w-[84px] h-[84px] rounded-xl object-cover shrink-0" loading="eager" />
        ) : (
          <div className="w-[84px] h-[84px] rounded-xl bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center shrink-0"><span className="text-2xl">🍽️</span></div>
        )}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-gray-900 dark:text-white text-[15px] truncate">{selected.restaurant_name}</p>
            {discount > 0 && <span className="text-[10px] bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold px-1.5 py-0.5 rounded-md shrink-0">-{discount}%</span>}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-0.5 truncate">
            <MapPin className="w-3 h-3 shrink-0" />{selected.restaurant_address || '주소 미등록'}
            {dist != null && <span className="ml-1 font-semibold text-gray-600 dark:text-gray-300 shrink-0">· {dist.toFixed(1)}km</span>}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{selected.name}</p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-[17px] font-extrabold text-gray-900 dark:text-white">{formatNumber(selected.price)}원</span>
            {selected.original_price > selected.price && <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{formatNumber(selected.original_price)}원</span>}
          </div>
        </div>
      </button>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => navigate(`/products/${selected.id}`)}
          className="flex-1 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold active:scale-[0.98] transition-transform"
        >
          구매하기
        </button>
        {kakaoTo && (
          <a
            href={kakaoTo}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-200 text-[13px] font-bold active:scale-[0.98] transition-transform"
          >
            <Navigation className="w-3.5 h-3.5" />길찾기
          </a>
        )}
      </div>
    </div>
  )
}
