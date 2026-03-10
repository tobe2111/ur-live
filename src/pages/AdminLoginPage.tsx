import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { getUserType } from '@/utils/auth'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  
  // ✅ Region 기반 Store 선택
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  
  // ✅ Selector로 필요한 상태만 구독
  const user = useAuth(state => state.user)
  const isAuthReady = useAuth(state => state.isAuthReady)
  const logout = useAuth(state => state.logout)
  
  // ✅ 계산된 값
  const isLoggedIn = !!user
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ✅ 이미 로그인되어 있고 관리자면 리다이렉트
  useEffect(() => {
    if (isAuthReady && isLoggedIn) {
      const userType = getUserType()
      if (userType === 'admin') {
        console.log('[AdminLoginPage] 이미 관리자 로그인됨 - /admin으로 리다이렉트')
        navigate('/admin', { replace: true })
      } else if (userType) {
        console.log('[AdminLoginPage] 다른 사용자 타입으로 로그인됨:', userType, '- 자동 로그아웃')
        // 관리자가 아닌 경우 자동 로그아웃
        logout()
        setError('관리자 계정으로 로그인해주세요.')
      }
    }
  }, [isAuthReady, isLoggedIn, navigate, logout])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 🔐 JWT-based Login (NO Firebase!)
      const response = await api.post('/api/admin/login', {
        email,
        password
      })

      if (response.data.success) {
        // Clear old sessions
        console.log('[AdminLogin] Clearing old sessions...')
        localStorage.clear()
        
        const { admin, accessToken, refreshToken } = response.data.data
        
        console.log('[AdminLogin] ✅ JWT Login successful')
        console.log('[AdminLogin] Admin ID:', admin.id)
        
        // ✅ Store JWT tokens (required for authentication)
        if (accessToken) {
          localStorage.setItem('access_token', accessToken)
        }
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken)
        }
        
        // Store user info
        localStorage.setItem('user_type', 'admin')
        localStorage.setItem('admin_id', admin.id.toString())
        localStorage.setItem('user_id', admin.id.toString())
        localStorage.setItem('user_name', admin.name || admin.email)
        
        console.log('[AdminLogin] ✅ Tokens and user info saved to localStorage')
        console.log('  - user_type:', localStorage.getItem('user_type'))
        console.log('  - admin_id:', admin.id)
        console.log('  - access_token:', accessToken ? 'stored' : 'missing')
        
        // Navigate to admin dashboard
        console.log('[AdminLogin] ✅ Navigating to /admin...')
        navigate('/admin', { replace: true })
      } else {
        setError(response.data.error || '로그인 실패')
      }
    } catch (err: any) {
      console.error('[AdminLogin] Error:', err)
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
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
