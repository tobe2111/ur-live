import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import TopNav from '@/components/main/TopNav'
import CategoryHeader from '@/components/browse/CategoryHeader'
import ProductGrid from '@/components/browse/ProductGrid'
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react'

interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  sold_count?: number
  stock: number
  category?: string
  seller_name?: string
  is_new?: boolean
  is_popular?: boolean
}

type SortOption = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'discount'

const SORT_LABELS: Record<SortOption, string> = {
  popular: '인기순',
  newest: '최신순',
  price_asc: '낮은 가격순',
  price_desc: '높은 가격순',
  discount: '할인율순',
}

const PRICE_RANGES = [
  { label: '전체', min: 0, max: Infinity },
  { label: '1만원 미만', min: 0, max: 10000 },
  { label: '1만~3만원', min: 10000, max: 30000 },
  { label: '3만~5만원', min: 30000, max: 50000 },
  { label: '5만~10만원', min: 50000, max: 100000 },
  { label: '10만원 이상', min: 100000, max: Infinity },
]

export default function BrowsePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category') || 'all'

  // 필터/정렬 상태
  const [sortBy, setSortBy] = useState<SortOption>('popular')
  const [priceRangeIdx, setPriceRangeIdx] = useState(0)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [useCustomPrice, setUseCustomPrice] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [category])

  // 정렬 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handler = () => setShowSortDropdown(false)
    if (showSortDropdown) {
      document.addEventListener('click', handler)
      return () => document.removeEventListener('click', handler)
    }
  }, [showSortDropdown])

  async function loadProducts() {
    try {
      setLoading(true)
      const url = category === 'all'
        ? '/api/products?limit=100'
        : `/api/products?category=${encodeURIComponent(category)}&limit=100`

      const response = await api.get(url)
      if (response.data.success) {
        setProducts(response.data.data || [])
      }
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setLoading(false)
    }
  }

  // 필터 + 정렬 적용 (클라이언트 사이드)
  const filteredAndSorted = useMemo(() => {
    let result = [...products]

    // 가격 필터
    if (useCustomPrice) {
      const min = Number(minPrice) || 0
      const max = Number(maxPrice) || Infinity
      result = result.filter(p => {
        const price = p.current_price || p.price
        return price >= min && price <= max
      })
    } else if (priceRangeIdx > 0) {
      const range = PRICE_RANGES[priceRangeIdx]
      result = result.filter(p => {
        const price = p.current_price || p.price
        return price >= range.min && price < range.max
      })
    }

    // 정렬
    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0))
        break
      case 'newest':
        // API에서 이미 최신순 정렬 → 기본 유지
        break
      case 'price_asc':
        result.sort((a, b) => (a.current_price || a.price) - (b.current_price || b.price))
        break
      case 'price_desc':
        result.sort((a, b) => (b.current_price || b.price) - (a.current_price || a.price))
        break
      case 'discount':
        result.sort((a, b) => b.discount_rate - a.discount_rate)
        break
    }

    return result
  }, [products, sortBy, priceRangeIdx, minPrice, maxPrice, useCustomPrice])

  const activeFilterCount = [
    priceRangeIdx > 0 || useCustomPrice,
    sortBy !== 'popular',
  ].filter(Boolean).length

  function resetFilters() {
    setSortBy('popular')
    setPriceRangeIdx(0)
    setMinPrice('')
    setMaxPrice('')
    setUseCustomPrice(false)
  }

  return (
    <div className="min-h-screen bg-background max-w-screen-sm mx-auto">
      <TopNav />

      <main className="px-4 py-4">
        {/* 카테고리 제목 */}
        <CategoryHeader category={category} productCount={filteredAndSorted.length} />

        {/* 필터/정렬 바 */}
        <div className="flex items-center justify-between mb-4 gap-2">
          {/* 정렬 드롭다운 */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowSortDropdown(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              {SORT_LABELS[sortBy]}
              <ChevronDown className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showSortDropdown && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setShowSortDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      sortBy === opt
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {SORT_LABELS[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 필터 버튼 */}
            <button
              onClick={() => setShowFilterPanel(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-full text-sm font-medium shadow-sm transition-colors ${
                activeFilterCount > 0
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              필터
              {activeFilterCount > 0 && (
                <span className="ml-0.5 bg-white text-primary rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* 필터 초기화 */}
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2 py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 필터 패널 (접이식) */}
        {showFilterPanel && (
          <div className="mb-4 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">가격 필터</h3>

            {/* 프리셋 가격 범위 */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PRICE_RANGES.map((range, idx) => (
                <button
                  key={idx}
                  onClick={() => { setPriceRangeIdx(idx); setUseCustomPrice(false) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    !useCustomPrice && priceRangeIdx === idx
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {/* 직접 입력 */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="최소 금액"
                value={minPrice}
                onChange={e => { setMinPrice(e.target.value); setUseCustomPrice(true); setPriceRangeIdx(0) }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <span className="text-gray-400 text-sm">~</span>
              <input
                type="number"
                placeholder="최대 금액"
                value={maxPrice}
                onChange={e => { setMaxPrice(e.target.value); setUseCustomPrice(true); setPriceRangeIdx(0) }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setShowFilterPanel(false)}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
              >
                적용
              </button>
            </div>
          </div>
        )}

        {/* 상품 그리드 */}
        <ProductGrid products={filteredAndSorted} loading={loading} />
      </main>

    </div>
  )
}
