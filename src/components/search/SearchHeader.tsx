import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, X, ShoppingBag } from 'lucide-react'

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
  const [isFocused, setIsFocused] = useState(false)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, suggestions.length])

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
    <div className="sticky top-0 z-50 bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => navigate(-1)} className="shrink-0 p-1">
          <ChevronLeft className="w-6 h-6 text-gray-900" />
        </button>
        <div className="flex-1 relative" ref={searchRef}>
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => { setIsFocused(true); if (suggestions.length > 0) setShowSuggestions(true) }}
              onBlur={() => setIsFocused(false)}
              placeholder="상품명, 브랜드, 셀러 검색"
              className={`w-full pl-10 pr-9 py-2.5 bg-gray-50 rounded-full text-[14px] text-gray-900 font-medium transition-all focus:outline-none ${
                isFocused ? 'border-2 border-gray-900 bg-white' : 'border-2 border-transparent'
              }`}
            />
            {inputValue && (
              <button type="button" onClick={() => { setInputValue(''); setShowSuggestions(false) }} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </form>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.text}-${index}`}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-b-0"
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <span className="text-[14px] text-gray-900 flex-1">{suggestion.text}</span>
                  {suggestion.type === 'seller' && (
                    <span className="rounded-full px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold">브랜드</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => navigate('/cart')} className="shrink-0 p-1">
          <ShoppingBag className="w-5 h-5 text-gray-900" />
        </button>
      </div>
    </div>
  )
}
