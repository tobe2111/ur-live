import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function SellerRegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    phone: '',
    businessNumber: '',
    businessName: '',
    youtubeEmail: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 유효성 검증
    if (formData.password !== formData.passwordConfirm) {
      setError(t('seller.passwordMismatch'))
      return
    }

    if (formData.password.length < 8) {
      setError(t('seller.passwordMin8'))
      return
    }

    if (!formData.email.includes('@')) {
      setError(t('seller.invalidEmail'))
      return
    }

    if (!formData.youtubeEmail.includes('@')) {
      setError(t('seller.invalidYoutubeEmail'))
      return
    }

    if (formData.username.length < 3) {
      setError(t('seller.usernameMin3'))
      return
    }

    // 사업자번호 형식 검증 (XXX-XX-XXXXX)
    const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/
    if (!businessNumberRegex.test(formData.businessNumber)) {
      setError(t('seller.invalidBusinessNumber'))
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/api/seller/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
        business_number: formData.businessNumber,
        business_name: formData.businessName,
        youtube_email: formData.youtubeEmail
      })

      if (response.data.success) {
        toast.success(t('seller.registerSuccessMsg'))
        navigate('/seller/login')
      } else {
        setError(response.data.error || t('seller.registerFailedGeneric'))
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || t('seller.registerFailedGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">👨‍💼</h1>
          <h2 className="text-3xl font-bold text-gray-900">{t('seller.sellerRegister')}</h2>
          <p className="text-gray-600 mt-2">{t('seller.sellerRegistration')}</p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="seller@example.com"
                />
              </div>

              <div>
                <label htmlFor="youtubeEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('seller.youtubeEmailLabel')}
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  {t('seller.youtubeEmailDesc')}
                </p>
                <input
                  id="youtubeEmail"
                  name="youtubeEmail"
                  type="email"
                  value={formData.youtubeEmail}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="example@gmail.com"
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
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="John Doe"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Lister Corporation"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="123-45-67890"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
