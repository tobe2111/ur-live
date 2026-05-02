/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 배송지 선택 모달.
 *
 * 등록된 배송지 리스트 + 새 배송지 추가 버튼.
 */
import { MapPin, Plus } from 'lucide-react'
import { CustomModal } from '@/components/CustomModal'
import type { ShippingAddress } from './types'

interface Props {
  isOpen: boolean
  onClose: () => void
  addresses: ShippingAddress[]
  selectedAddress: ShippingAddress | null
  onSelectAddress: (addr: ShippingAddress) => void
  onAddNewAddress: () => void
}

export default function AddressListModal({
  isOpen, onClose, addresses, selectedAddress, onSelectAddress, onAddNewAddress,
}: Props) {
  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="배송지 선택"
      type="custom"
      maxWidth="lg"
    >
      <div className="space-y-2">
        {addresses.length === 0 ? (
          <div className="py-12 text-center">
            <MapPin className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-[15px] text-gray-500 dark:text-gray-400">등록된 배송지가 없습니다.</p>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1">새 배송지를 추가해주세요.</p>
          </div>
        ) : (
          addresses.map((addr) => {
            const isSelected = selectedAddress?.id === addr.id
            return (
              <div
                key={addr.id}
                className={`relative rounded-xl p-4 cursor-pointer transition-all active:scale-[0.99] ${
                  isSelected
                    ? 'bg-gray-50 dark:bg-[#121212] ring-1 ring-gray-900'
                    : 'bg-white dark:bg-[#0A0A0A] border border-gray-100 dark:border-[#1A1A1A] hover:bg-gray-50 dark:bg-[#121212]'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectAddress(addr)
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[15px] font-bold text-gray-900 dark:text-white">{addr.recipient_name}</p>
                  <span className="text-[13px] text-gray-400 dark:text-gray-500">{addr.phone}</span>
                  {addr.is_default === 1 && (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">기본 배송지</span>
                  )}
                  {isSelected && (
                    <svg className="w-4 h-4 text-gray-900 dark:text-white ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  [{addr.postal_code}] {addr.address}{addr.address_detail ? ` ${addr.address_detail}` : ''}
                </p>
              </div>
            )
          })
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddNewAddress()
          }}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 dark:border-[#3A3A3A] py-3.5 text-[14px] font-medium text-gray-500 dark:text-gray-400 transition-all hover:bg-gray-50 dark:bg-[#121212] cursor-pointer active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          새 배송지 추가
        </button>
      </div>
    </CustomModal>
  )
}
