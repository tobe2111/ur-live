import { useNavigate, Link } from 'react-router-dom'
import { Search, ShoppingCart } from 'lucide-react'

export default function TopNav() {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 w-full bg-[#020202] border-b border-[#0A0A0A]">
      <div className="flex items-center justify-between h-12 px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5">
          <svg viewBox="0 0 40 36" fill="none" className="h-7 w-auto">
            {/* Cart body */}
            <path d="M8 8h2l1.5 3H34a1 1 0 01.96 1.28l-3.5 12A1 1 0 0130.5 25H14.5a1 1 0 01-.96-.72L9.8 10H8V8z" stroke="#EF4444" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Cart wheels */}
            <circle cx="16" cy="31" r="2.5" fill="#EF4444"/>
            <circle cx="29" cy="31" r="2.5" fill="#EF4444"/>
            {/* Play triangle */}
            <path d="M19.5 13.5v8l6-4z" fill="#EF4444"/>
          </svg>
          <span className="text-[15px] font-extrabold text-white tracking-tight">유어딜</span>
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
