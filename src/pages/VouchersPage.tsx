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
import { Search, Gift, Heart, Wallet, Sparkles, Users, ArrowRight, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'
import { getUserIdSync } from '@/utils/auth'
import { usePrefetchProduct } from '@/hooks/usePrefetchProduct'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { extractDominantColor, reportDominantColor } from '@/utils/dominant-color'
import { cardGradient } from '@/utils/card-gradient'
import { SortMenu } from '@/components/ui/sort-menu'

// 🛡️ 2026-05-21: 교환권 정렬 옵션 (사용자 요청).
type SortKey = 'popular' | 'newest' | 'price_low' | 'price_high' | 'discount' | 'rating'
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'popular',    label: '🔥 인기순' },
  { key: 'newest',     label: '🆕 최신순' },
  { key: 'price_low',  label: '💰 낮은 가격순' },
  { key: 'price_high', label: '💎 높은 가격순' },
  { key: 'discount',   label: '🏷️ 할인율순' },
  { key: 'rating',     label: '⭐ 평점순' },
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
  const rating = Number(p.avg_rating || 0)
  const reviewCount = Number(p.review_count || 0)
  const soldCount = Number(p.sold_count || 0)
  const soldLabel = soldCount >= 10000
    ? `${(soldCount / 10000).toFixed(1).replace(/\.0$/, '')}만`
    : soldCount >= 1000
    ? `${(soldCount / 1000).toFixed(1).replace(/\.0$/, '')}천`
    : String(soldCount)
  // 🏭 2026-06-05 (사용자 요청): 홈 교환권 카드도 쇼핑/동네딜처럼 대표색 그라데이션.
  const [cardColor, setCardColor] = useState<string | null>(p.dominant_color || null)
  // 🏭 2026-06-05 (사용자 신고 — 가끔 이미지가 깨져 빈 회색 카드): 이미지 로드 실패 시 Gift 폴백.
  //   기존엔 onLoad 로만 노출(opacity 0→1)하고 onError 가 없어, 깨진 이미지는 opacity 0 인 채 빈칸으로 남았음.
  const [imgError, setImgError] = useState(false)
  const grad = cardGradient(cardColor)
  return (
    <button
      type="button"
      onClick={() => navigate(`/vouchers/${p.id}`)}
      onMouseEnter={() => prefetchProduct(p.id)}
      onTouchStart={() => prefetchProduct(p.id)}
      onFocus={() => prefetchProduct(p.id)}
      className="ur-cv-card text-left active:scale-[0.98] transition-transform w-full block flex flex-col rounded-2xl overflow-hidden"
      style={{ backgroundColor: grad.base }}
    >
      <div className="relative aspect-square w-full overflow-hidden" style={{ backgroundColor: grad.base }}>
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
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <Gift className="w-10 h-10" style={{ color: grad.sub }} />
            {p.brand_name && <span className="text-[11px] font-bold" style={{ color: grad.sub }}>{p.brand_name}</span>}
          </div>
        )}
        {/* 사진 하단 → 같은 카드색으로 번짐 (경계 제거) */}
        <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none" style={{ background: grad.imageFade }} />
      </div>
      <div className="px-2.5 pt-1 pb-2.5 flex flex-col flex-1" style={{ color: grad.text }}>
        {p.brand_name && (
          <p className="text-[11px] font-semibold leading-none mb-1" style={{ color: grad.sub }}>[{p.brand_name}]</p>
        )}
        <p className="text-[13px] leading-tight line-clamp-2 font-medium">{p.name}</p>
        <p className="text-[11px] mt-0.5 leading-none line-through" style={{ color: grad.sub, visibility: hasStrike ? 'visible' : 'hidden' }}>
          {hasStrike ? `${formatNumber(p.original_price!)}딜` : ' '}
        </p>
        <div className="flex items-baseline gap-1 mt-0.5">
          {discountRate > 0 && (
            <span className="text-[15px] font-extrabold" style={{ color: grad.accent }}>{discountRate}%</span>
          )}
          <span className="text-[15px] font-extrabold">{formatNumber(p.price)}딜</span>
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

  // 🛡️ 2026-05-19: 카테고리 + 브랜드 2단 구조 — 사용자 요청.
  //   sections = 카테고리별 (편의점/카페/외식 등) + 각 카테고리 내 인기 브랜드 12개.
  //   첫 로드 시 cnt 가장 많은 카테고리 자동 선택. 카테고리 변경 시 브랜드 list 자동 갱신.
  const [sections, setSections] = useState<CategorySection[]>([])
  const [products, setProducts] = useState<VoucherProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  useEffect(() => { if (embedded) setEmbedVisible(12) }, [embedded, category, brand])
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
      .catch(() => setDealBalance(0))
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
  const EMBED_INITIAL = 12
  const [embedVisible, setEmbedVisible] = useState(EMBED_INITIAL)
  const embeddedCapped = embedded
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
      {!embedded && (
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="flex-1 flex items-center gap-1.5">
              <Gift className="w-5 h-5 text-amber-500" />
              <h1 className="text-[16px] font-extrabold text-gray-900 dark:text-white">
                {brand ? brand : '교환권'}
              </h1>
            </div>
            <button onClick={() => navigate('/search')} className="shrink-0 p-1">
              <Search className="w-5 h-5 text-gray-900 dark:text-white" />
            </button>
          </div>
        </div>
      )}

      {/* 🛡️ 2026-05-28 (사용자 요청): 잔액 카드 + 카테고리 = scroll-up reveal 그룹 (headroom).
            아래로 스크롤 시 숨김(콘텐츠 공간 최대화), 살짝 위로 올리면 둘 다 다시 내려옴.
            sticky top-[45px] (헤더 바로 아래) + revealTop 따라 translateY. bg 는 페이지 배경과 동일 (콘텐츠 비침 방지). */}
      <div
        className="sticky top-[45px] z-20 bg-white dark:bg-[#0A0A0A]"
        style={{
          transform: revealTop ? 'translateY(0)' : 'translateY(-110%)',
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
            <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold mt-1 px-2.5 py-1 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>
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

      {/* 🛡️ 2026-05-21: 정렬 옵션 (사용자 요청 — 가격순/인기순 등). */}
      <div className="ur-content-wide px-4 lg:px-8 pt-3 flex items-center justify-between">
        <span className="text-[12px] text-gray-500 dark:text-gray-400">
          {loading ? '불러오는 중...' : `${products.length}개 교환권`}
        </span>
        {/* 🏭 2026-06-05 (사용자 신고 — 정렬 버튼 깨짐): 네이티브 select → 통일 스타일 드롭다운. */}
        <SortMenu value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v)} />
      </div>

      {/* 🛡️ 2026-05-19: 카테고리별 인기 브랜드 그리드.
          🏭 2026-06-04 (사용자 요청): 브랜드를 클릭(필터)해도 그리드 그대로 유지 + 선택 브랜드 강조. */}
      {currentBrands.length > 0 && (
        <div className="ur-content-wide px-4 lg:px-8 py-4">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
            <span>{getCategoryIcon(category)}</span>
            {category} 인기 브랜드
          </h2>
          {/* 🧭 2026-06-10 (UI 100점 패스): 홈(embedded)은 1행 가로 스크롤 — 도구단이 상품을 fold 아래로 밀던 것 압축.
              /vouchers 전체 페이지는 기존 그리드 유지. 클릭 유지/ring 강조 동작 불변. */}
          <div className={embedded
            ? 'flex gap-3 overflow-x-auto scrollbar-hide py-1.5 -mx-1 px-1'
            : 'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3'}>
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
                <div className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center bg-white border transition-all ${
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

      {/* 선택된 브랜드 표시 */}
      {brand && (
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

      {/* 금액권 그리드 */}
      <div className="ur-content-wide px-4 lg:px-8 py-4">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-gray-100 dark:bg-[#1A1A1A] rounded-xl" />
                <div className="h-3 mt-2 bg-gray-100 dark:bg-[#1A1A1A] rounded w-3/4" />
                <div className="h-3 mt-1 bg-gray-100 dark:bg-[#1A1A1A] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">
            {brand ? `${brand} 교환권이 없습니다` : '교환권이 없습니다'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2.5">
              {(embedded ? displayProducts.slice(0, embedVisible) : displayProducts).map((p, idx) => (
                <Fragment key={p.id}>
                  <VoucherCard p={p} aboveFold={idx < 4} />
                </Fragment>
              ))}
            </div>
            {/* 🧭 홈: '더보기' 인라인 확장 + '전체보기' 병행 */}
            {embedded && (embedVisible < displayProducts.length || hasMore) && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = embedVisible + 20
                    setEmbedVisible(next)
                    if (next >= products.length && hasMore && !loadingMore) {
                      const np = page + 1; setPage(np); loadProducts(np, false)
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A] text-[13px] font-bold text-gray-700 dark:text-gray-200 active:scale-[0.99] transition-transform"
                >
                  {t('home.moreVouchers', { defaultValue: '교환권 더보기' })} <ChevronDown className="w-4 h-4" />
                </button>
                <Link
                  to="/vouchers"
                  className="flex items-center justify-center gap-1.5 h-12 rounded-2xl border border-gray-200 dark:border-[#2A2A2A] text-[13px] font-bold text-gray-700 dark:text-gray-200 active:scale-[0.99] transition-transform"
                >
                  {t('home.allVouchers', { defaultValue: '전체보기' })} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
            {/* 무한 스크롤 sentinel */}
            <div ref={loadMoreRef} className="h-10 flex items-center justify-center mt-4">
              {loadingMore && <div className="text-[11px] text-gray-400 dark:text-gray-500">로드 중...</div>}
              {!hasMore && products.length > 0 && (
                <div className="text-[11px] text-gray-400 dark:text-gray-500">— 마지막 —</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
