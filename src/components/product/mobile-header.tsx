import { ChevronLeft, Share2, ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface MobileHeaderProps {
  onShare: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  // 🛡️ 2026-05-27 사용자 요청: 상단 + 핀 버튼 제거 → 우하단 선물 버튼 아래로 이동 (ProductDetailPage FAB).
  //   사용자 의도 — 핀 아이콘만 있으면 의미 모름. 가운데 상단보단 우하단 floating + 명확 라벨이 발견성 ↑.
  productId?: number;
  productPrice?: number;
}

export function MobileHeader({ onShare }: MobileHeaderProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const handleBack = () => {
    const referrer = document.referrer
    const currentHost = window.location.host
    if (referrer && referrer.includes(currentHost) && !referrer.includes('/login')) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  const btnClass = "flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-[#0A0A0A]/90 backdrop-blur-md shadow-sm"

  return (
    <header className="absolute top-0 inset-x-0 z-40 flex items-center justify-between px-3" style={{ paddingTop: 12 }}>
      <button aria-label={t('productDetail.header.back', { defaultValue: '뒤로가기' })} className={btnClass} onClick={handleBack}>
        <ChevronLeft className="h-[18px] w-[18px] text-gray-900 dark:text-white" />
      </button>
      <div className="flex items-center gap-1.5">
        <button aria-label={t('productDetail.header.share', { defaultValue: '공유' })} className={btnClass} onClick={onShare}>
          <Share2 className="h-4 w-4 text-gray-900 dark:text-white" />
        </button>
        <button aria-label={t('productDetail.header.cart', { defaultValue: '장바구니' })} className={btnClass} onClick={() => navigate('/cart')}>
          <ShoppingBag className="h-4 w-4 text-gray-900 dark:text-white" />
        </button>
      </div>
    </header>
  )
}
