import { useEffect, useState, useCallback } from 'react'
import MarketingDashboardShell from '@/components/MarketingDashboardShell'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import SearchAdPanel from './SearchAdPanel'
import AutobidPanel from './AutobidPanel'
import ClickGuardPanel from './ClickGuardPanel'
import PricePanel from './PricePanel'
import SourcingPanel from './SourcingPanel'
import WeeklyReportPanel from './WeeklyReportPanel'
import PanelError from './PanelError'

/**
 * 🆕 2026-06-26 통합 마케팅 서비스(가칭) — 멀티테넌트 입점 대시보드.
 *   tenant = 인증된 고객사(seller_token). 각 고객사가 자기 스마트스토어를 연동(SELF) → 발주 자동수집.
 *   owner_type='marketing' 으로 도매(supplier/distributor) 연결과 격리.
 *   ⚠️ 라이브: 커머스 앱 '상품주문/배송' 권한 + 엔드포인트 현행문서 검증 후 동작(이 환경 egress 차단).
 */
interface CollectedOrder {
  productOrderId: string
  orderId: string | null
  productName: string | null
  quantity: number
  totalAmount: number
  status: string | null
  ordererName: string | null
  orderedAt: string | null
}

interface TrendResult { keyword: string; latest: number; changePct: number }
interface ShoppingResult { total: number; items: Array<{ title: string; lprice: number; mallName: string }> }
interface RelatedKeyword { keyword: string; monthlyPc: number; monthlyMobile: number; monthlyTotal: number; compIdx: string; monthlyAvgClick: number }
interface ReputationChannel { channel: 'blog' | 'cafe' | 'news'; total: number; items: Array<{ title: string; link: string; date: string; source: string }> }
interface ReputationResult { query: string; channels: ReputationChannel[]; totalMentions: number }
const CHANNEL_LABEL: Record<string, string> = { blog: '블로그', cafe: '카페', news: '뉴스' }

const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

