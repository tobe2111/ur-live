import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, AlertTriangle, ShoppingBag, CreditCard } from 'lucide-react'
import { getSellerId } from '@/lib/seller-auth'

interface Props {
  followerCount: number
  stockAlertCount: number
  pendingOrders: number
  pendingSettlement: number
  fmtShort: (n: number) => string
}

/**
 * 알림 그리드 — 팔로워 / 재고 / 미처리 주문 / 정산 예정.
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function AlertsGrid({
  followerCount, stockAlertCount, pendingOrders, pendingSettlement, fmtShort
}: Props) {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('seller.alerts')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Link
          to={`/profile/${localStorage.getItem('seller_username') || getSellerId()}`}
          className="bg-pink-50 rounded-xl p-3 text-center hover:bg-pink-100 transition-colors block"
        >
          <Users className="w-5 h-5 text-pink-600 mx-auto mb-1.5" />
          <p className="text-lg font-bold text-gray-900">{followerCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('seller.followers')}</p>
        </Link>
        <Link
          to="/seller/products"
          className="bg-amber-50 rounded-xl p-3 text-center hover:bg-amber-100 transition-colors block"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
          <p className="text-lg font-bold text-gray-900">{stockAlertCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('seller.lowStock')}</p>
        </Link>
        <Link
          to="/seller/orders"
          className="bg-blue-50 rounded-xl p-3 text-center hover:bg-blue-100 transition-colors block"
        >
          <ShoppingBag className="w-5 h-5 text-blue-600 mx-auto mb-1.5" />
          <p className="text-lg font-bold text-gray-900">{pendingOrders}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('seller.pendingOrdersAlert')}</p>
        </Link>
        <Link
          to="/seller/settlements"
          className="bg-green-50 rounded-xl p-3 text-center hover:bg-green-100 transition-colors block"
        >
          <CreditCard className="w-5 h-5 text-green-600 mx-auto mb-1.5" />
          <p className="text-lg font-bold text-gray-900">{fmtShort(pendingSettlement)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('seller.expectedSettlement')}</p>
        </Link>
      </div>
    </div>
  )
}
