import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { UserInfo } from '@/components/my-page/user-info'
import { MenuList } from '@/components/my-page/menu-list'
import { LogoutButton } from '@/components/my-page/logout-button'
import { Footer } from '@/components/my-page/footer'
import BottomNav from '@/components/main/BottomNav'

export default function UserProfilePage() {
  const navigate = useNavigate()
  const { user, isLoggedIn, isAuthReady, logout: authLogout } = useAuth()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // ✅ 1. isAuthReady 가드: 인증 초기화 전에는 대기
    if (!isAuthReady) {
      console.log('[UserProfilePage] ⏳ 인증 초기화 대기 중...')
      return
    }

    // ✅ 2. 로그인 체크: isAuthReady 후에만 실행
    if (!isLoggedIn) {
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
  }, [isAuthReady, isLoggedIn, user, navigate])

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

  // ✅ 4. isAuthReady 전에는 로딩 표시
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
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
