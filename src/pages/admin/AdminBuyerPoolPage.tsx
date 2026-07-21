import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🌐 2026-07-20 유통스타트 해외 수출 바이어 파이프라인 (/admin/buyer-pool).
 *   인플루언서 풀(영입 깔때기)과 결이 다름 — **의도 자격심사 + 매칭 스코어 + 회사→담당자 2단 + BD 파이프라인**.
 *   격리 테이블 `overseas_buyer_leads`. API: /api/admin/buyer-pool/*. 게이트 OFF 면 수집 no-op.
 *   ⚠️ 공개 비즈니스 컨택만 — 콜드 아웃리치는 GDPR·CAN-SPAM·CASL 별도(수집 ≠ 발송).
 */
interface Lead {
  id: number; source: string; intent_signal: string; company: string; country: string | null
  target_market: string | null; category: string | null; imports_from_korea: number | null
  website: string | null; email: string | null; phone: string | null
  decision_maker: string | null; decision_maker_title: string | null; decision_maker_email: string | null
  est_volume: string | null; match_score: number | null; description: string | null
  source_keyword: string | null; status: string; memo: string | null; inquiry_title: string | null
  contacted_at: string | null; follow_up_at: string | null; collected_at: string
}
interface Stats { total: number; hot: number; proven: number; with_contact: number; with_dm: number; active_pipeline: number; recent7: number }
interface Dist { k: string; n: number }
interface Target { id: number; category: string; country: string; keyword: string | null; active: number; hits: number; found_total: number; saved_total: number; last_run_at: string | null }
type IntentTiers = Record<string, { label: string; weight: number }>

