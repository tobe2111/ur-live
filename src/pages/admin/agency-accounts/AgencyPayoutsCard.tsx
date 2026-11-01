/**
 * 💸 어드민 — 에이전시 지급 신청 (결재 3단계, 2026-11-01)
 *   백엔드 `GET /api/admin/agency-payouts` · `POST /:id/paid` · `POST /:id/reject` (super·finance).
 *   로직 SSOT: `worker/utils/agency-share-payout.ts` (지급·반려는 서버 CAS — 두 번 눌러도 한 번).
 *
 * 송금 자체는 이 화면이 하지 않는다. 돈을 보낸 **뒤에** '지급 완료' 를 눌러 장부를 닫는다.
 * 반려하면 묶였던 몫이 다시 '받을 수 있어요' 로 돌아간다.
 * ⚠️ 어드민 = 라이트 고정(`dark:` 금지).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { confirmDialog, promptDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'

interface PayoutRow {
  id: number; agency_id: number; agency_name: string | null; kind: string | null; business_number: string | null
  gross_amount: number; withholding_amount: number; net_amount: number; tax_mode: string
  status: string; created_at: string; paid_at: string | null; memo: string | null
}

const STATUS_LABEL: Record<string, string> = { requested: '신청됨', paid: '지급 완료', rejected: '반려' }

export default function AgencyPayoutsCard() {
  const [rows, setRows] = useState<PayoutRow[] | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await api.get('/api/admin/agency-payouts')
      if (!r.data?.success) throw new Error(r.data?.error)
      setRows(r.data.data || [])
      setEnabled(!!r.data.enabled)
    } catch (e: any) {
      setError(e?.response?.data?.error || '지급 신청 목록을 불러오지 못했어요')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function markPaid(row: PayoutRow) {
    const who = row.agency_name || `에이전시 ${row.agency_id}`
    if (!(await confirmDialog({
      message: `${who} 에 ${formatNumber(row.net_amount)}원을 보냈나요? 보낸 뒤에만 눌러 주세요. 지급 완료로 바꾸면 되돌릴 수 없어요.`,
    }))) return
    const memo = await promptDialog({ message: '이체 메모(선택)', confirmText: '지급 완료', prompt: { placeholder: '예: 국민 11/03 이체' } })
    if (memo === null) return
    await act(row, 'paid', memo)
  }

  async function reject(row: PayoutRow) {
    const memo = await promptDialog({ message: '반려 사유를 적어 주세요. 묶였던 몫은 다시 신청할 수 있게 돌아가요.', confirmText: '반려', danger: true, prompt: { required: true } })
    if (memo === null) return
    await act(row, 'reject', memo)
  }

  async function act(row: PayoutRow, kind: 'paid' | 'reject', memo: string) {
    setBusy(row.id)
    try {
      const r = await api.post(`/api/admin/agency-payouts/${row.id}/${kind}`, { memo: memo.trim() || undefined })
      if (!r.data?.success) throw new Error(r.data?.error)
      toast.success(kind === 'paid' ? '지급 완료로 처리했어요' : '반려했어요')
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '처리하지 못했어요')
    } finally {
      setBusy(null)
    }
  }

  const open = (rows || []).filter((r) => r.status === 'requested')

  return (
    <div className="rounded-[var(--dash-radius,16px)] bg-white p-5 shadow-lift" data-testid="admin-agency-payouts">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[15px] font-bold text-gray-900">지급 신청</h2>
        {open.length > 0 && <span className="text-[13px] font-medium text-brand-text">{open.length}건 대기</span>}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
        에이전시가 맡은 매장에서 팔린 이용권의 에이전시 몫을 유어딜이 보내는 곳이에요. 송금은 여기서 하지 않아요. 보낸 뒤 '지급 완료' 를 눌러 주세요.
      </p>
      {enabled === false && (
        <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[13px] text-gray-600">
          지금은 꺼져 있어요(<code className="text-[12px]">agency_share_payout_enabled</code>). 켜기 전까지 에이전시 몫은 쌓이지 않고 신청도 들어오지 않아요.
        </p>
      )}

      {error ? (
        <div className="mt-3">
          <p className="text-[13px] text-tone-bad">{error}</p>
          <button type="button" onClick={load} className="mt-1 text-[13px] font-medium text-brand-text underline">다시 시도</button>
        </div>
      ) : rows === null ? (
        <p className="mt-3 text-[13px] text-gray-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-gray-500">아직 들어온 신청이 없어요.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-gray-900">
                  {r.agency_name || `에이전시 ${r.agency_id}`}
                  <span className={`ml-2 text-[12px] font-medium ${r.status === 'paid' ? 'text-tone-ok' : r.status === 'rejected' ? 'text-tone-bad' : 'text-brand-text'}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </p>
                <p className="truncate text-[13px] text-gray-500">
                  보낼 돈 {formatNumber(r.net_amount)}원
                  {r.withholding_amount > 0 ? ` (몫 ${formatNumber(r.gross_amount)} − 원천징수 ${formatNumber(r.withholding_amount)})` : ''}
                  {' · '}{r.tax_mode === 'tax_invoice' ? `세금계산서 받기 · 사업자 ${r.business_number || '-'}` : '개인 3.3% 원천징수'}
                  {' · '}{formatKSTDate(r.created_at)} 신청
                  {r.paid_at ? ` · ${formatKSTDate(r.paid_at)} 처리` : ''}
                  {r.memo ? ` · ${r.memo}` : ''}
                </p>
              </div>
              {r.status === 'requested' && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" disabled={busy === r.id} onClick={() => { void reject(r) }}
                    className="h-9 rounded-lg px-3 text-[13px] font-medium text-tone-bad hover:bg-gray-50 disabled:opacity-50">반려</button>
                  <button type="button" disabled={busy === r.id} onClick={() => { void markPaid(r) }}
                    className="h-9 rounded-lg bg-brand px-3 text-[13px] font-medium text-white disabled:opacity-50">지급 완료</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
