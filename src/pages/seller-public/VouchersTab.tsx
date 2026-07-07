import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
// 🏁 2026-07-07 (대표 — "이용권 UI 저러면 안되지"): 링크샵 카드 단일화. 이용권도 표준 BrowseProductCard
//   2열 그리드로 — 내 상품·추천템과 동일한 그라데이션 카드(★평점·할인·구매수 내장). 기존 밋밋한 가로 행
//   (좌 96px 썸네일 + 우 텍스트)이 나머지 섹션과 안 어울리던 것 해소. "카드 1종"(2026-06-25 대표) 원칙.
import BrowseProductCard from '@/pages/browse/BrowseProductCard'
import type { Product as BrowseProduct } from '@/pages/browse/types'
import { seededColor } from '@/utils/card-gradient'
import type { Product } from './types'

interface Props {
  mealVouchers: Product[]
  isOwner: boolean
  /** @deprecated 카드 통일(BrowseProductCard)로 미사용 — 호출부 호환 위해 시그니처만 유지. */
  textClass?: string
}

/**
 * 셀러 공개페이지 이용권 섹션 — 표준 상품 카드 그리드.
 * 🛡️ TD-006 추출 (2026-05-06). 🏁 2026-07-07 카드 통일(BrowseProductCard).
 */
export default function VouchersTab({ mealVouchers, isOwner }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (mealVouchers.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm">{t('seller.publicPage.noVouchers')}</p>
        {isOwner && <button onClick={() => navigate('/seller/meal-voucher/new')} className="mt-3 text-sm text-pink-500 font-medium">{t('seller.publicPage.registerVoucher')}</button>}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 lg:gap-x-4 lg:gap-y-8">
      {mealVouchers.map(p => (
        <BrowseProductCard
          key={p.id}
          product={{
            id: p.id,
            name: p.name,
            price: p.price,
            current_price: p.price,
            original_price: p.original_price ?? undefined,
            discount_rate: p.discount_rate ?? 0,
            image_url: p.image_url || '',
            stock: 0,
            dominant_color: p.dominant_color,
            avg_rating: p.avg_rating,
            review_count: p.review_count,
            sold_count: p.sold_count,
          } as BrowseProduct}
          aboveFold={false}
          to={`/products/${p.id}`}
          fallbackColor={seededColor(p.id)}
        />
      ))}
    </div>
  )
}
