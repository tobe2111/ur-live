import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, MapPin, Truck, ChevronRight, Check, MessageCircle } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import type { Order } from '@/types/order'
import { formatNumber } from '@/utils/format'

interface OrdersTabProps {
  orders: Order[]
  onCancelOrder: (orderId: number | string, orderNumber: string) => void
  onSelectOrder: (order: Order) => void
  onConfirmOrder?: (orderId: number | string, orderNumber: string) => void
}

// ─── 상태 필터 버튼 ───────────────────────────────────────────────────────────

const StatusButton = ({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors border ${
      active
        ? 'bg-gray-900 text-white border-gray-900'
        : 'bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#2A2A2A] hover:bg-gray-50'
    }`}
  >
    {label}
  </button>
)

// ─── 상태 배지 ────────────────────────────────────────────────────────────────

const getStatusBadge = (status: string) => {
  const s = status.toLowerCase()
  switch (s) {
    case 'delivered':
    case 'done':
      return { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100', label: '배송완료' }
    case 'shipping':
      return { cls: 'bg-blue-50 text-blue-700 border border-blue-100', label: '배송중' }
    case 'cancelled':
    case 'refunded':
      return { cls: 'bg-rose-50 text-rose-700 border border-rose-100', label: '취소/환불' }
    case 'preparing':
      return { cls: 'bg-amber-50 text-amber-700 border border-amber-100', label: '상품준비중' }
    default:
      return { cls: 'bg-gray-50 dark:bg-[#121212] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2A2A2A]', label: '결제완료' }
  }
}

// ─── 택배사별 외부 추적 URL ───────────────────────────────────────────────────

export function getTrackingUrl(courier?: string, trackingNumber?: string): string {
  if (!courier || !trackingNumber) return ''
  const n = encodeURIComponent(trackingNumber)
  const urls: Record<string, string> = {
    'CJ대한통운':    `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvNo=${n}`,
    '우체국택배':     `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${n}`,
    '한진택배':      `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${n}`,
    '로젠택배':      `https://www.ilogen.com/web/personal/trace/${n}`,
    '롯데택배':      `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${n}`,
    'GS택배':       `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=${n}`,
    '쿠팡로켓배송':   `https://www.coupang.com/my/orders/lookup?q=${n}`,
    '홈픽':         `https://www.homepick.com/parcel-tracking?trackingNo=${n}`,
  }
  return urls[courier] ?? `https://tracker.delivery/#/${courier}/${n}`
}

// ─── 구매 플로우 스텝퍼 ───────────────────────────────────────────────────────

const FLOW_STEPS = [
  { key: 'paid',      label: '결제완료' },
  { key: 'preparing', label: '상품준비중' },
  { key: 'shipping',  label: '배송중' },
  { key: 'delivered', label: '배송완료' },
]

const STATUS_ORDER: Record<string, number> = {
  pending: 1, paid: 1, preparing: 2, shipping: 3, delivered: 4, done: 4,
}

const REFUND_STEPS = [
  { key: 'requested',  label: '취소요청' },
  { key: 'processing', label: '처리중' },
  { key: 'completed',  label: '환불완료' },
]

function getRefundStepIndex(status: string, refundStatus?: string): number {
  if (status === 'refunded' || refundStatus === 'completed') return 3
  if (refundStatus === 'pending') return 2
  return 1
}

