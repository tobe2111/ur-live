// 🏁 2026-07-07 (대표 — "이용권 UI 저러면 안되지"): 유어샵 카드 단일화. 이용권도 표준 BrowseProductCard
//   2열 그리드로 — 내 상품·추천템과 동일한 그라데이션 카드(★평점·할인·구매수 내장). "카드 1종"(2026-06-25 대표).
// 🧹 2026-07-20 (유어샵 전수조사): 도달불가 빈-상태 분기 제거(호출부가 gridVouchers.length>0 일 때만 렌더) +
//   @deprecated textClass·미사용 isOwner prop 제거.
import BrowseProductCard from '@/pages/browse/BrowseProductCard'
import type { Product as BrowseProduct } from '@/pages/browse/types'
import { seededColor } from '@/utils/card-gradient'
import type { Product } from './types'

interface Props {
  mealVouchers: Product[]
}

/**
 * 셀러 공개페이지 이용권 섹션 — 표준 상품 카드 그리드.
 * 🛡️ TD-006 추출 (2026-05-06). 🏁 2026-07-07 카드 통일(BrowseProductCard).
 */
export default function VouchersTab({ mealVouchers }: Props) {
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
            restaurant_name: p.restaurant_name,
          } as BrowseProduct}
          aboveFold={false}
          to={`/products/${p.id}`}
          fallbackColor={seededColor(p.id)}
        />
      ))}
    </div>
  )
}
