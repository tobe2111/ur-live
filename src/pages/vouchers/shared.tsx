/**
 * 🖥️ 2026-07-18 (교환권 PC 2단 분리): VouchersPage god 파일화 방지 — 공용 교환권 카드/행 + 타입을
 *   별도 파일로 추출(파일크기 래칫 준수). 모바일(VoucherRow)·홈/PC 그리드(VoucherCard)가 공유.
 *   ⚠️ 이미지 속성(width/height/srcSet/lazy/fetchPriority/dominant_color)·React.memo·onLoad 색추출 전부
 *   보존(잠금 로딩 최적화) — 이동만, 로직 byte-불변.
 */
import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { usePrefetchGroupBuyProduct } from '@/hooks/queries'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'

export interface VoucherProduct {
  id: number
  name: string
  price: number
  original_price?: number
  discount_rate?: number
  image_url?: string
  brand_name?: string | null
  brand_icon_url?: string | null
  category?: string | null
  sold_count?: number
  avg_rating?: number
  review_count?: number
  dominant_color?: string | null
}

// 🛡️ 2026-06-01 (loading): 피드 카드 React.memo — 부모(스크롤 reveal/잔액 등) 재렌더 시 전체 카드
//   재조정 방지. GroupBuyFeedCard/ReelCard 와 동일 패턴. 데이터/SSR/정렬/이미지속성 불변(순수 렌더 래퍼).
//   props 는 p + aboveFold 만(둘 다 스크롤에 불변) → shallow compare 로 카드 재렌더 0.
export const VoucherCard = memo(function VoucherCard({ p, aboveFold }: { p: VoucherProduct; aboveFold: boolean }) {
  const navigate = useNavigate()
  const prefetchProduct = usePrefetchGroupBuyProduct()  // 🚑 2026-07-10: /vouchers/:id 와 동일 키·엔드포인트
  const hasStrike = !!p.original_price && p.original_price > p.price
  const discountRate = hasStrike
    ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100)
    : (p.discount_rate || 0)
  // 🎫 2026-06-21 (대표 요청): 교환권은 리뷰/별점 미표시 — 구매수(소셜 proof)만.
  const soldCount = Number(p.sold_count || 0)
  const soldLabel = soldCount >= 10000
    ? `${(soldCount / 10000).toFixed(1).replace(/\.0$/, '')}만`
    : soldCount >= 1000
    ? `${(soldCount / 1000).toFixed(1).replace(/\.0$/, '')}천`
    : String(soldCount)
  const [cardColor, setCardColor] = useState<string | null>(p.dominant_color || null)
  const [imgError, setImgError] = useState(false)
  return (
    <button
      type="button"
      onClick={() => navigate(`/vouchers/${p.id}`)}
      onMouseEnter={() => prefetchProduct(p.id)}
      onTouchStart={() => prefetchProduct(p.id)}
      onFocus={() => prefetchProduct(p.id)}
      className="ur-cv-card text-left active:scale-[0.98] transition-transform w-full flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-[#1A2334] border border-gray-100 dark:border-[#2A3446]"
    >
      {/* 🎨 이미지 영역 — 상세와 동톤(은은한 그라데이션). dominant_color 있으면 로딩 플레이스홀더로(잠금). */}
      <div
        className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-[#F7F8FA] to-[#EFF1F4] dark:from-[#15171C] dark:to-[#0F1115]"
        style={cardColor ? { backgroundColor: cardColor } : undefined}
      >
        {p.image_url && !imgError ? (
          <img
            src={cfImage(p.image_url, { width: 300, format: 'auto' }) || p.image_url}
            srcSet={cfSrcSet(p.image_url, 300) || undefined}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
            alt={p.name}
            width={300}
            height={300}
            loading={aboveFold ? 'eager' : 'lazy'}
            fetchPriority={aboveFold ? 'high' : 'auto'}
            decoding="async"
            onLoad={(e) => {
              const el = e.currentTarget as HTMLImageElement
              el.style.opacity = '1'
              const color = extractDominantColor(el)
              if (color) {
                if (!cardColor) setCardColor(color)
                if (!p.dominant_color) reportDominantColor(p.id, color)
              }
            }}
            onError={() => setImgError(true)}
            style={{ opacity: aboveFold ? 1 : 0, transition: 'opacity 200ms ease-out' }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-300 dark:text-gray-600">
            <Gift className="w-10 h-10" />
            {p.brand_name && <span className="text-[11px] font-bold">{p.brand_name}</span>}
          </div>
        )}
        {/* 🎨 할인 배지 — 잘 보이게 딜 코랄레드 (대표 신고 "할인 % 나와야지"). */}
        {discountRate > 0 && (
          <span className="absolute top-2 left-2 text-[11px] font-extrabold text-white bg-brand rounded-md px-1.5 py-0.5">{discountRate}%</span>
        )}
      </div>
      {/* 🎨 본문 — 클린 화이트(다크 토글 대응). 잉크 가격 강조 + 뉴트럴 메타. 컴팩트(별점 제거·여백 축소). */}
      <div className="px-2.5 pt-1.5 pb-2 flex flex-col flex-1">
        {p.brand_name && (
          <p className="text-[11px] font-semibold leading-none mb-0.5 text-gray-400 dark:text-gray-500">{p.brand_name}</p>
        )}
        <p className="text-[13px] leading-tight line-clamp-2 font-medium text-gray-800 dark:text-gray-100">{p.name}</p>
        <div className="flex items-baseline gap-1 mt-1">
          {/* 🖥️ 2026-07-16 (대표 — 할인 % 나와야지): 가격 옆에 할인율 코랄레드로 명시. */}
          {discountRate > 0 && (
            <span className="text-[15px] font-extrabold text-brand dark:text-[#EF6E85] tracking-tight">{discountRate}%</span>
          )}
          <span className="text-[16px] font-extrabold text-[#171B24] dark:text-white tracking-tight">{formatNumber(p.price)}</span>
          <span className="text-[12px] font-bold text-[#171B24] dark:text-white">딜</span>
          {hasStrike && (
            <span className="text-[11px] ml-1 leading-none line-through text-gray-300 dark:text-gray-600">{formatNumber(p.original_price!)}딜</span>
          )}
        </div>
        {soldCount > 0 && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">구매 {soldLabel}</p>
        )}
      </div>
    </button>
  )
})

