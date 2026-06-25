/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerOrdersPage 주문 상태 변환/렌더 헬퍼.
 *   getStatusText / StatusBadge 는 i18n 의존이라 컴포넌트화. nextStatusOf 는 pure.
 */
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'

export function useStatusText() {
  const { t } = useTranslation()
  return (status: string) => {
    switch (status) {
      case 'PAY_COMPLETE': case 'PAID': case 'DONE': return t('seller.statusDone')
      case 'PENDING': case 'AWAITING_PAYMENT': return t('seller.statusPending')
      case 'PREPARING': return t('seller.statusPreparing')
      case 'SHIPPING': return t('seller.statusShipping')
      case 'DELIVERED': return t('seller.statusDelivered')
      case 'CANCELLED': return t('seller.statusCancelled')
      case 'REFUNDED': return t('common.refunded')
      case 'FAILED': return status
      default: return status
    }
  }
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  switch (status) {
    case 'PAY_COMPLETE': case 'PAID': case 'DONE':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">{t('seller.statusDone')}</Badge>
    case 'PENDING': case 'AWAITING_PAYMENT':
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{t('seller.statusPending')}</Badge>
    case 'PREPARING':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">{t('seller.statusPreparing')}</Badge>
    case 'SHIPPING':
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200">{t('seller.statusShipping')}</Badge>
    case 'DELIVERED':
      return <Badge className="bg-green-100 text-green-800 border-green-200">{t('seller.statusDelivered')}</Badge>
    case 'CANCELLED':
      return <Badge className="bg-red-100 text-red-800 border-red-200">{t('seller.statusCancelled')}</Badge>
    case 'REFUNDED':
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">{t('common.refunded')}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export function nextStatusOf(currentStatus: string): string | null {
  switch (currentStatus) {
    case 'PAY_COMPLETE': case 'PAID': case 'DONE': return 'PREPARING'
    case 'PREPARING': return 'SHIPPING'
    case 'SHIPPING': return 'DELIVERED'
    default: return null
  }
}

export function parseShippingAddress(address: string, detail?: string): { postal_code: string; address1: string; address2: string } {
  if (!address) return { postal_code: '', address1: '', address2: detail || '' }
  try {
    const parsed = JSON.parse(address)
    return {
      postal_code: parsed.postal_code || parsed.zipcode || '',
      address1: parsed.address1 || parsed.address || '',
      address2: parsed.address2 || parsed.detail || detail || '',
    }
  } catch {
    return { postal_code: '', address1: address, address2: detail || '' }
  }
}
