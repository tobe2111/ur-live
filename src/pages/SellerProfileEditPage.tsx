import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { compressForThumbnail } from '@/lib/image-compress'
import { Button } from '@/components/ui/button'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { KakaoLinkButton } from '@/components/auth/KakaoLinkButton'
import { SellerPinSetup } from '@/components/auth/SellerPinPrompt'
import {
  Save,
  User,
  Image as ImageIcon,
  MessageSquare,
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Truck
} from 'lucide-react'

// 🛡️ 2026-05-02: TD-018 분할 — types 를 ./seller-profile-edit/types 로 추출.
import type { SellerProfile } from './seller-profile-edit/types'

export default function SellerProfileEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Form states - separated into sections
  const [profileData, setProfileData] = useState({
    profile_image: '',
    bio: ''
  })
  
  const [snsData, setSnsData] = useState({
    sns_instagram: '',
    sns_youtube: '',
    sns_facebook: '',
    sns_twitter: '',
    website_url: '',
    kakao_chat_link: ''
  })
  
  const [businessData, setBusinessData] = useState({
    business_name: '',
    business_number: '',
    company_name: ''
  })
  
  const [personalData, setPersonalData] = useState({
    name: '',
    email: '',
    phone: ''
  })

  // 🚚 2026-06-18 (셀러 배송비 설정): 기본 배송비 + 무료배송 기준액. 주문 시 서버(order.routes)가
  //   sellers.base_shipping_fee / free_shipping_threshold 로 배송비를 재계산(SSOT)하므로 여기서 설정.
  const [shippingData, setShippingData] = useState({
    base_shipping_fee: '',
    free_shipping_threshold: ''
  })
  
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  
  const [uploadingImage, setUploadingImage] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'business' | 'personal' | 'password'>('business')
  const [formData, setFormData] = useState({
    profile_image: '',
    bio: '',
    sns_instagram: '',
    sns_youtube: '',
    sns_facebook: '',
    sns_twitter: '',
    website_url: '',
    kakao_chat_link: '',
  })

  // 언마운트 시 setTimeout 정리 (setState on unmounted component 방지)
  useEffect(() => {
    return () => { if (successTimerRef.current) clearTimeout(successTimerRef.current) }
  }, [])

  useEffect(() => {
    // Check authentication
    const sessionToken = localStorage.getItem('seller_token')

    if (!sessionToken) {
      navigate('/seller/login')
      return
    }

    // 🛡️ 2026-05-20: 사이드바 "설정" 클릭 시 무조건 공개 프로필로 튕기던 redirect 제거.
    //   사용자 신고: 설정 누르면 메인페이지로 가버림. 의도는 "프로필/SNS 는 공개 페이지에서 인라인 편집"
    //   이었으나, 설정 페이지 자체가 안 보이는 사고. 이제 본 페이지가 진짜 설정 페이지로 동작.
    //   기존 ?tab= 쿼리 지원 유지 (deep link 호환).
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get('tab')
    if (tabParam === 'business' || tabParam === 'personal' || tabParam === 'password' || tabParam === 'profile') {
      setActiveTab(tabParam as typeof activeTab)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery. 편집 폼(4종)이라 데이터 도착 시 시드.
  const profileQ = useApiQuery<any>(['seller', 'profile-edit'], '/api/seller/profile', { select: (r: any) => (r?.success ? r.data : null) })
  const loading = profileQ.isLoading
  const loadProfile = () => profileQ.refetch()
  useEffect(() => {
    const seller = profileQ.data
    if (!seller) return
    setProfile(seller)
    setProfileData({ profile_image: seller.profile_image || '', bio: seller.bio || '' })
    setSnsData({
      sns_instagram: seller.sns_instagram || '', sns_youtube: seller.sns_youtube || '', sns_facebook: seller.sns_facebook || '',
      sns_twitter: seller.sns_twitter || '', website_url: seller.website_url || '', kakao_chat_link: seller.kakao_chat_link || '',
    })
    setBusinessData({ business_name: seller.business_name || '', business_number: seller.business_number || '', company_name: seller.company_name || '' })
    setPersonalData({ name: seller.name || '', email: seller.email || '', phone: seller.phone || '' })
    setShippingData({
      base_shipping_fee: seller.base_shipping_fee != null ? String(seller.base_shipping_fee) : '',
      free_shipping_threshold: seller.free_shipping_threshold != null ? String(seller.free_shipping_threshold) : '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQ.data])

  async function handleSaveShipping() {
    setSaving(true); setSuccessMessage(''); setErrorMessage('')
    const baseStr = shippingData.base_shipping_fee.trim()
    const thrStr = shippingData.free_shipping_threshold.trim()
    const base = baseStr === '' ? 0 : Number(baseStr)
    const thr = thrStr === '' ? null : Number(thrStr)
    if (!Number.isFinite(base) || base < 0 || base > 10_000_000) {
      setErrorMessage(t('seller.shippingFeeInvalid', { defaultValue: '배송비는 0 이상으로 입력해주세요' })); setSaving(false); return
    }
    if (thr !== null && (!Number.isFinite(thr) || thr < 0 || thr > 10_000_000)) {
      setErrorMessage(t('seller.shippingThresholdInvalid', { defaultValue: '무료배송 기준액을 올바르게 입력해주세요' })); setSaving(false); return
    }
    try {
      const response = await api.patch('/api/seller/profile', { base_shipping_fee: base, free_shipping_threshold: thr })
      if (response.data.success) {
        setSuccessMessage(t('seller.shippingSaveSuccess', { defaultValue: '배송 설정이 저장됐어요' }))
        if (successTimerRef.current) clearTimeout(successTimerRef.current); successTimerRef.current = setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to update shipping:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      setErrorMessage(axiosErr.response?.data?.error || t('seller.shippingSaveFailed', { defaultValue: '배송 설정 저장에 실패했습니다' }))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveProfile() {
    setSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const response = await api.patch('/api/seller/profile', {
        profile_image: formData.profile_image,
        bio: formData.bio,
        sns_instagram: formData.sns_instagram,
        sns_youtube: formData.sns_youtube,
        sns_facebook: formData.sns_facebook,
        sns_twitter: formData.sns_twitter,
        website_url: formData.website_url,
        kakao_chat_link: formData.kakao_chat_link,
      })

      if (response.data.success) {
        setProfile(response.data.data)
        setSuccessMessage(t('seller.profileUpdateSuccess'))
        if (successTimerRef.current) clearTimeout(successTimerRef.current); successTimerRef.current = setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to update profile:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      setErrorMessage(axiosErr.response?.data?.error || t('seller.profileUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBusiness() {
    setSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const response = await api.patch('/api/seller/business-info', businessData)

      if (response.data.success) {
        setProfile(response.data.data)
        setSuccessMessage(t('seller.businessUpdateSuccess'))
        if (successTimerRef.current) clearTimeout(successTimerRef.current); successTimerRef.current = setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to update business info:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      setErrorMessage(axiosErr.response?.data?.error || t('seller.businessUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }
  
  async function handleSavePersonal() {
    setSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const response = await api.patch('/api/seller/personal-info', personalData)

      if (response.data.success) {
        setProfile(response.data.data)
        setSuccessMessage(t('seller.personalUpdateSuccess'))
        if (successTimerRef.current) clearTimeout(successTimerRef.current); successTimerRef.current = setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to update personal info:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      setErrorMessage(axiosErr.response?.data?.error || t('seller.personalUpdateFailed'))
    } finally {
      setSaving(false)
    }
  }
  
  async function handleChangePassword() {
    setSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    // Validation
    if (!passwordData.current_password) {
      setErrorMessage(t('seller.enterCurrentPassword'))
      setSaving(false)
      return
    }
    
    if (passwordData.new_password.length < 8) {
      setErrorMessage(t('seller.newPasswordMin8'))
      setSaving(false)
      return
    }
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setErrorMessage(t('seller.newPasswordMismatch'))
      setSaving(false)
      return
    }

    try {
      const response = await api.post('/api/seller/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })

      if (response.data.success) {
        setSuccessMessage(t('seller.passwordChangeSuccess'))
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
        if (successTimerRef.current) clearTimeout(successTimerRef.current); successTimerRef.current = setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to change password:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      setErrorMessage(axiosErr.response?.data?.error || t('seller.passwordChangeFailed'))
    } finally {
      setSaving(false)
    }
  }
  
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage(t('seller.imageOnlyAllowed'))
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(t('seller.imageSizeLimit'))
      return
    }
    
    setUploadingImage(true)
    setErrorMessage('')
    
    try {
      // 클라이언트 사이드 강한 압축 (CF Images 유료 회피).
      // 프로필 이미지 → 300KB / 1024px / WebP.
      const compressedFile = await compressForThumbnail(file)

      const formData = new FormData()
      formData.append('image', compressedFile)

      const response = await api.post('/api/seller/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      if (response.data.success) {
        setProfileData({ ...profileData, profile_image: response.data.url })
        setSuccessMessage(t('seller.imageUploadSuccess'))
        if (successTimerRef.current) clearTimeout(successTimerRef.current); successTimerRef.current = setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to upload image:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      setErrorMessage(axiosErr.response?.data?.error || t('seller.imageUploadFailed'))
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSave() {
    // Dispatch to the appropriate save handler based on active tab
    if (activeTab === 'profile') await handleSaveProfile()
    else if (activeTab === 'business') await handleSaveBusiness()
    else if (activeTab === 'personal') await handleSavePersonal()
    else if (activeTab === 'password') await handleChangePassword()
  }

  if (loading) {
    return (
      <SellerLayout title={t('seller.profileEdit')}>
        <div className="mx-auto max-w-[980px] p-4 sm:p-6 lg:p-8">
          <DashboardLoading text={t('seller.profileLoading')} />
        </div>
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title={t('seller.profileEdit')}>
      <div className="mx-auto max-w-[980px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 129: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.profileEdit')}
          subtitle={t('seller.profileEditSubtitle', { defaultValue: '셀러 프로필 · 소개 · SNS 링크 관리' })}
          icon={<User className="h-5 w-5" />}
        />

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-700">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <p className="text-sm font-medium text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Public Page Preview */}
        {profile && (
          <div className="mb-8 apple-card p-6 bg-gradient-to-r from-[#007aff]/5 to-[#5856d6]/5 border-2 border-[#007aff]/20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <ExternalLink className="h-5 w-5 text-[#007aff]" />
                  <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
                    {t('seller.publicPagePreview')}
                  </h3>
                </div>
                <p className="text-[13px] text-[#6e6e73] mb-3">
                  {t('seller.changesSaveNotice')}
                </p>
                <a
                  href={`/s/${profile.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#007aff] text-white rounded-lg hover:bg-[#0051d5] transition-colors text-[13px] font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('seller.viewPublicPage')}
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Image Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#007aff]/10 rounded-full flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-[#007aff]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{t('seller.profileImage')}</h2>
                <p className="text-[13px] text-[#6e6e73]">{t('seller.enterImageUrl')}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Image Preview */}
              {formData.profile_image && (
                <div className="flex justify-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#e5e5ea]">
                    <img
                      src={formData.profile_image}
                      alt="Profile preview"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ''
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
                  {t('seller.imageUrl')}
                </label>
                <input
                  type="text"
                  value={formData.profile_image}
                  onChange={(e) => setFormData({ ...formData, profile_image: e.target.value })}
                  placeholder="https://example.com/profile.jpg"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
                <p className="mt-2 text-[11px] text-[#6e6e73]">
                  {t('seller.recommendSquare')}
                </p>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-[#34c759]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{t('seller.bio')}</h2>
                <p className="text-[13px] text-[#6e6e73]">{t('seller.enterBio')}</p>
              </div>
            </div>

            <div>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder={t('seller.bioPlaceholder')}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent resize-none"
              />
              <p className="mt-2 text-[11px] text-[#6e6e73] text-right">
                {formData.bio.length}/500
              </p>
            </div>
          </div>

          {/* SNS Links Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#ff3b30]/10 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-[#ff3b30]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{t('seller.snsLinks')}</h2>
                <p className="text-[13px] text-[#6e6e73]">{t('seller.connectSns')}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Instagram */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] mb-2">
                  <Instagram className="h-4 w-4 text-[#e4405f]" />
                  Instagram
                </label>
                <input
                  type="text"
                  value={formData.sns_instagram}
                  onChange={(e) => setFormData({ ...formData, sns_instagram: e.target.value })}
                  placeholder="username"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>

              {/* YouTube */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] mb-2">
                  <Youtube className="h-4 w-4 text-[#ff0000]" />
                  YouTube
                </label>
                <input
                  type="text"
                  value={formData.sns_youtube}
                  onChange={(e) => setFormData({ ...formData, sns_youtube: e.target.value })}
                  placeholder="@username"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>

              {/* Facebook */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] mb-2">
                  <Facebook className="h-4 w-4 text-[#1877f2]" />
                  Facebook
                </label>
                <input
                  type="text"
                  value={formData.sns_facebook}
                  onChange={(e) => setFormData({ ...formData, sns_facebook: e.target.value })}
                  placeholder="username"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>

              {/* Twitter */}
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] mb-2">
                  <Twitter className="h-4 w-4 text-[#1da1f2]" />
                  Twitter (X)
                </label>
                <input
                  type="text"
                  value={formData.sns_twitter}
                  onChange={(e) => setFormData({ ...formData, sns_twitter: e.target.value })}
                  placeholder="@username"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* 카카오 계정 연동 — 이메일/비번 셀러가 카카오 로그인 활성화 */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#fee500]/10 rounded-full flex items-center justify-center">
                <span className="text-lg">💬</span>
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">카카오 계정 연동</h2>
                <p className="text-[13px] text-[#6e6e73]">카카오 로그인으로도 셀러 계정 접근 가능</p>
              </div>
            </div>
            <KakaoLinkButton role="seller" />
          </div>

          {/* 보안 PIN — 민감 액션(정산/계좌) 추가 인증 */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center">
                <span className="text-lg">🔐</span>
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">보안 PIN</h2>
                <p className="text-[13px] text-[#6e6e73]">정산 요청, 계좌 변경 등 민감 액션 추가 인증</p>
              </div>
            </div>
            <SellerPinSetup linkedToKakao={false} />
          </div>

          {/* KakaoTalk Chat Link Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#fee500]/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-[#fee500]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{t('seller.kakaoInquiry')}</h2>
                <p className="text-[13px] text-[#6e6e73]">{t('seller.kakaoInquiryDesc')}</p>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={formData.kakao_chat_link}
                onChange={(e) => setFormData({ ...formData, kakao_chat_link: e.target.value })}
                placeholder="https://open.kakao.com/o/..."
                className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
              />
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex gap-2 text-[11px] text-orange-800">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">{t('seller.externalTradeWarningTitle')}</p>
                    <p>{t('seller.externalTradeWarningDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Website Section */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#5856d6]/10 rounded-full flex items-center justify-center">
                <Globe className="h-5 w-5 text-[#5856d6]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{t('seller.websiteLabel')}</h2>
                <p className="text-[13px] text-[#6e6e73]">{t('seller.personalWebsite')}</p>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={formData.website_url}
                onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
              />
            </div>
          </div>

          {/* 🚚 2026-06-18 배송 설정 — 내 쇼핑몰 배송비 (주문 시 서버가 이 값으로 재계산) */}
          <div className="apple-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#ff9500]/10 rounded-full flex items-center justify-center">
                <Truck className="h-5 w-5 text-[#ff9500]" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{t('seller.shippingSettings', { defaultValue: '배송 설정' })}</h2>
                <p className="text-[13px] text-[#6e6e73]">{t('seller.shippingSettingsDesc', { defaultValue: '내 쇼핑몰 상품의 기본 배송비와 무료배송 기준을 설정하세요' })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
                  {t('seller.baseShippingFee', { defaultValue: '기본 배송비 (원)' })}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={shippingData.base_shipping_fee}
                  onChange={(e) => setShippingData({ ...shippingData, base_shipping_fee: e.target.value.replace(/[^\d]/g, '') })}
                  placeholder="3000"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
                <p className="mt-2 text-[11px] text-[#6e6e73]">{t('seller.baseShippingFeeHint', { defaultValue: '비워두면 무료배송(0원)' })}</p>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
                  {t('seller.freeShippingThreshold', { defaultValue: '무료배송 기준액 (원)' })}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={shippingData.free_shipping_threshold}
                  onChange={(e) => setShippingData({ ...shippingData, free_shipping_threshold: e.target.value.replace(/[^\d]/g, '') })}
                  placeholder="50000"
                  className="w-full px-4 py-3 bg-white border border-[#e5e5ea] rounded-lg text-[15px] text-[#1d1d1f] placeholder-[#6e6e73]/50 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
                />
                <p className="mt-2 text-[11px] text-[#6e6e73]">{t('seller.freeShippingThresholdHint', { defaultValue: '이 금액 이상 주문 시 무료배송. 비우면 미적용' })}</p>
              </div>
            </div>

            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 text-[11px] text-blue-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>{t('seller.shippingServerNote', { defaultValue: '교환권(딜 결제)은 배송비가 부과되지 않으며, 실제 결제 배송비는 주문 시 서버에서 이 설정으로 계산됩니다.' })}</p>
            </div>

            <button
              onClick={handleSaveShipping}
              disabled={saving}
              className="mt-4 w-full py-3 px-6 bg-[#ff9500] text-white rounded-xl hover:bg-[#e6850e] transition-colors text-[14px] font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {t('seller.saveShipping', { defaultValue: '배송 설정 저장' })}
            </button>
          </div>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/seller')}
              className="flex-1 py-4 px-6 bg-white border border-[#e5e5ea] text-[#1d1d1f] rounded-xl hover:bg-[#f5f5f7] transition-colors text-[15px] font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-4 px-6 bg-[#007aff] text-white rounded-xl hover:bg-[#0051d5] transition-colors text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {t('seller.saving')}
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </SellerLayout>
  )
}
