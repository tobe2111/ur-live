/**
 * 🤝 B2B 파트너(업체) 풀 어드민 — /admin/partner-pool (2026-07-21).
 *   격리 테이블 ad_company_leads 열람/큐레이션 + 수동입력(대표 방배 리드) + 아웃리치 상태머신 + CSV.
 *   1단계(테이블·어드민). 수집엔진(레인 A 네이버 지역검색 / B 레지스트리)은 후속. 라이트 테마(AdminLayout).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

interface Lead {
  id: number; company_name: string; category: string | null; subcategory: string | null
  tier: number | null; region: string | null; website: string | null; email: string | null; phone: string | null
  address: string | null; status: string; memo: string | null; contact_channel: string | null
  follow_up_at: string | null; source: string; source_keyword: string | null; collected_at: string
}
interface Stats { total: number; with_contact: number; with_email: number; active_pipeline: number; recent7: number }
interface Meta { categories: Record<string, string[]>; statuses: string[]; channels: string[]; tier: { min: number; max: number } }
interface Collect { gate: boolean; adsBinding: boolean; run: { last_run?: string; found?: number; saved?: number; total_saved?: number; diag?: { configured?: boolean; error?: string } } | null }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-700' },
  contacted: { label: '컨택함', cls: 'bg-blue-100 text-blue-700' },
  interested: { label: '관심', cls: 'bg-amber-100 text-amber-700' },
  contracted: { label: '계약', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-600' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const CHANNEL_LABEL: Record<string, string> = { call: '전화', email: '이메일', visit: '방문', sms: '문자', kakao: '카톡', other: '기타' }
const TIER_LABEL = (t: number | null) => t == null ? '—' : `${t}순위`
const EMPTY_ADD = { company_name: '', category: '', subcategory: '', tier: '', region: '', phone: '', email: '', website: '', address: '' }

export default function AdminPartnerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [collect, setCollect] = useState<Collect | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [add, setAdd] = useState({ ...EMPTY_ADD })
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  // 필터
  const [fCategory, setFCategory] = useState('')
  const [fTier, setFTier] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fContact, setFContact] = useState('')
  const [q, setQ] = useState('')

  const loadMeta = useCallback(async () => {
    try { const r = await api.get('/api/admin/partner-pool/meta'); if (r.data?.success) setMeta(r.data) } catch { /* noop */ }
  }, [])
  const loadStats = useCallback(async () => {
    try { const r = await api.get('/api/admin/partner-pool/stats'); if (r.data?.success) { setStats(r.data.stats); setCollect(r.data.collect || null) } } catch { /* noop */ }
  }, [])
  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (fCategory) p.set('category', fCategory)
      if (fTier) p.set('tier', fTier)
      if (fStatus) p.set('status', fStatus)
      if (fContact === 'contact') p.set('hasContact', '1')
      if (fContact === 'email') p.set('hasEmail', '1')
      if (q.trim()) p.set('q', q.trim())
      const r = await api.get(`/api/admin/partner-pool?${p.toString()}`)
      if (r.data?.success) setLeads(r.data.leads || [])
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [fCategory, fTier, fStatus, fContact, q])

  useEffect(() => { loadMeta(); loadStats() }, [loadMeta, loadStats])
  useEffect(() => { loadLeads() }, [loadLeads])

  async function submitAdd() {
    if (add.company_name.trim().length < 2) { toast.error('업체명을 입력하세요'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/admin/partner-pool', { ...add, tier: add.tier || null })
      if (r.data?.success) { toast.success('추가되었습니다'); setAdd({ ...EMPTY_ADD }); setShowAdd(false); await Promise.all([loadLeads(), loadStats()]) }
      else toast.error('이미 등록된 업체이거나 저장에 실패했습니다')
    } catch { toast.error('저장 실패') } finally { setSaving(false) }
  }

  async function patchLead(id: number, patch: Record<string, unknown>) {
    // 낙관적 갱신 후 서버 반영(실패 시 재조회로 정정).
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } as Lead : l))
    try {
      const r = await api.patch(`/api/admin/partner-pool/${id}`, patch)
      if (!r.data?.success) { toast.error(r.data?.error || '저장 실패'); await loadLeads() }
      else await loadStats()
    } catch { toast.error('저장 실패'); await loadLeads() }
  }

  async function removeLead(id: number) {
    if (!window.confirm('이 업체 리드를 삭제할까요?')) return
    try {
      const r = await api.delete(`/api/admin/partner-pool/${id}`)
      if (r.data?.success) { setLeads(prev => prev.filter(l => l.id !== id)); await loadStats() }
      else toast.error('삭제 실패')
    } catch { toast.error('삭제 실패') }
  }

  async function submitImport() {
    if (importText.trim().length < 10) { toast.error('헤더(회사명 포함) 있는 표를 붙여넣으세요'); return }
    setImporting(true)
    try {
      const r = await api.post('/api/admin/partner-pool/import', { text: importText })
      if (r.data?.success) { toast.success(`${r.data.parsed}건 중 ${r.data.saved}건 저장`); setImportText(''); setShowImport(false); await Promise.all([loadLeads(), loadStats()]) }
      else toast.error(r.data?.error || '임포트 실패')
    } catch { toast.error('임포트 실패') } finally { setImporting(false) }
  }

  async function runCollect() {
    if (!collect?.adsBinding) { toast.error('ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작합니다'); return }
    setCollecting(true)
    try {
      const r = await api.post('/api/admin/partner-pool/collect', {})
      if (r.data?.success) {
        toast.success('레인 A 수집 시작 — 잠시 후 반영됩니다')
        for (let i = 0; i < 3; i++) { await new Promise(res => setTimeout(res, 5000)); await Promise.all([loadStats(), loadLeads()]) }
      } else toast.error(r.data?.error || '수집 위임 실패')
    } catch { toast.error('수집 위임 실패') } finally { setCollecting(false) }
  }

  const subcats = meta && add.category ? (meta.categories[add.category] || []) : []
  const statCard = (label: string, val: number, hint?: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{formatNumber(val)}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-400">{hint}</div>}
    </div>
  )

  return (
    <AdminLayout title="파트너 풀">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <DashboardPageHeader title="🤝 파트너 풀" subtitle="유어딜 매장 입점을 대신 데려올 업체 DB — 수동입력·아웃리치 관리 (수집 ≠ 발송)" />

        {/* 통계 스트립 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {statCard('전체', stats?.total || 0)}
          {statCard('연락처 보유', stats?.with_contact || 0, '전화 또는 이메일')}
          {statCard('이메일 보유', stats?.with_email || 0)}
          {statCard('진행 중', stats?.active_pipeline || 0, '신규·거절 제외')}
          {statCard('최근 7일', stats?.recent7 || 0)}
        </div>

        {/* 액션 바 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={() => setShowAdd(v => !v)} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium">{showAdd ? '입력 닫기' : '＋ 업체 추가'}</button>
          <button onClick={() => setShowImport(v => !v)} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium" title="공정위 프랜차이즈 정보공개서·상인회 명부 CSV/TSV 붙여넣기(레인 B·C)">{showImport ? '닫기' : '📋 명부 붙여넣기'}</button>
          <button onClick={runCollect} disabled={collecting || !collect?.adsBinding} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50" title={collect?.adsBinding ? '네이버 지역검색으로 방배/서초/강남 업체 1회 수집(레인 A)' : 'ur-ads 서비스바인딩 필요'}>{collecting ? '수집 중…' : '🔍 지금 수집'}</button>
          <a href="/api/admin/partner-pool/export?format=csv" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium">⬇ CSV 내보내기</a>
          <div className="grow" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="업체명·지역·전화·수집키워드 검색" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm w-60" />
        </div>

        {/* 레인 A(네이버 지역검색) 자동수집 상태 */}
        {collect && (
          <div className="mb-3 text-xs text-gray-500">
            레인 A 자동수집 <span className={collect.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{collect.gate ? 'ON · 홀수시' : 'OFF'}</span>
            {collect.run?.diag?.error ? <span className="text-amber-600"> · {collect.run.diag.error}</span>
              : collect.run?.last_run ? <span> · 최근 {collect.run.last_run.slice(5, 16)} · 발굴 {collect.run.found ?? 0} / 저장 {collect.run.saved ?? 0}</span>
                : <span className="text-gray-400"> · 아직 실행 안 됨</span>}
          </div>
        )}

        {/* 명부 붙여넣기(레인 B·C) */}
        {showImport && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2">헤더(회사명·전화·주소·홈페이지·이메일·업종…) 있는 표를 붙여넣으세요. 공정위 정보공개서·상인회 명부 CSV/TSV 자동 인식. 회사명 컬럼 필수.</p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6} placeholder={'회사명\t전화\t주소\t홈페이지\nOO간판\t02-...\t서초구...\thttp://...'} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm font-mono" />
            <div className="flex justify-end mt-2">
              <button onClick={submitImport} disabled={importing} className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{importing ? '저장 중…' : '임포트'}</button>
            </div>
          </div>
        )}

        {/* 수동 입력 폼 */}
        {showAdd && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={add.company_name} onChange={e => setAdd({ ...add, company_name: e.target.value })} placeholder="업체명 *" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <select value={add.category} onChange={e => setAdd({ ...add, category: e.target.value, subcategory: '' })} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm">
              <option value="">분류 선택</option>
              {meta && Object.keys(meta.categories).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={add.subcategory} onChange={e => setAdd({ ...add, subcategory: e.target.value })} disabled={!subcats.length} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm disabled:bg-gray-50">
              <option value="">세부 업종</option>
              {subcats.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={add.region} onChange={e => setAdd({ ...add, region: e.target.value })} placeholder="지역 (예: 방배)" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <select value={add.tier} onChange={e => setAdd({ ...add, tier: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm">
              <option value="">우선순위 없음</option>
              {[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}순위</option>)}
            </select>
            <input value={add.phone} onChange={e => setAdd({ ...add, phone: e.target.value })} placeholder="전화" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <input value={add.email} onChange={e => setAdd({ ...add, email: e.target.value })} placeholder="이메일" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <input value={add.website} onChange={e => setAdd({ ...add, website: e.target.value })} placeholder="홈페이지" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <input value={add.address} onChange={e => setAdd({ ...add, address: e.target.value })} placeholder="주소" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <div className="md:col-span-3 flex justify-end">
              <button onClick={submitAdd} disabled={saving} className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        )}

        {/* 필터 바 */}
        <div className="flex flex-wrap gap-2 mb-3 text-sm">
          <select value={fCategory} onChange={e => setFCategory(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">전체 분류</option>
            {meta && Object.keys(meta.categories).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fTier} onChange={e => setFTier(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">전체 순위</option>
            {[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}순위</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">전체 상태</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={fContact} onChange={e => setFContact(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">연락처 무관</option>
            <option value="contact">연락처 보유</option>
            <option value="email">이메일 보유</option>
          </select>
        </div>

        {/* 목록 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2 font-medium">순위</th>
                <th className="px-3 py-2 font-medium">업체 / 분류</th>
                <th className="px-3 py-2 font-medium">지역</th>
                <th className="px-3 py-2 font-medium">연락처</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">채널</th>
                <th className="px-3 py-2 font-medium">팔로업</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">불러오는 중…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">등록된 업체가 없습니다. ‘＋ 업체 추가’로 시작하세요.</td></tr>
              ) : leads.map(l => (
                <tr key={l.id} className="border-b border-gray-100 align-top">
                  <td className="px-3 py-2">
                    <select value={l.tier ?? ''} onChange={e => patchLead(l.id, { tier: e.target.value ? Number(e.target.value) : null })} className="rounded border border-gray-200 bg-white text-gray-900 text-xs px-1 py-1">
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{l.company_name}</div>
                    <div className="text-xs text-gray-400">{[l.category, l.subcategory].filter(Boolean).join(' · ') || '—'}{l.website && <> · <a href={l.website.startsWith('http') ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" className="text-blue-600">홈</a></>}</div>
                    {l.memo && <div className="text-xs text-gray-500 mt-0.5">📝 {l.memo}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{l.region || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {l.phone ? <div>📞 {l.phone}</div> : null}
                    {l.email ? <div className="text-xs text-gray-500">✉ {l.email}</div> : null}
                    {!l.phone && !l.email && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <select value={l.status} onChange={e => patchLead(l.id, { status: e.target.value })} className={`rounded px-2 py-1 text-xs font-medium border-0 ${STATUS_META[l.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                      {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={l.contact_channel ?? ''} onChange={e => patchLead(l.id, { contact_channel: e.target.value || null })} className="rounded border border-gray-200 bg-white text-gray-700 text-xs px-1 py-1">
                      <option value="">—</option>
                      {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="date" value={l.follow_up_at ? l.follow_up_at.slice(0, 10) : ''} onChange={e => patchLead(l.id, { follow_up_at: e.target.value || null })} className="rounded border border-gray-200 bg-white text-gray-700 text-xs px-1 py-1" />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <button onClick={() => { const m = window.prompt('메모', l.memo || ''); if (m !== null) patchLead(l.id, { memo: m }) }} className="text-gray-400 hover:text-gray-700 text-xs mr-2">메모</button>
                    <button onClick={() => removeLead(l.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-gray-400">{leads.length}건 표시 · <TierBreakdown leads={leads} /></div>
      </div>
    </AdminLayout>
  )
}

function TierBreakdown({ leads }: { leads: Lead[] }) {
  const by = new Map<string, number>()
  for (const l of leads) { const k = TIER_LABEL(l.tier); by.set(k, (by.get(k) || 0) + 1) }
  return <>{[...by.entries()].map(([k, n]) => `${k} ${n}`).join(' · ') || '—'}</>
}
