/**
 * 🛡️ 2026-05-20: 홈 공구 피드 카드 (당근 2열 + 공구 진행 overlay).
 *
 * 정사각형 이미지 + 좌하단 진행/카테고리 배지 overlay → 당근의 깔끔함 유지하면서
 * 공구 핵심 정보 (현재/목표 인원 + 마감 시간) 한눈에.
 */

import { memo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatNumber } from '@/utils/format'
import { safeDate } from '@/utils/safe-date'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { cardGradient } from '@/utils/card-gradient'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { usePrefetchGroupBuyProduct } from '@/hooks/queries'
import FcfsBadge from '@/features/group-buy/FcfsBadge'
import type { FcfsInfo } from '@/features/group-buy/useFcfs'
import type { Product } from './types'

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  meal_voucher:     { emoji: '🍽️', label: '식사' },
  beauty_voucher:   { emoji: '💇', label: '뷰티' },
  stay_voucher:     { emoji: '🏨', label: '숙소' },
  etc_voucher:      { emoji: '🎯', label: '기타' },
  health_voucher:   { emoji: '💪', label: '건강' },
  pet_voucher:      { emoji: '🐶', label: '반려' },
  activity_voucher: { emoji: '🎉', label: '액티비티' },
}

interface FeedCardProduct extends Product {
  group_buy_current?: number
  group_buy_target?: number
  group_buy_status?: string
  expires_at?: string | null
  seller_name?: string
  seller_avatar?: string
  category?: string
  business_address?: string
  discount_rate?: number
  current_price?: number
  original_price?: number
  avg_rating?: number
  review_count?: number
  sold_count?: number
  // 🛡️ 2026-05-21: /api/group-buy/products 의 LEFT JOIN gift_catalog 응답 alias.
  brand_name?: string | null
  brand_icon_url?: string | null
  gc_brand_name?: string | null
  gc_brand_icon_url?: string | null
  gc_goods_type_detail?: string | null
}

