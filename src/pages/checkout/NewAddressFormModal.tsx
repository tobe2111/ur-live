/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 새 배송지 추가 모달.
 *
 * 수령인 / 연락처 / Daum 우편번호 검색 / 주소 / 상세주소 입력 폼.
 */
import { CustomModal } from '@/components/CustomModal'

interface NewAddress {
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  newAddress: NewAddress
  setNewAddress: (a: NewAddress) => void
  showPostcodePopup: boolean
  setShowPostcodePopup: (v: boolean) => void
  onSave: () => void
}

export default function NewAddressFormModal({
  isOpen, onClose, newAddress, setNewAddress, showPostcodePopup, setShowPostcodePopup, onSave,
}: Props) {
  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="새 배송지 추가"
      type="custom"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="checkout-recipient-name" className="block text-[14px] font-semibold text-gray-900 mb-2">
            수령인 이름 <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="checkout-recipient-name"
            type="text"
            required
            aria-required="true"
            value={newAddress.recipient_name}
            onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="받으실 분의 이름을 입력하세요"
          />
        </div>

        <div>
          <label htmlFor="checkout-phone" className="block text-[14px] font-semibold text-gray-900 mb-2">
            연락처 <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="checkout-phone"
            type="tel"
            required
            aria-required="true"
            value={newAddress.phone}
            onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="010-1234-5678"
          />
        </div>

        <div>
          <label htmlFor="checkout-postal-code" className="block text-[14px] font-semibold text-gray-900 mb-2">
            우편번호 <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="checkout-postal-code"
              type="text"
              inputMode="numeric"
              required
              aria-required="true"
              value={newAddress.postal_code}
              readOnly
              className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-[15px] text-gray-600"
              placeholder="우편번호"
            />
            <button
              type="button"
              onClick={() => setShowPostcodePopup(true)}
              className="px-5 py-3 border border-gray-200 rounded-2xl text-[14px] font-semibold text-gray-500 hover:bg-gray-50 transition-all whitespace-nowrap"
            >
              주소 검색
            </button>
          </div>
        </div>

        {showPostcodePopup && (
          <div className="rounded-2xl overflow-hidden border border-gray-200">
            <div id="daum-postcode-container" style={{ width: '100%', height: '400px' }} />
          </div>
        )}

        <div>
          <label htmlFor="checkout-address" className="block text-[14px] font-semibold text-gray-900 mb-2">
            주소 <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="checkout-address"
            type="text"
            required
            aria-required="true"
            value={newAddress.address}
            readOnly
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-[15px] text-gray-600"
            placeholder="주소 검색 후 자동 입력됩니다"
          />
        </div>

        <div>
          <label htmlFor="checkout-address-detail" className="block text-[14px] font-semibold text-gray-900 mb-2">
            상세주소
          </label>
          <input
            id="checkout-address-detail"
            type="text"
            value={newAddress.address_detail}
            onChange={(e) => setNewAddress({ ...newAddress, address_detail: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="동/호수, 건물명 등 (선택)"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSave()
            }}
            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[16px] font-bold hover:bg-blue-700 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
          >
            저장
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl text-[16px] font-bold hover:bg-gray-100 transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
          >
            취소
          </button>
        </div>
      </div>
    </CustomModal>
  )
}
