/**
 * 🛍️ 쇼핑 카드 — **격자 형태의 SSOT(`GroupBuyFeedCard`)에 얹는 얇은 어댑터** (2026-09-03)
 *
 *   대표 질문: *"이런 이용권들 디자인이 왜 통합적으로 관리가 안되는거지?"*
 *   실측 답의 절반이 이 파일이었다. 격자 카드가 **두 벌**이었다 —
 *     · 딜/이용권 = `GroupBuyFeedCard` (09-02 표면 체계: 흰 바탕, 사진 아래 잉크 글자)
 *     · 쇼핑      = 이 파일 (2026-06-04 의 **대표색 단색 카드**: 카드 배경이 상품 색으로 칠해지고
 *                   사진 하단 42%가 같은 색으로 번지며 글자색까지 그 색에서 계산됨)
 *   9-02 표면 개편은 앞의 것만 지나갔다. 뒤의 것이 지금 렌더되는 자리가 전부
 *   숨김·미사용 표면(쇼핑탭 `SHOPPING_TAB_HIDDEN` · `MainHomePage` 는 참조 0)이라 아무도 못 봤다.
 *   ⇒ 쇼핑을 다시 열면 그 순간 옛 룩이 같이 살아난다. 그래서 **지금** 한 벌로 접는다.
 *
 *   호출부(BrowsePage · VouchersPage 쇼핑 그리드 · HomeProductsRail)의 props 는 그대로다.
 *   `ur-cv-card`(content-visibility) 도 래퍼로 승계 — 목록 스크롤 비용 불변.
 */
import { memo } from 'react'
import { Bell } from 'lucide-react'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import type { Product } from './types'

const BrowseProductCard = memo(function BrowseProductCard({
  product, aboveFold, isMealVoucher = false, interested = false, onToggleInterest, to,
}: {
  product: Product
  aboveFold: boolean
  isMealVoucher?: boolean
  interested?: boolean
  onToggleInterest?: (e: React.MouseEvent, productId: number, productName: string | undefined, currentlyInterested: boolean) => void
  // 🔗 2026-06-17 [LOADING_ADDITIVE] (유어샵 카드 통일): 네비 목적지 override(유어샵 핀 redirect URL 등).
  to?: string
  /** @deprecated 대표색 카드가 사라져 쓰이지 않는다 — 호출부 호환용으로만 남긴다. */
  fallbackColor?: string
}) {
  return (
    <GroupBuyFeedCard
      p={product as never}
      aboveFold={aboveFold}
      to={to ?? `/products/${product.id}`}
      className="ur-cv-card"
      imgWidth={300}
      /* 🔔 이용권 오픈 알림 — 쇼핑 그리드의 '식사 이용권' 모드에서만 뜨는 액션.
         찜 하트와 자리가 겹치므로 하트를 내리고 이 벨이 그 자리를 쓴다. */
      hideWishlist={isMealVoucher}
      overlayExtra={isMealVoucher ? (
        <span className="absolute top-2 right-2 z-[3] rounded-full p-1.5 bg-white/85 dark:bg-[#11141C]/85 backdrop-blur-sm">
          <Bell
            onClick={(e: React.MouseEvent) => { e.preventDefault(); onToggleInterest?.(e, product.id, product.name, interested) }}
            className={`w-3 h-3 ${interested ? 'text-gray-900 fill-gray-900 dark:text-white dark:fill-white' : 'text-gray-300 dark:text-gray-600'}`}
          />
        </span>
      ) : undefined}
    />
  )
})

export default BrowseProductCard
