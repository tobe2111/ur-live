import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { Lock, Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react'

export default function SellerResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token') || '', [params])

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError(t('seller.resetPassword.minLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/api/seller/reset-password', { token, newPassword })
      if (res.data?.success) {
        toast.success(t('seller.resetPassword.changed'))
        navigate('/seller/login', { replace: true })
      } else {
        const msg = res.data?.error || t('seller.resetPassword.failed')
        setError(msg)
        toast.error(msg)
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string } } }
      const msg = err_.response?.data?.error || t('seller.resetPassword.failed')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex items-center justify-center p-6">
      <SEO
        title={t('seller.resetPassword.seoTitle')}
        description={t('seller.resetPassword.seoDescription')}
        url="/seller/reset-password"
        noindex
      />
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <span className="text-white text-lg font-bold">U</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Ur Seller</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {!token ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('seller.resetPassword.invalidLinkTitle')}</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                {t('seller.resetPassword.invalidLinkDesc')}
              </p>
              <Link
                to="/seller/forgot-password"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {t('seller.resetPassword.requestAgain')}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('seller.resetPassword.title')}</h2>
              <p className="text-sm text-gray-500 mb-7">
                {t('seller.resetPassword.description')}
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('seller.resetPassword.newPassword')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      placeholder={t('seller.resetPassword.newPasswordPlaceholder')}
                      className="w-full pl-10 pr-11 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.passwordConfirm')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      placeholder={t('seller.resetPassword.confirmPasswordPlaceholder')}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('seller.resetPassword.changing')}
                    </>
                  ) : (
                    t('seller.resetPassword.changeButton')
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <Link
                  to="/seller/login"
                  className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" /> {t('seller.forgotPassword.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
