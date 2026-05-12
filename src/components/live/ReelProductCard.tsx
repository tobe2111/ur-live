/**
 * ReelProductCard — 라이브 릴 하단 흰 상품 카드
 * TD-006: ReelCard.tsx 에서 추출 (2026-05-06)
 *
 * 책임: 상품 정보 표시 + 찜 / 장바구니 / 바로구매(또는 셀러 변경) 액션 버튼
 */
import { ShoppingBag, Bell } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { boutiqueCTA } from '@/components/glass/glassTokens'
import WishlistButton from '@/components/WishlistButton'
import { formatNumber } from '@/utils/format'
import api from '@/lib/api'

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
  safeProduct: Product
  currentProduct: Product | null
  isSeller: boolean
  streamProduct: Product | null
  isCurrentProduct: boolean
  addingToCart: boolean
  checkingOut: boolean
  changingProduct: boolean
  streamId?: number
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
  streamId,
  onAddToCart,
  onCheckout,
  onChangeProduct,
}: ReelProductCardProps) {
  const { t } = useTranslation()
  const [restockRequested, setRestockRequested] = useState(false)

  async function requestRestock() {
    if (restockRequested || !streamId) return
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token') || ''
      await api.post(`/api/streams/${streamId}/restock-notify`,
        { product_id: safeProduct.id },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      setRestockRequested(true)
    } catch { setRestockRequested(true) }
  }

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

      {/* 품절 배너 */}
      {typeof stock === 'number' && stock === 0 && (
        <div className="px-3 py-1.5 bg-gray-50 flex items-center justify-between" style={{ borderTop: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444' }}>
            {t('live.soldOut', { defaultValue: '품절' })}
          </span>
          <button
            onClick={requestRestock}
            disabled={restockRequested}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all active:scale-95 disabled:opacity-60"
            style={{ background: restockRequested ? '#E5E7EB' : '#111827', color: restockRequested ? '#6B7280' : '#fff' }}
          >
            <Bell style={{ width: 9, height: 9 }} />
            {restockRequested
              ? t('live.restockRequested', { defaultValue: '알림 신청됨' })
              : t('live.restockNotify', { defaultValue: '재입고 알림' })}
          </button>
        </div>
      )}

      {/* Action row — 3분할 (찜 / 장바구니 / 바로구매 or 셀러 변경) */}
      <div className={`grid grid-cols-3 ${typeof stock === 'number' && stock === 0 ? 'opacity-40 pointer-events-none' : ''}`} style={{ borderTop: '1px solid #F3F4F6' }}>
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
