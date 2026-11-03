/**
 * ① 가게 찾기 — 2026-11-03 대표 확정 4화면 시안.
 *
 * 검색이 먼저다. 종전엔 검색 전에 서울 한복판 지도를 크게 띄웠는데, 아직 고를 것이 없는 지도는
 * 화면만 차지하고 손가락 제스처를 먹었다. 지도는 ② 확인 화면에서만 나온다.
 * 결과는 같은 화면에 바로 뜨고, 고르면 ②로 간다(이 화면엔 [다음] 버튼이 없다).
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, X } from 'lucide-react'
import { PinIcon } from '@/components/icons/urdeal-icons'
import { toRegisterPlace, type RegisterPlace } from '@/components/seller/StoreRegisterModal'
import type { KakaoPlace } from '@/components/KakaoMapPicker'
import { AGENCY_SIGNUP_PATH } from '@/shared/agency-copy'
import { PERSONAL_BROKER_SIGNUP_DISABLED } from '@/shared/feature-flags'

const SELL_STEPS = [
  { title: '이용권을 올려요', desc: '가격은 사장님이 정해요' },
  { title: '손님이 할인가로 미리 사요', desc: '폰에 QR' },
  { title: '매장에서 QR만 찍으면 끝', desc: '정산은 마이에서' },
] as const

export default function StoreFindStep({ onPick, hasAgency }: { onPick: (p: RegisterPlace) => void; hasAgency: boolean }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KakaoPlace[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [manual, setManual] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualAddr, setManualAddr] = useState('')
  const seq = useRef(0)

  // 치는 대로 찾는다(두 글자부터, 0.35초 쉬면). 늦게 온 옛 응답이 새 결과를 덮지 않게 순번을 단다.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults(null); return }
    const my = ++seq.current
    const id = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/kakao/place/search?query=${encodeURIComponent(q)}&size=15`)
        const json: any = await res.json()
        if (my === seq.current) setResults(json.data?.documents || json.documents || [])
      } catch {
        if (my === seq.current) setResults([])
      } finally {
        if (my === seq.current) setLoading(false)
      }
    }, 350)
    return () => clearTimeout(id)
  }, [query])

  if (manual) {
    const ok = manualName.trim().length >= 2
    return (
      <div className="ur-step-fwd">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] leading-snug text-gray-900 dark:text-white">가게 이름을 직접 적어 주세요</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">지도에 없는 가게는 핀이 바로 뜨지 않아요. 카카오맵에 등록되면 다시 고를 수 있어요.</p>
        <label className="mt-6 block">
          <span className="block text-[13px] text-ink-soft mb-2">가게 이름</span>
          <input value={manualName} onChange={(e) => setManualName(e.target.value)} autoFocus maxLength={60}
            className="w-full h-[52px] px-4 rounded-xl border-[1.5px] border-line bg-transparent text-[17px] text-gray-900 dark:text-white placeholder:text-ink-faint focus:border-brand focus:outline-none" />
        </label>
        <label className="mt-4 block">
          <span className="block text-[13px] text-ink-soft mb-2">주소 (선택)</span>
          <input value={manualAddr} onChange={(e) => setManualAddr(e.target.value)} maxLength={120}
            className="w-full h-[52px] px-4 rounded-xl border-[1.5px] border-line bg-transparent text-[17px] text-gray-900 dark:text-white placeholder:text-ink-faint focus:border-brand focus:outline-none" />
        </label>
        <button type="button" disabled={!ok} onClick={() => onPick({ name: manualName.trim(), address: manualAddr.trim() })}
          className="ur-btn ur-btn-lg ur-btn-primary w-full mt-6 disabled:opacity-40">이 가게로 진행</button>
        <button type="button" onClick={() => setManual(false)} className="w-full h-11 mt-1 text-[15px] text-ink-soft">검색으로 찾기</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <label className="mt-5 h-[52px] rounded-xl border-[1.5px] border-brand flex items-center gap-3 pl-4 pr-2">
        <Search size={20} strokeWidth={1.6} className="shrink-0 text-ink-soft" aria-hidden="true" />
        <span className="sr-only">가게 이름 또는 주소</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus enterKeyHint="search"
          placeholder="예: 성수 김밥천국"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none focus-visible:outline-none text-[17px] text-gray-900 dark:text-white placeholder:text-ink-faint" />
        {query && (
          <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}
            className="w-10 h-10 flex items-center justify-center text-ink-soft"><X size={18} strokeWidth={1.6} aria-hidden="true" /></button>
        )}
      </label>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-2 -mx-1 px-1" data-testid="store-find-results">
        {results === null ? (
          <div className="ur-rise">
            <p className="mt-6 text-[15px] font-medium text-gray-900 dark:text-white">등록하면 이렇게 팔아요</p>
            <ul className="mt-2">
              {SELL_STEPS.map((s, i) => (
                <li key={s.title} className={`py-3 text-[15px] text-gray-900 dark:text-white ${i < SELL_STEPS.length - 1 ? 'border-b border-rule' : ''}`}>
                  {s.title} <span className="text-[13px] text-ink-soft">· {s.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : loading && results.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-soft">찾는 중…</p>
        ) : results.length === 0 ? (
          <p className="mt-4 text-[15px] text-ink-soft">'{query.trim()}' 로 찾은 가게가 없어요. 이름을 줄이거나 동네를 함께 적어 보세요.</p>
        ) : (
          <>
            <p className="mt-3 text-[13px] text-ink-soft">{results.length}곳 찾았어요 · 내 가게를 눌러 주세요</p>
            <ul>
              {results.map((p, i) => (
                <li key={p.id || i} className="ur-rise border-b border-rule" style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}>
                  <button type="button" onClick={() => onPick(toRegisterPlace(p))} className="w-full flex items-center gap-3 py-4 text-left">
                    <PinIcon size={18} className="shrink-0 text-ink-soft" aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium text-gray-900 dark:text-white truncate">{p.place_name}</span>
                      <span className="block mt-1 text-[13px] text-ink-soft truncate">{p.road_address_name || p.address_name}</span>
                      {(p.category_name || p.phone) && (
                        <span className="block mt-1 text-[12px] text-ink-soft truncate">{[p.category_name?.split(' > ').slice(-2).join(', '), p.phone].filter(Boolean).join(', ')}</span>
                      )}
                    </span>
                    <ChevronRight size={18} strokeWidth={1.6} className="shrink-0 text-ink-soft" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="shrink-0 pt-4 pb-2 flex flex-col items-center gap-3">
        <button type="button" onClick={() => setManual(true)} className="text-[13px] text-ink-soft underline">지도에 없는 가게예요 · 직접 입력</button>
        {/* 🚪 개인 중개 등록이 닫힌 동안 대행사의 길은 처음부터 다른 문 — 에이전시 초대로 온 사장님에겐 숨긴다 */}
        {PERSONAL_BROKER_SIGNUP_DISABLED && !hasAgency && (
          <Link to={AGENCY_SIGNUP_PATH} className="text-[13px] text-ink-soft underline">사장님 대신 등록하는 대행사예요 · 에이전시 가입</Link>
        )}
      </div>
    </div>
  )
}
