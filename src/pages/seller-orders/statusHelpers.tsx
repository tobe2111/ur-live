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
      return <Badge className="bg-white text-gray-700 border-rule">{t('seller.statusDone')}</Badge>
    case 'PENDING': case 'AWAITING_PAYMENT':
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{t('seller.statusPending')}</Badge>
    case 'PREPARING':
      return <Badge className="bg-white text-tone-warn border-rule">{t('seller.statusPreparing')}</Badge>
    case 'SHIPPING':
      return <Badge className="bg-white text-gray-700 border-rule">{t('seller.statusShipping')}</Badge>
    case 'DELIVERED':
      return <Badge className="bg-white text-tone-ok border-rule">{t('seller.statusDelivered')}</Badge>
    case 'CANCELLED':
      return <Badge className="bg-white text-tone-bad border-rule">{t('seller.statusCancelled')}</Badge>
    case 'REFUNDED':
      return <Badge className="bg-white text-tone-warn border-rule">{t('common.refunded')}</Badge>
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
