/**
 * 🛡️ 2026-06-01 (loading): 상품 카드 React.memo — 필터/정렬/무한스크롤 append 시 부모 재렌더로
 *   전체 카드 재조정되던 것을 차단. interested 는 per-card boolean(Set 아님) → 토글한 카드만 재렌더.
 *   GroupBuyFeedCard 패턴과 동일. SSR(__SSR_INITIAL_BROWSE__)/이미지속성/데이터 불변(순수 렌더 래퍼).
 * 🧭 2026-06-10 (사용자 요청 — 홈 상품 레일도 쇼핑 카드 그대로): BrowsePage 인라인 정의를
 *   이 파일로 추출(코드 동일). 홈 레일용으로 isMealVoucher/interested/onToggleInterest 만
 *   optional 기본값 처리 — BrowsePage 호출부/렌더 결과는 불변.
 */
import { useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, ImageOff } from 'lucide-react'
import { formatPrice } from '@/utils/currency'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { cardGradient } from '@/utils/card-gradient'
import { usePrefetchProduct } from '@/hooks/usePrefetchProduct'
import type { Product } from './types'

const BrowseProductCard = memo(function BrowseProductCard({
  product, aboveFold, isMealVoucher = false, interested = false, onToggleInterest, to,
}: {
  product: Product
  aboveFold: boolean
  isMealVoucher?: boolean
  interested?: boolean
  onToggleInterest?: (e: React.MouseEvent, productId: number, productName: string | undefined, currentlyInterested: boolean) => void
  // 🔗 2026-06-17 [LOADING_ADDITIVE] (링크샵 카드 통일): 네비 목적지 override(링크샵 핀 redirect URL 등).
  //   미지정 시 기존과 동일하게 /products/:id. memo/이미지 속성/prefetch 동작 불변(추가만).
  to?: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const prefetchProduct = usePrefetchProduct()
  const discountRate = product.discount_rate || (product.original_price ? Math.round((1 - product.price / product.original_price) * 100) : 0)
  const displayPrice = product.current_price || product.price
  const hasStrike = !!(product.original_price && product.original_price > displayPrice)
  const rating = (product as { avg_rating?: number }).avg_rating ?? 0
  const reviewCount = Number((product as { review_count?: number }).review_count ?? 0)
  const soldCount = product.sold_count ?? 0
  const soldLabel = soldCount >= 10000 ? `${(soldCount / 10000).toFixed(1)}만` : soldCount.toLocaleString('ko-KR')
  // 🏭 2026-06-04 (사용자 요청): 대표색 단색 카드 — 사진이 같은 색으로 번져 텍스트 블록과 경계 없이 이어짐.
  //   서버 dominant_color 없으면 이미지 로드 즉시 추출해 이 카드에 바로 적용(검정 fallback 방지).
  const [cardColor, setCardColor] = useState<string | null>(product.dominant_color || null)
  // 🏭 2026-06-05 (사용자 신고 — 깨진 이미지가 빈 카드로): onError 폴백(없으면 깨진 아이콘/빈칸).
  const [imgError, setImgError] = useState(false)
  const grad = cardGradient(cardColor)
  return (
    <button
      onClick={() => navigate(to ?? `/products/${product.id}`)}
      onMouseEnter={() => prefetchProduct(product.id)}
      onTouchStart={() => prefetchProduct(product.id)}
      onFocus={() => prefetchProduct(product.id)}
      className="ur-cv-card text-left active:scale-[0.98] transition-transform w-full flex flex-col h-full rounded-2xl overflow-hidden"
      style={{ backgroundColor: grad.base }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ backgroundColor: grad.base }}
      >
        {product.image_url && !imgError ? (
          <img
            src={cfImage(product.image_url, { width: 300, format: 'auto' }) || product.image_url}
            srcSet={cfSrcSet(product.image_url, 300) || undefined}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
            alt={product.name || t('browse.altProduct')}
            width={300}
            height={300}
            className="w-full h-full object-cover"
            loading={aboveFold ? 'eager' : 'lazy'}
            fetchPriority={aboveFold ? 'high' : 'auto'}
            decoding="async"
            onLoad={(e) => {
              const color = extractDominantColor(e.currentTarget as HTMLImageElement)
              if (color) {
                if (!cardColor) setCardColor(color)
                if (!product.dominant_color) reportDominantColor(product.id, color)
              }
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="w-8 h-8" style={{ color: grad.sub }} />
          </div>
        )}
        {/* 사진 하단 → 같은 카드색으로 번짐 (경계 제거) */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ background: grad.imageFade }} />
        {isMealVoucher && (
          <span className="absolute bottom-1.5 right-1.5 rounded-full p-1.5 bg-white/85 dark:bg-[#0A0A0A]/85 backdrop-blur-sm">
            <Bell
              onClick={(e: React.MouseEvent) => onToggleInterest?.(e, product.id, product.name, interested)}
              className={`w-3 h-3 ${interested ? 'text-gray-900 fill-gray-900 dark:text-white dark:fill-white' : 'text-gray-300 dark:text-gray-600'}`}
            />
          </span>
        )}
      </div>

      <div className="px-2.5 pt-1 pb-2.5 flex flex-col flex-1" style={{ color: grad.text }}>
        <p className="text-[13px] leading-tight line-clamp-2 font-medium">{product.name}</p>
        <p className="text-[11px] mt-0.5 leading-none line-through" style={{ color: grad.sub, visibility: hasStrike ? 'visible' : 'hidden' }}>
          {hasStrike ? formatPrice(product.original_price!, { dealOnly: product.deal_only }) : ' '}
        </p>
        <div className="flex items-baseline gap-1 mt-0.5">
          {discountRate > 0 && (
            <span className="text-[15px] font-extrabold" style={{ color: grad.accent }}>{discountRate}%</span>
          )}
          <span className="text-[15px] font-extrabold">{formatPrice(displayPrice, { dealOnly: product.deal_only })}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: grad.sub }}>
          <span className="inline-flex items-center gap-0.5">
            <span style={{ color: '#facc15' }}>★</span>
            {rating > 0 ? (
              <span className="font-bold" style={{ color: grad.text }}>{rating.toFixed(1)}</span>
            ) : (
              <span className="font-semibold">신규</span>
            )}
            {reviewCount > 0 && <span>({reviewCount})</span>}
          </span>
          {soldCount > 0 && <span>구매 {soldLabel}</span>}
        </div>
      </div>
    </button>
  )
})

export default BrowseProductCard
