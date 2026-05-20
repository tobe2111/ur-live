import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package, AlertCircle, Loader2, Clock, X } from 'lucide-react'

interface SearchStatesProps {
  loading: boolean
  error: string
  query: string
  hasResults: boolean
}

// 🛡️ 2026-05-19: 최근 검색어 — localStorage 'recent_searches' (최대 10개, 24h ~ 영구).
//   SearchPage / SearchHeader 진입 시 자동 표시.
const RECENT_KEY = 'recent_searches_v1'
const MAX_RECENT = 10

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : []
  } catch { return [] }
}
function saveRecent(list: string[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT))) } catch { /* ignore */ }
}
/** 외부에서 검색어 추가 — SearchPage 가 검색 실행 시 호출. */
export function addRecentSearch(query: string): void {
  const q = query.trim()
  if (!q) return
  const list = loadRecent().filter(x => x !== q)
  list.unshift(q)
  saveRecent(list)
}

export default function SearchStates({ loading, error, query, hasResults }: SearchStatesProps) {
  const navigate = useNavigate()
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    if (!query) setRecent(loadRecent())
  }, [query])

  const removeOne = (q: string) => {
    const next = recent.filter(x => x !== q)
    setRecent(next)
    saveRecent(next)
  }
  const clearAll = () => {
    setRecent([])
    saveRecent([])
  }

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#007aff] animate-spin mb-4" />
        <p className="text-[15px] text-[#6e6e73]">검색 중...</p>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-[#ff3b30]" />
        </div>
        <p className="text-[17px] font-semibold text-[#1d1d1f] mb-2">오류가 발생했습니다</p>
        <p className="text-[15px] text-[#6e6e73] mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg"
          >
            다시 시도
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-[#007aff] text-white rounded-full text-[15px] font-semibold hover:bg-[#0051d5] transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // No Query State — 최근 검색어가 있으면 표시.
  if (!query) {
    return (
      <div className="py-6">
        {recent.length > 0 ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <h3 className="text-[13px] font-bold text-gray-900 dark:text-white">최근 검색어</h3>
              </div>
              <button
                onClick={clearAll}
                className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                전체 삭제
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map(q => (
                <div
                  key={q}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1.5 bg-gray-100 dark:bg-[#1A1A1A] rounded-full text-[12px] text-gray-700 dark:text-gray-300"
                >
                  <button
                    onClick={() => navigate(`/search?q=${encodeURIComponent(q)}`)}
                    className="hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {q}
                  </button>
                  <button
                    onClick={() => removeOne(q)}
                    aria-label={`'${q}' 삭제`}
                    className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-[#2A2A2A] transition-colors"
                  >
                    <X className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-[17px] font-semibold text-gray-900 dark:text-white mb-2">검색어를 입력해주세요</p>
            <p className="text-[15px] text-gray-500 dark:text-gray-400">상품명 또는 판매자명으로 검색할 수 있습니다</p>
          </div>
        )}
      </div>
    )
  }

  // No Results State
  if (query && !hasResults) {
    return (
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
    )
  }

  return null
}
