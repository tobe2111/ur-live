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
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Gift, ChevronLeft, Heart, Wallet, Sparkles, Users, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'
import { getUserIdSync } from '@/utils/auth'

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
  image_url?: string
  brand_name?: string | null
  brand_icon_url?: string | null
  category?: string | null
  sold_count?: number
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

const PAGE_SIZE = 30

export default function VouchersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const brand = searchParams.get('brand') || ''
  const category = searchParams.get('category') || ''

  // 🛡️ 2026-05-19: 카테고리 + 브랜드 2단 구조 — 사용자 요청.
  //   sections = 카테고리별 (편의점/카페/외식 등) + 각 카테고리 내 인기 브랜드 12개.
  //   첫 로드 시 cnt 가장 많은 카테고리 자동 선택. 카테고리 변경 시 브랜드 list 자동 갱신.
  const [sections, setSections] = useState<CategorySection[]>([])
  const [products, setProducts] = useState<VoucherProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // 🛡️ 2026-05-21: 정렬 옵션 — popular/newest/price_low/price_high/discount/rating.
  //   URL ?sort=... 동기화 — 공유/북마크 가능.
  const sort = (searchParams.get('sort') as SortKey) || 'popular'
  const setSort = (next: SortKey) => {
    const p = new URLSearchParams(searchParams)
    if (next === 'popular') p.delete('sort')
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
    api.get('/api/vouchers/categories').then(r => {
      if (cancelled) return
      if (r.data?.success && Array.isArray(r.data.data)) {
        const list = r.data.data as CategorySection[]
        setSections(list)
        // 카테고리 URL 미지정 시 첫 카테고리 (인기 ↑) 자동 선택.
        if (!category && !brand && list.length > 0) {
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

  // 상품 로드 (페이지 변경 / 필터 변경 시)
  const loadProducts = useCallback((pageNum: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true)
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

  useEffect(() => {
    loadProducts(1, true)
  }, [brand, category, sort, loadProducts])

  // 무한 스크롤
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore || loading) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const next = page + 1
        setPage(next)
        loadProducts(next, false)
      }
    }, { threshold: 0.1 })
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, page, loadProducts])

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
    <div className="bg-white dark:bg-[#0A0A0A] pb-safe-nav md:pb-20 min-h-screen">
      <SEO
        title={brand ? `${brand} 교환권 - 유어딜` : '교환권 - 유어딜'}
        description="스타벅스, GS25, 김밥천국 등 인기 브랜드 교환권을 딜로 구매하세요. 즉시 발송."
        url={brand ? `/vouchers?brand=${encodeURIComponent(brand)}` : '/vouchers'}
      />

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={() => navigate(-1)} className="shrink-0 p-1">
            <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>
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

      {/* 🛡️ 2026-05-21 v3: 잔액 카드 — 토스 inspired (premium dark card).
            기존 v2 white 카드 "촌스러워" 피드백 → 검정 카드 + grand 타이포 + 우상단 충전 ›. */}
      <div className="ur-content-wide px-4 lg:px-8 pt-3">
        <button
          type="button"
          onClick={() => navigate('/points/charge')}
          className="w-full text-left rounded-2xl bg-gradient-to-br from-gray-900 to-black dark:from-[#101010] dark:to-black p-5 active:scale-[0.99] transition-transform"
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
            <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-gray-400 mt-1">
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

      {/* 🛡️ 2026-05-19: 카테고리 sticky 바 — 사용자 요청 (전체 탭 X, KT Alpha 분류 그대로). */}
      {sections.length > 0 && (
        <div className="sticky top-[52px] z-20 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
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

      {/* 🛡️ 2026-05-21: 정렬 옵션 (사용자 요청 — 가격순/인기순 등). */}
      <div className="ur-content-wide px-4 lg:px-8 pt-3 flex items-center justify-between">
        <span className="text-[12px] text-gray-500 dark:text-gray-400">
          {loading ? '불러오는 중...' : `${products.length}개 교환권`}
        </span>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="bg-transparent border border-gray-200 dark:border-[#2A2A2A] rounded-full px-3 py-1.5 text-[12px] font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* 🛡️ 2026-05-19: 카테고리별 인기 브랜드 그리드 (선택된 카테고리만). */}
      {!brand && currentBrands.length > 0 && (
        <div className="ur-content-wide px-4 lg:px-8 py-4">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
            <span>{getCategoryIcon(category)}</span>
            {category} 인기 브랜드
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {currentBrands.map(b => (
              <button
                key={b.brand_name}
                type="button"
                onClick={() => setBrand(b.brand_name)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 overflow-hidden flex items-center justify-center border border-amber-100 dark:border-amber-500/20">
                  {b.brand_icon_url ? (
                    <img src={b.brand_icon_url} alt={b.brand_name} loading="lazy" className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="text-2xl">🎁</span>
                  )}
                </div>
                <span className="text-[10px] text-gray-700 dark:text-gray-300 line-clamp-1 max-w-[60px] text-center">{b.brand_name}</span>
                <span className="text-[9px] text-gray-400 dark:text-gray-500">{b.cnt}종</span>
              </button>
            ))}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6">
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/products/${p.id}`)}
                  className="text-left active:scale-[0.98] transition-transform w-full block"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gift className="w-10 h-10 text-amber-300 dark:text-amber-500/50" />
                      </div>
                    )}
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-extrabold">
                      🎁 교환권
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 rounded-full p-1.5 bg-white dark:bg-[#0A0A0A]/85 backdrop-blur-sm">
                      <Heart className="w-3 h-3 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                    </span>
                  </div>
                  <div className="mt-2">
                    {p.brand_name && (
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">{p.brand_name}</p>
                    )}
                    <p className="text-[12px] text-gray-900 dark:text-white leading-tight line-clamp-2">{p.name}</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-[13px] font-extrabold text-gray-900 dark:text-white">{formatNumber(p.price)}</span>
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">딜</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
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
