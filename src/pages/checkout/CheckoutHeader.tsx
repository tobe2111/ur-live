/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 의 sticky 헤더 추출 (점진).
 */
import { ArrowLeft } from 'lucide-react'

interface Props {
  onBack: () => void
}

export default function CheckoutHeader({ onBack }: Props) {
  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="mx-auto max-w-md flex items-center justify-between px-3 py-3">
        <button
          onClick={onBack}
          aria-label="장바구니로 돌아가기"
          className="w-9 h-9 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-[15px] font-extrabold text-gray-900">주문 · 결제</h1>
        <div className="w-9" />
      </div>
    </div>
  )
}
