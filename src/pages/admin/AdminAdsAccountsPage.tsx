import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { safeDate } from '@/utils/safe-date'

/**
 * 🆕 2026-06-28 유어애즈 가입자 운영 어드민 (/admin/ads-accounts).
 *   가입자 목록·검색 + 액세스 코드 잠금해제 / 계정 정지. API: /api/admin/ads/*.
 */
interface AdsAccountRow {
  id: number; email: string; company_name: string | null; phone: string | null
  status: string | null; access_unlocked: number; created_at: string; last_login_at: string | null
  connected: boolean; alert_on: boolean
}
interface Stats { total: number; unlocked: number; suspended: number; recent7: number }

const fmtD = (s: string | null) => { const d = safeDate(s); return d ? d.toLocaleDateString('ko-KR') : '—' }

export default function AdminAdsAccountsPage() {
  const [rows, setRows] = useState<AdsAccountRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async (query = '') => {
    setLoading(true)
    try {
      const [a, s] = await Promise.all([
        api.get(`/api/admin/ads/accounts${query ? `?q=${encodeURIComponent(query)}` : ''}`),
        api.get('/api/admin/ads/stats'),
      ])
      if (a.data?.success) setRows(a.data.accounts || [])
      if (s.data?.success) setStats(s.data.stats || null)
    } catch {
      toast.error('가입자 정보를 불러오지 못했습니다')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function patch(id: number, body: { access_unlocked?: number; status?: string }, label: string) {
    setBusy(id)
    try {
      const r = await api.patch(`/api/admin/ads/accounts/${id}`, body)
      if (r.data?.success) { toast.success(`${label} 완료`); await load(q) }
      else toast.error(r.data?.error || '변경 실패')
    } catch { toast.error('변경 실패') } finally { setBusy(null) }
  }

  const statCards = [
    { l: '총 가입자', v: stats?.total },
    { l: '액세스 해제', v: stats?.unlocked },
    { l: '정지 계정', v: stats?.suspended },
    { l: '최근 7일 가입', v: stats?.recent7 },
  ]

  return (
    <AdminLayout title="유어애즈 가입자">
      <DashboardPageHeader title="유어애즈 가입자" subtitle="유어애즈(UR Ads) 계정 관리 — 액세스 코드 잠금해제·계정 정지. 유어딜/도매와 분리된 서비스." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map((m) => (
          <div key={m.l} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[12px] text-gray-500">{m.l}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{m.v != null ? formatNumber(m.v) : '–'}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(q) }}
          placeholder="이메일 또는 회사명 검색" className="h-10 w-full max-w-sm rounded-lg border border-gray-300 px-3 text-sm text-gray-900" />
        <button onClick={() => load(q)} className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold">검색</button>
        {q && <button onClick={() => { setQ(''); load('') }} className="h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-500">전체</button>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="py-2.5 px-3">ID</th><th className="py-2.5 px-3">이메일 · 회사</th><th className="py-2.5 px-3">가입</th><th className="py-2.5 px-3">최근 로그인</th><th className="py-2.5 px-3 text-center">연동</th><th className="py-2.5 px-3 text-center">알림</th><th className="py-2.5 px-3 text-center">액세스</th><th className="py-2.5 px-3 text-center">상태</th><th className="py-2.5 px-3"></th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-10 text-center text-gray-400">불러오는 중…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="py-10 text-center text-gray-400">가입자가 없습니다.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 text-gray-700">
                <td className="py-2.5 px-3 tabular-nums text-gray-400">{r.id}</td>
                <td className="py-2.5 px-3"><span className="font-medium text-gray-900">{r.company_name || '—'}</span><span className="block text-[11px] text-gray-400">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span></td>
                <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{fmtD(r.created_at)}</td>
                <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{fmtD(r.last_login_at)}</td>
                <td className="py-2.5 px-3 text-center">{r.connected ? <span className="text-emerald-600">●</span> : <span className="text-gray-300">○</span>}</td>
                <td className="py-2.5 px-3 text-center">{r.alert_on ? <span className="text-emerald-600">●</span> : <span className="text-gray-300">○</span>}</td>
                <td className="py-2.5 px-3 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${r.access_unlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{r.access_unlocked ? '해제됨' : '잠김'}</span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${r.status !== 'active' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{r.status !== 'active' ? '정지' : '활성'}</span>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap text-right">
                  <button disabled={busy === r.id} onClick={() => patch(r.id, { access_unlocked: r.access_unlocked ? 0 : 1 }, r.access_unlocked ? '잠금' : '잠금해제')}
                    className="text-[12px] font-semibold text-blue-600 hover:underline disabled:opacity-40">{r.access_unlocked ? '잠그기' : '잠금해제'}</button>
                  <button disabled={busy === r.id} onClick={() => patch(r.id, { status: r.status !== 'active' ? 'active' : 'suspended' }, r.status !== 'active' ? '활성화' : '정지')}
                    className="ml-3 text-[12px] font-semibold text-red-500 hover:underline disabled:opacity-40">{r.status !== 'active' ? '활성화' : '정지'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
