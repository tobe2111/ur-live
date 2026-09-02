import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import PanelError from '../PanelError'
import SearchAdRequiredNotice from '../SearchAdRequiredNotice'
import { downloadCsv } from '@/utils/csv-download'
import { CARD_CLS, INPUT_CLS } from '../dashboard-tabs'

/**
 * 🔎 키워드 도구 + 연관키워드 추천 + 브랜드 평판 모니터링 — MarketingDashboardPage 에서 추출
 *   (2026-07-27 탭 재편 · 600줄 캡). 상태·로직 byte-동일 이동, '키워드' 탭 전용 섹션.
 */
interface TrendResult { keyword: string; latest: number; changePct: number }
interface ShoppingResult { total: number; items: Array<{ title: string; lprice: number; mallName: string }> }
interface RelatedKeyword { keyword: string; monthlyPc: number; monthlyMobile: number; monthlyTotal: number; compIdx: string; monthlyAvgClick: number }
interface ReputationChannel { channel: 'blog' | 'cafe' | 'news'; total: number; items: Array<{ title: string; link: string; date: string; source: string }> }
interface ReputationResult { query: string; channels: ReputationChannel[]; totalMentions: number }
const CHANNEL_LABEL: Record<string, string> = { blog: '블로그', cafe: '카페', news: '뉴스' }

const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

