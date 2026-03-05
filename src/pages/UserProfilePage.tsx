import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { UserInfo } from '@/components/my-page/user-info'
import { MenuList } from '@/components/my-page/menu-list'
import { LogoutButton } from '@/components/my-page/logout-button'
import { Footer } from '@/components/my-page/footer'
import BottomNav from '@/components/main/BottomNav'
import { ArrowLeft } from 'lucide-react'

export default function UserProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  // ✅ Zustand 스토어 사용 (지역별)
  const authStore = isKorea() ? useAuthKR : useAuthWorld
  const { user, isAuthReady, logout: authLogout } = authStore()
  const isLoggedIn = !!user
  
  const [userName, setUserName] = useState('')
  const [isProcessingToken, setIsProcessingToken] = useState(false)
  const hasProcessedToken = useRef(false)

  // ✅ firebase_token 강제 처리 로직
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    
    // 토큰이 있고, 아직 처리 안 했고, 인증 준비됨
    if (firebaseToken && !hasProcessedToken.current && isAuthReady) {
      hasProcessedToken.current = true
      setIsProcessingToken(true)
      
      console.log('[UserProfilePage] 🔑 firebase_token 발견 - 자동 로그인 처리')
      
      signInWithCustomToken(auth, firebaseToken)
        .then(() => {
          console.log('[UserProfilePage] ✅ Firebase 로그인 성공')
          
          // URL에서 토큰 제거 (무한 루프 방지)
          const newUrl = new URL(window.location.href)
          newUrl.searchParams.delete('firebase_token')
          newUrl.searchParams.delete('userName')
          window.history.replaceState({}, '', newUrl.toString())
          
          setIsProcessingToken(false)
        })
        .catch((error) => {
          console.error('[UserProfilePage] ❌ Firebase 로그인 실패:', error)
          hasProcessedToken.current = false // 실패 시 재시도 허용
          setIsProcessingToken(false)
          navigate('/login', { replace: true })
        })
      
      return
    }
  }, [searchParams, isAuthReady, navigate])

  useEffect(() => {
    // ✅ 토큰 처리 중에는 대기
    if (isProcessingToken) {
      console.log('[UserProfilePage] ⏳ 토큰 처리 중...')
      return
    }

    // ✅ 1. isAuthReady 가드: 인증 초기화 전에는 대기
    if (!isAuthReady) {
      console.log('[UserProfilePage] ⏳ 인증 초기화 대기 중...')
      return
    }

    // ✅ 2. 로그인 체크: isAuthReady 후에만 실행
    if (!isLoggedIn) {
      // firebase_token이 있으면 리다이렉트 지연
      const firebaseToken = searchParams.get('firebase_token')
      if (firebaseToken) {
        console.log('[UserProfilePage] ⏳ firebase_token 있음 - 로그인 처리 대기 중...')
        return
      }
      
      console.log('[UserProfilePage] ❌ 로그인 필요 - /login으로 리다이렉트')
      // 🎯 스마트 리다이렉트: 현재 페이지를 returnUrl로 저장
      sessionStorage.setItem('returnUrl', '/user/profile')
      navigate('/login', { replace: true })
      return
    }

    // ✅ 3. Firebase User에서 사용자 이름 가져오기 (Single Source of Truth)
    // displayName이 없으면 localStorage의 user_name 사용 (카카오 로그인 시 저장됨)
    const name = user?.displayName || localStorage.getItem('user_name') || '사용자'
    setUserName(name)
    
    console.log('[UserProfilePage] ✅ 사용자 정보 로드:', {
      uid: user?.uid,
      displayName: user?.displayName,
      email: user?.email,
      userName: name,
      isLoggedIn
    })
  }, [isAuthReady, isLoggedIn, user, navigate, searchParams, isProcessingToken])

  const handleLogout = async () => {
    console.log('[UserProfilePage] 로그아웃 처리')
    
    try {
      // ✅ AuthContext의 logout 사용 (Firebase + localStorage 모두 처리)
      await authLogout()
      
      console.log('[UserProfilePage] ✅ 로그아웃 완료')
      // 홈페이지로 리다이렉트
      navigate('/')
    } catch (error) {
      console.error('[UserProfilePage] ❌ 로그아웃 실패:', error)
    }
  }

  // ✅ 4. 토큰 처리 중 또는 isAuthReady 전에는 로딩 표시
  if (isProcessingToken || !isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-600">{isProcessingToken ? '로그인 처리 중...' : '로딩 중...'}</p>
        </div>
      </div>
    )
  }

  // ✅ 5. 로그인 안 됨: 리다이렉트 중
  if (!isLoggedIn) {
    return null
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
