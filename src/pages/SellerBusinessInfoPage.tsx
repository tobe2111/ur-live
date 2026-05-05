import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardCard, DashboardLoading } from '@/components/dashboard'
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Search,
  CreditCard
} from 'lucide-react'
import { formatKST } from '@/utils/date'

// 🛡️ 2026-05-02: TD-018 분할 — types 를 ./seller-business-info/types 로 추출.
import type { BusinessInfo, BankInfo } from './seller-business-info/types'

// Daum Postcode type definition
declare global {
  interface Window {
    daum: { Postcode: new (options: Record<string, unknown>) => { embed: (el: HTMLElement | null) => void; open: () => void } }
  }
}

export default function SellerBusinessInfoPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    loadBusinessInfo()
    loadBankInfo()
    loadDaumPostcodeScript()
  }, [])

  async function loadBankInfo() {
    try {
      const response = await api.get('/api/seller/profile')
      if (response.data.success && response.data.data) {
        const s = response.data.data
        setBankInfo({
          bank_name: s.bank_name || '',
          bank_account: s.bank_account || '',
          account_holder: s.account_holder || s.name || '',
        })
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[BusinessInfo] load bank info failed:', err)
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
      const response = await api.post('/api/seller/profile', {
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
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string }; status?: number } }
      if (error_.response?.status === 404) {
        // Business info not yet registered
      } else {
        if (import.meta.env.DEV) console.error('Failed to load business info:', error)
        setError(t('seller.businessInfoLoadFailed'))
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.businessNumber')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="business_number"
              value={formData.business_number}
              onChange={handleChange}
              placeholder="000-00-00000"
              maxLength={12}
              required
              disabled={businessInfo?.is_verified && !editMode}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">{t('seller.businessNumberHint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.businessName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="business_name"
              value={formData.business_name}
              onChange={handleChange}
              placeholder={t('seller.businessNamePlaceholder')}
              required
              disabled={businessInfo?.is_verified && !editMode}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.representative')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="ceo_name"
              value={formData.ceo_name}
              onChange={handleChange}
              placeholder={t('seller.representativePlaceholder')}
              required
              disabled={businessInfo?.is_verified && !editMode}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.businessType')}
              </label>
              <input
                type="text"
                name="business_type"
                value={formData.business_type}
                onChange={handleChange}
                placeholder={t('seller.businessTypePlaceholder')}
                disabled={businessInfo?.is_verified && !editMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.businessCategory')}
              </label>
              <input
                type="text"
                name="business_category"
                value={formData.business_category}
                onChange={handleChange}
                placeholder={t('seller.businessCategoryPlaceholder')}
                disabled={businessInfo?.is_verified && !editMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('seller.businessAddress')} <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder={t('seller.postalCode')}
                  required
                  readOnly
                  disabled={businessInfo?.is_verified && !editMode}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {(!businessInfo?.is_verified || editMode) && (
                  <Button
                    type="button"
                    onClick={openAddressSearch}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    {t('seller.addressSearch')}
                  </Button>
                )}
              </div>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder={t('seller.baseAddress')}
                required
                readOnly
                disabled={businessInfo?.is_verified && !editMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <input
                type="text"
                name="address_detail"
                value={formData.address_detail}
                onChange={handleChange}
                placeholder={t('seller.detailAddress')}
                disabled={businessInfo?.is_verified && !editMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.phoneNumber')} <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="02-1234-5678"
                maxLength={13}
                required
                disabled={businessInfo?.is_verified && !editMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">{t('seller.phoneNumberHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('seller.emailLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="business@example.com"
                required
                disabled={businessInfo?.is_verified && !editMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {(!businessInfo?.is_verified || editMode) ? (
            <div className="pt-4 space-y-3">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('seller.savingInfo')}
                  </span>
                ) : editMode ? (
                  t('seller.requestEdit')
                ) : businessInfo ? (
                  t('seller.editInfo')
                ) : (
                  t('seller.registerBusinessInfo')
                )}
              </Button>
              {editMode && (
                <Button
                  type="button"
                  onClick={() => {
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
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          ) : (
            <div className="pt-4">
              <Button
                type="button"
                onClick={() => setEditMode(true)}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              >
                {t('seller.requestInfoEdit')}
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {t('seller.requestInfoEditNote')}
              </p>
            </div>
          )}

          {/* Help Text */}
          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">{t('seller.infoNotice')}</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>{t('seller.infoNotice1')}</li>
                  <li>{t('seller.infoNotice2')}</li>
                  <li>{t('seller.infoNotice3')}</li>
                  <li>{t('seller.infoNotice4')}</li>
                </ul>
              </div>
            </div>
          </div>
        </form>

        {/* 🛡️ 2026-04-22 배치 128: 계좌 정보 섹션 (정산용) */}
        <DashboardCard
          title={t('seller.bankInfo', { defaultValue: '정산 계좌 정보' })}
          subtitle={t('seller.bankInfoDesc', { defaultValue: '정산금 입금 받을 계좌입니다. 본인 명의 계좌만 사용 가능합니다.' })}
        >
          <form onSubmit={handleBankSubmit} className="space-y-4" id="bank-info-section">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                {t('seller.bankName', { defaultValue: '은행명' })} <span className="text-red-500">*</span>
              </label>
              <select
                value={bankInfo.bank_name}
                onChange={e => setBankInfo(prev => ({ ...prev, bank_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('seller.bankNameSelect', { defaultValue: '은행을 선택해주세요' })}</option>
                {['KB국민은행','신한은행','우리은행','하나은행','NH농협은행','IBK기업은행','SC제일은행','한국씨티은행','케이뱅크','카카오뱅크','토스뱅크','새마을금고','신협','우체국','부산은행','경남은행','대구은행','광주은행','전북은행','제주은행','수협은행','산업은행'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  {t('seller.accountNumber', { defaultValue: '계좌번호' })} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankInfo.bank_account}
                  onChange={e => setBankInfo(prev => ({ ...prev, bank_account: e.target.value.replace(/[^\d-]/g, '') }))}
                  placeholder="000-000-0000000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  {t('seller.accountHolder', { defaultValue: '예금주' })} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankInfo.account_holder}
                  onChange={e => setBankInfo(prev => ({ ...prev, account_holder: e.target.value }))}
                  placeholder={t('seller.bizInfo.holderPlaceholder', { defaultValue: '홍길동' })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              <CreditCard className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>{t('seller.bankInfoNotice', { defaultValue: '정산 요청 시 이 계좌로 입금됩니다. 계좌 정보가 정확한지 확인해주세요.' })}</p>
            </div>
            <Button
              type="submit"
              disabled={bankSubmitting}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bankSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('seller.savingInfo')}
                </span>
              ) : (
                t('seller.saveBankInfo', { defaultValue: '계좌 정보 저장' })
              )}
            </Button>
          </form>
        </DashboardCard>
      </div>
    </SellerLayout>
  )
}
