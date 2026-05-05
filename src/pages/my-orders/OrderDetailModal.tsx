/**
 * 🛡️ 2026-05-02: TD-018 분할 — MyOrdersPage 주문 상세 모달 (사용자 시점).
 *   배송 타임라인 + 결제 정보 + 판매자 문의 + 리뷰/취소 액션 포함.
 */
import { useNavigate } from 'react-router-dom'
import { Truck, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/useToast'
import { formatKST } from '@/utils/date'
import { formatNumber } from '@/utils/format'
import { getTrackingUrl } from '@/components/mypage/OrdersTab'
import type { Order } from '@/types/order'

interface Props {
  order: Order
  onClose: () => void
  onCancel: (id: string | number, orderNumber: string) => void
}

export default function OrderDetailModal({ order, onClose, onCancel }: Props) {
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl w-full max-h-[80dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="주문 상세">
        <div className="sticky top-0 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A] p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">주문 상세</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Info */}
          <div>
            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">주문 정보</h4>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">주문번호</span>
                <span className="font-medium text-gray-900 dark:text-white">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">주문일시</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatKST(order.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">주문상태</span>
                <Badge
                  className={`
                    border-0 px-3 py-1
                    ${order.status.toLowerCase() === 'delivered'
                      ? 'bg-emerald-500 text-white'
                      : order.status.toLowerCase() === 'shipping'
                      ? 'bg-blue-500 text-white'
                      : ['cancelled', 'refunded'].includes(order.status.toLowerCase())
                      ? 'bg-red-500 text-white'
                      : order.status.toLowerCase() === 'preparing'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-400 text-white'
                    }
                  `}
                >
                  {order.status.toLowerCase() === 'delivered'
                    ? '배송완료'
                    : order.status.toLowerCase() === 'shipping'
                    ? '배송중'
                    : ['cancelled', 'refunded'].includes(order.status.toLowerCase())
                    ? '취소/환불'
                    : order.status.toLowerCase() === 'preparing'
                    ? '상품준비중'
                    : '결제완료'
                  }
                </Badge>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">주문 상품</h4>
            <div className="space-y-3">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-[#121212] rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-gray-900 dark:text-white line-clamp-2">
                      {item.product_name}
                    </p>
                    {item.option_value && (
                      <p className="text-[12px] text-gray-500 dark:text-gray-400">
                        옵션: {item.option_value}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[13px] text-gray-500 dark:text-gray-400">
                        {item.quantity}개
                      </p>
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-white">
                        {/* ✅ BUG #7 FIX: price_snapshot is optional; guard against undefined→NaN */}
                        {formatNumber((item.price_snapshot ?? 0) * item.quantity)}원
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Info */}
          <div>
            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">배송 정보</h4>
            <div className="p-4 bg-gray-50 dark:bg-[#121212] rounded-xl space-y-2 text-[14px]">
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">받는분</span>
                <span className="font-medium text-gray-900 dark:text-white">{order.shipping_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">연락처</span>
                <span className="font-medium text-gray-900 dark:text-white">{order.shipping_phone}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">주소</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {(() => {
                    const addr = order.shipping_address
                    if (typeof addr === 'object' && addr !== null) {
                      const a = addr as { postal_code?: string; address1?: string; address2?: string }
                      return `[${a.postal_code || ''}] ${a.address1 || ''} ${a.address2 || ''}`
                    }
                    return `[${order.shipping_postal_code || ''}] ${addr || ''} ${order.shipping_address_detail || ''}`
                  })()}
                </span>
              </div>
              {/* 배송 상태 타임라인 */}
              {order.tracking_number && (() => {
                const status = order.status?.toUpperCase()
                const steps = [
                  { label: '결제완료', done: true },
                  { label: '상품준비', done: ['SHIPPING', 'DELIVERED', 'DONE'].some(s => status?.includes(s)) || !!order.tracking_number },
                  { label: '배송중', done: ['SHIPPING'].some(s => status?.includes(s)) || status === 'DELIVERED' },
                  { label: '배송완료', done: status === 'DELIVERED' },
                ]
                return (
                  <div className="pt-3 border-t border-gray-200 dark:border-[#2A2A2A]">
                    <div className="flex items-center justify-between mb-3">
                      {steps.map((step, si) => (
                        <div key={si} className="flex items-center flex-1">
                          <div className="flex flex-col items-center">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.done ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-[#2A2A2A] text-gray-400 dark:text-gray-500'}`}>
                              {step.done ? '✓' : si + 1}
                            </div>
                            <span className={`text-[10px] mt-1 ${step.done ? 'text-blue-600 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>{step.label}</span>
                          </div>
                          {si < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 mt-[-12px] ${steps[si + 1].done ? 'bg-blue-500' : 'bg-gray-200 dark:bg-[#2A2A2A]'}`} />}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-blue-600" />
                        <div className="text-[13px]">
                          {order.courier && (
                            <span className="text-gray-500 dark:text-gray-400">{order.courier} · </span>
                          )}
                          <span className="font-medium text-gray-900 dark:text-white">{order.tracking_number}</span>
                        </div>
                      </div>
                      {getTrackingUrl(order.courier, order.tracking_number) && (
                        <a
                          href={getTrackingUrl(order.courier, order.tracking_number)}
                          target="_blank" rel="noopener noreferrer"
                          className="text-[13px] text-blue-600 font-medium hover:opacity-60 transition-opacity flex items-center gap-0.5"
                        >
                          배송조회
                          <ChevronRight className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Payment Info */}
          <div>
            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">결제 정보</h4>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">상품 금액</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {/* ✅ items가 배열이 아닌 값(object 등)으로 올 경우 .reduce is not a function 방어 */}
                  {(Array.isArray(order.items) ? order.items : []).reduce((sum, item) => sum + (item.price_snapshot ?? 0) * item.quantity, 0)}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">배송비</span>
                <span className="font-medium text-gray-900 dark:text-white">3,000원</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-[#2A2A2A]">
                <span className="text-gray-900 dark:text-white font-semibold">총 결제금액</span>
                <span className="text-[19px] font-bold text-blue-600">
                  {/* ✅ BUG #7 FIX: total_amount is optional in Order type; nullish fallback prevents TypeError */}
                  {formatNumber(order.total_amount ?? order.amount ?? 0)}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">결제수단</span>
                <span className="font-medium text-gray-900 dark:text-white">{order.payment_method || 'Mock 결제'}</span>
              </div>
            </div>
          </div>

          {/* 판매자 문의 */}
          <button
            onClick={() => {
              const kakao = order.seller_kakao_chat_url as string | undefined
              const phone = order.seller_phone as string | undefined
              if (kakao) {
                window.open(kakao, '_blank', 'noopener,noreferrer')
              } else if (phone) {
                toast.info(`판매자 연락처: ${phone}`)
              } else {
                toast.info('판매자 연락처가 등록되지 않았습니다')
              }
            }}
            className="w-full py-3 text-[15px] font-medium text-blue-600 border border-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-colors"
          >
            판매자 문의
          </button>

          {/* 리뷰 작성 (배송완료 상태) */}
          {['delivered', 'done'].includes(order.status.toLowerCase()) && order.items?.[0]?.product_id && (
            <button
              onClick={() => {
                onClose()
                navigate(`/products/${order.items?.[0]?.product_id || ''}`)
              }}
              className="w-full py-3 text-[15px] font-medium text-amber-600 border border-amber-300 rounded-xl hover:bg-amber-50 transition-colors"
            >
              ★ 리뷰 작성하기
            </button>
          )}

          {/* Actions */}
          {['pending', 'paid', 'confirmed', 'done'].includes(order.status.toLowerCase()) && (
            <button
              onClick={() => {
                onClose()
                onCancel(order.id, order.order_number ?? String(order.id))
              }}
              className="w-full py-3 text-[15px] font-medium text-red-500 border border-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
            >
              주문 취소
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
