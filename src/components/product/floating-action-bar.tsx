import { ShoppingCart, Heart } from 'lucide-react'

interface FloatingActionBarProps {
  onAddToCart: () => void;
  onBuyNow: () => void;
  disabled?: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}

export function FloatingActionBar({
  onAddToCart,
  onBuyNow,
  disabled = false,
  isWishlisted = false,
  onToggleWishlist,
}: FloatingActionBarProps) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-screen-sm bg-white border-t border-gray-100 px-4 pb-safe pt-2">
      <div className="flex items-center gap-2">
        {/* 찜 버튼 */}
        {onToggleWishlist && (
          <button
            onClick={onToggleWishlist}
            className="flex items-center justify-center w-12 h-12 rounded-xl border border-gray-200 transition-all active:scale-95"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400'
              }`}
            />
          </button>
        )}

        {/* 장바구니 */}
        <button
          className="flex items-center justify-center gap-1.5 h-12 flex-1 rounded-xl border border-gray-200 bg-white transition-all active:scale-[0.98] disabled:opacity-50"
          onClick={onAddToCart}
          disabled={disabled}
        >
          <ShoppingCart className="h-4 w-4 text-gray-700" />
          <span className="text-sm font-semibold text-gray-700">장바구니</span>
        </button>

        {/* 구매하기 */}
        <button
          className="flex items-center justify-center h-12 flex-[1.5] rounded-xl bg-black transition-all active:scale-[0.98] disabled:opacity-50"
          onClick={onBuyNow}
          disabled={disabled}
        >
          <span className="text-sm font-bold text-white">구매하기</span>
        </button>
      </div>
    </div>
  )
}
