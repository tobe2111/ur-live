/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerOrdersPage 주문 상세 모달.
 *   상태 변경 + 송장 등록 폼 포함. helpers 는 ./statusHelpers 에서 import.
 */
import { useTranslation } from 'react-i18next'
import { XCircle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatKST } from '@/utils/date'
import { formatNumber } from '@/utils/format'
import { StatusBadge, useStatusText, nextStatusOf, parseShippingAddress } from './statusHelpers'
import type { Order, TrackingForm } from './types'

interface Props {
  order: Order
  updating: boolean
  trackingForm: TrackingForm
  onTrackingFormChange: (next: TrackingForm) => void
  onClose: () => void
  onStatusChange: (orderNumber: string, nextStatus: string) => void
  onTrackingSubmit: (e: React.FormEvent, orderNumber: string) => void
}

const COURIERS = [
  'CJ대한통운', '로젠택배', '옐로우캡', '우체국택배', '한진택배', '롯데택배', '드림택배',
  'KGB택배', '대신택배', '일양로지스', '경동택배', '천일택배', '합동택배',
  'CVSnet편의점택배', '우편발송', 'GTX로지스', '건영택배',
  'EMS', 'DHL', 'FedEx', 'UPS', 'USPS',
]

export default function OrderDetailModal({ order, updating, trackingForm, onTrackingFormChange, onClose, onStatusChange, onTrackingSubmit }: Props) {
  const { t } = useTranslation()
  const statusText = useStatusText()
  const next = nextStatusOf(order.status)
  const addr = parseShippingAddress(order.shipping_address)
  const formatPrice = (price: number) => formatNumber(price)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Modal Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('seller.orderDetail')}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Order Info */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('seller.orderInfoSection')}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.orderNumberHeader')}</p>
                  <p className="font-mono font-medium">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.orderDateHeader')}</p>
                  <p className="font-medium">
                    {formatKST(order.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.orderStatusHeader')}</p>
                  <div><StatusBadge status={order.status} /></div>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.paymentStatusHeader')}</p>
                  <div>
                    <Badge className={order.payment_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-800 dark:text-gray-100'}>
                      {order.payment_status === 'completed' ? t('seller.statusDone') : order.payment_status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('seller.shippingInfoSection')}</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.recipient')}</p>
                  <p className="font-medium">{order.shipping_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.contactNumber')}</p>
                  <p className="font-medium">{order.shipping_phone}</p>
                </div>
                {addr.postal_code && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.postalCode')}</p>
                  <p className="font-medium">{addr.postal_code}</p>
                </div>
                )}
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.addressField')}</p>
                  <p className="font-medium">{addr.address1}{addr.address2 ? ` ${addr.address2}` : ''}</p>
                </div>
                {order.courier && order.tracking_number && (
                  <>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.courierLabel')}</p>
                      <p className="font-medium">{order.courier}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 mb-1">{t('seller.trackingNumberLabel')}</p>
                      <p className="font-mono font-medium">{order.tracking_number}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Order Items */}
            {order.items && order.items.length > 0 && (
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('seller.orderProductsSection')}</h3>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-[#121212] rounded-lg">
                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-200 dark:bg-[#2A2A2A] rounded-lg flex-shrink-0 overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/64?text=No+Image'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                            No Image
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{item.product_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('seller.quantityLabel')}: {item.quantity}{t('common.count')}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                          {formatPrice(item.price * item.quantity)}{t('common.won')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amount Info */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('seller.paymentInfoSection')}</h3>
              <div className="bg-gray-50 dark:bg-[#121212] rounded-lg p-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>{t('seller.totalOrderAmount')}</span>
                  <span className="text-blue-600">{formatPrice(order.total_amount)}{t('common.won')}</span>
                </div>
              </div>
            </div>

            {/* Status Change */}
            {next && (
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('seller.statusChangeSection')}</h3>
                <Button
                  onClick={() => onStatusChange(order.order_number, next)}
                  disabled={updating}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('seller.processingStatus')}
                    </span>
                  ) : (
                    t('seller.changeStatusTo', { status: statusText(next) })
                  )}
                </Button>
              </div>
            )}

            {/* Tracking Number Form */}
            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('seller.shippingInfoInput')}</h3>
                <form onSubmit={(e) => onTrackingSubmit(e, order.order_number)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t('seller.courierLabel')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={trackingForm.courier}
                      onChange={(e) => onTrackingFormChange({ ...trackingForm, courier: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-[#3A3A3A] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[#0A0A0A]"
                    >
                      <option value="">{t('seller.selectCourier')}</option>
                      {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      {t('seller.trackingNumberLabel')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={trackingForm.tracking_number}
                      onChange={(e) => onTrackingFormChange({ ...trackingForm, tracking_number: e.target.value })}
                      placeholder={t('seller.trackingNumberPlaceholder')}
                      required
                      className="w-full px-4 py-2 border border-gray-300 dark:border-[#3A3A3A] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={updating}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {updating ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('seller.registeringTracking')}
                      </span>
                    ) : (
                      t('seller.registerTracking')
                    )}
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="mt-6 pt-4 border-t">
            <Button
              onClick={onClose}
              className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white"
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
