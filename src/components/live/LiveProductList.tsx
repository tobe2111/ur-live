import React from 'react'
import { LiveProductCard } from './LiveProductCard'

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

interface LiveProductListProps {
  products: Product[]
  currentProductId?: number
  onAddToCart: (productId: number) => void
  onSelectProduct?: (productId: number) => void
  isAddingToCart?: boolean
  className?: string
}

export const LiveProductList = React.memo(function LiveProductList({
  products,
  currentProductId,
  onAddToCart,
  onSelectProduct,
  isAddingToCart = false,
  className = ''
}: LiveProductListProps) {
  if (products.length === 0) {
    return (
      <div className={`bg-white p-8 text-center ${className}`}>
        <div className="text-gray-500 dark:text-gray-400 mb-2">
          <svg
            className="mx-auto h-16 w-16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <p className="text-gray-600">판매 중인 상품이 없습니다</p>
      </div>
    )
  }

  return (
    <div className={`bg-gray-50 p-4 ${className}`}>
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        판매 상품 ({products.length})
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className={`relative ${
              currentProductId === product.id ? 'ring-2 ring-blue-500 rounded-lg' : ''
            }`}
            onClick={() => onSelectProduct?.(product.id)}
          >
            {/* 현재 판매 중 배지 */}
            {currentProductId === product.id && (
              <div className="absolute top-2 right-2 z-10 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md">
                판매 중
              </div>
            )}
            
            <LiveProductCard
              product={product}
              onAddToCart={onAddToCart}
              isAddingToCart={isAddingToCart}
              className={onSelectProduct ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}
            />
          </div>
        ))}
      </div>
    </div>
  )
})
