import { useState, useEffect, useCallback } from 'react'
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
  const [meta, setMeta] = useState<{ enabled: boolean; feeds: number }>({ enabled: false, feeds: 0 })
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

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/buyer-pool/stats')
      if (r.data?.success) {
        setStats(r.data.stats); setByIntent(r.data.byIntent || []); setByCountry(r.data.byCountry || []); setByCategory(r.data.byCategory || [])
        setIntentTiers(r.data.intentTiers || {})
        setMeta({ enabled: !!r.data.enabled, feeds: r.data.feeds || 0 })
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

  useEffect(() => { loadStats(); loadTargets() }, [loadStats, loadTargets])
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
          <button onClick={() => setShowAdd(v => !v)} className="px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium">+ 바이어 직접 추가</button>
          <button onClick={collect} disabled={collecting} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{collecting ? '수집 중…' : '지금 수집'}</button>
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
