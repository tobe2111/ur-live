import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { digitsOnly, isValidKrPhone, isValidEmail } from '@/utils/form-validators'

export default function SellerRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const agencyId = searchParams.get('agency')
  const inviteCode = searchParams.get('invite')?.toUpperCase()
  // 🛡️ 2026-05-16: 인플루언서 referral (?ref=influencerId)
  //   URL 파라미터 또는 (없으면) 사용자 직접 입력
  const refFromUrl = searchParams.get('ref') || ''
  const [inviteAgency, setInviteAgency] = useState<{ name: string; contact: string } | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    phone: '',
    businessNumber: '',
    businessName: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 영입 코드가 있으면 에이전시 정보 prefill
  useEffect(() => {
    if (!inviteCode) return
    api.get(`/api/invite/${inviteCode}`)
      .then((r) => {
        if (r.data.success) {
          setInviteAgency({ name: r.data.data.agency_name, contact: r.data.data.agency_contact })
        }
      })
      .catch(() => {
        setInviteAgency(null)
      })
  }, [inviteCode])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 🔢 2026-06-26 (대표 가입폼 UX): 화면 순서대로 검증 + 첫 문제 필드로 포커스(전화/이메일 미완성 통과 차단).
    //   기존엔 native required 가 순서를 무시하고 점프 + email.includes('@') 라 'a@b'·'@naver' 통과했음.
    const focusById = (id: string) => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } }
    const failAt = (id: string, m: string) => { setError(m); toast.error(m); focusById(id) }

    if (formData.username.trim().length < 3) { failAt('username', t('seller.usernameMin3')); return }
    if (!isValidEmail(formData.email)) { failAt('email', t('seller.invalidEmail')); return }
    // 🏁 2026-07-01: 서버 비번 정책(10자+대·소·숫자·특수)과 클라 검증 정합 — 백엔드 거절 전 즉시 안내.
    const pw = formData.password
    const pwStrong = pw.length >= 10 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)
    if (!pwStrong) { failAt('password', t('seller.passwordWeak', { defaultValue: '비밀번호는 10자 이상, 대·소문자·숫자·특수문자를 모두 포함해야 합니다' })); return }
    if (formData.password !== formData.passwordConfirm) { failAt('passwordConfirm', t('seller.passwordMismatch')); return }
    if (!formData.name.trim()) { failAt('name', t('seller.errName', { defaultValue: '대표자 성명을 입력해주세요' })); return }
    if (!isValidKrPhone(formData.phone)) { failAt('phone', t('seller.errPhone', { defaultValue: '연락처를 정확히 입력해주세요 (예: 010-1234-5678)' })); return }
    if (!formData.businessName.trim()) { failAt('businessName', t('seller.errBizName', { defaultValue: '상호(사업자명)를 입력해주세요' })); return }
    // 사업자번호 — 하이픈 유무 무관 10자리.
    if (!/^\d{10}$/.test(digitsOnly(formData.businessNumber))) { failAt('businessNumber', t('seller.invalidBusinessNumber')); return }

    setLoading(true)

    try {
      // 사업자번호 하이픈 정규화 (백엔드는 XXX-XX-XXXXX 형식 요구).
      const bizDigits = digitsOnly(formData.businessNumber)
      const bizFormatted = `${bizDigits.slice(0, 3)}-${bizDigits.slice(3, 5)}-${bizDigits.slice(5)}`

      const response = await api.post('/api/seller/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
        business_number: bizFormatted,
        business_name: formData.businessName,
        // 🏁 2026-07-01: 라이브커머스 영구중단 — 모든 신규 가입은 사업자 유저(매장) 단일 유형.
        seller_type: 'store_owner',
        agency_id: agencyId ? Number(agencyId) : undefined,
        invite_code: inviteCode || undefined,
        referred_by_influencer: refFromUrl || undefined,
      } as any)

      if (response.data.success) {
        toast.success(t('seller.registerSuccessMsg'))
        navigate('/seller/login')
      } else {
        setError(response.data.error || t('seller.registerFailedGeneric'))
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string; message?: string }; status?: number } }
      setError(err_.response?.data?.error || err_.response?.data?.message || t('seller.registerFailedGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="force-light-theme min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🛍️</h1>
          <h2 className="text-3xl font-bold text-gray-900">{t('seller.sellerRegister')}</h2>
          <p className="text-gray-600 mt-2">{t('seller.sellerRegistration')}</p>
          {agencyId && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium">
              <span>🤝</span> {t('seller.agencyInviteJoin')}
            </div>
          )}
          {inviteAgency && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
              <span>🎟️</span> <strong>{inviteAgency.name}</strong> 영입 코드로 가입
            </div>
          )}
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* 🔢 noValidate: native required 가 순서 무시하고 점프하던 것 차단 → JS 순차검증 사용 */}
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* 가입 혜택 안내 — 내 링크샵(쇼핑몰)으로 상품·이용권 판매 */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-bold text-gray-900 mb-2.5">{t('seller.regBenefitsTitle', { defaultValue: '가입하면 이렇게 시작해요' })}</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-[13px] text-gray-700">
                  <span aria-hidden>🏬</span><span>{t('seller.regBenefit1', { defaultValue: '내 링크샵(온라인 쇼핑몰)이 자동으로 만들어져요' })}</span>
                </li>
                <li className="flex items-start gap-2 text-[13px] text-gray-700">
                  <span aria-hidden>📦</span><span>{t('seller.regBenefit2', { defaultValue: '내 상품과 이용권을 올려 바로 판매해요' })}</span>
                </li>
                <li className="flex items-start gap-2 text-[13px] text-gray-700">
                  <span aria-hidden>💰</span><span>{t('seller.regBenefit3', { defaultValue: '매출은 현금으로 정산받아요 (플랫폼 수수료 5%)' })}</span>
                </li>
              </ul>
            </div>

            {/* 기본 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('seller.basicInfo')}</h3>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('seller.usernameLabel')}
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  minLength={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="seller123"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">{t('seller.emailLabel')}</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="seller@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('seller.passwordLabel')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-2">{t('seller.passwordConfirmLabel')}</label>
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  required
                  minLength={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('seller.representativeName')}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">{t('seller.phoneLabel')}</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="010-1234-5678"
                />
              </div>
            </div>

            {/* 사업자 정보 */}
            <div className="space-y-4 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{t('seller.businessInfoSection')}</h3>
              
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('seller.businessNameLabel')}
                </label>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  value={formData.businessName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="예: 우리가게"
                />
              </div>

              <div>
                <label htmlFor="businessNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('seller.businessNumberLabel')}
                </label>
                <input
                  id="businessNumber"
                  name="businessNumber"
                  type="text"
                  value={formData.businessNumber}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="123-45-67890"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-gray-900 to-gray-900 text-white py-4 rounded-lg font-semibold hover:from-gray-900 hover:to-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('seller.registrationInProgress') : t('seller.registerAsSeller')}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {t('seller.alreadyHaveAccount')}{' '}
              <button
                onClick={() => navigate('/seller/login')}
                className="text-purple-600 hover:text-purple-700 font-semibold"
              >
                {t('seller.goToLogin')}
              </button>
            </p>
          </div>

          {/* Note */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              {t('seller.registrationNote')}
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            {t('seller.goHome')}
          </button>
        </div>
      </div>
    </div>
  )
}
