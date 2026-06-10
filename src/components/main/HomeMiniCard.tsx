/**
 * 🎨 2026-06-10 (사용자 지적 — 홈 미니카드가 그라데이션 디자인 시스템에서 이탈):
 * 쇼핑(BrowseProductCard)/동네딜(GroupBuyGridCard)과 동일한 대표색 그라데이션 미니 카드.
 * 서버 dominant_color → 없으면 이미지 로드 즉시 추출(+백필 보고). 사진 하단이 카드색으로 번짐.
 */
import { useState, memo } from 'react'
import { cfImage } from '@/utils/cf-image'
import { cardGradient } from '@/utils/card-gradient'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'

export default memo(function HomeMiniCard({
  id, imageUrl, title, priceText, dominantColor, onClick,
}: {
  id: number
  imageUrl?: string | null
  title: string
  priceText: string
  dominantColor?: string | null
  onClick: () => void
}) {
  const [cardColor, setCardColor] = useState<string | null>(dominantColor || null)
  const [imgError, setImgError] = useState(false)
  const grad = cardGradient(cardColor)
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl overflow-hidden active:scale-[0.98] transition-transform flex flex-col"
      style={{ backgroundColor: grad.base }}
    >
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: grad.base }}>
        {imageUrl && !imgError ? (
          <img
            src={cfImage(imageUrl, { width: 200, format: 'auto' }) || imageUrl}
            alt={title}
            width={200}
            height={200}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onLoad={(e) => {
              const color = extractDominantColor(e.currentTarget)
              if (color) {
                if (!cardColor) setCardColor(color)
                if (!dominantColor) reportDominantColor(id, color)
              }
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full" />
        )}
        {/* 사진 하단 → 같은 카드색으로 번짐 (본 페이지 카드와 동일) */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ background: grad.imageFade }} />
      </div>
      <div className="px-2 pt-0.5 pb-2" style={{ color: grad.text }}>
        <p className="text-[11px] leading-tight line-clamp-1">{title}</p>
        <p className="text-[12px] font-extrabold mt-0.5">{priceText}</p>
      </div>
    </button>
  )
})
