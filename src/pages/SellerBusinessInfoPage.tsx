import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SellerLayout from '@/components/SellerLayout'
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Search
} from 'lucide-react'
import { formatKST } from '@/utils/date'

interface BusinessInfo {
  id: number
  business_number: string
  business_name: string
  ceo_name: string
  business_type: string
  business_category: string
  postal_code: string
  address: string
  address_detail: string
  phone: string
  email: string
  is_verified: boolean
  verified_at: string | null
  created_at: string
}

// Daum Postcode 타입 정의
declare global {
  interface Window {
    daum: any
  }
}

export default function SellerBusinessInfoPage() {
  const navigate = useNavigate()
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    business_number: '',
    business_name: '',
    ceo_name: '',
    business_type: '',
    business_category: '',
    postal_code: '',
    address: '',
    address_detail: '',
    phone: '',
    email: ''
  })

  useEffect(() => {
    loadBusinessInfo()
    loadDaumPostcodeScript()
  }, [])

  function loadDaumPostcodeScript() {
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.body.appendChild(script)
  }

  async function loadBusinessInfo() {
    try {
      const sessionToken = localStorage.getItem('seller_token')
      

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const response = await api.get('/api/seller/business-info')

      if (response.data.success && response.data.data) {
        setBusinessInfo(response.data.data)
        setFormData({
          business_number: response.data.data.business_number || '',
          business_name: response.data.data.business_name || '',
          ceo_name: response.data.data.ceo_name || '',
          business_type: response.data.data.business_type || '',
          business_category: response.data.data.business_category || '',
          postal_code: response.data.data.postal_code || '',
          address: response.data.data.address || '',
          address_detail: response.data.data.address_detail || '',
          phone: response.data.data.phone || '',
          email: response.data.data.email || ''
        })
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // 사업자 정보가 아직 등록되지 않음
      } else {
        console.error('Failed to load business info:', error)
        setError('사업자 정보를 불러올 수 없습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const sessionToken = localStorage.getItem('seller_token')
      

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const response = await api.post('/api/seller/business-info', formData)

      if (response.data.success) {
        setSuccess('사업자 정보가 저장되었습니다. 관리자 승인을 기다려주세요.')
        setTimeout(() => {
          loadBusinessInfo()
        }, 1500)
      }
    } catch (error: any) {
      console.error('Failed to save business info:', error)
      setError(error.response?.data?.error || '사업자 정보 저장에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    
    let formattedValue = value

    // 사업자등록번호 자동 하이픈 (000-00-00000)
    if (name === 'business_number') {
      const numbers = value.replace(/[^\d]/g, '')
      if (numbers.length <= 3) {
        formattedValue = numbers
      } else if (numbers.length <= 5) {
        formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3)}`
      } else {
        formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`
      }
    }

    // 전화번호 자동 하이픈
    if (name === 'phone') {
      const numbers = value.replace(/[^\d]/g, '')
      
      // 010, 011 등 휴대폰 번호 (010-0000-0000)
      if (numbers.startsWith('01')) {
        if (numbers.length <= 3) {
          formattedValue = numbers
        } else if (numbers.length <= 7) {
          formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3)}`
        } else {
          formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
        }
      }
      // 02 서울 지역번호 (02-000-0000 또는 02-0000-0000)
      else if (numbers.startsWith('02')) {
        if (numbers.length <= 2) {
          formattedValue = numbers
        } else if (numbers.length <= 5) {
          formattedValue = `${numbers.slice(0, 2)}-${numbers.slice(2)}`
        } else if (numbers.length <= 9) {
          formattedValue = `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`
        } else {
          formattedValue = `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`
        }
      }
      // 그 외 지역번호 (031-000-0000 또는 031-0000-0000)
      else {
        if (numbers.length <= 3) {
          formattedValue = numbers
        } else if (numbers.length <= 6) {
          formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3)}`
        } else if (numbers.length <= 10) {
          formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`
        } else {
          formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
        }
      }
    }

    setFormData({
      ...formData,
      [name]: formattedValue
    })
  }

  function openAddressSearch() {
    if (!window.daum || !window.daum.Postcode) {
      toast.info('주소 검색 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    new window.daum.Postcode({
      oncomplete: function(data: any) {
        // 우편번호와 주소 정보를 formData에 설정
        setFormData({
          ...formData,
          postal_code: data.zonecode,
          address: data.address
        })
      }
    }).open()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <SellerLayout title="사업자 정보 관리">
      <div className="max-w-4xl mx-auto">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">사업자 정보 관리</h1>
          </div>
          <p className="text-gray-600 mt-2">
            세금계산서 발행을 위해 사업자 정보를 등록해주세요. 관리자 승인 후 사용 가능합니다.
          </p>
        </div>

        {/* Status Banner */}
        {businessInfo && (
          <div className={`mb-6 p-4 rounded-lg border ${
            businessInfo.is_verified
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-3">
              {businessInfo.is_verified ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">승인 완료</p>
                    <p className="text-sm text-green-700">
                      {businessInfo.verified_at && `승인일시: ${formatKST(businessInfo.verified_at)}`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-900">승인 대기중</p>
                    <p className="text-sm text-yellow-700">
                      관리자가 사업자 정보를 검토하고 있습니다. 영업일 기준 1~2일 소요됩니다.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              <p>{success}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          {/* 사업자등록번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사업자등록번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="business_number"
              value={formData.business_number}
              onChange={handleChange}
              placeholder="000-00-00000"
              maxLength={12}
              required
              disabled={businessInfo?.is_verified}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">숫자만 입력하면 자동으로 하이픈이 추가됩니다.</p>
          </div>

          {/* 상호명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상호(법인명) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="business_name"
              value={formData.business_name}
              onChange={handleChange}
              placeholder="예: (주)리스터코퍼레이션"
              required
              disabled={businessInfo?.is_verified}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* 대표자명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대표자명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="ceo_name"
              value={formData.ceo_name}
              onChange={handleChange}
              placeholder="예: 홍길동"
              required
              disabled={businessInfo?.is_verified}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* 업태/업종 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                업태
              </label>
              <input
                type="text"
                name="business_type"
                value={formData.business_type}
                onChange={handleChange}
                placeholder="예: 도소매업"
                disabled={businessInfo?.is_verified}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                업종
              </label>
              <input
                type="text"
                name="business_category"
                value={formData.business_category}
                onChange={handleChange}
                placeholder="예: 전자상거래업"
                disabled={businessInfo?.is_verified}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* 사업장 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사업장 소재지 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder="우편번호"
                  required
                  readOnly
                  disabled={businessInfo?.is_verified}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {!businessInfo?.is_verified && (
                  <Button
                    type="button"
                    onClick={openAddressSearch}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    주소 검색
                  </Button>
                )}
              </div>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="기본 주소"
                required
                readOnly
                disabled={businessInfo?.is_verified}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                name="address_detail"
                value={formData.address_detail}
                onChange={handleChange}
                placeholder="상세 주소"
                disabled={businessInfo?.is_verified}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* 연락처 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                전화번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="02-1234-5678"
                maxLength={13}
                required
                disabled={businessInfo?.is_verified}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">숫자만 입력하면 자동으로 하이픈이 추가됩니다.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="business@example.com"
                required
                disabled={businessInfo?.is_verified}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Submit Button */}
          {!businessInfo?.is_verified && (
            <div className="pt-4">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    저장 중...
                  </span>
                ) : businessInfo ? (
                  '정보 수정하기'
                ) : (
                  '사업자 정보 등록하기'
                )}
              </Button>
            </div>
          )}

          {/* Help Text */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">안내사항</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>사업자 정보는 세금계산서 발행에 사용됩니다.</li>
                  <li>승인 후에는 수정이 불가능합니다. 변경이 필요한 경우 고객센터로 문의해주세요.</li>
                  <li>허위 정보 입력 시 서비스 이용이 제한될 수 있습니다.</li>
                  <li>주소는 "주소 검색" 버튼을 클릭하여 정확하게 입력해주세요.</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </SellerLayout>
  )
}
