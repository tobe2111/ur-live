import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ShoppingCart } from 'lucide-react'

export default function TopNav() {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0F0F0F] border-b border-[#1F1F1F]">
      <div className="flex items-center justify-between h-12 px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img
            src="/logo.png"
            alt="유어딜"
            className="h-8 brightness-0 invert"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              if (!img.src.includes('googleusercontent')) {
                img.src = 'https://lh3.googleusercontent.com/d/1KIviBiRXEnTqMXRPfQ0gg4ZUewVf7gOq'
              }
            }}
          />
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/search')} className="p-1" aria-label="검색">
            <Search className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
          </button>
          <button onClick={() => navigate('/cart')} className="p-1 relative" aria-label="장바구니">
            <ShoppingCart className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
            {(() => {
              const cartData = localStorage.getItem('cart')
              let count = 0
              try {
                const parsed = cartData ? JSON.parse(cartData) : []
                count = Array.isArray(parsed) ? parsed.length : 0
              } catch { /* ignore */ }
              return count > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-0.5">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null
            })()}
          </button>
        </div>
      </div>
    </header>
  )
}
