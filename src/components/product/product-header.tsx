import { Link } from 'react-router-dom'

interface ProductHeaderProps {
  name: string;
  price: number;
  originalPrice?: number;
  discountRate?: number;
  sellerName?: string;
  sellerId?: number | string;
  soldCount?: number;
  reviewCount?: number;
  avgRating?: number;
}

export function ProductHeader({ name, price, originalPrice, discountRate, sellerName, sellerId, soldCount, reviewCount, avgRating }: ProductHeaderProps) {
  const formatPrice = (p: number) => new Intl.NumberFormat('ko-KR').format(p)

  const hasDiscount = originalPrice && originalPrice > price
  const displayDiscount = discountRate || (hasDiscount ? Math.round((1 - price / originalPrice) * 100) : 0)

  return (
    <div className="px-5 py-4">
      {/* Seller */}
      {sellerName && (
        sellerId ? (
          <Link to={`/s/${sellerId}`} className="text-xs text-pink-500 font-medium mb-1 block">
            {sellerName} →
          </Link>
        ) : (
          <p className="text-xs text-gray-500 mb-1">{sellerName}</p>
        )
      )}

      {/* Product Name */}
      <h1 className="text-[17px] font-bold leading-snug text-gray-900">
        {name}
      </h1>

      {/* Price */}
      <div className="mt-3 flex items-end gap-2">
        {displayDiscount > 0 && (
          <span className="text-[28px] font-black text-red-500 leading-none">{displayDiscount}%</span>
        )}
        <span className="text-[28px] font-black text-gray-900 leading-none">{formatPrice(price)}<span className="text-[16px]">원</span></span>
      </div>

      {hasDiscount && (
        <p className="mt-1 text-sm text-gray-400 line-through">{formatPrice(originalPrice)}원</p>
      )}

      {/* Stats */}
      {(reviewCount || soldCount) ? (
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          {avgRating ? (
            <span className="flex items-center gap-0.5">
              <span className="text-yellow-500">★</span> {avgRating.toFixed(1)}
              {reviewCount ? <span className="text-gray-400">({reviewCount})</span> : null}
            </span>
          ) : null}
          {soldCount ? <span>{soldCount.toLocaleString()}개 구매</span> : null}
        </div>
      ) : null}

      {/* Shipping */}
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <span className="text-gray-400">배송비</span>
        <span className="font-medium text-gray-700">3,000원</span>
        <span className="text-gray-400">·</span>
        <span className="text-blue-600 font-medium">50,000원 이상 무료</span>
      </div>
    </div>
  )
}
