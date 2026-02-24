import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getUserId, getUserName, logout } from '@/utils/auth'
import { UserInfo } from '@/components/my-page/user-info'
import { MenuList } from '@/components/my-page/menu-list'
import { LogoutButton } from '@/components/my-page/logout-button'
import { Footer } from '@/components/my-page/footer'

export default function UserProfilePage() {
  const navigate = useNavigate()
  const { isLoggedIn, isAuthReady } = useAuth()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // ✅ JWT 인증 확인
    if (!isAuthReady) {
      return // 인증 초기화 대기
    }

    if (!isLoggedIn) {
      // JWT 토큰 없으면 로그인 페이지로 리다이렉트
      console.log('[UserProfilePage] 로그인 필요 - /login으로 리다이렉트')
      navigate('/login?returnUrl=/user/profile')
      return
    }

    // ✅ JWT에서 사용자 정보 가져오기
    const name = getUserName()
    setUserName(name || '게스트')
    
    console.log('[UserProfilePage] 사용자 정보 로드:', {
      userId: getUserId(),
      userName: name,
      isLoggedIn
    })
  }, [isAuthReady, isLoggedIn, navigate])

  const handleLogout = () => {
    console.log('[UserProfilePage] 로그아웃 처리')
    
    // ✅ JWT 로그아웃 (auth.ts의 logout 함수 사용)
    logout()
    
    // 홈페이지로 리다이렉트
    navigate('/')
  }

  if (!isAuthReady || !isLoggedIn) {
    return null // 로그인 페이지로 리다이렉트 중
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
    </div>
  )
}