// 🎨 2026-06-20 (사용자 요청): /vouchers 전체 페이지 = 1줄 리스트 행(이미지 왼쪽 + 이름/가격 오른쪽 + 구분선).
//   레퍼런스(매장주문 메뉴)는 "행 포맷"만 참고 — 내용(상품명/브랜드/딜 가격/할인/평점)은 기존 카드와 동일.
//   이미지 속성(width/height/srcSet/lazy/fetchPriority/dominant_color)·React.memo·onLoad 색추출 전부 보존(잠금).
//   홈(embedded)은 계속 그리드(VoucherCard) — 이 행은 비embedded /vouchers 전용(모바일).
export const VoucherRow = memo(function VoucherRow({ p, aboveFold }: { p: VoucherProduct; aboveFold: boolean }) {
  const navigate = useNavigate()
  const prefetchProduct = usePrefetchGroupBuyProduct()  // 🚑 2026-07-10: /vouchers/:id 와 동일 키·엔드포인트
  const hasStrike = !!p.original_price && p.original_price > p.price
  const discountRate = hasStrike
    ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100)
    : (p.discount_rate || 0)
  // 🎫 2026-06-21 (대표 요청): 교환권은 리뷰/별점 미표시 — 구매수만.
  const soldCount = Number(p.sold_count || 0)
  const soldLabel = soldCount >= 10000
    ? `${(soldCount / 10000).toFixed(1).replace(/\.0$/, '')}만`
    : soldCount >= 1000
    ? `${(soldCount / 1000).toFixed(1).replace(/\.0$/, '')}천`
    : String(soldCount)
  const [cardColor, setCardColor] = useState<string | null>(p.dominant_color || null)
  const [imgError, setImgError] = useState(false)
  return (
    <button
      type="button"
      onClick={() => navigate(`/vouchers/${p.id}`)}
      onMouseEnter={() => prefetchProduct(p.id)}
      onTouchStart={() => prefetchProduct(p.id)}
      onFocus={() => prefetchProduct(p.id)}
      className="w-full flex items-center gap-3 text-left py-2.5 border-b border-gray-100 dark:border-[#2A3446] active:opacity-60 transition-opacity"
    >
      {/* 🎨 이미지 — 좌측 정사각 타일(컴팩트 64/72). dominant_color 있으면 로딩 플레이스홀더(잠금).
          ⚠️ img width/height/srcSet/lazy/fetchPriority/dominant_color 속성 불변 — 표시 박스 CSS 크기만 축소. */}
      <div
        className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-[#F7F8FA] to-[#EFF1F4] dark:from-[#15171C] dark:to-[#0F1115]"
        style={cardColor ? { backgroundColor: cardColor } : undefined}
      >
        {p.image_url && !imgError ? (
          <img
            src={cfImage(p.image_url, { width: 240, format: 'auto' }) || p.image_url}
            srcSet={cfSrcSet(p.image_url, 240) || undefined}
            sizes="120px"
            alt={p.name}
            width={240}
            height={240}
            loading={aboveFold ? 'eager' : 'lazy'}
            fetchPriority={aboveFold ? 'high' : 'auto'}
            decoding="async"
            onLoad={(e) => {
              const el = e.currentTarget as HTMLImageElement
              el.style.opacity = '1'
              const color = extractDominantColor(el)
              if (color) {
                if (!cardColor) setCardColor(color)
                if (!p.dominant_color) reportDominantColor(p.id, color)
              }
            }}
            onError={() => setImgError(true)}
            style={{ opacity: aboveFold ? 1 : 0, transition: 'opacity 200ms ease-out' }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-300 dark:text-gray-600">
            <Gift className="w-8 h-8" />
            {p.brand_name && <span className="text-[10px] font-bold px-1 text-center line-clamp-1">{p.brand_name}</span>}
          </div>
        )}
        {/* 🎨 할인 배지 — 브랜드 옐로우(카드와 동일 톤) */}
        {discountRate > 0 && (
          <span className="absolute top-1.5 left-1.5 text-[10px] font-extrabold text-[#171B24] bg-[#d1d5db] rounded px-1 py-0.5">{discountRate}%</span>
        )}
      </div>
      {/* 🎨 본문 — 우측. 브랜드/상품명/가격/구매수 (별점 제거·여백 축소로 행 높이 컴팩트). */}
      <div className="flex-1 min-w-0">
        {p.brand_name && (
          <p className="text-[11px] font-semibold leading-none mb-0.5 text-gray-400 dark:text-gray-500 truncate">{p.brand_name}</p>
        )}
        <p className="text-[14px] leading-snug line-clamp-2 font-bold text-gray-900 dark:text-white">{p.name}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-[17px] font-extrabold text-[#171B24] dark:text-white tracking-tight">{formatNumber(p.price)}</span>
          <span className="text-[12px] font-bold text-[#171B24] dark:text-white">딜</span>
          {hasStrike && (
            <span className="text-[11px] ml-1 leading-none line-through text-gray-300 dark:text-gray-600">{formatNumber(p.original_price!)}딜</span>
          )}
        </div>
        {soldCount > 0 && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">구매 {soldLabel}</p>
        )}
      </div>
    </button>
  )
})

/**
 * 🎁 2026-07-29 브랜드 칩 — PC 레일/모바일 스트립에 **같은 마크업이 두 벌** 있던 것을 하나로.
 *
 * 이 추출로 함께 고친 실측 결함(라이브):
 *   원본 브랜드 로고를 **32×32 로 렌더하면서 원본 그대로** 받고 있었다.
 *   실측 1장 176,870B → 자체 리사이저 경유 5,261B (`cf-resized: internal=ok`, 33배).
 *   교환권 탭의 브랜드 칩은 82개라 전량 스크롤 시 ~1.8MB 가 ~80KB 가 된다.
 *   `cfImage` 는 2026-07-13 에 giftishow 를 cdn-cgi 로 되돌려 놨는데(감사 로그) **이 자리만 안 쓰고 있었다.**
 *   width/height 를 명시해 뒤늦게 도착한 이미지가 칸을 흔들지 않게 한다.
 */
export interface VoucherBrandSummary {
  brand_name: string
  brand_icon_url: string | null
  cnt: number
}

export const BrandChip = memo(function BrandChip({
  brand,
  selected,
  onSelect,
  labelWidthClass = 'max-w-[56px]',
}: {
  brand: VoucherBrandSummary
  selected: boolean
  onSelect: () => void
  /** PC 레일(56px)과 모바일 스트립(60px)의 라벨 폭 차이만 외부에서 지정. */
  labelWidthClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex flex-col items-center gap-1 active:scale-95 transition-transform shrink-0"
    >
      {/* 🎨 2026-06-10: 화이트 로고 타일 — 선택 시 모노크롬 ring + 살짝 확대(로고 본연 색 발색). */}
      <div
        className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center bg-white dark:bg-white border transition-all ${
          selected
            ? 'border-gray-900 dark:border-white ring-2 ring-gray-900 dark:ring-white scale-105 shadow-md'
            : 'border-gray-200 dark:border-white/10 opacity-90'
        }`}
      >
        {brand.brand_icon_url ? (
          <img
            src={cfImage(brand.brand_icon_url, { width: 96, format: 'auto' }) || brand.brand_icon_url}
            alt={brand.brand_name}
            loading="lazy"
            decoding="async"
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
        ) : (
          <span className="text-lg">🎁</span>
        )}
      </div>
      <span
        className={`text-[10px] line-clamp-1 ${labelWidthClass} text-center ${
          selected ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-600 dark:text-gray-400'
        }`}
      >
        {brand.brand_name}
      </span>
    </button>
  )
})
