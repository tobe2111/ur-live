import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { clearAuthData } from '@/utils/auth'
import { clearFirebaseTokenCache } from '@/lib/api'
import { Mail, Lock, Eye, EyeOff, TrendingUp, Package, Users, ArrowRight } from 'lucide-react'

export default function SellerLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('seller_remember_email')
    if (saved) { setFormData(prev => ({ ...prev, email: saved })); setRememberMe(true) }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.post('/api/seller/login', {
        email: formData.email,
        password: formData.password,
      })
      if (response.data.success) {
        if (rememberMe) {
          localStorage.setItem('seller_remember_email', formData.email)
        } else {
          localStorage.removeItem('seller_remember_email')
        }
        const { seller, accessToken, refreshToken } = response.data.data
        clearFirebaseTokenCache()
        clearAuthData('user')
        import('@/lib/firebase-auth').then(({ signOut }) => signOut()).catch(() => {})
        localStorage.setItem('seller_token', accessToken)
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('seller_refresh_token', refreshToken)
        localStorage.setItem('user_type', 'seller')
        localStorage.setItem('seller_id', seller.id.toString())
        localStorage.setItem('seller_name', seller.name || '')
        localStorage.setItem('seller_email', seller.email || '')
        navigate('/seller', { replace: true })
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '이메일 또는 비밀번호를 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex">
      {/* 왼쪽 브랜딩 패널 (데스크탑) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col bg-white border-r border-gray-200">
        <div className="px-10 pt-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <span className="text-white text-lg font-bold">U</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Ur Seller</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-3">
            라이브 커머스를<br />더 쉽게, 더 빠르게
          </h1>
          <p className="text-gray-500 text-base mb-10">
            Ur 셀러 대시보드로 상품 관리부터 정산까지<br />한 곳에서 관리하세요.
          </p>

          <div className="space-y-5">
            {[
              { icon: <TrendingUp className="w-5 h-5 text-blue-600" />, title: '실시간 매출 현황', desc: '라이브 방송 중 실시간 주문·매출 확인' },
              { icon: <Package className="w-5 h-5 text-blue-600" />, title: '통합 주문 관리', desc: '주문 처리부터 배송 추적까지 한눈에' },
              { icon: <Users className="w-5 h-5 text-blue-600" />, title: '정산 자동화', desc: '수수료 계산 및 정산 내역 자동 처리' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-10 pb-8 text-xs text-gray-400">© 2026 Ur Team. All rights reserved.</div>
      </div>

      {/* 오른쪽 로그인 폼 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* 모바일 로고 */}
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <span className="text-white text-lg font-bold">U</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Ur Seller</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">{t('common.login')}</h2>
              <p className="text-sm text-gray-500 mt-1">셀러 계정으로 로그인하세요</p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 이메일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={e => setFormData(d => ({ ...d, email: e.target.value }))}
                    required
                    autoComplete="email"
                    disabled={loading}
                    placeholder="seller@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                  />
                </div>
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={e => setFormData(d => ({ ...d, password: e.target.value }))}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full pl-10 pr-11 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 이메일 기억하기 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRememberMe(v => !v)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    rememberMe ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                  }`}
                >
                  {rememberMe && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                      <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span
                  onClick={() => setRememberMe(v => !v)}
                  className="text-sm text-gray-600 cursor-pointer select-none"
                >
                  이메일 기억하기
                </span>
              </div>

              {/* 로그인 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  <>로그인 <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                아직 판매자 계정이 없으신가요?{' '}
                <Link to="/seller/signup" className="text-blue-600 font-medium hover:text-blue-700 transition-colors">
                  가입하기
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-gray-400">
            문의:{' '}
            <a href="mailto:support@ur-team.com" className="hover:text-gray-600 underline transition-colors">
              support@ur-team.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
