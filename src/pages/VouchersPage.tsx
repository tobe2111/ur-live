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

const PAGE_SIZE = 30

export default function VouchersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const brand = searchParams.get('brand') || ''
  const category = searchParams.get('category') || ''

  const [brands, setBrands] = useState<BrandSummary[]>([])
  const [products, setProducts] = useState<VoucherProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadMoreRef = useRef<HTMLDivElement>(null)

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

  // 브랜드 칩 로드 (한 번만)
  useEffect(() => {
    let cancelled = false
    api.get('/api/home/categories').then(r => {
      if (cancelled) return
      if (r.data?.success && Array.isArray(r.data.data)) {
        // 모든 카테고리의 brands 를 집계.
        const allBrands: BrandSummary[] = []
        for (const cat of r.data.data) {
          if (Array.isArray(cat.brands)) {
            for (const b of cat.brands) {
              if (!allBrands.find(x => x.brand_name === b.brand_name)) {
                allBrands.push(b)
              }
            }
          }
        }
        // 인기순 (cnt DESC) 으로 정렬, 상위 20개.
        allBrands.sort((a, b) => (b.cnt || 0) - (a.cnt || 0))
        setBrands(allBrands.slice(0, 20))
      }
    }).catch(() => { /* graceful */ })
    return () => { cancelled = true }
  }, [])

  // 상품 로드 (페이지 변경 / 필터 변경 시)
  const loadProducts = useCallback((pageNum: number, reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true)
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(PAGE_SIZE),
      deal_only: '1',
      sort: 'popular',
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
  }, [brand, category])

  useEffect(() => {
    loadProducts(1, true)
  }, [brand, category, loadProducts])

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

      {/* 🛡️ 2026-05-19: 딜 잔액 + 충전/공구 유도 (사용자 요청). */}
      <div className="ur-content-wide px-4 lg:px-8 pt-3">
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10 border border-amber-200 dark:border-amber-500/30 p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">내 딜 잔액</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-[24px] font-extrabold text-gray-900 dark:text-white">
              {dealBalance == null ? '...' : formatNumber(dealBalance)}
            </span>
            <span className="text-[14px] font-bold text-amber-600 dark:text-amber-400">딜</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => navigate('/points/charge')}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[12px] active:scale-95 transition-transform"
            >
              <Sparkles className="w-4 h-4" />
              충전
            </button>
            <button
              type="button"
              onClick={() => navigate('/group-buy')}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl bg-white dark:bg-[#1A1A1A] border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[12px] active:scale-95 transition-transform"
            >
              <Users className="w-4 h-4" />
              공동구매
            </button>
            <button
              type="button"
              onClick={() => navigate('/user/profile')}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl bg-white dark:bg-[#1A1A1A] border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-[12px] active:scale-95 transition-transform"
            >
              <ArrowRight className="w-4 h-4" />
              친구 추천
            </button>
          </div>
          {/* 잔액 부족 안내 */}
          {dealBalance != null && dealBalance < 10000 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2.5 leading-relaxed">
              💡 딜이 부족할 땐 <strong>충전</strong> (1원=1딜), <strong>공동구매 참여</strong> (보너스 적립), <strong>친구 추천</strong> (5% 보상) 로 채울 수 있어요.
            </p>
          )}
        </div>
      </div>

      {/* 브랜드 칩 그리드 */}
      {!brand && brands.length > 0 && (
        <div className="ur-content-wide px-4 lg:px-8 py-4">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">인기 브랜드</h2>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {brands.map(b => (
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
