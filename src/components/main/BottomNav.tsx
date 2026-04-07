import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, Play, ShoppingCart, User, Plus } from 'lucide-react'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const isSeller = localStorage.getItem('user_type') === 'seller'

  const leftItems = [
    { icon: Home, label: '홈', path: '/' },
    { icon: Play, label: '쇼츠', path: '/live' },
  ]

  const rightItems = [
    { icon: ShoppingCart, label: '쇼핑', path: '/browse' },
    { icon: User, label: '마이', path: '/user/profile' },
  ]

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  const renderItem = ({ icon: Icon, label, path }: typeof leftItems[0]) => (
    <button
      key={label}
      onClick={() => navigate(path)}
      className="flex-1 flex flex-col items-center justify-center h-full"
      aria-label={label}
    >
      <Icon
        size={22}
        className={isActive(path) ? 'text-gray-900' : 'text-gray-400'}
        strokeWidth={isActive(path) ? 2 : 1.5}
      />
      <span className={`text-[9px] mt-0.5 ${
        isActive(path) ? 'font-bold text-gray-900' : 'text-gray-400'
      }`}>
        {label}
      </span>
    </button>
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none">
      <div className="max-w-screen-sm mx-auto pointer-events-auto">
        <nav
          className="bg-white border-t border-gray-200 relative"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center h-14">
            {/* Left items */}
            {leftItems.map(renderItem)}

            {/* Center + button */}
            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={() => {
                  if (isSeller) {
                    navigate('/seller/live-broadcast')
                  } else {
                    navigate('/seller/register')
                  }
                }}
                className="relative -mt-5 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 shadow-lg shadow-red-500/30 active:scale-90 transition-transform"
                aria-label="라이브 시작"
              >
                <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
              </button>
            </div>

            {/* Right items */}
            {rightItems.map(renderItem)}
          </div>
        </nav>
      </div>
    </div>
  )
}
