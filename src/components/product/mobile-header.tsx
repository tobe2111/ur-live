import { ChevronLeft, Share2 } from 'lucide-react'
import { BagIcon } from '@/components/icons/urdeal-icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import { useSafeBack } from '@/hooks/useSafeBack'

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

  // ← 판정은 useSafeBack 한 곳(referrer 는 바깥을 거쳐 오면 틀리고, '/' 로 push 하면 폰 뒤로가 이 화면으로 되돌아왔다 — 2026-11-03).
  const handleBack = useSafeBack('/')

  const btnClass = "flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-[#11141C]/90 backdrop-blur-md shadow-sm"

  return (
    <header className="absolute top-0 inset-x-0 z-40 flex items-center justify-between px-3" style={{ paddingTop: 12 }}>
      <button aria-label={t('productDetail.header.back', { defaultValue: '뒤로가기' })} className={btnClass} onClick={handleBack}>
        <ChevronLeft className="h-[18px] w-[18px] text-gray-900 dark:text-white" />
      </button>
      <div className="flex items-center gap-2">
        <button aria-label={t('productDetail.header.share', { defaultValue: '공유' })} className={btnClass} onClick={onShare}>
          <Share2 className="h-4 w-4 text-gray-900 dark:text-white" />
        </button>
        <button aria-label={t('productDetail.header.cart', { defaultValue: '장바구니' })} className={btnClass} data-cart-icon onClick={() => navigate('/cart')}>
          <BagIcon className="h-4 w-4 text-gray-900 dark:text-white" />
        </button>
      </div>
    </header>
  )
}
