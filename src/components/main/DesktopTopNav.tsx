/**
 * PC 상단 네비게이션 (lg+).
 * - lg ~ xl: 로고 + 탭 메뉴 + 검색/알림/장바구니/프로필
 * - xl+: 로고/탭 숨김 (사이드바가 대신), 검색바 + 우측 액션만 표시
 */
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, ShoppingCart, User, Radio, Gift, Search, Bell, Zap, Sparkles, Smartphone, Store, MapPin, BookOpen } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import AppDownloadModal from './AppDownloadModal'
import { useUnreadCount, useCartCount } from '@/hooks/queries'
import { isLoggedInSync } from '@/utils/auth'
import { isWholesaleSurface } from '@/utils/domain'
import { hasOwnHeaderPc, isFullBleedPcPath } from '@/shared/pc-fullbleed'
import { MAP_SCREEN_PATHS } from '@/shared/map-surface'
import { LIVE_COMMERCE_SUSPENDED, SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'
import { useLinkshopPath } from '@/hooks/useLinkshopPath'
import UrDealLogo from '@/components/brand/UrDealLogo'
import NotificationDropdown from './NotificationDropdown'

export default function DesktopTopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [appOpen, setAppOpen] = useState(false)
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
  // 🖥️ 2026-07-19 (상단 네비 공통화 후속 — 태블릿 이중 헤더 방지): 교환권/숙소/동네딜 상세는 <lg 에서
  //   자체 모바일 헤더(sticky/fixed top-0)를 쓰므로, 그 구간(md~lg)에 전역 네비까지 겹치면 이중 헤더.
  //   lg+ 에서만 전역 공통(대표 지시 — PC 공통 상단), 미만은 기존 자체 헤더 유지.
  const [isLg, setIsLg] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setIsLg(mq.matches)
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

  // 🖥️ 2026-07-19 (대표 요청 — 그루폰식 상단 카테고리 바): 좌측 사이드바 대신 상단 2번째 행에 카테고리/섹션을
  //   가로로. 전부 실제 라우트(끊긴 링크 0). 홈/풀블리드 상단바에서만 노출.
  const categoryItems = [
    { icon: Home, label: t('nav.home', { defaultValue: '홈' }), path: '/' },
    { icon: Gift, label: t('nav.vouchers', { defaultValue: '교환권' }), path: '/vouchers' },
    { icon: MapPin, label: t('nav.dongnedeal', { defaultValue: '동네딜' }), path: '/map' },
    ...(SHOPPING_TAB_HIDDEN ? [] : [{ icon: ShoppingCart, label: t('nav.shop', { defaultValue: '쇼핑' }), path: '/browse' }]),
    { icon: Sparkles, label: t('nav.linkshop', { defaultValue: '링크샵' }), path: linkshopPath },
    { icon: BookOpen, label: t('nav.blog', { defaultValue: '블로그' }), path: '/blog' },
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
  // 🖥️ 2026-07-19 (상단 공통화 후속 — 태블릿 이중 헤더 방지): 이 경로들은 <lg 에서 자체 모바일 헤더
  //   (sticky/fixed top-0)를 쓰므로 전역 네비는 lg+ 에서만(겹치면 이중 헤더/가림).
  //   🐛 2026-08-14 (대표 태블릿 스크린샷 — 로고 2개·버튼 겹침): **`/` 가 빠져 있었다.**
  //     이 네비는 `md`(768)부터 뜨는데 홈은 `lg`(1024) 미만에서 `RestaurantMapPage` 를 렌더한다
  //     (`HomeRoute`). 그 페이지는 `/map` 과 **같은 컴포넌트·같은 자체 헤더**(sticky top-0 + 로고)라,
  //     768~1023 구간에서 상단바가 둘이 됐다. `/map` 은 목록에 있어 보호됐고 홈만 새어 나갔다.
  //     ⚠️ `pc-fullbleed.ts` 주석의 *"홈은 자체 헤더 없음(PcHomePage)"* 은 **lg+ 에서만 참**이다.
  //     지도 경로는 `map-surface.ts` SSOT 에서 받는다(App.tsx 의 여백 게이트와 같은 목록 — 손으로
  //     두 벌 적었더니 실제로 갈라졌다).
  const LEGACY_OWN_HEADER = [...MAP_SCREEN_PATHS, '/vouchers', '/stays', '/group-buy']
  if (!isLg && LEGACY_OWN_HEADER.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) return null

  // 🖥️ 2026-07-15~16 (당근 스타일 PC): 풀너비 페이지(홈·마이 등, 앱 사이드바 없음)는 상단바가 로고+탭을
  //   항상 보이고(xl:hidden 해제) 사이드바용 좌패딩 대신 콘텐츠 폭(1600)에 정렬. 자체헤더 카탈로그(교환권/숙소)는
  //   위에서 이미 return null. isHome 은 이 풀너비-네비 판정으로 일반화.
  const isHome = isFullBleedPcPath(location.pathname) && !hasOwnHeaderPc(location.pathname)

  // 🗺️ 2026-07-20 (대표 — "지도에서 검색하면 지도에서 계속 나와야"): /map 은 지도 위 MapTopBar 가 자체
  //   검색(입력 시 지도 재중심, 페이지 이탈 없음)을 담당 → 전역 상단바의 /search 튕김 검색 인풋은 숨김(이중 검색바 제거).
  const isMapSurface = location.pathname === '/map'

  return (
    <header className="desktop-topnav hidden md:block sticky top-0 z-40 bg-white/95 dark:bg-[#0F151D]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2A3446]">
      <div className={isHome
        ? 'flex items-center gap-4 h-14 max-w-[1600px] mx-auto w-full px-6 lg:px-10'
        : 'flex items-center gap-4 px-4 md:pl-[76px] lg:pl-[76px] xl:pl-60 h-14'}>
        {/* 로고 — xl 이상에서는 사이드바에 있으므로 숨김(홈은 사이드바 없음 → 항상 표시) */}
        <Link to="/" className={isHome ? 'flex items-center shrink-0' : 'flex items-center shrink-0 xl:hidden'}>
          <UrDealLogo size={20} />
        </Link>

        {/* 탭 메뉴 — 🖥️ 2026-07-19: 홈/풀블리드에선 아래 2번째 행(카테고리 바)이 담당 → row1 인라인 탭 숨김.
            비-홈(사이드바 페이지)은 기존대로 인라인 탭(xl 에서만 사이드바로 대체). */}
        <nav className={isHome ? 'hidden' : 'flex items-center gap-1 xl:hidden'}>
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

        {/* 검색 인풋 — xl+ 에서 넓게. /map 은 지도 위 MapTopBar 검색이 담당 → 여기선 숨김(이중 검색바 제거). */}
        {isMapSurface ? (
          <div className="flex-1" />
        ) : (
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
        )}

        {/* 우측 액션 */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* 🗑️ 2026-07-07 라이브커머스 제거: LIVE 배지 삭제(/live 페이지 제거됨). */}

          {/* 앱 — 🖥️ 2026-07-19 (대표 요청): 클릭 시 QR 다운로드 팝업(그루폰식). */}
          <button
            onClick={() => setAppOpen(true)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Smartphone className="w-4 h-4" strokeWidth={1.75} />
            {t('nav.app', { defaultValue: '앱' })}
          </button>

          {/* 판매하세요 — 🖥️ 2026-07-19 (대표 요청): '판매자센터' → '유어딜(로고)에서 판매하세요'(그루폰식). */}
          <button
            onClick={() => navigate('/seller')}
            aria-label={t('nav.sellOnUrdeal', { defaultValue: '유어딜에서 판매하세요' })}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors whitespace-nowrap"
          >
            <Store className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span className="flex items-center gap-1"><UrDealLogo size={13} />에서 판매하세요</span>
          </button>

          {/* 알림 — 🖥️ 2026-07-18 (대표 요청): PC 는 페이지 이동 대신 드롭다운으로 그 자리에서 바로 표시. */}
          {loggedIn && (
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림'}
                aria-expanded={notifOpen}
                className={`relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-300 ${notifOpen ? 'bg-gray-100 dark:bg-white/[0.08]' : ''}`}
              >
                <Bell className="w-5 h-5" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
            </div>
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

      {/* 🖥️ 2026-07-19 (대표 요청 — "왼쪽 카테고리보단 위에"): 그루폰식 상단 카테고리 바(2번째 행).
          홈/풀블리드 상단바에서만. 좌측 사이드바 대신 가로 카테고리 네비. */}
      {isHome && (
        <div className="border-t border-gray-100 dark:border-[#2A3446]">
          <nav className="max-w-[1600px] mx-auto w-full px-6 lg:px-10 h-11 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {categoryItems.map((item) => {
              const active = isActivePath(item.path)
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                    active
                      ? 'text-brand'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.6} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {appOpen && <AppDownloadModal onClose={() => setAppOpen(false)} />}
    </header>
  )
}
