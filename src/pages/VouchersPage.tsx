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
import { useEffect, useState, useRef, useCallback, useMemo, Fragment } from 'react'
import BrandLoader from '@/components/brand/BrandLoader'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronDown, ShoppingBag, Flame, Clock, Tag, ArrowDownWideNarrow, ArrowUpWideNarrow, Soup, Shirt, Sparkle, Sofa, Smartphone, type LucideIcon } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
// 🎟️ 2026-07-10 (대표 결정): 일반상품(쇼핑) 노출은 SHOPPING_TAB_HIDDEN 게이트 — 교환권은 유지.
import { SHOPPING_TAB_HIDDEN, TOPUP_DISABLED } from '@/shared/feature-flags'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'
import { getUserIdSync } from '@/utils/auth'
// 🖥️ 2026-07-18 (교환권 PC 2단 분리): 카드/행 + VoucherProduct 타입은 ./vouchers/shared 로 추출(파일크기 래칫).
import { VoucherCard, VoucherRow, BrandChip, CategoryIcon, type VoucherProduct } from './vouchers/shared'
import { GifticonBoxRailRow } from './vouchers/GifticonBoxEntry'
import VouchersTopBar from './vouchers/VouchersTopBar'
import { SortMenu } from '@/components/ui/sort-menu'
import { SORT_OPTIONS, SHOP_CATEGORIES, type SortKey } from './vouchers/constants'
import BrowseProductCard from './browse/BrowseProductCard'
import type { Product } from './browse/types'

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


// 🏭 2026-06-05 (사용자 신고 — 교환권 스크롤해도 상품 다 안 나옴): SSR 주입 슬롯(MAIN/VOUCHERS) 이
//   limit=20 인데 클라 PAGE_SIZE 가 30 이라 hasMore=(20===30)=false → 무한스크롤이 즉시 멈춰 20개만 노출됐고,
//   계속됐어도 page2 가 limit30 offset30 으로 20~29 를 건너뜀. SSR limit 과 동일하게 맞춰 근본 해결.
const PAGE_SIZE = 20

