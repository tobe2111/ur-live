import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, User } from 'lucide-react'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function TopNav() {
  const navigate = useNavigate()
  const krUser = useAuthKR(state => state.user)
  const worldUser = useAuthWorld(state => state.user)
  const user = isKorea() ? krUser : worldUser
  const isLoggedIn = !!user
  const [menuOpen, setMenuOpen] = useState(false)

  const handleProfileClick = () => {
    if (isLoggedIn) {
      navigate('/user/profile')
    } else {
      // 로그인되지 않은 경우 로그인 페이지로
      navigate('/login?returnUrl=/user/profile')
    }
  }

  const handleSearchClick = () => {
    navigate('/search')
  }

  const handleNotificationClick = () => {
    if (isLoggedIn) {
      // TODO: 알림 페이지 또는 모달 구현
      console.log('알림 클릭')
      // 임시로 알림 표시
      alert('알림 기능은 준비 중입니다.')
    } else {
      navigate('/login?returnUrl=/')
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open menu"
              className="p-1 text-foreground"
            >
              <Menu className="h-6 w-6" strokeWidth={1.5} />
            </button>

            <h1 className="text-xl font-extrabold tracking-tighter text-foreground uppercase">
              UR <span className="text-accent-foreground" style={{ color: '#ef4444' }}>LIVE</span>
            </h1>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button 
                onClick={handleSearchClick}
                aria-label="Search" 
                className="p-1 text-foreground hover:text-gray-600 transition-colors"
              >
                <Search className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <button 
                onClick={handleNotificationClick}
                aria-label="Notifications" 
                className="relative p-1 text-foreground hover:text-gray-600 transition-colors"
              >
                <Bell className="h-5 w-5" strokeWidth={1.5} />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
              </button>
              <button 
                onClick={handleProfileClick}
                aria-label="Profile" 
                className="p-1 text-foreground hover:text-gray-600 transition-colors"
              >
                <User className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="absolute left-0 top-0 h-full w-72 bg-background p-6 shadow-lg animate-slide-in-left">
            <button
              onClick={() => setMenuOpen(false)}
              className="mb-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close menu"
            >
              닫기
            </button>
            <ul className="flex flex-col gap-5">
              {[
                { label: 'Home', path: '/' },
                { label: 'Shop', path: '/browse' },
                { label: 'Live', path: '/live/1' },
                { label: 'My Page', path: '/user/profile' },
                { label: 'Cart', path: '/cart' },
                { label: 'Orders', path: '/my-orders' }
              ].map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => {
                      navigate(item.path)
                      setMenuOpen(false)
                    }}
                    className="text-base font-semibold text-foreground hover:text-red-500 transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}

      <style>{`
        @keyframes slide-in-left {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
