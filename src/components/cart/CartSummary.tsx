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
  const formatNumber = (n: number): string => {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="font-bold text-lg text-gray-900 mb-4">결제 금액</h3>
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">상품금액 ({totalItems}개)</span>
        <span className="font-medium">{formatNumber(subtotal)}원</span>
      </div>
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">배송비</span>
        <span className="font-medium">
          {shippingFee === 0 ? '무료' : `${formatNumber(shippingFee)}원`}
        </span>
      </div>
      
      {subtotal < 100000 && subtotal > 0 && (
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
          💡 {formatNumber(100000 - subtotal)}원 더 담으면 무료배송!
        </p>
      )}
      
      <div className="h-px bg-gray-200 my-3" />
      
      <div className="flex justify-between items-center">
        <span className="font-bold text-gray-900">총 결제금액</span>
        <span className="text-2xl font-bold text-blue-600">
          {formatNumber(total)}원
        </span>
      </div>
    </div>
  )
})
