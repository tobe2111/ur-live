import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  discount_rate: number
  image_url: string
  stock: number
  seller_name: string
  seller_username: string
  // 🛡️ 2026-05-19: KT Alpha 교환권 (deal_only=1) 은 '딜' 단위로 표시.
  deal_only?: number
}

interface ProductCardProps {
  product: Product
  highlightQuery?: string
}

function highlightText(text: string, query: string) {
  if (!query || query.length < 1) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-100 text-gray-900 dark:text-white rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export default function ProductCard({ product, highlightQuery }: ProductCardProps) {
  // 🛡️ 2026-04-22: 서버 라운딩과 통일 (Math.floor → Math.round)
  const discountedPrice = Math.round(product.price * (1 - (product.discount_rate || 0) / 100))
  const discount = product.discount_rate || 0
  const showDiscountBadge = discount >= 30
  const priceUnit = Number(product.deal_only) === 1 ? '딜' : '원'

  return (
    <Link to={`/products/${product.id}`} className="block text-left group">
      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[#1A1A1A]">
            <span className="text-gray-300 dark:text-gray-600 text-2xl">📦</span>
          </div>
        )}

        {/* Discount badge - only for >= 30% */}
        {showDiscountBadge && product.stock > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg">
            -{discount}%
          </span>
        )}

        {/* Sold out overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-[13px] font-bold">품절</span>
          </div>
        )}

        {/* Heart button */}
        <button
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow-sm active:scale-90 transition-transform"
          onClick={(e) => e.preventDefault()}
        >
          <Heart className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        </button>
      </div>

      <div className="mt-2.5 px-0.5">
        {/* Seller name */}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">
          @{product.seller_name || product.seller_username}
        </p>

        {/* Product name with keyword highlight */}
        <p className="text-[13px] text-gray-900 dark:text-white leading-[1.35] line-clamp-2 mb-1.5">
          {highlightQuery ? highlightText(product.name, highlightQuery) : product.name}
        </p>

        {/* Original price (strikethrough) */}
        {product.price > discountedPrice && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 line-through">
            {formatNumber(product.price)}{priceUnit === '딜' ? ' 딜' : '원'}
          </p>
        )}

        {/* Price row */}
        <div className="flex items-baseline gap-1.5 mt-0.5">
          {discount > 0 && (
            <span className="text-[14px] font-extrabold text-red-500">{discount}%</span>
          )}
          <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">
            {formatNumber(discountedPrice)}{priceUnit === '딜' ? ' 딜' : '원'}
          </span>
        </div>

        {/* Low stock warning */}
        {product.stock > 0 && product.stock <= 10 && (
          <p className="text-[10px] text-amber-500 font-semibold mt-1">
            재고 {product.stock}개
          </p>
        )}
      </div>
    </Link>
  )
}
