import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { isKorea } from '@/config/region'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { getUserType } from '@/utils/auth'
import { ArrowLeft } from 'lucide-react'

export default function SellerLoginPage() {
  const navigate = useNavigate()
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  const isAuthReady = useAuth(state => state.isAuthReady)
  const user = useAuth(state => state.user)
  const isLoggedIn = !!user
  const logout = useAuth(state => state.logout)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ✅ 이미 로그인되어 있고 판매자면 리다이렉트
  useEffect(() => {
    if (isAuthReady && isLoggedIn) {
      const userType = getUserType()
      if (userType === 'seller') {
        console.log('[SellerLoginPage] 이미 판매자 로그인됨 - /seller로 리다이렉트')
        navigate('/seller', { replace: true })
      } else if (userType) {
        console.log('[SellerLoginPage] 다른 사용자 타입으로 로그인됨:', userType, '- 자동 로그아웃')
        // 판매자가 아닌 경우 자동 로그아웃
        logout()
        setError('판매자 계정으로 로그인해주세요.')
      }
    }
  }, [isAuthReady, isLoggedIn, navigate, logout])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // 🔐 JWT-based Login (NO Firebase!)
      const response = await api.post('/api/seller/login', {
        email: formData.email,
        password: formData.password
      })

      if (response.data.success) {
        // Clear old sessions
        console.log('[SellerLogin] Clearing old sessions...')
        localStorage.clear()
        
        // ⚠️ SECURITY: Store minimal user info ONLY (NO tokens in localStorage)
        // Tokens are securely stored in HttpOnly cookies
        const { seller } = response.data.data
        
        console.log('[SellerLogin] ✅ JWT Login successful')
        console.log('[SellerLogin] Seller ID:', seller.id)
        console.log('[SellerLogin] ⚠️ Tokens stored in HttpOnly cookies (secure)')
        
        // Store user info only (NO tokens!)
        localStorage.setItem('user_type', 'seller')
        localStorage.setItem('seller_id', seller.id.toString())
        localStorage.setItem('user_id', seller.id.toString())
        localStorage.setItem('user_name', seller.name || seller.email)
        localStorage.setItem('seller_name', seller.name || '')
        localStorage.setItem('seller_email', seller.email || '')
        
        console.log('[SellerLogin] ✅ User info saved to localStorage')
        console.log('  - user_type:', localStorage.getItem('user_type'))
        console.log('  - seller_id:', seller.id)
        console.log('  - Tokens: HttpOnly cookies only (XSS-protected)')
        
        // Navigate to seller dashboard
        console.log('[SellerLogin] ✅ Navigating to /seller...')
        navigate('/seller', { replace: true })
      }
    } catch (error: any) {
      console.error('[SellerLogin] Error:', error)
      setError(error.response?.data?.error || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-900 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-sm font-medium">홈으로</span>
          </button>
          <h1 className="text-lg font-medium tracking-tight text-gray-900">
            Seller Login
          </h1>
          <div className="w-20" /> {/* Spacer for center alignment */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo/Brand */}
          <div className="text-center mb-12">
            <h2 className="text-2xl font-light tracking-tight text-gray-900 mb-2">
              Ur Seller
            </h2>
            <p className="text-sm text-gray-500 font-light">
              판매자 로그인
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800 text-center font-light">
                {error}
              </p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide uppercase">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 bg-white text-sm font-light placeholder-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
                placeholder="이메일을 입력하세요"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2 tracking-wide uppercase">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 bg-white text-sm font-light placeholder-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
                placeholder="비밀번호를 입력하세요"
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gray-900 text-white text-sm font-medium tracking-wider uppercase hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed mt-8"
            >
              {loading ? '로그인 중...' : 'Sign In'}
            </button>
          </form>

          {/* Links */}
          <div className="mt-8 text-center space-y-3">
            <p className="text-xs text-gray-500 font-light">
              아직 판매자 계정이 없으신가요?
            </p>
            <Link
              to="/seller/signup"
              className="inline-block text-xs text-gray-900 hover:text-gray-600 transition-colors border-b border-gray-900 pb-0.5"
            >
              판매자 가입하기
            </Link>
          </div>

          {/* Divider */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center font-light leading-relaxed">
              로그인에 문제가 있으신가요?<br />
              <a 
                href="mailto:support@ur-team.com" 
                className="text-gray-600 hover:text-gray-900 transition-colors underline"
              >
                support@ur-team.com
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-screen-xl mx-auto px-6 py-6">
          <p className="text-xs text-gray-400 text-center font-light">
            © 2026 Ur Team. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
