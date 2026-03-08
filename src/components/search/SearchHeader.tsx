import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'

interface SearchSuggestion {
  type: 'product' | 'seller'
  text: string
}

interface SearchHeaderProps {
  query: string
  totalResults?: number
  onSearch: (query: string) => void
  suggestions: SearchSuggestion[]
  onLoadSuggestions: (value: string) => void
}

export default function SearchHeader({
  query,
  totalResults,
  onSearch,
  suggestions,
  onLoadSuggestions
}: SearchHeaderProps) {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState(query)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query) {
      setInputValue(query)
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

  // 입력값 변경 시 자동완성 로드
  useEffect(() => {
    if (inputValue && inputValue.length >= 2) {
      onLoadSuggestions(inputValue)
      if (suggestions.length > 0) {
        setShowSuggestions(true)
      }
    } else {
      setShowSuggestions(false)
    }
  }, [inputValue, suggestions.length, onLoadSuggestions])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onSearch(inputValue.trim())
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (text: string) => {
    setInputValue(text)
    onSearch(text)
    setShowSuggestions(false)
  }

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-[#e5e5ea]">
      <div className="w-full px-4 py-3">
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
            {totalResults !== undefined && ` • ${totalResults}개 상품`}
          </p>
        )}
      </div>
    </div>
  )
}
