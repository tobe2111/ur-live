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
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-white border-t border-gray-100"
      style={{
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        // iOS safe-area: ensure content clears the home indicator
        paddingBottom: 'max(22px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center gap-2">
        {onToggleWishlist && (
          <button
            onClick={onToggleWishlist}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-xl border border-gray-200 transition-all active:scale-95"
          >
            <Heart
              className={`h-[18px] w-[18px] transition-colors ${
                isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400'
              }`}
            />
          </button>
        )}

        <button
          className="flex items-center justify-center gap-1 h-12 flex-1 rounded-xl bg-gray-100 transition-all active:scale-[0.98] disabled:opacity-40"
          onClick={onAddToCart}
          disabled={disabled}
        >
          <span className="text-[13px] font-bold text-gray-900">장바구니</span>
        </button>

        <button
          className="flex flex-col items-center justify-center h-12 flex-1 rounded-xl bg-gray-900 transition-all active:scale-[0.98] disabled:opacity-40"
          onClick={onBuyNow}
          disabled={disabled}
        >
          <span className="text-[8px] font-bold text-white/70">공구 참여</span>
          <span className="text-[13px] font-extrabold text-white">바로 구매</span>
        </button>
      </div>
    </div>
  )
}
