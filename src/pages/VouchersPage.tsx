/**
 * 🛡️ 2026-05-19: 교환권 (KT Alpha) 전용 페이지 — 카카오 선물하기 스타일.
 *
 * URL: /vouchers
 * 정책:
 *   - 상품 종류 = deal_only=1 (KT Alpha bulk-import 된 교환권)
 *   - 결제 = 딜 (선충전 포인트)
 *   - 카드 디자인 = 브랜드 로고 중심, 노란색 액센트
 *
 * 구조:
 *   1. 브랜드 칩 그리드 (스타벅스/GS25/김밥천국 등) — 클릭 시 ?brand=X 필터
 *   2. 금액권 그리드 (선택 브랜드 또는 전체) — 무한 스크롤
 *   3. 카테고리 탭 (편의점/카페/외식/도서 등) — KT Alpha categories
 */
import { useEffect, useState, useRef, useCallback, useMemo, memo, Fragment } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Gift, Heart, Wallet, Sparkles, Users, ArrowRight, ChevronDown, ShoppingBag } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'
import { getUserIdSync } from '@/utils/auth'
import { usePrefetchProduct } from '@/hooks/usePrefetchProduct'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { SortMenu } from '@/components/ui/sort-menu'
import BrowseProductCard from './browse/BrowseProductCard'
import type { Product } from './browse/types'

// 🛡️ 2026-05-21: 교환권 정렬 옵션 (사용자 요청).
type SortKey = 'popular' | 'newest' | 'price_low' | 'price_high' | 'discount' | 'rating'
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'popular',    label: '🔥 인기순' },
  { key: 'newest',     label: '🆕 최신순' },
  { key: 'price_low',  label: '💰 낮은 가격순' },
  { key: 'price_high', label: '💎 높은 가격순' },
  { key: 'discount',   label: '🏷️ 할인율순' },
  // 🎫 2026-06-21 (대표 요청): 교환권 별점 미표시 → '평점순' 정렬 옵션 제거(숨은 필드 정렬 방지).
]

interface VoucherProduct {
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

interface BrandSummary {
  brand_name: string
  brand_icon_url: string | null
  cnt: number
}

interface CategorySection {
  category: string
  count: number
  brands: BrandSummary[]
}

// 🛡️ 2026-05-19: KT Alpha 카테고리명 → 사용자 친화 이모지 매핑.
//   DB의 category 값 (예: '편의점/마트') 을 그대로 키로 사용. 매핑 없으면 🎁 default.
const CATEGORY_ICONS: Record<string, string> = {
  '편의점/마트': '🏪',
  '편의점': '🏪',
  '마트/슈퍼': '🏪',
  '카페/베이커리': '☕',
  '카페': '☕',
  '베이커리': '🥐',
  '외식/배달': '🍔',
  '외식': '🍔',
  '패스트푸드': '🍟',
  '한식': '🍚',
  '양식': '🍝',
  '치킨/피자': '🍕',
  '치킨': '🍗',
  '피자': '🍕',
  '백화점/쇼핑': '🛍️',
  '백화점': '🛍️',
  '쇼핑': '🛍️',
  '뷰티/패션': '💄',
  '뷰티': '💄',
  '패션': '👗',
  '화장품': '💅',
  '도서/문화': '📚',
  '도서': '📚',
  '문화': '🎭',
  '영화': '🎬',
  '공연': '🎭',
  '모바일/디지털': '📱',
  '모바일상품권': '📱',
  '모바일': '📱',
  '디지털': '💾',
  '게임': '🎮',
  '주유/생활': '⛽',
  '주유': '⛽',
  '생활': '🏠',
  '통신': '📡',
}

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] || '🎁'
}

// 🏭 2026-06-05 (사용자 신고 — 교환권 스크롤해도 상품 다 안 나옴): SSR 주입 슬롯(MAIN/VOUCHERS) 이
//   limit=20 인데 클라 PAGE_SIZE 가 30 이라 hasMore=(20===30)=false → 무한스크롤이 즉시 멈춰 20개만 노출됐고,
//   계속됐어도 page2 가 limit30 offset30 으로 20~29 를 건너뜀. SSR limit 과 동일하게 맞춰 근본 해결.
const PAGE_SIZE = 20

// 🏭 2026-06-04 (사용자 요청): 홈(embedded) 기본 카테고리 = '커피/음료' (KT Alpha goods_type_detail).
//   worker/index.ts MAIN 슬롯 + cache-prewarm HOT_PATH 의 category 값과 반드시 동일해야 SSR 0-RTT 정합.
const EMBEDDED_DEFAULT_CATEGORY = '커피/음료'

