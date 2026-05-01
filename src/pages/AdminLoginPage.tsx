import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { clearAuthData } from '@/utils/auth'
import { clearFirebaseTokenCache } from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Mail, Lock, Eye, EyeOff, Shield, BarChart2, Settings } from 'lucide-react'

export default function AdminLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Remember Me 이메일 불러오기 (리다이렉트는 PublicRoute(forAdmin)에서 처리)
  useEffect(() => {
    const savedEmail = localStorage.getItem('admin_remember_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  // 🛡️ 2026-04-29: 401 인터셉터가 ?error=session_expired 로 redirect 시 toast 표시
  useEffect(() => {
    if (searchParams.get('error') === 'session_expired') {
      toast.error(t('auth.sessionExpired'))
      const next = new URLSearchParams(searchParams)
      next.delete('error')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, t])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // User 세션 정리 (동기) + Firebase signOut (비동기, 타임아웃 3초)
      clearAuthData('user')
      clearFirebaseTokenCache()
      // 🛡️ 2026-05-01: KR Firebase 100% 미사용 — signOut 호출 안 함.
      //   글로벌만 Firebase signOut 시도 (3초 타임아웃 hang 방지).
      try {
        const { isKorea } = await import('@/config/region')
        if (!isKorea()) {
          const signOutPromise = import('@/lib/firebase-auth').then(m => m.signOut())
          await Promise.race([
            signOutPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
          ])
        }
      } catch (_) {} // non-critical: best-effort signOut before admin login

      // JWT-based Login (NO Firebase!)
      const response = await api.post('/api/admin/login', {
        email,
        password
      })

      if (response.data.success) {
        // Save email if "Remember Me" is checked
        if (rememberMe) {
          localStorage.setItem('admin_remember_email', email)
        } else {
          localStorage.removeItem('admin_remember_email')
        }

        // 선택적 삭제: Admin 관련 키만 삭제 (User 세션 보호)
        clearAuthData('admin')

        const { admin, accessToken, refreshToken } = response.data.data

        // Store JWT tokens (PRIMARY: admin_token)
        localStorage.setItem('admin_token', accessToken)
        localStorage.setItem('access_token', accessToken) // Fallback compatibility
        localStorage.setItem('admin_refresh_token', refreshToken)

        // Store user info
        localStorage.setItem('user_type', 'admin')
        localStorage.setItem('admin_id', admin.id.toString())
        localStorage.setItem('admin_name', admin.name || '')
        localStorage.setItem('admin_email', admin.email || '')

        navigate('/admin', { replace: true })
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[AdminLogin] Error:', err)
      setError(err.response?.data?.message || err.response?.data?.error || t('admin.login.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex">
      {/* Left branding panel (desktop) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-[#0A0A0B]">
        <div className="px-10 pt-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-extrabold text-white tracking-tight">UR·DEAL</span>
            <span className="text-xs font-bold tracking-widest text-[#FCD34D] uppercase">Admin Console</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10">
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            {t('admin.login.heroTitle')}
          </h1>
          <p className="text-gray-400 text-base mb-10">
            {t('admin.login.heroDesc')}
          </p>

          <div className="space-y-5">
            {[
              { icon: Shield, title: t('admin.login.feature1Title'), desc: t('admin.login.feature1Desc') },
              { icon: BarChart2, title: t('admin.login.feature2Title'), desc: t('admin.login.feature2Desc') },
              { icon: Settings, title: t('admin.login.feature3Title'), desc: t('admin.login.feature3Desc') },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#FCD34D]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#FCD34D]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-10 pb-8">
          <p className="text-xs text-gray-600">{t('admin.login.copyright')}</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <span className="text-2xl font-extrabold text-gray-900 tracking-tight">UR·DEAL</span>
            <span className="text-xs font-bold tracking-widest text-[#F59E0B] uppercase">Admin</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('admin.login.title')}</h2>
            <p className="text-gray-500 text-sm mb-8">{t('admin.login.subtitle')}</p>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder={t('admin.login.emailPlaceholder')}
                    aria-label={t('auth.email')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="admin-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={t('auth.passwordPlaceholder')}
                    aria-label={t('auth.password')}
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="adminRememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 border-gray-300 text-[#F59E0B] focus:ring-[#F59E0B] cursor-pointer rounded"
                />
                <label
                  htmlFor="adminRememberMe"
                  className="text-sm text-gray-600 cursor-pointer select-none"
                >
                  {t('admin.login.rememberEmail')}
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#FCD34D] to-[#F59E0B] hover:opacity-90 disabled:opacity-50 text-[#0A0A0B] font-semibold rounded-xl text-sm transition-all"
              >
                {loading ? t('admin.login.loggingIn') : t('common.login')}
              </button>
            </form>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
            >
              &larr; {t('admin.login.backToHome')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