export default function KeywordToolsSection({ onGo }: { onGo?: (anchor: string) => void }) {
  const [kw, setKw] = useState('')
  const [kwBusy, setKwBusy] = useState(false)
  const [kwErr, setKwErr] = useState(false)
  const [kwTrend, setKwTrend] = useState<TrendResult[] | null>(null)
  const [kwShop, setKwShop] = useState<ShoppingResult | null>(null)
  const [kwRelated, setKwRelated] = useState<RelatedKeyword[] | null>(null)
  const [relatedOff, setRelatedOff] = useState(false) // 검색광고 키 미설정(503) — 섹션 자동 숨김
  const [kwAuto, setKwAuto] = useState<string[] | null>(null)
  const [kwRep, setKwRep] = useState<ReputationResult | null>(null)

  async function analyzeKeyword(term?: string) {
    const q = (term ?? kw).trim()
    if (q.length < 2) { toast.error('키워드를 2자 이상 입력해주세요'); return }
    if (term) setKw(term)
    setKwBusy(true); setKwErr(false); setKwTrend(null); setKwShop(null); setKwRelated(null); setKwAuto(null); setKwRep(null)
    try {
      const [t, s, rel, auto, rep] = await Promise.allSettled([
        api.get(`/api/ads/keywords/trend?keywords=${encodeURIComponent(q)}`, { headers: authHeader() }),
        api.get(`/api/ads/keywords/shopping?q=${encodeURIComponent(q)}`, { headers: authHeader() }),
        api.get(`/api/ads/keywords/related?seed=${encodeURIComponent(q)}`, { headers: authHeader() }),
        api.get(`/api/ads/keywords/autocomplete?q=${encodeURIComponent(q)}`, { headers: authHeader() }),
        api.get(`/api/ads/reputation?q=${encodeURIComponent(q)}`, { headers: authHeader() }),
      ])
      if (t.status === 'fulfilled' && t.value.data?.success) setKwTrend(t.value.data.results || [])
      if (s.status === 'fulfilled' && s.value.data?.success) setKwShop(s.value.data.data || null)
      // 연관키워드: 검색광고 키 설정 시만 — 미설정은 200 { unavailable } (구 503 도 하위호환 처리).
      if (rel.status === 'fulfilled' && rel.value.data?.success) { setKwRelated(rel.value.data.results || []); setRelatedOff(false) }
      else if (rel.status === 'fulfilled' && rel.value.data?.unavailable) setRelatedOff(true)
      else if (rel.status === 'rejected' && (rel.reason as { response?: { status?: number } })?.response?.status === 503) setRelatedOff(true)
      if (auto.status === 'fulfilled' && auto.value.data?.success) setKwAuto(auto.value.data.suggestions || [])
      if (rep.status === 'fulfilled' && rep.value.data?.success) setKwRep(rep.value.data.data || null)
      if (t.status === 'rejected' && s.status === 'rejected') { setKwErr(true); toast.error('키워드 분석 실패 (잠시 후 다시)') }
    } finally { setKwBusy(false) }
  }

  async function saveKeywordToPortfolio(r: RelatedKeyword) {
    try {
      const res = await api.post('/api/ads/keywords/save', { keyword: r.keyword, monthly_total: r.monthlyTotal, comp_idx: r.compIdx }, { headers: authHeader() })
      if (res.data?.success) toast.success(`'${r.keyword}' 저장 — 아래 '키워드 포트폴리오'에서 관리`)
      else toast.error(res.data?.error || '저장 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '저장 실패')
    }
  }

  return (
    <>
      <div id="sec-keyword" className={CARD_CLS} style={{ scrollMarginTop: 76 }}>
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">키워드 도구</div>
        <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">연관키워드 + 월 검색량 · 검색어 트렌드 · 쇼핑 경쟁(상품수·가격대) · 브랜드 평판</p>
        <div className="mt-2 flex gap-2">
          <input className={INPUT_CLS} placeholder="키워드 (예: 무선이어폰)" value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') analyzeKeyword() }} />
          <button onClick={() => analyzeKeyword()} disabled={kwBusy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#11141C] disabled:opacity-50">{kwBusy ? '분석 중…' : '분석'}</button>
        </div>
        {kwErr && <PanelError onRetry={() => analyzeKeyword()} busy={kwBusy} label="키워드 분석 실패" />}
        {kwShop && (
          <div className="mt-3 text-[12px]">
            <div className="text-gray-600 dark:text-gray-300">쇼핑 등록상품 <b className="text-gray-900 dark:text-white">{formatNumber(kwShop.total)}</b>개
              {kwTrend && kwTrend[0] && <span className="ml-2 text-gray-400 dark:text-gray-500">· 검색추세 {kwTrend[0].changePct >= 0 ? '▲' : '▼'}{Math.abs(kwTrend[0].changePct)}%</span>}
            </div>
            <div className="mt-2 space-y-1">
              {kwShop.items.slice(0, 5).map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
                  <span className="truncate">{it.title}</span>
                  <span className="shrink-0 tabular-nums">₩{formatNumber(it.lprice)} <span className="text-gray-400 dark:text-gray-500">{it.mallName}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 검색추세 — 쇼핑결과가 없어도 독립 표시(쇼핑 실패 시 추세 누락 방지) */}
        {!kwShop && kwTrend && kwTrend[0] && (
          <div className="mt-3 text-[12px] text-gray-600 dark:text-gray-300">검색추세 <b className="text-gray-900 dark:text-white">{kwTrend[0].changePct >= 0 ? '▲' : '▼'}{Math.abs(kwTrend[0].changePct)}%</b></div>
        )}
        {/* 자동완성 키워드 확장 — 클릭 시 그 키워드로 재분석 */}
        {kwAuto && kwAuto.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5">자동완성 키워드 확장</p>
            <div className="flex flex-wrap gap-1.5">
              {kwAuto.slice(0, 16).map((s) => (
                <button key={s} onClick={() => analyzeKeyword(s)}
                  className="rounded-full border border-gray-200 dark:border-[#2C2F35] px-2.5 py-1 text-[11.5px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1D1F29]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {relatedOff && <SearchAdRequiredNotice feature="연관키워드(월 검색량)" onGo={onGo} />}
      </div>

      {/* 연관키워드 추천 (검색광고 API — RelKwdStat) */}
      {kwRelated && kwRelated.length > 0 && (
        <div className={`mt-3 ${CARD_CLS}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[14px] font-bold text-gray-900 dark:text-white">연관키워드 추천 <span className="text-gray-400 dark:text-gray-500 font-medium">({kwRelated.length})</span></div>
            <button onClick={() => downloadCsv(`유어애즈_연관키워드_${kw || 'all'}.csv`,
              ['키워드', '월검색량', 'PC', '모바일', '월클릭', '경쟁'],
              kwRelated.map((r) => [r.keyword, r.monthlyTotal, r.monthlyPc, r.monthlyMobile, r.monthlyAvgClick, r.compIdx || '']))}
              className="shrink-0 rounded-lg border border-gray-200 dark:border-[#2C2F35] px-2 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200">CSV</button>
          </div>
          <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">네이버 검색광고 기준 월 검색량 · 경쟁정도 — 총 검색량 순. 광고 타겟 키워드 발굴에 활용하세요.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
                <th className="py-1 pr-3">키워드</th>
                <th className="py-1 pr-3 text-right">월 검색량</th>
                <th className="py-1 pr-3 text-right">PC</th>
                <th className="py-1 pr-3 text-right">모바일</th>
                <th className="py-1 pr-3 text-right">월 클릭</th>
                <th className="py-1 pr-3">경쟁</th>
                <th className="py-1"></th>
              </tr></thead>
              <tbody>
                {kwRelated.slice(0, 30).map((r) => (
                  <tr key={r.keyword} className="border-t border-gray-100 dark:border-[#2C2F35] text-gray-700 dark:text-gray-300">
                    <td className="py-1.5 pr-3 font-medium text-gray-900 dark:text-white">{r.keyword}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums font-bold">{formatNumber(r.monthlyTotal)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(r.monthlyPc)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(r.monthlyMobile)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(r.monthlyAvgClick)}</td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                        r.compIdx === '높음' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                        : r.compIdx === '중간' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}>{r.compIdx || '-'}</span>
                    </td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => saveKeywordToPortfolio(r)} className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">저장</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 브랜드 평판 모니터링 (블로그/카페/뉴스 언급) */}
      {kwRep && (
        <div className={`mt-3 ${CARD_CLS}`}>
          <div className="text-[14px] font-bold text-gray-900 dark:text-white">브랜드 평판 모니터링
            <span className="ml-2 text-gray-400 dark:text-gray-500 font-medium">"{kwRep.query}" 언급 {formatNumber(kwRep.totalMentions)}건</span>
          </div>
          <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">블로그·카페·뉴스 언급량 + 최근 글. 브랜드·상호 검색어로 평판/노출을 추적하세요.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {kwRep.channels.map((ch) => (
              <div key={ch.channel} className="rounded-xl border border-gray-100 dark:border-[#2C2F35] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] font-bold text-gray-900 dark:text-white">{CHANNEL_LABEL[ch.channel]}</span>
                  <span className="text-[12px] tabular-nums font-bold text-gray-900 dark:text-white">{formatNumber(ch.total)}<span className="text-gray-400 dark:text-gray-500 font-medium">건</span></span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {ch.items.length === 0 ? (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">최근 글 없음</p>
                  ) : ch.items.map((it, i) => (
                    <a key={i} href={it.link} target="_blank" rel="noopener noreferrer"
                      className="block text-[11.5px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                      <span className="line-clamp-1">{it.title}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{it.source}{it.date ? ` · ${it.date}` : ''}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
