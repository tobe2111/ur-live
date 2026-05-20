import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { useSearchInfinite } from '@/hooks/useSearch'
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
}

type TypeTab = 'all' | 'voucher' | 'shop'

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
  const [typeTab, setTypeTab] = useState<TypeTab>('all')

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
      const response = await api.get(`/api/search/suggestions?q=${encodeURIComponent(value)}`)
      if (response.data.success) {
        setSuggestions(response.data.data.suggestions || [])
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
      // 🛡️ 2026-05-19: 타입 탭 필터 (교환권 vs 쇼핑).
      if (typeTab === 'voucher' && Number(product.deal_only) !== 1) return false
      if (typeTab === 'shop' && Number(product.deal_only) === 1) return false
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
  const hasResults = !!(searchResult && searchResult.total > 0)
  const showResults = !loading && !error && query && hasResults

  const relatedKeywords = DEFAULT_RELATED_KEYWORD_KEYS.map(k => t(`search.related.${k.key}`, { defaultValue: k.defaultValue }))

  return (
    <div className="bg-white dark:bg-[#0A0A0A] pb-safe-nav md:pb-20 min-h-screen">
      <SEO title={query ? t('search.seoTitleQuery', { query, defaultValue: `${query} 검색결과 - 유어딜` }) : t('search.pageTitle', { defaultValue: '검색 - 유어딜' })} description={t('search.seoDesc', { defaultValue: '유어딜에서 원하는 상품을 검색하세요. 라이브 커머스 최저가 상품을 만나보세요.' })} url="/search" noindex />
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
          loading={loading}
          error={error}
          query={query}
          hasResults={hasResults}
        />

        {/* Results Grid */}
        {showResults && (
          <>
            {/* 🛡️ 2026-05-19: 타입 탭 (전체/교환권/쇼핑) — 결과 안에서 분류. */}
            {(() => {
              const all = (searchResult.products as Product[]) || []
              const voucherCount = all.filter(p => Number(p.deal_only) === 1).length
              const shopCount = all.length - voucherCount
              return (
                <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
                  {[
                    { key: 'all' as TypeTab, label: '전체', count: all.length },
                    { key: 'voucher' as TypeTab, label: '🎁 교환권', count: voucherCount },
                    { key: 'shop' as TypeTab, label: '🛒 쇼핑', count: shopCount },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setTypeTab(tab.key)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                        typeTab === tab.key
                          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300'
                      } ${tab.count === 0 && tab.key !== 'all' ? 'opacity-40' : ''}`}
                      disabled={tab.count === 0 && tab.key !== 'all'}
                    >
                      {tab.label} <span className="text-[10px] opacity-70">({tab.count})</span>
                    </button>
                  ))}
                </div>
              )
            })()}

            {/* Sort and Filter Bar with chips */}
            <SortFilterBar
              totalResults={searchResult.total}
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
            <div className="mt-10 pt-8 border-t border-gray-100 dark:border-[#1A1A1A]">
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">{t('search.relatedKeywords', { defaultValue: '함께 검색된 키워드' })}</h3>
              <div className="flex flex-wrap gap-2">
                {relatedKeywords.map((keyword) => (
                  <button
                    key={keyword}
                    onClick={() => handleSearch(keyword)}
                    className="px-4 py-2 rounded-full border border-gray-200 dark:border-[#2A2A2A] text-[13px] text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-[#121212] active:bg-gray-100 dark:active:bg-[#1A1A1A] transition-colors"
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