// 🛡️ 2026-06-01 (loading): 피드 카드 React.memo — 부모(스크롤 reveal/잔액 등) 재렌더 시 전체 카드
//   재조정 방지. GroupBuyFeedCard/ReelCard 와 동일 패턴. 데이터/SSR/정렬/이미지속성 불변(순수 렌더 래퍼).
//   props 는 p + aboveFold 만(둘 다 스크롤에 불변) → shallow compare 로 카드 재렌더 0.
const VoucherCard = memo(function VoucherCard({ p, aboveFold }: { p: VoucherProduct; aboveFold: boolean }) {
  const navigate = useNavigate()
  const prefetchProduct = usePrefetchProduct()
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
  // 🎨 2026-06-17 (교환권 상세와 같은 톤): dominant_color 는 이미지 로딩 플레이스홀더로 유지(잠금 보존)
  //   하되, 카드 본문은 상세 페이지처럼 클린 화이트(다크 토글 대응)로. 색 추출/리포트 파이프라인 불변.
  const [cardColor, setCardColor] = useState<string | null>(p.dominant_color || null)
  // 🏭 2026-06-05 (사용자 신고 — 가끔 이미지가 깨져 빈 회색 카드): 이미지 로드 실패 시 Gift 폴백.
  //   기존엔 onLoad 로만 노출(opacity 0→1)하고 onError 가 없어, 깨진 이미지는 opacity 0 인 채 빈칸으로 남았음.
  const [imgError, setImgError] = useState(false)
  return (
    <button
      type="button"
      onClick={() => navigate(`/vouchers/${p.id}`)}
      onMouseEnter={() => prefetchProduct(p.id)}
      onTouchStart={() => prefetchProduct(p.id)}
      onFocus={() => prefetchProduct(p.id)}
      className="ur-cv-card text-left active:scale-[0.98] transition-transform w-full flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#1A1A1A]"
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
        {/* 🎨 할인 배지 — 브랜드 옐로우(상세 페이지 칩과 동일 톤) */}
        {discountRate > 0 && (
          <span className="absolute top-2 left-2 text-[11px] font-extrabold text-[#171B24] bg-[#d1d5db] rounded-md px-1.5 py-0.5">{discountRate}%</span>
        )}
      </div>
      {/* 🎨 본문 — 클린 화이트(다크 토글 대응). 잉크 가격 강조 + 뉴트럴 메타. 컴팩트(별점 제거·여백 축소). */}
      <div className="px-2.5 pt-1.5 pb-2 flex flex-col flex-1">
        {p.brand_name && (
          <p className="text-[11px] font-semibold leading-none mb-0.5 text-gray-400 dark:text-gray-500">{p.brand_name}</p>
        )}
        <p className="text-[13px] leading-tight line-clamp-2 font-medium text-gray-800 dark:text-gray-100">{p.name}</p>
        <div className="flex items-baseline gap-0.5 mt-1">
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
//   홈(embedded)은 계속 그리드(VoucherCard) — 이 행은 비embedded /vouchers 전용.
const VoucherRow = memo(function VoucherRow({ p, aboveFold }: { p: VoucherProduct; aboveFold: boolean }) {
  const navigate = useNavigate()
  const prefetchProduct = usePrefetchProduct()
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
      className="w-full flex items-center gap-3 text-left py-2.5 border-b border-gray-100 dark:border-[#1A1A1A] active:opacity-60 transition-opacity"
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

// 🛒 2026-06-23 (대표 — '쇼핑도 카테고리 전에 짜뒀잖아' / '카테고리별로 잘 나뉘어졌어?'): /browse 와 동일한 쇼핑 카테고리.
//   ⚠️ key 는 products.category 의 **실제 저장값**(셀러/어드민/CSV 폼 SSOT) — alias 없는 정확일치 필터라 키가 어긋나면 0개.
//   실제 저장값: fashion/beauty/food/electronics/lifestyle. (라벨 '리빙'='lifestyle', '디지털'='electronics'.)
const SHOP_CATEGORIES: Array<{ key: string; label: string; emoji: string }> = [
  { key: 'all',         label: '전체',   emoji: '🛍️' },
  { key: 'food',        label: '식품',   emoji: '🍱' },
  { key: 'fashion',     label: '패션',   emoji: '👗' },
  { key: 'beauty',      label: '뷰티',   emoji: '💄' },
  { key: 'lifestyle',   label: '리빙',   emoji: '🛋️' },
  { key: 'electronics', label: '디지털', emoji: '📱' },
]

// 🛒 2026-06-20 (사용자 결정 — 교환권/쇼핑 상단 탭 분리) → 2026-06-23 연속 스크롤로 전환: 쇼핑 섹션 =
//   일반 상품(exclude_deal_only=1) 그리드. /browse 와 동일 데이터·카드(BrowseProductCard)·카테고리.
//   교환권 더보기 버튼 아래에 이어짐. 카테고리 칩 선택 시 해당 카테고리로 재조회(무한 스크롤 유지).
function ShoppingGrid() {
  const [shopCategory, setShopCategory] = useState('all')
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  // 🛒 2026-06-23 (대표 '적응형 카테고리'): 실제 상품이 있는 카테고리만 칩 노출. null=로딩(전체만), []=조회완료.
  //   /api/products/count(카테고리별, edge 15분 캐시) 병렬 조회 → 0개 카테고리 자동 숨김(인벤토리 적든 많든 깔끔).
  const [availableShopCats, setAvailableShopCats] = useState<string[] | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const load = useCallback((pageNum: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true)
    const params = new URLSearchParams({ page: String(pageNum), limit: '20', exclude_deal_only: '1', sort: 'popular' })
    if (shopCategory !== 'all') params.set('category', shopCategory)
    api.get(`/api/products?${params.toString()}`)
      .then(r => {
        if (r.data?.success) {
          const ni: Product[] = r.data.data || []
          setItems(prev => reset ? ni : [...prev, ...ni])
          setHasMore(ni.length === 20)
          if (reset) setPage(1)
        }
      })
      .catch(() => { /* graceful */ })
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }, [shopCategory])
  // 카테고리 변경(load identity 변경) 시 1페이지부터 리셋 로드.
  useEffect(() => { load(1, true) }, [load])
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore || loading) return
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { const n = page + 1; setPage(n); load(n, false) }
    }, { threshold: 0.1 })
    ob.observe(sentinelRef.current)
    return () => ob.disconnect()
  }, [hasMore, loadingMore, loading, page, load])
  // 🛒 2026-06-23: 카테고리별 상품 수 조회 → 비어있는 카테고리 칩 제거. 마운트 1회(전역 카탈로그 기준).
  //   localStorage 캐시(1h) 우선 → 재진입 0-RTT + '전체→확장' 플래시 방지(교환권 카테고리와 동일 패턴).
  useEffect(() => {
    let cancelled = false
    try {
      const raw = localStorage.getItem('shop_cats_v1')
      if (raw) {
        const cached = JSON.parse(raw) as { ts: number; data: string[] }
        if (Date.now() - cached.ts < 60 * 60_000 && Array.isArray(cached.data)) setAvailableShopCats(cached.data)
      }
    } catch { /* localStorage 손상 — 무시 */ }
    const cats = SHOP_CATEGORIES.filter(c => c.key !== 'all')
    Promise.all(cats.map(c =>
      api.get(`/api/products/count?exclude_deal_only=1&category=${encodeURIComponent(c.key)}`)
        .then(r => (r.data?.success && Number(r.data.total) > 0) ? c.key : null)
        .catch(() => null)
    )).then(results => {
      if (cancelled) return
      const avail = results.filter((k): k is string => !!k)
      setAvailableShopCats(avail)
      try { localStorage.setItem('shop_cats_v1', JSON.stringify({ ts: Date.now(), data: avail })) } catch { /* quota */ }
    })
    return () => { cancelled = true }
  }, [])
  // 노출 칩: 로딩 중(null)엔 '전체'만 → 조회되면 '전체' + 상품 있는 카테고리.
  const visibleShopCats = SHOP_CATEGORIES.filter(c => c.key === 'all' || (availableShopCats?.includes(c.key) ?? false))
  return (
    <div className="pb-4">
      {/* 🛒 2026-06-23 (대표 '가장 이상적으로'): 쇼핑 카테고리 = sticky 바(top-[45px], 탭 바로 아래) —
          쇼핑 섹션에 있는 동안 상단에 따라붙어 어디서든 카테고리 전환 가능. 교환권 reveal 그룹은 이때 숨김(슬롯 공유). */}
      <div className="sticky top-[45px] z-20 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-wide px-4 lg:px-8 py-2.5">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {visibleShopCats.map(c => {
              const active = shopCategory === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setShopCategory(c.key)}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                    active
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                      : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2A2A2A]'
                  }`}
                >
                  <span>{c.emoji}</span>
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="ur-content-wide px-4 lg:px-8 pt-3">
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl overflow-hidden border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#121212]">
              <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A]" />
              <div className="px-2.5 pt-2 pb-2.5">
                <div className="h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded w-3/4" />
                <div className="h-3 mt-2 bg-gray-100 dark:bg-[#1A1A1A] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">쇼핑 상품이 없습니다</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2.5 items-stretch">
            {items.map((p, idx) => (
              <BrowseProductCard key={p.id} product={p} aboveFold={idx < 4} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-4">
            {loadingMore && <div className="text-[11px] text-gray-400 dark:text-gray-500">로드 중...</div>}
            {!hasMore && items.length > 0 && <div className="text-[11px] text-gray-400 dark:text-gray-500">— 마지막 —</div>}
          </div>
        </>
      )}
      </div>
    </div>
  )
}

// 🛡️ 2026-06-01: embedded — 홈(/)에서 교환권 본문을 재사용. SEO/자체헤더 skip + SSR 는 MAIN 슬롯에서 읽음.
export default function VouchersPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-05-24 (loading P0): 카드 hover/touch 시 상품 상세 prefetch.
  const prefetchProduct = usePrefetchProduct()
  const [searchParams, setSearchParams] = useSearchParams()
  const brand = searchParams.get('brand') || ''
  // 🏭 2026-06-04 (사용자 요청): 홈(embedded)은 기본 카테고리를 '커피/음료' 로 — 첫 진입 시 커피 브랜드 먼저.
  //   MAIN SSR 슬롯도 같은 커피 카테고리로 warm → 0-RTT 유지 (worker/index.ts + cache-prewarm).
  const category = searchParams.get('category') || (embedded ? EMBEDDED_DEFAULT_CATEGORY : '')

  // 🎫 2026-06-23 (대표 결정 — '연속 스크롤 + 중앙 스크롤스파이 탭'): 비embedded /vouchers 는 한 페이지에
  //   교환권(상단, ~20개 + 더보기) → 쇼핑(하단 무한)이 이어짐. 상단 [교환권][쇼핑] 탭은 중앙 정렬 +
  //   스크롤 위치 따라 활성 + 클릭 시 해당 섹션으로 점프(콘텐츠 교체/URL 전환 아님). 홈(embedded)은 탭 없음 → 불변.
  const shoppingRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'vouchers' | 'shopping'>('vouchers')
  const goToVouchers = () => { try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { window.scrollTo(0, 0) } }
  const goToShopping = () => shoppingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // 🛡️ 2026-05-19: 카테고리 + 브랜드 2단 구조 — 사용자 요청.
  //   sections = 카테고리별 (편의점/카페/외식 등) + 각 카테고리 내 인기 브랜드 12개.
  //   첫 로드 시 cnt 가장 많은 카테고리 자동 선택. 카테고리 변경 시 브랜드 list 자동 갱신.
  const [sections, setSections] = useState<CategorySection[]>([])
  const [products, setProducts] = useState<VoucherProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  // 🎫 2026-06-23: 교환권 노출 cap 리셋 — 홈 12개 / /vouchers 20개(대표 결정). 카테고리·브랜드 변경 시 초기화.
  useEffect(() => { setEmbedVisible(embedded ? 12 : 20) }, [embedded, category, brand])
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // 🛡️ 2026-05-28 (사용자 요청): 잔액 카드 + 카테고리 scroll-up reveal (headroom).
  //   아래로 내리면 숨고, 살짝 위로 올리면 다시 내려옴 → 맨 위까지 안 올려도 잔액/카테고리 접근.
  const [revealTop, setRevealTop] = useState(true)
  const lastScrollYRef = useRef(0)
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const last = lastScrollYRef.current
        if (y < 120) setRevealTop(true)            // 상단 근처는 항상 표시
        else if (y > last + 6) setRevealTop(false) // 아래로 스크롤 → 숨김
        else if (y < last - 6) setRevealTop(true)  // 위로 스크롤 → 표시
        // 🎫 2026-06-23: 스크롤스파이 — 쇼핑 섹션이 상단 sticky 탭 아래로 올라오면 '쇼핑' 탭 활성.
        const sec = shoppingRef.current
        if (sec) setActiveTab(sec.getBoundingClientRect().top <= 100 ? 'shopping' : 'vouchers')
        lastScrollYRef.current = y
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 🛡️ 2026-05-21: 정렬 옵션 — popular/newest/price_low/price_high/discount/rating.
  //   URL ?sort=... 동기화 — 공유/북마크 가능.
  // 🛡️ 2026-05-27: 사용자 결정 — 교환권 페이지 default sort = price_low (낮은 가격순).
  //   교환권은 동일 상품/브랜드의 가격 비교 UX → 최저가 우선 노출.
  const sort = (searchParams.get('sort') as SortKey) || 'price_low'
  const setSort = (next: SortKey) => {
    const p = new URLSearchParams(searchParams)
    if (next === 'price_low') p.delete('sort')  // default 와 같으면 URL 깔끔하게
    else p.set('sort', next)
    setSearchParams(p, { replace: true })
  }

  // 🛡️ 2026-05-19: 딜 잔액 표시 + 충전/공구 유도 (사용자 요청).
  //   교환권은 딜로만 결제 → 잔액 부족 시 즉시 충전 페이지로 유도.
  //   부족 시 "친구 추천 / 공구 참여" 로 보너스 딜 획득 경로도 안내.
  const [dealBalance, setDealBalance] = useState<number | null>(null)
  const userId = getUserIdSync()
  useEffect(() => {
    if (!userId) { setDealBalance(0); return }
    api.get('/api/points/balance')
      .then(r => {
        if (r.data?.success) {
          setDealBalance(r.data.data?.balance ?? 0)
        }
      })
      // 🛡️ 2026-06-26 (소비자 감사 P1): 일시 오류를 잔액 0(='즉시 충전' 부족 UI)으로 위장하지 않음 —
      //   기존값 유지(잔액 있는 유저에게 '충전하세요' 오표시 방지). 서버는 결제 시 잔액 재검증.
      .catch(() => { /* keep prior balance — do not clobber to 0 on transient error */ })
  }, [userId])

  // 🛡️ 2026-05-19: 카테고리 + 브랜드 sections 로드 (전용 endpoint, deal_only=1 만).
  useEffect(() => {
    let cancelled = false

    // 🛡️ 2026-05-27 (재진입 perf): localStorage cache 우선 — 재진입 시 0 RTT.
    //   카테고리/브랜드 list 는 KT Alpha sync (일 1회) 시점에만 변경 → 1시간 cache 안전.
    //   network fetch 는 background 에서 진행 (cache 비교 후 변경 시 update).
    try {
      const raw = localStorage.getItem('vouchers_categories_v1')
      if (raw) {
        const cached = JSON.parse(raw) as { ts: number; data: CategorySection[] }
        if (Date.now() - cached.ts < 60 * 60_000 && Array.isArray(cached.data)) {
          setSections(cached.data)
          // 🏭 2026-06-04 (flash fix): embedded(홈)에서는 첫 카테고리 자동선택 X.
          //   기존: 홈 SSR(전체 deal) 표시 → JS 가 ?category=첫카테고리 로 교체 → 내용/URL 깜빡임.
          //   embedded 는 category 비워둬 SSR MAIN 즉시표시 유지 + 홈 URL 깨끗('/').
          if (!embedded && !category && !brand && cached.data.length > 0) {
            const next = new URLSearchParams(searchParams)
            next.set('category', cached.data[0].category)
            setSearchParams(next, { replace: true })
          }
        }
      }
    } catch { /* localStorage 손상 — 무시 */ }

    api.get('/api/vouchers/categories').then(r => {
      if (cancelled) return
      if (r.data?.success && Array.isArray(r.data.data)) {
        const list = r.data.data as CategorySection[]
        setSections(list)
        try { localStorage.setItem('vouchers_categories_v1', JSON.stringify({ ts: Date.now(), data: list })) } catch { /* quota */ }
        // 카테고리 URL 미지정 시 첫 카테고리 (인기 ↑) 자동 선택. (embedded 홈은 제외 — flash 방지)
        if (!embedded && !category && !brand && list.length > 0) {
          const next = new URLSearchParams(searchParams)
          next.set('category', list[0].category)
          setSearchParams(next, { replace: true })
        }
      }
    }).catch(() => { /* graceful */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 현재 선택된 카테고리의 브랜드 list.
  const currentSection = sections.find(s => s.category === category)
  const currentBrands = currentSection?.brands || []
  // 🏭 2026-06-04 (사용자 요청): 커피/음료 브랜드 우선순위. 나머지는 원본 순서 유지.
  const orderedBrands = useMemo(() => {
    if (category !== EMBEDDED_DEFAULT_CATEGORY) return currentBrands
    const PRIORITY = ['스타벅스', '메가', '투썸', '할리스', '컴포즈', '빽다방']
    const rank = (name: string) => {
      const i = PRIORITY.findIndex(k => name.includes(k))
      return i === -1 ? PRIORITY.length + 1 : i
    }
    return [...currentBrands]
      .map((b, i) => ({ b, i }))
      .sort((x, y) => rank(x.b.brand_name) - rank(y.b.brand_name) || x.i - y.i)
      .map(x => x.b)
  }, [currentBrands, category])

  // 🏭 2026-06-05 (사용자 신고 — 정렬이 화면에 반영 안 됨): 서버 정렬에 더해 로드된 상품을 클라에서도
  //   한 번 더 정렬 → 캐시/배포 지연과 무관하게 선택한 정렬이 "즉시 보이게". (서버는 페이지 경계 정확성 담당)
  const displayProducts = useMemo(() => {
    const arr = [...products]
    const price = (p: VoucherProduct) => Number(p.price) || 0
    const disc = (p: VoucherProduct) => p.original_price && p.original_price > p.price
      ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
      : (Number(p.discount_rate) || 0)
    switch (sort) {
      case 'price_low': arr.sort((a, b) => price(a) - price(b)); break
      case 'price_high': arr.sort((a, b) => price(b) - price(a)); break
      case 'popular': arr.sort((a, b) => (Number(b.sold_count) || 0) - (Number(a.sold_count) || 0)); break
      case 'rating': arr.sort((a, b) => (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0)); break
      case 'discount': arr.sort((a, b) => disc(b) - disc(a)); break
      case 'newest': arr.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)); break
    }
    return arr
  }, [products, sort])

  // 상품 로드 (페이지 변경 / 필터 변경 시)
  // 🏭 2026-06-05 (사용자 신고 — 정렬이 뒤늦게 반영): 정렬/필터 변경 refetch 가 화면을 스켈레톤으로 비워
  //   "늦게 되는" 느낌. productsRef 로 "이미 상품 있으면 비우지 않고" 백그라운드 교체 → 즉시 belt 재정렬 + 서버 전체정렬 1페이지 swap.
  const productsRef = useRef<VoucherProduct[]>([])
  useEffect(() => { productsRef.current = products }, [products])
  const loadProducts = useCallback((pageNum: number, reset: boolean) => {
    if (reset) { if (productsRef.current.length === 0) setLoading(true) }
    else setLoadingMore(true)
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(PAGE_SIZE),
      deal_only: '1',
      sort,
    })
    if (brand) params.set('brand', brand)
    if (category) params.set('category', category)
    api.get(`/api/products?${params.toString()}`)
      .then(r => {
        if (r.data?.success) {
          const newItems: VoucherProduct[] = r.data.data || []
          setProducts(prev => reset ? newItems : [...prev, ...newItems])
          setHasMore(newItems.length === PAGE_SIZE)
          if (reset) setPage(1)
        }
      })
      .catch(() => { /* graceful */ })
      .finally(() => { setLoading(false); setLoadingMore(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, category, sort])

  // 🏭 2026-06-05 (사용자 신고 — 정렬이 안 먹음): SSR(MAIN/VOUCHERS) inject 는 "첫 페인트"에만 소비.
  //   이후 정렬/카테고리/브랜드 변경은 항상 loadProducts(서버 정렬 적용)로 fresh fetch → 정렬 정상 반영.
  const ssrConsumedRef = useRef(false)
  useEffect(() => {
    // 🛡️ 2026-05-27 (loading P0): SSR inject first-paint — no-query 초기 진입 시 즉시 표시.
    //   카테고리/브랜드/sort 변경 시 loadProducts 가 다시 axios fetch (fallback).
    // 🏭 2026-06-04: 홈(embedded)은 category='커피/음료' 기본 — MAIN 슬롯이 커피로 warm 됨.
    const firstPaint = !ssrConsumedRef.current
    ssrConsumedRef.current = true
    const ssrMatch = firstPaint && (embedded
      ? (category === EMBEDDED_DEFAULT_CATEGORY && !brand && sort === 'price_low' && page === 1)
      : (!brand && !category && sort === 'price_low' && page === 1))
    if (ssrMatch) {
      try {
        if (typeof document !== 'undefined') {
          const el = document.getElementById(embedded ? '__SSR_INITIAL_MAIN__' : '__SSR_INITIAL_VOUCHERS__')
          if (el?.textContent) {
            const parsed = JSON.parse(el.textContent)
            if (parsed?.success && Array.isArray(parsed?.data)) {
              setProducts(parsed.data)
              setHasMore(parsed.data.length === PAGE_SIZE)
              setLoading(false)
              return
            }
          }
        }
      } catch { /* SSR 누락 — fallback */ }
    }
    loadProducts(1, true)
  }, [brand, category, sort, loadProducts])

  // 🧭 2026-06-10 v2 (사용자 결정): 홈은 12개 + '더보기' 버튼 확장(+20) — 무한 IO 완전 비활성.
  //   홈 하단(동네딜/일반상품/푸터)이 항상 한 호흡에 닿고, 원하는 사람만 버튼으로 확장.
  // 🎫 2026-06-23 (대표 결정): 교환권은 홈 12 / /vouchers 20개 노출 후 '더보기'. 둘 다 무한스크롤 대신 cap+버튼
  //   (비embedded 도 cap → 더보기 아래로 쇼핑 섹션이 이어지게). 교환권 무한관찰 비활성, 무한스크롤은 하단 쇼핑 섹션이 담당.
  const EMBED_INITIAL = embedded ? 12 : 20
  const [embedVisible, setEmbedVisible] = useState(EMBED_INITIAL)
  const embeddedCapped = true
  // 🧭 2026-06-10 (사용자 요청): '교환권 더보기 (1/14)' 단계 표시 — 전용 /count (엣지 캐시).
  //   list 응답 total 은 추정치(COUNT 제거 최적화)라 사용 불가. 실패 시 표시 생략(graceful).
  const [dealTotal, setDealTotal] = useState<number | null>(null)
  useEffect(() => {
    if (!embedded) return
    const params = new URLSearchParams({ deal_only: '1' })
    if (category) params.set('category', category)
    if (brand) params.set('brand', brand)
    api.get(`/api/products/count?${params.toString()}`)
      .then(r => { if (r.data?.success && Number.isFinite(r.data.total)) setDealTotal(r.data.total) })
      .catch(() => setDealTotal(null))
  }, [embedded, category, brand])
  const embedStep = 1 + Math.ceil(Math.max(0, embedVisible - EMBED_INITIAL) / 20)
  const embedTotalSteps = dealTotal ? Math.max(embedStep, 1 + Math.ceil(Math.max(0, dealTotal - EMBED_INITIAL) / 20)) : null
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore || loading || embeddedCapped) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const next = page + 1
        setPage(next)
        loadProducts(next, false)
      }
    }, { threshold: 0.1 })
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, page, loadProducts, embeddedCapped])

  const setBrand = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('brand', next); else params.delete('brand')
    setSearchParams(params)
  }

  // 🛡️ 2026-05-19: 카테고리 변경 — 브랜드 자동 초기화 (다른 카테고리의 브랜드는 의미 없음).
  const setCategory = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('category', next); else params.delete('category')
    params.delete('brand')
    setSearchParams(params)
  }

  return (
    <div className={embedded ? '' : 'bg-white dark:bg-[#0A0A0A] pb-safe-nav md:pb-20 min-h-screen'}>
      {!embedded && (
        <SEO
          title={brand ? `${brand} 교환권 - 유어딜` : '교환권 - 유어딜'}
          description="스타벅스, GS25, 김밥천국 등 인기 브랜드 교환권을 딜로 구매하세요. 즉시 발송."
          url={brand ? `/vouchers?brand=${encodeURIComponent(brand)}` : '/vouchers'}
        />
      )}

      {/* Header — 🛡️ 2026-05-25: 뒤로가기 버튼 제거 (사용자 요청).
          BottomNav 의 메인 탭이라 의미 없는 navigation. 검색 + 타이틀만 유지.
          🛡️ 2026-06-01: embedded(홈) 모드면 홈의 sticky 헤더가 담당 → 자체 헤더 skip. */}
      {/* 🎫 2026-06-23 (대표 결정): 중앙 정렬 스크롤스파이 탭 — 클릭 시 해당 섹션으로 점프, 스크롤 위치 따라 활성.
          콘텐츠를 교체하지 않고 한 페이지 안에서 교환권↔쇼핑 사이를 이동. 검색 아이콘은 우측에 absolute 고정. */}
      {!embedded && (
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="relative flex items-center justify-center px-2 py-1.5">
            <div className="flex items-center gap-1">
              {([['vouchers', '교환권'], ['shopping', '쇼핑']] as const).map(([key, label]) => {
                const active = activeTab === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => (key === 'shopping' ? goToShopping() : goToVouchers())}
                    className={`relative px-4 py-2 text-[15px] font-extrabold transition-colors ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
                  >
                    {label}
                    {active && <span className="absolute left-4 right-4 bottom-0 h-[2.5px] rounded-full bg-gray-900 dark:bg-white" />}
                  </button>
                )
              })}
            </div>
            <button onClick={() => navigate('/search')} aria-label="검색" className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              <Search className="w-5 h-5 text-gray-900 dark:text-white" />
            </button>
          </div>
        </div>
      )}

      {/* 🎫 2026-06-23: 교환권 본문(잔액/카테고리/브랜드/리스트) — 항상 표시. 아래 쇼핑 섹션과 한 스크롤로 이어짐. */}
      {/* 🛡️ 2026-05-28 (사용자 요청): 잔액 카드 + 카테고리 = scroll-up reveal 그룹 (headroom).
            아래로 스크롤 시 숨김(콘텐츠 공간 최대화), 살짝 위로 올리면 둘 다 다시 내려옴.
            sticky top-[45px] (헤더 바로 아래) + revealTop 따라 translateY. bg 는 페이지 배경과 동일 (콘텐츠 비침 방지).
            🎫 2026-06-23 (대표 '가장 이상적으로'): 쇼핑 섹션에 있을 땐(activeTab==='shopping') 강제 숨김 —
            쇼핑의 sticky 카테고리 바(top-[45px] 동일 슬롯)와 겹치지 않게 '한 번에 한 카테고리 바'만 상단에. */}
      <div
        className="sticky top-[45px] z-20 bg-white dark:bg-[#0A0A0A]"
        style={{
          transform: (revealTop && activeTab !== 'shopping') ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.25s ease',
          willChange: 'transform',
        }}
      >
      {/* 🛡️ 2026-05-21 v3: 잔액 카드 — 토스 inspired (premium dark card).
            기존 v2 white 카드 "촌스러워" 피드백 → 검정 카드 + grand 타이포 + 우상단 충전 ›. */}
      <div className="ur-content-wide px-4 lg:px-8 pt-3">
        <button
          type="button"
          onClick={() => navigate('/points/charge')}
          /* 🏭 2026-06-05 (사용자 요청): 토스식 프리미엄 다크 그라데이션(은은한 인디고 틴트). */
          className="w-full text-left rounded-2xl p-5 active:scale-[0.99] transition-transform"
          style={{ background: 'linear-gradient(135deg, #211d3a 0%, #15131f 45%, #050505 100%)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-gray-400 mb-2 tracking-wide">내 딜 잔액</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[36px] font-extrabold text-white leading-none tracking-tight">
                  {dealBalance == null ? '0' : formatNumber(dealBalance)}
                </span>
                <span className="text-[18px] font-bold text-gray-500">딜</span>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold mt-1 px-2.5 py-1 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #6b7280, #6b7280)' }}>
              충전 <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
          {dealBalance != null && dealBalance < 10000 && (
            <p className="text-[11px] text-amber-400 mt-3">잔액 부족 — 1원 = 1딜 즉시 충전</p>
          )}
        </button>
        {/* 보조 액션 — 카드 바깥 작은 텍스트 (당근/토스 패턴) */}
        <div className="mt-2 flex items-center gap-3 text-[11px] px-1">
          <button type="button" onClick={() => navigate('/group-buy')} className="text-gray-500 dark:text-gray-400 hover:underline">
            공구로 적립
          </button>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <button type="button" onClick={() => navigate('/influencer')} className="text-gray-500 dark:text-gray-400 hover:underline">
            친구 추천 5%
          </button>
        </div>
      </div>

      {/* 🛡️ 2026-05-19: 카테고리 바 — 사용자 요청 (전체 탭 X, KT Alpha 분류 그대로).
            2026-05-28: 자체 sticky 제거 — 위 reveal 그룹(wrapper)이 sticky 담당. */}
      {sections.length > 0 && (
        <div className="bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="ur-content-wide px-4 lg:px-8 py-2.5">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {sections.map(s => {
                const active = s.category === category
                return (
                  <button
                    key={s.category}
                    type="button"
                    onClick={() => setCategory(s.category)}
                    className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                      active
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2A2A2A]'
                    }`}
                  >
                    <span>{getCategoryIcon(s.category)}</span>
                    {s.category}
                    <span className={`text-[10px] ${active ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>({s.count})</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
      </div>{/* /reveal 그룹 */}

      {/* 🧭 2026-06-17 (대표 요청): 'N개 교환권' 카운트 제거 + 정렬을 인기 브랜드 헤더 우측으로 이동.
          브랜드가 없는 카테고리(예: 일부 /vouchers 카테고리)에선 정렬 접근성 유지 위해 단독 행으로 노출. */}
      {embedded && currentBrands.length === 0 && (
        <div className="ur-content-wide px-4 lg:px-8 pt-3 flex items-center justify-end">
          <SortMenu value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v)} />
        </div>
      )}

      {/* 🛡️ 2026-05-19: 카테고리별 인기 브랜드 그리드.
          🏭 2026-06-04 (사용자 요청): 브랜드를 클릭(필터)해도 그리드 그대로 유지 + 선택 브랜드 강조. */}
      {currentBrands.length > 0 && (
        <div className="ur-content-wide px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>{getCategoryIcon(category)}</span>
              {category} 인기 브랜드
            </h2>
            {/* 🧭 정렬: 홈(embedded)은 여기 / /vouchers 는 아래 '상품' 섹션 헤더로 이동(2026-06-20) */}
            {embedded && <SortMenu value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v)} />}
          </div>
          {/* 🧭 2026-06-20 (사용자: 상품이 너무 아래로 밀림): /vouchers 도 홈처럼 1행 가로 스크롤로 압축 —
              12개 로고 그리드(3~4행)가 상품을 fold 아래로 밀던 주범. 클릭/ring 강조 동작 불변. */}
          <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1.5 -mx-1 px-1">
            {orderedBrands.map(b => {
              const selected = b.brand_name === brand
              return (
              <button
                key={b.brand_name}
                type="button"
                onClick={() => setBrand(selected ? '' : b.brand_name)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform shrink-0"
              >
                {/* 🎨 2026-06-10 (사용자 요청 — 세련화+잘림): 앰버 박스 → 화이트 로고 타일.
                    선택 = 모노크롬 ring(라이트 검정/다크 흰색) + 살짝 확대 — 로고 본연 색 발색, B&W 톤 정합 */}
                <div className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center bg-white dark:bg-white border transition-all ${
                  selected
                    ? 'border-gray-900 dark:border-white ring-2 ring-gray-900 dark:ring-white scale-105 shadow-md'
                    : 'border-gray-200 dark:border-white/10 opacity-90'
                }`}>
                  {b.brand_icon_url ? (
                    <img src={b.brand_icon_url} alt={b.brand_name} loading="lazy" className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="text-2xl">🎁</span>
                  )}
                </div>
                <span className={`text-[10px] line-clamp-1 max-w-[60px] text-center ${
                  selected ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-600 dark:text-gray-400'
                }`}>{b.brand_name}</span>
              </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 선택된 브랜드 표시 — 홈(embedded)만. /vouchers 는 아래 상품 헤더에 '해제' 통합. */}
      {embedded && brand && (
        <div className="ur-content-wide px-4 lg:px-8 pt-3 pb-1 flex items-center gap-2">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">필터:</span>
          <button
            onClick={() => setBrand('')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[12px] font-medium"
          >
            {brand} ✕
          </button>
        </div>
      )}

      {/* 🎫 2026-06-20 (사용자: 상품 시작 지점 구별 안 됨): 브라우즈 chrome ↔ 상품 리스트 경계 명확화.
          구분선(border-t) + '상품' 섹션 헤더(카테고리/브랜드 + 개수) + 정렬을 상품 바로 위로. /vouchers 전용. */}
      {!embedded && (
        <div className="ur-content-wide px-4 lg:px-8 pt-4 pb-2 mt-1 border-t border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5 min-w-0">
            <Gift className="w-[18px] h-[18px] text-amber-500 shrink-0" />
            <span className="truncate">{brand ? brand : category ? category : '전체'} 교환권</span>
            {!loading && (
              <span className="text-[13px] font-semibold text-gray-400 dark:text-gray-500 shrink-0">{products.length}</span>
            )}
            {brand && (
              <button
                onClick={() => setBrand('')}
                className="shrink-0 ml-1 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-medium"
              >
                해제 ✕
              </button>
            )}
          </h2>
          <SortMenu value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v)} />
        </div>
      )}

      {/* 금액권 리스트 */}
      <div className="ur-content-wide px-4 lg:px-8 pt-1 pb-6">
        {loading ? (
          embedded ? (
            // 🏠 홈 — 2/3/4/5열 그리드 카드 스켈레톤 (main 의 PC 확장 lg:4 xl:5 반영).
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl overflow-hidden border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#121212]">
                  <div className="aspect-square bg-gray-100 dark:bg-[#1A1A1A]" />
                  <div className="px-2.5 pt-2 pb-2.5">
                    <div className="h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded w-3/4" />
                    <div className="h-3 mt-2 bg-gray-100 dark:bg-[#1A1A1A] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // 🎨 2026-06-20: /vouchers 1줄 리스트 스켈레톤 (이미지 좌측 + 텍스트 우측). PC 도 1열(사용자 요청).
            <div className="grid grid-cols-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3.5 py-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
                  <div className="w-[88px] h-[88px] sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A]" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 dark:bg-[#1A1A1A] rounded w-1/3" />
                    <div className="h-4 mt-2 bg-gray-100 dark:bg-[#1A1A1A] rounded w-3/4" />
                    <div className="h-4 mt-2 bg-gray-100 dark:bg-[#1A1A1A] rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">
            {brand ? `${brand} 교환권이 없습니다` : '교환권이 없습니다'}
          </div>
        ) : (
          <>
            {embedded ? (
              // 🏠 홈 — 2/3/4/5열 그리드 카드 (main 의 PC 확장 lg:4 xl:5 반영).
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2.5">
                {displayProducts.slice(0, embedVisible).map((p, idx) => (
                  <Fragment key={p.id}>
                    <VoucherCard p={p} aboveFold={idx < 4} />
                  </Fragment>
                ))}
              </div>
            ) : (
              // 🎨 2026-06-23 /vouchers — 1줄 리스트, embedVisible(기본 20)개까지만 노출 후 '더보기'(대표 결정).
              //   내용 동일, 배치만 행. 더보기 아래로 쇼핑 섹션이 이어짐.
              <div className="grid grid-cols-1">
                {displayProducts.slice(0, embedVisible).map((p, idx) => (
                  <Fragment key={p.id}>
                    <VoucherRow p={p} aboveFold={idx < 4} />
                  </Fragment>
                ))}
              </div>
            )}
            {/* 🧭 2026-06-23: '교환권 더보기' 버튼 — 홈/vouchers 공통. /vouchers 는 이 버튼 아래로 쇼핑 섹션이 이어짐. */}
            {(embedVisible < displayProducts.length || hasMore) && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    const next = embedVisible + 20
                    setEmbedVisible(next)
                    if (next >= products.length && hasMore && !loadingMore) {
                      const np = page + 1; setPage(np); loadProducts(np, false)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A] text-[13px] font-bold text-gray-700 dark:text-gray-200 active:scale-[0.99] transition-transform"
                >
                  {t('home.moreVouchers', { defaultValue: '교환권 더보기' })}
                  {embedTotalSteps && embedTotalSteps > 1 && (
                    <span className="text-gray-400 dark:text-gray-500 font-semibold">({embedStep}/{embedTotalSteps})</span>
                  )}
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
            {/* 더보기 로딩 표시 (sentinel — 교환권 무한관찰은 비활성, 더보기 버튼이 로드 담당).
                '마지막' 표시는 홈(embedded)만 — /vouchers 는 이 아래로 쇼핑 섹션이 이어져 '마지막'이 아님. */}
            <div ref={loadMoreRef} className="h-10 flex items-center justify-center mt-4">
              {loadingMore && <div className="text-[11px] text-gray-400 dark:text-gray-500">로드 중...</div>}
              {embedded && !hasMore && products.length > 0 && (
                <div className="text-[11px] text-gray-400 dark:text-gray-500">— 마지막 —</div>
              )}
            </div>
          </>
        )}
      </div>
      {/* 🛒 2026-06-23 (대표 결정): 쇼핑 섹션 — 교환권 더보기 버튼 아래로 이어지는 일반 상품 그리드(무한 스크롤).
          상단 '쇼핑' 탭이 이 섹션으로 점프(scroll-mt 로 sticky 탭 높이만큼 여백 확보). 홈(embedded)엔 없음. */}
      {!embedded && (
        <section ref={shoppingRef} className="scroll-mt-14 mt-2 border-t-8 border-gray-50 dark:border-[#121212]">
          <div className="ur-content-wide px-4 lg:px-8 pt-5 pb-1 flex items-center gap-1.5">
            <ShoppingBag className="w-[18px] h-[18px] text-gray-900 dark:text-white" />
            <h2 className="text-[16px] font-extrabold text-gray-900 dark:text-white">쇼핑</h2>
          </div>
          <ShoppingGrid />
        </section>
      )}
    </div>
  )
}
