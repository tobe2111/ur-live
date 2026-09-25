/**
 * 🧾 주문 확인 — 마이 안에서 한 손으로 (2026-09-25, 설계 §14 단계 2)
 *
 * 결제는 끝났는데 사장님이 아직 확인 안 누른 주문. 누르면 **준비 중**으로 간다
 * (`nextStatusOf` 와 같은 전이 — 셀러 대시보드의 [주문 확인] 칩과 같은 동작이다).
 *
 * ⚠️ 여기서 **취소·환불은 하지 않는다.** 사유를 적어야 하고 되돌릴 수 없어서 한 손으로 할 일이 아니다
 *   (설계 §14 선별 표). 그건 전체 도구로 간다.
 */
import { Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import type { SellerWorkState, WorkOrder } from './useSellerWork'

export default function PendingOrders({ work, onDone }: { work: SellerWorkState; onDone?: () => void }) {
  const { orders, busyOrder, confirmOrder } = work
  if (orders.length === 0) return null

  const shown = orders.slice(0, 5)
  return (
    <div className="mt-3 rounded-2xl bg-surface shadow-lift overflow-hidden">
      <div className="flex items-center justify-between px-4 h-11 border-b border-rule">
        <span className="text-[14px] font-extrabold text-gray-900 dark:text-white">주문 확인</span>
        <span className="text-[13px] font-bold text-brand-text tabular-nums">{formatNumber(orders.length)}건</span>
      </div>
      {shown.map((o: WorkOrder) => (
        <div key={o.orderNumber} className="flex items-start gap-3 px-4 py-3 border-b border-rule last:border-b-0">
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-semibold text-gray-900 dark:text-white truncate">{o.title}</span>
            <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {o.buyer}{o.at ? ` · ${o.at}` : ''}
            </span>
          </span>
          <span className="shrink-0 flex flex-col items-end gap-1.5">
            <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">{formatNumber(o.amount)}원</span>
            <button
              type="button"
              disabled={busyOrder !== null}
              onClick={async () => { const ok = await confirmOrder(o); if (ok) onDone?.() }}
              className="h-8 px-3.5 rounded-full bg-brand text-white text-[13px] font-bold active:opacity-80 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {busyOrder === o.orderNumber && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              확인
            </button>
          </span>
        </div>
      ))}
      {orders.length > shown.length && (
        <p className="px-4 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">
          그 밖에 {formatNumber(orders.length - shown.length)}건은 전체 도구에서 볼 수 있어요
        </p>
      )}
    </div>
  )
}