// BD 파이프라인 단계 — 자격심사·샘플·협상.
const STAGE_META: Record<string, { label: string; cls: string }> = {
  lead: { label: '리드', cls: 'bg-gray-100 text-gray-600' },
  qualified: { label: '자격확인', cls: 'bg-blue-100 text-blue-700' },
  sampling: { label: '샘플발송', cls: 'bg-cyan-100 text-cyan-700' },
  negotiating: { label: '협상', cls: 'bg-amber-100 text-amber-700' },
  won: { label: '성사', cls: 'bg-emerald-100 text-emerald-700' },
  lost: { label: '실패', cls: 'bg-gray-100 text-gray-400' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const STAGE_ORDER = ['lead', 'qualified', 'sampling', 'negotiating', 'won', 'lost', 'hold']

// 북마클릿 — buyKorea 등에서 클릭 시 상세 페이지들을 세션으로 읽어 유어딜로 전송(F12·쿠키 불필요).
function buildBookmarklet(token: string): string {
  const api = `${window.location.origin}/api/buyer-ingest`
  const code = `(async()=>{try{var T=${JSON.stringify(token)},A=${JSON.stringify(api)};var s='a[href*="Detail.do"],a[href*="inqryDetail"],a[href*="offerDetail"],a[href*="/offer/"],a[href*="tradeLead"],a[href*="buyOffer"],a[href*="itemView"]';var L=[].slice.call(document.querySelectorAll(s)).map(function(a){return a.href}).filter(function(h){return /^https?:/.test(h)});L=L.filter(function(v,i){return L.indexOf(v)===i}).slice(0,30);var H=[];if(/detail|offer|view/i.test(location.href))H.push(document.documentElement.outerHTML);for(var i=0;i<L.length;i++){try{var r=await fetch(L[i],{credentials:'include'});H.push(await r.text())}catch(e){}await new Promise(function(x){setTimeout(x,400)})}if(!H.length){alert('상세 링크를 못 찾았어요. 구매요청 리스트나 상세 페이지에서 눌러주세요.');return}var res=await fetch(A,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:T,htmls:H})});var j=await res.json();if(j&&j.success){alert('유어딜 수집 완료: '+((j.result&&j.result.saved)||0)+'건 저장 / '+((j.result&&j.result.parsed)||0)+' 파싱')}else{alert('실패: '+((j&&j.error)||'인증 오류'))}}catch(e){alert('전송 실패: '+e)}})()`
  return 'javascript:' + encodeURIComponent(code)
}

// 무료 B2B 구매리드(바이어 구매요청) 수집처. 2단계: ① 리스트(발굴) ② 각 상세(연락처).
// 전부 무료 가입, 유료 provider 없음. list=구매요청 목록, detail=각 건의 상세(회사명·이메일·홈페이지).
const BUYER_SOURCES: { name: string; url: string; org: string; list: string; detail: string }[] = [
  { name: 'buyKorea', url: 'https://www.buykorea.org', org: 'KOTRA (대한무역투자진흥공사)', list: '로그인 → 「인콰이어리(Inquiry)」 → 「일반상품」/카테고리(미용·식음료 등) → 구매요청 리스트를 100/200개 펼쳐 복사', detail: '리스트에서 각 건 클릭 → 상세(회사명·국가·이메일·웹사이트·현재수입국) 페이지를 Ctrl+A → Ctrl+C → 붙여넣기' },
  { name: 'tradeKorea', url: 'https://www.tradekorea.com', org: 'KITA (한국무역협회)', list: '로그인 → 「Buying Offers」(구매오퍼) → Category/Country 필터 → 리스트 복사', detail: '각 Offer 클릭 → 상세(Company·Email·Homepage·Contact) 페이지 복사 → 붙여넣기' },
  { name: 'GoBizKorea', url: 'https://www.gobizkorea.com', org: '중소기업유통센터', list: '로그인 → 「Buying Leads」(구매정보) → 리스트 복사', detail: '각 Lead 클릭 → 상세(Buyer·Email·Website) 페이지 복사 → 붙여넣기' },
  { name: 'EC21', url: 'https://www.ec21.com', org: '글로벌 B2B 마켓플레이스', list: '로그인 → 「Trade Leads → Buying Leads」 → 키워드/카테고리 검색 → 리스트 복사', detail: '각 Buy Offer 클릭 → 상세(Company·Contact·Email) 페이지 복사 → 붙여넣기' },
  { name: 'ECPlaza', url: 'https://www.ecplaza.net', org: '글로벌 B2B 마켓플레이스', list: '로그인 → 「Trade Leads → Buy Offers」 → 리스트 복사', detail: '각 Buy Offer 클릭 → 상세(Company·Email·Website) 페이지 복사 → 붙여넣기' },
]

function scoreCls(s: number | null): string {
  const v = s ?? 0
  if (v >= 70) return 'bg-emerald-500 text-white'
  if (v >= 50) return 'bg-amber-400 text-white'
  return 'bg-gray-200 text-gray-600'
}

export default function AdminBuyerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, hot: 0, proven: 0, with_contact: 0, with_dm: 0, active_pipeline: 0, recent7: 0 })
  const [byIntent, setByIntent] = useState<Dist[]>([])
  const [byCountry, setByCountry] = useState<Dist[]>([])
  const [byCategory, setByCategory] = useState<Dist[]>([])
  const [intentTiers, setIntentTiers] = useState<IntentTiers>({})
  const [meta, setMeta] = useState<{ enabled: boolean; feeds: number; autoFetchEnabled: boolean }>({ enabled: false, feeds: 0, autoFetchEnabled: false })
  const [targets, setTargets] = useState<Target[]>([])
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')
  const [intent, setIntent] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [hasContact, setHasContact] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [newCountry, setNewCountry] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const emptyForm = { company: '', country: '', category: '', target_market: '', intent_signal: 'buying_lead', imports_from_korea: false, website: '', email: '', decision_maker: '', decision_maker_title: '', decision_maker_email: '', est_volume: '', description: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [importing, setImporting] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showAuto, setShowAuto] = useState(false)
  const [autoCookie, setAutoCookie] = useState('')
  const [autoListUrl, setAutoListUrl] = useState('')
  const [autoMax, setAutoMax] = useState(10)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoSave, setAutoSave] = useState(true)
  const [ingestToken, setIngestToken] = useState('')
  const bmRef = useRef<HTMLAnchorElement>(null)
  const [autoConfig, setAutoConfig] = useState<{ sources: { host: string; url: string; label: string }[]; cookieHosts: string[]; enabled: boolean; cronEnabled: boolean }>({ sources: [], cookieHosts: [], enabled: false, cronEnabled: false })

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/buyer-pool/stats')
      if (r.data?.success) {
        setStats(r.data.stats); setByIntent(r.data.byIntent || []); setByCountry(r.data.byCountry || []); setByCategory(r.data.byCategory || [])
        setIntentTiers(r.data.intentTiers || {})
        setMeta({ enabled: !!r.data.enabled, feeds: r.data.feeds || 0, autoFetchEnabled: !!r.data.autoFetchEnabled })
      }
    } catch { /* noop */ }
  }, [])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (country) params.set('country', country)
      if (intent) params.set('intent', intent)
      if (minScore > 0) params.set('minScore', String(minScore))
      if (hasContact) params.set('hasContact', '1')
      if (q.trim()) params.set('q', q.trim())
      const r = await api.get(`/api/admin/buyer-pool?${params.toString()}`)
      if (r.data?.success) setLeads(r.data.leads || [])
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [status, country, intent, minScore, hasContact, q])

  const loadTargets = useCallback(async () => {
    try { const r = await api.get('/api/admin/buyer-pool/targets'); if (r.data?.success) setTargets(r.data.targets || []) } catch { /* noop */ }
  }, [])

  const loadAutoConfig = useCallback(async () => {
    try { const r = await api.get('/api/admin/buyer-pool/auto-fetch/config'); if (r.data?.success) setAutoConfig({ sources: r.data.sources || [], cookieHosts: r.data.cookieHosts || [], enabled: !!r.data.enabled, cronEnabled: !!r.data.cronEnabled }) } catch { /* noop */ }
  }, [])

  useEffect(() => { loadStats(); loadTargets(); loadAutoConfig() }, [loadStats, loadTargets, loadAutoConfig])
  useEffect(() => { loadLeads() }, [loadLeads])

  const collect = async () => {
    setCollecting(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/collect')
      const res = r.data?.result
      if (res?.ran) toast.success(`수집 완료 — 발굴 ${res.found} · 신규 ${res.saved} (타깃: ${(res.targets || []).join(', ') || '없음'})`)
      else toast.info(`수집 안 함 (${res?.reason || '알 수 없음'})`)
      await Promise.all([loadStats(), loadLeads(), loadTargets()])
    } catch { toast.error('수집 실행 실패') } finally { setCollecting(false) }
  }

  const patch = async (id: number, body: Record<string, unknown>) => {
    try {
      const r = await api.patch(`/api/admin/buyer-pool/${id}`, body)
      if (r.data?.success) { setLeads(prev => prev.map(l => l.id === id ? { ...l, ...body } as Lead : l)); loadStats() }
      else toast.error(r.data?.error || '수정 실패')
    } catch { toast.error('수정 실패') }
  }

  const remove = async (id: number) => {
    if (!confirm('이 바이어를 삭제할까요?')) return
    try { await api.delete(`/api/admin/buyer-pool/${id}`); setLeads(prev => prev.filter(l => l.id !== id)); loadStats() } catch { toast.error('삭제 실패') }
  }

  const addTarget = async () => {
    if (newCat.trim().length < 2 || newCountry.trim().length < 2) { toast.error('카테고리·시장을 입력하세요'); return }
    try {
      const r = await api.post('/api/admin/buyer-pool/targets', { category: newCat.trim(), country: newCountry.trim() })
      if (r.data?.success) { setNewCat(''); setNewCountry(''); loadTargets(); loadLeads() } else toast.error(r.data?.error || '추가 실패')
    } catch { toast.error('추가 실패') }
  }
  const toggleTarget = async (t: Target) => {
    try { await api.patch(`/api/admin/buyer-pool/targets/${t.id}`, { active: !t.active }); loadTargets(); loadLeads() } catch { toast.error('변경 실패') }
  }

  const submitAdd = async () => {
    if (form.company.trim().length < 2) { toast.error('회사명을 입력하세요'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/admin/buyer-pool', { ...form, imports_from_korea: form.imports_from_korea ? 1 : null })
      if (r.data?.success) {
        toast.success(r.data.saved > 0 ? '바이어 추가됨' : '이미 등록된 회사입니다')
        setForm(emptyForm); setShowAdd(false); await Promise.all([loadStats(), loadLeads()])
      } else toast.error(r.data?.error || '추가 실패')
    } catch { toast.error('추가 실패') } finally { setSaving(false) }
  }

  const submitBulk = async () => {
    if (bulkText.trim().split(/\r?\n/).filter(Boolean).length < 2) { toast.error('리스트/표를 붙여넣어 주세요'); return }
    setImporting(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/import', { text: bulkText })
      if (r.data?.success) {
        toast.success(`${r.data.parsed}건 파싱 · ${r.data.saved}건 신규 저장`)
        setBulkText(''); await Promise.all([loadStats(), loadLeads()])
      } else toast.error(r.data?.error || '가져오기 실패')
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || '가져오기 실패 — 리스트/표 형식을 확인해 주세요')
    } finally { setImporting(false) }
  }

  const runAutoFetch = async () => {
    if (autoCookie.trim().length < 10) { toast.error('로그인 쿠키를 붙여넣어 주세요'); return }
    if (!/^https?:\/\//.test(autoListUrl.trim())) { toast.error('리스트 페이지 URL을 넣어 주세요'); return }
    setAutoRunning(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/auto-fetch', { cookie: autoCookie.trim(), listUrl: autoListUrl.trim(), max: autoMax, save: autoSave })
      const res = r.data?.result
      if (res?.ran && !res.reason) { toast.success(`상세 ${res.fetched}건 방문 · ${res.parsed}건 추출 · ${res.saved}건 신규/보강 (실패 ${res.errors})`); if (autoSave) setAutoCookie('') }
      else toast.error(res?.reason || '자동 수집 실패')
      await Promise.all([loadStats(), loadLeads(), loadAutoConfig()])
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || '자동 수집 실패')
    } finally { setAutoRunning(false) }
  }

  const runSaved = async () => {
    setAutoRunning(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/auto-fetch/run-saved', { max: autoMax })
      const res = r.data?.result
      if (res?.ran) {
        const expired = (res.sources || []).filter((s: { reason?: string }) => s.reason?.startsWith('COOKIE_EXPIRED')).map((s: { label: string }) => s.label)
        toast.success(`저장된 소스 ${res.sources?.length || 0}곳 · 총 ${res.saved}건 신규/보강` + (expired.length ? ` · ⚠️ 쿠키 만료: ${expired.join(', ')}` : ''))
      } else toast.error(res?.reason || '저장된 소스가 없습니다')
      await Promise.all([loadStats(), loadLeads(), loadAutoConfig()])
    } catch { toast.error('자동 수집 실패') } finally { setAutoRunning(false) }
  }

  const forgetSource = async (url: string) => {
    try { await api.post('/api/admin/buyer-pool/auto-fetch/forget', { url }); loadAutoConfig() } catch { toast.error('삭제 실패') }
  }
  const toggleCron = async (enabled: boolean) => {
    try { await api.post('/api/admin/buyer-pool/auto-fetch/cron', { enabled }); setAutoConfig(c => ({ ...c, cronEnabled: enabled })); toast.success(enabled ? '매일 밤 무인 자동 수집 ON' : '무인 자동 수집 OFF') } catch { toast.error('변경 실패') }
  }

  const loadToken = useCallback(async () => {
    try { const r = await api.get('/api/admin/buyer-pool/ingest-token'); if (r.data?.success) setIngestToken(r.data.token) } catch { /* noop */ }
  }, [])
  useEffect(() => { if (showAuto && !ingestToken) loadToken() }, [showAuto, ingestToken, loadToken])
  useEffect(() => { if (bmRef.current && ingestToken) bmRef.current.setAttribute('href', buildBookmarklet(ingestToken)) }, [ingestToken])
  const resetToken = async () => {
    try { const r = await api.post('/api/admin/buyer-pool/ingest-token/reset'); if (r.data?.success) { setIngestToken(r.data.token); toast.success('토큰 재발급 — 북마클릿을 다시 드래그해 등록하세요') } } catch { toast.error('재발급 실패') }
  }

  const [enriching, setEnriching] = useState(false)
  const enrichWebsites = async () => {
    setEnriching(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/enrich-websites', { max: 15 })
      const res = r.data?.result
      if (res?.ran) toast.success(res.scanned === 0 ? (res.reason || '대상 없음') : `웹사이트 ${res.scanned}곳 방문 · 이메일/전화 ${res.enriched}건 확보`)
      else toast.error(res?.reason || '이메일 추출 실패')
      await Promise.all([loadStats(), loadLeads()])
    } catch { toast.error('이메일 추출 실패') } finally { setEnriching(false) }
  }

  const exportCsv = () => { window.open('/api/admin/buyer-pool/export?format=csv', '_blank') }

  return (
    <AdminLayout title="해외 바이어 풀">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <DashboardPageHeader title="🌐 해외 바이어 파이프라인" subtitle="유통스타트 수출 — 의도 자격심사 · 매칭 스코어 · 회사→담당자" />

        {/* 게이트/소스 상태 */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>자동 수집: <b className={meta.enabled ? 'text-emerald-600' : 'text-gray-400'}>{meta.enabled ? 'ON' : 'OFF (BUYER_AUTO_COLLECT_ENABLED)'}</b></span>
          <span>무료 피드/오픈API: <b className="text-gray-800">{meta.feeds}개</b></span>
          <span className="text-gray-400">· 유료 provider 없음 · 공개 비즈니스 컨택만 · 수집 ≠ 발송</span>
        </div>

        {/* 통계 — 바이어 결(핫리드/수입실적/담당자확보/파이프라인) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { l: '전체 바이어', v: stats.total },
            { l: '🔥 핫리드 (스코어≥70)', v: stats.hot },
            { l: '한국 수입 이력', v: stats.proven },
            { l: '담당자 확보', v: stats.with_dm },
            { l: '진행 중 파이프라인', v: stats.active_pipeline },
            { l: '컨택 보유', v: stats.with_contact },
            { l: '최근 7일', v: stats.recent7 },
          ].map(s => (
            <div key={s.l} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">{s.l}</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(s.v)}</div>
            </div>
          ))}
        </div>

        {/* 의도 티어 분포 (바이어 핵심 신호) */}
        {byIntent.length > 0 && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">의도 신호 (강→약)</div>
            <div className="flex flex-wrap gap-1.5">
              {byIntent.map(d => (
                <button key={d.k} onClick={() => setIntent(intent === d.k ? '' : d.k)}
                  className={`px-2 py-1 rounded-full text-xs ${intent === d.k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  {intentTiers[d.k]?.label || d.k} {d.n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 국가/카테고리 분포 */}
        {(byCountry.length > 0 || byCategory.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">국가별</div>
              <div className="flex flex-wrap gap-1.5">
                {byCountry.map(d => <button key={d.k} onClick={() => setCountry(country === d.k ? '' : d.k)} className={`px-2 py-1 rounded-full text-xs ${country === d.k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{d.k} {d.n}</button>)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">카테고리별</div>
              <div className="flex flex-wrap gap-1.5">
                {byCategory.map(d => <span key={d.k} className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{d.k} {d.n}</span>)}
              </div>
            </div>
          </div>
        )}

        {/* 액션 바 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => setShowGuide(v => !v)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700">📋 수집 방법 {showGuide ? '숨기기' : '보기'}</button>
          <button onClick={() => setShowAuto(v => !v)} className="px-3 py-2 rounded-lg bg-white border border-red-200 text-sm text-red-600">🤖 상세 자동 수집 {showAuto ? '숨기기' : ''}</button>
          <button onClick={() => setShowAdd(v => !v)} className="px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium">+ 바이어 직접 추가</button>
          <button onClick={collect} disabled={collecting} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{collecting ? '수집 중…' : '지금 수집'}</button>
          <button onClick={enrichWebsites} disabled={enriching} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50" title="이메일 없는 리드의 웹사이트를 방문해 이메일/전화를 채웁니다">{enriching ? '이메일 찾는 중…' : '🌐 웹사이트에서 이메일 찾기'}</button>
          <button onClick={() => setShowTargets(v => !v)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700">매칭 타깃 {showTargets ? '숨기기' : '관리'}</button>
          <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700">CSV 내보내기</button>
          <div className="flex-1" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="회사/이메일/담당자" className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 w-44" />
          <select value={String(minScore)} onChange={e => setMinScore(Number(e.target.value))} className="px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-900">
            <option value="0">전체 스코어</option>
            <option value="70">🔥 70+</option>
            <option value="50">50+</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-900">
            <option value="">전체 단계</option>
            {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm text-gray-600"><input type="checkbox" checked={hasContact} onChange={e => setHasContact(e.target.checked)} /> 컨택만</label>
          {(country || intent) && <button onClick={() => { setCountry(''); setIntent('') }} className="text-xs text-gray-500 underline">필터 해제</button>}
        </div>

        {/* 📋 수집 방법 안내 — 2단계(발굴→연락처), 전 사이트 공통, 전부 무료 */}
        {showGuide && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="text-sm font-semibold text-gray-900 mb-1">📋 해외 바이어 DB, 어디서 어떻게 모으나요? (2단계)</div>
            <p className="text-xs text-gray-600 mb-3">모든 사이트가 <b>연락처(이메일·홈페이지·회사명)를 각 상세 페이지 안에 로그인 상태로만</b> 보여줍니다. 그래서 <b>① 리스트로 발굴</b> → <b>② 관심 건의 상세로 연락처 확보</b> 2단계로 모읍니다. 붙여넣는 곳은 「+ 바이어 직접 추가」 맨 아래 칸(Ctrl+V) → 「붙여넣기 일괄 추가」. (전부 무료 · 유료 결제 없음)</p>
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg bg-white border border-gray-200 p-2.5">
                <div className="text-xs font-semibold text-gray-900">1단계 · 발굴 (리스트)</div>
                <div className="text-[11px] text-gray-600 mt-0.5">구매요청 목록을 <b>Ctrl+A → Ctrl+C → Ctrl+V</b> → 제품·국가·카테고리가 잡힙니다. 아직 연락처는 없고 「상세 확인」 표시가 붙습니다.</div>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-2.5">
                <div className="text-xs font-semibold text-gray-900">2단계 · 연락처 (상세)</div>
                <div className="text-[11px] text-gray-600 mt-0.5">관심 건을 클릭해 상세 페이지를 <b>Ctrl+A → Ctrl+C → Ctrl+V</b> → 회사명·이메일·홈페이지·담당자·전화가 <b>같은 행에 자동 보강</b>됩니다(중복 안 생김).</div>
              </div>
            </div>
            <div className="space-y-2">
              {BUYER_SOURCES.map((s, i) => (
                <div key={s.name} className="rounded-lg bg-white border border-gray-200 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-gray-900 text-white text-[11px] flex items-center justify-center font-bold">{i + 1}</span>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 underline">{s.name}</a>
                    <span className="text-[11px] text-gray-400">{s.org}</span>
                    {i === 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">추천</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-700"><b>① 리스트:</b> {s.list}</div>
                  <div className="mt-0.5 text-xs text-gray-700"><b>② 상세:</b> {s.detail}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
              💡 상세는 로그인 페이지라 <b>사이트가 자동 일괄 다운로드를 막습니다</b>(자동 크롤링 = 약관 위반·계정 정지 위험). 그래서 상세는 <b>관심 가는 건만</b> 한 페이지씩 복사합니다 — 매칭 스코어(🔥)가 높은 상위 건부터 채우면 됩니다. (buyKorea 상세는 여러 건을 한 번에 이어붙여도 인식되고, 영문 사이트는 한 건씩 붙여넣는 것을 권장합니다.) ⚠️ 수집한 컨택으로의 콜드 발송은 대상국 규제(GDPR/CAN-SPAM/CASL)를 따르세요.
            </div>
          </div>
        )}

        {/* 🤖 상세 서버 자동 수집 (대표 승인 "위험 감수" — 계정 정지 위험, 게이트 무장 필요) */}
        {showAuto && (
          <div className="mb-4 rounded-xl border-2 border-red-200 bg-red-50/50 p-4">
            {/* 🔖 북마클릿 — F12·쿠키 없이 원클릭(추천). 대표 브라우저 세션으로 읽어 안전 */}
            <div className="mb-3 rounded-lg border-2 border-indigo-200 bg-indigo-50/60 p-3">
              <div className="text-sm font-semibold text-indigo-700 mb-1">🔖 원클릭 북마클릿 (추천 · F12·쿠키 복사 없음)</div>
              <div className="text-[11px] text-gray-600 mb-2">아래 파란 버튼을 <b>브라우저 즐겨찾기 바(북마크바)로 드래그</b>해 등록하세요. 그다음 buyKorea 등에서 <b>구매요청 리스트나 상세 페이지를 열고 이 즐겨찾기를 클릭</b>하면, 그 페이지의 바이어들이 자동으로 여기에 저장됩니다. <b>대표님이 이미 로그인한 브라우저</b>가 읽는 것이라 F12·쿠키·서버 로그인이 전혀 필요 없고, 계정 위험도 가장 낮습니다.</div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* href 는 ref 로 주입(React 의 javascript: 차단 우회) */}
                <a ref={bmRef} onClick={e => e.preventDefault()} draggable className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium cursor-move select-none inline-block" title="이 버튼을 브라우저 즐겨찾기 바로 드래그하세요">📥 유어딜 바이어 수집</a>
                <span className="text-[11px] text-gray-400">← 이 버튼을 즐겨찾기 바로 드래그</span>
                {ingestToken && <button onClick={resetToken} className="text-[11px] text-gray-400 underline">토큰 재발급</button>}
              </div>
              <div className="mt-1.5 text-[11px] text-gray-400">※ buyKorea 는 바이어 이메일을 가리므로, 이 방법도 회사명·웹사이트·국가·품목까지 모읍니다. 이메일은 위 「🌐 웹사이트에서 이메일 찾기」로 채우세요.</div>
            </div>
            <div className="text-xs text-gray-400 mb-2">— 또는 아래는 서버가 직접 방문하는 방식(고급·위험) —</div>
            <div className="text-sm font-semibold text-red-700 mb-1">🤖 상세 페이지 서버 자동 수집 (실험 · 위험)</div>
            <div className="text-xs text-red-700 bg-red-100/70 rounded-lg p-2 mb-3">
              ⚠️ 이 기능은 <b>대표님 로그인 쿠키로 서버가 상세 페이지들을 자동 방문</b>합니다. buyKorea·tradeKorea·EC21·ECPlaza·GoBizKorea 각 사이트 약관은 자동·대량 수집을 금지하며, <b>계정이 정지될 수 있습니다.</b> 위험을 감수하고 사용하세요. (방어: 소량 배치 · 요청 간 지연 · 쿠키는 저장하지 않고 이 요청에만 사용)
              {!meta.autoFetchEnabled && <div className="mt-1 font-semibold">🔒 현재 OFF — Cloudflare 환경변수 <code>BUYER_AUTO_FETCH_ENABLED=true</code> 를 설정해야 작동합니다.</div>}
            </div>
            <ol className="text-[11px] text-gray-600 ml-4 list-decimal space-y-0.5 mb-2">
              <li>수집할 사이트에 <b>로그인</b>한 뒤, 구매요청 <b>리스트 페이지</b>를 엽니다.</li>
              <li>브라우저 <b>F12 → Network</b> 탭 → 아무 요청 클릭 → <b>Request Headers</b> 의 <code>cookie:</code> 값을 통째로 복사해 아래에 붙여넣기.</li>
              <li>그 리스트 페이지의 <b>주소(URL)</b>를 복사해 붙여넣고 「자동 수집 실행」.</li>
            </ol>
            <textarea value={autoCookie} onChange={e => setAutoCookie(e.target.value)} rows={2} placeholder="로그인 쿠키(cookie: 헤더 값 전체) 붙여넣기" className="w-full px-2 py-1.5 rounded-lg border border-red-200 text-xs font-mono text-gray-900 mb-2" />
            <div className="flex flex-wrap items-center gap-2">
              <input value={autoListUrl} onChange={e => setAutoListUrl(e.target.value)} placeholder="리스트 페이지 URL (예: https://www.buykorea.org/seller/ec/inq/selectInquiryList.do?...)" className="flex-1 min-w-[240px] px-2 py-1.5 rounded-lg border border-red-200 text-sm text-gray-900" />
              <label className="text-xs text-gray-600">최대 <input type="number" min={1} max={30} value={autoMax} onChange={e => setAutoMax(Math.min(30, Math.max(1, Number(e.target.value) || 10)))} className="w-16 px-2 py-1.5 rounded-lg border border-red-200 text-sm text-gray-900" />건</label>
              <button onClick={runAutoFetch} disabled={autoRunning} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">{autoRunning ? '수집 중…' : '자동 수집 실행'}</button>
            </div>
            <label className="mt-2 flex items-center gap-1.5 text-xs text-gray-700"><input type="checkbox" checked={autoSave} onChange={e => setAutoSave(e.target.checked)} /> <b>쿠키·URL 저장</b> (다음부턴 아래 「저장된 소스 전부 수집」 버튼 한 번이면 됩니다 · 쿠키는 암호화 저장, 만료 시에만 다시 붙여넣기)</label>

            {/* 저장된 소스 — 재입력 없이 원클릭/반복 수집 */}
            <div className="mt-3 pt-3 border-t border-red-100">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold text-gray-800">💾 저장된 소스 {autoConfig.sources.length > 0 && `(${autoConfig.sources.length})`} {autoConfig.cookieHosts.length > 0 && <span className="text-[11px] font-normal text-emerald-600">· 쿠키 저장됨: {autoConfig.cookieHosts.join(', ')}</span>}</div>
                {autoConfig.sources.length > 0 && <button onClick={runSaved} disabled={autoRunning} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium disabled:opacity-50">{autoRunning ? '수집 중…' : '▶ 저장된 소스 전부 수집'}</button>}
              </div>
              {autoConfig.sources.length === 0 ? (
                <div className="text-[11px] text-gray-400">아직 없습니다. 위에서 「쿠키·URL 저장」 체크하고 한 번 실행하면 여기에 쌓입니다.</div>
              ) : (
                <div className="space-y-1">
                  {autoConfig.sources.map(s => (
                    <div key={s.url} className="flex items-center gap-2 text-[11px] bg-white rounded-lg border border-gray-200 px-2 py-1">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{s.host}</span>
                      <span className="flex-1 truncate text-gray-500" title={s.url}>{s.url}</span>
                      <button onClick={() => forgetSource(s.url)} className="text-gray-300 hover:text-red-500 shrink-0">삭제</button>
                    </div>
                  ))}
                </div>
              )}
              {/* 🌙 완전 무인 — 매일 밤 저장 소스 자동 수집 + 웹사이트 이메일 보강 */}
              <label className="mt-2 flex items-start gap-1.5 text-xs text-gray-700">
                <input type="checkbox" checked={autoConfig.cronEnabled} onChange={e => toggleCron(e.target.checked)} className="mt-0.5" />
                <span><b>🌙 매일 밤 무인 자동 수집</b> — 저장된 소스를 매일 자동으로 수집하고, 웹사이트에서 이메일까지 채웁니다. (저장된 쿠키가 유효한 동안만 · 쿠키 만료 시 다시 붙여넣기 필요{!autoConfig.cronEnabled ? '' : ' · 현재 ON'})</span>
              </label>
            </div>
            <div className="mt-2 text-[11px] text-gray-400">※ 한 번에 최대 30건(계정 보호). buyKorea 외 사이트는 리스트 HTML 구조에 따라 링크 인식이 다를 수 있어, 안 되면 상세 URL 직접 지정이 안전합니다. 무인 수집은 <code>BUYER_AUTO_FETCH_ENABLED=true</code> + 위 토글 ON 일 때만 작동(매일 UTC 03시 = 한국 낮 12시).</div>
          </div>
        )}

        {/* 바이어 직접 추가 (LinkedIn/buyKorea 손수 발굴분 — 완전 무료 수동 입력) */}
        {showAdd && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500 mb-2">LinkedIn·buyKorea 등에서 찾은 바이어를 직접 입력 → 매칭 스코어·파이프라인 자동 반영. 회사명만 필수.</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="회사명 *" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="국가 (Vietnam)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="카테고리 (K-beauty)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <select value={form.intent_signal} onChange={e => setForm(f => ({ ...f, intent_signal: e.target.value }))} className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900">
                {Object.entries(intentTiers).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input value={form.decision_maker} onChange={e => setForm(f => ({ ...f, decision_maker: e.target.value }))} placeholder="담당자 이름" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.decision_maker_title} onChange={e => setForm(f => ({ ...f, decision_maker_title: e.target.value }))} placeholder="담당자 직책" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.decision_maker_email} onChange={e => setForm(f => ({ ...f, decision_maker_email: e.target.value }))} placeholder="담당자 이메일" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="회사 이메일" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="웹사이트/LinkedIn URL" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 lg:col-span-2" />
              <input value={form.est_volume} onChange={e => setForm(f => ({ ...f, est_volume: e.target.value }))} placeholder="규모/물량 (선택)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
              <label className="flex items-center gap-1.5 text-sm text-gray-600 px-1"><input type="checkbox" checked={form.imports_from_korea} onChange={e => setForm(f => ({ ...f, imports_from_korea: e.target.checked }))} /> 한국 수입 이력</label>
            </div>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="메모 (취급 품목, 요청사항 등)" rows={2} className="mt-2 w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900" />
            <div className="mt-2 flex gap-2">
              <button onClick={submitAdd} disabled={saving} className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50">{saving ? '저장 중…' : '추가'}</button>
              <button onClick={() => { setForm(emptyForm); setShowAdd(false) }} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-600">취소</button>
            </div>

            {/* 여러 건 붙여넣기 (buyKorea 목록 복붙 / 엑셀·시트) */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-1.5"><b>buyKorea·tradeKorea·EC21 등 구매요청 리스트를 통째로 복사(Ctrl+A → Ctrl+C)해 붙여넣기(Ctrl+V)</b> → 제품·국가·카테고리 자동 추출(여러 건 한 번에). 상세 페이지를 붙여넣으면 회사명·담당자·이메일·현재수입국까지 채워집니다(마스킹된 연락처는 자동 제외). 엑셀/시트 표(첫 줄 헤더, 탭·쉼표 구분)도 인식. <button type="button" onClick={() => setShowGuide(true)} className="text-blue-600 underline">수집 방법 보기</button></div>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={4} placeholder={'buyKorea 인콰이어리 페이지 전체를 붙여넣거나,\ncompany\tcountry\tcategory\temail\nABC Trading\tVietnam\tK-beauty\tbuyer@abc.com'} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono text-gray-900" />
              <button onClick={submitBulk} disabled={importing} className="mt-2 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{importing ? '가져오는 중…' : '붙여넣기 일괄 추가'}</button>
            </div>
          </div>
        )}

        {/* 매칭 타깃 관리 (= 무엇을 어디로 미는가 = 매칭 기준) */}
        {showTargets && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500 mb-2">매칭 타깃 = 우리 수출 카테고리 × 타깃 시장. 여기 있는 조합에 부합하는 바이어가 매칭 스코어 +25 (변경 시 풀 자동 재스코어).</div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="카테고리(K-beauty)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 w-40" />
              <input value={newCountry} onChange={e => setNewCountry(e.target.value)} placeholder="시장(Vietnam)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 w-40" />
              <button onClick={addTarget} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm">타깃 추가</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {targets.map(t => (
                <button key={t.id} onClick={() => toggleTarget(t)} title={`발굴 ${t.found_total} · 저장 ${t.saved_total}`}
                  className={`px-2 py-1 rounded-full text-xs ${t.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400 line-through'}`}>
                  {t.category}·{t.country} {t.saved_total > 0 ? `(${t.saved_total})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 리스트 — 매칭 스코어 우선 정렬 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">불러오는 중…</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              바이어가 없습니다. {meta.feeds === 0 ? '무료 피드/오픈API URL(BUYER_FEED_URLS)을 등록한 뒤 「지금 수집」을 눌러주세요.' : '「지금 수집」을 눌러 발굴을 시작하세요.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {leads.map(l => (
                <div key={l.id} className="p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold ${scoreCls(l.match_score)}`} title="매칭 스코어">{l.match_score ?? '–'}</div>
                  <div className="min-w-[180px] flex-1">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                      {l.company}
                      {l.imports_from_korea === 1 && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">🇰🇷 수입이력</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[intentTiers[l.intent_signal]?.label || l.intent_signal, l.category, l.country, l.target_market && `→${l.target_market}`, l.est_volume].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="min-w-[200px] text-xs text-gray-600">
                    {l.decision_maker && <div className="text-gray-800">👤 {l.decision_maker}{l.decision_maker_title ? ` (${l.decision_maker_title})` : ''}</div>}
                    {l.decision_maker_email && <div>✉ {l.decision_maker_email}</div>}
                    {!l.decision_maker_email && l.email && <div>✉ {l.email}</div>}
                    {l.phone && <div>☎ {l.phone}</div>}
                    {l.website && <a href={l.website.startsWith('http') ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">{l.website}</a>}
                    {!l.email && !l.decision_maker_email && !l.phone && !l.website && <span className="text-amber-600" title="상세 페이지를 붙여넣으면 이 행에 연락처가 채워집니다">🔎 상세 확인 필요</span>}
                  </div>
                  <select value={l.status} onChange={e => patch(l.id, { status: e.target.value })}
                    className={`px-2 py-1 rounded-full text-xs border-0 ${STAGE_META[l.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                    {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
                  </select>
                  <button onClick={() => remove(l.id)} className="text-xs text-gray-300 hover:text-red-500">삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          ⚠️ 수집된 컨택은 공개된 비즈니스 정보입니다. 마케팅 발송(콜드 아웃리치)은 대상국 규제(EU GDPR·미국 CAN-SPAM·캐나다 CASL)를 따르세요 — 이 도구는 발굴·자격심사·매칭까지만 담당합니다.
        </p>
      </div>
    </AdminLayout>
  )
}
