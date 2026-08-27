/**
 * 🏦 정산 일괄 처리 바 — 대표 "어드민에서 정산을 최대한 간편하게" (2026-08-27)
 *
 * ## 무엇을 줄이나
 * 그 전 흐름은 [건별 승인 → 은행에서 **건별 이체** → 돌아와 건별 송금완료 마킹] 이었다.
 * 수취인 30명이면 매주 **90번**을 클릭·이체한다. 여기서 하는 일은 그걸 **네 번**으로 줄이는 것:
 *   ① 일괄 승인 → ② 이체 파일 받기 → ③ 은행에 1번 업로드 → ④ 일괄 송금완료
 *
 * ## ⚠️ 왜 확인 문구에 금액과 건수를 넣나
 * "일괄 송금완료" 는 **돈이 실제로 나갔다는 기록**이다. 잘못 누르면 안 나간 돈이 나간 것으로
 * 장부에 박히고, 수령자는 영영 못 받는다. 그래서 누르기 전에 **몇 건·얼마**를 눈으로 보게 한다.
 * (서버도 건별 가드를 다시 검사한다 — 계좌 누락 / 같은 기간 중복 / CAS. 이 화면은 마지막 확인일 뿐.)
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { Download, CheckCircle, Send, Loader2 } from 'lucide-react'
import { formatNumber, formatWon } from '@/utils/format'

export interface BulkTarget { id: number; amount: number; status: string }

export default function BulkPayoutBar({
  selected, onDone, onClear,
}: {
  selected: BulkTarget[]
  onDone: () => void
  onClear: () => void
}) {
  const [busy, setBusy] = useState<'approve' | 'sent' | 'csv' | null>(null)

  const pendings = selected.filter((s) => s.status === 'pending')
  const sendables = selected.filter((s) => s.status === 'pending' || s.status === 'approved')
  const total = sendables.reduce((sum, s) => sum + Number(s.amount || 0), 0)

  async function bulkApprove() {
    if (pendings.length === 0) return toast.error('승인 대기 건을 선택해주세요')
    if (!(await confirmDialog(`${formatNumber(pendings.length)}건을 승인할까요? (아직 송금은 아닙니다)`))) return
    setBusy('approve')
    try {
      const r = await api.patch('/api/admin/payouts/bulk-approve', { ids: pendings.map((p) => p.id) })
      if (!r.data?.success) throw new Error(r.data?.error)
      const d = r.data.data
      toast.success(`${formatNumber(d.approved)}건 승인${d.skipped ? ` · ${d.skipped}건은 이미 처리됨` : ''}`)
      onDone(); onClear()
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '승인하지 못했습니다')
    } finally { setBusy(null) }
  }

  async function downloadCsv(status: 'approved' | 'pending') {
    setBusy('csv')
    try {
      const r = await api.get('/api/admin/payouts/transfer-csv', { params: { status }, responseType: 'blob' })
      const skipped = Number(r.headers?.['x-skipped-count'] ?? 0)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `urdeal_transfer_${status}.csv`
      a.click()
      URL.revokeObjectURL(url)
      // 계좌가 빠진 건은 은행이 그 행을 거부한다 — 조용히 빼면 그 수령자만 영영 못 받는다.
      if (skipped > 0) toast.error(`계좌 정보가 없어 ${formatNumber(skipped)}건이 파일에서 빠졌습니다 — 계좌 등록을 확인하세요`)
      else toast.success('이체 파일을 내려받았습니다')
    } catch {
      toast.error('파일을 만들지 못했습니다')
    } finally { setBusy(null) }
  }

  async function bulkSent() {
    if (sendables.length === 0) return toast.error('송금 완료로 표시할 건을 선택해주세요')
    const txId = window.prompt(
      `은행 이체를 마치셨나요?\n\n${formatNumber(sendables.length)}건 · 합계 ${formatWon(total)}\n\n` +
      '이체 파일명 또는 은행 거래번호를 입력하세요 (나중에 대조할 근거가 됩니다)',
    )
    if (!txId || !txId.trim()) return
    if (!(await confirmDialog(
      `${formatNumber(sendables.length)}건 · ${formatWon(total)}을 송금 완료로 기록합니다.\n` +
      '실제로 이체하지 않았다면 취소하세요 — 되돌리기 어렵습니다.',
    ))) return

    setBusy('sent')
    try {
      const r = await api.patch('/api/admin/payouts/bulk-sent', {
        ids: sendables.map((s) => s.id), transaction_id: txId.trim(),
      })
      if (!r.data?.success) throw new Error(r.data?.error)
      const d = r.data.data
      if (d.failed_count > 0) {
        // 실패분을 뭉뚱그리면 어느 수령자가 안 나갔는지 모른다 — 건별로 보여 준다.
        const detail = (d.failed as { id: number; error?: string }[]).slice(0, 5)
          .map((f) => `#${f.id} ${f.error || ''}`).join('\n')
        toast.error(`${formatNumber(d.sent)}건 완료 · ${d.failed_count}건 실패\n${detail}`)
      } else {
        toast.success(`${formatNumber(d.sent)}건 · ${formatWon(d.total_amount)} 송금 완료로 기록됐습니다`)
      }
      onDone(); onClear()
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '처리하지 못했습니다')
    } finally { setBusy(null) }
  }

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0 text-xs text-gray-700">
          {selected.length > 0 ? (
            <>
              <b className="text-gray-900">{formatNumber(selected.length)}건</b> 선택됨
              {total > 0 && <> · 송금 대상 합계 <b className="text-gray-900">{formatWon(total)}</b></>}
              <button onClick={onClear} className="ml-2 text-gray-400 underline">선택 해제</button>
            </>
          ) : (
            <span className="text-gray-500">
              체크박스로 선택하면 일괄 처리할 수 있습니다 · <b>승인 → 이체 파일 → 은행 업로드 → 일괄 송금완료</b>
            </span>
          )}
        </div>

        <button
          onClick={() => downloadCsv('approved')} disabled={busy !== null}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-50"
        >
          {busy === 'csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          이체 파일 받기
        </button>

        <button
          onClick={bulkApprove} disabled={busy !== null || pendings.length === 0}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {busy === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          일괄 승인 {pendings.length > 0 && `(${pendings.length})`}
        </button>

        <button
          onClick={bulkSent} disabled={busy !== null || sendables.length === 0}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {busy === 'sent' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          일괄 송금완료 {sendables.length > 0 && `(${sendables.length})`}
        </button>
      </div>
    </div>
  )
}
