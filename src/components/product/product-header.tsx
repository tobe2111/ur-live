interface ProductHeaderProps {
  name: string;
  price: number;
  originalPrice?: number;
  discountRate?: number;
}

export function ProductHeader({ name, price, originalPrice, discountRate }: ProductHeaderProps) {
  const formatPrice = (p: number) => new Intl.NumberFormat('ko-KR').format(p)

  const hasDiscount = originalPrice && originalPrice > price
  const displayDiscount = discountRate || (hasDiscount ? Math.round((1 - price / originalPrice) * 100) : 0)

  return (
    <div className="px-5 py-4">
      {/* Product Name */}
      <h1 className="text-[15px] font-medium leading-snug text-gray-900">
        {name}
      </h1>

      {/* Price */}
      <div className="mt-2.5 flex items-baseline gap-2">
        {displayDiscount > 0 && (
          <span className="text-xl font-extrabold text-red-500">{displayDiscount}%</span>
        )}
        <span className="text-xl font-extrabold text-gray-900">{formatPrice(price)}원</span>
      </div>

      {hasDiscount && (
        <p className="mt-0.5 text-sm text-gray-400 line-through">{formatPrice(originalPrice)}원</p>
      )}
    </div>
  )
}
