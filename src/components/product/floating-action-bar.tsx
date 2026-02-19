import { ShoppingCart } from 'lucide-react'

interface FloatingActionBarProps {
  onAddToCart: () => void;
  onBuyNow: () => void;
  disabled?: boolean;
}

export function FloatingActionBar({ onAddToCart, onBuyNow, disabled = false }: FloatingActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md border-t border-border bg-background px-4 pb-6 pt-2.5">
      <div className="flex gap-2">
        {/* Cart Button */}
        <button 
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2.5 transition-opacity active:opacity-70 disabled:opacity-50"
          onClick={onAddToCart}
          disabled={disabled}
        >
          <ShoppingCart className="h-4 w-4 text-foreground" />
          <span className="text-sm font-semibold text-foreground">
            장바구니
          </span>
        </button>

        {/* Purchase Button */}
        <button 
          className="flex flex-1 items-center justify-center rounded-lg bg-foreground py-2.5 transition-opacity active:opacity-80 disabled:opacity-50"
          onClick={onBuyNow}
          disabled={disabled}
        >
          <span className="text-sm font-semibold text-background">
            구매하기
          </span>
        </button>
      </div>
    </div>
  )
}
