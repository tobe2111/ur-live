/**
 * CheckoutAddressSection — 배송지 선택 + 새 배송지 추가 모달까지 포함한 복합 컴포넌트.
 *
 * CheckoutPage에서 분리 (TD-018 final pass):
 *   - 배송지 목록 로드 (useEffect)
 *   - 새 배송지 form 상태 (newAddress, showPostcodePopup, showNewAddressForm)
 *   - Daum Postcode 이펙트
 *   - 저장 핸들러 (handleSaveNewAddress)
 *
 * Props:
 *   - userId, navigate → CheckoutPage 에서 주입 (redirect + API userId)
 *   - selectedAddress / onAddressSelected → 부모가 결제에 사용
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { handleApiError } from '@/lib/errorHandler'
import { toast } from '@/hooks/useToast'
import type { ShippingAddress } from './types'
import ShippingSection from './ShippingSection'
import AddressListModal from './AddressListModal'
import NewAddressFormModal from './NewAddressFormModal'

// Daum Postcode API type (global window.daum)
declare global {
  interface Window {
    daum: {
      Postcode: new (options: Record<string, unknown>) => {
        embed: (el: HTMLElement | null) => void
        open: () => void
      }
    }
  }
}

interface Props {
  userId: string | null
  navigateToLogin: () => void
  selectedAddress: ShippingAddress | null
  onAddressSelected: (addr: ShippingAddress | null) => void
  /** Called after first address load so parent can set initial selection */
  onAddressesLoaded?: (addresses: ShippingAddress[]) => void
}

export default function CheckoutAddressSection({
  userId,
  navigateToLogin,
  selectedAddress,
  onAddressSelected,
  onAddressesLoaded,
}: Props) {
  const { t } = useTranslation()

  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  const [showPostcodePopup, setShowPostcodePopup] = useState(false)
  const [newAddress, setNewAddress] = useState({
    recipient_name: '',
    phone: '',
    postal_code: '',
    address: '',
    address_detail: '',
    is_default: 0,
  })

  // 배송지 목록 로드
  useEffect(() => {
    api.get('/api/shipping-addresses')
      .then(r => {
        if (r.data.success) {
          const list: ShippingAddress[] = r.data.data
          setAddresses(list)
          onAddressesLoaded?.(list)
          if (!selectedAddress) {
            const def = list.find(a => a.is_default === 1)
            if (def) onAddressSelected(def)
          }
        }
      })
      .catch(err => {
        if (import.meta.env.DEV) console.warn('[CheckoutAddressSection] 배송지 로드 실패:', err)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Daum 우편번호 팝업
  useEffect(() => {
    if (!showPostcodePopup) return
    if (!window.daum?.Postcode) return
    const container = document.getElementById('daum-postcode-container')
    if (!container) return
    new window.daum.Postcode({
      oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => {
        setNewAddress(prev => ({
          ...prev,
          postal_code: data.zonecode,
          address: data.roadAddress || data.jibunAddress,
        }))
        setShowPostcodePopup(false)
      },
      width: '100%',
      height: '100%',
    }).embed(container)
  }, [showPostcodePopup])

  const handleSaveNewAddress = async () => {
    if (!userId) {
      toast.info(t('common.loginRequired'))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigateToLogin()
      return
    }
    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.postal_code || !newAddress.address) {
      toast.error(t('common.requiredFields'))
      return
    }
    const phoneClean = newAddress.phone.replace(/[^0-9]/g, '')
    if (phoneClean.length < 10 || phoneClean.length > 11) {
      toast.error(t('common.invalidPhone'))
      return
    }
    try {
      const isFirstAddress = addresses.length === 0
      const response = await api.post('/api/shipping-addresses', {
        user_id: userId,
        ...newAddress,
        is_default: isFirstAddress ? 1 : 0,
      })
      if (response.data.success) {
        const savedAddress: ShippingAddress = { ...newAddress, id: response.data.data.id }
        setAddresses(prev => [...prev, savedAddress])
        onAddressSelected(savedAddress)
        setShowNewAddressForm(false)
        setShowAddressModal(false)
        setNewAddress({ recipient_name: '', phone: '', postal_code: '', address: '', address_detail: '', is_default: 0 })
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[CheckoutAddressSection] 배송지 저장 실패:', err)
      handleApiError(err)
    }
  }

  return (
    <>
      <ShippingSection
        selectedAddress={selectedAddress}
        onOpenAddressModal={() => setShowAddressModal(true)}
      />

      <AddressListModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        addresses={addresses}
        selectedAddress={selectedAddress}
        onSelectAddress={(addr) => {
          onAddressSelected(addr)
          setShowAddressModal(false)
        }}
        onAddNewAddress={() => {
          setShowAddressModal(false)
          setTimeout(() => setShowNewAddressForm(true), 100)
        }}
      />

      <NewAddressFormModal
        isOpen={showNewAddressForm}
        onClose={() => {
          setShowNewAddressForm(false)
          setShowPostcodePopup(false)
        }}
        newAddress={{
          recipient_name: newAddress.recipient_name,
          phone: newAddress.phone,
          postal_code: newAddress.postal_code,
          address: newAddress.address,
          address_detail: newAddress.address_detail,
        }}
        setNewAddress={(addr) => setNewAddress(prev => ({ ...prev, ...addr }))}
        showPostcodePopup={showPostcodePopup}
        setShowPostcodePopup={setShowPostcodePopup}
        onSave={handleSaveNewAddress}
      />
    </>
  )
}
