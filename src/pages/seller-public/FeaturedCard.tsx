/**
 * 🎨 2026-07-07 (대표 승인 리디자인 — "휑함 해소"): 유어샵 대표 상품을 큰 히어로 카드로.
 *   상품/이용권이 1개뿐이어도 "허전"이 아니라 "큐레이션"으로 보이게 — 섹션 첫 아이템을 크게.
 *   이미지 배경 + 하단 veil + 할인 배지 + 위치(이용권) + 가격. 클릭은 /products/:id (또는 to override).
 */
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { seededColor, cardGradient } from '@/utils/card-gradient'
import type { Product } from './types'

export default function FeaturedCard({ product, to, eyebrow }: { product: Product; to?: string; eyebrow?: string }) {
  const navigate = useNavigate()
  const disc = product.discount_rate || (product.original_price && product.original_price > 0
    ? Math.round((1 - (product.price || 0) / product.original_price) * 100) : 0)
  const grad = cardGradient(product.dominant_color || seededColor(product.id))
  return (
    <button
      onClick={() => navigate(to ?? `/products/${product.id}`)}
      className="relative w-full overflow-hidden rounded-[22px] text-left active:scale-[0.99] transition-transform shadow-[0_2px_4px_rgba(20,20,30,.05),0_22px_48px_-18px_rgba(20,20,30,.30)]"
      style={{ aspectRatio: '5 / 4', backgroundColor: grad.base }}
    >
      {product.image_url && (
        <img
          src={cfImage(product.image_url, { width: 640, format: 'auto' }) || product.image_url}
          srcSet={cfSrcSet(product.image_url, 640) || undefined}
          sizes="(max-width: 480px) 100vw, 430px"
          alt={product.name} loading="eager" decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-[center_38%]"
        />
      )}
      {/* 하단 어둡게 — 텍스트 가독(2단 그라데이션: 하단 짙게 + 중간 부드럽게 이어짐, 음식 중앙은 밝게 유지)
          📐 2026-08-17 (UX 전수검사 P1): 밝은 사진(콜라주 등)에서 제목이 묻힘 — 중간 구간 농도 보강(.40→.58). */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(6,6,10,.88) 0%, rgba(6,6,10,.58) 32%, rgba(6,6,10,.12) 58%, transparent 76%)' }} />
      {disc > 0 && (
        <span className="absolute top-3 left-3 rounded-lg bg-[#DE5F27] text-white text-[12px] font-extrabold px-2.5 py-1">{disc}% 할인</span>
      )}
      <div className="absolute left-4 right-4 bottom-4 text-white">
        {eyebrow && <span className="inline-block text-[11px] font-bold tracking-wide text-white/80 mb-1">{eyebrow}</span>}
        {product.restaurant_name && (
          <span className="flex items-center gap-1 text-[12px] font-semibold text-white/90 mb-0.5"><MapPin className="w-3 h-3" />{product.restaurant_name}</span>
        )}
        <h4 className="text-[19px] font-extrabold leading-tight tracking-tight mb-2 line-clamp-2">{product.name}</h4>
        <div className="flex items-baseline gap-2">
          {disc > 0 && <span className="text-[14px] font-extrabold text-[#FFC7A6]">{disc}%</span>}
          <b className="text-[21px] font-extrabold tabular-nums">{formatNumber(product.price || 0)}원</b>
          {product.original_price && product.original_price > (product.price || 0) && (
            <s className="text-[13px] text-white/60">{formatNumber(product.original_price)}원</s>
          )}
        </div>
      </div>
    </button>
  )
}
