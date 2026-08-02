/**
 * 💸 **부분환불 금액 입력** — 세션 ④-c
 *
 * 환불을 실행하기 **전에** 금액을 정한다. 저장은 `PATCH /api/returns/:id/amount`(게이트 뒤)이고,
 * 실제 환불은 기존 `PUT /:id/refund` 가 **저장된 값 그대로** 집행한다.
 *
 * ## 🔴 이 화면이 하는 일과 안 하는 일
 * - **한다**: 금액 입력 · 저장 · 상한 초과 시 **깎였다고 말해준다**
 * - **안 한다**: 환불 실행. 버튼이 따로다 — *금액을 정하는 것*과 *돈을 내보내는 것*은 다른 결정이다.
 *
 * ## 🔴 말없이 깎지 않는다
 * 서버가 결제액으로 클램프하면 `clamped: true` 를 돌려준다. 그걸 그대로 보여준다 —
 * 운영자가 **자기가 입력한 금액이 나간 줄 알면** 나중에 장부가 안 맞는 이유를 못 찾는다.
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'

interface Props {
  returnId: number
  /** 현재 저장된 환불 예정 금액. */
  current: number | null
  /** 저장 성공 후 목록 갱신. */
  onSaved: () => void
  /** axios 요청 설정(어드민 Bearer). 페이지가 이미 갖고 있는 값을 그대로 받는다. */
  config?: Record<string, unknown>
}

export default function RefundAmountEditor({ returnId, current, onSaved, config }: Props) {
  const [value, setValue] = useState(String(current ?? ''))
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const res = await api.patch(`/api/returns/${returnId}/amount`, { amount: value }, config as never)
      // 서버가 깎았으면 그 사실을 그대로 알린다(성공 토스트로 뭉개지 않는다).
      // ⚠️ 로 뭉개지 않고 **info** 로 따로 띄운다 — 성공 토스트로 덮으면 깎인 사실이 묻힌다.
      if (res.data?.clamped) toast.info(res.data?.message || '결제 금액으로 조정되었습니다', { duration: 6000 })
      else toast.success(res.data?.message || '저장되었습니다')
      setOpen(false)
      onSaved()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '금액을 저장하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
      >
        환불 금액 {current != null ? `(${formatNumber(current)}원)` : '설정'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="환불 금액"
        className="w-32 h-8 px-2 text-xs border border-gray-300 rounded text-gray-900"
      />
      <button
        onClick={save}
        disabled={busy}
        className="px-3 py-1.5 text-xs font-bold text-white bg-gray-900 rounded disabled:opacity-50 inline-flex items-center gap-1"
      >
        {busy && <Loader2 className="w-3 h-3 animate-spin" />} 저장
      </button>
      <button
        onClick={() => { setOpen(false); setValue(String(current ?? '')) }}
        className="px-2 py-1.5 text-xs text-gray-500"
      >
        취소
      </button>
    </div>
  )
}
