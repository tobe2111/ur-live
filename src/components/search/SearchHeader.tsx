import { useState, useEffect } from 'react'
import { BagIcon } from '@/components/icons/urdeal-icons'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SearchHeaderProps {
  query: string
  totalResults?: number
  onSearch: (query: string) => void
  onLoadSuggestions: (value: string) => void
  /**
   * 🔎 2026-09-30 — 제안은 여기서 **안 그린다**. 결과 자리에 들어서는
   * `SearchSuggestPanel` 이 그리고(대표 확정), 헤더는 *"지금 이 글자로 제안을 보여 줘"* 만 올린다.
   * 떠 있는 카드가 결과를 덮던 것이 대표 신고의 절반이었다 — 그래서 이 파일에서 드롭다운을 없앴다.
   */
  onPanelChange: (open: boolean, value: string) => void
}

export default function SearchHeader({
  query,
  totalResults,
  onSearch,
  onLoadSuggestions,
  onPanelChange,
}: SearchHeaderProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState(query)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (query) {
      setInputValue(query)
    }
  }, [query])

  /**
   * 🐛 2026-08-17 (UX 전수검사 P1): `/search?q=…` 로 **진입만 해도** 제안이 열린 채 남았다 —
   *   마운트 시 query→inputValue 동기화가 이 효과를 발화시켜, 사용자가 아무것도 안 했는데
   *   제안이 떠서 필터 칩을 가렸다. **입력창이 포커스된 동안만** 로드/오픈한다(입력 중 = 의도).
   */
  useEffect(() => {
    const open = isFocused && inputValue.trim().length >= 2
    // 패널 열림/닫힘은 **즉시** 반영한다(글자를 지웠는데 목록이 남아 있으면 안 된다).
    onPanelChange(open, inputValue)
    if (!open) return
    /**
     * ⏱️ 2026-09-30 — **디바운스**. 종전엔 키 입력마다 요청이 나갔다(한글 IME 는 자모마다 한 번).
     *   제안 한 번이 D1 쿼리 **세 개**라, "돈가스" 다섯 타에 15 쿼리가 나간다. 이 레포는 이미
     *   D1 일일 읽기 한도에 한 번 닿은 적이 있다(2026-09-02 소비자 API 전체 500).
     *   180ms 는 사람이 다음 글자를 치기 전 — 체감은 그대로고 요청만 준다.
     */
    const t = setTimeout(() => onLoadSuggestions(inputValue), 180)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, isFocused])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onSearch(inputValue.trim())
      onPanelChange(false, inputValue)
      // 제출했으면 키보드를 내린다 — 결과를 보려고 친 것이다.
      ;(document.activeElement as HTMLElement | null)?.blur?.()
    }
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
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => navigate(-1)} className="shrink-0 p-1">
          <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <div className="flex-1 relative">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              /* 🔴 blur 로 제안을 닫지 않는다 — 모바일에서 행을 탭하면 blur 가 click 보다 **먼저**
                    나서, 닫힌 뒤에 click 이 와 아무 일도 안 일어난다(자동완성 최다 버그).
                    닫는 건 선택·제출·지움 셋뿐이고, 패널이 결과를 덮지 않아 닫을 이유도 없다. */
              onBlur={() => { /* 의도적 무동작 — 위 주석 */ }}
              placeholder={t('search.inputPlaceholder', { defaultValue: '상품명, 브랜드, 셀러 검색' })}
              className={`w-full pl-10 pr-9 py-2 bg-gray-50 dark:bg-[#1D1F29] rounded-full text-[15px] text-gray-900 dark:text-white font-medium transition-all focus:outline-none ${
                isFocused ? 'border-2 border-gray-900 bg-white dark:bg-[#11141C]' : 'border-2 border-transparent'
              }`}
            />
            {inputValue && (
              <button type="button" onClick={() => { setInputValue(''); onPanelChange(false, '') }} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </button>
            )}
          </form>
        </div>
        <button onClick={() => navigate('/cart')} className="shrink-0 p-1">
          <BagIcon className="w-5 h-5 text-gray-900 dark:text-white" />
        </button>
      </div>
    </div>
  )
}
