import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/api/auth/login', {
        username: email, // API uses 'username' field
        password,
        userType: 'admin'
      })

      if (response.data.success) {
        const sessionToken = response.data.data.sessionToken
        const adminId = response.data.data.user.id
        
        console.log('[AdminLogin] 🚀 Login API successful')
        console.log('[AdminLogin] Session token:', sessionToken)
        console.log('[AdminLogin] Admin ID:', adminId)
        
        // 🔴 중요: user_type을 가장 먼저 설정!
        console.log('[AdminLogin] Step 1: Setting user_type to admin...')
        localStorage.setItem('user_type', 'admin')
        
        console.log('[AdminLogin] Step 2: Setting session token...')
        localStorage.setItem('admin_session_token', sessionToken)
        
        console.log('[AdminLogin] Step 3: Setting admin ID...')
        localStorage.setItem('admin_id', adminId.toString())
        
        // 🔍 검증
        const verifyUserType = localStorage.getItem('user_type')
        const verifySessionToken = localStorage.getItem('admin_session_token')
        
        if (verifyUserType === 'admin' && verifySessionToken === sessionToken) {
          console.log('[AdminLogin] ✅ Verification passed! Navigating to /admin...')
          navigate('/admin', { replace: true })
        } else {
          console.error('[AdminLogin] ❌ Verification failed!')
          setError('로그인 성공했으나 데이터 저장에 실패했습니다. 다시 시도해주세요.')
        }
      } else {
        setError(response.data.error || '로귵58인 실패')
      }
    } catch (err: any) {
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
          <p className="text-gray-600 mt-2">유어 라이브 관리자 대시보드</p>
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
                placeholder="admin@ur-team.com"
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

          {/* Test Credentials Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              💡 테스트 계정: admin@ur-team.com / admin123
            </p>
          </div>
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
