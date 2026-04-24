import { useEffect } from 'react'
import { AlertCircle, MapPin, Plus } from 'lucide-react'
import { CustomModal } from '@/components/CustomModal'
import { ShippingAddress, NewAddressForm } from './checkout-types'

// ─── Selected Address Display ───────────────────────────────────────────────

interface SelectedAddressDisplayProps {
  selectedAddress: ShippingAddress | null
  onChangeClick: () => void
}

export function SelectedAddressDisplay({ selectedAddress, onChangeClick }: SelectedAddressDisplayProps) {
  return (
    <section className="bg-white px-5 py-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-gray-900">배송지</h2>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChangeClick() }}
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
            <span className="text-[15px] font-semibold text-gray-900">{selectedAddress.recipient_name}</span>
            {selectedAddress.is_default === 1 && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                기본
              </span>
            )}
          </div>
          <p className="text-[14px] leading-relaxed text-gray-400">{selectedAddress.phone}</p>
          <p className="text-[14px] leading-relaxed text-gray-900">
            [{selectedAddress.postal_code}] {selectedAddress.address} {selectedAddress.address_detail}
          </p>
        </div>
      )}
    </section>
  )
}

// ─── Address Select Modal ────────────────────────────────────────────────────

interface AddressSelectModalProps {
  isOpen: boolean
  addresses: ShippingAddress[]
  selectedAddress: ShippingAddress | null
  onClose: () => void
  onSelect: (addr: ShippingAddress) => void
  onAddNew: () => void
}

export function AddressSelectModal({
  isOpen,
  addresses,
  selectedAddress,
  onClose,
  onSelect,
  onAddNew,
}: AddressSelectModalProps) {
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
            <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-[15px] text-gray-500">등록된 배송지가 없습니다.</p>
            <p className="text-[13px] text-gray-400 mt-1">새 배송지를 추가해주세요.</p>
          </div>
        ) : (
          addresses.map((addr) => {
            const isSelected = selectedAddress?.id === addr.id
            return (
              <div
                key={addr.id}
                className={`relative rounded-xl p-4 cursor-pointer transition-all active:scale-[0.99] ${
                  isSelected
                    ? 'bg-gray-50 ring-1 ring-gray-900'
                    : 'bg-white border border-gray-100 hover:bg-gray-50'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(addr)
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[15px] font-bold text-gray-900">{addr.recipient_name}</p>
                  <span className="text-[13px] text-gray-400">{addr.phone}</span>
                  {addr.is_default === 1 && (
                    <span className="text-[11px] text-gray-500 font-medium">기본 배송지</span>
                  )}
                  {isSelected && (
                    <svg className="w-4 h-4 text-gray-900 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <p className="text-[13px] text-gray-500 leading-relaxed">
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
            onAddNew()
          }}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-3.5 text-[14px] font-medium text-gray-500 transition-all hover:bg-gray-50 cursor-pointer active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          새 배송지 추가
        </button>
      </div>
    </CustomModal>
  )
}

// ─── New Address Form Modal ──────────────────────────────────────────────────

interface NewAddressFormModalProps {
  isOpen: boolean
  newAddress: NewAddressForm
  showPostcodePopup: boolean
  onClose: () => void
  onChangeField: (field: keyof NewAddressForm, value: string | number) => void
  onOpenPostcode: () => void
  onSave: () => void
}

export function NewAddressFormModal({
  isOpen,
  newAddress,
  showPostcodePopup,
  onClose,
  onChangeField,
  onOpenPostcode,
  onSave,
}: NewAddressFormModalProps) {
  // Daum 우편번호 팝업 연동
  useEffect(() => {
    if (showPostcodePopup && window.daum && window.daum.Postcode) {
      const container = document.getElementById('daum-postcode-container')
      if (!container) return

      new window.daum.Postcode({
        oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => {
          onChangeField('postal_code', data.zonecode)
          onChangeField('address', data.roadAddress || data.jibunAddress)
        },
        width: '100%',
        height: '100%'
      }).embed(container)
    }
  }, [showPostcodePopup])

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
          <label className="block text-[14px] font-semibold text-gray-900 mb-2">
            수령인 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newAddress.recipient_name}
            onChange={(e) => onChangeField('recipient_name', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="받으실 분의 이름을 입력하세요"
          />
        </div>

        <div>
          <label className="block text-[14px] font-semibold text-gray-900 mb-2">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={newAddress.phone}
            onChange={(e) => onChangeField('phone', e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="010-1234-5678"
          />
        </div>

        <div>
          <label className="block text-[14px] font-semibold text-gray-900 mb-2">
            우편번호 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={newAddress.postal_code}
              readOnly
              className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-[15px] text-gray-600"
              placeholder="우편번호"
            />
            <button
              onClick={onOpenPostcode}
              className="px-5 py-3 border border-gray-200 rounded-2xl text-[14px] font-semibold text-gray-500 hover:bg-gray-50 transition-all whitespace-nowrap"
            >
              주소 검색
            </button>
          </div>
        </div>

        {showPostcodePopup && (
          <div className="rounded-2xl overflow-hidden border border-gray-200">
            <div
              id="daum-postcode-container"
              style={{ width: '100%', height: '400px' }}
            ></div>
          </div>
        )}

        <div>
          <label className="block text-[14px] font-semibold text-gray-900 mb-2">
            주소 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newAddress.address}
            readOnly
            className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-[15px] text-gray-600"
            placeholder="주소 검색 후 자동 입력됩니다"
          />
        </div>

        <div>
          <label className="block text-[14px] font-semibold text-gray-900 mb-2">
            상세주소
          </label>
          <input
            type="text"
            value={newAddress.address_detail}
            onChange={(e) => onChangeField('address_detail', e.target.value)}
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
