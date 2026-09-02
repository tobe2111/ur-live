import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { useSearchInfinite } from '@/hooks/useSearch'
import { isVoucherCategory } from '@/shared/constants/voucher-categories'
import SearchHeader from '@/components/search/SearchHeader'
import SearchStates, { addRecentSearch } from '@/components/search/SearchStates'
import ProductCard from '@/components/search/ProductCard'
import SortFilterBar from '@/components/search/SortFilterBar'

interface Product {
  id: number
  name: string
  description: string
  price: number
  original_price: number
  discount_rate: number
  image_url: string
  stock: number
  seller_name: string
  seller_username: string
  // 🛡️ 2026-05-19: 검색 결과 탭 (전체/교환권/쇼핑) 분리용.
  deal_only?: number
  // 🖥️ 2026-07-16: 이용권(voucher 카테고리) 판별용 — 검색을 이용권만으로 필터.
  category?: string
}


interface SearchSuggestion {
  type: 'product' | 'seller'
  text: string
}

const DEFAULT_RELATED_KEYWORD_KEYS = [
  { key: 'popular', defaultValue: '인기상품' },
  { key: 'new', defaultValue: '신상품' },
  { key: 'sale', defaultValue: '할인특가' },
  { key: 'freeShipping', defaultValue: '무료배송' },
  { key: 'bestSeller', defaultValue: '베스트셀러' },
  { key: 'limited', defaultValue: '한정판' },
]

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const query = searchParams.get('q') || ''
  /** 🎟️ 검색 범위 — 'exchange'(교환권 전용, `/vouchers` 에서 진입) / 그 외 = 이용권만(기본). */
  const scope = searchParams.get('scope') || ''

  // 🛡️ 2026-05-19: 무한 스크롤 — useInfiniteQuery 로 페이지 누적.
  const {
    data: infiniteData,
    isLoading: loading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearchInfinite(query)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  // 모든 페이지의 products 합치기 + total 은 첫 페이지 값.
  const searchResult = infiniteData
    ? {
        products: infiniteData.pages.flatMap(p => p.products),
        total: infiniteData.pages[0]?.total ?? 0,
        page: 1, limit: 50,
      }
    : undefined

  // IntersectionObserver — sentinel 닿으면 다음 페이지 자동 fetch.
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) fetchNextPage()
    }, { threshold: 0.1 })
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high' | 'newest'>('relevance')
  const [priceRange] = useState<{ min: number; max: number }>({ min: 0, max: 1000000 })
  // 🛡️ 2026-05-19: 검색 결과 타입 탭 (전체/교환권/쇼핑) — 사용자가 결과 안에서 분류 가능.

  useEffect(() => { document.title = t('search.pageTitle', { defaultValue: '검색 - 유어딜' }) }, [t])

  useEffect(() => {
    if (isError) {
      setError(t('search.errorMsg', { defaultValue: '검색 중 오류가 발생했습니다' }))
    }
  }, [isError])

  const getDiscountedPrice = (price: number, discountRate: number) => {
    // 🛡️ 2026-04-22: 서버 라운딩(Math.round) 과 통일 — 표시-결제 1원 차이 방지
    return Math.round(price * (1 - discountRate / 100))
  }

  const handleSearch = (searchQuery: string) => {
    // 🛡️ 2026-05-19: 최근 검색어 저장 (사용자 요청).
    addRecentSearch(searchQuery)
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
  }

  const loadSuggestions = async (value: string) => {
    if (!value || value.length < 2) {
      setSuggestions([])
      return
    }

    try {
      // 🔎 2026-07-20 (대표 — 검색 자동완성 수리): `/api/search/suggestions` 는 { data: string[] } 를 반환.
      //   기존 코드는 `data.suggestions`(존재 X)를 읽어 자동완성이 항상 비어 있었음. string[] → {type,text} 매핑.
      const response = await api.get(`/api/search/suggestions?q=${encodeURIComponent(value)}`)
      const list = response.data?.data
      if (Array.isArray(list)) {
        setSuggestions(list.filter((s: unknown): s is string => typeof s === 'string' && !!s)
          .map((text: string) => ({ type: 'product' as const, text })))
      } else {
        setSuggestions([])
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to load suggestions:', error)
    }
  }

  const getSortedAndFilteredProducts = () => {
    if (!searchResult?.products) return []

    let filtered = (searchResult.products as Product[]).filter(product => {
      const price = getDiscountedPrice(product.price, product.discount_rate || 0)
      if (price < priceRange.min || price > priceRange.max) return false
      // 🎟️ 2026-08-08 (대표 — "교환권 페이지에선 교환권만 검색되게"): 검색 범위가 **어디서 왔는지**에
      //   따라 정반대다. 그래서 `?scope=` 로 가른다 — 없으면 종전(이용권만) 그대로.
      //     · scope=exchange : 교환권(deal_only=1)만 — `/vouchers` 의 검색 버튼이 붙여 보낸다
      //     · 그 외(기본)     : 이용권만 (2026-07-16 대표 "검색은 무조건 이용권만")
      //   ⚠️ 기본값을 바꾸지 않는다 — 홈·지도에서 온 검색은 지금 동작이 맞다.
      if (scope === 'exchange') return Number(product.deal_only) === 1
      // category 누락 응답에도 결과가 비지 않도록 deal_only 를 1차 가드로 사용(robust).
      if (Number(product.deal_only) === 1) return false
      if (product.category && !isVoucherCategory(product.category)) return false
      return true
    })

    switch (sortBy) {
      case 'price_low':
        return filtered.sort((a, b) =>
          getDiscountedPrice(a.price, a.discount_rate) - getDiscountedPrice(b.price, b.discount_rate)
        )
      case 'price_high':
        return filtered.sort((a, b) =>
          getDiscountedPrice(b.price, b.discount_rate) - getDiscountedPrice(a.price, a.discount_rate)
        )
      case 'newest':
        return filtered.sort((a, b) => b.id - a.id)
      default:
        return filtered
    }
  }

  const products = getSortedAndFilteredProducts()
  // 🧹 2026-07-20 (소비자 감사): 결과 유무는 서버 total(교환권·쇼핑 포함 전체)이 아니라 **필터 후(이용권 전용)
  //   products.length** 기준. 서버 매칭이 전부 비-이용권이면 total>0 이라 빈 그리드에 "N개 결과"만 뜨던 버그.
  const hasResults = products.length > 0
  // 현재 로드분이 전부 필터로 걸러졌지만 다음 페이지가 남았으면 자동으로 더 불러와 '결과 없음' 오표시 방지.
  useEffect(() => {
    if (query.length >= 2 && products.length === 0 && hasNextPage && !isFetchingNextPage && !loading) {
      fetchNextPage()
    }
  }, [query, products.length, hasNextPage, isFetchingNextPage, loading, fetchNextPage])
  // 아직 필터 통과 결과가 0건인데 더 불러올 게 남아 있으면 '없음' 대신 로딩 유지(자동 페치 중).
  const stillLoadingResults = loading || (query.length >= 2 && products.length === 0 && (isFetchingNextPage || hasNextPage))
  const showResults = !stillLoadingResults && !error && query && hasResults

  const relatedKeywords = DEFAULT_RELATED_KEYWORD_KEYS.map(k => t(`search.related.${k.key}`, { defaultValue: k.defaultValue }))

  // 🛡️ 2026-07-03: min-h-screen(100vh) → min-h-[100dvh] — 인앱/웹뷰 하단 네비 실종 방지(룰 #8, /vouchers 와 동일).
  return (
    <div className="bg-white dark:bg-[#11141C] pb-safe-nav md:pb-20 min-h-[100dvh]">
      <SEO title={query ? t('search.seoTitleQuery', { query, defaultValue: `${query} 검색결과 - 유어딜` }) : t('search.pageTitle', { defaultValue: '검색 - 유어딜' })} description={t('search.seoDesc', { defaultValue: '유어딜에서 원하는 이용권을 검색하세요. 동네 가게 할인 이용권을 만나보세요.' })} url="/search" noindex />
      {/* Header */}
      <SearchHeader
        query={query}
        totalResults={searchResult?.total}
        onSearch={handleSearch}
        suggestions={suggestions}
        onLoadSuggestions={loadSuggestions}
      />

      {/* Content */}
      <div className="ur-content-wide px-4 lg:px-8 py-4">
        {/* States: Loading, Error, No Query, No Results */}
        <SearchStates
          loading={stillLoadingResults}
          error={error}
          query={query}
          hasResults={hasResults}
          suggestedQuery={infiniteData?.pages?.[0]?.suggested_query ?? null}
        />

        {/* Results Grid */}
        {showResults && (
          <>
            {/* 🖥️ 2026-07-16 (대표 — 검색은 이용권만): 교환권/쇼핑 타입 탭 제거(이용권 단일). */}

            {/* Sort and Filter Bar with chips */}
            <SortFilterBar
              totalResults={products.length}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

            {/* 2-column Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  highlightQuery={query}
                />
              ))}
            </div>

            {/* 🛡️ 2026-05-19: 무한 스크롤 sentinel + 로딩/더보기 UI */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center mt-6 pb-6">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400 disabled:opacity-50"
                >
                  {isFetchingNextPage ? '로딩 중...' : '더보기'}
                </button>
              </div>
            )}

            {/* Related Keywords Section */}
            <div className="mt-10 pt-8 border-t border-gray-100 dark:border-[#2C2F35]">
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">{t('search.relatedKeywords', { defaultValue: '함께 검색된 키워드' })}</h3>
              <div className="flex flex-wrap gap-2">
                {relatedKeywords.map((keyword) => (
                  <button
                    key={keyword}
                    onClick={() => handleSearch(keyword)}
                    className="px-4 py-2 rounded-full border border-gray-200 dark:border-[#2C2F35] text-[13px] text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-[#1D1F29] active:bg-gray-100 dark:bg-[#1D1F29] dark:active:bg-[#1D1F29] transition-colors"
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
