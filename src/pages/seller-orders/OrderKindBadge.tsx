/**
 * 🧾 주문 종류 배지 + 주문자 칸 — 셀러 주문관리가 이용권을 택배로 그리던 것의 화면 쪽 절반.
 *
 * 별도 파일인 이유는 둘이다: `SellerOrdersPage` 가 파일크기 래칫(600줄) **바로 아래**라 더 못 키우고,
 * 배지와 주문자 칸이 **같은 사실**(이 주문에 배송지가 있나)에 매달려 있어 한 덩어리로 읽히는 편이 맞다.
 *
 * 🔴 판정은 여기서 하지 않는다 — 서버가 실어 보낸 `order_kind` 를 `orderKindOf` 로 읽기만 한다.
 *    화면이 카테고리로 종류를 다시 정하기 시작하면 어드민이 이용권을 "교환권"이라 부르던 그 사고가
 *    자리만 옮겨 재발한다.
 */
import { Ticket, Gift, Package } from 'lucide-react'
import { ORDER_KIND_META, orderKindOf, isNoShippingOrder, type OrderKind } from '@/shared/order-kind'

const ICONS = { ticket: Ticket, gift: Gift, package: Package } as const

const TONE: Record<OrderKind, string> = {
  voucher: 'bg-tone-info-bg text-tone-info',
  deal: 'bg-tone-warn-bg text-tone-warn',
  shipping: 'bg-gray-100 text-gray-600',
}

export function OrderKindBadge({ kind }: { kind: OrderKind }) {
  const meta = ORDER_KIND_META[kind]
  const Icon = ICONS[meta.icon]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${TONE[kind]}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

/**
 * 주문자 칸. 배송 주문은 받는 사람(배송지)이 곧 주문자지만, **이용권·교환권엔 배송지가 없다** —
 * 그 자리에 `shipping_name` 을 그리면 빈 칸이 뜬다(대표가 본 화면이 그것이다). 계정 정보로 떨어진다.
 */
export function OrdererCell({ order }: {
  order: { order_kind?: string | null; shipping_name?: string | null; shipping_phone?: string | null; user_name?: string | null; user_email?: string | null }
}) {
  const kind = orderKindOf(order.order_kind)
  const name = (isNoShippingOrder(kind) ? order.user_name : order.shipping_name) || order.user_name || '-'
  const sub = isNoShippingOrder(kind) ? order.user_email : order.shipping_phone
  return (
    <div className="flex items-start gap-2">
      <OrderKindBadge kind={kind} />
      <div className="min-w-0">
        <div className="truncate">{name}</div>
        {sub ? <div className="text-xs text-gray-400 truncate">{sub}</div> : null}
      </div>
    </div>
  )
}
