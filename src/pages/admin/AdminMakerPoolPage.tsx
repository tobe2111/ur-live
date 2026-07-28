/**
 * 🏭 제조사(브랜드사)·판매사 후보 풀 어드민 — /admin/maker-pool (2026-07-28 대표 "제조사·판매사 DB도").
 *   도매몰(유통스타트) 전용 — 소비자/유어애즈 파트너 풀과 **격리된 테이블**을 본다.
 *   라이트 테마(AdminLayout). 수집(카카오 로컬) + 판매사 후보 임포트(통신판매 원부) + 큐레이션 + CSV.
 */
import { memo, useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatNumber, kstShort } from '@/utils/format'

interface Lead {
  id: number; company_name: string; kind: string; category: string | null; brand_name: string | null
  region: string | null; address: string | null; phone: string | null; email: string | null; website: string | null
  business_no: string | null; description: string | null; contact_source: string | null
  source: string; status: string; memo: string | null; collected_at: string
}
interface Stats { total: number; makers: number; resellers: number; with_contact: number; with_email: number; pipeline: number }
interface CollectInfo { gate: boolean; run: { last_run?: string; keyword?: string; found?: number; saved?: number; total_saved?: number; diag?: { configured?: boolean; error?: string } } | null }
interface ImportInfo { last_run?: string; scanned?: number; saved?: number; done?: boolean; total_saved?: number }

