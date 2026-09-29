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
import { priceDisplay } from '@/shared/price-display'

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
  thumbSize?: 'sm' | 'md' | 'lg'
  /**
   * 썸네일 **왼쪽** 슬롯(순번 등). 사진 위에 얹지 않는다 —
   * 2026-08-31 대표 *"할인율이 사진 안으로 들어가면 안돼"* 와 같은 이유로,
   * 사진의 가장 좋은 자리를 표식이 덮으면 파는 물건이 안 보인다.
   */
  leading?: ReactNode
  className?: string
  onClick?: () => void
  /** hover/touch/focus 즉시 상세 prefetch — 목록→상세 워터폴 방지(잠금 로딩 계약). */
  prefetch?: () => void
}

/** 표면 규칙(09-02): 흰 카드 + `shadow-lift`, 테두리 0, 숫자가 주인공. */
export default memo(function DealRow({
  to, imageUrl, thumb, thumbStyle, thumbClassName = '', eyebrow, title, price, originalPrice,
  unit = '원', discountPct = 0, meta, trailing, thumbSize = 'md', leading, className = '', onClick, prefetch,
}: DealRowProps) {
  const box = thumbSize === 'sm'
    ? 'w-16 h-16'
    : thumbSize === 'lg'
      ? 'w-[76px] h-[76px]'
      : 'w-16 h-16 sm:w-[72px] sm:h-[72px]'
  /**
   * 💸 2026-09-29 — 할인율을 **SSOT** 로 (대표 *"왜이리 세련된 느낌이 없지?"* 진단에서 나온 실제 결함).
   *   종전엔 `discountPct` 를 **그대로** 썼는데 서버 `discount_rate` 가 0 으로 내려오는 상품이 많아
   *   `discountPct > 0` 이 거짓 → 배지가 아예 안 떴다. 라이브 유어샵 실측(2026-09-28):
   *   21,700/26,000 · 35,100/41,000 · 209,000/272,000 — **셋 다 실제로 할인 중인데 화면에 0개**였다.
   *   같은 상품이 홈 카드(`GroupBuyFeedCard`)에선 23% 로 떴다. 홈은 `priceDisplay` 를 쓰고
   *   이 부품만 안 썼기 때문이다 — 화면마다 할인율이 다르면 버그가 아니라 **거짓말**이다.
   *   `priceDisplay` 의 규칙은 `Math.max(선언값, 정가·판매가 계산값)`(2026-08-19 대표 신고의 수습).
   *   ⚠️ 이 값은 **표시 전용**이다. 청구액은 서버가 정하고 결제 경로가 재검증한다.
   */
  const pd = priceDisplay({ price, original_price: originalPrice, discount_rate: discountPct })
  const hasStrike = originalPrice != null && price != null && pd.showOriginal
  const body = (
    <>
      {leading}
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
          <p className="text-[11px] font-semibold leading-none mb-0.5 text-gray-400 dark:text-gray-500 truncate">{eyebrow}</p>
        )}
        <p className="text-[14px] leading-snug line-clamp-2 font-bold text-gray-900 dark:text-white">{title}</p>
        {price != null && (
          <div className="flex items-baseline gap-1 mt-1">
            {pd.discount > 0 && (
              <span className="text-[15px] font-extrabold text-sale tracking-tight">{pd.discount}%</span>
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
              <span className="text-[11px] ml-1 leading-none line-through text-gray-400 dark:text-gray-500">{formatNumber(originalPrice!)}{unit}</span>
            )}
          </div>
        )}
        {meta && <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{meta}</div>}
      </div>
      {trailing}
    </>
  )
  const cls = `w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift active:opacity-60 transition-opacity ${className}`
  const warm = prefetch
    ? { onMouseEnter: prefetch, onTouchStart: prefetch, onFocus: prefetch }
    : undefined
  if (to) return <Link to={to} onClick={onClick} className={cls} {...warm}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls} {...warm}>{body}</button>
  return <div className={cls}>{body}</div>
})
