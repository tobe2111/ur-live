import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { useSearch } from '@/hooks/useSearch'
import SearchHeader from '@/components/search/SearchHeader'
import SearchStates from '@/components/search/SearchStates'
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
}

interface SearchSuggestion {
  type: 'product' | 'seller'
  text: string
}

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q') || ''
  
  // React Query 훅 사용 (2글자 이상만 검색)
  const { data: searchResult, isLoading: loading, isError } = useSearch(query)
  
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high' | 'newest'>('relevance')
  const [priceRange] = useState<{ min: number; max: number }>({ min: 0, max: 1000000 })

  useEffect(() => { document.title = '검색 - 유어딜' }, [])

  useEffect(() => {
    if (isError) {
      setError('검색 중 오류가 발생했습니다')
    }
  }, [isError])

  const getDiscountedPrice = (price: number, discountRate: number) => {
    return Math.floor(price * (1 - discountRate / 100))
  }

  const handleSearch = (searchQuery: string) => {
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
      console.error('Failed to load suggestions:', error)
    }
  }

  const getSortedAndFilteredProducts = () => {
    if (!searchResult?.products) return []
    
    let filtered = (searchResult.products as Product[]).filter(product => {
      const price = getDiscountedPrice(product.price, product.discount_rate || 0)
      return price >= priceRange.min && price <= priceRange.max
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

  return (
    <div className="bg-white pb-20">
      <SEO title={query ? `${query} 검색결과 - 유어딜` : '검색 - 유어딜'} description="유어딜에서 원하는 상품을 검색하세요. 라이브 커머스 최저가 상품을 만나보세요." url="/search" />
      {/* Header */}
      <SearchHeader
        query={query}
        totalResults={searchResult?.total}
        onSearch={handleSearch}
        suggestions={suggestions}
        onLoadSuggestions={loadSuggestions}
      />

      {/* Content */}
      <div className="w-full px-4 py-6">
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
            {/* Sort and Filter Bar */}
            <SortFilterBar
              totalResults={searchResult.total}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />
            
            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
      
    </div>
  )
}
