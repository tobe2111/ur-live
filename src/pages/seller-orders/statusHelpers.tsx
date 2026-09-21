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

/**
 * 💳 **결제 수단** 라벨 — `useStatusText` 와 같은 모양(표·모달이 같은 말을 쓰게).
 *
 * 2026-09-21: 이 자리에 원래 **결제상태**(`orders.payment_status`)가 있었는데 셀러에게 보여 줄 만큼
 * 믿을 수 없다. 라이브 실측에서 결제가 끝난 주문 4건과 취소된 주문 57건이 전부 기본값 `'pending'` 에
 * 머물러 있었다(공구 결제 경로가 그 컬럼을 안 쓴다) → 대표 화면에 `주문상태: 결제완료` 옆에 영문
 * `pending` 이 나란히 떴다. 한국어로 옮기면 **모순을 당당하게** 말하는 셈이라 더 나쁘다.
 * 셀러가 행동할 수 있는 결제 사실은 `주문상태` 가 이미 담고, 여기선 **무엇으로 냈는가**를 보여 준다.
 *
 * ⚠️ 모르는 수단은 **원문 그대로** 돌려준다 — 새 수단이 생겼을 때 아무 라벨이나 붙이면 조용히 거짓말한다.
 */
export function usePaymentMethodText() {
  const { t } = useTranslation()
  return (method: string | null | undefined) => {
    switch (method) {
      case 'toss': case 'card': return t('seller.payCard', { defaultValue: '카드' })
      case 'deal_points': case 'deal': return t('seller.payDeal', { defaultValue: '딜' })
      case 'virtual_account': return t('seller.payVirtualAccount', { defaultValue: '가상계좌' })
      default: return method || '-'
    }
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
