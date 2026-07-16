/**
 * PC 상단 네비게이션 (lg+).
 * - lg ~ xl: 로고 + 탭 메뉴 + 검색/알림/장바구니/프로필
 * - xl+: 로고/탭 숨김 (사이드바가 대신), 검색바 + 우측 액션만 표시
 */
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, ShoppingCart, User, Radio, Gift, Search, Bell, Zap, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useUnreadCount, useCartCount } from '@/hooks/queries'
import { isLoggedInSync } from '@/utils/auth'
import { isWholesaleSurface } from '@/utils/domain'
import { hasOwnHeaderPc } from '@/shared/pc-fullbleed'
import { LIVE_COMMERCE_SUSPENDED, SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'
import { useLinkshopPath } from '@/hooks/useLinkshopPath'
import UrDealLogo from '@/components/brand/UrDealLogo'

export default function DesktopTopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const loggedIn = isLoggedInSync()
  // 🔗 2026-06-17 (대표 신고): 링크샵 탭이 항상 /host/new 로 가던 버그 — 본인 링크샵 경로로 정합(BottomNav 와 동일).
  const linkshopPath = useLinkshopPath()

  // 🗑️ 2026-07-07 (로딩 낭비 감사): 이 네비는 `hidden md:block`(모바일 display:none)인데 React 는 마운트해
  //   /api/cart·unread 폴링을 안 보이는 배지 위해 돌렸음(모바일=주 트래픽). 데스크탑 뷰포트에서만 카운트 훅 활성.
  //   모바일 홈 배지는 HomeTopHeader 가 같은 queryKey 로 소비하므로 정상 유지(dedup).
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  // 🛡️ 2026-05-22 v5: 공통 hook 사용. MainHomePage 와 자동 dedup + localStorage 즉시 표시.
  const { data: unreadCount = 0 } = useUnreadCount(isDesktop)
  const { data: cartCount = 0 } = useCartCount(isDesktop)

  // 🛡️ 2026-06-10 [UNLOCK_LOADING] (사용자 결정): 라이브 영구 중단 + 쇼핑 잠정 숨김 — 플래그 가역.
  //   링크샵 탭 추가(하단바와 정합). 쇼핑 라우트(/browse·/cart)는 보존 — 장바구니 아이콘으로 도달 가능.
  const navItems = [
    { icon: Home, key: 'home', label: t('nav.home', { defaultValue: '홈' }), path: '/' },
    // 🗑️ 2026-07-07 라이브커머스 제거: '라이브' 탭 삭제.
    // 🖥️ 2026-07-16 (대표 신고 — 상단 '동네딜' 무의미): 홈=동네딜 + /group-buy→홈 리다이렉트라 '홈'과 중복.
    //   실제 다른 목적지인 '교환권'(/vouchers)로 교체(하단바 2번째 탭과 정합).
    { icon: Gift, key: 'vouchers', label: t('nav.vouchers', { defaultValue: '교환권' }), path: '/vouchers' },
    ...(SHOPPING_TAB_HIDDEN ? [] : [{ icon: ShoppingCart, key: 'shop', label: t('nav.shop', { defaultValue: '쇼핑' }), path: '/browse' }]),
    { icon: Sparkles, key: 'linkshop', label: t('nav.linkshop', { defaultValue: '링크샵' }), path: linkshopPath },
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

  // 🏭 이중 방어선: 도매몰(B2B) surface 에서는 소비자 DesktopTopNav(검색바) 절대 미표시.
  //   1차 가드는 App.tsx hideBottomNav(마운트 차단). allowlist 회귀해도 자기-차단.
  //   (모든 hook 호출 이후의 early-return — rules-of-hooks 안전.)
  if (isWholesaleSurface(location.pathname)) return null
  // 🖥️ 2026-07-16 (당근 스타일 PC 카탈로그): 자체 헤더를 쓰는 풀너비 페이지(교환권 /vouchers)는
  //   전역 상단바 숨김(중복 방지) — 그 페이지의 검색/카테고리 헤더가 상단을 담당.
  if (hasOwnHeaderPc(location.pathname)) return null

  // 🖥️ 2026-07-15 (당근 스타일 PC 홈): 홈(`/`)은 좌측 앱 사이드바가 없으므로 상단바가 로고+탭을 항상 보이고
  //   (xl:hidden 해제), 사이드바용 좌패딩 대신 콘텐츠 폭(1240)에 정렬 → PcHomePage 본문과 좌우 정렬 일치.
  const isHome = location.pathname === '/'

  return (
    <header className="desktop-topnav hidden md:block sticky top-0 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#1A1A1A]">
      <div className={isHome
        ? 'flex items-center gap-4 h-14 max-w-[1600px] mx-auto w-full px-6 lg:px-10'
        : 'flex items-center gap-4 px-4 md:pl-[76px] lg:pl-[76px] xl:pl-60 h-14'}>
        {/* 로고 — xl 이상에서는 사이드바에 있으므로 숨김(홈은 사이드바 없음 → 항상 표시) */}
        <Link to="/" className={isHome ? 'flex items-center shrink-0' : 'flex items-center shrink-0 xl:hidden'}>
          <UrDealLogo size={20} />
        </Link>

        {/* 탭 메뉴 — xl 이상에서는 사이드바에 있으므로 숨김(홈은 항상 표시) */}
        <nav className={isHome ? 'flex items-center gap-1' : 'flex items-center gap-1 xl:hidden'}>
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
                <Icon className={`w-4 h-4 ${active ? 'text-gray-900 dark:text-white' : ''}`} strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
                {active && (
                  <span className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 w-6 h-[2px] bg-gray-900 dark:bg-white rounded-full" />
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
              placeholder={t('search.placeholder', { defaultValue: '동네딜, 교환권, 상품 검색' })}
              className="w-full pl-9 pr-4 py-2 text-[13px] bg-gray-100 dark:bg-white/[0.06] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 rounded-full border-none outline-none focus:ring-2 focus:ring-gray-400/40 dark:focus:ring-white/20"
            />
          </div>
        </form>

        {/* 우측 액션 */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* 🗑️ 2026-07-07 라이브커머스 제거: LIVE 배지 삭제(/live 페이지 제거됨). */}

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
              className="px-4 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold rounded-full hover:bg-black dark:hover:bg-gray-100 transition-colors"
            >
              {t('auth.login', { defaultValue: '로그인' })}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
