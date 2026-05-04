import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
} from 'lucide-react'
import { getUserIdSync } from '@/utils/auth'
import { CustomModal } from '@/components/CustomModal'
import { toast } from '@/hooks/useToast'

type EntryMethod = 'free' | 'password' | 'intercom' | 'pickup_box'

interface ShippingAddress {
  id: number
  user_id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
  label?: string | null
  delivery_note?: string | null
  entry_code?: string | null
  entry_method?: EntryMethod | null
  created_at: string
  updated_at: string
}

const EMPTY_FORM = {
  recipient_name: '',
  phone: '',
  postal_code: '',
  address: '',
  address_detail: '',
  is_default: false,
  label: '',
  delivery_note: '',
  entry_code: '',
  entry_method: 'free' as EntryMethod,
}

export default function AddressManagementPage() {
  const { t } = useTranslation()
  const ENTRY_METHOD_OPTIONS: { value: EntryMethod; label: string }[] = [
    { value: 'free',       label: t('address.entryFree') },
    { value: 'password',   label: t('address.entryPassword') },
    { value: 'intercom',   label: t('address.entryIntercom') },
    { value: 'pickup_box', label: t('address.entryPickupBox') },
  ]

  const DELIVERY_NOTE_PRESETS = [
    t('address.msgPresetDoor'),
    t('address.msgPresetGuard'),
    t('address.msgPresetCall'),
    t('address.msgPresetFragile'),
  ]
  const navigate = useNavigate()
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPostcodePopup, setShowPostcodePopup] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => {
    // ✅ UX C4 FIX: getUserId()는 Promise를 반환 (truthy check always passes).
    // 동기 체크를 위해 getUserIdSync() 사용.
    const userId = getUserIdSync()
    if (!userId) {
      toast.info(t('address.loginRequired'))
      navigate('/login')
      return
    }
    loadAddresses()
  }, [navigate])

  // ✅ UX H15 FIX: Daum Postcode SDK 1회만 로드 (JSX <script> 중복 등록 방지)
  useEffect(() => {
    const DAUM_SRC = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    if (document.querySelector(`script[src="${DAUM_SRC}"]`)) return
    const s = document.createElement('script')
    s.src = DAUM_SRC
    s.async = true
    document.head.appendChild(s)
    return () => {
      s.remove()
    }
  }, [])

  // Daum 우편번호 팝업 — 모달 내 embedded 방식
  useEffect(() => {
    if (!showPostcodePopup) return
    const timer = setTimeout(() => {
      const container = document.getElementById('daum-postcode-container')
      if (!container) return
      new (window as unknown as { daum: { Postcode: new (opts: Record<string, unknown>) => { embed: (el: HTMLElement) => void } } }).daum.Postcode({
        oncomplete: (data: { zonecode: string; roadAddress?: string; jibunAddress?: string }) => {
          setFormData(prev => ({
            ...prev,
            postal_code: data.zonecode,
            address: data.roadAddress || data.jibunAddress || ''
          }))
          setShowPostcodePopup(false)
        },
        width: '100%',
        height: '400px',
      }).embed(container)
    }, 100)
    return () => clearTimeout(timer)
  }, [showPostcodePopup])

  async function loadAddresses() {
    try {
      const response = await api.get('/api/shipping-addresses')
      if (response.data.success) {
        setAddresses(response.data.data || [])
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to load addresses:', error)
      toast.error(t('address.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAddress() {
    if (!formData.recipient_name || !formData.phone || !formData.address) {
      toast.error(t('address.requiredFields'))
      return
    }

    try {
      if (editingId) {
        await api.put(`/api/shipping-addresses/${editingId}`, {
          ...formData,
          is_default: formData.is_default ? 1 : 0
        })
      } else {
        await api.post('/api/shipping-addresses', {
          ...formData,
          is_default: addresses.length === 0 ? 1 : (formData.is_default ? 1 : 0)
        })
      }
      closeForm()
      loadAddresses()
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to save address:', error)
      toast.error(t('address.saveFailed'))
    }
  }

  async function handleDeleteAddress(id: number) {
    if (!confirm(t('address.deleteConfirm'))) return
    try {
      await api.delete(`/api/shipping-addresses/${id}`)
      loadAddresses()
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to delete address:', error)
      toast.error(t('address.deleteFailed'))
    }
  }

  async function handleSetDefault(id: number) {
    try {
      const address = addresses.find(a => a.id === id)
      if (!address) return
      await api.put(`/api/shipping-addresses/${id}`, { ...address, is_default: 1 })
      loadAddresses()
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to set default:', error)
      toast.error(t('address.setDefaultFailed'))
    }
  }

  function openAddForm() {
    setFormData({ ...EMPTY_FORM, is_default: addresses.length === 0 })
    setEditingId(null)
    setShowPostcodePopup(false)
    setShowForm(true)
  }

  function openEditForm(address: ShippingAddress) {
    setFormData({
      recipient_name: address.recipient_name,
      phone: address.phone,
      postal_code: address.postal_code,
      address: address.address,
      address_detail: address.address_detail,
      is_default: address.is_default === 1,
      label: address.label ?? '',
      delivery_note: address.delivery_note ?? '',
      entry_code: address.entry_code ?? '',
      entry_method: (address.entry_method as EntryMethod) ?? 'free',
    })
    setEditingId(address.id)
    setShowPostcodePopup(false)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setShowPostcodePopup(false)
    setEditingId(null)
    setFormData(EMPTY_FORM)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-20">
      <SEO title={t('address.seoTitle')} description={t('address.seoDesc')} url="/mypage/addresses" noindex />
      {/* ✅ UX H15 FIX: Daum Postcode script는 useEffect에서 1회만 로드 */}

      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-5 lg:px-8 py-3">
          <button onClick={() => navigate(-1)} aria-label={t('address.back')} className="text-gray-900 dark:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-gray-900 dark:text-white font-bold text-[15px]">{t('address.title')}</h1>
          <div className="w-6" />
        </div>
      </div>

      <main className="ur-content-narrow px-4 lg:px-8 py-6">
        {/* 새 배송지 추가 버튼 */}
        <button
          onClick={openAddForm}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#121212] py-4 text-[15px] font-semibold text-gray-500 dark:text-gray-400 transition-all hover:border-pink-500/50 hover:text-pink-500 mb-5 active:scale-[0.98] touch-manipulation"
        >
          <Plus className="w-5 h-5" />
          <span>{t('address.addNew')}</span>
        </button>

        {/* 배송지 목록 */}
        {addresses.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-[15px] text-gray-900 dark:text-white">{t('address.empty')}</p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">{t('address.emptySub')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`border rounded-2xl p-4 transition-all ${
                  address.is_default === 1
                    ? 'border-pink-500/40 bg-pink-50/30'
                    : 'border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {address.label && (
                        <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-bold text-white">
                          {address.label}
                        </span>
                      )}
                      <p className="text-[15px] font-semibold text-gray-900 dark:text-white">{address.recipient_name}</p>
                      {address.is_default === 1 && (
                        <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-semibold text-pink-500">
                          기본
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-1">{address.phone}</p>
                    <p className="text-[14px] text-gray-700 dark:text-gray-200 leading-relaxed">
                      [{address.postal_code}] {address.address}
                    </p>
                    {address.address_detail && (
                      <p className="text-[14px] text-gray-700 dark:text-gray-200 leading-relaxed mt-0.5">
                        {address.address_detail}
                      </p>
                    )}
                    {(address.delivery_note || address.entry_method === 'password' || address.entry_method === 'intercom' || address.entry_method === 'pickup_box') && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-[#1A1A1A] space-y-0.5">
                        {address.entry_method && address.entry_method !== 'free' && (
                          <p className="text-[12px] text-gray-500 dark:text-gray-400">
                            <span className="font-semibold text-gray-700 dark:text-gray-200">출입 · </span>
                            {ENTRY_METHOD_OPTIONS.find(o => o.value === address.entry_method)?.label}
                            {address.entry_method === 'password' && address.entry_code && (
                              <span className="text-gray-400 dark:text-gray-500"> (비번 등록됨)</span>
                            )}
                          </p>
                        )}
                        {address.delivery_note && (
                          <p className="text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2">
                            <span className="font-semibold text-gray-700 dark:text-gray-200">메모 · </span>
                            {address.delivery_note}
                          </p>
                        )}
                      </div>
                    )}
                    {address.is_default === 0 && (
                      <button
                        onClick={() => handleSetDefault(address.id)}
                        className="mt-2 text-[13px] font-semibold text-pink-500 hover:text-pink-600 transition-colors"
                      >
                        기본으로 설정
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(address)}
                      aria-label={t('address.ariaEdit')}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-white transition-colors rounded-xl hover:bg-gray-50 dark:hover:bg-[#121212]"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(address.id)}
                      aria-label={t('address.ariaDelete')}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors rounded-xl hover:bg-gray-50 dark:hover:bg-[#121212]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 배송지 추가/수정 모달 — stays white for readability */}
      <CustomModal
        isOpen={showForm}
        onClose={closeForm}
        title={editingId ? t('address.modalEditTitle') : t('address.modalAddTitle')}
        type="custom"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="addr-recipient-name" className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
              {t('address.recipientName')} <span className="text-red-500">*</span>
            </label>
            <input
              id="addr-recipient-name"
              type="text"
              value={formData.recipient_name}
              onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl text-[15px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder={t('address.recipientPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="addr-phone" className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
              {t('address.phone')} <span className="text-red-500">*</span>
            </label>
            <input
              id="addr-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl text-[15px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="010-1234-5678"
            />
          </div>

          <div>
            <label htmlFor="addr-postal-code" className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
              {t('address.postalCode')} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="addr-postal-code"
                type="text"
                value={formData.postal_code}
                readOnly
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl bg-gray-50 dark:bg-[#121212] text-[15px] text-gray-600 dark:text-gray-300"
                placeholder={t('address.postalPlaceholder')}
              />
              <button
                type="button"
                onClick={() => setShowPostcodePopup(true)}
                className="px-5 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl text-[14px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#121212] transition-all whitespace-nowrap"
              >
                주소 검색
              </button>
            </div>
          </div>

          {showPostcodePopup && (
            <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-[#2A2A2A]">
              <div id="daum-postcode-container" style={{ width: '100%', height: '400px' }}></div>
            </div>
          )}

          <div>
            <label htmlFor="addr-address" className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
              {t('address.address')} <span className="text-red-500">*</span>
            </label>
            <input
              id="addr-address"
              type="text"
              value={formData.address}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl bg-gray-50 dark:bg-[#121212] text-[15px] text-gray-600 dark:text-gray-300"
              placeholder={t('address.addressPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="addr-address-detail" className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
              {t('address.detail')}
            </label>
            <input
              id="addr-address-detail"
              type="text"
              value={formData.address_detail}
              onChange={(e) => setFormData({ ...formData, address_detail: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl text-[15px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder={t('address.detailPlaceholder')}
            />
          </div>

          {/* 배송지 별칭 */}
          <div>
            <label htmlFor="addr-label" className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
              {t('address.label')} <span className="text-gray-400 dark:text-gray-500 font-normal">{t('address.optional')}</span>
            </label>
            <div className="flex gap-1.5 mb-2">
              {[t('address.presetHome'), t('address.presetWork'), t('address.presetParents')].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFormData({ ...formData, label: preset })}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                    formData.label === preset
                      ? 'bg-pink-500 text-white border-pink-500'
                      : 'bg-white dark:bg-[#0A0A0A] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2A2A2A] hover:bg-gray-50 dark:hover:bg-[#121212]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="addr-label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              maxLength={20}
              className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl text-[15px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder={t('address.labelPlaceholder')}
            />
          </div>

          {/* 출입 방식 */}
          <div>
            <label className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
              {t('address.entryMethod')} <span className="text-gray-400 dark:text-gray-500 font-normal">{t('address.optional')}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ENTRY_METHOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, entry_method: opt.value })}
                  className={`px-3 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
                    formData.entry_method === opt.value
                      ? 'bg-pink-50 text-pink-600 border-pink-500'
                      : 'bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#2A2A2A] hover:bg-gray-50 dark:hover:bg-[#121212]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 공동현관 비밀번호 (password 선택 시만) */}
          {formData.entry_method === 'password' && (
            <div>
              <label htmlFor="addr-entry-code" className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
                공동현관 비밀번호
              </label>
              <input
                id="addr-entry-code"
                type="text"
                value={formData.entry_code}
                onChange={(e) => setFormData({ ...formData, entry_code: e.target.value })}
                maxLength={20}
                className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl text-[15px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder={t('address.entryCodePlaceholder')}
              />
              <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                배송기사에게만 전달되며 주문 완료 후 60일 뒤 자동 파기됩니다
              </p>
            </div>
          )}

          {/* 배송 메모 */}
          <div>
            <label htmlFor="addr-note" className="block text-[14px] font-semibold text-gray-900 dark:text-white mb-2">
              배송 메모 <span className="text-gray-400 dark:text-gray-500 font-normal">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DELIVERY_NOTE_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFormData({ ...formData, delivery_note: preset })}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                    formData.delivery_note === preset
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white dark:bg-[#0A0A0A] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#2A2A2A] hover:bg-gray-50 dark:hover:bg-[#121212]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              id="addr-note"
              value={formData.delivery_note}
              onChange={(e) => setFormData({ ...formData, delivery_note: e.target.value })}
              maxLength={200}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-2xl text-[14px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder={t('address.notePlaceholder')}
            />
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="is_default_modal"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="w-4 h-4 border-gray-300 dark:border-[#3A3A3A] text-blue-600 focus:ring-blue-500 cursor-pointer rounded"
            />
            <label htmlFor="is_default_modal" className="text-[14px] text-gray-700 dark:text-gray-200 cursor-pointer select-none">
              기본 배송지로 설정
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveAddress}
              className="flex-1 py-4 bg-pink-500 text-white rounded-2xl text-[16px] font-bold hover:bg-pink-600 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
            >
              {editingId ? t('address.edit') : t('address.save')}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="flex-1 py-4 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 rounded-2xl text-[16px] font-bold hover:bg-gray-200 transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
            >
              취소
            </button>
          </div>
        </div>
      </CustomModal>
    </div>
  )
}
