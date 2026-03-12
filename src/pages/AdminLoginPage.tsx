import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { clearAuthData } from '@/utils/auth'
import { clearFirebaseTokenCache } from '@/lib/api'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ✅ Remember Me 이메일 불러오기 (리다이렉트는 PublicRoute(forAdmin)에서 처리)
  useEffect(() => {
    const savedEmail = localStorage.getItem('admin_remember_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('[AdminLogin] 🔐 Starting JWT-only login (NO Firebase!)')
      
      // ✅ CRITICAL: User 세션 + Firebase 완전 정리 (토큰 캐시 포함)
      clearAuthData('user')
      clearFirebaseTokenCache()
      try {
        const { signOut } = await import('@/lib/firebase-auth')
        await signOut()
      } catch (_) {}
      
      // 🔐 JWT-based Login (NO Firebase!)
      const response = await api.post('/api/admin/login', {
        email,
        password
      })

      if (response.data.success) {
        console.log('[AdminLogin] ✅ JWT Login successful')
        
        // ✅ Save email if "Remember Me" is checked
        if (rememberMe) {
          localStorage.setItem('admin_remember_email', email)
        } else {
          localStorage.removeItem('admin_remember_email')
        }
        
        // ✅ 선택적 삭제: Admin 관련 키만 삭제 (User 세션 보호)
        clearAuthData('admin')
        
        const { admin, accessToken, refreshToken } = response.data.data
        
        console.log('[AdminLogin] Admin ID:', admin.id)
        
        // ✅ Store JWT tokens (PRIMARY: admin_token)
        localStorage.setItem('admin_token', accessToken)
        localStorage.setItem('access_token', accessToken) // Fallback compatibility
        localStorage.setItem('admin_refresh_token', refreshToken)
        
        // Store user info
        localStorage.setItem('user_type', 'admin')
        localStorage.setItem('admin_id', admin.id.toString())
        // ❌ user_id, user_name 삭제: User 세션과 충돌 방지
        // localStorage.setItem('user_id', admin.id.toString())
        // localStorage.setItem('user_name', admin.name || admin.email)
        localStorage.setItem('admin_name', admin.name || '')
        localStorage.setItem('admin_email', admin.email || '')
        
        console.log('[AdminLogin] ✅ Admin 로그인 완료, /admin 이동')
        navigate('/admin', { replace: true })
      }
    } catch (err: any) {
      console.error('[AdminLogin] ❌ Error:', err)
      setError(err.response?.data?.message || err.response?.data?.error || '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">👨‍💼</h1>
          <h2 className="text-2xl font-bold text-gray-900">관리자 로그인</h2>
          <p className="text-gray-600 mt-2">리스터코퍼레이션 관리자 대시보드</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="관리자 이메일을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="adminRememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer rounded"
              />
              <label 
                htmlFor="adminRememberMe" 
                className="ml-2 text-sm text-gray-700 cursor-pointer select-none"
              >
                이메일 기억하기
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>


        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}
