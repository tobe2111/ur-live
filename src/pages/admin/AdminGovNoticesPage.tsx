import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber, kstShort } from '@/utils/format'

interface Notice {
  id: number; source: string; notice_no: string; title: string; org: string | null
  biz_field: string | null; url: string | null; amount: string | null
  end_date: string | null; posted_date: string | null; keyword: string | null
  status: string; memo: string | null
}
interface Stats { total: number; bid: number; grant: number; recent7: number; actionable: number }
interface Collect { gate: boolean; adsBinding: boolean; run: { last_run?: string; found?: number; saved?: number; bid?: number; grant?: number; diag?: { error?: string } } | null }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-700' },
  reviewing: { label: '검토', cls: 'bg-tone-warn-bg text-tone-warn' },
  applied: { label: '응모', cls: 'bg-tone-info-bg text-tone-info' },
  shared: { label: '전달함', cls: 'bg-tone-info-bg text-tone-info' },
  won: { label: '수주', cls: 'bg-tone-ok-bg text-tone-ok' },
  skip: { label: '스킵', cls: 'bg-gray-100 text-gray-400' },
}
const STATUSES = ['new', 'reviewing', 'applied', 'shared', 'won', 'skip']

export default function AdminGovNoticesPage() {
  const [rows, setRows] = useState<Notice[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [collect, setCollect] = useState<Collect | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fSource, setFSource] = useState('')
  const [q, setQ] = useState('')

  const loadStats = useCallback(async () => {
    try { const r = await api.get('/api/admin/gov-notices/stats'); if (r.data?.success) { setStats(r.data.stats); setCollect(r.data.collect || null) } } catch { /* noop */ }
  }, [])
  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (fSource) p.set('source', fSource)
      if (q.trim()) p.set('q', q.trim())
      const r = await api.get(`/api/admin/gov-notices?${p.toString()}`)
      if (r.data?.success) setRows(r.data.notices || [])
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [fSource, q])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadRows() }, [loadRows])

  async function runCollect() {
    if (!collect?.adsBinding) { toast.error('ur-ads 서비스바인딩 미설정'); return }
    setCollecting(true)
    try {
      const r = await api.post('/api/admin/gov-notices/collect', {})
      if (r.data?.success) {
        toast.success('공고 스캔 시작 — 잠시 후 반영됩니다')
        for (let i = 0; i < 3; i++) { await new Promise(res => setTimeout(res, 5000)); await Promise.all([loadStats(), loadRows()]) }
      } else toast.error(r.data?.error || '스캔 위임 실패')
    } catch { toast.error('스캔 위임 실패') } finally { setCollecting(false) }
  }
  async function patchStatus(id: number, status: string) {
    try {
      const r = await api.patch(`/api/admin/gov-notices/${id}`, { status })
      if (r.data?.success) { setRows(rs => rs.map(x => x.id === id ? { ...x, status } : x)); loadStats() }
      else toast.error(r.data?.error || '변경 실패')
    } catch { toast.error('변경 실패') }
  }

  const statCard = (label: string, val: number, accent?: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent || 'text-gray-900'}`}>{formatNumber(val)}</div>
    </div>
  )

  return (
    <AdminLayout title="공고 스캐너">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <DashboardPageHeader title="📢 공고 스캐너" subtitle="나라장터 입찰 + 기업마당 지원사업 — 상권활성화·소상공인·마케팅 키워드 자동 스캔" />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {statCard('전체', stats?.total || 0)}
          {statCard('입찰(나라장터)', stats?.bid || 0)}
          {statCard('지원사업(기업마당)', stats?.grant || 0)}
          {statCard('진행 중', stats?.actionable || 0, 'text-blue-600')}
          {statCard('최근 7일', stats?.recent7 || 0)}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={runCollect} disabled={collecting || !collect?.adsBinding} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{collecting ? '스캔 중…' : '📢 지금 스캔'}</button>
          <select value={fSource} onChange={e => setFSource(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm">
            <option value="">전체</option>
            <option value="bid">입찰(나라장터)</option>
            <option value="grant">지원사업(기업마당)</option>
          </select>
          <div className="grow" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="공고명·기관 검색" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm w-56" />
        </div>

        {collect && (
          <div className="mb-3 text-xs text-gray-500">
            자동 스캔 <span className={collect.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{collect.gate ? 'ON · 매일' : 'OFF'}</span>
            {collect.run?.diag?.error ? <span className="text-amber-600"> · {collect.run.diag.error}</span>
              : collect.run?.last_run ? <span> · 최근 {kstShort(collect.run.last_run)} · 입찰 {collect.run.bid ?? 0} / 지원 {collect.run.grant ?? 0} · 저장 {collect.run.saved ?? 0}</span>
                : <span className="text-gray-400"> · 아직 실행 안 됨</span>}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">구분</th>
                  <th className="text-left px-3 py-2 font-medium">공고명 / 기관</th>
                  <th className="text-left px-3 py-2 font-medium">마감</th>
                  <th className="text-left px-3 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">불러오는 중…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">공고가 없습니다. '지금 스캔'을 눌러 수집하세요.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-2"><span className={`text-[11px] px-1.5 py-0.5 rounded ${r.source === 'bid' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{r.source === 'bid' ? '입찰' : '지원'}</span></td>
                    <td className="px-3 py-2 text-gray-900">
                      {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">{r.title}</a> : r.title}
                      <div className="text-[11px] text-gray-400">{[r.org, r.keyword && `#${r.keyword}`, r.amount].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.end_date || '—'}</td>
                    <td className="px-3 py-2">
                      <select value={r.status} onChange={e => patchStatus(r.id, e.target.value)} className={`text-xs rounded px-2 py-1 border-0 ${STATUS_META[r.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
