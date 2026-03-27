import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import { loginWithFirebaseToken, logout } from '@/features/auth/login-flow.service'
import { getUserProfileImage } from '@/utils/auth'
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
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined)
  const [isProcessingToken, setIsProcessingToken] = useState(false)
  const hasProcessedToken = useRef(false)

  // ✅ firebase_token 한 번만 처리
  // 의존성에서 searchParams, user 제거 → 무한 루프 방지
  // searchParams는 마운트 시 읽고, user 변화는 hasProcessedToken으로 제어
  useEffect(() => {
    const firebaseToken = searchParams.get('firebase_token')
    const userNameParam = searchParams.get('userName')
    const profileImageParam = searchParams.get('profileImage')

    // ✅ 이미 로그인되어 있고 URL에 파라미터가 있으면 즉시 정리
    const currentUser = authStore.getState().user
    if ((firebaseToken || userNameParam) && currentUser) {
      console.log('[UserProfilePage] 🧹 이미 로그인됨 - URL 파라미터 정리')
      if (userNameParam) localStorage.setItem('user_name', userNameParam)
      if (profileImageParam) localStorage.setItem('user_profile_image', profileImageParam)
      navigate('/user/profile', { replace: true })
      return
    }

    // 조건: 토큰 있음 + 아직 안 처리 + 로그인 안 됨
    if (firebaseToken && !hasProcessedToken.current && !currentUser) {
      hasProcessedToken.current = true
      setIsProcessingToken(true)

      if (userNameParam) {
        localStorage.setItem('user_name', userNameParam)
        console.log('[UserProfilePage] ✅ user_name 저장:', userNameParam)
      }
      if (profileImageParam) {
        localStorage.setItem('user_profile_image', profileImageParam)
        console.log('[UserProfilePage] ✅ user_profile_image 저장')
      }

      console.log('[UserProfilePage] 🔑 firebase_token 발견 - 1회만 처리')

      loginWithFirebaseToken(firebaseToken)
        .then(async () => {
          console.log('[UserProfilePage] ✅ 로그인 완료 - Auth State 동기화됨')

          try {
            const { isKorea } = await import('@/shared/config/region')
            const { useAuthKR } = await import('@/shared/stores/useAuthKR')
            const { useAuthWorld } = await import('@/shared/stores/useAuthWorld')
            const firebaseUser = (isKorea() ? useAuthKR : useAuthWorld).getState().user
            if (firebaseUser && (!firebaseUser.displayName || !firebaseUser.photoURL)) {
              const { updateProfile } = await import('firebase/auth')
              await updateProfile(firebaseUser, {
                ...(userNameParam && !firebaseUser.displayName ? { displayName: userNameParam } : {}),
                ...(profileImageParam && !firebaseUser.photoURL ? { photoURL: profileImageParam } : {}),
              })
              if (isKorea()) {
                useAuthKR.getState().setUser({ ...firebaseUser } as any)
              } else {
                useAuthWorld.getState().setUser({ ...firebaseUser } as any)
              }
              console.log('[UserProfilePage] ✅ Firebase 프로필 업데이트 완료')
            }
          } catch (e) {
            console.warn('[UserProfilePage] ⚠️ Firebase 프로필 업데이트 실패 (무시):', e)
          }

          navigate('/user/profile', { replace: true })
          setIsProcessingToken(false)
        })
        .catch((error) => {
          console.error('[UserProfilePage] ❌ 토큰 처리 실패:', error)
          hasProcessedToken.current = false
          setIsProcessingToken(false)
          navigate('/login', { replace: true })
        })
    }
  }, [isAuthReady]) // ✅ isAuthReady만 의존: auth 준비 완료 시 1회 실행

  // ✅ 사용자 이름 + 프로필 이미지 설정
  useEffect(() => {
    if (user) {
      const name = user?.displayName || localStorage.getItem('user_name') || '사용자'
      setUserName(name)
      const image = user.photoURL || getUserProfileImage() || undefined
      setProfileImage(image)
      
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

  // 🚫 로그인 안 됨 - firebase_token 처리 중이거나 토큰이 있으면 대기
  if (!user) {
    const firebaseToken = searchParams.get('firebase_token')
    
    // firebase_token이 있거나 처리 중이면 대기 (리다이렉트 방지)
    if (firebaseToken || isProcessingToken) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
            <p className="text-gray-600">로그인 처리 중...</p>
          </div>
        </div>
      )
    }
    
    // 토큰 없고 처리 중도 아니면 로그인 페이지로
    console.log('[UserProfilePage] 🚫 로그인 필요 - /login으로 리다이렉트')
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
      <UserInfo userName={userName} profileImage={profileImage} />

      {/* Menu List Section */}
      <MenuList />

      {/* Logout Button Section */}
      <div className="px-5 py-6 space-y-3">
        <button 
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3.5 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          로그아웃
        </button>

        {/* Account Settings Button */}
        <button 
          onClick={() => navigate('/account/settings')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          계정 설정
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
