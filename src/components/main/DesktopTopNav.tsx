/**
 * PC 상단 네비게이션 (lg+).
 * - lg ~ xl: 로고 + 탭 메뉴 + 검색/알림/장바구니/프로필
 * - xl+: 로고/탭 숨김 (사이드바가 대신), 검색바 + 우측 액션만 표시
 */
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, ShoppingCart, User, Radio, Gift, Search, Bell, Zap, Sparkles, Smartphone, Store, MapPin, BookOpen, Heart, ChevronRight, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import AppDownloadModal from './AppDownloadModal'
import AccountMenu from './AccountMenu'
import { useUnreadCount, useCartCount } from '@/hooks/queries'
import { useWishlist } from '@/hooks/queries/useWishlist'
import { DEAL_CATS } from '@/pages/pc-home/PcHomeRail'
import { isLoggedInSync } from '@/utils/auth'
import { sellerEntryPath } from '@/utils/seller-entry'
import { isWholesaleSurface } from '@/utils/domain'
import { hasOwnHeaderPc, isFullBleedPcPath } from '@/shared/pc-fullbleed'
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
  // 👤 2026-08-19 (대표 확정 — 그루폰식 헤더): '로그인' 버튼 → 아바타+캐럿 드롭다운.
  const [acctOpen, setAcctOpen] = useState(false)
  const acctRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const loggedIn = isLoggedInSync()
  // 🔗 2026-06-17 (대표 신고): 유어샵 탭이 항상 /host/new 로 가던 버그 — 본인 유어샵 경로로 정합(BottomNav 와 동일).
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
  // 💗 2026-08-19 (대표 확정): 상단 찜 아이콘 — 카드 하트와 **같은 훅**을 읽는다(네트워크 추가 0,
  //   카드에서 찜하면 헤더 숫자가 그 자리에서 같이 바뀐다). 비로그인은 훅이 disabled 라 항상 0.
  const { data: wishItems } = useWishlist()
  const wishCount = Array.isArray(wishItems) ? wishItems.length : 0

  // 👤 계정 드롭다운 — 바깥 클릭/Esc 로 닫기(알림 드롭다운과 같은 감각).
  useEffect(() => {
    if (!acctOpen) return
    const onDown = (e: MouseEvent) => {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAcctOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [acctOpen])

  // 🛡️ 2026-06-10 [UNLOCK_LOADING] (사용자 결정): 라이브 영구 중단 + 쇼핑 잠정 숨김 — 플래그 가역.
  //   유어샵 탭 추가(하단바와 정합). 쇼핑 라우트(/browse·/cart)는 보존 — 장바구니 아이콘으로 도달 가능.
  const navItems = [
    { icon: Home, key: 'home', label: t('nav.home', { defaultValue: '홈' }), path: '/' },
    // 🗑️ 2026-07-07 라이브커머스 제거: '라이브' 탭 삭제.
    // 🖥️ 2026-07-16 (대표 신고 — 상단 '동네딜' 무의미): 홈=동네딜 + /group-buy→홈 리다이렉트라 '홈'과 중복.
    //   실제 다른 목적지인 '교환권'(/vouchers)로 교체(하단바 2번째 탭과 정합).
    { icon: Gift, key: 'vouchers', label: t('nav.vouchers', { defaultValue: '교환권' }), path: '/vouchers' },
    ...(SHOPPING_TAB_HIDDEN ? [] : [{ icon: ShoppingCart, key: 'shop', label: t('nav.shop', { defaultValue: '쇼핑' }), path: '/browse' }]),
    { icon: Sparkles, key: 'linkshop', label: t('nav.linkshop', { defaultValue: '유어샵' }), path: linkshopPath },
  ]

  // 🖥️ 2026-07-19 (대표 요청 — 그루폰식 상단 카테고리 바): 좌측 사이드바 대신 상단 2번째 행에 카테고리/섹션을
  //   가로로. 전부 실제 라우트(끊긴 링크 0). 홈/풀블리드 상단바에서만 노출.
  const categoryItems = [
    { icon: Home, label: t('nav.home', { defaultValue: '홈' }), path: '/' },
    { icon: Gift, label: t('nav.vouchers', { defaultValue: '교환권' }), path: '/vouchers' },
    { icon: MapPin, label: t('nav.dongnedeal', { defaultValue: '동네딜' }), path: '/map' },
    ...(SHOPPING_TAB_HIDDEN ? [] : [{ icon: ShoppingCart, label: t('nav.shop', { defaultValue: '쇼핑' }), path: '/browse' }]),
    { icon: Sparkles, label: t('nav.linkshop', { defaultValue: '유어샵' }), path: linkshopPath },
    { icon: BookOpen, label: t('nav.blog', { defaultValue: '블로그' }), path: '/blog' },
  ]

  // 🧭 2026-08-19: 2행 가로 스크롤 — 넘칠 때만 우측 화살표(그루폰). 끝에 닿으면 숨긴다.
  const catScrollRef = useRef<HTMLElement>(null)
  const [catOverflow, setCatOverflow] = useState(false)
  /**
   * ⚠️ 2026-08-27 (홈 부팅 프로파일 — 이 함수 하나가 self 1,108ms 로 **홈에서 가장 비싼 JS** 였다):
   *   `scrollWidth`/`clientWidth`/`scrollLeft` 는 읽는 순간 브라우저가 **강제 동기 레이아웃**을 돈다.
   *   원래 이 effect 에 **의존성 배열이 없어서**(`useEffect(() => {...})`) 렌더마다 ①리플로 ②setState
   *   ③resize 리스너 해제+재등록 이 전부 다시 일어났다. 부팅 중엔 i18n·인증·쿼리가 차례로 도착하며
   *   렌더가 수십 번 나므로 그만큼 리플로가 쌓였다.
   *   ⇒ 리스너는 **한 번만** 달고, 폭이 실제로 변할 때만 `ResizeObserver` 가 다시 재게 한다
   *     (i18n 라벨이 늦게 도착해 칩이 넓어지는 경우까지 이게 덮는다 — 그게 dep 없는 effect 의 원래 목적이었다).
   */
  const syncCatArrow = useCallback(() => {
    const el = catScrollRef.current
    if (!el) return
    setCatOverflow(el.scrollWidth - el.clientWidth - el.scrollLeft > 8)
  }, [])
  /**
   * 폭이 변하는 원인은 **둘**이고 신호도 둘이어야 한다:
   *   ① 컨테이너 폭(창 크기) → `resize` + `ResizeObserver`(nav 자신)
   *   ② 콘텐츠 폭(i18n 라벨이 늦게 도착해 칩이 넓어짐) → 라벨 문자열이 바뀌면 다시 잰다
   * ⚠️ nav 는 `overflow-x-auto` 라 **콘텐츠가 늘어도 자기 박스는 안 변한다** — ①만으론 ②를 못 잡는다.
   *   (`firstElementChild` 하나만 관측하는 건 칩 하나의 변화만 보는 것이라 틀렸다.)
   */
  const catLabelSig = categoryItems.map(i => i.label).join('|')
  useEffect(() => {
    if (typeof window === 'undefined') return
    syncCatArrow()
    window.addEventListener('resize', syncCatArrow)
    const el = catScrollRef.current
    const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(syncCatArrow) : null
    ro?.observe(el!)
    return () => {
      window.removeEventListener('resize', syncCatArrow)
      ro?.disconnect()
    }
  }, [syncCatArrow, catLabelSig])

  // 🏷️ 딜 카테고리 활성 표시 — 홈에서 `?category=` 를 그대로 읽는다(상태 미러링 금지: 갈리면 어긋난다).
  const onHomeSurface = location.pathname === '/'
  /**
   * 🗺️ 2026-08-19 (대표 — "위에 똑같이 카테고리 버튼들이 있는데 그건 없애도 될듯"):
   *   `/map` 은 **왼쪽 리스트 패널에 같은 카테고리 칩**을 갖는다(MapTopBar panel). 위·아래에 두 벌이면
   *   어느 쪽이 지금 적용된 필터인지 화면상 알 수 없다 — 실제로 둘은 **다른 상태**를 쓴다
   *   (헤더 칩은 홈의 `?category=` 로 **이동**시키고, 패널 칩은 지도 필터를 **그 자리에서** 바꾼다).
   *   ⇒ 서비스 축(홈·교환권·동네딜·유어샵·블로그)은 남기고 **딜 카테고리만** 숨긴다.
   *   서비스 축까지 지우면 /map 에서 다른 데로 갈 통로가 없어진다.
   */
  const hideDealCats = location.pathname === '/map'
  const activeDealCat = onHomeSurface
    ? (new URLSearchParams(location.search).get('category') || 'all')
    : ''

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

  /**
   * 📱 2026-08-27 (대표 폰 — "로딩이 심각한 문제"): 이 헤더는 **PC 전용**인데(`hidden md:block`)
   *   그 숨김이 **CSS 뿐**이라, 폰에서도 React 가 트리 전체를 렌더한 뒤 화면에서만 감췄다.
   *   라이브 CPU 프로파일(390px 모바일)에서 이 컴포넌트가 **self 548ms 로 홈에서 가장 비쌌다**
   *   — 보이지도 않는 헤더가 첫 화면을 그 시간만큼 늦추고 있었다.
   *   ⇒ 같은 중단점(`isDesktop` = `min-width: 768px`, 이미 계산돼 있었다)에서 **렌더 자체를 접는다**.
   *   ⚠️ 훅 호출 뒤의 early-return 이라 rules-of-hooks 안전하고, `isDesktop` 은 matchMedia 리스너로
   *     갱신되므로 창을 키우면 그대로 다시 나타난다. `createRoot`(hydrate 아님)라 미스매치도 없다.
   *   ⚠️ `index.css` 의 `.desktop-topnav` 규칙은 프레임 모드(lg+) 전용이라 영향 없다.
   */
  if (!isDesktop) return null

  // 🏭 이중 방어선: 도매몰(B2B) surface 에서는 소비자 DesktopTopNav(검색바) 절대 미표시.
  //   1차 가드는 App.tsx hideBottomNav(마운트 차단). allowlist 회귀해도 자기-차단.
  //   (모든 hook 호출 이후의 early-return — rules-of-hooks 안전.)
  if (isWholesaleSurface(location.pathname)) return null
  // 🖥️ 2026-07-16 (당근 스타일 PC 카탈로그): 자체 헤더를 쓰는 풀너비 페이지(교환권 /vouchers)는
  //   전역 상단바 숨김(중복 방지) — 그 페이지의 검색/카테고리 헤더가 상단을 담당.
  if (hasOwnHeaderPc(location.pathname)) return null
  // 🖥️ 2026-07-19 (상단 공통화 후속 — 태블릿 이중 헤더 방지): 이 경로들은 <lg 에서 자체 모바일 헤더
  //   (sticky/fixed top-0)를 쓰므로 전역 네비는 lg+ 에서만(겹치면 이중 헤더/가림).
  // 🏠 2026-08-19 (대표 신고 — "현재 모바일에서 UI가 깨짐"): **홈(`/`)이 이 목록에 없었다.**
  //   홈은 <lg 에서 지도 홈(RestaurantMapPage)이고 자체 헤더(MapTopBar)를 갖는데, 이 상단바는
  //   `hidden md:block` 이라 **md~lg 구간**(태블릿·큰 폰 가로)에서 함께 떠 두 헤더가 겹쳤다
  //   — 로고·검색·카테고리 2행 위에 지도 검색바와 칩이 포개져 글자가 서로 겹쳐 보였다.
  //   헤더가 68px 2행으로 커지면서 눈에 띄게 됐을 뿐, 구멍 자체는 그 전부터 있었다.
  // 🩸 2026-08-24 (대표 신고 — "태블릿 메인이 예전 디자인"): 여기서 **홈(`/`)을 뺐다.**
  //   위 2026-08-19 메모가 홈을 넣은 이유는 *"홈은 <lg 에서 지도/피드 홈이라 자체 헤더를 갖는다"*
  //   였는데, 같은 날 홈 분기가 **md(768)** 로 내려가면서 그 전제가 깨졌다 — md~lg 홈은 이제
  //   `PcHomePage`(자체 헤더 없음)라, 여기서 null 을 내면 **태블릿에 헤더가 통째로 사라진다.**
  //   <md 는 `hidden md:block` 이 CSS 로 이미 숨기므로 모바일 이중 헤더도 생기지 않는다.
  //   ⚠️ `HomeRoute` 의 경계와 **짝이다.** 한쪽만 되돌리면 이 구간이 다시 깨진다
  //      (가드: `home-tablet-breakpoint.test.ts`).
  const LEGACY_OWN_HEADER = ['/vouchers', '/stays', '/group-buy', '/map']
  if (!isLg && LEGACY_OWN_HEADER.some((p) => location.pathname === p || (p !== '/' && location.pathname.startsWith(p + '/')))) return null

  // 🖥️ 2026-07-15~16 (당근 스타일 PC): 풀너비 페이지(홈·마이 등, 앱 사이드바 없음)는 상단바가 로고+탭을
  //   항상 보이고(xl:hidden 해제) 사이드바용 좌패딩 대신 콘텐츠 폭(1600)에 정렬. 자체헤더 카탈로그(교환권/숙소)는
  //   위에서 이미 return null. isHome 은 이 풀너비-네비 판정으로 일반화.
  const isHome = isFullBleedPcPath(location.pathname) && !hasOwnHeaderPc(location.pathname)

  // 🗺️ 2026-07-20 (대표 — "지도에서 검색하면 지도에서 계속 나와야"): /map 은 지도 위 MapTopBar 가 자체
  //   검색(입력 시 지도 재중심, 페이지 이탈 없음)을 담당 → 전역 상단바의 /search 튕김 검색 인풋은 숨김(이중 검색바 제거).
  const isMapSurface = location.pathname === '/map'

  return (
    <header className="desktop-topnav hidden md:block sticky top-0 z-40 bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2C2F35]">
      {/* 📐 2026-08-19: 검색바가 46px 로 커져 행 높이도 56→68px(그루폰 헤더 비율). */}
      <div className={isHome
        ? 'flex items-center gap-4 h-[68px] max-w-[1440px] mx-auto w-full px-6 lg:px-8'
        : 'flex items-center gap-4 px-4 md:pl-[76px] lg:pl-[76px] xl:pl-60 h-[68px]'}>
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
          /* 🔎 2026-08-19 (대표 확정 — 그루폰식): 작은 회색 알약 → **큰 흰 인풋 + 브랜드 테두리 +
             우측 원형 검색 버튼**. 그루폰 헤더에서 가장 눈에 띄는 요소라 여기부터 맞춘다.
             버튼은 submit 이라 엔터/클릭 둘 다 같은 `handleSearch` 로 간다(동작 SSOT 1개). */
          <form onSubmit={handleSearch} className="flex-1 max-w-lg xl:max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('search.placeholder', { defaultValue: '동네딜, 교환권, 상품 검색' })}
                className="w-full h-[46px] pl-11 pr-[52px] text-[14px] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 rounded-full border-2 border-brand dark:border-brand/70 outline-none focus:ring-2 focus:ring-brand/25"
              />
              <button
                type="submit"
                aria-label={t('common.search', { defaultValue: '검색' })}
                className="absolute right-[5px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-brand hover:bg-brand-dark text-white flex items-center justify-center transition-colors"
              >
                <Search className="w-[18px] h-[18px]" strokeWidth={2.2} />
              </button>
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

          {/* 판매하세요 — 🖥️ 2026-07-19 (대표 요청): '판매자센터' → '유어딜(로고)에서 판매하세요'(그루폰식).
              🩸 2026-08-26: 목적지가 `/seller` 고정이라 **아직 셀러가 아닌 사람은 로그인 벽으로 튕겼다**
              (`requireSeller` → `/seller/login`). 관심 보인 사장님에게 로그인 화면은 안내가 아니다.
              판정은 `sellerEntryPath()` SSOT 로 — 셀러면 대시보드, 아니면 입점 안내(`/partners`). */}
          <button
            onClick={() => navigate(sellerEntryPath())}
            aria-label={t('nav.sellOnUrdeal', { defaultValue: '유어딜에서 판매하세요' })}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors whitespace-nowrap"
          >
            <Store className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span className="flex items-center gap-1"><UrDealLogo size={13} />에서 판매하세요</span>
          </button>

          {/* 💗 찜 — 🖥️ 2026-08-19 (대표 확정, 그루폰 헤더): 카드 하트로 담은 것들의 **입구**.
              카드 하트와 같은 `useWishlist` 를 읽어 숫자가 즉시 맞는다. 비로그인은 로그인으로 안내. */}
          <button
            onClick={() => navigate(loggedIn ? '/wishlist' : `/login?returnUrl=${encodeURIComponent('/wishlist')}`)}
            aria-label={wishCount > 0 ? `찜 ${wishCount}개` : '찜'}
            className={`relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-300 ${
              isActivePath('/wishlist') ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white' : ''
            }`}
          >
            <Heart className="w-5 h-5" strokeWidth={1.75} />
            {wishCount > 0 && (
              <span className="absolute top-1 right-1 bg-brand text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                {wishCount > 99 ? '99+' : wishCount}
              </span>
            )}
          </button>

          {/* 알림 — 🖥️ 2026-07-18 (대표 요청): PC 는 페이지 이동 대신 드롭다운으로 그 자리에서 바로 표시.
              🔔 2026-08-19 (대표 확정): 비로그인에도 **보이게** 한다(그루폰과 동일) — 누르면 로그인으로. */}
          {loggedIn ? (
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
          ) : (
            <button
              onClick={() => navigate(`/login?returnUrl=${encodeURIComponent('/notifications')}`)}
              aria-label="알림"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-300"
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} />
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

          {/* 👤 계정 — 🖥️ 2026-08-19 (대표 확정, 그루폰): '로그인' 버튼/아이콘 → **아바타 + 캐럿 드롭다운**.
              로그인이면 마이·주문·이용권·로그아웃, 비로그인이면 로그인·회원가입이 그 자리에서 펼쳐진다.
              ⚠️ 비로그인에게도 '로그인' 이 드롭다운 **첫 항목**이라 진입 동선은 유지된다. */}
          <div className="relative" ref={acctRef}>
            <button
              onClick={() => setAcctOpen(v => !v)}
              aria-label={t('nav.my', { defaultValue: '마이' })}
              aria-expanded={acctOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-0.5 pl-1 pr-1.5 h-9 rounded-full border border-gray-200 dark:border-[#2C2F35] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors ${
                acctOpen || isActivePath('/user/profile') ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white' : ''
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/[0.10] flex items-center justify-center">
                <User className="w-[17px] h-[17px]" strokeWidth={1.9} />
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${acctOpen ? 'rotate-180' : ''}`} strokeWidth={2.2} />
            </button>
            {acctOpen && (
              <AccountMenu
                loggedIn={loggedIn}
                unreadCount={unreadCount}
                wishCount={wishCount}
                onClose={() => setAcctOpen(false)}
                onOpenApp={() => { setAcctOpen(false); setAppOpen(true) }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 🖥️ 2026-07-19 (대표 요청 — "왼쪽 카테고리보단 위에"): 그루폰식 상단 카테고리 바(2번째 행).
          홈/풀블리드 상단바에서만. 좌측 사이드바 대신 가로 카테고리 네비. */}
      {/* 🧭 2026-08-19 (대표 확정 — "카테고리를 같은 줄에 합치기"): 그루폰 2행은 '카테고리'인데 우리 2행은
          '서비스 축'이었다. 둘을 **한 줄**에 두되 세로 구분선으로 성격을 나눈다 —
          [홈·교환권·동네딜·유어샵·블로그] │ [식사·미용·숙소·기타]. 넘치면 그루폰처럼 우측 화살표로 스크롤.
          ⚠️ 딜 카테고리는 **홈의 쿼리**(`/?category=`)로 간다 — PcHomePage 가 쿼리 변화에 제자리 반응하므로
          리마운트 0(2026-08-17 '더보기 플래시' 수리와 같은 경로). 라벨/아이콘 SSOT 는 `DEAL_CATS`. */}
      {isHome && (
        <div className="border-t border-gray-100 dark:border-[#2C2F35]">
          <div className="relative max-w-[1440px] mx-auto w-full px-6 lg:px-8">
            <nav
              ref={catScrollRef}
              onScroll={syncCatArrow}
              aria-label={t('nav.categories', { defaultValue: '카테고리' })}
              className="h-11 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth"
            >
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

              {!hideDealCats && (
                <span aria-hidden="true" className="shrink-0 w-px h-4 mx-2 bg-gray-200 dark:bg-[#2C2F35]" />
              )}

              {!hideDealCats && DEAL_CATS.map(({ key, label, icon: Icon }) => {
                const active = onHomeSurface && activeDealCat === key
                return (
                  <button
                    key={key}
                    onClick={() => navigate(key === 'all' ? '/' : `/?category=${key}`)}
                    aria-current={active ? 'true' : undefined}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                      active
                        ? 'text-brand'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.6} />
                    {label}
                  </button>
                )
              })}
            </nav>

            {/* ▶ 넘칠 때만 뜨는 스크롤 화살표(그루폰과 동일). 끝에 닿으면 사라진다. */}
            {catOverflow && (
              <button
                onClick={() => catScrollRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
                aria-label={t('common.more', { defaultValue: '더 보기' })}
                className="ur-appear absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-[#141C27] border border-gray-200 dark:border-[#2C2F35] shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                style={{ opacity: 1, transform: 'translateY(-50%) scale(1)' }}
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      )}

      {appOpen && <AppDownloadModal onClose={() => setAppOpen(false)} />}
    </header>
  )
}
