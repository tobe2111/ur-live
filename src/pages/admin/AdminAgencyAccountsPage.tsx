/**
 * 🏢 어드민 — 에이전시 계정 (2026-10-11 대표 "모두 다 하자")
 *   백엔드 `/api/admin/agency-accounts*` (features/agency-console/api/agency-admin.routes.ts)
 *
 * 매장을 맡아 운영하는 대행사(이메일 계정)를 본다: 대표 이메일 · 직원 수 · 맡은 매장 · 상태.
 * 정지하면 그 에이전시 직원은 로그인·매장 운영·초대 링크가 전부 막힌다(사장님 매장 자체는 그대로).
 * ⚠️ 2026-09-04 일몰된 옛 에이전시(`agencies`)가 아니다.
 * ⚠️ 어드민 = 라이트 고정(`dark:` 금지).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { formatKSTDate } from '@/utils/date'
import AgencyPayoutsCard from './agency-accounts/AgencyPayoutsCard'

interface AgencyRow {
  id: number; name: string; kind: string; business_number: string | null; business_status: string | null; status: string; created_at: string
  owner_email: string | null; staff_count: number; store_count: number; pending_count: number
}
interface StoreRow {
  seller_id: number; status: string; created_at: string; accepted_at: string | null; ended_at: string | null
  ended_by: string | null; business_name: string | null; seller_name: string | null
}

const STATUS_LABEL: Record<string, string> = { active: '이용 중', suspended: '정지', pending: '인증 전' }
const LINK_LABEL: Record<string, string> = { active: '운영 중', pending: '요청 중', declined: '거절', ended: '끊김' }

export default function AdminAgencyAccountsPage() {
  const [rows, setRows] = useState<AgencyRow[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [stores, setStores] = useState<Record<number, StoreRow[]>>({})
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await api.get('/api/admin/agency-accounts')
      if (!r.data?.success) throw new Error(r.data?.error)
      setRows(r.data.data || [])
    } catch (e: any) {
      setError(e?.response?.data?.error || '에이전시 목록을 불러오지 못했어요')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(row: AgencyRow) {
    if (open === row.id) { setOpen(null); return }
    setOpen(row.id)
    if (stores[row.id]) return
    try {
      const r = await api.get(`/api/admin/agency-accounts/${row.id}/stores`)
      setStores((m) => ({ ...m, [row.id]: r.data?.data || [] }))
    } catch {
      setStores((m) => ({ ...m, [row.id]: [] }))
    }
  }

  async function setSuspended(row: AgencyRow, suspend: boolean) {
    const message = suspend
      ? `${row.name} 에이전시를 정지할까요? 직원 ${row.staff_count}명이 지금부터 로그인·매장 운영을 할 수 없어요. 매장 ${row.store_count}곳은 사장님께 그대로 남아요.`
      : `${row.name} 에이전시의 정지를 풀까요?`
    if (!(await confirmDialog({ message, danger: suspend }))) return
    setBusy(row.id)
    try {
      const r = await api.post(`/api/admin/agency-accounts/${row.id}/${suspend ? 'suspend' : 'unsuspend'}`)
      if (!r.data?.success) throw new Error(r.data?.error)
      toast.success(r.data.message || '처리했어요')
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '처리하지 못했어요')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminLayout title="에이전시">
      <div className="space-y-4">
        <div className="rounded-[var(--dash-radius,16px)] bg-white p-5 shadow-lift">
          <h2 className="text-[15px] font-bold text-gray-900">에이전시 계정</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
            매장을 맡아 운영하는 대행사(이메일 가입)입니다. 정지하면 그 에이전시 직원은 로그인·매장 운영·초대 링크가 모두 막혀요. 사장님 매장과 주문은 그대로 남습니다.
          </p>
        </div>

        <AgencyPayoutsCard />

        {error ? (
          <div className="rounded-xl bg-white p-4 shadow-lift">
            <p className="text-[13px] text-tone-bad">{error}</p>
            <button type="button" onClick={load} className="mt-1 text-[13px] font-semibold text-brand-text underline">다시 시도</button>
          </div>
        ) : rows === null ? (
          <p className="text-[13px] text-gray-500">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center text-[13px] text-gray-500 shadow-lift">아직 가입한 에이전시가 없어요.</div>
        ) : (
          <div className="overflow-hidden rounded-[var(--dash-radius,16px)] bg-white shadow-lift">
            <ul className="divide-y divide-gray-100">
              {rows.map((r) => (
                <li key={r.id}>
                  <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <button type="button" onClick={() => toggle(r)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[15px] font-semibold text-gray-900">
                        {r.name}
                        <span className={`ml-2 text-[12px] font-semibold ${r.status === 'active' ? 'text-tone-ok' : r.status === 'suspended' ? 'text-tone-bad' : 'text-gray-500'}`}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </p>
                      <p className="truncate text-[13px] text-gray-500">
                        {r.kind === 'individual' ? '개인' : `사업자 ${r.business_number || '-'} (${!r.business_status || r.business_status === 'unverified' ? '국세청 확인 안 됨' : r.business_status})`} · {r.owner_email || '-'} · 직원 {r.staff_count} · 매장 {r.store_count}
                        {r.pending_count > 0 ? ` (요청 ${r.pending_count})` : ''} · {formatKSTDate(r.created_at)} 가입
                      </p>
                    </button>
                    {r.status === 'active' && (
                      <button type="button" disabled={busy === r.id} onClick={() => setSuspended(r, true)}
                        className="h-9 rounded-lg px-3 text-[13px] font-semibold text-tone-bad hover:bg-gray-50 disabled:opacity-50">정지</button>
                    )}
                    {r.status === 'suspended' && (
                      <button type="button" disabled={busy === r.id} onClick={() => setSuspended(r, false)}
                        className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">정지 풀기</button>
                    )}
                  </div>
                  {open === r.id && (
                    <div className="bg-gray-50 px-5 py-3">
                      {!stores[r.id] ? (
                        <p className="text-[13px] text-gray-500">불러오는 중…</p>
                      ) : stores[r.id].length === 0 ? (
                        <p className="text-[13px] text-gray-500">맡았던 매장이 없어요.</p>
                      ) : (
                        <ul className="space-y-1">
                          {stores[r.id].map((s, i) => (
                            <li key={`${s.seller_id}-${i}`} className="flex gap-3 text-[13px] text-gray-700">
                              <span className="min-w-0 flex-1 truncate">{s.business_name || s.seller_name || `매장 ${s.seller_id}`} (#{s.seller_id})</span>
                              <span className="shrink-0 text-gray-500">
                                {LINK_LABEL[s.status] || s.status}
                                {s.status === 'ended' && s.ended_by ? ` · ${s.ended_by === 'owner' ? '사장님이' : '에이전시가'}` : ''}
                                {' · '}{formatKSTDate(s.accepted_at || s.created_at)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
