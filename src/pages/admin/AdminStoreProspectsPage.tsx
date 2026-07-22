import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import DashboardPageHeader from '@/components/admin/DashboardPageHeader'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { formatNumber } from '@/utils/format'

interface Prospect {
  id: number; biz_name: string; category: string | null; uptae: string | null
  addr_road: string | null; addr_lot: string | null; phone: string | null; region: string | null
  trd_state: string | null; trd_state_nm: string | null; apv_perm_ymd: string | null
  status: string; active: number; is_new_open: number; memo: string | null
  contact_channel: string | null; follow_up_at: string | null
}
interface Stats { total: number; operating: number; new_open: number; closed: number; with_phone: number; onboarded: number }
interface RunInfo { last_run?: string; day?: string; found?: number; saved?: number; new_open?: number; closed?: number; diag?: { error?: string } }
interface Collect { gate: boolean; adsBinding: boolean; run: RunInfo | null }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-700' },
  contacted: { label: '컨택함', cls: 'bg-blue-100 text-blue-700' },
  interested: { label: '관심', cls: 'bg-amber-100 text-amber-700' },
  onboarded: { label: '입점', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-600' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const STATUSES = ['new', 'contacted', 'interested', 'onboarded', 'rejected', 'hold']

export default function AdminStoreProspectsPage() {
  const [rows, setRows] = useState<Prospect[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [collect, setCollect] = useState<Collect | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fCategory, setFCategory] = useState('')
  const [fRegion, setFRegion] = useState('')
  const [fView, setFView] = useState('') // '' | 'newOpen' | 'closed' | 'phone'
  const [q, setQ] = useState('')

  const loadStats = useCallback(async () => {
    try { const r = await api.get('/api/admin/store-prospects/stats'); if (r.data?.success) { setStats(r.data.stats); setCollect(r.data.collect || null) } } catch { /* noop */ }
  }, [])
  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (fCategory) p.set('category', fCategory)
      if (fRegion.trim()) p.set('region', fRegion.trim())
      if (fView === 'newOpen') p.set('newOpen', '1')
      if (fView === 'closed') p.set('includeClosed', '1')
      if (fView === 'phone') p.set('hasPhone', '1')
      if (q.trim()) p.set('q', q.trim())
      const r = await api.get(`/api/admin/store-prospects?${p.toString()}`)
      if (r.data?.success) setRows(r.data.prospects || [])
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [fCategory, fRegion, fView, q])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadRows() }, [loadRows])

  async function runCollect() {
    if (!collect?.adsBinding) { toast.error('ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작합니다'); return }
    setCollecting(true)
    try {
      const r = await api.post('/api/admin/store-prospects/collect', {})
      if (r.data?.success) {
        toast.success('인허가 변동분 수집 시작 — 잠시 후 반영됩니다')
        for (let i = 0; i < 3; i++) { await new Promise(res => setTimeout(res, 5000)); await Promise.all([loadStats(), loadRows()]) }
      } else toast.error(r.data?.error || '수집 위임 실패')
    } catch { toast.error('수집 위임 실패') } finally { setCollecting(false) }
  }

  async function patchStatus(id: number, status: string) {
    try {
      const r = await api.patch(`/api/admin/store-prospects/${id}`, { status })
      if (r.data?.success) { setRows(rs => rs.map(x => x.id === id ? { ...x, status } : x)); loadStats() }
      else toast.error(r.data?.error || '변경 실패')
    } catch { toast.error('변경 실패') }
  }

  const statCard = (label: string, val: number, hint?: string, accent?: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent || 'text-gray-900'}`}>{formatNumber(val)}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-400">{hint}</div>}
    </div>
  )

  return (
    <AdminLayout title="매장 후보">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <DashboardPageHeader title="🏪 매장 후보" subtitle="지방행정 인허가로 발굴한 유어딜 입점 대상 매장 — 발굴·개업감지·폐업정리 (수집 ≠ 발송)" />

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
          {statCard('전체', stats?.total || 0)}
          {statCard('영업중', stats?.operating || 0)}
          {statCard('🆕 신규 개업', stats?.new_open || 0, '최근 인허가 · 전환율 최고', 'text-rose-600')}
          {statCard('전화 보유', stats?.with_phone || 0)}
          {statCard('입점 완료', stats?.onboarded || 0, undefined, 'text-green-600')}
          {statCard('폐업', stats?.closed || 0, '자동 정리됨', 'text-gray-400')}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={runCollect} disabled={collecting || !collect?.adsBinding} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50" title="지방행정 인허가 전일 변동분 1회 수집(일반음식점·휴게음식점·미용업·숙박업)">{collecting ? '수집 중…' : '🏪 인허가 수집'}</button>
          <div className="grow" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="매장명·지역·전화 검색" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm w-56" />
        </div>

        {collect && (
          <div className="mb-3 text-xs text-gray-500">
            인허가 자동수집 <span className={collect.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{collect.gate ? 'ON · 매일 KST 05시' : 'OFF'}</span>
            {collect.run?.diag?.error ? <span className="text-amber-600"> · {collect.run.diag.error}</span>
              : collect.run?.last_run ? <span> · 최근 {collect.run.last_run.slice(5, 16)} · {collect.run.day} 변동분 발굴 {collect.run.found ?? 0} / 저장 {collect.run.saved ?? 0}</span>
                : <span className="text-gray-400"> · 아직 실행 안 됨</span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
          <select value={fCategory} onChange={e => setFCategory(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">업종 전체</option>
            <option value="일반음식점">일반음식점</option>
            <option value="휴게음식점">휴게음식점</option>
            <option value="미용업">미용업</option>
            <option value="숙박업">숙박업</option>
          </select>
          <input value={fRegion} onChange={e => setFRegion(e.target.value)} placeholder="지역(예: 서초)" className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 w-32" />
          <select value={fView} onChange={e => setFView(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">영업중</option>
            <option value="newOpen">🆕 신규 개업만</option>
            <option value="phone">전화 보유만</option>
            <option value="closed">폐업 포함</option>
          </select>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">매장명</th>
                  <th className="text-left px-3 py-2 font-medium">업종</th>
                  <th className="text-left px-3 py-2 font-medium">지역</th>
                  <th className="text-left px-3 py-2 font-medium">전화</th>
                  <th className="text-left px-3 py-2 font-medium">인허가일</th>
                  <th className="text-left px-3 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">불러오는 중…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">후보가 없습니다. '인허가 수집'을 눌러 발굴하세요.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                    <td className="px-3 py-2 text-gray-900">
                      {r.is_new_open === 1 && <span className="mr-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-semibold">개업</span>}
                      {r.biz_name}
                      {r.addr_road && <div className="text-[11px] text-gray-400">{r.addr_road}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.category || '—'}{r.uptae && <span className="text-gray-400"> · {r.uptae}</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{r.region || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.phone || <span className="text-gray-300">없음</span>}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.apv_perm_ymd ? `${r.apv_perm_ymd.slice(0, 4)}.${r.apv_perm_ymd.slice(4, 6)}.${r.apv_perm_ymd.slice(6, 8)}` : '—'}</td>
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
