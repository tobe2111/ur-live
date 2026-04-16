import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
} from 'lucide-react'
import { getUserId } from '@/utils/auth'
import { CustomModal } from '@/components/CustomModal'
import { toast } from '@/hooks/useToast'

interface ShippingAddress {
  id: number
  user_id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
  created_at: string
  updated_at: string
}

const EMPTY_FORM = {
  recipient_name: '',
  phone: '',
  postal_code: '',
  address: '',
  address_detail: '',
  is_default: false
}

export default function AddressManagementPage() {
  const navigate = useNavigate()
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPostcodePopup, setShowPostcodePopup] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => {
    const userId = getUserId()
    if (!userId) {
      toast.info('로그인이 필요합니다.')
      navigate('/login')
      return
    }
    loadAddresses()
  }, [navigate])

  // Daum 우편번호 팝업 — 모달 내 embedded 방식
  useEffect(() => {
    if (!showPostcodePopup) return
    const timer = setTimeout(() => {
      const container = document.getElementById('daum-postcode-container')
      if (!container) return
      new (window as any).daum.Postcode({
        oncomplete: (data: any) => {
          setFormData(prev => ({
            ...prev,
            postal_code: data.zonecode,
            address: data.roadAddress || data.jibunAddress
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
      console.error('Failed to load addresses:', error)
      toast.error('배송지 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAddress() {
    if (!formData.recipient_name || !formData.phone || !formData.address) {
      toast.error('모든 필수 항목을 입력해주세요.')
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
      console.error('Failed to save address:', error)
      toast.error('배송지 저장에 실패했습니다.')
    }
  }

  async function handleDeleteAddress(id: number) {
    if (!confirm('이 배송지를 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/shipping-addresses/${id}`)
      loadAddresses()
    } catch (error) {
      console.error('Failed to delete address:', error)
      toast.error('배송지 삭제에 실패했습니다.')
    }
  }

  async function handleSetDefault(id: number) {
    try {
      const address = addresses.find(a => a.id === id)
      if (!address) return
      await api.put(`/api/shipping-addresses/${id}`, { ...address, is_default: 1 })
      loadAddresses()
    } catch (error) {
      console.error('Failed to set default:', error)
      toast.error('기본 배송지 설정에 실패했습니다.')
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
      is_default: address.is_default === 1
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Daum Postcode Script */}
      <script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/user/profile"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">뒤로</span>
            </Link>
            <h1 className="text-[17px] font-bold text-gray-900">배송지 관리</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* 새 배송지 추가 버튼 */}
        <button
          onClick={openAddForm}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 py-4 text-[15px] font-semibold text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 mb-5 active:scale-[0.98] touch-manipulation"
        >
          <Plus className="w-5 h-5" />
          <span>새 배송지 추가</span>
        </button>

        {/* 배송지 목록 */}
        {addresses.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-[15px] text-gray-500">등록된 배송지가 없습니다.</p>
            <p className="text-[13px] text-gray-400 mt-1">배송지를 추가해주세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`border rounded-2xl p-4 transition-all ${
                  address.is_default === 1
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-[15px] font-semibold text-gray-900">{address.recipient_name}</p>
                      {address.is_default === 1 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                          기본
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-gray-600 mb-1">{address.phone}</p>
                    <p className="text-[14px] text-gray-700 leading-relaxed">
                      [{address.postal_code}] {address.address}
                    </p>
                    {address.address_detail && (
                      <p className="text-[14px] text-gray-700 leading-relaxed mt-0.5">
                        {address.address_detail}
                      </p>
                    )}
                    {address.is_default === 0 && (
                      <button
                        onClick={() => handleSetDefault(address.id)}
                        className="mt-2 text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        기본으로 설정
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(address)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-xl hover:bg-blue-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(address.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
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

      {/* 배송지 추가/수정 모달 */}
      <CustomModal
        isOpen={showForm}
        onClose={closeForm}
        title={editingId ? '배송지 수정' : '새 배송지 추가'}
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
              value={formData.recipient_name}
              onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="받으실 분의 이름을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-gray-900 mb-2">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                value={formData.postal_code}
                readOnly
                className="flex-1 px-4 py-3 border border-gray-300 rounded-2xl bg-gray-50 text-[15px] text-gray-600"
                placeholder="우편번호"
              />
              <button
                type="button"
                onClick={() => setShowPostcodePopup(true)}
                className="px-5 py-3 border border-gray-300 rounded-2xl text-[14px] font-semibold text-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap"
              >
                주소 검색
              </button>
            </div>
          </div>

          {showPostcodePopup && (
            <div className="rounded-2xl overflow-hidden border border-gray-200">
              <div id="daum-postcode-container" style={{ width: '100%', height: '400px' }}></div>
            </div>
          )}

          <div>
            <label className="block text-[14px] font-semibold text-gray-900 mb-2">
              주소 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.address}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-gray-50 text-[15px] text-gray-600"
              placeholder="주소 검색 후 자동 입력됩니다"
            />
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-gray-900 mb-2">
              상세주소
            </label>
            <input
              type="text"
              value={formData.address_detail}
              onChange={(e) => setFormData({ ...formData, address_detail: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="동/호수, 건물명 등 (선택)"
            />
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="is_default_modal"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer rounded"
            />
            <label htmlFor="is_default_modal" className="text-[14px] text-gray-700 cursor-pointer select-none">
              기본 배송지로 설정
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveAddress}
              className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[16px] font-bold hover:bg-blue-700 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
            >
              {editingId ? '수정' : '저장'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl text-[16px] font-bold hover:bg-gray-200 transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
            >
              취소
            </button>
          </div>
        </div>
      </CustomModal>
    </div>
  )
}
