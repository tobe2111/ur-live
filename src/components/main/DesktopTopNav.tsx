/**
 * PC 상단 네비게이션 (lg+).
 * - lg ~ xl: 로고 + 탭 메뉴 + 검색/알림/장바구니/프로필
 * - xl+: 로고/탭 숨김 (사이드바가 대신), 검색바 + 우측 액션만 표시
 */
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, ShoppingCart, User, Radio, Gift, Search, Bell, Zap } from 'lucide-react'
import { useState, useRef } from 'react'
import { useUnreadCount, useCartCount } from '@/hooks/queries'
import { isLoggedInSync } from '@/utils/auth'
import UrDealLogo from '@/components/brand/UrDealLogo'

export default function DesktopTopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const loggedIn = isLoggedInSync()

  // 🛡️ 2026-05-22 v5: 공통 hook 사용. MainHomePage 와 자동 dedup + localStorage 즉시 표시.
  const { data: unreadCount = 0 } = useUnreadCount()
  const { data: cartCount = 0 } = useCartCount()

  const navItems = [
    { icon: Home, key: 'home', label: t('nav.home', { defaultValue: '홈' }), path: '/' },
    { icon: Radio, key: 'live', label: t('nav.live', { defaultValue: '라이브' }), path: '/live' },
    { icon: Gift, key: 'groupBuy', label: t('nav.groupBuy', { defaultValue: '공구' }), path: '/group-buy' },
    { icon: ShoppingCart, key: 'shop', label: t('nav.shop', { defaultValue: '쇼핑' }), path: '/browse' },
  ]

  const isActivePath = (path: string) => {
    const cur = location.pathname
    if (path === '/') return cur === '/'
    if (cur === path) return true
    if (cur.startsWith(path + '/')) return true
    return false
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="hidden md:block sticky top-0 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#1A1A1A]">
      <div className="flex items-center gap-4 px-4 md:pl-[76px] lg:pl-[76px] xl:pl-60 h-14">
        {/* 로고 — xl 이상에서는 사이드바에 있으므로 숨김 */}
        <Link to="/" className="flex items-center shrink-0 xl:hidden">
          <UrDealLogo size={20} />
        </Link>

        {/* 탭 메뉴 — xl 이상에서는 사이드바에 있으므로 숨김 */}
        <nav className="flex items-center gap-1 xl:hidden">
          {navItems.map(item => {
            const active = isActivePath(item.path)
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                  active
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-pink-400' : ''}`} strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
                {active && (
                  <span className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 w-6 h-[2px] bg-pink-500 rounded-full" />
                )}
              </button>
            )
          })}
        </nav>

        {/* 검색 인풋 — xl+ 에서 넓게 */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md xl:max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('search.placeholder', { defaultValue: '라이브, 식사권, 상품 검색' })}
              className="w-full pl-9 pr-4 py-2 text-[13px] bg-gray-100 dark:bg-white/[0.06] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 rounded-full border-none outline-none focus:ring-2 focus:ring-pink-400/30"
            />
          </div>
        </form>

        {/* 우측 액션 */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* LIVE 배지 */}
          <button
            onClick={() => navigate('/live')}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            LIVE
          </button>

          {/* 판매자센터 */}
          <button
            onClick={() => navigate('/seller')}
            className="hidden xl:block px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
          >
            {t('nav.sellerCenter', { defaultValue: '판매자센터' })}
          </button>

          {/* 알림 */}
          {loggedIn && (
            <button
              onClick={() => navigate('/notifications')}
              aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림'}
              className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-300"
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* 장바구니 */}
          <button
            onClick={() => navigate('/cart')}
            aria-label={t('liveList.ariaCart', { defaultValue: '장바구니' })}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-300"
          >
            <ShoppingCart className="w-5 h-5" strokeWidth={1.75} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>

          {/* 로그인 or 프로필 */}
          {loggedIn ? (
            <button
              onClick={() => navigate('/user/profile')}
              aria-label={t('nav.my', { defaultValue: '마이' })}
              className={`w-9 h-9 flex items-center justify-center rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] ${
                isActivePath('/user/profile') ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white' : ''
              }`}
            >
              <User className="w-5 h-5" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-1.5 bg-pink-500 text-white text-[13px] font-bold rounded-full hover:bg-pink-600 transition-colors"
            >
              {t('auth.login', { defaultValue: '로그인' })}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