const KIND_META: Record<string, { label: string; cls: string }> = {
  maker: { label: '제조·브랜드', cls: 'bg-emerald-100 text-emerald-700' },
  reseller: { label: '판매사 후보', cls: 'bg-sky-100 text-sky-700' },
}
const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-700' },
  contacted: { label: '컨택함', cls: 'bg-blue-100 text-blue-700' },
  interested: { label: '관심', cls: 'bg-amber-100 text-amber-700' },
  contracted: { label: '계약', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-600' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const PAGE_SIZE = 100

const LeadRow = memo(function LeadRow({ lead, onStatus }: { lead: Lead; onStatus: (id: number, s: string) => void }) {
  const k = KIND_META[lead.kind] || KIND_META.maker
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900">{lead.company_name}</div>
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          <span className={`px-1.5 py-0.5 rounded text-[11px] ${k.cls}`}>{k.label}</span>
          {lead.brand_name && <span className="text-[11px] text-gray-500">브랜드 {lead.brand_name}</span>}
          {lead.category && <span className="text-[11px] text-gray-400">{lead.category}</span>}
        </div>
      </td>
      <td className="px-3 py-2 text-gray-600">{lead.region || '—'}</td>
      <td className="px-3 py-2">
        {lead.phone ? <a href={`tel:${lead.phone}`} className="text-blue-600">{lead.phone}</a> : <span className="text-gray-300">—</span>}
        {lead.email && <div className="text-[11px] text-gray-500 break-all">{lead.email}</div>}
        {lead.contact_source && <div className="text-[11px] text-gray-400">출처: {lead.contact_source}</div>}
      </td>
      <td className="px-3 py-2">
        <select value={lead.status} onChange={e => onStatus(lead.id, e.target.value)}
          className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-900 text-xs">
          {Object.entries(STATUS_META).map(([k2, v]) => <option key={k2} value={k2}>{v.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-[11px] text-gray-400">{kstShort(lead.collected_at)}</td>
    </tr>
  )
})

export default function AdminMakerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [collect, setCollect] = useState<CollectInfo | null>(null)
  const [importRun, setImportRun] = useState<ImportInfo | null>(null)
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const qd = useDebouncedValue(q, 350)
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/maker-pool/stats')
      if (r.data?.success) { setStats(r.data.stats); setCollect(r.data.collect || null); setImportRun(r.data.importRun || null) }
    } catch { /* noop */ }
  }, [])
  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (kind) p.set('kind', kind)
      if (qd.trim()) p.set('q', qd.trim())
      p.set('limit', String(PAGE_SIZE)); p.set('offset', String(page * PAGE_SIZE))
      const r = await api.get(`/api/admin/maker-pool?${p.toString()}`)
      if (r.data?.success) { setLeads(r.data.leads || []); setTotal(Number(r.data.total) || 0) }
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [kind, qd, page])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadLeads() }, [loadLeads])
  useEffect(() => { setPage(0) }, [kind, qd])

  const run = useCallback(async (path: string, label: string) => {
    setBusy(path)
    try {
      const r = await api.post(`/api/admin/maker-pool/${path}`, {})
      if (r.data?.success) {
        toast.success(`${label} 시작 — 잠시 후 반영됩니다`)
        for (let i = 0; i < 4; i++) { await new Promise(res => setTimeout(res, 5000)); await Promise.all([loadStats(), loadLeads()]) }
      } else toast.error(r.data?.error || `${label} 실패`)
    } catch { toast.error(`${label} 실패`) } finally { setBusy('') }
  }, [loadLeads, loadStats])

  const setStatus = useCallback(async (id: number, status: string) => {
    try {
      const r = await api.patch(`/api/admin/maker-pool/${id}`, { status })
      if (r.data?.success) { setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l)); loadStats() }
      else toast.error(r.data?.error || '상태 변경 실패')
    } catch { toast.error('상태 변경 실패') }
  }, [loadStats])

  const card = (label: string, value: number, hint?: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900">{formatNumber(value)}</div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
  )

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6">
        <DashboardPageHeader title="🏭 제조사·판매사 후보 풀" description="도매몰(유통스타트) 전용 — 제조사(브랜드사) 공급자 + 판매사 후보. 소비자 파트너 풀과 별개 DB." />

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-3">
          {card('전체', stats?.total || 0)}
          {card('제조·브랜드', stats?.makers || 0, '공급자측')}
          {card('판매사 후보', stats?.resellers || 0, '구매자측')}
          {card('연락처 보유', stats?.with_contact || 0)}
          {card('이메일 보유', stats?.with_email || 0)}
          {card('진행 중', stats?.pipeline || 0, '신규·거절 제외')}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={() => run('collect', '제조사 수집')} disabled={busy !== ''}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            title="카카오 로컬로 품목×지역 그리드 순회 — 제조사·브랜드사(전화·주소 직접 확보)">
            {busy === 'collect' ? '⏳ 수집 중…' : '🏭 제조사 수집'}
          </button>
          <button onClick={() => run('import-resellers', '판매사 후보 임포트')} disabled={busy !== ''}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            title="이미 수집된 통신판매사업자 원부(대표자 이메일 포함)를 판매사 후보로 복사 — 원본은 무접촉">
            {busy === 'import-resellers' ? '⏳ 임포트 중…' : '📥 판매사 후보 임포트'}
          </button>
          <select value={kind} onChange={e => setKind(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm">
            <option value="">종류 전체</option>
            <option value="maker">제조·브랜드</option>
            <option value="reseller">판매사 후보</option>
          </select>
          <div className="grow" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="회사명·브랜드·지역·연락처 검색"
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm w-60" />
          <a href="/api/admin/maker-pool/export?format=csv" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm">⬇ CSV</a>
        </div>

        {/* 수집·임포트 상태줄 */}
        <div className="mb-3 text-xs text-gray-500">
          🏭 제조사 수집 <span className={collect?.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{collect?.gate ? 'ON · 자동' : 'OFF(수동만)'}</span>
          {collect?.run?.diag?.error ? <span className="text-amber-600"> · ⚠️ {collect.run.diag.error}</span>
            : collect?.run?.last_run ? <span> · 최근 {kstShort(collect.run.last_run)} · 발굴 {collect.run.found ?? 0} / 저장 {collect.run.saved ?? 0} (누적 {formatNumber(collect.run.total_saved ?? 0)})</span>
              : <span className="text-gray-400"> · 아직 실행 안 됨</span>}
          <span className="mx-2 text-gray-300">|</span>
          📥 판매사 후보 임포트
          {importRun?.last_run
            ? <span> · 최근 {kstShort(importRun.last_run)} · 이번 {formatNumber(importRun.saved ?? 0)} (누적 {formatNumber(importRun.total_saved ?? 0)}){importRun.done ? ' · 전량 완료 ✅' : ''}</span>
            : <span className="text-gray-400"> · 아직 실행 안 됨</span>}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">회사 / 브랜드</th>
                <th className="px-3 py-2 text-left font-medium">지역</th>
                <th className="px-3 py-2 text-left font-medium">연락처</th>
                <th className="px-3 py-2 text-left font-medium">상태</th>
                <th className="px-3 py-2 text-left font-medium">수집</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">불러오는 중…</td></tr>
                : leads.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">아직 데이터가 없습니다 — 위 [🏭 제조사 수집] 또는 [📥 판매사 후보 임포트]를 눌러주세요</td></tr>
                  : leads.map(l => <LeadRow key={l.id} lead={l} onStatus={setStatus} />)}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-2 mt-3 text-sm">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 disabled:opacity-40">이전</button>
            <span className="text-gray-500">{page + 1} / {Math.ceil(total / PAGE_SIZE)} (총 {formatNumber(total)})</span>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}
              className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 disabled:opacity-40">다음</button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
