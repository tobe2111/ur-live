import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard
} from 'lucide-react'
import { formatKST } from '@/utils/date'

// 🛡️ 2026-05-02: TD-018 분할 — types 를 ./seller-business-info/types 로 추출.
import type { BusinessInfo, BankInfo } from './seller-business-info/types'
// 🛡️ 2026-06-10: 탭화 분해 — 표현부를 ./seller-business-info/* 로 추출 (동작 변화 0, 순수 이동).
import BusinessInfoForm from './seller-business-info/BusinessInfoForm'
import BankInfoSection from './seller-business-info/BankInfoSection'
import BizRegSection from './seller-business-info/BizRegSection'

// 🛡️ 2026-06-10: 사업자 정보 / 계좌 정보 / 증명서 3개 영역 탭 분리.
//   기존 deep link 호환: ?tab=business|bank|certificate + 기존 해시 진입(#bank-info-section → bank 탭) 유지.
type BizInfoTab = 'business' | 'bank' | 'certificate'
const VALID_TABS: BizInfoTab[] = ['business', 'bank', 'certificate']

// Daum Postcode type definition
declare global {
  interface Window {
    daum: { Postcode: new (options: Record<string, unknown>) => { embed: (el: HTMLElement | null) => void; open: () => void } }
  }
}

