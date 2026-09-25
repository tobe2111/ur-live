/**
 * 💸 환불 — 마이 안에서 (2026-09-25, 설계 §19, 대표 *"환불도 마이에서 돼야해"*)
 *
 * ## 화면은 돈을 옮기지 않는다
 * `POST /api/seller/orders/:id/refund` 하나를 부른다. 그 서버 경로가 **검증된 공유 루틴**
 * `refundOrderFully` 로 Toss 취소·딜 환불·재고 복원·커미션/공급자/영입자 역전을 한꺼번에 한다.
 * 여기서 금액을 계산하거나 상태를 직접 바꾸지 않는다 — 그러면 두 벌이 갈린다.
 *
 * ## 🔴 되돌릴 수 없다
 * 그래서 두 단계다: 주문을 고르고 → 사유를 적고 확인. 한 번의 탭으로 환불되지 않는다.
 * 사유는 서버가 200자로 자르고 기록에 남는다(분쟁의 유일한 근거).
 *
 * ⚠️ 상태 변경으로 취소하는 길(`PUT /status` → CANCELLED)은 **서버가 막는다**(`REFUND_REQUIRED`) —
 *   그 길은 고객 돈을 안 돌려주고 '취소' 알림만 보낸다. 이 시트는 환불 경로만 쓴다.
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { assertSeat, currentSeatId, SeatMismatchError } from '@/lib/seller-seat'
import { parseUTCDate } from '@/utils/date'
import { toast } from '@/hooks/useToast'
import Sheet from './Sheet'

/** 결제가 캡처된 주문만 환불 대상. 서버 `handleStatusUpdate` 의 CAPTURED 와 같은 집합. */
const REFUNDABLE = new Set(['PAID', 'DONE', 'PREPARING', 'SHIPPING', 'DELIVERED'])

interface Row { id: number; orderNumber: string; title: string; buyer: string; amount: number; when: string }

function kstDay(iso: unknown): string {
  const d = parseUTCDate(typeof iso === 'string' ? iso : null)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' })
}

export default function RefundSheet({ sellerId, onClose, onDone }: {
  sellerId: number
  onClose: () => void
  onDone?: () => void
}) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<Row | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    // 🪑 좌석이 안 맞으면 부르지 않는다 — 부르면 다른 가게의 주문 목록을 그린다.
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/orders?limit=50&sort=desc'))
      .then((r) => {
        if (!alive) return
        if (!r.data?.success) { setFailed(true); return }
        const list = (r.data.data || []) as Array<Record<string, unknown>>
        setRows(list
          .filter((o) => REFUNDABLE.has(String(o.status)))
          .map((o) => {
            const items = Array.isArray(o.items) ? (o.items as Array<Record<string, unknown>>) : []
            const name = items[0] && typeof items[0].product_name === 'string' ? items[0].product_name : '주문'
            return {
              id: Number(o.id),
              orderNumber: String(o.order_number ?? ''),
              title: items.length > 1 ? `${name} 외 ${items.length - 1}` : name,
              buyer: String(o.shipping_name || o.user_name || '고객'),
              amount: Number(o.total_amount) || 0,
              when: kstDay(o.created_at),
            }
          }))
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [sellerId])

  async function refund() {
    if (!picked || busy) return
    try {
      assertSeat(sellerId)
    } catch (e) {
      if (e instanceof SeatMismatchError) { toast.error('가게가 바뀌었어요. 다시 열어 주세요'); onClose(); return }
      throw e
    }
    setBusy(true)
    try {
      const { default: api } = await import('@/lib/api')
      const r = await api.post(`/api/seller/orders/${encodeURIComponent(picked.orderNumber)}/refund`, {
        reason: reason.trim() || '판매자 주문 취소',
      })
      if (!r.data?.success) { toast.error(r.data?.error || '환불하지 못했습니다'); return }
      toast.success(`${formatNumber(r.data.refund_amount ?? picked.amount)}원을 환불했습니다`)
      onDone?.()
      onClose()
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || '환불하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  // ── 2단계: 사유 + 확인 ───────────────────────────────────────────────────
  if (picked) {
    return (
      <Sheet
        title="환불하기"
        onClose={onClose}
        footer={
          <button
            type="button"
            disabled={busy}
            onClick={refund}
            className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {formatNumber(picked.amount)}원 환불하기
          </button>
        }
      >
        <div className="px-4 py-4">
          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{picked.title}</p>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1">{picked.buyer} · 주문번호 {picked.orderNumber}</p>

          <p className="text-[13px] leading-[1.6] text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-rule">
            결제는 <span className="font-bold text-gray-900 dark:text-white">바로 취소</span>되고 손님에게 돌아갑니다.
            되돌릴 수 없습니다. 이용권이 발급됐다면 함께 회수됩니다.
          </p>

          <label className="block mt-4">
            <span className="block text-[13px] font-bold text-gray-900 dark:text-white mb-1.5">환불 사유</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="예: 재료 소진으로 준비가 어려워 취소합니다"
              className="w-full rounded-xl border border-rule-strong bg-transparent px-3 py-2.5 text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <span className="block text-[11.5px] text-gray-500 dark:text-gray-400 mt-1">
              손님에게 전달되고 기록에 남습니다. 비우면 &lsquo;판매자 주문 취소&rsquo;로 기록됩니다.
            </span>
          </label>
        </div>
      </Sheet>
    )
  }

  // ── 1단계: 어느 주문인가 ─────────────────────────────────────────────────
  return (
    <Sheet title="환불할 주문 고르기" onClose={onClose}>
      {rows === null && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          주문을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
        </p>
      )}
      {rows?.length === 0 && (
        <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          환불할 수 있는 결제 완료 주문이 없습니다.
        </p>
      )}
      {rows?.map((o) => (
        <button
          key={o.orderNumber}
          type="button"
          onClick={() => setPicked(o)}
          className="w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-rule active:opacity-70"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-semibold text-gray-900 dark:text-white truncate">{o.title}</span>
            <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {o.buyer}{o.when ? ` · ${o.when}` : ''}
            </span>
          </span>
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">
            {formatNumber(o.amount)}원
          </span>
        </button>
      ))}
    </Sheet>
  )
}
