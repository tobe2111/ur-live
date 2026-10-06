/**
 * 💬 2026-10-01 어드민 — 인스타 댓글 → 자동 DM.
 *   ① 메타 앱 설정(유어딜 앱 1개) ② 유어딜 공식 계정 ③ 매장 계정(사장님·중개사 — 마이에서 연결) 감독.
 *   메타 공식 Private Reply 사용(댓글당 1통 · 댓글 후 7일 이내). 계정마다 기본 OFF.
 *   ⚠️ 라이트 대시보드 테마(AdminLayout) — dark: variant 금지.
 *   백엔드: /api/admin/instagram-autodm/* (features/instagram-autodm).
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { TONE_PILL } from '@/components/ui/status-pill'
import { Loader2, AlertTriangle } from 'lucide-react'
import ConnectCard from '@/components/seller/instagram-autodm/ConnectCard'
import RulesSection from '@/components/seller/instagram-autodm/RulesSection'
import SendsTable from '@/components/seller/instagram-autodm/SendsTable'
import { useIgReturnToast } from '@/components/seller/instagram-autodm/useIgReturnToast'
import { apiError, type AutoDmAppConfig, type AutoDmStatus, type SellerAccountRow } from '@/components/seller/instagram-autodm/types'
import AppPanel from './admin-instagram-autodm/AppPanel'

const BASE = '/api/admin/instagram-autodm'

export default function AdminInstagramAutoDmPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  const app = useApiQuery<AutoDmAppConfig>(['admin', 'ig-autodm', 'app'], `${BASE}/app`, { select: (r: any) => r?.data })
  const status = useApiQuery<AutoDmStatus>(['admin', 'ig-autodm', 'status'], `${BASE}/status`, { select: (r: any) => r?.data })
  const accounts = useApiQuery<SellerAccountRow[]>(['admin', 'ig-autodm', 'accounts'], `${BASE}/accounts`, {
    select: (r: any) => (r?.success ? r.data || [] : []),
  })

  const refreshAll = () => { app.refetch(); status.refetch(); accounts.refetch() }
  useIgReturnToast(params, setParams, refreshAll)

  const turnOff = async (id: number) => {
    try { await api.post(`${BASE}/accounts/${id}/off`); toast.success('껐습니다'); accounts.refetch() } catch (e) { toast.error(apiError(e, '끄지 못했습니다')) }
  }

  const loading = app.isLoading || status.isLoading
  const failed = app.isError || status.isError || !app.data || !status.data

  return (
    <AdminLayout title="인스타 자동 DM">
      <DashboardPageHeader
        title="인스타 댓글 자동 DM"
        subtitle="정해 둔 키워드로 댓글을 달면 그 사람에게 링크를 DM 으로 보냅니다 (댓글당 1통, 댓글 후 7일 이내)"
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : failed ? (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-tone-bad">
          <AlertTriangle className="h-4 w-4" /> 상태를 불러오지 못했습니다.
          <button onClick={refreshAll} className="ml-2 underline">다시 시도</button>
        </div>
      ) : (
        <div className="space-y-8">
          <AppPanel app={app.data!} onChange={refreshAll} />

          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-500">④ 유어딜 공식 계정</h2>
            <ConnectCard base={BASE} status={status.data!} returnPath="/admin/instagram-autodm" onChange={refreshAll} />
          </section>

          <RulesSection base={BASE} queryKey="admin" connected={status.data!.connected} onChanged={() => status.refetch()} />
          <SendsTable base={BASE} queryKey="admin" />

          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-500">연결된 매장 계정</h2>
            {(accounts.data || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white py-8 text-center text-sm text-gray-400">아직 연결한 매장이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr><th className="px-3 py-2">가게</th><th className="px-3 py-2">인스타</th><th className="px-3 py-2">상태</th><th className="px-3 py-2">24시간</th><th className="px-3 py-2" /></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(accounts.data || []).map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 text-gray-800">{a.store_name || `#${a.seller_id}`}</td>
                        <td className="px-3 py-2 text-gray-600">@{a.username}</td>
                        <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${a.enabled ? TONE_PILL.ok : TONE_PILL.neutral}`}>{a.enabled ? '켜짐' : '꺼짐'}</span></td>
                        <td className="px-3 py-2 text-gray-600">보냄 {a.sent24h}{a.failed24h > 0 && <span className="text-tone-bad"> · 실패 {a.failed24h}</span>} / 상한 {a.daily_cap}</td>
                        <td className="px-3 py-2 text-right">{a.enabled === 1 && <button onClick={() => turnOff(a.id)} className="text-xs text-tone-bad underline">강제로 끄기</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  )
}
