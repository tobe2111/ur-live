import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import PinButton from '@/components/curator/PinButton'

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
  // 🎫 2026-06-21 (대표 요청): 교환권은 판매자 핸들 대신 브랜드명(스타벅스 등) 표시.
  brand_name?: string
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
          <mark key={i} className="bg-yellow-200 text-gray-900 dark:bg-yellow-400/30 dark:text-yellow-200 rounded-sm px-0.5">{part}</mark>
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
          /* 🛡️ 2026-05-23 (Task 4): Cloudflare Image Resizing — WebP/AVIF 자동 변환 + DPI별 srcset.
              원본 URL 그대로 → 50-80% 트래픽 절감, LCP ↓.
              외부 URL (i.ibb.co 등) 은 helper 가 자동으로 그대로 반환. */
          <img
            src={cfImage(product.image_url, { width: 400, format: 'auto' })}
            srcSet={cfSrcSet(product.image_url, 400)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
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

        {/* 🛡️ 2026-05-25 큐레이터 핀 — 1탭 핀 추가 (Phase 1-B 핵심 UX) */}
        <PinButton productId={product.id} price={product.price} variant="card-overlay" />
      </div>

      <div className="mt-2.5 px-0.5">
        {/* 🎫 2026-06-21 (대표 요청): 교환권(deal_only=1)은 판매자 핸들(@) 대신 브랜드명 표시.
            판매자 없는 교환권에 빈 '@' 만 뜨던 것 해소 — 브랜드·판매자 둘 다 없으면 줄 생략. */}
        {Number(product.deal_only) === 1 && product.brand_name ? (
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5 truncate">{product.brand_name}</p>
        ) : (product.seller_name || product.seller_username) ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5 truncate">@{product.seller_name || product.seller_username}</p>
        ) : null}

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