export default function SellerBusinessInfoPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // 🛡️ 2026-06-10: 페이지 내 탭 (URL ?tab= 동기화 — /seller/profile?tab= 패턴).
  //   기존 #bank-info-section 해시 진입 (SellerSettlementsPage 의 계좌 등록 버튼) 은 bank 탭으로 매핑.
  const [activeTab, setActiveTab] = useState<BizInfoTab>(() => {
    const tabParam = searchParams.get('tab')
    if (VALID_TABS.includes(tabParam as BizInfoTab)) return tabParam as BizInfoTab
    if (typeof window !== 'undefined' && window.location.hash === '#bank-info-section') return 'bank'
    return 'business'
  })

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (VALID_TABS.includes(tabParam as BizInfoTab)) {
      setActiveTab(tabParam as BizInfoTab)
    } else if (typeof window !== 'undefined' && window.location.hash === '#bank-info-section') {
      setActiveTab('bank')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function switchTab(tab: BizInfoTab) {
    setActiveTab(tab)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    }, { replace: true })
  }

  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [editMode, setEditMode] = useState(false)
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

  // 🛡️ 2026-04-22 배치 128: 계좌 정보 섹션 추가 (이전엔 등록 UI 자체가 없어서 settlements 버그 유발)
  const [bankInfo, setBankInfo] = useState<BankInfo>({
    bank_name: '',
    bank_account: '',
    account_holder: '',
  })
  const [bankSubmitting, setBankSubmitting] = useState(false)

  // 🛡️ 2026-05-19 (사용자 신고): 사업자등록증 업로드 UI.
  //   백엔드: POST /api/seller/business-registration/submit (image_url + business_number).
  //   업로드: POST /api/seller/upload-image (이미지 → imgbb / R2 URL 반환).
  //   상태: 'pending' / 'verified' / 'rejected' — 어드민 검증 후 정산 + 딜 환급 활성화.
  const [bizRegImageUrl, setBizRegImageUrl] = useState<string>('')
  const [bizRegStatus, setBizRegStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none')
  const [bizRegRejectReason, setBizRegRejectReason] = useState<string>('')
  const [bizRegUploading, setBizRegUploading] = useState(false)
  const [bizRegSubmitting, setBizRegSubmitting] = useState(false)

  useEffect(() => {
    loadDaumPostcodeScript()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery. 편집 폼이라 데이터 도착 시 시드.
  //   profile 은 은행정보 + 사업자등록증 상태 공유(중복 fetch 제거), business-info 는 별도.
  const profileQ = useApiQuery<any>(['seller', 'biz-profile'], '/api/seller/profile', { select: (r: any) => (r?.success ? r.data : null) })
  useEffect(() => {
    const s = profileQ.data
    if (!s) return
    setBankInfo({ bank_name: s.bank_name || '', bank_account: s.bank_account || '', account_holder: s.account_holder || s.name || '' })
    setBizRegImageUrl(s.business_registration_image_url || '')
    setBizRegStatus(s.business_registration_image_url ? (s.business_registration_status || 'pending') as 'pending' | 'verified' | 'rejected' : 'none')
    setBizRegRejectReason(s.business_registration_reject_reason || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQ.data])

  // 사업자등록증 이미지 업로드 + URL 저장.
  async function handleBizRegFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // 클라이언트 검증: 5MB 이하, image/* 만.
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다 (JPG / PNG / WebP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('5MB 이하 이미지만 가능합니다')
      return
    }
    setBizRegUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const r = await api.post('/api/seller/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = r.data?.url || r.data?.data?.url
      if (!url) throw new Error('업로드 응답에 URL 없음')
      setBizRegImageUrl(url)
      toast.success('업로드 완료. "제출" 을 눌러 검증 신청하세요.')
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '업로드 실패')
    } finally {
      setBizRegUploading(false)
      e.target.value = ''  // input reset
    }
  }

  // 어드민 검증 신청 — image_url + business_number 제출.
  async function handleBizRegSubmit() {
    if (!bizRegImageUrl) {
      toast.error('먼저 사업자등록증 이미지를 업로드해주세요')
      return
    }
    setBizRegSubmitting(true)
    try {
      const r = await api.post('/api/seller/business-registration/submit', {
        image_url: bizRegImageUrl,
        business_number: formData.business_number || undefined,
      })
      if (r.data?.success) {
        toast.success('제출 완료. 어드민 검증 후 알림 드립니다.')
        setBizRegStatus('pending')
        setBizRegRejectReason('')
      } else {
        toast.error(r.data?.error || '제출 실패')
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '제출 실패')
    } finally {
      setBizRegSubmitting(false)
    }
  }

  async function handleBankSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!bankInfo.bank_name.trim() || !bankInfo.bank_account.trim() || !bankInfo.account_holder.trim()) {
      toast.error(t('seller.bankInfoRequired'))
      return
    }
    setBankSubmitting(true)
    try {
      const response = await api.put('/api/seller/profile', {
        bank_name: bankInfo.bank_name.trim(),
        bank_account: bankInfo.bank_account.trim(),
        account_holder: bankInfo.account_holder.trim(),
      })
      if (response.data.success) {
        // localStorage 동기화 — SellerSettlementsPage 가 이것을 읽음
        localStorage.setItem('seller_bank_name', bankInfo.bank_name.trim())
        localStorage.setItem('seller_account_number', bankInfo.bank_account.trim())
        localStorage.setItem('seller_account_holder', bankInfo.account_holder.trim())
        toast.success(t('seller.bankInfoSaved', { defaultValue: '계좌 정보가 저장되었습니다' }))
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('[BusinessInfo] save bank info failed:', error)
      toast.error(t('seller.bankInfoSaveFailed', { defaultValue: '계좌 정보 저장에 실패했습니다' }))
    } finally {
      setBankSubmitting(false)
    }
  }

  function loadDaumPostcodeScript() {
    // 🛡️ 2026-05-06: 페이지 재방문 시 중복 append 방지 (id 로 idempotent).
    const SCRIPT_ID = 'daum-postcode-v2'
    if (document.getElementById(SCRIPT_ID)) return
    // 이미 로드된 경우도 확인 — window.daum.Postcode 존재하면 스킵
    if ((window as { daum?: { Postcode?: unknown } }).daum?.Postcode) return
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.head.appendChild(script)
  }

  const businessInfoQ = useApiQuery<any>(['seller', 'business-info'], '/api/seller/business-info', { select: (r: any) => (r?.success ? r.data : null) })
  const loading = businessInfoQ.isLoading
  const loadBusinessInfo = () => businessInfoQ.refetch()
  useEffect(() => {
    const d = businessInfoQ.data
    if (!d) return
    setBusinessInfo(d)
    setFormData({
      business_number: d.business_number || '', business_name: d.business_name || '', ceo_name: d.ceo_name || '',
      business_type: d.business_type || '', business_category: d.business_category || '', postal_code: d.postal_code || '',
      address: d.address || '', address_detail: d.address_detail || '', phone: d.phone || '', email: d.email || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessInfoQ.data])

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
        setSuccess(t('seller.businessInfoSaved'))
        setTimeout(() => {
          loadBusinessInfo()
        }, 1500)
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('Failed to save business info:', error)
      setError(error_.response?.data?.error || t('seller.businessInfoSaveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target

    let formattedValue = value

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

    if (name === 'phone') {
      const numbers = value.replace(/[^\d]/g, '')

      if (numbers.startsWith('01')) {
        if (numbers.length <= 3) {
          formattedValue = numbers
        } else if (numbers.length <= 7) {
          formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3)}`
        } else {
          formattedValue = `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
        }
      } else if (numbers.startsWith('02')) {
        if (numbers.length <= 2) {
          formattedValue = numbers
        } else if (numbers.length <= 5) {
          formattedValue = `${numbers.slice(0, 2)}-${numbers.slice(2)}`
        } else if (numbers.length <= 9) {
          formattedValue = `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`
        } else {
          formattedValue = `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`
        }
      } else {
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
      toast.info(t('seller.addressSearchLoading'))
      return
    }

    new window.daum.Postcode({
      oncomplete: function(data: { zonecode: string; address: string; roadAddress?: string; jibunAddress?: string }) {
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
      <SellerLayout title={t('seller.businessInfoManagement')}>
        <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
          <DashboardLoading text={t('common.loading', { defaultValue: '불러오는 중...' })} />
        </div>
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title={t('seller.businessInfoManagement')}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 128: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.businessInfoManagement')}
          subtitle={t('seller.businessInfoDesc')}
          icon={<Building2 className="h-5 w-5" />}
        />

        {/* Status Banner */}
        {businessInfo && (
          <div className={`rounded-2xl border p-4 ${
            businessInfo.is_verified
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }`}>
            <div className="flex items-center gap-3">
              {businessInfo.is_verified ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">{t('seller.verificationApproved')}</p>
                    <p className="text-xs text-emerald-700">
                      {businessInfo.verified_at && t('seller.verifiedAt', { date: formatKST(businessInfo.verified_at) })}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{t('seller.verificationPending')}</p>
                    <p className="text-xs text-amber-700">{t('seller.verificationPendingDesc')}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          </div>
        )}

        {/* 🛡️ 2026-06-10: 탭 바 — 사업자 정보 / 정산 계좌 정보 / 사업자등록증 검증 (URL ?tab= 동기화) */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => switchTab('business')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'business'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              {t('seller.businessInfo')}
            </button>
            <button
              type="button"
              onClick={() => switchTab('bank')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'bank'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              {t('seller.bankInfo', { defaultValue: '정산 계좌 정보' })}
            </button>
            <button
              type="button"
              onClick={() => switchTab('certificate')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'certificate'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              사업자등록증 검증
            </button>
          </div>
        </div>

        {/* Form */}
        {activeTab === 'business' && (
          <BusinessInfoForm
            businessInfo={businessInfo}
            formData={formData}
            editMode={editMode}
            submitting={submitting}
            onSubmit={handleSubmit}
            onChange={handleChange}
            onAddressSearch={openAddressSearch}
            onEnterEditMode={() => setEditMode(true)}
            onCancelEdit={() => {
              setEditMode(false)
              if (businessInfo) {
                setFormData({
                  business_number: businessInfo.business_number || '',
                  business_name: businessInfo.business_name || '',
                  ceo_name: businessInfo.ceo_name || '',
                  business_type: businessInfo.business_type || '',
                  business_category: businessInfo.business_category || '',
                  postal_code: businessInfo.postal_code || '',
                  address: businessInfo.address || '',
                  address_detail: businessInfo.address_detail || '',
                  phone: businessInfo.phone || '',
                  email: businessInfo.email || ''
                })
              }
            }}
          />
        )}

        {/* 🛡️ 2026-04-22 배치 128: 계좌 정보 섹션 (정산용) */}
        {activeTab === 'bank' && (
          <BankInfoSection
            bankInfo={bankInfo}
            setBankInfo={setBankInfo}
            submitting={bankSubmitting}
            onSubmit={handleBankSubmit}
          />
        )}

        {/* 🛡️ 2026-05-19: 사업자등록증 업로드 섹션 (사용자 요청). */}
        {activeTab === 'certificate' && (
          <BizRegSection
            imageUrl={bizRegImageUrl}
            status={bizRegStatus}
            rejectReason={bizRegRejectReason}
            uploading={bizRegUploading}
            submitting={bizRegSubmitting}
            onFileChange={handleBizRegFileChange}
            onSubmit={handleBizRegSubmit}
          />
        )}
      </div>
    </SellerLayout>
  )
}
