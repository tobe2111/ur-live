import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, MapPin, Truck, ChevronRight, X, CheckCircle, Circle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import type { Order } from '@/types/order'

interface OrdersTabProps {
  orders: Order[]
  onCancelOrder: (orderId: number | string, orderNumber: string) => void
  onSelectOrder: (order: Order) => void
}

// ─── 상태 표시 ────────────────────────────────────────────────────────────────

const StatusButton = ({
  label, status, active, onClick,
}: { label: string; status: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
      active ? 'bg-[#007aff] text-white' : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]'
    }`}
  >
    {label}
  </button>
)

const getStatusBadgeClass = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered': return 'bg-[#34c759] text-white'
    case 'shipping':  return 'bg-[#007aff] text-white'
    case 'cancelled': return 'bg-[#ff3b30] text-white'
    case 'preparing': return 'bg-[#ff9500] text-white'
    default:          return 'bg-[#8e8e93] text-white'
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

// ─── 구매 플로우 스텝퍼 ───────────────────────────────────────────────────────

const FLOW_STEPS = [
  { key: 'paid',      label: '결제완료' },
  { key: 'preparing', label: '상품준비중' },
  { key: 'shipping',  label: '배송중' },
  { key: 'delivered', label: '배송완료' },
]

const STATUS_ORDER: Record<string, number> = {
  pending: 0, paid: 1, preparing: 2, shipping: 3, delivered: 4,
}

function OrderFlowStepper({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'cancelled' || s === 'refunded') return null
  const currentIdx = STATUS_ORDER[s] ?? 1

  return (
    <div className="flex items-center gap-0 mb-4">
      {FLOW_STEPS.map((step, idx) => {
        const stepIdx = STATUS_ORDER[step.key]
        const done = stepIdx <= currentIdx
        const isLast = idx === FLOW_STEPS.length - 1

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mb-1 ${
                done ? 'bg-[#007aff]' : 'bg-[#d1d1d6]'
              }`}>
                {done
                  ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                  : <Circle className="w-3.5 h-3.5 text-white" />
                }
              </div>
              <span className={`text-[10px] font-medium text-center leading-tight ${
                done ? 'text-[#007aff]' : 'text-[#c7c7cc]'
              }`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`h-[2px] flex-1 mx-1 rounded-full mt-[-12px] ${
                STATUS_ORDER[FLOW_STEPS[idx + 1].key] <= currentIdx ? 'bg-[#007aff]' : 'bg-[#d1d1d6]'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── 배송 타임라인 모달 ───────────────────────────────────────────────────────

interface TrackingEvent {
  time: string
  statusCode: string
  statusName: string
  description: string
  location: string
}

interface TrackingData {
  events: TrackingEvent[]
  lastStatusCode?: string
  lastStatusName?: string
  orderStatus: string
  courier?: string
  trackingNumber?: string
  unsupported?: boolean
  apiError?: string
}

const STATUS_CODE_ICON: Record<string, string> = {
  INFORMATION_RECEIVED: '📋',
  AT_PICKUP:            '📦',
  IN_TRANSIT:           '🚛',
  OUT_FOR_DELIVERY:     '🏠',
  DELIVERED:            '✅',
  ATTEMPT_FAIL:         '⚠️',
}

function TrackingModal({
  orderId, courier, trackingNumber, onClose,
}: {
  orderId: number | string
  courier: string
  trackingNumber: string
  onClose: () => void
}) {
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useState(() => {
    api.get(`/api/orders/${orderId}/tracking`)
      .then(res => {
        if (res.data?.success) setData(res.data.data)
        else setError('배송 정보를 불러올 수 없습니다.')
      })
      .catch(() => setError('배송 조회 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#f0f0f0]">
          <div>
            <h3 className="text-[17px] font-bold text-[#1d1d1f]">배송 추적</h3>
            <p className="text-[13px] text-[#6e6e73] mt-0.5">
              {courier} · {trackingNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f7] hover:bg-[#e5e5ea] transition-colors"
          >
            <X className="w-4 h-4 text-[#6e6e73]" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-[#007aff] animate-spin" />
              <p className="text-[14px] text-[#6e6e73]">배송 정보 조회 중...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-8">
              <p className="text-[14px] text-[#ff3b30]">{error}</p>
            </div>
          )}

          {!loading && data && data.unsupported && (
            <div className="text-center py-8">
              <Truck className="w-12 h-12 text-[#c7c7cc] mx-auto mb-3" />
              <p className="text-[14px] font-medium text-[#1d1d1f] mb-1">자동 조회 미지원 택배사</p>
              <p className="text-[13px] text-[#6e6e73]">택배사 홈페이지에서 직접 조회해주세요.</p>
            </div>
          )}

          {!loading && data && data.apiError && (
            <div className="text-center py-8">
              <p className="text-[13px] text-[#6e6e73]">{data.apiError}</p>
              <p className="text-[12px] text-[#aeaeb2] mt-1">
                송장번호: {data.trackingNumber}
              </p>
            </div>
          )}

          {!loading && data && !data.unsupported && !data.apiError && (
            <>
              {data.events.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-[#c7c7cc] mx-auto mb-3" />
                  <p className="text-[14px] text-[#6e6e73]">아직 배송 정보가 없습니다.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* 타임라인 세로선 */}
                  <div className="absolute left-[18px] top-3 bottom-3 w-[2px] bg-[#f0f0f0]" />

                  <div className="space-y-4">
                    {data.events.map((event, idx) => (
                      <div key={idx} className="flex gap-3 relative">
                        {/* 아이콘 */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[16px] shrink-0 z-10 ${
                          idx === 0 ? 'bg-[#007aff]' : 'bg-[#f5f5f7]'
                        }`}>
                          {STATUS_CODE_ICON[event.statusCode] ?? '📍'}
                        </div>

                        {/* 내용 */}
                        <div className="flex-1 pt-1 pb-2">
                          <p className={`text-[14px] font-semibold ${idx === 0 ? 'text-[#007aff]' : 'text-[#1d1d1f]'}`}>
                            {event.statusName || event.description}
                          </p>
                          {event.description && event.description !== event.statusName && (
                            <p className="text-[13px] text-[#6e6e73] mt-0.5">{event.description}</p>
                          )}
                          {event.location && (
                            <p className="text-[12px] text-[#aeaeb2] mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </p>
                          )}
                          <p className="text-[12px] text-[#c7c7cc] mt-1">
                            {new Date(event.time).toLocaleString('ko-KR', {
                              month: 'long', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── OrdersTab 메인 ───────────────────────────────────────────────────────────

export function OrdersTab({ orders, onCancelOrder, onSelectOrder }: OrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'shipping' | 'delivered' | 'cancelled'>('all')
  const [trackingModal, setTrackingModal] = useState<{ orderId: number | string; courier: string; trackingNumber: string } | null>(null)

  const filteredOrders = orders.filter(order =>
    statusFilter === 'all' || order.status.toLowerCase() === statusFilter
  )

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
        <div className="apple-card p-12 text-center">
          <div className="w-24 h-24 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-12 w-12 text-[#6e6e73]" />
          </div>
          <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-4">주문 내역이 없습니다</h2>
          <p className="text-[17px] text-[#6e6e73] mb-8">라이브에서 마음에 드는 상품을 구매해보세요</p>
          <Button className="apple-button" asChild>
            <Link to="/">라이브 보러가기</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div key={order.id} className="apple-card p-6">
              {/* 주문번호 + 상태 */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[13px] text-[#6e6e73] mb-1">
                    {new Date(order.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">
                    주문번호: {order.order_number ?? String(order.id)}
                  </p>
                </div>
                <Badge className={`border-0 px-3 py-1 ${getStatusBadgeClass(order.status)}`}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>

              {/* 구매 플로우 스텝퍼 */}
              <OrderFlowStepper status={order.status} />

              {/* 상품 목록 */}
              <div className="space-y-3 mb-4">
                {order.items?.slice(0, 2).map((item, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1d1d1f] line-clamp-1">{item.product_name}</p>
                      {item.option_value && (
                        <p className="text-[12px] text-[#6e6e73]">옵션: {item.option_value}</p>
                      )}
                      <p className="text-[13px] text-[#6e6e73]">
                        {item.quantity}개 · {(item.price_snapshot * item.quantity).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                ))}
                {order.items && order.items.length > 2 && (
                  <p className="text-[13px] text-[#6e6e73] text-center">외 {order.items.length - 2}개</p>
                )}
              </div>

              {/* 배송지 */}
              <div className="p-4 bg-[#f5f5f7] rounded-xl mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-[#6e6e73]" />
                  <span className="text-[14px] font-medium text-[#1d1d1f]">{order.shipping_name ?? '-'}</span>
                </div>
                <p className="text-[14px] text-[#6e6e73] ml-6">
                  [{order.shipping_postal_code ?? ''}] {order.shipping_address ?? ''}
                </p>
                {order.shipping_address_detail && (
                  <p className="text-[14px] text-[#6e6e73] ml-6">{order.shipping_address_detail}</p>
                )}

                {/* 송장번호 + 배송조회 버튼 */}
                {order.courier && order.tracking_number && (
                  <div className="mt-3 pt-3 border-t border-[#d2d2d7]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-[#007aff]" />
                        <div className="text-[13px]">
                          <span className="text-[#6e6e73]">{order.courier} · </span>
                          <span className="font-medium text-[#1d1d1f]">{order.tracking_number}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setTrackingModal({
                          orderId: order.id,
                          courier: order.courier!,
                          trackingNumber: order.tracking_number!,
                        })}
                        className="text-[13px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center gap-1"
                      >
                        배송조회
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 금액 + 액션 */}
              <div className="flex items-center justify-between">
                <span className="text-[19px] font-bold text-[#1d1d1f]">
                  {(order.total_amount ?? order.amount ?? 0).toLocaleString()}원
                </span>
                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => onCancelOrder(order.id, order.order_number ?? String(order.id))}
                      className="px-4 py-2 text-[13px] font-medium text-[#ff3b30] border border-[#ff3b30] rounded-full hover:bg-[#ff3b30] hover:text-white transition-colors"
                    >
                      주문취소
                    </button>
                  )}
                  <button
                    onClick={() => onSelectOrder(order)}
                    className="flex items-center text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity"
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

      {/* 배송 타임라인 모달 */}
      {trackingModal && (
        <TrackingModal
          orderId={trackingModal.orderId}
          courier={trackingModal.courier}
          trackingNumber={trackingModal.trackingNumber}
          onClose={() => setTrackingModal(null)}
        />
      )}
    </div>
  )
}
