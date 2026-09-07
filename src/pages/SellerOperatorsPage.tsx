/**
 * 🏪 매장 운영자 관리 — 소유자 전용 (2026-08-19)
 *   설계 SSOT: `docs/design/store-operator-model.md` 2단계
 *
 * 여기서 부여하는 것은 **운영 권한**이지 소유권이 아니다. 사업자정보·정산계좌는 매장에 남고,
 * 소유자는 언제든 조건 없이 회수할 수 있다(§4.3 불변원칙 #2). 회수해도 그 사람이 만든
 * 상품·주문·리뷰는 매장에 그대로 남는다.
 */
import { useEffect, useState, useCallback } from 'react'
import SellerLayout from '@/components/SellerLayout'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { UserPlus, Trash2, ShieldCheck, Loader2, AlertCircle } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'

interface OperatorRow {
  user_id: number
  role: string
  granted_at: string | null
  revoked_at: string | null
  user_name: string | null
  user_handle: string | null
  user_email: string | null
}

export default function SellerOperatorsPage() {
  const [rows, setRows] = useState<OperatorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/api/seller/operators')
      if (!r.data?.success) throw new Error(r.data?.error || '불러오지 못했습니다')
      setRows(r.data.data || [])
    } catch (e: any) {
      // 에러를 '운영자 0명'으로 삼키면 소유자가 남의 접근을 못 본다 — 반드시 드러낸다.
      setError(e?.response?.data?.error || '운영자 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function grant(e: React.FormEvent) {
    e.preventDefault()
    const v = handle.trim()
    if (!v || busy) return
    setBusy(true)
    try {
      const body = v.includes('@') && v.includes('.') ? { email: v } : { handle: v }
      const r = await api.post('/api/seller/operators', body)
      if (!r.data?.success) throw new Error(r.data?.error || '추가 실패')
      setHandle('')
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.error || '운영자 추가에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(userId: number, label: string) {
    if (!confirm(`${label} 님의 운영 권한을 회수할까요?\n\n그동안 등록한 상품·주문 이력은 매장에 그대로 남습니다.`)) return
    try {
      const r = await api.post(`/api/seller/operators/${userId}/revoke`)
      if (!r.data?.success) throw new Error(r.data?.error || '회수 실패')
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.error || '회수에 실패했습니다')
    }
  }

  const active = rows.filter(r => !r.revoked_at)
  const past = rows.filter(r => r.revoked_at)

  return (
    <SellerLayout title="운영자 관리">
      <SEO title="운영자 관리 - 유어딜 셀러" description="매장 운영 권한 관리" url="/seller/operators" />

      <div className="ur-content-medium space-y-4">
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex items-start gap-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-gray-900">매장 운영을 맡길 수 있어요</h2>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                운영자는 이 매장의 상품·주문·공구를 관리할 수 있습니다.
                <b className="text-gray-900"> 사업자 정보와 정산 계좌는 사장님께 그대로 남고</b>,
                권한은 언제든 회수할 수 있습니다.
              </p>
            </div>
          </div>

          <form onSubmit={grant} className="flex gap-2">
            <input
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="유어딜 핸들(@handle) 또는 이메일"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              maxLength={255}
            />
            <button
              type="submit"
              disabled={busy || !handle.trim()}
              className="ur-btn ur-btn-md ur-btn-primary flex items-center gap-1.5 disabled:opacity-50 transition"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              추가
            </button>
          </form>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={load} className="text-xs font-semibold text-red-700 underline mt-1">다시 시도</button>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">현재 운영자 {active.length}명</h3>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : active.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">아직 없습니다. 사장님만 이 매장을 운영하고 있어요.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {active.map(r => {
                const label = r.user_name || r.user_handle || `사용자 #${r.user_id}`
                return (
                  <li key={r.user_id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {r.user_handle ? `@${r.user_handle}` : r.user_email}
                        {r.granted_at && ` · ${formatKSTDate(r.granted_at)} 부터`}
                      </p>
                    </div>
                    <button
                      onClick={() => revoke(r.user_id, label)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      회수
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {past.length > 0 && (
          <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">지난 운영자 {past.length}명</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">기록은 남깁니다 — 누가 언제 운영했는지가 분쟁 시 근거가 됩니다.</p>
            </div>
            <ul className="divide-y divide-gray-100">
              {past.map(r => (
                <li key={r.user_id} className="px-5 py-3">
                  <p className="text-sm text-gray-600 truncate">{r.user_name || r.user_handle || `사용자 #${r.user_id}`}</p>
                  <p className="text-xs text-gray-400">
                    {r.granted_at && formatKSTDate(r.granted_at)} ~ {r.revoked_at && formatKSTDate(r.revoked_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
