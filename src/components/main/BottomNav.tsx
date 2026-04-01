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
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
      zIndex: 9999,
      backgroundColor: '#fff',
      borderTop: '1px solid #f0f0f0',
      paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '8px 0' }}>
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Icon
                size={22}
                color={isActive ? '#111' : '#aaa'}
                strokeWidth={isActive ? 2.2 : 1.5}
              />
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? 700 : 400,
                color: isActive ? '#111' : '#aaa',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
