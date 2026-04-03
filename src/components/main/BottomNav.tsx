import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, Play, ShoppingCart, User } from 'lucide-react'

const navItems = [
  { icon: Home, label: '홈', path: '/' },
  { icon: Search, label: '검색', path: '/search' },
  { icon: Play, label: '라이브', path: '/live', highlight: true },
  { icon: ShoppingCart, label: '장바구니', path: '/cart' },
  { icon: User, label: '마이', path: '/user/profile' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  // 부모 컨테이너(.max-w-screen-sm)의 실제 렌더링 너비를 따라감
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none">
      <div className="max-w-screen-sm mx-auto pointer-events-auto">
        <nav
          className="bg-white border-t border-gray-200"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
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
    </div>
  )
}
