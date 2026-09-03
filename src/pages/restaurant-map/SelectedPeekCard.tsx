import CatIcon from './CatIcon'
import { Radio, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import type { Restaurant } from './types'

interface Props {
  selected: Restaurant
  liveSellerIds: Set<number>
  onClose: () => void
}

export default function SelectedPeekCard({ selected, liveSellerIds, onClose }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div className="absolute left-3 right-3 z-30" style={{ bottom: 'calc(18vh + 80px)' }}>
      <div className="bg-white dark:bg-[#11141C] rounded-2xl shadow-xl border border-gray-100 dark:border-[#2C2F35] p-3.5 relative">
        <button onClick={onClose} aria-label={t('common.close', { defaultValue: '닫기' })} className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#1D1F29]">
          <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
        </button>
        <div className="flex gap-3 pr-6">
          {selected.image_url ? (
            <img src={cfImage(selected.image_url, { width: 200, quality: 82, format: 'auto' }) || selected.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" loading="lazy" decoding="async" onError={(e) => cfImageOnError(e.currentTarget, selected.image_url)} />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center shrink-0">
              <CatIcon cat={selected.category} className="w-6 h-6 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
              <span className="truncate">{selected.restaurant_name}</span>
              {selected.seller_id && liveSellerIds.has(selected.seller_id) && (
                <span className="inline-flex items-center gap-0.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
                </span>
              )}
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-extrabold text-gray-900 dark:text-white">{selected.price?.toLocaleString()}원</span>
              {/* 🎨 2026-07-19 (대표 — 브랜드 컬러 통일): 할인 뱃지 순수 빨강 → 웜 로즈 brand 토큰. */}
              {selected.original_price > selected.price && (
                <span className="text-[10px] bg-brand text-white font-bold px-1 py-0.5 rounded">
                  -{Math.round((1 - selected.price / selected.original_price) * 100)}%
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(`/products/${selected.id}`)}
            className="self-center px-3 py-2 bg-brand text-white text-xs font-bold rounded-xl shrink-0 active:scale-95 transition-transform"
          >
            {t('map.detail.buy', { defaultValue: '구매' })}
          </button>
        </div>
      </div>
    </div>
  )
}
