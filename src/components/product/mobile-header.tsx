import { ArrowLeft, Heart, Share2, ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface MobileHeaderProps {
  onShare: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}

export function MobileHeader({ onShare, isWishlisted, onToggleWishlist }: MobileHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    // Check if there's a valid referrer from the same site
    const referrer = document.referrer
    const currentHost = window.location.host

    if (referrer && referrer.includes(currentHost)) {
      // Check if the previous page was login page
      if (referrer.includes('/login')) {
        // If coming from login, go to home instead
        navigate('/')
      } else {
        // Safe to go back
        navigate(-1)
      }
    } else {
      // No valid referrer, go to home
      navigate('/')
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-11 items-center justify-between bg-white/90 px-4 backdrop-blur-sm border-b border-gray-100">
      <button
        aria-label="Go back"
        className="p-1"
        onClick={handleBack}
      >
        <ArrowLeft className="h-5 w-5 text-gray-900" />
      </button>

      <div className="flex items-center gap-4">
        {onToggleWishlist && (
          <button
            aria-label={isWishlisted ? '찜 해제' : '찜하기'}
            className="p-1"
            onClick={onToggleWishlist}
          >
            <Heart
              className={`h-[18px] w-[18px] transition-colors ${
                isWishlisted
                  ? 'fill-red-500 text-red-500'
                  : 'text-gray-900'
              }`}
            />
          </button>
        )}
        <button
          aria-label="Share"
          className="p-1"
          onClick={onShare}
        >
          <Share2 className="h-[18px] w-[18px] text-gray-900" />
        </button>
        <button
          aria-label="Cart"
          className="p-1"
          onClick={() => navigate('/cart')}
        >
          <ShoppingBag className="h-[18px] w-[18px] text-gray-900" />
        </button>
      </div>
    </header>
  )
}
