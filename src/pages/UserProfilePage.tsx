import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserInfo } from '@/components/my-page/user-info'
import { MenuList } from '@/components/my-page/menu-list'
import { LogoutButton } from '@/components/my-page/logout-button'
import { Footer } from '@/components/my-page/footer'

export default function UserProfilePage() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // Check if user is logged in
    const sessionToken = localStorage.getItem('user_session_token')
    const storedUserName = localStorage.getItem('user_name')
    
    if (sessionToken) {
      setIsLoggedIn(true)
      setUserName(storedUserName || '게스트')
    } else {
      // Redirect to login if not authenticated
      navigate('/login')
    }
  }, [navigate])

  const handleLogout = () => {
    // Clear all user data from localStorage
    const keysToRemove = [
      'user_session_token',
      'user_id',
      'user_name',
      'user_email',
      'user_type',
      'user_profile_image'
    ]
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    // Redirect to home page
    navigate('/')
  }

  if (!isLoggedIn) {
    return null // Will redirect to login
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
