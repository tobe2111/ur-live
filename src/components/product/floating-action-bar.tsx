import { ShoppingCart, Heart } from 'lucide-react'

interface FloatingActionBarProps {
  onAddToCart: () => void;
  onBuyNow: () => void;
  disabled?: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  price?: number;
  originalPrice?: number;
}

export function FloatingActionBar({
  onAddToCart,
  onBuyNow,
  disabled = false,
  isWishlisted = false,
  onToggleWishlist,
  price,
  originalPrice,
}: FloatingActionBarProps) {
  const discount = originalPrice && originalPrice > (price || 0)
    ? Math.round((1 - (price || 0) / originalPrice) * 100)
    : 0

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-white/95 backdrop-blur-lg border-t border-gray-200 px-4 pb-safe pt-3">
      {price !== undefined && (
        <div className="flex items-baseline gap-2 mb-2">
          {discount > 0 && (
            <span className="text-[15px] font-extrabold text-red-500">{discount}%</span>
          )}
          <span className="text-[18px] font-extrabold text-gray-900">
            {price.toLocaleString()}원
          </span>
          {originalPrice && originalPrice > price && (
            <span className="text-[13px] text-gray-400 line-through">
              {originalPrice.toLocaleString()}원
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        {onToggleWishlist && (
          <button
            onClick={onToggleWishlist}
            className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all active:scale-95 ${
              isWishlisted
                ? 'bg-red-50 border border-red-200'
                : 'bg-gray-100 border border-gray-200'
            }`}
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400'
              }`}
            />
          </button>
        )}

        <button
          className="flex items-center justify-center gap-1.5 h-12 flex-1 rounded-xl bg-gray-100 border border-gray-200 transition-all active:scale-[0.98] disabled:opacity-40"
          onClick={onAddToCart}
          disabled={disabled}
        >
          <ShoppingCart className="h-4 w-4 text-gray-700" />
          <span className="text-[13px] font-bold text-gray-700">담기</span>
        </button>

        <button
          className="flex items-center justify-center h-12 flex-[2] rounded-xl bg-gray-900 transition-all active:scale-[0.98] disabled:opacity-40"
          onClick={onBuyNow}
          disabled={disabled}
        >
          <span className="text-[14px] font-bold text-white">바로 구매</span>
        </button>
      </div>
    </div>
  )
}
