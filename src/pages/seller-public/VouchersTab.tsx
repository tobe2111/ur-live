import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { formatNumber } from '@/utils/format'
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
        const progress = (p.group_buy_target ?? 0) > 0 ? Math.min(100, ((p.group_buy_current || 0) / (p.group_buy_target || 1)) * 100) : 0
        return (
          <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="w-full flex gap-3 p-3 bg-gray-50 dark:bg-[#121212] rounded-xl text-left active:scale-[0.98]">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 shrink-0">
              {p.image_url && <img src={p.image_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${textClass} line-clamp-1`}>{p.name}</p>
              {p.restaurant_name && <p className="text-xs text-gray-500 flex items-center gap-0.5 mt-0.5"><MapPin className="w-3 h-3" />{p.restaurant_name}</p>}
              {p.restaurant_address && <p className="text-[10px] text-gray-400 mt-0.5">{p.restaurant_address}</p>}
              <div className="flex items-baseline gap-1.5 mt-1.5">
                {disc > 0 && <span className="text-sm font-extrabold text-red-500">{disc}%</span>}
                <span className={`text-sm font-extrabold ${textClass}`}>{formatNumber(p.price || 0)}원</span>
                {p.original_price && <span className="text-xs text-gray-400 line-through">{formatNumber(p.original_price || 0)}원</span>}
              </div>
              {(p.group_buy_target ?? 0) > 0 && (
                <div className="mt-1.5">
                  <div className="w-full bg-gray-700 rounded-full h-1.5"><div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-gray-500">{p.group_buy_current || 0}/{p.group_buy_target}{t('common.person')}</p>
                    {p.group_buy_current && p.group_buy_target && p.group_buy_current >= p.group_buy_target
                      ? <span className="text-[10px] text-green-400 font-bold">{t('seller.publicPage.achieved')}</span>
                      : <span className="text-[10px] text-pink-400 font-medium">{t('seller.publicPage.joinGroupBuy')}</span>
                    }
                  </div>
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
