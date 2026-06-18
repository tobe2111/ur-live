/**
 * 🛡️ 2026-05-02: TD-018 분할 — MyOrdersPage 주문 상세 모달 (사용자 시점).
 *   배송 타임라인 + 결제 정보 + 판매자 문의 + 리뷰/취소 액션 포함.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Truck, ChevronRight, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/useToast'
import { formatKST } from '@/utils/date'
import { formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import { getTrackingUrl } from '@/components/mypage/OrdersTab'
import TrackingModal from '@/components/shipping/TrackingModal'
import type { Order, OrderItem } from '@/types/order'
import { orderItemLineTotal } from '@/types/order'
import { getOrderKind } from '@/shared/order-type'

interface Props {
  order: Order
  onClose: () => void
  onCancel: (id: string | number, orderNumber: string) => void
  // 🛡️ 2026-06-18: 구매 내역 삭제(숨김) — 종료 상태 주문만.
  onHide?: (id: string | number, orderNumber: string) => void
}

export default function OrderDetailModal({ order, onClose, onCancel, onHide }: Props) {
  const { t } = useTranslation()
  const [showTracking, setShowTracking] = useState(false)
  const navigate = useNavigate()
  // 🛡️ 2026-06-18: 종류 분류 — 교환권/공구는 배송 섹션·배송비 숨김.
  const kind = getOrderKind(order as { items?: OrderItem[] })
  const isProduct = kind === 'product'
  // 결제 라인 — 서버 mapOrder 가 내려준 실값(subtotal/shipping_fee/discount) 우선, 없으면 아이템 합산.
  const items = Array.isArray(order.items) ? order.items : []
  const itemsTotal = items.reduce((sum, item) => sum + orderItemLineTotal(item), 0)
  const productAmount = order.subtotal ?? itemsTotal
  const shippingFee = isProduct ? (order.shipping_fee ?? 0) : 0
  const discountAmount = order.discount_amount ?? 0
  const totalAmount = order.total_amount ?? order.amount ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl w-full max-h-[80dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('orderDetail.title', { defaultValue: '주문 상세' })}>
        <div className="sticky top-0 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A] p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('orderDetail.title', { defaultValue: '주문 상세' })}</h3>
          <button
            onClick={onClose}
            aria-label={t('orderDetail.closeAria', { defaultValue: '닫기' })}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Info */}
          <div>
            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">{t('orderDetail.sectionOrderInfo', { defaultValue: '주문 정보' })}</h4>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('orderDetail.orderNumber', { defaultValue: '주문번호' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('orderDetail.orderDate', { defaultValue: '주문일시' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatKST(order.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('orderDetail.orderStatus', { defaultValue: '주문상태' })}</span>
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
                    ? t('orderDetail.statusDelivered', { defaultValue: '배송완료' })
                    : order.status.toLowerCase() === 'shipping'
                    ? t('orderDetail.statusShipping', { defaultValue: '배송중' })
                    : ['cancelled', 'refunded'].includes(order.status.toLowerCase())
                    ? t('orderDetail.statusCancelled', { defaultValue: '취소/환불' })
                    : order.status.toLowerCase() === 'preparing'
                    ? t('orderDetail.statusPreparing', { defaultValue: '상품준비중' })
                    : t('orderDetail.statusPaid', { defaultValue: '결제완료' })
                  }
                </Badge>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">
              {t('orderDetail.sectionItemsCount', { count: items.length, defaultValue: `주문 상품 ${items.length}개` })}
            </h4>
            <div className="space-y-3">
              {items.map((item, idx) => {
                const src = item.product_thumbnail || item.image_url
                return (
                  <div key={idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-[#121212] rounded-xl">
                    {src ? (
                      <img
                        src={cfImage(src, { width: 128, height: 128, fit: 'cover' })}
                        alt=""
                        width={56}
                        height={56}
                        loading="lazy"
                        className="w-14 h-14 shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-[#1A1A1A]"
                      />
                    ) : (
                      <div className="w-14 h-14 shrink-0 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-300 dark:text-gray-600" strokeWidth={1.5} aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-gray-900 dark:text-white line-clamp-2">
                        {item.product_name}
                      </p>
                      {item.option_value && (
                        <p className="text-[12px] text-gray-500 dark:text-gray-400">
                          {t('orderDetail.optionLabel', { value: item.option_value, defaultValue: '옵션: {{value}}' })}
                        </p>
                      )}
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">
                          {t('orderDetail.itemQty', { qty: item.quantity, defaultValue: '{{qty}}개' })}
                        </p>
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-white">
                          {/* 🛡️ 2026-06-18: price_snapshot 직접곱(→0원 버그) 대신 lineTotal 헬퍼 */}
                          {formatNumber(orderItemLineTotal(item))}원
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Shipping Info — 🛡️ 2026-06-18: 상품 주문만 (교환권/공구는 배송 없음) */}
          {isProduct && (
          <div>
            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">{t('orderDetail.sectionShipping', { defaultValue: '배송 정보' })}</h4>
            <div className="p-4 bg-gray-50 dark:bg-[#121212] rounded-xl space-y-2 text-[14px]">
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">{t('orderDetail.recipient', { defaultValue: '받는분' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">{order.shipping_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">{t('orderDetail.phone', { defaultValue: '연락처' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">{order.shipping_phone}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 dark:text-gray-400 min-w-[60px]">{t('orderDetail.address', { defaultValue: '주소' })}</span>
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
                  { label: t('orderDetail.stepPaid', { defaultValue: '결제완료' }), done: true },
                  { label: t('orderDetail.stepPrepare', { defaultValue: '상품준비' }), done: ['SHIPPING', 'DELIVERED', 'DONE'].some(s => status?.includes(s)) || !!order.tracking_number },
                  { label: t('orderDetail.stepShipping', { defaultValue: '배송중' }), done: ['SHIPPING'].some(s => status?.includes(s)) || status === 'DELIVERED' },
                  { label: t('orderDetail.stepDelivered', { defaultValue: '배송완료' }), done: status === 'DELIVERED' },
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
                      <div className="flex items-center gap-2">
                        {/* 🛡️ 2026-05-25 (migration 0279): 인앱 추적 모달 — tracker.delivery 무료 API */}
                        <button
                          onClick={() => setShowTracking(true)}
                          className="text-[13px] text-pink-600 dark:text-pink-400 font-medium hover:opacity-60 transition-opacity flex items-center gap-0.5"
                        >
                          📦 {t('orderDetail.trackingDetail', { defaultValue: '상세 추적' })}
                        </button>
                        {getTrackingUrl(order.courier, order.tracking_number) && (
                          <a
                            href={getTrackingUrl(order.courier, order.tracking_number)}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[13px] text-blue-600 font-medium hover:opacity-60 transition-opacity flex items-center gap-0.5"
                          >
                            {t('orderDetail.trackingLink', { defaultValue: '배송조회' })}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
          )}

          {/* Payment Info — 🛡️ 2026-06-18: 하드코딩 3,000원 제거, 실 subtotal/shipping_fee/discount 로 분해 */}
          <div>
            <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">{t('orderDetail.sectionPayment', { defaultValue: '결제 정보' })}</h4>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('orderDetail.productAmount', { defaultValue: '상품 금액' })}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatNumber(productAmount)}원</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('orderDetail.discountAmount', { defaultValue: '할인 금액' })}</span>
                  <span className="font-medium text-rose-600">-{formatNumber(discountAmount)}원</span>
                </div>
              )}
              {isProduct && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('orderDetail.shippingFee', { defaultValue: '배송비' })}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {shippingFee > 0 ? `${formatNumber(shippingFee)}원` : t('orderDetail.freeShipping', { defaultValue: '무료' })}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-[#2A2A2A]">
                <span className="text-gray-900 dark:text-white font-semibold">{t('orderDetail.totalAmount', { defaultValue: '총 결제금액' })}</span>
                <span className="text-[19px] font-bold text-gray-900 dark:text-white">{formatNumber(totalAmount)}원</span>
              </div>
              {order.payment_method && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('orderDetail.paymentMethod', { defaultValue: '결제수단' })}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{order.payment_method}</span>
                </div>
              )}
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
                toast.info(t('orderDetail.sellerPhoneInfo', { phone, defaultValue: '판매자 연락처: {{phone}}' }))
              } else {
                toast.info(t('orderDetail.sellerNoContact', { defaultValue: '판매자 연락처가 등록되지 않았습니다' }))
              }
            }}
            className="w-full py-3 text-[15px] font-medium text-blue-600 border border-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-colors"
          >
            {t('orderDetail.sellerInquiry', { defaultValue: '판매자 문의' })}
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
              {t('orderDetail.writeReview', { defaultValue: '★ 리뷰 작성하기' })}
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
              {t('orderDetail.cancelOrder', { defaultValue: '주문 취소' })}
            </button>
          )}

          {/* 🛡️ 2026-06-18: 구매 내역 삭제(숨김) — 종료 상태 주문만 (진행 중은 추적 손실 방지) */}
          {onHide && ['delivered', 'done', 'cancelled', 'refunded'].includes(order.status.toLowerCase()) && (
            <button
              onClick={() => {
                onClose()
                onHide(order.id, order.order_number ?? String(order.id))
              }}
              className="w-full py-3 text-[14px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {t('orderDetail.hideOrder', { defaultValue: '구매 내역 삭제' })}
            </button>
          )}
        </div>
      </div>
      {/* 🛡️ 2026-05-25 (migration 0279): 인앱 추적 timeline (tracker.delivery) */}
      {showTracking && <TrackingModal orderId={order.id} onClose={() => setShowTracking(false)} />}
    </div>
  )
}
