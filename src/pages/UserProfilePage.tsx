import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import { loginWithFirebaseToken, logout } from '@/features/auth/login-flow.service'
import { UserInfo } from '@/components/my-page/user-info'
import { MenuList } from '@/components/my-page/menu-list'
import { Footer } from '@/components/my-page/footer'
import BottomNav from '@/components/main/BottomNav'
import { ArrowLeft } from 'lucide-react'

/**
 * 🧹 완전히 단순화된 UserProfilePage
 * - firebase_token 처리는 여기서만
 * - RouteGuard와 협력해 무한 루프 방지
 */
export default function UserProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // ✅ Zustand 스토어 사용 (지역별)
  const authStore = isKorea() ? useAuthKR : useAuthWorld
  const { user, isAuthReady } = authStore()
  
  const [userName, setUserName] = useState('')
  const [isProcessingToken, setIsProcessingToken] = useState(false)
  const hasProcessedToken = useRef(false)

  // ✅ firebase_token 한 번만 처리
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    const userName = searchParams.get('userName')
    
    // 조건: 토큰 있음 + 아직 안 처리 + 인증 준비됨 + 로그인 안 됨
    if (firebaseToken && !hasProcessedToken.current && isAuthReady && !user) {
      hasProcessedToken.current = true
      setIsProcessingToken(true)
      
      console.log('[UserProfilePage] 🔑 firebase_token 발견 - 1회만 처리')
      
      loginWithFirebaseToken(firebaseToken)
        .then(() => {
          console.log('[UserProfilePage] ✅ 로그인 완료, URL 정리 중...')
          setIsProcessingToken(false)
          
          // ✅ URL 완전 정리 - 모든 파라미터 제거
          window.history.replaceState({}, '', '/user/profile')
          console.log('[UserProfilePage] ✅ URL 정리 완료')
        })
        .catch((error) => {
          console.error('[UserProfilePage] ❌ 토큰 처리 실패:', error)
          hasProcessedToken.current = false // 실패 시 재시도 허용
          setIsProcessingToken(false)
          // 실패하면 로그인 페이지로
          navigate('/login', { replace: true })
        })
    } 
    // ✅ 이미 로그인되어 있는데 URL에 토큰이 남아있으면 정리
    else if ((firebaseToken || userName) && user) {
      console.log('[UserProfilePage] 🧹 이미 로그인됨 - URL 파라미터 정리')
      window.history.replaceState({}, '', '/user/profile')
    }
  }, [searchParams, isAuthReady, user, navigate])

  // ✅ 사용자 이름 설정
  useEffect(() => {
    if (user) {
      const name = user?.displayName || localStorage.getItem('user_name') || '사용자'
      setUserName(name)
      
      console.log('[UserProfilePage] ✅ 사용자 정보:', {
        uid: user.uid,
        displayName: user.displayName,
        userName: name
      })
    }
  }, [user])

  // 🔄 로딩 중
  if (!isAuthReady || isProcessingToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isProcessingToken ? '로그인 처리 중...' : '로딩 중...'}
          </p>
        </div>
      </div>
    )
  }

  // 🚫 로그인 안 됨 - RouteGuard에서 처리되지만 안전장치
  if (!user) {
    // firebase_token이 있으면 대기
    const firebaseToken = searchParams.get('firebase_token')
    if (firebaseToken) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
            <p className="text-gray-600">로그인 처리 중...</p>
          </div>
        </div>
      )
    }
    
    // 토큰 없으면 로그인 페이지로
    return <Navigate to="/login" replace />
  }

  // ✅ 로그아웃 핸들러
  const handleLogout = async () => {
    console.log('[UserProfilePage] 로그아웃 시작')
    
    try {
      await logout()
      console.log('[UserProfilePage] ✅ 로그아웃 완료')
      navigate('/', { replace: true })
    } catch (error) {
      console.error('[UserProfilePage] ❌ 로그아웃 실패:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Back Button */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-center text-[18px] font-bold pr-10">마이페이지</h1>
        </div>
      </div>

      {/* User Info Section */}
      <UserInfo userName={userName} />

      {/* Menu List Section */}
      <MenuList />

      {/* Logout Button Section */}
      <div className="px-5 py-6">
        <button 
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3.5 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          로그아웃
        </button>
      </div>

      {/* Footer Section */}
      <Footer />
      
      {/* Bottom Navigation Spacer */}
      <div className="h-20" aria-hidden="true"></div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
