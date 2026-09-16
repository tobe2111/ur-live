import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, X, ShoppingBag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
  // 🐛 2026-08-17 (UX 전수검사 P1): `/search?q=…` 로 **진입만 해도** 드롭다운이 결과 위에 열린 채
  //   남았다 — 마운트 시 query→inputValue 동기화가 이 효과를 발화시켜, 사용자가 아무것도 안 했는데
  //   자동완성이 떠서 필터 칩을 가렸다. **입력창이 포커스된 동안만** 로드/오픈한다(입력 중 = 의도).
  useEffect(() => {
    if (isFocused && inputValue && inputValue.length >= 2) {
      onLoadSuggestions(inputValue)
      if (suggestions.length > 0) {
        setShowSuggestions(true)
      }
    } else if (!inputValue || inputValue.length < 2) {
      setShowSuggestions(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, suggestions.length, isFocused])

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

  /**
   * 🐛 2026-09-15 (화면 고정 재조사 — 실측): `sticky top-0` 이 md+ 에서 **전역 DesktopTopNav 를 덮었다.**
   *   둘 다 `top-0` 에 붙는데 이쪽 `z-50` 이 네비 `z-40` 보다 높다. 실측 @900(스크롤 500):
   *   네비 0~114 위로 이 바가 0~65 를 덮어 **네비 아래 49px 만 삐져나온 반쪽 바**가 남았다.
   *
   *   ⚠️ **오프셋 숫자로 고치지 않는다.** 2026-08 에 같은 자리를 `md:top-[102px]` 로 고쳤었는데
   *   한 달 만에 네비가 102 → 114 로 자라 그 값이 틀려졌다. 이 자리는 네비 높이를 **알 수 없어야** 한다.
   *
   *   ⇒ md+ 에서는 **고정을 풀기만 한다.** 그 구간엔 네비가 자체 검색창을 이미 띄우고 있어
   *   (`DesktopTopNav` 의 검색 form — `/map` 에서만 숨김) 이 바까지 고정할 이유가 없다.
   *   형제 `/browse` 는 같은 헤더를 아예 `md:hidden` 으로 없앤다 — 이쪽은 자동완성을 살리려고
   *   숨기지 않고 **스크롤을 따라가게만** 한다(기능 손실 0, 겹침 0, 외울 숫자 0).
   *   모바일(<md)은 네비가 `hidden md:block` 이라 없으므로 `top-0` 고정 그대로다.
   */
  return (
    <div className="sticky top-0 md:static z-50 bg-white dark:bg-[#11141C]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => navigate(-1)} className="shrink-0 p-1">
          <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <div className="flex-1 relative" ref={searchRef}>
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => { setIsFocused(true); if (suggestions.length > 0) setShowSuggestions(true) }}
              onBlur={() => setIsFocused(false)}
              placeholder={t('search.inputPlaceholder', { defaultValue: '상품명, 브랜드, 셀러 검색' })}
              className={`w-full pl-10 pr-9 py-2.5 bg-gray-50 dark:bg-[#1D1F29] rounded-full text-[14px] text-gray-900 dark:text-white font-medium transition-all focus:outline-none ${
                isFocused ? 'border-2 border-gray-900 bg-white dark:bg-[#11141C]' : 'border-2 border-transparent'
              }`}
            />
            {inputValue && (
              <button type="button" onClick={() => { setInputValue(''); setShowSuggestions(false) }} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </button>
            )}
          </form>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface rounded-xl shadow-lg border border-line overflow-hidden z-50">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.text}-${index}`}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-[#1D1F29] flex items-center gap-3 border-b border-gray-50 dark:border-[#2C2F35] last:border-b-0"
                >
                  <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-[14px] text-gray-900 dark:text-white flex-1">{suggestion.text}</span>
                  {suggestion.type === 'seller' && (
                    <span className="rounded-full px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold">브랜드</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => navigate('/cart')} className="shrink-0 p-1">
          <ShoppingBag className="w-5 h-5 text-gray-900 dark:text-white" />
        </button>
      </div>
    </div>
  )
}
