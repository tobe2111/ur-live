import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { ArrowLeft } from 'lucide-react'
import { clearAuthData } from '@/utils/auth'

export default function SellerLoginPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ✅ 이미 셀러 로그인되어 있으면 리다이렉트 (Firebase 절대 사용 안 함!)
  useEffect(() => {
    const sellerToken = localStorage.getItem('seller_token')
    const userType = localStorage.getItem('user_type')
    
    if (sellerToken && userType === 'seller') {
      console.log('[SellerLoginPage] 이미 판매자 로그인됨 - /seller로 리다이렉트')
      navigate('/seller', { replace: true })
      return
    }

    // Load saved email if "Remember Me" was checked
    const savedEmail = localStorage.getItem('seller_remember_email')
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }))
      setRememberMe(true)
    }
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      console.log('[SellerLogin] 🔐 Starting JWT-only login (NO Firebase!)')
      
      // 🔐 JWT-based Login (NO Firebase!)
      const response = await api.post('/api/seller/login', {
        email: formData.email,
        password: formData.password
      })

      if (response.data.success) {
        console.log('[SellerLogin] ✅ JWT Login successful')
        
        // ✅ Save email if "Remember Me" is checked
        if (rememberMe) {
          localStorage.setItem('seller_remember_email', formData.email)
        } else {
          localStorage.removeItem('seller_remember_email')
        }
        
        // ✅ 선택적 삭제: Seller 관련 키만 삭제 (User 세션 보호)
        clearAuthData('seller')
        
        const { seller, accessToken, refreshToken } = response.data.data
        
        console.log('[SellerLogin] Seller ID:', seller.id)
        
        // ✅ Store JWT tokens (PRIMARY: seller_token)
        localStorage.setItem('seller_token', accessToken)
        localStorage.setItem('access_token', accessToken) // Fallback compatibility
        localStorage.setItem('seller_refresh_token', refreshToken)
        
        // Store user info
        localStorage.setItem('user_type', 'seller')
        localStorage.setItem('seller_id', seller.id.toString())
        // ❌ user_id, user_name 삭제: User 세션과 충돌 방지
        // localStorage.setItem('user_id', seller.id.toString())
        // localStorage.setItem('user_name', seller.name || seller.email)
        localStorage.setItem('seller_name', seller.name || '')
        localStorage.setItem('seller_email', seller.email || '')
        
        console.log('[SellerLogin] ✅ Tokens and user info saved')
        console.log('  ✅ seller_token:', accessToken ? 'STORED' : 'MISSING')
        console.log('  ✅ user_type:', 'seller')
        console.log('  ✅ seller_id:', seller.id)
        
        // Navigate to seller dashboard
        console.log('[SellerLogin] ✅ Navigating to /seller...')
        navigate('/seller', { replace: true })
      }
    } catch (error: any) {
      console.error('[SellerLogin] ❌ Error:', error)
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
                autoComplete="email"
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
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 bg-white text-sm font-light placeholder-gray-400 focus:border-gray-900 focus:outline-none transition-colors"
                placeholder="비밀번호를 입력하세요"
                disabled={loading}
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border-gray-300 text-gray-900 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer"
              />
              <label 
                htmlFor="rememberMe" 
                className="ml-2 text-sm text-gray-700 font-light cursor-pointer select-none"
              >
                이메일 기억하기
              </label>
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
