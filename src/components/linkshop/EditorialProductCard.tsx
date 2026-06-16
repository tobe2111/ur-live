import React, { useState } from 'react'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { cardGradient } from '@/utils/card-gradient'
import { extractDominantColor } from '@/utils/dominant-color'

/**
 * 🎨 2026-06-16 링크샵 통일 (docs/design/linkshop-unification.md — 2단계 공유 부품)
 *
 * 링크샵 에디토리얼 상품 카드 — **유저 링크샵(핀) / 셀러 링크샵(상품) / 홈탭**이 같은 부품 사용.
 * 흰 카드(다크 대응) + 좌상단 순번 코너플래그(선택) + 다크네이비 할인칩 + 초록 절약액 + coral-rule 인용(선택).
 * 순수 렌더 — 결제/라이브/적립 로직 무관. 이미지 perf 속성(cfImage/cfSrcSet/sizes/loading/dominant)은 loading lock 준수.
 *
 * 가격 표기: "1,234원" (셀러·동네딜·group-buy 와 통일 — 기존 PinCard 의 "₩1,234" 에서 통일).
 */

export interface LinkshopCardProduct {
  id: number
  name: string
  price: number
  original_price?: number | null
  image?: string | null
  dominant_color?: string | null
}

interface EditorialProductCardProps {
  product: LinkshopCardProduct
  /** SPA <a href> 링크 (핀: /u/:handle/p/:id) — onClick 과 택일 */
  href?: string
  /** 버튼 onClick (셀러: navigate(/products/:id)) — href 와 택일 */
  onClick?: () => void
  /** 'hero' = 풀폭 #1 강추(16:9, 통합 가격칩, 카테고리/인용 본문). 기본 'standard'. */
  variant?: 'standard' | 'hero'
  /** standard 카드 비율 — 셀러='square', 핀='3by2'. hero 는 항상 16:9. */
  aspect?: 'square' | '3by2'
  imgWidth?: number
  sizes?: string
  aboveFold?: boolean
  /** 좌상단 큐레이션 순번(1-based). 주면 코너플래그 노출(핀 전용). */
  rank?: number
  /** 추천 코멘트(인용) — 핀 전용. */
  note?: string | null
  curatorName?: string
  curatorAvatar?: string | null
  /** hero 카테고리 라벨('동네딜'|'상품') — 핀 hero 전용. */
  heroCatLabel?: string
  /** 링크 외부(카드 모서리)에 그릴 소유자 컨트롤 — 예: 핀 삭제 버튼. */
  overlay?: React.ReactNode
  /** <img> 로드 시 추출한 대표색 콜백 — 핀이 setColor + reportDominantColor 에 사용. */
  onColor?: (hex: string) => void
  /** 제목/가격 텍스트 색 override (기본: text-[#141A2E] dark:text-white). */
  textClass?: string
  /** 할인% override — 셀러는 p.discount_rate 우선. 미지정 시 original_price/price 로 계산. */
  discountPct?: number
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

export default function EditorialProductCard({
  product, href, onClick, variant = 'standard', aspect = '3by2', imgWidth,
  sizes, aboveFold = false, rank, note, curatorName, curatorAvatar, heroCatLabel,
  overlay, onColor, textClass, discountPct: discountPctProp,
}: EditorialProductCardProps) {
  const hero = variant === 'hero'
  const img = product.image || ''
  const [imgError, setImgError] = useState(false)
  const [color, setColor] = useState<string | null>(product.dominant_color || null)
  const grad = cardGradient(color)
  const txt = textClass || 'text-[#141A2E] dark:text-white'

  const hasDeal = !!product.original_price && (product.original_price as number) > product.price
  const discountPct = discountPctProp != null ? discountPctProp : (hasDeal ? Math.round((1 - product.price / (product.original_price as number)) * 100) : 0)
  const savings = hasDeal ? (product.original_price as number) - product.price : 0
  const width = imgWidth || (hero ? 640 : aspect === 'square' ? 300 : 200)
  const linkClass = 'block rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] active:scale-[0.98] transition-transform'

  const imageArea = (
    <div
      className={`relative ${hero ? 'aspect-[16/9]' : aspect === 'square' ? 'aspect-square' : 'aspect-[3/2]'}`}
      style={{ backgroundColor: grad.base }}
    >
      {rank != null && (
        <span className={`absolute top-0 left-0 z-10 px-1.5 bg-[#FF5634] text-white font-extrabold flex items-center justify-center rounded-br-[11px] ${hero ? 'min-w-[2rem] h-8 text-[17px]' : 'min-w-[1.5rem] h-6 text-[13px]'}`}>
          {rank}
        </span>
      )}
      {img && !imgError ? (
        <img
          src={cfImage(img, { width, format: 'auto' }) || img}
          srcSet={cfSrcSet(img, width) || undefined}
          sizes={sizes || (hero ? '(max-width: 768px) 100vw, 720px' : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px')}
          alt={product.name}
          loading={aboveFold ? 'eager' : 'lazy'}
          fetchPriority={aboveFold ? 'high' : 'auto'}
          decoding="async"
          style={{ opacity: 0, transition: 'opacity 200ms ease-out' }}
          onLoad={(e) => {
            const el = e.currentTarget as HTMLImageElement
            el.style.opacity = '1'
            if (onColor) {
              const c = extractDominantColor(el)
              if (c) { if (!color) setColor(c); onColor(c) }
            }
          }}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: grad.sub }}>no image</div>
      )}
      {hero ? (
        <div className="absolute bottom-2.5 left-2.5 z-10 flex items-baseline gap-1.5 px-2.5 py-1 rounded-[10px] bg-[#141A2E]/92 backdrop-blur">
          {discountPct > 0 && <span className="text-[17px] font-extrabold text-[#FF7A5C]">{discountPct}%</span>}
          {hasDeal && <span className="text-[11px] line-through text-white/50">{(product.original_price as number).toLocaleString('ko-KR')}</span>}
          <span className="text-[14px] font-extrabold text-white">{won(product.price)}</span>
        </div>
      ) : (
        discountPct > 0 && (
          <span className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-[#141A2E]/90 text-[#FF7A5C] text-[12px] font-extrabold backdrop-blur">
            {discountPct}%
          </span>
        )
      )}
    </div>
  )

  const body = hero ? (
    <div className="p-3.5">
      <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#FF5634]">강력 추천 · {heroCatLabel || '상품'}</span>
      <div className="mt-1.5 flex items-start justify-between gap-2.5">
        <p className={`text-[16px] font-bold leading-snug line-clamp-2 ${txt}`}>{product.name}</p>
        {savings > 0 && (
          <span className="shrink-0 mt-0.5 text-[12px] font-extrabold text-[#0E9F6E]">{won(savings)}<span className="font-semibold opacity-70"> 절약</span></span>
        )}
      </div>
      {note && (
        <div className="mt-3 pl-3 border-l-[2.5px] border-[#FF5634]">
          <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">“{note}”</p>
          {(curatorName || curatorAvatar) && (
            <div className="mt-2 flex items-center gap-1.5">
              {curatorAvatar
                ? <img src={cfImage(curatorAvatar, { width: 40, format: 'auto' }) || curatorAvatar} alt="" className="w-5 h-5 rounded-full object-cover" loading="lazy" decoding="async" />
                : <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-300 to-gray-400" />}
              {curatorName && <span className="text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">{curatorName}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className="p-2.5">
      <p className={`text-[13px] font-bold leading-tight line-clamp-2 ${txt}`}>{product.name}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
        {hasDeal && (
          <span className="text-[11px] line-through text-gray-400 dark:text-gray-500">{(product.original_price as number).toLocaleString('ko-KR')}원</span>
        )}
        <span className={`text-[15px] font-extrabold ${txt}`}>{won(product.price)}</span>
        {savings > 0 && (
          <span className="ml-auto text-[11px] font-extrabold text-[#0E9F6E]">{won(savings)}<span className="font-semibold opacity-70"> 절약</span></span>
        )}
      </div>
      {note && (
        <div className="mt-2 pl-2 border-l-2 border-[#FF5634]">
          <p className="text-[11.5px] leading-snug line-clamp-2 text-gray-700 dark:text-gray-300">{note}</p>
        </div>
      )}
    </div>
  )

  return (
    <div className={`relative group ${hero ? 'col-span-2 sm:col-span-3' : ''}`}>
      {href ? (
        <a href={href} className={linkClass}>{imageArea}{body}</a>
      ) : (
        <button type="button" onClick={onClick} className={`${linkClass} text-left w-full`}>{imageArea}{body}</button>
      )}
      {overlay}
    </div>
  )
}
