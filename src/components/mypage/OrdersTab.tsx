import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, MapPin, Truck, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Order } from '@/types/order'

// OrdersTab 전용 Props 타입 (공통 Order 타입 사용)
interface OrdersTabProps {
  orders: Order[]
  onCancelOrder: (orderId: number | string, orderNumber: string) => void
  onSelectOrder: (order: Order) => void
}

const StatusButton = ({ 
  label, 
  status, 
  active, 
  onClick 
}: { 
  label: string
  status: string
  active: boolean
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
      active
        ? 'bg-[#007aff] text-white'
        : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]'
    }`}
  >
    {label}
  </button>
)

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'delivered':
      return 'bg-[#34c759] text-white'
    case 'shipping':
      return 'bg-[#007aff] text-white'
    case 'cancelled':
      return 'bg-[#ff3b30] text-white'
    case 'preparing':
      return 'bg-[#ff9500] text-white'
    default:
      return 'bg-[#8e8e93] text-white'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'delivered':
      return '배송완료'
    case 'shipping':
      return '배송중'
    case 'cancelled':
      return '취소/환불'
    case 'preparing':
      return '상품준비중'
    default:
      return '결제완료'
  }
}

const getTrackingUrl = (courier?: string, trackingNumber?: string): string => {
  if (!courier || !trackingNumber) return ''
  
  const courierUrls: { [key: string]: string } = {
    'CJ대한통운': `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvNo=${trackingNumber}`,
    '우체국택배': `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${trackingNumber}`,
    '한진택배': `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${trackingNumber}`,
    '로젠택배': `https://www.ilogen.com/web/personal/trace/${trackingNumber}`,
    'GS Postbox 택배': `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=${trackingNumber}`,
    '롯데택배': `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${trackingNumber}`,
    '쿠팡로켓배송': `https://www.coupang.com/my/orders/lookup?q=${trackingNumber}`
  }
  
  return courierUrls[courier] || `https://tracker.delivery/#/${courier}/${trackingNumber}`
}

export function OrdersTab({ orders, onCancelOrder, onSelectOrder }: OrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'shipping' | 'delivered' | 'cancelled'>('all')

  const filteredOrders = orders.filter(order => 
    statusFilter === 'all' || order.status === statusFilter
  )

  return (
    <div className="space-y-6">
      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <StatusButton label="전체" status="all" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
        <StatusButton label="결제완료" status="pending" active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} />
        <StatusButton label="상품준비중" status="preparing" active={statusFilter === 'preparing'} onClick={() => setStatusFilter('preparing')} />
        <StatusButton label="배송중" status="shipping" active={statusFilter === 'shipping'} onClick={() => setStatusFilter('shipping')} />
        <StatusButton label="배송완료" status="delivered" active={statusFilter === 'delivered'} onClick={() => setStatusFilter('delivered')} />
        <StatusButton label="취소/환불" status="cancelled" active={statusFilter === 'cancelled'} onClick={() => setStatusFilter('cancelled')} />
      </div>

      {/* Orders List or Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="apple-card p-12 text-center">
          <div className="w-24 h-24 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-12 w-12 text-[#6e6e73]" />
          </div>
          <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-4">
            주문 내역이 없습니다
          </h2>
          <p className="text-[17px] text-[#6e6e73] mb-8">
            라이브에서 마음에 드는 상품을 구매해보세요
          </p>
          <Button className="apple-button" asChild>
            <Link to="/">라이브 보러가기</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div key={order.id} className="apple-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[13px] text-[#6e6e73] mb-1">
                    {new Date(order.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
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

              {/* Order Items */}
              <div className="space-y-3 mb-4">
                {order.items?.slice(0, 2).map((item, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1d1d1f] line-clamp-1">
                        {item.product_name}
                      </p>
                      {item.option_value && (
                        <p className="text-[12px] text-[#6e6e73]">
                          옵션: {item.option_value}
                        </p>
                      )}
                      <p className="text-[13px] text-[#6e6e73]">
                        {item.quantity}개 · {(item.price_snapshot * item.quantity).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                ))}
                {order.items && order.items.length > 2 && (
                  <p className="text-[13px] text-[#6e6e73] text-center">
                    외 {order.items.length - 2}개
                  </p>
                )}
              </div>

              {/* Shipping Info */}
              <div className="p-4 bg-[#f5f5f7] rounded-xl mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-[#6e6e73]" />
                  <span className="text-[14px] font-medium text-[#1d1d1f]">
                    {order.shipping_name ?? '-'}
                  </span>
                </div>
                <p className="text-[14px] text-[#6e6e73] ml-6">
                  [{order.shipping_postal_code ?? ''}] {order.shipping_address ?? ''}
                </p>
                {order.shipping_address_detail && (
                  <p className="text-[14px] text-[#6e6e73] ml-6">
                    {order.shipping_address_detail}
                  </p>
                )}
                {order.courier && order.tracking_number && (
                  <div className="mt-3 pt-3 border-t border-[#d2d2d7]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-[#007aff]" />
                        <div className="text-[13px]">
                          <span className="text-[#6e6e73]">{order.courier} · </span>
                          <span className="font-medium text-[#1d1d1f]">
                            {order.tracking_number}
                          </span>
                        </div>
                      </div>
                      {getTrackingUrl(order.courier, order.tracking_number) && (
                        <a
                          href={getTrackingUrl(order.courier, order.tracking_number)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center gap-1"
                        >
                          배송조회
                          <ChevronRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
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
    </div>
  )
}
