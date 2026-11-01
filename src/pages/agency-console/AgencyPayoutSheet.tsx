/**
 * 💸 에이전시 '정산' 시트 — 유어딜이 에이전시 몫을 지급하는 길 (결재 3단계, 2026-11-01)
 *   서버: `GET /api/agency-console/payouts` · `POST /payouts/request`(관리자만).
 *   로직 SSOT: `worker/utils/agency-share-payout.ts`. 게이트 `agency_share_payout_enabled` 기본 OFF.
 *
 * 꺼져 있으면 이 시트를 여는 줄 자체가 안 뜬다(`AgencySection`) — 쓰지 않는 길을 보여 주지 않는다.
 * 금액은 전부 서버가 잰 값이다. 화면은 계산하지 않는다(정산 분기·원천징수는 서버 `planAgencyPayout`).
 */
import { useCallback, useEffect, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'
import Sheet from '@/pages/user-profile/seller-section/Sheet'
import { agencyRequest } from './agency-api'

export interface AgencyShareBalance { pending: number; available: number; requested: number; paid: number }
export interface AgencyPayoutRow {
  id: number; gross_amount: number; withholding_amount: number; net_amount: number
  tax_mode: 'tax_invoice' | 'withholding_3_3'; status: string; created_at: string; paid_at: string | null
}
export interface AgencyPayoutsResponse {
  enabled: boolean; minAmount?: number; balance: AgencyShareBalance | null; payouts: AgencyPayoutRow[]
}

const STATUS_LABEL: Record<string, string> = { requested: '처리 중', paid: '지급 완료', rejected: '반려' }

/** 정산 줄의 짧은 값 — 쓸 수 있는 금액이 있으면 그 금액, 처리 중이면 '처리 중'. */
export function payoutRowHint(r: AgencyPayoutsResponse | null): string | undefined {
  if (!r?.enabled || !r.balance) return undefined
  if (r.balance.available > 0) return `${formatNumber(r.balance.available)}원`
  if (r.balance.requested > 0) return '처리 중'
  return undefined
}

export default function AgencyPayoutSheet({ canManage, initial, onClose, onChanged }: {
  canManage: boolean
  initial: AgencyPayoutsResponse | null
  onClose: () => void
  onChanged: (r: AgencyPayoutsResponse) => void
}) {
  const [data, setData] = useState<AgencyPayoutsResponse | null>(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const r = await agencyRequest<AgencyPayoutsResponse>('/payouts')
    if (!r.ok) { setError(r.data.error || '정산 내역을 불러오지 못했어요'); return }
    setData(r.data)
    onChanged(r.data)
  }, [onChanged])

  useEffect(() => { void load() }, [load])

  const b = data?.balance
  const min = data?.minAmount ?? 10_000
  const hasOpen = (data?.payouts || []).some((p) => p.status === 'requested')
  const canRequest = canManage && !!b && b.available >= min && !hasOpen

  async function request() {
    if (!b) return
    if (!(await confirmDialog(`${formatNumber(b.available)}원 지급을 신청할까요? 확인되면 유어딜이 보내 드려요.`))) return
    setBusy(true)
    const r = await agencyRequest<{ net?: number }>('/payouts/request', { method: 'POST' })
    setBusy(false)
    if (!r.ok) { toast.error(r.data.error || '신청하지 못했어요'); return }
    toast.success('지급을 신청했어요.')
    await load()
  }

  return (
    <Sheet title="정산" onClose={onClose}>
      <div className="min-h-full bg-[#F8F7FC] dark:bg-[#11141C] p-4" data-testid="agency-payout-sheet">
        {error ? (
          <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-5 shadow-lift">
            <p className="text-[15px] text-gray-700 dark:text-gray-200">{error}</p>
            <button type="button" onClick={() => { void load() }} className="mt-3 h-10 rounded-xl bg-brand px-4 text-[15px] font-medium text-white">다시 시도</button>
          </div>
        ) : !data ? (
          <p className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</p>
        ) : !data.enabled || !b ? (
          <p className="py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">아직 유어딜 지급을 쓰지 않아요. 매장과 직접 정산해 주세요.</p>
        ) : (
          <>
            <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-5 shadow-lift">
              <p className="text-[13px] text-gray-500 dark:text-gray-400">지금 받을 수 있어요</p>
              <p className="mt-1 text-[28px] font-extrabold tabular-nums tracking-[-0.01em] text-gray-900 dark:text-white">
                {formatNumber(b.available)}<span className="ml-1 text-[17px] font-bold">원</span>
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ['기다리는 중', b.pending],
                  ['처리 중', b.requested],
                  ['받은 돈', b.paid],
                ].map(([k, v]) => (
                  <div key={k as string} className="min-w-0">
                    <dt className="text-[12px] text-gray-400 dark:text-gray-500">{k}</dt>
                    <dd className={`truncate text-[15px] font-bold tabular-nums ${Number(v) > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                      {formatNumber(Number(v))}
                    </dd>
                  </div>
                ))}
              </dl>
              {canManage ? (
                <button type="button" disabled={!canRequest || busy} onClick={() => { void request() }}
                  className="mt-5 h-12 w-full rounded-xl bg-brand text-[15px] font-bold text-white disabled:opacity-40">
                  {hasOpen ? '처리 중인 신청이 있어요' : b.available < min ? `${formatNumber(min)}원부터 신청할 수 있어요` : '지급 신청'}
                </button>
              ) : (
                <p className="mt-4 text-[13px] text-gray-500 dark:text-gray-400">지급 신청은 관리자가 할 수 있어요.</p>
              )}
            </div>
            <p className="mt-3 px-1 text-[12px] leading-[1.55] text-gray-500 dark:text-gray-400">
              팔린 이용권의 우리 몫은 환불 기간이 지나면 받을 수 있어요(기다리는 중). 환불되면 그만큼 빠져요.
              사업자는 세금계산서로 공제 없이, 개인은 3.3%를 떼고 받아요.
            </p>

            <h3 className="mt-6 px-1 text-[15px] font-bold text-gray-900 dark:text-white">지급 내역</h3>
            {data.payouts.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-gray-500 dark:text-gray-400">아직 신청한 지급이 없어요.</p>
            ) : (
              <ul className="mt-2 divide-y divide-rule rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift">
                {data.payouts.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium tabular-nums text-gray-900 dark:text-white">{formatNumber(p.net_amount)}원</span>
                      <span className="block text-[12px] text-gray-400 dark:text-gray-500">
                        {formatKSTDate(p.created_at)} 신청
                        {p.withholding_amount > 0 ? ` · 원천징수 ${formatNumber(p.withholding_amount)}원` : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[13px] font-medium ${p.status === 'paid' ? 'text-tone-ok' : 'text-gray-500 dark:text-gray-400'}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
