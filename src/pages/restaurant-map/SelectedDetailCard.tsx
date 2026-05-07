import { Heart, MapPin, Navigation, Phone, Radio, Ticket, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'
import { distanceKm, kakaoDirectionsUrl } from './utils'
import type { Restaurant } from './types'

interface Props {
  selected: Restaurant
  userLoc: { lat: number; lng: number } | null
  liveSellerIds: Set<number>
  favorites: number[]
  onClose: () => void
  onToggleFavorite: (id: number) => void
}

export default function SelectedDetailCard({ selected, userLoc, liveSellerIds, favorites, onClose, onToggleFavorite }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div className="bg-pink-50 dark:bg-pink-900/20 border-2 border-pink-300 dark:border-pink-700 rounded-2xl p-4 mb-3 relative">
      <button onClick={onClose} aria-label={t('map.detail.deselect', { defaultValue: '선택 해제' })} className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-[#0A0A0A]/80">
        <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
      </button>
      <div className="flex gap-3 pr-6">
        {selected.image_url ? (
          <img src={selected.image_url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" loading="lazy" decoding="async" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-white dark:bg-[#0A0A0A] flex items-center justify-center shrink-0">
            <span className="text-2xl">🍽️</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 dark:text-white text-[15px] flex items-center gap-1.5">
            <span className="truncate">{selected.restaurant_name}</span>
            {selected.seller_id && liveSellerIds.has(selected.seller_id) && (
              <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {selected.restaurant_address}
            {userLoc && selected.restaurant_lat && selected.restaurant_lng && (
              <span className="ml-1 font-semibold text-pink-500">
                · {distanceKm(userLoc.lat, userLoc.lng, selected.restaurant_lat, selected.restaurant_lng).toFixed(1)}km
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg font-extrabold text-gray-900 dark:text-white">{selected.price?.toLocaleString()}원</span>
            {selected.original_price > selected.price && (
              <>
                <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{formatNumber(selected.original_price)}원</span>
                <span className="text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md">
                  -{Math.round((1 - selected.price / selected.original_price) * 100)}%
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onToggleFavorite(selected.id)}
          aria-label={favorites.includes(selected.id) ? t('map.detail.unfavorite', { defaultValue: '즐겨찾기 해제' }) : t('map.detail.favorite', { defaultValue: '즐겨찾기' })}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            favorites.includes(selected.id) ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-500' : 'bg-white dark:bg-[#0A0A0A] text-gray-400 dark:text-gray-500'
          }`}
        >
          <Heart className="w-4 h-4" fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} />
        </button>
        {selected.restaurant_phone && (
          <a href={`tel:${selected.restaurant_phone}`} aria-label={t('map.detail.call', { defaultValue: '전화' })} className="flex items-center justify-center w-10 h-10 bg-white dark:bg-[#0A0A0A] rounded-xl text-gray-700 dark:text-gray-200">
            <Phone className="w-4 h-4" />
          </a>
        )}
        {selected.restaurant_lat && selected.restaurant_lng && (
          <a
            href={kakaoDirectionsUrl(selected)}
            target="_blank" rel="noopener noreferrer"
            aria-label={t('map.detail.directionsAria', { defaultValue: '카카오맵 길찾기' })}
            className="flex items-center justify-center gap-1 px-3 h-10 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold"
          >
            <Navigation className="w-3.5 h-3.5" /> {t('map.detail.directions', { defaultValue: '길찾기' })}
          </a>
        )}
        <button
          onClick={() => navigate(`/products/${selected.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 bg-pink-500 text-white rounded-xl text-sm font-bold active:scale-[0.97] transition-transform"
        >
          <Ticket className="w-4 h-4" /> {t('map.detail.buyVoucher', { defaultValue: '바우처 구매' })}
        </button>
      </div>
    </div>
  )
}
