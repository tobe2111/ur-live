import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { agencyRequest, enterAgencyStore } from './agency-api'

interface StoreRow {
  linkId: number
  sellerId: number
  status: 'pending' | 'active'
  name: string
  storeStatus: string | null
  requestedAt: string
  acceptedAt: string | null
}

const STORE_STATUS_HINT: Record<string, string> = {
  pending: '유어딜 승인 대기',
  rejected: '유어딜 승인 반려',
  suspended: '이용 정지',
}

/**
 * 🏢 맡은 매장(2단계) — 사장님이 맡긴 요청 · 운영 중인 매장.
 *   관리자: 요청 수락·거절, 운영 내려놓기. 모든 직원: [운영하기] 로 그 매장의 셀러 화면에 들어간다.
 */
export function AgencyStoresPanel({ onExpired }: { onExpired: () => void }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<StoreRow[] | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError('')
    const r = await agencyRequest<{ stores: StoreRow[]; canManage: boolean }>('/stores')
    if (r.status === 401) { onExpired(); return }
    if (!r.ok) { setError(r.data.error || '맡은 매장을 불러오지 못했어요.'); return }
    setRows(r.data.stores)
    setCanManage(!!r.data.canManage)
  }, [onExpired])

  useEffect(() => { load() }, [load])

  async function act(row: StoreRow, path: 'accept' | 'decline' | 'release') {
    if (path !== 'accept') {
      const message = path === 'decline'
        ? `${row.name} 사장님의 요청을 거절할까요?`
        : `${row.name} 운영을 내려놓을까요? 직원 모두가 이 매장에 들어갈 수 없게 돼요.`
      if (!(await confirmDialog({ message, danger: true }))) return
    }
    setBusyId(row.linkId)
    const r = await agencyRequest(`/stores/${row.linkId}/${path}`, { method: 'POST' })
    setBusyId(null)
    if (!r.ok) { toast.error(r.data.error || '처리하지 못했어요.'); load(); return }
    toast.success(r.data.message || '처리했어요.')
    load()
  }

  async function operate(row: StoreRow) {
    setBusyId(row.linkId)
    const r = await enterAgencyStore(row.sellerId, row.name)
    setBusyId(null)
    if (!r.ok) { toast.error(r.error); return }
    navigate('/seller')
  }

  const pending = rows?.filter((r) => r.status === 'pending') ?? []
  const active = rows?.filter((r) => r.status === 'active') ?? []

  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold text-gray-500">맡은 매장</h2>
      {error ? (
        <div className="mt-3 rounded-2xl bg-white p-6 shadow-lift">
          <p className="text-[15px] text-gray-700">{error}</p>
          <button type="button" onClick={load} className="mt-4 h-10 rounded-xl bg-brand px-4 text-[15px] font-semibold text-white">다시 시도</button>
        </div>
      ) : rows === null ? (
        <div className="mt-3 rounded-2xl bg-white p-6 shadow-lift"><p className="text-[13px] text-gray-500">불러오는 중…</p></div>
      ) : rows.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-white p-6 shadow-lift">
          <p className="text-[15px] font-semibold text-gray-900">아직 맡은 매장이 없어요</p>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
            매장 사장님이 셀러 화면의 <b className="font-semibold text-gray-700">운영자 관리 → 에이전시에 맡기기</b>에
            {' '}관리자 이메일을 넣으면 여기에 요청이 떠요.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-white shadow-lift">
          <ul className="divide-y divide-rule">
            {pending.map((r) => (
              <li key={r.linkId} className="flex min-h-[64px] flex-wrap items-center gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-gray-900">{r.name}</p>
                  <p className="text-[13px] text-brand-text">맡김 요청 · 수락하면 운영을 시작해요</p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <button type="button" disabled={busyId === r.linkId} onClick={() => act(r, 'decline')}
                      className="h-9 rounded-full px-3 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50">거절</button>
                    <button type="button" disabled={busyId === r.linkId} onClick={() => act(r, 'accept')}
                      className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-50">수락</button>
                  </div>
                ) : (
                  <span className="text-[12px] text-gray-500">관리자가 수락하면 열려요</span>
                )}
              </li>
            ))}
            {active.map((r) => (
              <li key={r.linkId} className="flex min-h-[64px] flex-wrap items-center gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-gray-900">{r.name}</p>
                  <p className="text-[13px] text-gray-500">
                    운영 중{r.storeStatus && STORE_STATUS_HINT[r.storeStatus] ? ` · ${STORE_STATUS_HINT[r.storeStatus]}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canManage && (
                    <button type="button" disabled={busyId === r.linkId} onClick={() => act(r, 'release')}
                      className="h-9 rounded-full px-3 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-50">내려놓기</button>
                  )}
                  <button type="button" disabled={busyId === r.linkId || r.storeStatus === 'suspended'} onClick={() => operate(r)}
                    className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-50">운영하기</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
