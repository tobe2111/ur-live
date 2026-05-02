import { ChevronLeft, Share2, ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface MobileHeaderProps {
  onShare: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}

export function MobileHeader({ onShare }: MobileHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    const referrer = document.referrer
    const currentHost = window.location.host
    if (referrer && referrer.includes(currentHost) && !referrer.includes('/login')) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  const btnClass = "flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm"

  return (
    <header className="absolute top-0 inset-x-0 z-40 flex items-center justify-between px-3" style={{ paddingTop: 12 }}>
      <button aria-label="뒤로가기" className={btnClass} onClick={handleBack}>
        <ChevronLeft className="h-[18px] w-[18px] text-gray-900 dark:text-white" />
      </button>
      <div className="flex items-center gap-1.5">
        <button aria-label="공유" className={btnClass} onClick={onShare}>
          <Share2 className="h-4 w-4 text-gray-900 dark:text-white" />
        </button>
        <button aria-label="장바구니" className={btnClass} onClick={() => navigate('/cart')}>
          <ShoppingBag className="h-4 w-4 text-gray-900 dark:text-white" />
        </button>
      </div>
    </header>
  )
}
