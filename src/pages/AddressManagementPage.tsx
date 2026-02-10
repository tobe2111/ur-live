import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { 
  MapPin, 
  Plus, 
  Edit2, 
  Trash2, 
  Check,
  ArrowLeft,
  Star
} from 'lucide-react'
import { getUserId } from '@/utils/auth'
import { Button } from '@/components/ui/button'

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

export default function AddressManagementPage() {
  const navigate = useNavigate()
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  
  // 폼 상태
  const [formData, setFormData] = useState({
    recipient_name: '',
    phone: '',
    postal_code: '',
    address: '',
    address_detail: '',
    is_default: false
  })

  useEffect(() => {
    const userId = getUserId()
    if (!userId) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }
    loadAddresses()
  }, [navigate])

  async function loadAddresses() {
    try {
      const userId = getUserId()
      const response = await axios.get(`/api/shipping-addresses/${userId}`)
      
      if (response.data.success) {
        setAddresses(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load addresses:', error)
      alert('배송지 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAddress() {
    if (!formData.recipient_name || !formData.phone || !formData.address) {
      alert('모든 필수 항목을 입력해주세요.')
      return
    }

    try {
      const userId = getUserId()
      
      if (editingId) {
        // 수정
        await axios.put(`/api/shipping-addresses/${editingId}`, {
          userId: parseInt(userId!),
          ...formData,
          is_default: formData.is_default ? 1 : 0
        })
        alert('배송지가 수정되었습니다.')
      } else {
        // 추가
        await axios.post('/api/shipping-addresses', {
          userId: parseInt(userId!),
          ...formData,
          is_default: formData.is_default ? 1 : 0
        })
        alert('배송지가 추가되었습니다.')
      }
      
      // 폼 초기화
      setFormData({
        recipient_name: '',
        phone: '',
        postal_code: '',
        address: '',
        address_detail: '',
        is_default: false
      })
      setShowAddForm(false)
      setEditingId(null)
      loadAddresses()
    } catch (error) {
      console.error('Failed to save address:', error)
      alert('배송지 저장에 실패했습니다.')
    }
  }

  async function handleDeleteAddress(id: number) {
    if (!confirm('이 배송지를 삭제하시겠습니까?')) {
      return
    }

    try {
      const userId = getUserId()
      await axios.delete(`/api/shipping-addresses/${id}`, {
        params: { userId }
      })
      alert('배송지가 삭제되었습니다.')
      loadAddresses()
    } catch (error) {
      console.error('Failed to delete address:', error)
      alert('배송지 삭제에 실패했습니다.')
    }
  }

  async function handleSetDefault(id: number) {
    try {
      const userId = getUserId()
      const address = addresses.find(a => a.id === id)
      if (!address) return

      await axios.put(`/api/shipping-addresses/${id}`, {
        userId: parseInt(userId!),
        ...address,
        is_default: 1
      })
      alert('기본 배송지로 설정되었습니다.')
      loadAddresses()
    } catch (error) {
      console.error('Failed to set default:', error)
      alert('기본 배송지 설정에 실패했습니다.')
    }
  }

  function handleEditAddress(address: ShippingAddress) {
    setFormData({
      recipient_name: address.recipient_name,
      phone: address.phone,
      postal_code: address.postal_code,
      address: address.address,
      address_detail: address.address_detail,
      is_default: address.is_default === 1
    })
    setEditingId(address.id)
    setShowAddForm(true)
  }

  function openDaumPostcode() {
    new (window as any).daum.Postcode({
      oncomplete: function(data: any) {
        setFormData(prev => ({
          ...prev,
          postal_code: data.zonecode,
          address: data.address
        }))
      }
    }).open()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9370DB]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      {/* Daum Postcode Script */}
      <script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link 
              to="/mypage" 
              className="flex items-center space-x-2 text-[#9370DB] hover:text-[#6A5ACD] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">뒤로</span>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">배송지 관리</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 배송지 추가 버튼 */}
        {!showAddForm && (
          <button
            onClick={() => {
              setShowAddForm(true)
              setEditingId(null)
              setFormData({
                recipient_name: '',
                phone: '',
                postal_code: '',
                address: '',
                address_detail: '',
                is_default: addresses.length === 0
              })
            }}
            className="w-full mb-6 p-4 border-2 border-dashed border-[#FFD700] rounded-xl hover:bg-[#FFD700]/5 transition-colors flex items-center justify-center space-x-2 text-[#FFA500]"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">새 배송지 추가</span>
          </button>
        )}

        {/* 배송지 추가/수정 폼 */}
        {showAddForm && (
          <div className="bg-white border-2 border-[#9370DB] rounded-2xl p-6 mb-6 shadow-lg">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingId ? '배송지 수정' : '새 배송지 추가'}
            </h2>
            
            <div className="space-y-4">
              {/* 받는 분 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  받는 분 *
                </label>
                <input
                  type="text"
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({...formData, recipient_name: e.target.value})}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9370DB] focus:border-transparent"
                />
              </div>

              {/* 휴대폰 번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  휴대폰 번호 *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9370DB] focus:border-transparent"
                />
              </div>

              {/* 주소 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  주소 *
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={formData.postal_code}
                    readOnly
                    placeholder="우편번호"
                    className="w-32 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <Button
                    onClick={openDaumPostcode}
                    variant="outline"
                    className="border-[#9370DB] text-[#9370DB] hover:bg-[#9370DB]/10"
                  >
                    주소 검색
                  </Button>
                </div>
                <input
                  type="text"
                  value={formData.address}
                  readOnly
                  placeholder="주소를 검색하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 mb-2"
                />
                <input
                  type="text"
                  value={formData.address_detail}
                  onChange={(e) => setFormData({...formData, address_detail: e.target.value})}
                  placeholder="상세주소 (동/호수 등)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#9370DB] focus:border-transparent"
                />
              </div>

              {/* 기본 배송지 설정 */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({...formData, is_default: e.target.checked})}
                  className="w-5 h-5 text-[#9370DB] border-gray-300 rounded focus:ring-[#9370DB]"
                />
                <label htmlFor="is_default" className="text-sm text-gray-700 cursor-pointer">
                  기본 배송지로 설정
                </label>
              </div>

              {/* 버튼 */}
              <div className="flex space-x-3 mt-6">
                <Button
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingId(null)
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveAddress}
                  className="flex-1 bg-[#9370DB] hover:bg-[#6A5ACD] text-white"
                >
                  {editingId ? '수정' : '추가'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 배송지 목록 */}
        <div className="space-y-4">
          {addresses.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">등록된 배송지가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">배송지를 추가해주세요.</p>
            </div>
          ) : (
            addresses.map((address) => (
              <div 
                key={address.id} 
                className={`bg-white rounded-xl p-5 shadow-sm border-2 transition-colors ${
                  address.is_default 
                    ? 'border-[#FFD700] bg-gradient-to-br from-[#FFD700]/5 to-transparent' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* 기본 배송지 뱃지 */}
                {address.is_default === 1 && (
                  <div className="inline-flex items-center space-x-1 px-3 py-1 bg-[#FFD700] text-gray-900 text-xs font-bold rounded-full mb-3">
                    <Star className="w-3 h-3 fill-current" />
                    <span>기본 배송지</span>
                  </div>
                )}

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900">{address.recipient_name}</h3>
                    <div className="flex items-center space-x-2">
                      {address.is_default === 0 && (
                        <button
                          onClick={() => handleSetDefault(address.id)}
                          className="text-xs text-[#FFA500] hover:text-[#FF8C00] font-medium"
                        >
                          기본으로 설정
                        </button>
                      )}
                      <button
                        onClick={() => handleEditAddress(address)}
                        className="p-2 text-gray-400 hover:text-[#9370DB] transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(address.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{address.phone}</p>
                </div>

                <div className="text-sm text-gray-700">
                  <p className="text-xs text-gray-500 mb-1">
                    [{address.postal_code}]
                  </p>
                  <p>{address.address}</p>
                  {address.address_detail && (
                    <p className="mt-1">{address.address_detail}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
