/**
 * 🚚 장바구니 셀러 그룹의 수령/배송비 한 줄.
 *
 * 2026-09-01 CartPage 에서 추출 — 여기가 대표 지적(*"이용권은 배송비도 없는데?"*)의 표시부다.
 * 교환권은 휴대폰으로 오고(발송), 이용권은 아무것도 오지 않는다(매장에서 쓴다).
 * 배송비가 0 이라는 결론은 같지만 **문구가 다르다** — 판정은 SSOT(`getNoShippingKind`)가 한다.
 */
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'
import { getNoShippingKind } from '@/shared/product-flow'
import type { CartItem } from '@/types/cart'

interface Props {
  items: CartItem[]
  subtotal: number
  shippingFee: number
  freeShipThreshold: number
  /** 그룹 전체가 비배송인가 — 부모가 이미 계산한 값(무료배송 바 게이트와 같은 값). */
  noShipping: boolean
}

export function CartGroupShippingRow({ items, subtotal, shippingFee, freeShipThreshold, noShipping }: Props) {
  const { t } = useTranslation()
  const allDeal = noShipping && items.every((i) => getNoShippingKind(i) === 'deal')

  return (
    <div className="mx-4 mb-3 pt-3 border-t border-gray-100 dark:border-[#2C2F35] flex justify-between text-[12px]">
      <span className="text-gray-400 dark:text-gray-500">{noShipping ? '수령' : t('cart.shippingFee')}</span>
      <span className="font-medium text-gray-700 dark:text-gray-200">
        {noShipping
          ? <span className="text-gray-600 dark:text-gray-300">{allDeal ? '휴대폰 즉시 발송 (무료)' : '매장에서 사용 (배송 없음)'}</span>
          : freeShipThreshold > 0 && subtotal >= freeShipThreshold
            ? <span className="text-pink-500">{t('cart.free')}</span>
            : `${formatNumber(shippingFee)}원`}
      </span>
    </div>
  )
}
