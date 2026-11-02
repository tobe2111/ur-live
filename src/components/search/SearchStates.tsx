import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChartIcon, ClockIcon } from '@/components/icons/urdeal-icons'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import BrandLoader from '@/components/brand/BrandLoader'
import { usePopularSearches } from '@/hooks/queries/usePopularSearches'
import Udal from '@/components/mascot/Udal'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 10차 ② — 지운 검색어는 작아지며 사라지고, 남은 검색어는 제자리로 미끄러져 빈자리를 채운다(FLIP).
injectMotionCss('ur-m-chipout', `@keyframes ur-chip-out { to { opacity: 0; transform: scale(.6); } }.ur-rise.ur-chip-out { pointer-events: none; animation: ur-chip-out .2s ease-in forwards; }@media (prefers-reduced-motion: reduce){.ur-rise.ur-chip-out{animation:none!important;opacity:0}}`)
injectMotionCss('ur-m-rise', `@keyframes ur-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }.ur-rise { animation: ur-rise .35s cubic-bezier(.16,1,.3,1) both; }@media (prefers-reduced-motion: reduce){.ur-rise{animation:none!important}}`)

interface SearchStatesProps {
  loading: boolean
  error: string
  query: string
  hasResults: boolean
  // 🛡️ 2026-05-19: 0 건 시 오타 보정 제안 (Levenshtein, 백엔드 자동).
  suggestedQuery?: string | null
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

export default function SearchStates({ loading, error, query, hasResults, suggestedQuery }: SearchStatesProps) {
  const navigate = useNavigate()
  const [recent, setRecent] = useState<string[]>([])
  /**
   * 🛡️ 2026-05-19: 인기 검색어 — `popular_searches` 테이블 기반. 빈 쿼리 + 0건 결과 둘 다 표시.
   * 🔀 2026-09-04: 자체 fetch → **공유 훅**(`usePopularSearches`). 검색 결과 화면이 같은 자리에
   *   하드코딩 6개를 띄우고 있었어서, 값을 한 곳으로 모았다 — 두 벌이면 결국 갈린다.
   *   (RQ 캐시라 두 화면이 오가도 요청은 한 번이다.)
   */
  const popular = usePopularSearches(10)

  useEffect(() => {
    if (!query) setRecent(loadRecent())
  }, [query])

  // 지우는 중인 검색어 — 사라지는 0.2초 동안만 둔다. 그 뒤 실제로 빼고, 남은 칩을 옛 자리에서 새 자리로 미끄러뜨린다.
  const [leaving, setLeaving] = useState<string | null>(null)
  const chipRefs = useRef(new Map<string, HTMLDivElement>())
  const before = useRef<Map<string, DOMRect> | null>(null)
  const removeOne = (q: string) => {
    if (leaving) return
    setLeaving(q)
    window.setTimeout(() => {
      before.current = new Map([...chipRefs.current].filter(([k]) => k !== q).map(([k, el]) => [k, el.getBoundingClientRect()]))
      setLeaving(null)
      setRecent((cur) => { const next = cur.filter(x => x !== q); saveRecent(next); return next })
    }, 200)
  }
  useLayoutEffect(() => {
    const prev = before.current
    if (!prev) return
    before.current = null
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const [k, el] of chipRefs.current) {
      const a = prev.get(k)
      if (!a || typeof el.animate !== 'function') continue
      const b = el.getBoundingClientRect()
      const dx = a.left - b.left, dy = a.top - b.top
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1)' })
    }
  }, [recent])
  const clearAll = () => {
    setRecent([])
    saveRecent([])
  }

  // Loading State — 🎯 2026-07-18 로딩 단일화 (검색 결과 영역 인라인)
  if (loading) return <BrandLoader label="검색 중" />

  // Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        {/* 🦦 2026-10-07 유달이 — 오류는 '미안' 얼굴(빨간 경고 원 대체). */}
        <Udal mood="oops" size={112} className="mb-4" />
        <p className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">오류가 발생했습니다</p>
        <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand text-white text-[15px] rounded-lg"
          >
            다시 시도
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-brand text-white rounded-full text-[15px] font-medium hover:bg-brand-dark transition-colors"
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
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <h3 className="text-[13px] font-medium text-gray-900 dark:text-white">최근 검색어</h3>
              </div>
              <button
                onClick={clearAll}
                className="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                전체 삭제
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* 🎬 2026-11-02 시안 5차: 최근 검색어가 하나씩 차례로 올라온다(처음 그릴 때만). */}
              {recent.map((q, qi) => (
                <div
                  key={q}
                  ref={(el) => { if (el) chipRefs.current.set(q, el); else chipRefs.current.delete(q) }}
                  aria-hidden={leaving === q || undefined}
                  style={{ animationDelay: leaving === q ? '0ms' : `${Math.min(qi, 8) * 40}ms` }}
                  className={`ur-rise${leaving === q ? ' ur-chip-out' : ''} inline-flex items-center gap-2 pl-3 pr-1 py-2 bg-gray-100 dark:bg-[#1D1F29] rounded-full text-[12px] text-gray-700 dark:text-gray-300`}
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
                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-[#2C2F35] transition-colors"
                  >
                    <X className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 mb-4">
            <Udal mood="hello" size={96} className="mb-3" />
            <p className="text-[15px] font-medium text-gray-900 dark:text-white mb-1">검색어를 입력해주세요</p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">상품명 또는 판매자명으로 검색할 수 있습니다</p>
          </div>
        )}

        {/* 🛡️ 2026-05-19: 인기 검색어 (popular_searches 기반). 사용자 발견성 ↑. */}
        {popular.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ChartIcon className="w-4 h-4 text-rose-500" />
              <h3 className="text-[13px] font-medium text-gray-900 dark:text-white">인기 검색어</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {popular.map((q, i) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(q)}`)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[12px] font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                >
                  <span className="text-rose-400 dark:text-rose-500 font-medium text-[12px]">#{i + 1}</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // No Results State — 🛡️ 2026-05-19: 오타 보정 제안 + 인기 검색어 폴백.
  if (query && !hasResults) {
    return (
      <div className="py-10">
        <div className="flex flex-col items-center justify-center mb-6">
          {/* 🦦 2026-10-07 유달이 — 찾는 게 없을 땐 갸웃. */}
          <Udal mood="notFound" size={112} className="mb-3" />
          <p className="text-[15px] font-medium text-gray-900 dark:text-white mb-1">'{query}' 검색 결과가 없어요</p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">다른 검색어를 시도해보세요</p>
        </div>

        {/* 오타 보정 제안 — distance ≤ 2 인 popular 키워드 */}
        {suggestedQuery && (
          <div className="mx-auto max-w-md mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-center">
            <p className="text-[13px] text-gray-700 dark:text-gray-300 mb-2">혹시 이걸 찾으셨나요?</p>
            <button
              type="button"
              onClick={() => navigate(`/search?q=${encodeURIComponent(suggestedQuery)}`)}
              className="text-[17px] font-bold text-rose-600 dark:text-rose-300 hover:underline"
            >
              {suggestedQuery} →
            </button>
          </div>
        )}

        {/* 인기 검색어 폴백 */}
        {popular.length > 0 && (
          <div className="mx-auto max-w-md">
            <div className="flex items-center gap-2 mb-3 justify-center">
              <ChartIcon className="w-4 h-4 text-rose-500" />
              <h3 className="text-[13px] font-medium text-gray-900 dark:text-white">지금 인기 검색어</h3>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {popular.slice(0, 8).map((q, i) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(q)}`)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[12px] font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                >
                  <span className="text-rose-400 dark:text-rose-500 font-medium text-[12px]">#{i + 1}</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
