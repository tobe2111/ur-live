/**
 * 🛡️ 2026-05-03: PC 상단 네비게이션 — BottomNav 의 PC 대응 버전.
 *
 * 모바일 (≤md): 숨김 (BottomNav 가 하단에 표시됨)
 * PC (lg+): 상단 sticky 네비게이션 표시 + BottomNav 는 자체적으로 hidden
 *
 * 메뉴 구조는 BottomNav 와 1:1 매칭:
 *   - 홈 / 맛집 / 공구 / 쇼핑 / 마이
 *   - 라이브 시작 버튼은 + 아이콘 → "라이브 시작" CTA 텍스트
 *
 * 디자인:
 *   - bg-[#020202] (다크), 좌측 로고, 중앙 메뉴, 우측 검색·알림·장바구니
 *   - active 항목은 핑크 underline + bold
 */
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, ShoppingCart, User, Radio, Gift, Utensils, Search, Bell, Play } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { isLoggedInSync } from '@/utils/auth'

export default function DesktopTopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [cartCount, setCartCount] = useState(0)

  // 알림 unread 동기화 (60초)
  useEffect(() => {
    if (!isLoggedInSync()) { setUnreadCount(0); setCartCount(0); return }
    let cancelled = false
    const fetchCounts = async () => {
      try {
        const r = await api.get('/api/notifications/unread-count')
        if (cancelled) return
        const c = Number(r.data?.count ?? 0)
        setUnreadCount(Number.isFinite(c) && c >= 0 ? c : 0)
      } catch { if (!cancelled) setUnreadCount(0) }
      try {
        const r2 = await api.get('/api/cart')
        if (cancelled) return
        if (r2.data?.success) {
          const items = r2.data.data?.items || (Array.isArray(r2.data.data) ? r2.data.data : [])
          const count = items.reduce((s: number, it: any) => s + (it.quantity || 1), 0)
          setCartCount(count)
        }
      } catch { if (!cancelled) setCartCount(0) }
    }
    fetchCounts()
    const id = setInterval(fetchCounts, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const navItems = [
    { icon: Home, key: 'home', label: t('nav.home', { defaultValue: '홈' }), path: '/' },
    { icon: Utensils, key: 'restaurants', label: t('nav.restaurants', { defaultValue: '맛집' }), path: '/restaurant-map' },
    { icon: Radio, key: 'live', label: t('nav.live', { defaultValue: '라이브' }), path: '/live' },
    { icon: Gift, key: 'groupBuy', label: t('nav.groupBuy', { defaultValue: '공구' }), path: '/group-buy' },
    { icon: ShoppingCart, key: 'shop', label: t('nav.shop', { defaultValue: '쇼핑' }), path: '/browse' },
  ]

  const isActivePath = (path: string) => {
    const cur = location.pathname
    if (path === '/') return cur === '/'
    if (cur === path) return true
    if (cur.startsWith(path + '/')) return true
    if (path === '/live' && cur.startsWith('/live')) return true
    return false
  }

  return (
    <header className="hidden lg:block sticky top-0 z-40 bg-[#020202]/95 backdrop-blur-md border-b border-[#1A1A1A]">
      <div className="ur-content-wide flex items-center gap-6 px-6 lg:px-8 h-14">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#EF4444] to-[#EC4899]">
            <Play className="h-3.5 w-3.5 text-white fill-white" />
          </div>
          <span
            className="text-[16px] font-extrabold text-white"
            style={{ letterSpacing: '-0.04em', fontStyle: 'italic' }}
          >
            UR·DEAL
          </span>
        </Link>

        {/* Center: Nav items */}
        <nav className="flex items-center gap-1 flex-1">
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
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
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

        {/* Right: Search / Notifications / Cart / Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/search')}
            aria-label={t('liveList.ariaSearch', { defaultValue: '검색' })}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-gray-300 hover:text-white"
          >
            <Search className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => navigate('/notifications')}
            aria-label={
              unreadCount > 0
                ? t('mainHome.ariaNotificationsCount', { count: unreadCount })
                : t('mainHome.ariaNotifications')
            }
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-gray-300 hover:text-white"
          >
            <Bell className="w-5 h-5" strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/cart')}
            aria-label={t('liveList.ariaCart', { defaultValue: '장바구니' })}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-gray-300 hover:text-white"
          >
            <ShoppingCart className="w-5 h-5" strokeWidth={1.75} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/user/profile')}
            aria-label={t('nav.my', { defaultValue: '마이' })}
            className={`w-9 h-9 flex items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/[0.06] ${
              isActivePath('/user/profile') ? 'bg-white/[0.08] text-white' : ''
            }`}
          >
            <User className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  )
}
