import { Link } from 'react-router-dom'
import { formatNumber } from '@/utils/format'

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
    <>
      {/* v4 Brand strip */}
      {sellerName && (
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-full flex items-center justify-center w-9 h-9 bg-pink-50 border border-pink-200">
              <span className="text-[13px] font-extrabold text-pink-500">{sellerName.charAt(0)}</span>
            </div>
            <div>
              {sellerId ? (
                <Link to={`/s/${sellerId}`} className="text-[13px] font-extrabold text-gray-900 hover:underline">{sellerName}</Link>
              ) : (
                <p className="text-[13px] font-extrabold text-gray-900">{sellerName}</p>
              )}
              <p className="text-[10px] text-gray-400">브랜드</p>
            </div>
          </div>
          <button className="rounded-full px-3 py-1.5 border border-gray-900 text-[11px] font-bold text-gray-900 active:scale-95 transition-transform">
            팔로우
          </button>
        </div>
      )}

      <div className="h-px bg-gray-100" />

      {/* v4 Product info */}
      <section className="px-5 pt-5 pb-6">
        <p className="text-[13px] text-gray-900 leading-relaxed line-clamp-2">{name}</p>

        {/* Rating + stats */}
        {(reviewCount || soldCount) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {avgRating && (
              <>
                <span className="text-yellow-500 text-[12px]">★</span>
                <span className="text-[12px] font-semibold text-gray-900">{avgRating.toFixed(1)}</span>
              </>
            )}
            <span className="text-[12px] text-gray-400">
              {reviewCount ? `· 리뷰 ${formatNumber(reviewCount)}` : ''}
              {soldCount ? ` · ${formatNumber(soldCount)}명 구매` : ''}
            </span>
          </div>
        )}

        {/* v4 Price cluster */}
        <div className="flex items-baseline gap-2 mt-4">
          {displayDiscount > 0 && (
            <span className="text-[22px] font-extrabold text-red-500">{displayDiscount}%</span>
          )}
          <span className="text-[26px] font-extrabold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
            {formatPrice(price)}
          </span>
          <span className="text-[14px] text-gray-900">원</span>
        </div>

        {hasDiscount && (
          <p className="text-[11px] text-gray-400 line-through mt-0.5">{formatPrice(originalPrice)}원</p>
        )}
      </section>
    </>
  )
}
