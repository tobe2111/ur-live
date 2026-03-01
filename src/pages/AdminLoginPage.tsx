import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { getUserType } from '@/utils/auth'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { isLoggedIn, isAuthReady } = useAuth()
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
      } else {
        console.log('[AdminLoginPage] 다른 사용자 타입으로 로그인됨:', userType)
        // 관리자가 아닌 경우 로그아웃 필요
        setError('관리자 계정으로 로그인해주세요.')
      }
    }
  }, [isAuthReady, isLoggedIn, navigate])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 🔥 Firebase Auth 엔드포인트 사용
      const response = await api.post('/api/admin/login', {
        email,
        password
      })

      if (response.data.success) {
        // ✅ 1단계: 기존 세션 완전 삭제
        console.log('[AdminLogin] Step 0: Clearing old sessions...')
        localStorage.clear()
        
        // ✅ 2단계: Firebase Custom Token 및 Admin 정보 저장
        const { customToken, admin } = response.data.data
        
        console.log('[AdminLogin] 🔥 Firebase Login successful')
        console.log('[AdminLogin] Custom Token:', customToken?.substring(0, 20) + '...')
        console.log('[AdminLogin] Admin ID:', admin.id)
        
        // Firebase Auth로 로그인 (같은 패턴 사용)
        const { signInWithCustomToken } = await import('firebase/auth')
        const { auth } = await import('@/lib/firebase')
        
        console.log('[AdminLogin] Step 1: Signing in with Custom Token...')
        const userCredential = await signInWithCustomToken(auth, customToken)
        
        console.log('[AdminLogin] Step 2: Getting ID Token...')
        const idToken = await userCredential.user.getIdToken()
        
        console.log('[AdminLogin] Step 3: Storing tokens...')
        localStorage.setItem('firebase_token', idToken)
        localStorage.setItem('user_type', 'admin')
        localStorage.setItem('admin_id', admin.id.toString())
        localStorage.setItem('user_id', admin.id.toString())
        localStorage.setItem('user_name', admin.name || admin.email)
        
        // 🔍 검증
        const verifyUserType = localStorage.getItem('user_type')
        const verifyToken = localStorage.getItem('firebase_token')
        
        if (verifyUserType === 'admin' && verifyToken === idToken) {
          console.log('[AdminLogin] ✅ Firebase verification passed! Navigating to /admin...')
          navigate('/admin', { replace: true })
        } else {
          console.error('[AdminLogin] ❌ Firebase verification failed!')
          setError('로그인 성공했으나 데이터 저장에 실패했습니다. 다시 시도해주세요.')
        }
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
