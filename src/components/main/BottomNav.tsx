import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, ShoppingBag, ShoppingCart, User } from 'lucide-react'

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Search, label: 'Search', path: '/search' },
  { icon: ShoppingBag, label: 'Shop', path: '/browse' },
  { icon: ShoppingCart, label: 'Cart', path: '/cart' },
  { icon: User, label: 'My', path: '/user/profile' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState(location.pathname)

  const handleNavClick = (path: string) => {
    setActive(path)
    navigate(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
      <div className="flex items-center justify-between px-4 py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = active === path || (path !== '/' && active.startsWith(path))
          return (
            <button
              key={label}
              onClick={() => handleNavClick(path)}
              className="flex flex-col items-center gap-0.5 py-1 group min-w-[60px]"
              aria-label={label}
            >
              <Icon
                className={`h-5 w-5 transition-colors ${
                  isActive
                    ? 'text-gray-900'
                    : 'text-gray-500 group-hover:text-gray-900'
                }`}
                strokeWidth={isActive ? 2 : 1.5}
              />
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