// 🏭 2026-06-04 (사용자 요청): 홈(embedded) 기본 카테고리 = '커피/음료' (KT Alpha goods_type_detail).
//   worker/index.ts MAIN 슬롯 + cache-prewarm HOT_PATH 의 category 값과 반드시 동일해야 SSR 0-RTT 정합.
const EMBEDDED_DEFAULT_CATEGORY = '커피/음료'

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
  // 🗑️ 2026-07-07 [UNLOCK_LOADING] (로딩 낭비 감사): 쇼핑 그리드는 교환권 리스트 + '더보기' 아래(폴드 밖).
  //   마운트 즉시 상품 fetch + 카테고리 count 5개 병렬을 하던 것을 IntersectionObserver 로 게이팅 —
  //   사용자가 쇼핑 섹션 근처(600px)까지 스크롤할 때만 로드(HomeProductsRail 동일 패턴). SSR seed·교환권
  //   리스트·default sort 전부 불변(이 컴포넌트는 리스트 아래 별도 섹션 — additive 게이트 1개).
  const [inView, setInView] = useState(false)
  const gateRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = gateRef.current
    if (!el || inView) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setInView(true); io.disconnect() }
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [inView])
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
  // 카테고리 변경(load identity 변경) 시 1페이지부터 리셋 로드. (폴드 밖 → inView 후에만 최초 로드)
  useEffect(() => { if (inView) load(1, true) }, [load, inView])
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
    // localStorage 캐시는 inView 무관 즉시 반영(요청 아님) — 재진입 0-RTT 유지.
    try {
      const raw = localStorage.getItem('shop_cats_v1')
      if (raw) {
        const cached = JSON.parse(raw) as { ts: number; data: string[] }
        if (Date.now() - cached.ts < 60 * 60_000 && Array.isArray(cached.data)) setAvailableShopCats(cached.data)
      }
    } catch { /* localStorage 손상 — 무시 */ }
    if (!inView) return  // 폴드 밖 — count 5종 병렬 요청은 섹션 근처 스크롤 시에만
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
  }, [inView])
  // 노출 칩: 로딩 중(null)엔 '전체'만 → 조회되면 '전체' + 상품 있는 카테고리.
  const visibleShopCats = SHOP_CATEGORIES.filter(c => c.key === 'all' || (availableShopCats?.includes(c.key) ?? false))
  return (
    <div className="pb-4">
      {/* 🗑️ 2026-07-07 폴드-아래 게이트 센티넬: 뷰포트 600px 안에 들어오면 상품/카테고리 count 로드. */}
      <div ref={gateRef} aria-hidden style={{ height: 1 }} />
      {/* 🛒 2026-06-23 (대표 '가장 이상적으로'): 쇼핑 카테고리 = sticky 바(top-[45px], 탭 바로 아래) —
          쇼핑 섹션에 있는 동안 상단에 따라붙어 어디서든 카테고리 전환 가능. 교환권 reveal 그룹은 이때 숨김(슬롯 공유). */}
      <div className="sticky top-[45px] z-20 bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
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
                      : 'bg-gray-100 dark:bg-[#1A1C21] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2C2F35]'
                  }`}
                >
                  {c.Icon && <c.Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="ur-content-wide px-4 lg:px-8 pt-3">
      {loading ? (
        <BrandLoader />
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

// 🎨 2026-07-01 (대표 "페이지가 빨리 뜨면 되는거"): SSR seed 를 첫 렌더에 **동기 소비** → 로더 프레임 제거,
//   청크 로드 끝나면 콘텐츠 즉시. (기존엔 loading=true 로 시작 후 effect 에서 소비 → 로더 한 프레임.)
//   조건은 기존 effect 의 ssrMatch 와 동일(first-paint·no-filter·price_low). page 는 첫 렌더라 1 고정.
function readVouchersSsrSeed(embedded: boolean, category: string, brand: string, sort: string): VoucherProduct[] | null {
  const match = embedded
    ? (category === EMBEDDED_DEFAULT_CATEGORY && !brand && sort === 'price_low')
    : (!brand && !category && sort === 'price_low')
  if (!match || typeof document === 'undefined') return null
  try {
    const el = document.getElementById(embedded ? '__SSR_INITIAL_MAIN__' : '__SSR_INITIAL_VOUCHERS__')
    if (el?.textContent) {
      const parsed = JSON.parse(el.textContent)
      if (parsed?.success && Array.isArray(parsed?.data)) return parsed.data as VoucherProduct[]
    }
  } catch { /* SSR 누락/파싱 실패 — null 폴백(effect 가 fetch) */ }
  return null
}

// 🛡️ 2026-06-01: embedded — 홈(/)에서 교환권 본문을 재사용. SEO/자체헤더 skip + SSR 는 MAIN 슬롯에서 읽음.
export default function VouchersPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🖥️ 2026-07-16 (대표 — 카탈로그 PC 당근 그리드): /vouchers 모바일=1열 리스트, PC(lg+)=그리드(홈과 통일). gridMode 만 분기(나머지 chrome 불변).
  const isPc = useMediaQuery('(min-width: 1024px)')
  const gridMode = embedded || isPc
  const [searchParams, setSearchParams] = useSearchParams()
  const brand = searchParams.get('brand') || ''
  // 🏭 2026-06-04 (사용자 요청): 홈(embedded)은 기본 카테고리를 '커피/음료' 로 — 첫 진입 시 커피 브랜드 먼저.
  //   MAIN SSR 슬롯도 같은 커피 카테고리로 warm → 0-RTT 유지 (worker/index.ts + cache-prewarm).
  const category = searchParams.get('category') || (embedded ? EMBEDDED_DEFAULT_CATEGORY : '')

  // 🎨 2026-07-01 (대표 "페이지가 빨리 뜨면"): SSR seed 를 첫 렌더에 동기 소비(1회) → products/loading 초기값에
  //   반영 → 청크 로드 후 로더 프레임 없이 콘텐츠 즉시. sort 는 searchParams 에서 직접(아래 sort const 이전).
  const ssrSeedRef = useRef<VoucherProduct[] | null | undefined>(undefined)
  if (ssrSeedRef.current === undefined) {
    ssrSeedRef.current = readVouchersSsrSeed(embedded, category, brand, searchParams.get('sort') || 'price_low')
  }

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
  /**
   * 🗂️ 2026-09-01 (대표 "나안"): 브랜드 스트립을 **기본 접기**.
   *   실측(미리보기 하네스, 430px): 첫 상품 위에 잔액 슬래브 250 + 고아 링크 40 + 카테고리 칩 60
   *   + 브랜드 스트립 175 + 섹션 헤더 60 ≈ **700px** 이 쌓여 상품이 1.5개밖에 안 보였다.
   *   그중 가장 두꺼운 것이 브랜드 스트립인데, 브랜드는 상품 이름에 이미 들어 있다
   *   ("스타벅스 아메리카노" · "CU 모바일상품권") — 같은 정보로 두 번 거르게 하는 층이다.
   *   ⚠️ 없애지는 않는다. 2026-05-19 대표 요청으로 들어간 "카테고리 + 브랜드 2단 구조"라
   *   **'브랜드로 찾기' 를 누르면 그대로 나온다.** 딥링크로 브랜드가 이미 잡혀 있으면 펴서 시작한다
   *   (접힌 채 선택 상태면 왜 걸러졌는지 알 수 없다).
   */
  const [brandsOpen, setBrandsOpen] = useState(() => !!searchParams.get('brand'))
  // 📐 2026-07-29 (CLS 실측 0.188 수리): 카테고리/브랜드 블록이 **상품 목록보다 늦게** 도착해
  //   목록을 아래로 밀어냈다. 상품은 SSR 시드로 즉시 그려지는데(`__SSR_INITIAL_VOUCHERS__`)
  //   그 위 두 블록은 `/api/vouchers/categories` 응답을 기다리기 때문이다. 첫 방문(로컬 캐시 없음)
  //   에서만 발생 — 재방문은 캐시로 즉시 그려져 시프트가 없다(그래서 눈에 잘 안 띄었다).
  //   → 응답 전까지 **실측 높이만큼 자리를 잡아 둔다**(칩 행 50px · 브랜드 스트립 113px).
  const [sectionsReady, setSectionsReady] = useState(false)
  const [products, setProducts] = useState<VoucherProduct[]>(() => ssrSeedRef.current ?? [])
  const [loading, setLoading] = useState(() => ssrSeedRef.current == null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(() => ssrSeedRef.current != null ? ssrSeedRef.current.length === PAGE_SIZE : true)
  // 🎫 2026-06-26 (대표 결정): 교환권 노출 cap 리셋 — 홈 12개 / /vouchers 8개. 카테고리·브랜드 변경 시 초기화.
  useEffect(() => { setEmbedVisible(embedded ? 12 : 8) }, [embedded, category, brand])
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
          setSectionsReady(true)
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
    }).catch(() => { /* graceful */ }).finally(() => { if (!cancelled) setSectionsReady(true) })
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

  // 🎨 2026-07-01 (대표 "페이지가 빨리 뜨면"): SSR(MAIN/VOUCHERS) seed 는 첫 렌더에 **동기 소비**(products/loading
  //   초기값, 위 ssrSeedRef). effect 는 (a) seed miss 시 첫 fetch (b) 정렬/카테고리/브랜드 변경 시 fresh fetch 만 담당.
  //   → 동기 소비된 경우 마운트에서 재fetch 안 함(로더 프레임 0, 서버정렬 필터변경은 그대로 반영).
  const firstEffectRef = useRef(true)
  useEffect(() => {
    if (firstEffectRef.current) {
      firstEffectRef.current = false
      if (ssrSeedRef.current != null) return  // 첫 렌더에 seed 동기 소비됨 → 마운트 재fetch 스킵
    }
    loadProducts(1, true)
  }, [brand, category, sort, loadProducts])

  // 🧭 2026-06-10 v2 (사용자 결정): 홈은 12개 + '더보기' 버튼 확장(+20) — 무한 IO 완전 비활성.
  //   홈 하단(동네딜/일반상품/푸터)이 항상 한 호흡에 닿고, 원하는 사람만 버튼으로 확장.
  // 🎫 2026-06-23 (대표 결정): 교환권은 홈 12 / /vouchers 20개 노출 후 '더보기'. 둘 다 무한스크롤 대신 cap+버튼
  //   (비embedded 도 cap → 더보기 아래로 쇼핑 섹션이 이어지게). 교환권 무한관찰 비활성, 무한스크롤은 하단 쇼핑 섹션이 담당.
  // 🎫 2026-06-26 (대표 결정): 홈 12개 / /vouchers 8개 먼저 노출 후 '더보기'.
  const EMBED_INITIAL = embedded ? 12 : 8
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

  // 🎨 2026-07-01 (대표 "2번 로딩 근본 해결" — urdeal 로더 유지): standalone(/vouchers) 은 로딩 중
  //   전체화면 BrandLoader 로 early-return → 청크 로더와 끊김 없이 이어져 '한 번'으로 보임(헤더가 중간에 안 뜸).
  //   embedded(홈)은 청크 로더가 없고 다른 콘텐츠와 공존해야 하므로 인라인 유지(아래 {loading?} 블록).
  if (loading && !embedded) return <BrandLoader fullScreen />

  // 🖥️ 2026-07-18 (대표 승인 — 교환권 PC 2단): PC(lg+)는 모바일을 세로로 늘린 형태 대신 **좌측 필터 레일
  //   (딜 잔액 컴팩트 카드 + 카테고리 세로 리스트 + 브랜드 그리드) + 우측 상품 그리드** 로 렌더(카카오 선물하기/SSG PC).
  //   embedded 는 항상 false(홈=동네딜)라 미해당 → 모바일(<lg)은 아래 기존 레이아웃 그대로 byte-불변.
  //   isPc 는 useMediaQuery 동기 초기화(첫 렌더부터 정확)라 모바일↔PC 브랜치 플래시 없음.
  if (isPc && !embedded) {
    return (
      <div className="bg-white dark:bg-[#0D0F12] min-h-[100dvh]">
        <SEO
          title={brand ? `${brand} 교환권 - 유어딜` : '교환권 - 유어딜'}
          description="스타벅스, GS25, 김밥천국 등 인기 브랜드 교환권을 딜로 구매하세요. 즉시 발송."
          url={brand ? `/vouchers?brand=${encodeURIComponent(brand)}` : '/vouchers'}
        />
        {/* 🔎 2026-07-29 (소비자 SEO 실측): 이 페이지엔 h1 이 **하나도 없었다** — 서빙 HTML 의 유일한 h1 은
            index.html 의 숨겨진 인앱 차단 화면이었다. 탭바의 "교환권"은 <button>(탭)이라 제목이 될 수 없어,
            문서 제목용 h1 을 시각적으로 숨겨 둔다(스크린리더·크롤러엔 노출). */}
        <h1 className="sr-only">{brand ? `${brand} 교환권` : '교환권'} — 인기 브랜드 기프티콘을 딜로 즉시 구매</h1>
        {/* 🖥️ 2026-07-19 (대표 — "상단은 공통"): 자체 PC 헤더 삭제 — 전역 DesktopTopNav(로고+검색+카테고리 바)가 담당. */}
        <div className="ur-content-wide px-8 py-6 grid grid-cols-[248px_minmax(0,1fr)] gap-8 items-start">
          {/* ── 좌측 필터 레일 (sticky — 전역 네비 2행(~101px) 아래) ── */}
          <aside className="sticky top-[120px] self-start space-y-6">
            {/* 딜 잔액 — 컴팩트 카드 */}
            <button
              type="button"
              /* 🛡️ 2026-07-18 (대표 "충전 자체를 빼자"): 충전 종료 — 카드 탭 = 딜 내역으로. */
              onClick={() => navigate(TOPUP_DISABLED ? '/my-deal-history' : '/points/charge')}
              className="w-full text-left rounded-2xl p-4 active:scale-[0.99] transition-transform"
              style={{ background: '#16181C' }}
            >
              <p className="text-[11px] text-gray-400 mb-1.5 tracking-wide">내 딜 잔액</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[26px] font-extrabold text-white leading-none tracking-tight">{dealBalance == null ? '0' : formatNumber(dealBalance)}</span>
                <span className="text-[15px] font-bold text-gray-500">딜</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">1딜 = 1원 · 현금처럼 사용</p>
              <span className="mt-3 w-full inline-flex items-center justify-center gap-1 text-[12px] font-bold py-2 rounded-lg text-white bg-white/10">
                {TOPUP_DISABLED ? '딜 내역 보기' : '충전하기'} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <GifticonBoxRailRow />

            {/* 카테고리 — 세로 리스트 */}
            {sections.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mb-2 px-1">카테고리</h3>
                <div className="space-y-0.5">
                  {sections.map(s => {
                    const active = s.category === category
                    return (
                      <button
                        key={s.category}
                        type="button"
                        onClick={() => setCategory(s.category)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                          active
                            ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white font-bold'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <CategoryIcon category={s.category} />
                        <span className="flex-1 text-left truncate">{s.category}</span>
                        <span className={`text-[11px] ${active ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>{s.count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 🖥️ 2026-07-19 (대표 — "브랜드가 레일 하단이라 불편"): 인기 브랜드를 우측 콘텐츠 상단 가로 스트립으로 이동. */}
          </aside>

          {/* ── 우측 상품 그리드 ── */}
          <main>
            {/* 인기 브랜드 — 상단 가로 스트립(대표 — 좌레일 하단은 불편 → 상품 바로 위로). */}
            {currentBrands.length > 0 && (
              <div className="mb-5 pb-4 border-b border-gray-100 dark:border-[#2C2F35]">
                <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mb-2">인기 브랜드</h3>
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                  {orderedBrands.map(b => (
                    <BrandChip
                      key={b.brand_name}
                      brand={b}
                      selected={b.brand_name === brand}
                      onSelect={() => setBrand(b.brand_name === brand ? '' : b.brand_name)}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-[19px] font-extrabold text-gray-900 dark:text-white flex items-center gap-2 min-w-0">
                <span className="truncate">{brand ? brand : category ? category : '전체'} 교환권</span>
                {/* 🐛 2026-08-17 (UX 전수검사 P1): 로드분 개수를 총계 자리에 그대로 쓰면 "커피/음료 775개"
                    카테고리가 "20"으로 읽힌다 — 더 있으면 `20+` 로 표기(정확한 총계 API 없음). */}
                <span className="text-[14px] font-semibold text-gray-400 dark:text-gray-500 shrink-0">{hasMore ? `${products.length}+` : products.length}</span>
                {brand && (
                  <button
                    onClick={() => setBrand('')}
                    className="shrink-0 ml-1 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-300 text-[11px] font-medium"
                  >
                    해제 ✕
                  </button>
                )}
              </h2>
              <SortMenu value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v)} />
            </div>

            {products.length === 0 ? (
              <div className="text-center py-20 text-gray-400 dark:text-gray-500 text-sm">
                {brand ? `${brand} 교환권이 없습니다` : '교환권이 없습니다'}
              </div>
            ) : (
              <>
                {/* 📐 2026-08-17 (UX 전수검사 P2 — 그루폰 대비 최약 밀도): PC 4열→5열(xl). 카드 ~240→190px,
                    첫 화면 노출 8→10개. 카드 내부(이미지 속성 잠금)는 무변경 — 열 수만. */}
                <div className="grid grid-cols-3 xl:grid-cols-5 gap-x-3 gap-y-4">
                  {displayProducts.slice(0, embedVisible).map((p, idx) => (
                    <Fragment key={p.id}>
                      <VoucherCard p={p} aboveFold={idx < 8} />
                    </Fragment>
                  ))}
                </div>
                {(embedVisible < displayProducts.length || hasMore) && (
                  <div className="mt-6 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const next = embedVisible + 12
                        setEmbedVisible(next)
                        if (next >= products.length && hasMore && !loadingMore) {
                          const np = page + 1; setPage(np); loadProducts(np, false)
                        }
                      }}
                      // 🔘 2026-08-30 버튼 체계 적용 (index.css `.ur-btn`).
                      //   이전: h-12 rounded-2xl text-[13px] font-bold — 이 화면만의 값이었다.
                      //   높이·모서리·굵기·글자크기를 체계가 정하고, 여기선 **채움색만** 준다.
                      className="ur-btn ur-btn-lg ur-btn-block bg-gray-100 dark:bg-[#1A1C21] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2C2F35]"
                    >
                      {t('home.moreVouchers', { defaultValue: '교환권 더보기' })}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {loadingMore && <div className="mt-4 text-center text-[11px] text-gray-400 dark:text-gray-500">로드 중...</div>}
              </>
            )}
          </main>
        </div>
      </div>
    )
  }

  // 🛡️ 2026-07-03 (대표 신고 — 모바일 쇼핑탭 하단 네비 실종): min-h-screen(=100vh) → min-h-[100dvh].
  //   100vh 는 주소창 포함 '큰 뷰포트'라 카카오톡 인앱/일부 안드로이드 웹뷰에서 fixed 하단 네비를
  //   화면 밖으로 밀어냄(CLAUDE.md 룰 #8). 정상 동작하는 홈(RestaurantMapPage)도 min-h-[100dvh] 사용.
  return (
    <div className={embedded ? '' : 'bg-white dark:bg-[#0D0F12] pb-safe-nav md:pb-20 min-h-[100dvh]'}>
      {!embedded && (
        <SEO
          title={brand ? `${brand} 교환권 - 유어딜` : '교환권 - 유어딜'}
          description="스타벅스, GS25, 김밥천국 등 인기 브랜드 교환권을 딜로 구매하세요. 즉시 발송."
          url={brand ? `/vouchers?brand=${encodeURIComponent(brand)}` : '/vouchers'}
        />
      )}
      {/* 🔎 2026-07-29 (소비자 SEO 실측): 이 페이지엔 h1 이 **하나도 없었다** — 서빙 HTML 의 유일한 h1 은
          index.html 의 숨겨진 인앱 차단 화면이었다. 탭바의 "교환권"은 <button>(탭)이라 제목이 될 수 없어,
          문서 제목용 h1 을 시각적으로 숨겨 둔다(스크린리더·크롤러엔 노출). */}
      <h1 className="sr-only">{brand ? `${brand} 교환권` : '교환권'} — 인기 브랜드 기프티콘을 딜로 즉시 구매</h1>


      {/* 상단 바 — 제목(단일 표면) 또는 교환권↔쇼핑 스크롤스파이 탭 + [보관함][검색]. 홈(embedded)은 홈 헤더가 담당. */}
      {!embedded && <VouchersTopBar activeTab={activeTab} onVouchers={goToVouchers} onShopping={goToShopping} />}

      {/* 🎫 2026-06-23: 교환권 본문(잔액/카테고리/브랜드/리스트) — 항상 표시. 아래 쇼핑 섹션과 한 스크롤로 이어짐. */}
      {/* 🛡️ 2026-05-28 (사용자 요청): 잔액 카드 + 카테고리 = scroll-up reveal 그룹 (headroom).
            아래로 스크롤 시 숨김(콘텐츠 공간 최대화), 살짝 위로 올리면 둘 다 다시 내려옴.
            sticky top-[45px] (헤더 바로 아래) + revealTop 따라 translateY. bg 는 페이지 배경과 동일 (콘텐츠 비침 방지).
            🎫 2026-06-23 (대표 '가장 이상적으로'): 쇼핑 섹션에 있을 땐(activeTab==='shopping') 강제 숨김 —
            쇼핑의 sticky 카테고리 바(top-[45px] 동일 슬롯)와 겹치지 않게 '한 번에 한 카테고리 바'만 상단에. */}
      <div
        className="sticky top-[45px] z-20 bg-white dark:bg-[#0D0F12]"
        style={{
          transform: (revealTop && activeTab !== 'shopping') ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.25s ease',
          willChange: 'transform',
        }}
      >
      {/* 🛡️ 2026-05-21 v3: 잔액 카드 — 토스 inspired (premium dark card).
            기존 v2 white 카드 "촌스러워" 피드백 → 검정 카드 + grand 타이포 + 우상단 충전 ›. */}
      <div className="ur-content-wide px-4 lg:px-8 pt-3">
        {dealBalance ? (
          <>
            <button
              type="button"
              onClick={() => navigate(TOPUP_DISABLED ? '/my-deal-history' : '/points/charge')}
              className="w-full text-left rounded-2xl p-5 active:scale-[0.99] transition-transform"
              style={{ background: '#16181C' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-gray-400 mb-2 tracking-wide">내 딜 잔액</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[36px] font-extrabold text-white leading-none tracking-tight">{formatNumber(dealBalance)}</span>
                    <span className="text-[18px] font-bold text-gray-500">딜</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">1딜 = 1원 · 현금처럼 사용</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold mt-1 px-2.5 py-1 rounded-full text-white" style={{ background: 'rgba(255,255,255,0.14)' }}>
                  {TOPUP_DISABLED ? '내역' : '충전'} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
            {dealBalance < 10000 && (
              <div className="mt-1.5 px-1">
                <button type="button" onClick={() => navigate('/map')} className="text-[11.5px] text-gray-500 dark:text-gray-400 hover:underline">딜 모으는 방법 보기</button>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/map')}
            className="w-full h-11 px-3.5 flex items-center justify-between gap-2 rounded-xl bg-gray-100 dark:bg-[#1A1C21] active:scale-[0.99] transition-transform"
          >
            <span className="text-[12.5px] text-gray-600 dark:text-gray-300 truncate">
              <b className="text-gray-900 dark:text-white">딜 0</b> · 1딜 = 1원, 현금처럼 써요
            </span>
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[11.5px] font-bold text-gray-500 dark:text-gray-400">
              모으는 방법 <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        )}
      </div>

      {/* 🛡️ 2026-05-19: 카테고리 바 — 사용자 요청 (전체 탭 X, KT Alpha 분류 그대로).
            2026-05-28: 자체 sticky 제거 — 위 reveal 그룹(wrapper)이 sticky 담당. */}
      {sections.length === 0 && !sectionsReady && (
        /* 자리 예약 — 높이는 실측값(칩 행 50px, **테두리 포함**). 시각적 스켈레톤은 두지 않는다(로더 통일 정책).
           ⚠️ 여기에 border 를 더하면 51px 이 돼 교체 순간 1px 이 밀린다 — 높이만 맞춘다. */
        <div className="h-[50px]" aria-hidden="true" />
      )}
      {sections.length > 0 && (
        <div className="bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
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
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                        : 'bg-gray-100 dark:bg-[#1A1C21] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2C2F35]'
                    }`}
                  >
                    <CategoryIcon category={s.category} />
                    {s.category}
                    <span className={`text-[10px] ${active ? 'text-white/70 dark:text-gray-900/60' : 'text-gray-400 dark:text-gray-500'}`}>({s.count})</span>
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
      {currentBrands.length === 0 && !sectionsReady && (
        /* 자리 예약 — 높이는 실측값(브랜드 스트립 113px). */
        <div className="h-[113px]" aria-hidden="true" />
      )}
      {currentBrands.length > 0 && (
        /* 🎫 2026-06-26 (대표 결정 A): 상단 레이어 정리 — 상품을 위로. py-4→pt-1.5/pb-3, 헤더/로고 컴팩트. */
        <div className="ur-content-wide px-4 lg:px-8 pt-1.5 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              onClick={() => setBrandsOpen(v => !v)}
              className="text-[12px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5"
            >
              <CategoryIcon category={category} />
              브랜드로 찾기
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${brandsOpen ? 'rotate-180' : ''}`} />
            </button>
            {/* 🧭 정렬: 홈(embedded)은 여기 / /vouchers 는 아래 '상품' 섹션 헤더로 이동(2026-06-20) */}
            {embedded && <SortMenu value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v)} />}
          </div>
          {/* 🧭 2026-06-20 (사용자: 상품이 너무 아래로 밀림): /vouchers 도 홈처럼 1행 가로 스크롤로 압축 —
              12개 로고 그리드(3~4행)가 상품을 fold 아래로 밀던 주범. 클릭/ring 강조 동작 불변. */}
          {brandsOpen && (
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1">
            {orderedBrands.map(b => (
              <BrandChip
                key={b.brand_name}
                brand={b}
                selected={b.brand_name === brand}
                onSelect={() => setBrand(b.brand_name === brand ? '' : b.brand_name)}
                labelWidthClass="max-w-[60px]"
              />
            ))}
          </div>
          )}
        </div>
      )}

      {/* 선택된 브랜드 표시 — 홈(embedded)만. /vouchers 는 아래 상품 헤더에 '해제' 통합. */}
      {embedded && brand && (
        <div className="ur-content-wide px-4 lg:px-8 pt-3 pb-1 flex items-center gap-2">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">필터:</span>
          <button
            onClick={() => setBrand('')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-300 text-[12px] font-medium"
          >
            {brand} ✕
          </button>
        </div>
      )}

      {/* 🎫 2026-06-20 (사용자: 상품 시작 지점 구별 안 됨): 브라우즈 chrome ↔ 상품 리스트 경계 명확화.
          구분선(border-t) + '상품' 섹션 헤더(카테고리/브랜드 + 개수) + 정렬을 상품 바로 위로. /vouchers 전용. */}
      {!embedded && (
        <div className="ur-content-wide px-4 lg:px-8 pt-3 pb-2 border-t border-gray-100 dark:border-[#2C2F35] flex items-center justify-between gap-2">
          {/* 🧹 2026-08-31: ① 선물 아이콘 제거 — 바로 아래 하단 탭의 '교환권' 아이콘과 **같은 그림**이라
              같은 화면에서 두 번 같은 말을 했고, 앰버 한 점이 이 화면의 유일한 색이라 시선만 끌었다.
              ② 0 은 세지 않는다 — 곧바로 아래 빈 상태가 같은 사실을 더 잘 말한다. */}
          <h2 className="text-[16px] font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5 min-w-0">
            <span className="truncate">{brand ? brand : category ? category : '전체'} 교환권</span>
            {!loading && products.length > 0 && (
              <span className="text-[13px] font-semibold text-gray-400 dark:text-gray-500 shrink-0">{hasMore ? `${products.length}+` : products.length}</span>
            )}
            {brand && (
              <button
                onClick={() => setBrand('')}
                className="shrink-0 ml-1 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-300 text-[11px] font-medium"
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
          gridMode ? (
            // 🏠 홈/PC — 2/3/4/5열 그리드 카드 스켈레톤 (main 의 PC 확장 lg:4 xl:5 반영).
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl overflow-hidden border border-gray-100 dark:border-[#2C2F35] bg-white dark:bg-[#1A1C21]">
                  <div className="aspect-square bg-gray-100 dark:bg-[#1A1C21]" />
                  <div className="px-2.5 pt-2 pb-2.5">
                    <div className="h-3 bg-gray-100 dark:bg-[#1A1C21] rounded w-3/4" />
                    <div className="h-3 mt-2 bg-gray-100 dark:bg-[#1A1C21] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // 🎨 2026-06-20: /vouchers 1줄 리스트 스켈레톤 (이미지 좌측 + 텍스트 우측). PC 도 1열(사용자 요청).
            <div className="grid grid-cols-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3.5 py-3.5 border-b border-gray-100 dark:border-[#2C2F35]">
                  <div className="w-[88px] h-[88px] sm:w-24 sm:h-24 shrink-0 rounded-2xl bg-gray-100 dark:bg-[#1A1C21]" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 dark:bg-[#1A1C21] rounded w-1/3" />
                    <div className="h-4 mt-2 bg-gray-100 dark:bg-[#1A1C21] rounded w-3/4" />
                    <div className="h-4 mt-2 bg-gray-100 dark:bg-[#1A1C21] rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">
              {brand ? `${brand} 교환권이 없어요` : '조건에 맞는 교환권이 없어요'}
            </p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-5">
              {brand ? '다른 브랜드도 둘러보세요' : '카테고리를 바꾸면 더 많이 볼 수 있어요'}
            </p>
            {/* 🚪 2026-08-31: 여기도 막다른 길이었다 — 회색 문구 한 줄이 전부였고,
                브랜드/카테고리 필터로 0건이 된 사용자는 되돌아갈 버튼이 없었다. */}
            <button
              type="button"
              onClick={() => { setBrand(''); setCategory('') }}
              className="ur-btn ur-btn-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4"
            >
              전체 교환권 보기
            </button>
          </div>
        ) : (
          <>
            {gridMode ? (
              // 🏠 홈/PC — 2/3/4/5열 그리드 카드 (main 의 PC 확장 lg:4 xl:5 반영).
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
                    // 🎫 2026-06-26 (대표 결정): /vouchers 는 8개 시작이라 더보기도 +8(리듬 정합). 홈은 +20 유지.
                    const next = embedVisible + (embedded ? 20 : 8)
                    setEmbedVisible(next)
                    if (next >= products.length && hasMore && !loadingMore) {
                      const np = page + 1; setPage(np); loadProducts(np, false)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 h-12 rounded-2xl bg-gray-100 dark:bg-[#1A1C21] text-[13px] font-bold text-gray-700 dark:text-gray-200 active:scale-[0.99] transition-transform"
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
          상단 '쇼핑' 탭이 이 섹션으로 점프(scroll-mt 로 sticky 탭 높이만큼 여백 확보). 홈(embedded)엔 없음.
          🎟️ 2026-07-10 (대표 결정 — 일반상품 숨김·교환권 유지): SHOPPING_TAB_HIDDEN 게이트 — 숨김 시
          순수 교환권 페이지(인플 딜포인트→교환권 구매 경로 보존). 플래그 false 로 즉시 복원(가역). */}
      {!embedded && !SHOPPING_TAB_HIDDEN && (
        <section ref={shoppingRef} className="scroll-mt-14 mt-2 border-t-8 border-gray-50 dark:border-[#1A1C21]">
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
