import React from 'react'
import { ShoppingBag, Star } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Product {
  id: number
  name: string
  price: number
  originalPrice?: number
  image: string
  description?: string
  rating?: number
  sold?: number
  stock?: number
}

interface LiveProductCardProps {
  product: Product
  onAddToCart: (productId: number) => void
  isAddingToCart?: boolean
  className?: string
}

export const LiveProductCard = React.memo(function LiveProductCard({
  product,
  onAddToCart,
  isAddingToCart = false,
  className = ''
}: LiveProductCardProps) {
  const formatPrice = (price: number) => {
    return formatNumber(price)
  }

  const discountRate = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  const isOutOfStock = product.stock !== undefined && product.stock <= 0

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* 상품 이미지 */}
      <div className="relative aspect-square">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover" loading="lazy" decoding="async" />
        
        {/* 할인 배지 */}
        {discountRate > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-md text-sm font-bold">
            {discountRate}% OFF
          </div>
        )}
        
        {/* 품절 오버레이 */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white px-4 py-2 rounded-md font-bold text-gray-900">
              품절
            </div>
          </div>
        )}
      </div>

      {/* 상품 정보 */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
          {product.name}
        </h3>

        {/* 평점 및 판매 수 */}
        {(product.rating || product.sold) && (
          <div className="flex items-center gap-3 mb-2 text-sm text-gray-600">
            {product.rating && (
              <div className="flex items-center gap-1">
                <Star size={14} className="text-yellow-500 fill-yellow-500" />
                <span>{product.rating.toFixed(1)}</span>
              </div>
            )}
            {product.sold && (
              <div>
                {formatNumber(product.sold)}개 판매
              </div>
            )}
          </div>
        )}

        {/* 가격 */}
        <div className="mb-3">
          {product.originalPrice && product.originalPrice > product.price && (
            <div className="text-sm text-gray-500 dark:text-gray-400 line-through">
              {formatPrice(product.originalPrice)}원
            </div>
          )}
          <div className="text-2xl font-bold text-blue-600">
            {formatPrice(product.price)}원
          </div>
        </div>

        {/* 재고 표시 */}
        {product.stock !== undefined && (
          <div className="mb-3 text-sm">
            {product.stock > 0 ? (
              <span className="text-green-600">재고: {product.stock}개</span>
            ) : (
              <span className="text-red-600 font-bold">품절</span>
            )}
          </div>
        )}

        {/* 장바구니 버튼 */}
        <button
          onClick={() => onAddToCart(product.id)}
          disabled={isAddingToCart || isOutOfStock}
          className={`w-full py-3 rounded-lg font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2 transition-colors ${
            isOutOfStock
              ? 'bg-gray-300 cursor-not-allowed'
              : isAddingToCart
              ? 'bg-blue-400 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <ShoppingBag size={20} />
          {isAddingToCart ? '추가 중...' : isOutOfStock ? '품절' : '장바구니 담기'}
        </button>
      </div>
    </div>
  )
})
