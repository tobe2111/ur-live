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
  connected: boolean; alert_on: boolean; plan: string
}
const PLANS = ['free', 'starter', 'pro'] as const
interface Stats { total: number; unlocked: number; suspended: number; recent7: number }
interface Media { enabled: boolean; image: string | null; voice: string | null; video: string | null }

const fmtD = (s: string | null) => { const d = safeDate(s); return d ? d.toLocaleDateString('ko-KR') : '—' }
interface AccessReq { id: number; account_id: number; note: string | null; status: string; created_at: string; email: string; company_name: string | null; phone: string | null }

export default function AdminAdsAccountsPage() {
  const [rows, setRows] = useState<AdsAccountRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [media, setMedia] = useState<Media | null>(null)
  const [reqs, setReqs] = useState<AccessReq[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async (query = '') => {
    setLoading(true)
    try {
      const [a, s, ar] = await Promise.all([
        api.get(`/api/admin/ads/accounts${query ? `?q=${encodeURIComponent(query)}` : ''}`),
        api.get('/api/admin/ads/stats'),
        api.get('/api/admin/ads/access-requests'),
      ])
      if (a.data?.success) setRows(a.data.accounts || [])
      if (s.data?.success) { setStats(s.data.stats || null); setMedia(s.data.media || null) }
      if (ar.data?.success) setReqs(ar.data.requests || [])
    } catch {
      toast.error('가입자 정보를 불러오지 못했습니다')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // 📥 입장 요청 승인/거절 — 승인 = access_unlocked 1 + (Resend 설정 시) 안내 메일.
  async function decide(r: AccessReq, approve: boolean) {
    setBusy(r.id)
    try {
      const res = await api.post(`/api/admin/ads/access-requests/${r.id}/decide`, { approve })
      if (res.data?.success) { toast.success(approve ? `✅ ${r.company_name || r.email} 입장 승인 — 재로그인 시 자동 입장` : `⛔ ${r.company_name || r.email} 요청 거절`); await load(q) }
      else toast.error(res.data?.error || '처리 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '처리 실패')
    } finally { setBusy(null) }
  }
  const pendingReqs = reqs.filter(r => r.status === 'pending')

  async function patch(id: number, body: { access_unlocked?: number; status?: string; plan?: string }, label: string) {
    setBusy(id)
    try {
      const r = await api.patch(`/api/admin/ads/accounts/${id}`, body)
      if (r.data?.success) { toast.success(`${label} 완료`); await load(q) }
      else toast.error(r.data?.error || '변경 실패')
    } catch { toast.error('변경 실패') } finally { setBusy(null) }
  }

  async function resetPassword(row: AdsAccountRow) {
    const pw = window.prompt(`${row.email} 계정의 새 비밀번호를 입력하세요.\n(8자 이상 · 영문/숫자/특수문자 중 2종 이상)`)
    if (pw === null) return
    if (!pw.trim()) { toast.error('비밀번호를 입력해주세요'); return }
    setBusy(row.id)
    try {
      const r = await api.post(`/api/admin/ads/accounts/${row.id}/reset-password`, { password: pw })
      if (r.data?.success) toast.success('비밀번호를 재설정했습니다')
      else toast.error(r.data?.error || '재설정 실패')
    } catch { toast.error('재설정 실패') } finally { setBusy(null) }
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

      {media && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 text-[12px]">
          <span className="font-semibold text-gray-700">미디어 생성</span>
          <span className={`ml-2 px-1.5 py-0.5 rounded font-bold ${media.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{media.enabled ? 'ON' : 'OFF (ADS_MEDIA_ENABLED)'}</span>
          {(['image', 'voice', 'video'] as const).map(k => (
            <span key={k} className="ml-2 text-gray-500">{k}: <b className={media[k] ? 'text-emerald-600' : 'text-gray-400'}>{media[k] || '미설정'}</b></span>
          ))}
        </div>
      )}

      {/* 📥 입장 요청 대기열 — 신규 가입자의 '코드 없음' 데드엔드를 승인 큐로 해소 */}
      {pendingReqs.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="text-[13.5px] font-bold text-amber-800">🔑 입장 요청 대기 {pendingReqs.length}건</div>
          <div className="mt-2 space-y-2">
            {pendingReqs.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2">
                <div className="text-[12.5px] text-gray-800 min-w-0">
                  <b>{r.company_name || '—'}</b> <span className="text-gray-500">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
                  <span className="ml-2 text-[11px] text-gray-400">{fmtD(r.created_at)}</span>
                  {r.note && <div className="text-[11.5px] text-gray-500 truncate">요청 메모: {r.note}</div>}
                </div>
                <div className="shrink-0 flex gap-2">
                  <button disabled={busy === r.id} onClick={() => decide(r, true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-bold disabled:opacity-50">승인</button>
                  <button disabled={busy === r.id} onClick={() => decide(r, false)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 text-[12px] font-semibold disabled:opacity-50">거절</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(q) }}
          placeholder="이메일 또는 회사명 검색" className="h-10 w-full max-w-sm rounded-lg border border-gray-300 px-3 text-sm text-gray-900" />
        <button onClick={() => load(q)} className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold">검색</button>
        {q && <button onClick={() => { setQ(''); load('') }} className="h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-500">전체</button>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="py-2.5 px-3">ID</th><th className="py-2.5 px-3">이메일 · 회사</th><th className="py-2.5 px-3">가입</th><th className="py-2.5 px-3">최근 로그인</th><th className="py-2.5 px-3 text-center">연동</th><th className="py-2.5 px-3 text-center">알림</th><th className="py-2.5 px-3 text-center">플랜</th><th className="py-2.5 px-3 text-center">액세스</th><th className="py-2.5 px-3 text-center">상태</th><th className="py-2.5 px-3"></th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-10 text-center text-gray-400">불러오는 중…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="py-10 text-center text-gray-400">가입자가 없습니다.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 text-gray-700">
                <td className="py-2.5 px-3 tabular-nums text-gray-400">{r.id}</td>
                <td className="py-2.5 px-3"><span className="font-medium text-gray-900">{r.company_name || '—'}</span><span className="block text-[11px] text-gray-400">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span></td>
                <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{fmtD(r.created_at)}</td>
                <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{fmtD(r.last_login_at)}</td>
                <td className="py-2.5 px-3 text-center">{r.connected ? <span className="text-emerald-600">●</span> : <span className="text-gray-300">○</span>}</td>
                <td className="py-2.5 px-3 text-center">{r.alert_on ? <span className="text-emerald-600">●</span> : <span className="text-gray-300">○</span>}</td>
                <td className="py-2.5 px-3 text-center">
                  <select value={r.plan || 'free'} disabled={busy === r.id} onChange={(e) => patch(r.id, { plan: e.target.value }, `플랜 ${e.target.value}`)}
                    className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[11px] font-semibold text-gray-700">
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
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
                  <button disabled={busy === r.id} onClick={() => resetPassword(r)}
                    className="ml-3 text-[12px] font-semibold text-gray-500 hover:underline disabled:opacity-40">비번설정</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
