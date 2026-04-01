import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ShoppingBag, User } from 'lucide-react'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'

export default function TopNav() {
  const navigate = useNavigate()
  const krUser = useAuthKR(state => state.user)
  const worldUser = useAuthWorld(state => state.user)
  const user = isKorea() ? krUser : worldUser
  const isLoggedIn = !!user

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="flex items-center justify-between h-12 px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img
            src="/logo.png"
            alt="유어딜"
            className="h-8"
            onError={(e) => {
              // logo.png 없으면 구글 드라이브 fallback
              const img = e.target as HTMLImageElement
              if (!img.src.includes('googleusercontent')) {
                img.src = 'https://lh3.googleusercontent.com/d/1KIviBiRXEnTqMXRPfQ0gg4ZUewVf7gOq'
              }
            }}
          />
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/search')} className="p-1">
            <Search className="h-5 w-5 text-gray-700" strokeWidth={1.5} />
          </button>
          <button onClick={() => navigate('/cart')} className="p-1 relative">
            <ShoppingBag className="h-5 w-5 text-gray-700" strokeWidth={1.5} />
            {localStorage.getItem('hasCartItems') && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => navigate(isLoggedIn ? '/user/profile' : '/login')}
            className="p-1"
          >
            {isLoggedIn ? (
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{user?.name?.charAt(0) || 'U'}</span>
              </div>
            ) : (
              <User className="h-5 w-5 text-gray-700" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
