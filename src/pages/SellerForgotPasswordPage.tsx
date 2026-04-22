import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function SellerForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/seller/forgot-password', { email })
      if (res.data?.success) {
        setSent(true)
        toast.success(t('seller.forgotPassword.checkEmailToast'))
      } else {
        const msg = res.data?.error || t('seller.forgotPassword.requestError')
        setError(msg)
        toast.error(msg)
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string } } }
      const msg = err_.response?.data?.error || t('seller.forgotPassword.requestError')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex items-center justify-center p-6">
      <SEO
        title={t('seller.forgotPassword.seoTitle')}
        description={t('seller.forgotPassword.seoDescription')}
        url="/seller/forgot-password"
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
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('seller.forgotPassword.checkEmailTitle')}</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                {t('seller.forgotPassword.checkEmailDesc')}
              </p>
              <Link
                to="/seller/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="w-4 h-4" /> {t('seller.forgotPassword.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('seller.forgotPassword.title')}</h2>
              <p className="text-sm text-gray-500 mb-7">
                {t('seller.forgotPassword.description')}
              </p>

              {error && (
                <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      placeholder="seller@example.com"
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
                      {t('seller.forgotPassword.sending')}
                    </>
                  ) : (
                    t('seller.forgotPassword.submitButton')
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

        <p className="mt-5 text-center text-xs text-gray-400">
          {t('seller.contactInquiry')}:{' '}
          <a href="mailto:support@ur-team.com" className="hover:text-gray-600 underline">
            support@ur-team.com
          </a>
        </p>
      </div>
    </div>
  )
}