export default function MarketingDashboardPage() {
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [maskedId, setMaskedId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState<CollectedOrder[]>([])
  const [kw, setKw] = useState('')
  const [kwBusy, setKwBusy] = useState(false)
  const [kwErr, setKwErr] = useState(false)
  const [kwTrend, setKwTrend] = useState<TrendResult[] | null>(null)
  const [kwShop, setKwShop] = useState<ShoppingResult | null>(null)
  const [kwRelated, setKwRelated] = useState<RelatedKeyword[] | null>(null)
  const [relatedOff, setRelatedOff] = useState(false) // 검색광고 키 미설정(503) — 섹션 자동 숨김
  const [kwAuto, setKwAuto] = useState<string[] | null>(null)
  const [kwRep, setKwRep] = useState<ReputationResult | null>(null)
  // AI 마케터
  const [aiSeed, setAiSeed] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [aiOff, setAiOff] = useState(false)

  const loadStatus = useCallback(async () => {
    if (!hasToken) { setConnected(false); return }
    try {
      const r = await api.get('/api/ads/naver/status', { headers: authHeader() })
      setConnected(!!r.data?.connected)
      setMaskedId(r.data?.client_id_masked || null)
    } catch { setConnected(false) }
  }, [hasToken])

  const loadOrders = useCallback(async () => {
    if (!hasToken) return
    try {
      const r = await api.get('/api/ads/orders', { headers: authHeader() })
      setOrders(r.data?.orders || [])
    } catch { /* graceful */ }
  }, [hasToken])

  useEffect(() => { loadStatus(); loadOrders() }, [loadStatus, loadOrders])

  async function connect() {
    if (!clientId.trim() || !clientSecret.trim()) return
    setBusy(true)
    try {
      const r = await api.post('/api/ads/naver/connect', { client_id: clientId.trim(), client_secret: clientSecret.trim() }, { headers: authHeader() })
      if (r.data?.success) { toast.success('스마트스토어가 연결되었습니다'); setClientSecret(''); await loadStatus() }
      else toast.error(r.data?.error || '연결 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '연결 실패')
    } finally { setBusy(false) }
  }

  async function sync() {
    setBusy(true)
    try {
      const r = await api.post('/api/ads/orders/sync', {}, { headers: authHeader() })
      if (r.data?.success) { toast.success(`발주 ${r.data.collected ?? 0}건 수집`); await loadOrders() }
      else toast.error(r.data?.error || '동기화 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '동기화 실패')
    } finally { setBusy(false) }
  }

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
      // 연관키워드: 검색광고 키 설정 시만(503 이면 섹션 숨김).
      if (rel.status === 'fulfilled' && rel.value.data?.success) { setKwRelated(rel.value.data.results || []); setRelatedOff(false) }
      else if (rel.status === 'rejected' && (rel.reason as { response?: { status?: number } })?.response?.status === 503) setRelatedOff(true)
      if (auto.status === 'fulfilled' && auto.value.data?.success) setKwAuto(auto.value.data.suggestions || [])
      if (rep.status === 'fulfilled' && rep.value.data?.success) setKwRep(rep.value.data.data || null)
      if (t.status === 'rejected' && s.status === 'rejected') { setKwErr(true); toast.error('키워드 분석 실패 (잠시 후 다시)') }
    } finally { setKwBusy(false) }
  }

  async function runAiMarketer() {
    setAiBusy(true); setAiAdvice(null); setAiOff(false)
    try {
      const r = await api.post('/api/ads/ai-marketer', { seed: aiSeed.trim() || undefined }, { headers: authHeader() })
      if (r.data?.success) setAiAdvice(r.data.advice || '')
      else toast.error(r.data?.error || 'AI 분석 실패')
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { error?: string } } }
      if (ax.response?.status === 503) setAiOff(true)
      else toast.error(ax.response?.data?.error || 'AI 분석 실패')
    } finally { setAiBusy(false) }
  }

  const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
  const input = 'w-full h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

  return (
    <MarketingDashboardShell title="대시보드" showNav={hasToken}>
      <SEO title="유어애즈 UR Ads - 유어팀 종합 마케팅" description="네이버 검색광고 자동입찰 + 쇼핑몰 발주수집 + 키워드 — 유어팀 종합 마케팅 툴" url="/ads/dashboard" />
      <p className="mono text-[11px] tracking-widest" style={{ color: 'var(--ink3)' }}>OVERVIEW</p>
      <p className="mt-1.5 text-[13px]" style={{ color: 'var(--ink2)' }}>연관키워드·검색추세·쇼핑경쟁·자동완성확장·브랜드 평판 모니터링 — 지금 바로 사용 · 자동입찰/발주수집은 광고계정 연동 후</p>

      {!hasToken && (
        <div className={`mt-5 ${card}`}>
          <p className="text-[13px] text-gray-700 dark:text-gray-300">사업자(고객사) 계정으로 로그인 후 이용할 수 있습니다. 카카오 한 번이면 됩니다.</p>
          <a href="/seller/login?returnUrl=%2Fads%2Fdashboard" className="mt-3 inline-block rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[13px] font-bold text-white dark:text-[#0A0A0A]">로그인 / 시작하기</a>
        </div>
      )}

      {hasToken && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {/* 1) 스마트스토어 연동 */}
          <div id="sec-store" className={card}>
            <div className="text-[14px] font-bold text-gray-900 dark:text-white">스마트스토어 연동</div>
            {connected ? (
              <div className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">
                연결됨 <span className="text-gray-400 dark:text-gray-500">({maskedId})</span>
                <div className="mt-3 flex gap-2">
                  <button onClick={sync} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-3 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">발주 동기화</button>
                  <button onClick={async () => { await api.delete('/api/ads/naver/connect', { headers: authHeader() }); loadStatus() }} className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-3 py-2 text-[12px] text-gray-500 dark:text-gray-400">연결 해제</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-[11.5px] text-gray-400 dark:text-gray-500 leading-relaxed">커머스 API센터에서 발급한 앱의 <b>'상품주문/배송' 권한</b> 포함 client_id/secret 을 입력하세요.</p>
                <input className={input} placeholder="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                <input className={input} placeholder="client_secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                <button onClick={connect} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">연결</button>
              </div>
            )}
          </div>

          {/* 2) 키워드 도구 (오픈API + 검색광고 API) */}
          <div id="sec-keyword" className={card}>
            <div className="text-[14px] font-bold text-gray-900 dark:text-white">키워드 도구</div>
            <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">연관키워드 + 월 검색량 · 검색어 트렌드 · 쇼핑 경쟁(상품수·가격대)</p>
            <div className="mt-2 flex gap-2">
              <input className={input} placeholder="키워드 (예: 무선이어폰)" value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') analyzeKeyword() }} />
              <button onClick={() => analyzeKeyword()} disabled={kwBusy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{kwBusy ? '분석 중…' : '분석'}</button>
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
                      className="rounded-full border border-gray-200 dark:border-[#2A2A2A] px-2.5 py-1 text-[11.5px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {relatedOff && (
              <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-500">연관키워드(검색량)는 네이버 검색광고 키 설정 후 표시됩니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 연관키워드 추천 (검색광고 API — RelKwdStat) */}
      {hasToken && kwRelated && kwRelated.length > 0 && (
        <div className={`mt-3 ${card}`}>
          <div className="text-[14px] font-bold text-gray-900 dark:text-white">연관키워드 추천 <span className="text-gray-400 dark:text-gray-500 font-medium">({kwRelated.length})</span></div>
          <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">네이버 검색광고 기준 월 검색량 · 경쟁정도 — 총 검색량 순. 광고 타겟 키워드 발굴에 활용하세요.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
                <th className="py-1 pr-3">키워드</th>
                <th className="py-1 pr-3 text-right">월 검색량</th>
                <th className="py-1 pr-3 text-right">PC</th>
                <th className="py-1 pr-3 text-right">모바일</th>
                <th className="py-1 pr-3 text-right">월 클릭</th>
                <th className="py-1">경쟁</th>
              </tr></thead>
              <tbody>
                {kwRelated.slice(0, 30).map((r) => (
                  <tr key={r.keyword} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 브랜드 평판 모니터링 (블로그/카페/뉴스 언급) */}
      {hasToken && kwRep && (
        <div className={`mt-3 ${card}`}>
          <div className="text-[14px] font-bold text-gray-900 dark:text-white">브랜드 평판 모니터링
            <span className="ml-2 text-gray-400 dark:text-gray-500 font-medium">"{kwRep.query}" 언급 {formatNumber(kwRep.totalMentions)}건</span>
          </div>
          <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">블로그·카페·뉴스 언급량 + 최근 글. 브랜드·상호 검색어로 평판/노출을 추적하세요.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {kwRep.channels.map((ch) => (
              <div key={ch.channel} className="rounded-xl border border-gray-100 dark:border-[#1A1A1A] p-3">
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

      {/* 네이버 검색광고 계정 연동 + 내 광고 구조(자동입찰/실적 토대) */}
      {hasToken && <section id="sec-searchad" style={{ scrollMarginTop: 76 }}><SearchAdPanel /></section>}

      {/* 자동입찰 규칙(목표순위→입찰가 자동조정) — 규칙 있을 때만 표시 */}
      {hasToken && <section id="sec-autobid" style={{ scrollMarginTop: 76 }}><AutobidPanel /></section>}

      {/* AI 주간 리포트(매주 월요일 자동 생성 — 읽기 전용) */}
      {hasToken && <section id="sec-report" style={{ scrollMarginTop: 76 }}><WeeklyReportPanel /></section>}

      {/* 가격 모니터링(네이버쇼핑 최저가 추적) + 소싱 */}
      {hasToken && <section id="sec-price" style={{ scrollMarginTop: 76 }}><PricePanel /><SourcingPanel /></section>}

      {/* 부정클릭 방지(Phase 1 — 탐지/리포트) */}
      {hasToken && <section id="sec-fraud" style={{ scrollMarginTop: 76 }}><ClickGuardPanel /></section>}

      {/* AI 마케터 (Claude 진단/추천 — 읽기 전용) */}
      {hasToken && (
        <section id="sec-ai" style={{ scrollMarginTop: 76 }} className={`mt-3 ${card}`}>
          <div className="text-[14px] font-bold text-gray-900 dark:text-white">AI 마케터</div>
          <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">실적·키워드 데이터를 분석해 개선 액션을 제안합니다(추천만 — 자동 실행 없음). 계정 연동 시 실적까지 반영.</p>
          <div className="mt-2 flex gap-2">
            <input className={input} placeholder="중심 키워드 (선택, 예: 무선이어폰)" value={aiSeed} onChange={(e) => setAiSeed(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runAiMarketer() }} />
            <button onClick={runAiMarketer} disabled={aiBusy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">{aiBusy ? '분석 중…' : 'AI 분석 받기'}</button>
          </div>
          {aiOff && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-500">AI 마케터는 Anthropic API 키 설정 후 사용할 수 있습니다.</p>}
          {aiAdvice && (
            <div className="mt-3 space-y-1 text-[12.5px] leading-relaxed">
              {aiAdvice.split('\n').map((line, i) => {
                const h = line.match(/^#{1,4}\s+(.*)/)
                if (h) return <p key={i} className="font-bold text-gray-900 dark:text-white mt-2">{h[1]}</p>
                const b = line.match(/^\s*[-*]\s+(.*)/)
                if (b) return <p key={i} className="text-gray-600 dark:text-gray-300 pl-3">• {b[1].replace(/\*\*/g, '')}</p>
                if (!line.trim()) return null
                return <p key={i} className="text-gray-600 dark:text-gray-300">{line.replace(/\*\*/g, '')}</p>
              })}
            </div>
          )}
      </section>
      )}

      {/* 수집된 발주 */}
      {hasToken && (
        <div className={`mt-3 ${card}`}>
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-bold text-gray-900 dark:text-white">수집된 발주 {orders.length > 0 && <span className="text-gray-400 dark:text-gray-500 font-medium">({orders.length})</span>}</div>
          </div>
          {orders.length === 0 ? (
            <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">아직 수집된 발주가 없습니다. 연동 후 '발주 동기화'를 눌러주세요.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
                  <th className="py-1 pr-3">상품</th><th className="py-1 pr-3">수량</th><th className="py-1 pr-3">금액</th><th className="py-1 pr-3">상태</th><th className="py-1">주문자</th>
                </tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.productOrderId} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
                      <td className="py-1.5 pr-3">{o.productName || '-'}</td>
                      <td className="py-1.5 pr-3">{o.quantity}</td>
                      <td className="py-1.5 pr-3">₩{formatNumber(o.totalAmount)}</td>
                      <td className="py-1.5 pr-3">{o.status || '-'}</td>
                      <td className="py-1.5">{o.ordererName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </MarketingDashboardShell>
  )
}