function Stepper({
  steps, currentIdx, activeColor,
}: {
  steps: { label: string }[]
  currentIdx: number
  activeColor: 'pink' | 'rose'
}) {
  const doneBg   = activeColor === 'pink' ? 'bg-pink-500'   : 'bg-rose-500'
  const doneText = activeColor === 'pink' ? 'text-pink-500' : 'text-rose-500'
  const doneLine = activeColor === 'pink' ? 'bg-pink-500'   : 'bg-rose-500'

  return (
    <div className="flex items-center">
      {steps.map((step, idx) => {
        const stepNum = idx + 1
        const done = stepNum <= currentIdx
        const isLast = idx === steps.length - 1
        return (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mb-1 ${
                  done ? doneBg : 'bg-gray-200 dark:bg-[#2A2A2A]'
                }`}
                aria-hidden="true"
              >
                {done ? (
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                )}
              </div>
              <span
                className={`text-[10px] font-semibold text-center leading-tight ${
                  done ? doneText : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`h-[2px] flex-1 mx-1 rounded-full -mt-[14px] ${
                  stepNum < currentIdx ? doneLine : 'bg-gray-200 dark:bg-[#2A2A2A]'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function OrderFlowStepper({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'cancelled' || s === 'refunded') return null
  const currentIdx = STATUS_ORDER[s] ?? 1
  return <Stepper steps={FLOW_STEPS} currentIdx={currentIdx} activeColor="pink" />
}

function RefundFlowStepper({ status, refundStatus }: { status: string; refundStatus?: string }) {
  const s = status.toLowerCase()
  if (s !== 'cancelled' && s !== 'refunded') return null
  const currentIdx = getRefundStepIndex(s, refundStatus)
  return <Stepper steps={REFUND_STEPS} currentIdx={currentIdx} activeColor="rose" />
}

// ─── OrdersTab 메인 ───────────────────────────────────────────────────────────

function handleSellerContact(order: Order) {
  const kakao = order.seller_kakao_chat_url as string | undefined
  const phone = order.seller_phone as string | undefined
  if (kakao) {
    window.open(kakao, '_blank', 'noopener,noreferrer')
  } else if (phone) {
    toast.info(`판매자 연락처: ${phone}`)
  } else {
    toast.info('판매자 연락처가 등록되지 않았습니다')
  }
}

type StatusFilter = 'all' | 'pending' | 'preparing' | 'shipping' | 'delivered' | 'cancelled'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',        label: '전체' },
  { key: 'pending',    label: '결제완료' },
  { key: 'preparing',  label: '준비중' },
  { key: 'shipping',   label: '배송중' },
  { key: 'delivered',  label: '배송완료' },
  { key: 'cancelled',  label: '취소/환불' },
]

export function OrdersTab({ orders, onCancelOrder, onSelectOrder, onConfirmOrder }: OrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredOrders = orders.filter(order => {
    if (statusFilter === 'all') return true
    const s = order.status.toLowerCase()
    if (statusFilter === 'pending')   return s === 'pending' || s === 'paid' || s === 'confirmed'
    if (statusFilter === 'cancelled') return s === 'cancelled' || s === 'refunded'
    return s === statusFilter
  })

  return (
    <div className="space-y-4">
      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
        {FILTERS.map(f => (
          <StatusButton
            key={f.key}
            label={f.label}
            active={statusFilter === f.key}
            onClick={() => setStatusFilter(f.key)}
          />
        ))}
      </div>

      {/* 주문 목록 */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-12 text-center">
          <div className="w-20 h-20 bg-gray-50 dark:bg-[#121212] rounded-full flex items-center justify-center mx-auto mb-5">
            <Package className="h-10 w-10 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-2">주문 내역이 없습니다</h2>
          <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-6">라이브에서 마음에 드는 상품을 구매해보세요</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white text-[14px] font-semibold rounded-full hover:bg-gray-800 active:bg-gray-700 transition-colors"
          >
            라이브 보러가기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const badge = getStatusBadge(order.status)
            const canCancel  = ['pending', 'paid', 'confirmed', 'done'].includes(order.status.toLowerCase())
            const canConfirm = order.status === 'shipping' && !!onConfirmOrder
            const orderNum = order.order_number ?? String(order.id)
            const dateStr = new Date(order.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric',
            })

            return (
              <article
                key={order.id}
                className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] overflow-hidden"
              >
                {/* 헤더: 주문일 + 상태 */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3">
                  <div className="min-w-0">
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">{dateStr}</p>
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white mt-0.5 truncate">
                      #{orderNum}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* 플로우 스텝퍼 */}
                <div className="px-4 pb-4">
                  <OrderFlowStepper status={order.status} />
                  <RefundFlowStepper status={order.status} refundStatus={order.refund_status} />
                </div>

                {/* 상품 목록 */}
                <div className="px-4 pb-3 space-y-2">
                  {order.items?.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="py-0.5">
                      <p className="text-[14px] font-medium text-gray-900 dark:text-white line-clamp-1">
                        {item.product_name}
                      </p>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {item.option_value && <span>{item.option_value} · </span>}
                        {item.quantity}개 · {formatNumber(item.price_snapshot * item.quantity)}원
                      </p>
                    </div>
                  ))}
                  {order.items && order.items.length > 2 && (
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">외 {order.items.length - 2}개</p>
                  )}
                </div>

                {/* 배송지 + 송장 */}
                <div className="mx-4 mb-4 p-3 bg-gray-50 dark:bg-[#121212] rounded-xl">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" strokeWidth={2} />
                    <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
                      {order.shipping_name ?? '-'}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-600 dark:text-gray-300 pl-5 line-clamp-2">
                    {(() => {
                      const addr = order.shipping_address
                      if (typeof addr === 'object' && addr !== null) {
                        const a = addr as { postal_code?: string; address1?: string; address2?: string }
                        return `[${a.postal_code || ''}] ${a.address1 || ''} ${a.address2 || ''}`
                      }
                      return `[${order.shipping_postal_code || ''}] ${addr || ''}${order.shipping_address_detail ? ` ${order.shipping_address_detail}` : ''}`
                    })()}
                  </p>

                  {order.courier && order.tracking_number && (
                    <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-[#2A2A2A] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" strokeWidth={2} />
                        <div className="text-[12px] min-w-0 truncate">
                          <span className="text-gray-500 dark:text-gray-400">{order.courier} · </span>
                          <span className="font-semibold text-gray-900 dark:text-white">{order.tracking_number}</span>
                        </div>
                      </div>
                      <a
                        href={getTrackingUrl(order.courier, order.tracking_number)}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-0.5"
                      >
                        배송조회
                        <ChevronRight className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* 하단: 금액 + 액션 */}
                <div className="px-4 pb-4 flex items-center justify-between border-t border-gray-100 dark:border-[#1A1A1A] pt-3">
                  <div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">결제금액</p>
                    <p className="text-[17px] font-extrabold text-gray-900 dark:text-white">
                      {formatNumber(order.total_amount ?? order.amount ?? 0)}
                      <span className="text-[13px] font-semibold text-gray-600 dark:text-gray-300 ml-0.5">원</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSellerContact(order)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] rounded-full hover:bg-gray-50 transition-colors"
                      aria-label="판매자 문의"
                    >
                      <MessageCircle className="h-3 w-3" strokeWidth={2} />
                      문의
                    </button>
                    {canCancel && (
                      <button
                        onClick={() => onCancelOrder(order.id, orderNum)}
                        className="px-2.5 py-1.5 text-[12px] font-semibold text-red-600 bg-white dark:bg-[#0A0A0A] border border-red-100 rounded-full hover:bg-red-50 transition-colors"
                      >
                        취소
                      </button>
                    )}
                    {canConfirm && onConfirmOrder && (
                      <button
                        onClick={() => onConfirmOrder(order.id, orderNum)}
                        className="px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full hover:bg-emerald-100 transition-colors"
                      >
                        구매확정
                      </button>
                    )}
                    <button
                      onClick={() => onSelectOrder(order)}
                      className="flex items-center text-[13px] font-bold text-gray-900 dark:text-white hover:text-gray-700 transition-colors ml-0.5"
                    >
                      상세
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
