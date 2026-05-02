/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 의 배송지 표시 섹션 추출.
 *
 * 표시만 담당. 변경/선택 클릭 시 부모의 setShowAddressModal 호출.
 */
import { AlertCircle } from 'lucide-react'
import type { ShippingAddress } from './types'

interface Props {
  selectedAddress: ShippingAddress | null
  onOpenAddressModal: () => void
}

export default function ShippingSection({ selectedAddress, onOpenAddressModal }: Props) {
  return (
    <section className="bg-white dark:bg-[#0A0A0A] px-5 py-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">배송지</h2>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenAddressModal() }}
          className="text-[13px] font-medium text-blue-600 active:scale-95"
        >
          {selectedAddress ? '변경' : '선택'}
        </button>
      </div>

      {!selectedAddress ? (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-semibold text-[14px]">⚠️ 배송지를 선택해주세요</p>
              <p className="text-red-700 text-[13px] mt-1">배송지를 선택하셔야 결제가 가능합니다.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-gray-900 dark:text-white">{selectedAddress.recipient_name}</span>
            {selectedAddress.is_default === 1 && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                기본
              </span>
            )}
          </div>
          <p className="text-[14px] leading-relaxed text-gray-400 dark:text-gray-500">{selectedAddress.phone}</p>
          <p className="text-[14px] leading-relaxed text-gray-900 dark:text-white">
            [{selectedAddress.postal_code}] {selectedAddress.address} {selectedAddress.address_detail}
          </p>
        </div>
      )}
    </section>
  )
}
