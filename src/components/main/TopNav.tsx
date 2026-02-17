import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, User } from 'lucide-react'

export default function TopNav() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleProfileClick = () => {
    navigate('/my')
  }

  const handleSearchClick = () => {
    navigate('/search')
  }

  const handleNotificationClick = () => {
    // TODO: 알림 페이지 또는 모달 구현
    console.log('알림 클릭')
  }

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between bg-background px-4 py-3 border-b border-border">
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
                { label: 'My Page', path: '/my' },
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
