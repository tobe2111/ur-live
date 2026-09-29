/**
 * 🎫 줄 카드 — 딜 카드 3형태 중 **가로 한 줄** 한 벌 (2026-09-03)
 *
 *   격자는 `GroupBuyFeedCard`, 작은 사각은 `DealMiniCard`, 그리고 이 파일이 줄이다.
 *   그동안 줄 형태는 화면마다 따로 그려져 **같은 딜이 자리마다 다른 그림**이었다:
 *     · `/vouchers` 모바일 목록  → 흰 카드 + 들림 (09-02 에 정리됨)
 *     · 이용권 사용 완료 모달    → `bg-gray-50` 회색 상자
 *     · 동네 페이지 체험단 줄    → 테두리 + `bg-gray-50/60`
 *   09-02 표면 규칙은 "카드 테두리 0 · 흰 표면 + 들림 하나" 인데 셋 중 하나만 지키고 있었다.
 *
 *   ⚠️ `thumb` 슬롯이 있는 이유: `/vouchers` 의 이미지 `<img>` 는 잠금 로딩 계약
 *      (width/height/srcSet/lazy/fetchPriority/dominant_color/onLoad 색추출)을 갖는다.
 *      그 요소를 **그대로 넘겨** 속성 하나 안 바꾸고 표면만 공유한다.
 */
import { memo, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'

export interface DealRowProps {
  /** 링크로 만들 목적지. 없으면 `<div>` 로 렌더(부모가 버튼/폼을 감싸는 경우). */
  to?: string
  imageUrl?: string | null
  /** 잠금 이미지 계약을 가진 화면은 `<img>`(또는 폴백)을 통째로 넘긴다 — 속성 불변. */
  thumb?: ReactNode
  /** 대표색 플레이스홀더 등 썸네일 상자 자체의 스타일(잠금 로딩 계약 승계용). */
  thumbStyle?: CSSProperties
  thumbClassName?: string
  /** 상품명 위 작은 줄 — 브랜드·매장명. */
  eyebrow?: ReactNode
  title: ReactNode
  price?: number | null
  originalPrice?: number | null
  unit?: '원' | '딜'
  discountPct?: number
  /** 제목·가격 아래 한 줄(구매수·마감·소개비 등 화면 고유 정보). */
  meta?: ReactNode
  /** 오른쪽 끝(화살표·버튼). */
  trailing?: ReactNode
  thumbSize?: 'sm' | 'md'
  className?: string
  onClick?: () => void
  /** hover/touch/focus 즉시 상세 prefetch — 목록→상세 워터폴 방지(잠금 로딩 계약). */
  prefetch?: () => void
}

/** 표면 규칙(09-02): 흰 카드 + `shadow-lift`, 테두리 0, 숫자가 주인공. */
export default memo(function DealRow({
  to, imageUrl, thumb, thumbStyle, thumbClassName = '', eyebrow, title, price, originalPrice,
  unit = '원', discountPct = 0, meta, trailing, thumbSize = 'md', className = '', onClick, prefetch,
}: DealRowProps) {
  const box = thumbSize === 'sm'
    ? 'w-16 h-16'
    : 'w-16 h-16 sm:w-[72px] sm:h-[72px]'
  const hasStrike = originalPrice != null && price != null && originalPrice > price
  const body = (
    <>
      <div
        className={`relative ${box} shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-[#222225] ${thumbClassName}`}
        style={thumbStyle}
      >
        {thumb ?? (imageUrl ? (
          <img
            src={cfImage(imageUrl, { width: 240, format: 'auto' }) || imageUrl}
            alt=""
            width={240}
            height={240}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={(e) => cfImageOnError(e.currentTarget, imageUrl)}
          />
        ) : null)}
      </div>
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <p className="text-[12px] font-semibold leading-none mb-1 text-gray-400 dark:text-gray-500 truncate">{eyebrow}</p>
        )}
        <p className="text-[15px] leading-snug line-clamp-2 font-bold text-gray-900 dark:text-white">{title}</p>
        {price != null && (
          <div className="flex items-baseline gap-1 mt-1">
            {discountPct > 0 && (
              <span className="text-[15px] font-extrabold text-sale tracking-tight">{discountPct}%</span>
            )}
            <span className="text-[17px] font-extrabold text-gray-900 dark:text-white tracking-tight">{formatNumber(price)}</span>
            <span className="text-[12px] font-bold text-gray-900 dark:text-white">{unit}</span>
            {hasStrike && (
              /*
               * 🩸 2026-09-28 — 취소선 정가를 **읽을 수 있는 회색**으로 (gray-300/600 → gray-400/500).
               *   유어샵이 이 부품으로 옮겨 온 날 라이브에서 재 보니 정가가 다크 **2.14:1**(라이트 1.50:1)
               *   이었다. 유어샵의 종전 카드는 같은 글자를 5.04:1 로 그렸으니 그 화면엔 **후퇴**였고,
               *   나머지 9개 화면은 원래부터 이 값이었다(= 나 혼자 만든 게 아니라 부품의 값이다).
               *   `check-dark-contrast` 는 이걸 못 봤다 — 그 가드가 목록 화면에서 **빈 껍데기**를 재고
               *   있기 때문이다(결재 `2026-09-28-dark-contrast-guard-coverage.md`).
               *   지금 값: 라이트 3.65:1 · 다크 3.10:1 — 판매가(≈16:1)보다 한참 약해 위계는 그대로다.
               */
              <span className="text-[12px] ml-1 leading-none line-through text-gray-400 dark:text-gray-500">{formatNumber(originalPrice!)}{unit}</span>
            )}
          </div>
        )}
        {meta && <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">{meta}</div>}
      </div>
      {trailing}
    </>
  )
  const cls = `w-full flex items-center gap-3 text-left px-3 py-2 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift active:opacity-60 transition-opacity ${className}`
  const warm = prefetch
    ? { onMouseEnter: prefetch, onTouchStart: prefetch, onFocus: prefetch }
    : undefined
  if (to) return <Link to={to} onClick={onClick} className={cls} {...warm}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls} {...warm}>{body}</button>
  return <div className={cls}>{body}</div>
})
