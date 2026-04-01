import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, Play, ShoppingCart, User } from 'lucide-react'

const navItems = [
  { icon: Home, label: '홈', path: '/' },
  { icon: Search, label: '검색', path: '/search' },
  { icon: Play, label: '라이브', path: '/live/20', highlight: true },
  { icon: ShoppingCart, label: '장바구니', path: '/cart' },
  { icon: User, label: '마이', path: '/user/profile' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-sm z-[9999]">
      <nav className="bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center h-12">
          {navItems.map(({ icon: Icon, label, path, highlight }) => {
            const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
            return (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="flex-1 flex flex-col items-center justify-center h-full"
              >
                <Icon
                  size={20}
                  className={isActive ? 'text-gray-900' : highlight ? 'text-red-500' : 'text-gray-400'}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span className={`text-[9px] mt-0.5 whitespace-nowrap ${
                  isActive ? 'font-bold text-gray-900' : highlight ? 'font-medium text-red-500' : 'text-gray-400'
                }`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