// 🛡️ 2026-05-21: 구매 수 사람 친화 포맷 (4 자리 이상 → 만 단위).
function formatSoldCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`
  return String(n)
}

function timeRemaining(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null
  // 🛡️ 2026-06-26 (소비자 감사): safeDate — 사파리가 D1 datetime 을 NaN 으로 파싱하면 'NaN분' 표시. 파싱 보정.
  const t = safeDate(expiresAt)?.getTime()
  if (t == null) return null
  const ms = t - Date.now()
  if (ms <= 0) return '마감'
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days >= 2) return `마감 ${days}일`
  if (hours >= 1) return `마감 ${hours}시간`
  const mins = Math.max(1, Math.floor(ms / 60_000))
  return `마감 ${mins}분`
}

// 🛡️ 2026-05-24 (loading P0): aboveFold prop — 첫 화면 카드는 eager + fetchpriority=high.
//   효과: LCP 단축 (첫 진입 시 카드 이미지 우선 로드, lazy 후순위 카드는 nav 중에 로드).
// 🛡️ 2026-05-27 (loading P1): React.memo — 정렬/카테고리 칩 클릭 시 50카드 reconcile 비용 ↓.
//   sorted array 는 같은 element references 유지 → shallow compare 로 충분.
// 🎯 2026-06-23 (대표 신고 — 홈→상세 첫 진입 시 빈 스피너 깜빡임): 데이터뿐 아니라 상세 페이지
//   CHUNK 도 미리 받아둠 → 첫 클릭에도 Suspense 폴백(PageLoader) 없이 즉시 마운트. 1회 dedupe.
//   App.tsx 의 lazy import 와 동일 모듈 → Vite 가 같은 chunk 로 합침. (additive — 기존 데이터 prefetch 불변)
let _detailChunkPrefetched = false
function prefetchDetailChunk() {
  if (_detailChunkPrefetched) return
  _detailChunkPrefetched = true
  import('@/pages/GroupBuyDetailPage').catch(() => { _detailChunkPrefetched = false })
}

function GroupBuyFeedCard({ p, aboveFold = false, fcfs }: { p: FeedCardProduct; aboveFold?: boolean; fcfs?: FcfsInfo }) {
  // 🛡️ 2026-05-22 Phase 2 (100% 영구): hover / touch 즉시 prefetch → 클릭 시 0ms.
  const prefetch = usePrefetchGroupBuyProduct()

  // 🛡️ 2026-05-27 (loading P0): 모바일 viewport prefetch — touch 보다 1-2초 빠름.
  //   IntersectionObserver 로 카드가 viewport 에 들어오면 자동 prefetch.
  //   효과: 사용자가 스크롤로 카드를 보기만 해도 detail 데이터 미리 받아두기 → 클릭 시 0ms.
  //   aboveFold 카드는 즉시 prefetch (observer 없이) — 메인 페이지 진입 시 즉시.
  const linkRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (aboveFold) { prefetch(p.id); prefetchDetailChunk(); return }
    const el = linkRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            prefetch(p.id)
            prefetchDetailChunk()
            obs.disconnect()
            break
          }
        }
      },
      // 🛡️ 2026-05-27 (트래픽 절감): 200px → 100px. 익명/짧은 체류 사용자가 안 본 카드 prefetch 회피.
      //   100px = 모바일 약 화면 1/6, 일반 스크롤 속도에서 충분히 미리 받음.
      { rootMargin: '100px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [aboveFold, p.id, prefetch])

  // 🛡️ 2026-05-21: brand 정보 — gift_catalog (gc_*) 우선 → products → 없음.
  const brandName = p.brand_name || p.gc_brand_name || null
  const brandIcon = p.brand_icon_url || p.gc_brand_icon_url || null
  // 카테고리도 동일 — voucher 면 gc.goods_type_detail 사용.
  const rawCategory = p.category && p.category !== 'voucher' ? p.category : (p.gc_goods_type_detail || p.category || 'etc_voucher')
  const cat = CATEGORY_META[rawCategory] || { emoji: '🎁', label: rawCategory }
  const price = p.current_price ?? p.price ?? 0
  const originalPrice = p.original_price ?? 0
  // 할인율 계산 (있는 값 우선, 없으면 직접 계산).
  const discount = p.discount_rate ?? (
    originalPrice > price && originalPrice > 0
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0
  )
  const rating = p.avg_rating ?? 0
  const soldCount = p.sold_count ?? 0
  const remaining = timeRemaining(p.expires_at)
  const isUrgent = remaining && (remaining.includes('시간') || remaining.includes('분'))
  // 🎨 2026-06-18 (대표 신고 — 홈 공구 카드 그라데이션 사라짐): /group-buy 와 동일한 cardGradient 룩 복원.
  //   대표색 단색 카드 + 사진 하단 같은색 번짐 + 대비 글자색. (GroupBuyGridCard 와 정합)
  const [cardColor, setCardColor] = useState<string | null>(p.dominant_color || null)
  const grad = cardGradient(cardColor)

  return (
    <Link
      ref={linkRef}
      to={`/group-buy/${p.id}`}
      onMouseEnter={() => { prefetch(p.id); prefetchDetailChunk() }}
      onTouchStart={() => { prefetch(p.id); prefetchDetailChunk() }}
      onFocus={() => { prefetch(p.id); prefetchDetailChunk() }}
      className="block group active:scale-[0.98] transition-transform rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: grad.base }}
    >
      {/* 🎨 대표색 카드 + 사진 하단 같은색 번짐(그라데이션) — /group-buy GroupBuyGridCard 와 동일 룩 */}
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ backgroundColor: grad.base }}
      >
        {p.image_url ? (
          <img
            // 🛡️ 2026-05-22 perf: Cloudflare Image Resizing (300px base, 1x/2x DPI).
            //   원본 1000px+ 다운로드 → 300-600px WebP/AVIF 자동 변환 (50-80% 트래픽 절감).
            // 🛡️ 2026-05-28 (사용자 보고 — 흐림): 200 → 300px.
            //   이전: 카드 영역 PC 320-400px 인데 src 200px → 1.5x stretched (흐림).
            //   변경: 300px → PC 정확 매칭, 모바일 50vw (207px) 도 약간 high-res.
            //   트래픽: 200→300 = 약 +50KB/카드. 단 cf-image WebP 변환으로 net 영향 작음.
            src={cfImage(p.image_url, { width: 300, format: 'auto' }) || p.image_url}
            srcSet={cfSrcSet(p.image_url, 300) || undefined}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
            alt={p.name || cat.label}
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
            style={{ opacity: aboveFold ? 1 : 0, transition: 'opacity 200ms ease-out' }}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl opacity-40">{cat.emoji}</span>
          </div>
        )}

        {/* 사진 하단 → 같은 카드색으로 번짐 (경계 제거) */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ background: grad.imageFade }} />

        {/* 마감 임박 배지 (시간/분 단위면 좌상단 빨강) */}
        {isUrgent && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-extrabold text-white shadow-sm">
            ⏰ {remaining}
          </span>
        )}

        {/* 🎯 추첨 응모 배지 (우상단) — 결제 없이 응모 → 추첨. 상세에서 응모 가능. */}
        {fcfs && <FcfsBadge info={fcfs} className="absolute top-2 right-2" />}
      </div>

      <div className="px-2.5 pb-2.5 pt-1.5">
        {/* 브랜드 (gift_catalog) — 있을 때만 */}
        {brandName && (
          <p className="flex items-center gap-1 text-[10px] leading-none mb-0.5" style={{ color: grad.sub }}>
            {brandIcon && <img src={brandIcon} alt="" className="w-3 h-3 rounded-full object-contain" loading="lazy" />}
            <span className="truncate">{brandName}</span>
          </p>
        )}

        {/* 원가 strikethrough (있을 때만) */}
        {originalPrice > price && originalPrice > 0 && (
          <p className="text-[11px] line-through leading-tight" style={{ color: grad.sub }}>
            {formatNumber(originalPrice)}원
          </p>
        )}

        {/* 제목 — 2줄 max */}
        <p className="text-[13px] font-semibold line-clamp-2 leading-tight mt-0.5" style={{ color: grad.text }}>
          {p.name}
        </p>

        {/* 할인% + 최종가 — 핵심 강조 */}
        <p className="flex items-baseline gap-1 mt-1">
          {discount > 0 && (
            <span className="text-[15px] font-extrabold" style={{ color: grad.accent }}>{discount}%</span>
          )}
          <span className="text-[15px] font-extrabold" style={{ color: grad.text }}>
            {formatNumber(price)}원
          </span>
        </p>

        {/* ⭐ 평점 + 구매수 */}
        {(rating > 0 || soldCount > 0) && (
          <p className="flex items-center gap-1.5 mt-0.5 text-[11px]" style={{ color: grad.sub }}>
            {rating > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="text-yellow-500">★</span>
                <span className="font-bold" style={{ color: grad.text }}>{rating.toFixed(1)}</span>
              </span>
            )}
            {soldCount > 0 && (
              <span>구매 {formatSoldCount(soldCount)}</span>
            )}
          </p>
        )}
      </div>
    </Link>
  )
}

export default memo(GroupBuyFeedCard)
