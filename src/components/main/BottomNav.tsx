import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, Play, ShoppingCart, User } from 'lucide-react'

const navItems = [
  { icon: Home, label: '홈', path: '/' },
  { icon: Search, label: '검색', path: '/search' },
  { icon: Play, label: '라이브', path: '/live/20' },
  { icon: ShoppingCart, label: '장바구니', path: '/cart' },
  { icon: User, label: '마이', path: '/user/profile' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center w-full py-1.5">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-0.5 flex-1"
            >
              <Icon
                className={`h-5 w-5 ${isActive ? 'text-gray-900' : 'text-gray-400'}`}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span className={`text-[10px] ${isActive ? 'font-bold text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
