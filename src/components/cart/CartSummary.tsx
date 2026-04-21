import React from 'react'

interface CartSummaryProps {
  totalItems: number
  subtotal: number
  shippingFee: number
  total: number
}

export const CartSummary = React.memo(function CartSummary({
  totalItems,
  subtotal,
  shippingFee,
  total
}: CartSummaryProps) {
  const fmt = (n: number) => n.toLocaleString()

  return (
    <div>
      {/* Subtotal / shipping / discount rows */}
      <div className="space-y-2.5">
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-500">상품금액 ({totalItems}개)</span>
          <span className="text-gray-900 font-medium">{fmt(subtotal)}원</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-500">배송비</span>
          <span className="text-gray-900 font-medium">
            {shippingFee === 0 ? (
              <span className="text-pink-500 font-semibold">무료</span>
            ) : (
              `+${fmt(shippingFee)}원`
            )}
          </span>
        </div>
      </div>

      {/* Dashed border divider */}
      <div className="my-3 border-t border-dashed border-gray-200" />

      {/* v4 결제예정금액 (18px bold) */}
      <div className="flex justify-between items-baseline">
        <span className="text-[14px] font-bold text-gray-900">결제예정금액</span>
        <span className="text-[18px] font-bold text-gray-900">{fmt(total)}원</span>
      </div>
    </div>
  )
})
