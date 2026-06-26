import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import type { Product } from './types'

interface Props {
  mealVouchers: Product[]
  isOwner: boolean
  textClass: string
}

/**
 * 셀러 공개페이지 식사권 탭 (리스트).
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function VouchersTab({ mealVouchers, isOwner, textClass }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (mealVouchers.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm">{t('seller.publicPage.noVouchers')}</p>
        {isOwner && <button onClick={() => navigate('/seller/products/new')} className="mt-3 text-sm text-pink-500 font-medium">{t('seller.publicPage.registerVoucher')}</button>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {mealVouchers.map(p => {
        const disc = p.original_price && p.original_price > 0 ? Math.round((1 - (p.price || 0) / p.original_price) * 100) : 0
        return (
          <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="w-full flex gap-3 p-3 bg-gray-50 dark:bg-[#121212] rounded-xl text-left active:scale-[0.98]">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 shrink-0" style={p.dominant_color ? { backgroundColor: p.dominant_color } : undefined}>
              {p.image_url && (
                <img
                  src={cfImage(p.image_url, { width: 200, format: 'auto' }) || p.image_url}
                  srcSet={cfSrcSet(p.image_url, 200) || undefined}
                  sizes="96px"
                  alt="" loading="lazy" decoding="async"
                  onLoad={(e) => { e.currentTarget.style.opacity = '1' }}
                  style={{ opacity: 0, transition: 'opacity 200ms ease-out' }}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${textClass} line-clamp-1`}>{p.name}</p>
              {p.restaurant_name && <p className="text-xs text-gray-500 flex items-center gap-0.5 mt-0.5"><MapPin className="w-3 h-3" />{p.restaurant_name}</p>}
              {p.restaurant_address && <p className="text-[10px] text-gray-400 mt-0.5">{p.restaurant_address}</p>}
              {/* 🏁 2026-06-26 (대표 — "이건 모여서 사는 공동구매가 아니라 그냥 판매"): 즉시판매 단일가 모델
                  (2026-05-30 결정)에 맞춰 모집 UI(진행바·N/M명·공구 참여하기) 제거 → 가격만. */}
              <div className="flex items-baseline gap-1.5 mt-1.5">
                {disc > 0 && <span className="text-sm font-extrabold text-red-500">{disc}%</span>}
                <span className={`text-sm font-extrabold ${textClass}`}>{formatNumber(p.price || 0)}원</span>
                {p.original_price && <span className="text-xs text-gray-400 line-through">{formatNumber(p.original_price || 0)}원</span>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
