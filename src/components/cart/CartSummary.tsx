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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="space-y-2">
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-500">상품금액 ({totalItems}개)</span>
          <span className="text-gray-700 font-medium">{fmt(subtotal)}원</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-500">배송비</span>
          <span className="text-gray-700 font-medium">
            {shippingFee === 0 ? '무료' : `${fmt(shippingFee)}원`}
          </span>
        </div>
      </div>

      {subtotal < 100000 && subtotal > 0 && (
        <p className="text-[12px] text-gray-500 bg-gray-50 p-2 rounded-lg mt-3">
          {fmt(100000 - subtotal)}원 더 담으면 무료배송
        </p>
      )}

      <div className="h-px bg-gray-200 my-3" />

      <div className="flex justify-between items-baseline">
        <span className="text-[14px] font-bold text-gray-900">총 결제금액</span>
        <div className="flex items-baseline gap-0.5">
          <span className="text-[20px] font-bold text-gray-900">{fmt(total)}</span>
          <span className="text-[14px] font-medium text-gray-900">원</span>
        </div>
      </div>
    </div>
  )
})
