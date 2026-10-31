/**
 * 🎁 무상 체험 신청 큐 — 운영팀 (2026-10-31 대표 "지금은 운영자인 내가 직접 확인해서 매장 사장님한테 연락")
 *
 * 지금: 신청 확인 → [사장님께 보내기](알림톡) 또는 전화로 확인한 결과를 [대신 승인/거절].
 * 나중: 위 [원클릭 자동 전송] 을 켜면 조건을 통과한 신청이 운영자 확인 없이 바로 사장님께 간다(같은 함수).
 * 일정 확정·노쇼·완료 처리도 사장님 화면과 같은 동작을 대신 할 수 있다(`seeding-actions.ts`).
 */
import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/utils/format'
import { formatKSTShort } from '@/utils/date'
import { APPLICATION_STATUSES, FOLLOWER_WORD, PLATFORM_LABEL, STATUS_LABEL, type ApplicationStatus, type SeedingPlatform } from '@/shared/seeding'

interface Row {
  id: number; product_id: number; user_id: number; platform: SeedingPlatform; sns_username: string | null; follower_count: number | null
  status: ApplicationStatus; visit_slots: string | null; visit_at: string | null; post_deadline: string | null; post_url: string | null
  product_name: string | null; store_name: string | null; created_at: string
}
interface Settings { auto_send: boolean; free_passes: string; packages: { passes: number; price: number }[]; charge_enabled: boolean }

const errMsg = (e: unknown, d: string) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error || d
const input = 'h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-900'

export default function AdminSeedingPage() {
  const [status, setStatus] = useState<string>('pending')
  const list = useApiQuery<{ rows: Row[]; counts: Record<string, number> }>(['admin', 'seeding', status], `/api/admin/seeding/applications?status=${status}`, {
    select: (raw) => (raw as { data: { rows: Row[]; counts: Record<string, number> } }).data, staleTime: 0,
  })
  const settings = useApiQuery<Settings>(['admin', 'seeding', 'settings'], '/api/admin/seeding/settings', {
    select: (raw) => (raw as { data: Settings }).data, staleTime: 0,
  })
  const act = async (id: number, action: string, body: unknown = {}) => {
    try {
      const r = await api.post(`/api/admin/seeding/applications/${id}/${action}`, body)
      r.data?.success ? toast.success('처리했어요') : toast.error(r.data?.error || '처리하지 못했어요')
      list.refetch()
    } catch (e) { toast.error(errMsg(e, '처리하지 못했어요')) }
  }
  const saveSetting = async (patch: Partial<Settings> | { packages: string }) => {
    try { await api.put('/api/admin/seeding/settings', patch); toast.success('저장했어요'); settings.refetch() }
    catch (e) { toast.error(errMsg(e, '저장하지 못했어요')) }
  }
  const s = settings.data
  const counts = list.data?.counts ?? {}

  return (
    <AdminLayout title="무상 체험 신청">
      <DashboardPageHeader title="무상 체험 신청" subtitle="인플루언서 무상 체험 신청을 확인하고 매장에 전달합니다" />
      {s && (
        <div className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
          <label className="flex items-center justify-between gap-3 text-[13px] text-gray-900">
            <span><b>원클릭 자동 전송</b> — 켜면 조건을 통과한 신청이 운영자 확인 없이 바로 사장님께 알림톡으로 가요</span>
            <input type="checkbox" checked={s.auto_send} onChange={(e) => saveSetting({ auto_send: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[13px] text-gray-900">
            <span>가입 혜택 무료 신청권(회)</span>
            <input className={`${input} w-20`} defaultValue={s.free_passes} onBlur={(e) => saveSetting({ free_passes: e.target.value })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[13px] text-gray-900">
            <span>신청권 묶음(장:가격, 쉼표)</span>
            <input className={`${input} w-56`} defaultValue={s.packages.map((p) => `${p.passes}:${p.price}`).join(',')}
              onBlur={(e) => saveSetting({ packages: e.target.value })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[13px] text-gray-900">
            <span>신청권 구매 열기 <span className="text-gray-500">(결제 — staging 실결제 확인 뒤에만)</span></span>
            <input type="checkbox" checked={s.charge_enabled}
              onChange={(e) => { if (!e.target.checked || window.confirm('실제 카드 결제가 열립니다. staging 실결제 확인을 마쳤나요?')) saveSetting({ charge_enabled: e.target.checked }) }} />
          </label>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {APPLICATION_STATUSES.map((st) => (
          <button key={st} type="button" onClick={() => setStatus(st)}
            className={`rounded-full px-3 py-1.5 text-[13px] ${status === st ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
            {STATUS_LABEL[st]} {counts[st] ? formatNumber(counts[st]) : ''}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-[13px] text-gray-900">
          <thead className="bg-gray-50 text-gray-500">
            <tr><th className="p-3">신청</th><th className="p-3">매장 · 이용권</th><th className="p-3">인플루언서</th><th className="p-3">일정</th><th className="p-3">처리</th></tr>
          </thead>
          <tbody>
            {(list.data?.rows ?? []).map((r) => {
              const slots: string[] = (() => { try { return JSON.parse(r.visit_slots || '[]') } catch { return [] } })()
              return (
                <tr key={r.id} className="border-t border-gray-100 align-top">
                  <td className="p-3">#{r.id}<br /><span className="text-gray-500">{formatKSTShort(r.created_at)}</span></td>
                  <td className="p-3">{r.store_name}<br /><span className="text-gray-500">{r.product_name}</span></td>
                  <td className="p-3">{PLATFORM_LABEL[r.platform]} @{r.sns_username || '-'}<br />
                    <span className="text-gray-500">{FOLLOWER_WORD[r.platform]} {formatNumber(r.follower_count)}명 · 유저 {r.user_id}</span></td>
                  <td className="p-3">{r.visit_at || (slots.length ? slots.join(' / ') : '-')}
                    {r.post_url && <><br /><a className="text-blue-600 underline" href={r.post_url} target="_blank" rel="noreferrer">게시물</a></>}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.status === 'pending' && <>
                        <Button size="sm" onClick={() => act(r.id, 'send')}>사장님께 보내기</Button>
                        <Button size="sm" variant="outline" onClick={() => act(r.id, 'respond', { decision: 'approve' })}>대신 승인</Button>
                        <Button size="sm" variant="outline" onClick={() => act(r.id, 'reject')}>반려</Button>
                      </>}
                      {r.status === 'sent' && <>
                        <Button size="sm" variant="outline" onClick={() => act(r.id, 'respond', { decision: 'approve' })}>대신 승인</Button>
                        <Button size="sm" variant="outline" onClick={() => act(r.id, 'respond', { decision: 'reject' })}>대신 거절</Button>
                      </>}
                      {r.status === 'scheduling' && slots.map((sl) => (
                        <Button key={sl} size="sm" variant="outline" onClick={() => act(r.id, 'pick', { slot: sl })}>{sl} 확정</Button>
                      ))}
                      {r.status === 'scheduled' && <Button size="sm" variant="outline" onClick={() => act(r.id, 'no-show')}>노쇼 처리</Button>}
                      {r.status === 'posted' && <Button size="sm" onClick={() => act(r.id, 'complete')}>완료</Button>}
                      {['approved', 'scheduling', 'scheduled'].includes(r.status) && (
                        <Button size="sm" variant="outline" onClick={() => act(r.id, 'cancel')}>매장 사정 취소</Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {(list.data?.rows ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">이 상태의 신청이 없어요</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  )
}
