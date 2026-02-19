import { ArrowLeft, Share2, ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface MobileHeaderProps {
  onShare: () => void;
}

export function MobileHeader({ onShare }: MobileHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 flex h-11 items-center justify-between bg-background/90 px-4 backdrop-blur-sm">
      <button 
        aria-label="Go back" 
        className="p-1"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>

      <div className="flex items-center gap-4">
        <button 
          aria-label="Share" 
          className="p-1"
          onClick={onShare}
        >
          <Share2 className="h-[18px] w-[18px] text-foreground" />
        </button>
        <button 
          aria-label="Cart" 
          className="p-1"
          onClick={() => navigate('/cart')}
        >
          <ShoppingBag className="h-[18px] w-[18px] text-foreground" />
        </button>
      </div>
    </header>
  )
}
