import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, MapPin, Truck, ChevronRight, CheckCircle, Circle, MessageCircle, Phone as PhoneIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/useToast'
import type { Order } from '@/types/order'

interface OrdersTabProps {
  orders: Order[]
  onCancelOrder: (orderId: number | string, orderNumber: string) => void
  onSelectOrder: (order: Order) => void
  onConfirmOrder?: (orderId: number | string, orderNumber: string) => void
}

// ─── 상태 표시 ────────────────────────────────────────────────────────────────

const StatusButton = ({
  label, status, active, onClick,
}: { label: string; status: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
      active ? 'bg-white text-[#020202]' : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#2A2A2A]'
    }`}
  >
    {label}
  </button>
)

const getStatusBadgeClass = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered': return 'bg-green-500/20 text-green-400'
    case 'shipping':  return 'bg-amber-500/20 text-amber-400'
    case 'cancelled': return 'bg-red-500/20 text-red-400'
    case 'preparing': return 'bg-amber-500/20 text-amber-400'
    default:          return 'bg-gray-500/20 text-gray-400'
  }
}

const getStatusLabel = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered': return '배송완료'
    case 'shipping':  return '배송중'
    case 'cancelled': return '취소/환불'
    case 'preparing': return '상품준비중'
    default:          return '결제완료'
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
  pending: 1, paid: 1, preparing: 2, shipping: 3, delivered: 4,
}

// ─── 환불/취소 스텝퍼 ──────────────────────────────────────────────────────────

const REFUND_STEPS = [
  { key: 'requested', label: '취소요청' },
  { key: 'processing', label: '처리중' },
  { key: 'completed',  label: '환불완료' },
]

function getRefundStepIndex(status: string, refundStatus?: string): number {
  if (status === 'refunded' || refundStatus === 'completed') return 3
  if (refundStatus === 'pending') return 2
  return 1
}

function RefundFlowStepper({ status, refundStatus }: { status: string; refundStatus?: string }) {
  const s = status.toLowerCase()
  if (s !== 'cancelled' && s !== 'refunded') return null
  const currentIdx = getRefundStepIndex(s, refundStatus)

  return (
    <div className="flex items-center mb-4">
      {REFUND_STEPS.map((step, idx) => {
        const stepNum = idx + 1
        const done = stepNum <= currentIdx
        const isLast = idx === REFUND_STEPS.length - 1

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mb-1 ${
                done ? 'bg-red-500' : 'bg-[#2A2A2A]'
              }`}>
                {done
                  ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                  : <Circle className="w-3.5 h-3.5 text-gray-500" />
                }
              </div>
              <span className={`text-[10px] font-medium text-center leading-tight ${
                done ? 'text-red-400' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`h-[2px] flex-1 mx-1 rounded-full mt-[-12px] ${
                stepNum < currentIdx ? 'bg-red-500' : 'bg-[#2A2A2A]'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── 구매 플로우 스텝퍼 ───────────────────────────────────────────────────────

function OrderFlowStepper({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'cancelled' || s === 'refunded') return null
  const currentIdx = STATUS_ORDER[s] ?? 1

  return (
    <div className="flex items-center mb-4">
      {FLOW_STEPS.map((step, idx) => {
        const stepIdx = STATUS_ORDER[step.key]
        const done = stepIdx <= currentIdx
        const isLast = idx === FLOW_STEPS.length - 1

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mb-1 ${
                done ? 'bg-pink-500' : 'bg-[#2A2A2A]'
              }`}>
                {done
                  ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                  : <Circle className="w-3.5 h-3.5 text-gray-500" />
                }
              </div>
              <span className={`text-[10px] font-medium text-center leading-tight ${
                done ? 'text-pink-400' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`h-[2px] flex-1 mx-1 rounded-full mt-[-12px] ${
                STATUS_ORDER[FLOW_STEPS[idx + 1].key] <= currentIdx ? 'bg-pink-500' : 'bg-[#2A2A2A]'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
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

export function OrdersTab({ orders, onCancelOrder, onSelectOrder, onConfirmOrder }: OrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'shipping' | 'delivered' | 'cancelled'>('all')

  const filteredOrders = orders.filter(order => {
    if (statusFilter === 'all') return true
    const s = order.status.toLowerCase()
    // '결제완료' 필터: pending과 paid 둘 다 포함
    if (statusFilter === 'pending') return s === 'pending' || s === 'paid' || s === 'confirmed'
    // '취소/환불' 필터: cancelled와 refunded 포함
    if (statusFilter === 'cancelled') return s === 'cancelled' || s === 'refunded'
    return s === statusFilter
  })

  return (
    <div className="space-y-6">
      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <StatusButton label="전체"      status="all"       active={statusFilter === 'all'}       onClick={() => setStatusFilter('all')} />
        <StatusButton label="결제완료"   status="pending"   active={statusFilter === 'pending'}   onClick={() => setStatusFilter('pending')} />
        <StatusButton label="상품준비중" status="preparing" active={statusFilter === 'preparing'} onClick={() => setStatusFilter('preparing')} />
        <StatusButton label="배송중"     status="shipping"  active={statusFilter === 'shipping'}  onClick={() => setStatusFilter('shipping')} />
        <StatusButton label="배송완료"   status="delivered" active={statusFilter === 'delivered'} onClick={() => setStatusFilter('delivered')} />
        <StatusButton label="취소/환불"  status="cancelled" active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')} />
      </div>

      {/* 주문 목록 */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#121212] rounded-2xl border border-[#2A2A2A] p-12 text-center">
          <div className="w-24 h-24 bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-12 w-12 text-gray-500" />
          </div>
          <h2 className="text-[22px] font-semibold text-white mb-4">주문 내역이 없습니다</h2>
          <p className="text-[15px] text-gray-400 mb-8">라이브에서 마음에 드는 상품을 구매해보세요</p>
          <Link to="/" className="inline-block px-6 py-3 bg-white text-[#020202] font-medium rounded-xl hover:bg-gray-200 transition-colors">
            라이브 보러가기
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div key={order.id} className="bg-[#121212] rounded-2xl border border-[#2A2A2A] p-5">
              {/* 주문번호 + 상태 배지 */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[13px] text-gray-500 mb-1">
                    {new Date(order.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                  <p className="text-[15px] font-semibold text-white">
                    주문번호: {order.order_number ?? String(order.id)}
                  </p>
                </div>
                <Badge className={`border-0 px-3 py-1 ${getStatusBadgeClass(order.status)}`}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>

              {/* 구매 플로우 스텝퍼 / 환불 상태 스텝퍼 */}
              <OrderFlowStepper status={order.status} />
              <RefundFlowStepper status={order.status} refundStatus={order.refund_status} />

              {/* 상품 목록 */}
              <div className="space-y-3 mb-4">
                {order.items?.slice(0, 2).map((item, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-white line-clamp-1">{item.product_name}</p>
                      {item.option_value && (
                        <p className="text-[12px] text-gray-500">옵션: {item.option_value}</p>
                      )}
                      <p className="text-[13px] text-gray-400">
                        {item.quantity}개 · {(item.price_snapshot * item.quantity).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                ))}
                {order.items && order.items.length > 2 && (
                  <p className="text-[13px] text-gray-500 text-center">외 {order.items.length - 2}개</p>
                )}
              </div>

              {/* 배송지 + 배송 추적 */}
              <div className="p-4 bg-[#1A1A1A] rounded-xl mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="text-[14px] font-medium text-white">{order.shipping_name ?? '-'}</span>
                </div>
                <p className="text-[14px] text-gray-400 ml-6">
                  {(() => {
                    const addr = order.shipping_address
                    if (typeof addr === 'object' && addr !== null) {
                      const a = addr as any
                      return `[${a.postal_code || ''}] ${a.address1 || ''} ${a.address2 || ''}`
                    }
                    return `[${order.shipping_postal_code || ''}] ${addr || ''}`
                  })()}
                </p>
                {order.shipping_address_detail && typeof order.shipping_address_detail === 'string' && (
                  <p className="text-[14px] text-gray-400 ml-6">{order.shipping_address_detail}</p>
                )}

                {/* 송장번호 + 배송조회 링크 */}
                {order.courier && order.tracking_number && (
                  <div className="mt-3 pt-3 border-t border-[#2A2A2A] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-pink-400" />
                      <div className="text-[13px]">
                        <span className="text-gray-500">{order.courier} · </span>
                        <span className="font-medium text-white">{order.tracking_number}</span>
                      </div>
                    </div>
                    <a
                      href={getTrackingUrl(order.courier, order.tracking_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-pink-400 font-medium hover:opacity-60 transition-opacity flex items-center gap-0.5"
                    >
                      배송조회
                      <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* 판매자 문의 + 배송 조회 */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleSellerContact(order)}
                  className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-gray-400 bg-[#1A1A1A] rounded-xl hover:bg-[#2A2A2A] transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  판매자 문의
                </button>
                {order.tracking_number && (
                  <a
                    href={getTrackingUrl(order.courier, order.tracking_number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-pink-400 bg-pink-500/10 rounded-xl hover:bg-pink-500/20 transition-colors"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    배송 조회
                  </a>
                )}
              </div>

              {/* 금액 + 액션 */}
              <div className="flex items-center justify-between">
                <span className="text-[19px] font-bold text-white">
                  {(order.total_amount ?? order.amount ?? 0).toLocaleString()}원
                </span>
                <div className="flex gap-2">
                  {['pending', 'paid', 'confirmed', 'done'].includes(order.status.toLowerCase()) && (
                    <button
                      onClick={() => onCancelOrder(order.id, order.order_number ?? String(order.id))}
                      className="px-4 py-2 text-[13px] font-medium text-red-400 border border-red-500/30 rounded-full hover:bg-red-500/10 transition-colors"
                    >
                      주문취소
                    </button>
                  )}
                  {order.status === 'shipping' && onConfirmOrder && (
                    <button
                      onClick={() => onConfirmOrder(order.id, order.order_number ?? String(order.id))}
                      className="px-4 py-2 text-[13px] font-medium text-green-400 border border-green-500/30 rounded-full hover:bg-green-500/10 transition-colors"
                    >
                      구매확정
                    </button>
                  )}
                  <button
                    onClick={() => onSelectOrder(order)}
                    className="flex items-center text-[15px] text-pink-400 font-medium hover:opacity-60 transition-opacity"
                  >
                    상세보기
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
