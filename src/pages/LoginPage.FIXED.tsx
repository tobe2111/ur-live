/**
 * 🔐 LoginPage - 무한 루프 완전 해결 버전
 * 
 * 핵심:
 * 1. ✅ PublicRoute로 감싸져 있으므로 여기서는 리다이렉트 로직 불필요
 * 2. ✅ useEffect dependency 명확히 설정
 * 3. ✅ 로그인 성공 후 navigate는 한 번만 호출
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const DEBUG = true

export default function LoginPage() {
  const { user, loading, loginWithEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ✅ 디버그 로그 (매 렌더링마다)
  if (DEBUG) {
    console.log('[LoginPage] Render:', {
      user: user?.uid,
      loading,
      pathname: location.pathname
    })
  }

  // ✅ 이미 로그인되어 있으면 PublicRoute가 자동으로 리다이렉트함
  // 여기서는 별도 useEffect 불필요!
  useEffect(() => {
    if (!loading && user) {
      if (DEBUG) console.log('[LoginPage] ✅ 이미 로그인됨 (PublicRoute가 리다이렉트 처리)')
    }
  }, [user, loading])

  // ============================================
  // 🔥 이메일 로그인 처리
  // ============================================
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      if (DEBUG) console.log('[LoginPage] 🔑 이메일 로그인 시도...')
      
      await loginWithEmail(email, password)
      
      if (DEBUG) console.log('[LoginPage] ✅ 로그인 성공!')

      // ✅ 로그인 성공 시 리다이렉트
      // location.state.from이 있으면 그곳으로, 없으면 홈으로
      const from = (location.state as any)?.from || '/'
      
      if (DEBUG) console.log('[LoginPage] 🚀 리다이렉트:', from)
      navigate(from, { replace: true })
      
    } catch (err: any) {
      console.error('[LoginPage] ❌ 로그인 실패:', err)
      setError(err.message || '로그인에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ============================================
  // 🔥 카카오 로그인 처리
  // ============================================
  const handleKakaoLogin = () => {
    if (DEBUG) console.log('[LoginPage] 🍫 카카오 로그인 시작...')
    
    // 현재 경로를 state로 저장
    const currentPath = location.pathname
    const returnUrl = (location.state as any)?.from || '/'
    
    // 카카오 로그인 URL로 이동
    window.location.href = `/auth/kakao/sync?state=${encodeURIComponent(returnUrl)}`
  }

  // ============================================
  // 🎨 UI Render
  // ============================================

  // ✅ loading 중이면 로딩 UI
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">로그인</h1>
          <p className="mt-2 text-sm text-gray-600">
            UR Live에 오신 것을 환영합니다
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        {/* 이메일 로그인 폼 */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="••••••••"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2 text-white bg-primary rounded-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {isSubmitting ? '로그인 중...' : '이메일로 로그인'}
          </button>
        </form>

        {/* 구분선 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">또는</span>
          </div>
        </div>

        {/* 카카오 로그인 */}
        <button
          onClick={handleKakaoLogin}
          className="w-full px-4 py-2 text-gray-900 bg-yellow-300 rounded-md hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 font-medium"
        >
          🍫 카카오로 계속하기
        </button>

        {/* 회원가입 링크 */}
        <p className="text-center text-sm text-gray-600">
          계정이 없으신가요?{' '}
          <a href="/signup" className="font-medium text-primary hover:underline">
            회원가입
          </a>
        </p>
      </div>
    </div>
  )
}
