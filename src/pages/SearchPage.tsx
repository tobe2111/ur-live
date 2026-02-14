import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Search, Package, AlertCircle, Loader2 } from 'lucide-react'
import MobileFooter from '@/components/MobileFooter'

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

interface SearchResult {
  products: Product[]
  total: number
  query: string
  limit: number
  offset: number
}

interface SearchSuggestion {
  type: 'product' | 'seller'
  text: string
}

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q') || ''
  
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inputValue, setInputValue] = useState(query)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query) {
      performSearch()
      setInputValue(query)
    } else {
      setLoading(false)
    }
  }, [query])

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 검색 자동완성 디바운스
  useEffect(() => {
    if (!inputValue || inputValue.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const response = await axios.get(`/api/search/suggestions?q=${encodeURIComponent(inputValue)}`)
        if (response.data.success) {
          setSuggestions(response.data.data.suggestions || [])
          setShowSuggestions(true)
        }
      } catch (error) {
        console.error('Failed to load suggestions:', error)
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [inputValue])

  const performSearch = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await axios.get('/api/products/search', {
        params: { q: query, limit: 20, offset: 0 }
      })
      
      if (response.data.success) {
        setSearchResult(response.data.data)
      } else {
        setError(response.data.error || '검색에 실패했습니다')
      }
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.response?.data?.error || '검색 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const getDiscountedPrice = (price: number, discountRate: number) => {
    return Math.floor(price * (1 - discountRate / 100))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(inputValue)}`)
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (text: string) => {
    setInputValue(text)
    navigate(`/search?q=${encodeURIComponent(text)}`)
    setShowSuggestions(false)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-[#e5e5ea]">
        <div className="max-w-screen-xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f5f5f7] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#1d1d1f]" />
            </button>
            
            {/* 검색 입력창 */}
            <div className="flex-1 relative" ref={searchRef}>
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6e6e73]" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setShowSuggestions(true)
                    }
                  }}
                  placeholder="상품명 또는 판매자명 검색"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#f5f5f7] rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </form>
              
              {/* 자동완성 드롭다운 */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg border border-[#e5e5ea] overflow-hidden z-50">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion.text)}
                      className="w-full px-4 py-3 text-left hover:bg-[#f5f5f7] transition-colors flex items-center gap-2 border-b border-[#e5e5ea] last:border-b-0"
                    >
                      <Search className="w-4 h-4 text-[#6e6e73]" />
                      <span className="text-[15px] text-[#1d1d1f]">{suggestion.text}</span>
                      {suggestion.type === 'seller' && (
                        <span className="ml-auto text-[12px] text-[#6e6e73] bg-[#f5f5f7] px-2 py-0.5 rounded-full">
                          판매자
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {query && (
            <p className="text-[13px] text-[#6e6e73] mt-2 ml-[52px]">
              "{query}"
              {searchResult && ` • ${searchResult.total}개 상품`}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-[#007aff] animate-spin mb-4" />
            <p className="text-[15px] text-[#6e6e73]">검색 중...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-[#ff3b30]" />
            </div>
            <p className="text-[17px] font-semibold text-[#1d1d1f] mb-2">오류가 발생했습니다</p>
            <p className="text-[15px] text-[#6e6e73] mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-[#007aff] text-white rounded-full text-[15px] font-semibold hover:bg-[#0051d5] transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        )}

        {/* No Query */}
        {!loading && !error && !query && (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="w-16 h-16 text-[#6e6e73] mb-4" />
            <p className="text-[17px] font-semibold text-[#1d1d1f] mb-2">검색어를 입력해주세요</p>
            <p className="text-[15px] text-[#6e6e73]">상품명 또는 판매자명으로 검색할 수 있습니다</p>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && query && searchResult && searchResult.total === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="w-16 h-16 text-[#6e6e73] mb-4" />
            <p className="text-[17px] font-semibold text-[#1d1d1f] mb-2">검색 결과가 없습니다</p>
            <p className="text-[15px] text-[#6e6e73] mb-6">다른 검색어를 시도해보세요</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-[#007aff] text-white rounded-full text-[15px] font-semibold hover:bg-[#0051d5] transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        )}

        {/* Results Grid */}
        {!loading && !error && searchResult && searchResult.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {searchResult.products.map((product) => {
              const discountedPrice = getDiscountedPrice(product.price, product.discount_rate)
              
              return (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  {/* 상품 이미지 */}
                  <div className="relative aspect-square overflow-hidden bg-[#f5f5f7]">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-[#6e6e73]" />
                      </div>
                    )}
                    
                    {/* 품절 오버레이 */}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-[15px] font-bold">품절</span>
                      </div>
                    )}
                    
                    {/* 할인율 배지 */}
                    {product.discount_rate > 0 && product.stock > 0 && (
                      <div className="absolute top-2 left-2 bg-[#ff3b30] text-white px-2 py-1 rounded-lg">
                        <span className="text-[12px] font-bold">{product.discount_rate}%</span>
                      </div>
                    )}
                  </div>

                  {/* 상품 정보 */}
                  <div className="p-3">
                    {/* 판매자명 */}
                    <p className="text-[11px] text-[#6e6e73] mb-1 line-clamp-1">
                      {product.seller_name || product.seller_username}
                    </p>
                    
                    {/* 상품명 */}
                    <h3 className="text-[14px] font-semibold text-[#1d1d1f] mb-2 line-clamp-2 min-h-[40px]">
                      {product.name}
                    </h3>

                    {/* 가격 */}
                    <div className="flex flex-col gap-1">
                      {product.discount_rate > 0 ? (
                        <>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[#ff3b30] text-[14px] font-bold">
                              {product.discount_rate}%
                            </span>
                            <span className="text-[#1d1d1f] text-[16px] font-bold">
                              {discountedPrice.toLocaleString()}원
                            </span>
                          </div>
                          <span className="text-[#8e8e93] text-[12px] line-through">
                            {product.price.toLocaleString()}원
                          </span>
                        </>
                      ) : (
                        <span className="text-[#1d1d1f] text-[16px] font-bold">
                          {product.price.toLocaleString()}원
                        </span>
                      )}
                    </div>

                    {/* 재고 경고 */}
                    {product.stock > 0 && product.stock <= 10 && (
                      <p className="text-[11px] text-[#ff9500] font-semibold mt-2">
                        재고 {product.stock}개
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Mobile Footer */}
        <MobileFooter />
      </div>
    </div>
  )
}
