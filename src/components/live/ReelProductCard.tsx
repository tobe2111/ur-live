/**
 * ReelProductCard — 라이브 릴 하단 흰 상품 카드
 * TD-006: ReelCard.tsx 에서 추출 (2026-05-06)
 *
 * 책임: 상품 정보 표시 + 찜 / 장바구니 / 바로구매(또는 셀러 변경) 액션 버튼
 */
import { ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { boutiqueCTA } from '@/components/glass/glassTokens'
import WishlistButton from '@/components/WishlistButton'
import { formatNumber } from '@/utils/format'

interface Product {
  id: number
  name: string
  price: number
  originalPrice: number
  original_price?: number
  image: string
  image_url?: string
  description: string
  rating: number
  sold: number
  stock?: number
  seller_id?: number
  colors?: { name: string; hex: string }[]
  sizes?: string[]
}

interface ReelProductCardProps {
  /** 안전하게 보장된 상품 (null fallback 이미 처리된 것) */
  safeProduct: Product
  /** 현재 선택된 상품 (null이면 카드 미표시) */
  currentProduct: Product | null
  isSeller: boolean
  /** 셀러 모드에서 "변경" 버튼에 사용할 원본 스트림 상품 */
  streamProduct: Product | null
  isCurrentProduct: boolean
  addingToCart: boolean
  checkingOut: boolean
  changingProduct: boolean
  onAddToCart: () => void
  onCheckout: () => void
  onChangeProduct: () => void
}

export default function ReelProductCard({
  safeProduct,
  currentProduct,
  isSeller,
  streamProduct,
  isCurrentProduct,
  addingToCart,
  checkingOut,
  changingProduct,
  onAddToCart,
  onCheckout,
  onChangeProduct,
}: ReelProductCardProps) {
  const { t } = useTranslation()

  if (!currentProduct) return null

  const originalPrice = (safeProduct.originalPrice || safeProduct.original_price || 0)
  const discountRate = originalPrice > safeProduct.price
    ? Math.round((1 - safeProduct.price / originalPrice) * 100)
    : 0
  const stock = safeProduct.stock

  return (
    /* 🛡️ 2026-04-29 v4 Boutique 톤 — 흰 카드 + 라벨 strip + 메인 row + 3분할 액션 row */
    /* 🛡️ 2026-04-30: 사용자 피드백 — 카드 높이 ~16% 축소 (썸네일 72→60, padding/font 조정) */
    <div
      className="rounded-3xl overflow-hidden w-full"
      style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
      key={currentProduct?.id || 'default'}
    >
      {/* Label strip — NOW · 지금 소개 + 재고 */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.08), rgba(236,72,153,0.08))' }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full"
            style={{ width: 5, height: 5, background: '#EF4444', boxShadow: '0 0 6px #EF4444' }}
          />
          <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444', letterSpacing: '0.08em' }}>
            {t('live.nowLabel', { defaultValue: 'NOW · 지금 소개' })}
          </span>
        </div>
        {typeof stock === 'number' && stock > 0 && (
          <span style={{ fontSize: 10, color: '#6B7280' }}>
            {t('live.stockCount', { count: stock, defaultValue: `재고 ${stock}개` })}
          </span>
        )}
      </div>

      {/* Main row — 썸네일 60x60 */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <div className="relative rounded-2xl overflow-hidden shrink-0" style={{ width: 60, height: 60 }}>
          {(safeProduct.image_url || safeProduct.image) ? (
            <img
              src={safeProduct.image_url || safeProduct.image}
              alt={safeProduct.name || t('live.actionProducts', { defaultValue: '상품' })}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
          {discountRate > 0 && (
            <span
              className="absolute top-1 left-1 px-1.5 py-0.5 rounded"
              style={{ background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 800 }}
            >
              -{discountRate}%
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            style={{ fontSize: 12, fontWeight: 500, color: '#374151', lineHeight: 1.35 }}
            className="line-clamp-2"
          >
            {safeProduct.name}
          </p>
          {originalPrice > safeProduct.price && (
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>
                {formatNumber(originalPrice)}
              </span>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            {discountRate > 0 && (
              <span style={{ fontSize: 13, fontWeight: 800, color: '#EF4444' }}>{discountRate}%</span>
            )}
            <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
              {formatNumber(safeProduct.price || 0)}
            </span>
            <span style={{ fontSize: 11, color: '#6B7280' }}>
              {t('ordersTab.won', { defaultValue: '원' })}
            </span>
          </div>
        </div>
      </div>

      {/* Action row — 3분할 (찜 / 장바구니 / 바로구매 or 셀러 변경) */}
      <div className="grid grid-cols-3" style={{ borderTop: '1px solid #F3F4F6' }}>
        {/* 찜하기 */}
        <div className="py-2.5 flex items-center justify-center" style={{ borderRight: '1px solid #F3F4F6' }}>
          <WishlistButton productId={safeProduct.id} size="sm" />
        </div>

        {/* 장바구니 */}
        <button
          onClick={onAddToCart}
          disabled={!currentProduct || addingToCart}
          className="py-2.5 flex flex-col items-center gap-0.5 disabled:opacity-50"
          style={{ borderRight: '1px solid #F3F4F6' }}
          aria-label={t('live.addToCart', { defaultValue: '장바구니에 담기' })}
        >
          <ShoppingBag style={{ width: 16, height: 16, color: '#6B7280' }} />
          <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>
            {addingToCart
              ? t('live.addingToCart', { defaultValue: '담는 중…' })
              : t('live.addToCart', { defaultValue: '장바구니' })}
          </span>
        </button>

        {/* 바로구매 — 셀러는 "변경"으로 분기 */}
        {isSeller && streamProduct ? (
          <button
            onClick={onChangeProduct}
            disabled={changingProduct || isCurrentProduct}
            className="py-2.5 flex flex-col items-center gap-0.5 disabled:opacity-50"
            style={boutiqueCTA}
            aria-label={
              isCurrentProduct
                ? t('live.sellerIntroducing', { defaultValue: '소개 중' })
                : t('live.sellerChangeProduct', { defaultValue: '상품 변경' })
            }
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>
              {changingProduct
                ? t('live.sellerChanging', { defaultValue: '전환 중…' })
                : isCurrentProduct
                  ? t('live.sellerIntroducing', { defaultValue: '소개 중' })
                  : t('live.sellerChangeProduct', { defaultValue: '변경' })}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
              {isCurrentProduct ? '✅' : '🔄'}
            </span>
          </button>
        ) : (
          <button
            onClick={onCheckout}
            disabled={!currentProduct || checkingOut}
            className="py-2.5 flex flex-col items-center gap-0.5 disabled:opacity-50"
            style={boutiqueCTA}
            aria-label={t('live.buyNow', { defaultValue: '바로 구매' })}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>
              {t('live.buyNow', { defaultValue: '바로구매' })}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
              {t('live.freeShipping', { defaultValue: '무료배송' })}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
