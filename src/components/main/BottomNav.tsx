import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, ShoppingBag, ShoppingCart, User } from 'lucide-react'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState(location.pathname)
  const [profileImage, setProfileImage] = useState<string | null>(null)

  useEffect(() => {
    setActive(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    const loadProfile = () => {
      setProfileImage(localStorage.getItem('user_profile_image'))
    }
    loadProfile()
    window.addEventListener('storage', loadProfile)
    return () => window.removeEventListener('storage', loadProfile)
  }, [])

  const handleNavClick = (path: string) => {
    setActive(path)
    navigate(path)
  }

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: ShoppingBag, label: 'Shop', path: '/browse' },
    { icon: ShoppingCart, label: 'Cart', path: '/cart' },
    { icon: User, label: 'My', path: '/user/profile' },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      style={{
        width: '100vw',
        paddingLeft: 'max(0px, env(safe-area-inset-left))',
        paddingRight: 'max(0px, env(safe-area-inset-right))',
      }}
    >
      <div className="flex items-center w-full py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = active === path || (path !== '/' && active.startsWith(path))
          const isMyTab = path === '/user/profile'

          return (
            <button
              key={label}
              onClick={() => handleNavClick(path)}
              className="flex flex-col items-center gap-0.5 py-1 group flex-1"
              aria-label={label}
            >
              {isMyTab && profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className={`h-6 w-6 rounded-full object-cover transition-all ${
                    isActive
                      ? 'ring-2 ring-gray-900 ring-offset-1'
                      : 'opacity-70 group-hover:opacity-100'
                  }`}
                  onError={() => setProfileImage(null)}
                />
              ) : (
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    isActive
                      ? 'text-gray-900'
                      : 'text-gray-500 group-hover:text-gray-900'
                  }`}
                  strokeWidth={isActive ? 2 : 1.5}
                />
              )}
              <span
                className={`text-[10px] transition-colors ${
                  isActive
                    ? 'font-bold text-gray-900'
                    : 'font-medium text-gray-500 group-hover:text-gray-900'
                }`}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
