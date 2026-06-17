import { useState, useEffect } from 'react'
import { cfImage } from '@/utils/cf-image'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LIVE_COMMERCE_SUSPENDED, SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'
import { Home, ShoppingBag, User, Plus, X, Radio, LayoutDashboard, UserPlus, LogIn, Utensils, Sparkles, MapPin } from 'lucide-react'

// 카카오 유저가 같은 계정을 셀러로 확장 — 비즈니스 정보 입력 페이지로 안내.
function SellerUpgradePanel({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-05-01: 이미 셀러로 등록된 user 면 "전환" UX, 아니면 "등록" UX.
  // 🛡️ 2026-05-28 [UNLOCK_LOADING] (SSR 마이그레이션 Phase 2): localStorage 직접 호출 → useState + useEffect.
  //   SSR 시 typeof window === 'undefined' → ReferenceError 방어.
  const [hasSellerToken, setHasSellerToken] = useState(false)
  const [hasAgencyToken, setHasAgencyToken] = useState(false)
  useEffect(() => {
    setHasSellerToken(!!localStorage.getItem('seller_token'))
    setHasAgencyToken(!!localStorage.getItem('agency_token'))
  }, [])

  if (hasSellerToken) {
    return (
      <div className="space-y-4">
        <div className="text-center py-2">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
            <Radio className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {t('bottomNav.sellerHasToken', { defaultValue: '등록된 셀러 계정이 있습니다' })}<br />
            <span className="text-gray-500 text-xs">{t('bottomNav.sellerHasTokenSub', { defaultValue: '셀러 대시보드로 전환합니다' })}</span>
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('active_role', 'seller')
            onDone()
            window.location.href = '/seller'
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
        >
          <Radio className="w-5 h-5" />
          {t('bottomNav.goToSellerDashboard', { defaultValue: '셀러 대시보드로 전환' })}
        </button>
        {!hasAgencyToken && (
          <button
            onClick={() => { onDone(); navigate('/agency/register/business') }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold text-[13px] rounded-xl"
          >
            {t('bottomNav.alsoRegisterAgency', { defaultValue: '에이전시로도 등록하기 →' })}
          </button>
        )}
      </div>
    )
  }

  // 🎨 2026-06-10 (사용자 요청 — ➕ 시트 디자인 통일): 떠 있는 아이콘+문구 블록(라이브 잔재 Radio) 제거,
  //   '동네 공구 제안' 카드와 같은 그라데이션 카드 리스트로 통일. 동작 동일(경로 불변).
  return (
    <div className="space-y-3">
      <button
        onClick={() => { onDone(); navigate('/seller/register/business?from=kakao') }}
        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl active:scale-[0.98] transition-transform"
      >
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-white" />
        </div>
        <div className="text-left flex-1">
          <p className="text-[15px] font-bold text-white">{t('bottomNav.startAsSeller', { defaultValue: '셀러로 시작하기' })}</p>
          <p className="text-[12px] text-white/80 mt-0.5">{t('bottomNav.sellerNoTokenSub', { defaultValue: '카카오 계정으로 가입·로그인 없이 한 번에' })}</p>
        </div>
      </button>

      {!hasAgencyToken && (
        <button
          onClick={() => { onDone(); navigate('/agency/register/business') }}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold text-[13px] rounded-xl"
        >
          {t('bottomNav.registerAsAgency', { defaultValue: '에이전시로 등록하기 →' })}
        </button>
      )}
    </div>
  )
}

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)

  useEffect(() => {
    setProfileImage(localStorage.getItem('user_profile_image'))
  }, [location.pathname])

  // 🛡️ 2026-05-01: ACCESS 와 DISPLAY 분리 (사용자 신고 — 사업자 자동 표시 버그).
  // 🛡️ 2026-05-28 [UNLOCK_LOADING] (SSR Phase 2): localStorage 직접 호출 → useState + useEffect.
  //   server render = 모두 false/'user' (안전). client mount 후 진짜 값 반영.
  const [authState, setAuthState] = useState({
    userType: '',
    activeRole: 'user',
    hasSessionLogin: false,
    hasAccessToken: false,
    hasSellerToken: false,
    hasAgencyToken: false,
  })
  useEffect(() => {
    const userType = localStorage.getItem('user_type') || ''
    setAuthState({
      userType,
      activeRole: localStorage.getItem('active_role') || userType || 'user',
      hasSessionLogin: !!localStorage.getItem('session_login'),
      hasAccessToken: !!localStorage.getItem('access_token'),
      hasSellerToken: !!localStorage.getItem('seller_token'),
      hasAgencyToken: !!localStorage.getItem('agency_token'),
    })
  }, [location.pathname])
  const { activeRole, hasSessionLogin, hasAccessToken, hasSellerToken, hasAgencyToken } = authState
  const isLoggedIn = hasAccessToken || hasSessionLogin || hasSellerToken || hasAgencyToken
  // DISPLAY 는 active_role 로만 판단 — seller_token 자동 발급 이 user UI 를 변형하지 않음
  const isSeller = activeRole === 'seller'
  const isAgency = activeRole === 'agency'

  // 🛡️ 2026-05-25 (신모델 전환): 라이브 → 링크샵.
  //   사용자 결정: 링크샵 탭은 본인 공개페이지 (/u/{handle}).
  //   수익은 마이페이지 (/user/profile) 에 인라인 카드 — 링크샵 페이지에는 노출 X.
  // 🛡️ 2026-05-25 (loading P0): localStorage cache 우선 — UMeRedirectPage chunk + getDashboard API 0 round-trip.
  //   - linked_seller_username 캐시 있으면 /profile/{username} 직행 (셀러 공개페이지)
  //   - user_handle 캐시 있으면 /u/{handle} 직행 (큐레이터 공개페이지)
  //   - 캐시 없으면 /u/me (UMeRedirectPage 가 1회 API 호출 후 캐시 저장)
  //   - 미로그인이면 /host/new (카탈로그 — 첫 핀 시 자동 handle 생성)
  // 🛡️ 2026-05-27 (영구 fix): seller_token JWT payload 에서 username 추출.
  //   문제: seller_username localStorage cache 가 없을 때 (KakaoCallback fix 이전 로그인 등)
  //   /u/me 로 fallback → curator dashboard API → linked_user_id 매핑 없으면 /host/new fall through.
  //   해결: seller_token 의 JWT payload (signed by server) 에 이미 username 포함 → 즉시 추출.
  //   localStorage 도 update → 다음부터 직접 cache 사용.
  // 🛡️ 2026-05-28 [UNLOCK_LOADING] (SSR Phase 2 잔여): linkshopPath → useState + useEffect.
  //   render 함수 안 localStorage 직접 호출 제거 (SSR-safe). 동작 동일.
  const [linkshopPath, setLinkshopPath] = useState('/host/new')
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isLoggedIn) { setLinkshopPath('/host/new'); return }
    try {
      // 🏭 2026-06-05: stale/예약 핸들 가드 (옛 'user' generic 핸들 등 → /u/user 400 차단).
      const RESERVED = new Set(['user', 'me', 'admin', 'seller', 'api', 'host', 'new'])
      const badHandle = (v: string | null): boolean => !v || v.length < 3 || RESERVED.has(v.toLowerCase())
      // 🔗 2026-06-17 [UNLOCK_LOADING] (사용자 결정 — 링크샵 /u/ 단일화): 소비자(큐레이터) 계정이 있으면
      //   통합 링크샵 /u/{handle} 우선. 셀러여도 /u/{handle} 는 CuratorPage 가 linked_seller 면 셀러
      //   storefront 를 inline 렌더 → 콘텐츠 손실 없이 URL 만 /profile→/u 통일(unification 북극성).
      //   셀러-only(소비자 계정 없음)만 /profile 유지 — 그들의 유일한 링크샵이라 회귀 방지.
      const cachedHandle = localStorage.getItem('user_handle')
      if (cachedHandle && !badHandle(cachedHandle)) { setLinkshopPath(`/u/${cachedHandle}`); return }
      if (cachedHandle && badHandle(cachedHandle)) { try { localStorage.removeItem('user_handle') } catch { /* */ } }
      const hasConsumer = hasAccessToken || hasSessionLogin
      if (hasConsumer) { setLinkshopPath('/u/me'); return } // 핸들 캐시 없음 → UMeRedirect 가 본인 핸들 해석

      // 셀러-only fallback (소비자 계정 없음) — 셀러 공개페이지가 유일한 링크샵.
      const sellerUsername = localStorage.getItem('seller_username')
      if (sellerUsername && !badHandle(sellerUsername)) { setLinkshopPath(`/profile/${sellerUsername}`); return }
      if (sellerUsername && badHandle(sellerUsername)) { try { localStorage.removeItem('seller_username') } catch { /* */ } }
      if (hasSellerToken) {
        const token = localStorage.getItem('seller_token')
        if (token) {
          const parts = token.split('.')
          if (parts.length === 3) {
            try {
              const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
              const payload = JSON.parse(atob(padded + '==='.slice((padded.length + 3) % 4)))
              if (payload?.username && typeof payload.username === 'string') {
                localStorage.setItem('seller_username', payload.username)
                setLinkshopPath(`/profile/${payload.username}`)
                return
              }
            } catch { /* JWT 손상 / 이전 토큰 — fall through */ }
          }
        }
      }
    } catch { /* ignore */ }
    setLinkshopPath('/u/me')
  }, [isLoggedIn, hasSellerToken, hasAccessToken, hasSessionLogin])
  // 🛡️ 2026-06-01 [UNLOCK_LOADING] 하단바 재구성 (사용자 승인): 교환권 탭 제거 → 동네딜(오프라인 공구) 추가.
  //   순서 = 홈 / 동네딜 / 쇼핑 / 링크샵 / 마이. 교환권 콘텐츠는 홈 상단 + /vouchers 전체보기로 유지.
  //   linkshop localStorage 경로 로직·active-path 패턴은 그대로 보존.
  // 🛡️ 2026-06-04: lazy 라우트 청크를 "누르려는 순간(pointerdown/hover)" 미리 받기 → 클릭 후 청크 대기 제거.
  //   홈(eager)과 달리 동네딜·쇼핑·마이는 lazy 라 클릭 시 청크 다운로드 동안 PageLoader 스피너가 떴음(카드 늦게 뜸).
  //   intent 시에만 발화 → 홈 초기로딩(Lighthouse) 영향 0. Vite 가 App.tsx 의 동일 청크로 dedup.
  // 🛡️ 2026-06-10 [UNLOCK_LOADING] 하단바 재구성 (사용자 승인): 쇼핑 탭 잠정 숨김 → 가운데 ➕(만들기).
  //   SHOPPING_TAB_HIDDEN=false 로 바꾸면 쇼핑 탭 즉시 복원(가역). /browse 라우트·prefetch 코드는 보존.
  //   ➕ 는 시트를 열어 (유저) 동네 공구 제안 / (셀러) 공구권 등록으로 분기 — 수요 신호 수집기.
  const navItems = [
    { icon: Home,        label: t('nav.home',  { defaultValue: '홈' }),    path: '/' },
    // 🏭 2026-06-10: 동네딜은 청크 + 데이터 동시 워밍 — 누르는 순간 카드 데이터 선요청 (클릭→마운트 ~200ms 선점).
    { icon: MapPin,      label: t('nav.dongnedeal', { defaultValue: '동네딜' }), path: '/group-buy', prefetch: () => import('@/pages/GroupBuyListPage').then((m) => { m.warmGroupBuyList?.() }) },
    ...(SHOPPING_TAB_HIDDEN
      ? [{ icon: Plus, label: t('nav.create', { defaultValue: '만들기' }), path: '__create__' as const, prefetch: () => import('@/pages/UserGroupBuyCreatePage') }]
      : [{ icon: ShoppingBag, label: t('nav.shop',  { defaultValue: '쇼핑' }),  path: '/browse', prefetch: () => import('@/pages/BrowsePage') }]),
    // 🧭 2026-06-10: 링크샵도 청크+데이터 동시 워밍 (동네딜과 동일) — 누르는 순간 선요청.
    { icon: Sparkles,    label: t('nav.linkshop', { defaultValue: '링크샵' }), path: linkshopPath, prefetch: () => {
      if (linkshopPath.startsWith('/u/') && !linkshopPath.startsWith('/u/me')) {
        return import('@/pages/CuratorPage').then((m) => { m.warmCurator?.(linkshopPath.slice(3)) })
      }
      if (linkshopPath.startsWith('/profile/')) return import('@/pages/SellerPublicPage')
      return import('@/pages/UMeRedirectPage')
    } },
    { icon: User,        label: t('nav.my',    { defaultValue: '마이' }),  path: '/user/profile', prefetch: () => import('@/pages/UserProfilePage') },
  ]

  const isActivePath = (path: string) => {
    const cur = location.pathname
    if (cur === path) return true
    if (path !== '/' && cur.startsWith(path)) return true
    // v37 FIX: 마이페이지 범주에 /my-* 및 관련 계정/주문 경로 포함
    if (path === '/user/profile' && /^\/(my-orders|my-coupons|my-reviews|my-vouchers|my-group-buys|wishlist|interest-list|account|mypage|my-returns)(\/|$)/.test(cur)) {
      return true
    }
    // 🛡️ 2026-05-25: 링크샵 탭 active — /u/, /host/, /g/, /profile/ 모두 포함
    // 🛡️ 2026-05-27: linkshopPath 가 localStorage cache 따라 /profile/{username} 도 가능 →
    //   현재 location 이 /profile/ 또는 /s/ (셀러 공개) 면 링크샵 탭 활성화 (사용자가 직접 본인 페이지로 진입한 경우 포함).
    const isLinkshopTab = path.startsWith('/u/') || path.startsWith('/host') || path.startsWith('/profile/')
    if (isLinkshopTab) {
      if (cur.startsWith('/u/') || cur.startsWith('/host') || cur.startsWith('/g/') ||
          cur.startsWith('/profile/') || cur.startsWith('/s/')) return true
    }
    // 🛡️ 2026-06-01: 동네딜 탭(오프라인 공구) — /group-buy 외 /stays·/meal-vouchers 도 활성.
    if (path === '/group-buy' && (cur.startsWith('/stays') || cur.startsWith('/meal-vouchers'))) return true
    return false
  }

  const renderItem = ({ icon: Icon, label, path, prefetch }: typeof navItems[0] & { prefetch?: () => Promise<unknown> }) => {
    // ➕(만들기) — 경로 이동 대신 생성 시트 오픈 (기존 sheet 재활용).
    const isCreate = path === '__create__'
    const active = !isCreate && isActivePath(path)
    const isMyTab = path === '/user/profile'
    // intent(hover/press) 시 lazy 청크 prefetch — dedup 되므로 다중 호출 안전, 실패 무시.
    const warm = prefetch ? () => { try { prefetch().catch(() => {}) } catch { /* noop */ } } : undefined

    if (isCreate) {
      return (
        <button
          key={label}
          onClick={() => setSheetOpen(true)}
          onPointerDown={warm}
          onMouseEnter={warm}
          className="flex-1 flex flex-col items-center justify-center h-full"
          aria-label={label}
          aria-haspopup="dialog"
        >
          <span className="flex items-center justify-center w-9 h-9 -mt-0.5 rounded-full bg-gray-900 dark:bg-white">
            <Icon size={20} className="text-white dark:text-[#020202]" strokeWidth={2.25} />
          </span>
          <span className="text-[9px] mt-0.5 text-gray-500">{label}</span>
        </button>
      )
    }

    return (
      <button
        key={label}
        onClick={() => navigate(path)}
        onPointerDown={warm}
        onMouseEnter={warm}
        className="flex-1 flex flex-col items-center justify-center h-full"
        aria-label={label}
      >
        {isMyTab && profileImage ? (
          <img
            src={cfImage(profileImage, { width: 96 })}
            alt="Profile"
            className={`h-6 w-6 rounded-full object-cover transition-all ${
              active ? 'ring-2 ring-white ring-offset-1 ring-offset-[#020202]' : 'opacity-60'
            }`}
            loading="lazy"
            decoding="async"
            onError={() => setProfileImage(null)}
          />
        ) : (
          <Icon
            size={22}
            className={active ? 'text-gray-900 dark:text-white' : 'text-gray-500'}
            strokeWidth={active ? 2 : 1.5}
          />
        )}
        <span className={`text-[9px] mt-0.5 ${
          active ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'
        }`}>
          {label}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* Nav bar — 모바일 + 큰 폰 + 태블릿 표시. PC (lg+) 는 DesktopTopNav 가 대신 표시. */}
      {/* 🛡️ 2026-05-16 (반응형 영구 fix): 화면 폭에 따라 inner nav 자연스럽게 확장.
         - 모바일 (≤640px): max-w-[430px] (한 손 조작 친화)
         - sm (640~768px): max-w-[540px] (큰 폰 가로모드)
         - md (768~1024px): max-w-[640px] (작은 태블릿)
         - lg+ (≥1024px): hidden, DesktopTopNav 사용
         배경 + border 는 항상 화면 전체 폭. */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none hide-on-keyboard lg:hidden">
        {/* 🛡️ 2026-05-19: 사용자 요청 — 진한 border-t (검정색 선) 제거. 다크 모드는 그대로, 라이트는 미세 회색 (gray-100). */}
        <div className="pointer-events-auto bg-white dark:bg-[#020202] border-t border-gray-100 dark:border-[#1A1A1A]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <nav className="max-w-[430px] sm:max-w-[540px] md:max-w-[640px] mx-auto px-2 sm:px-4">
            <div className="flex items-center h-14">
              {/* 🛡️ 2026-05-20: 균등 5탭 (당근식). 중앙 floating 노란 버튼 제거.
                  셀러 quick access 는 마이페이지 큰 CTA (PrimaryActions) 로 이전.
                  Long-press 시트는 길게 누르기 의존성 + 발견성 낮아 폐지. */}
              {navItems.map(renderItem)}
            </div>
          </nav>
        </div>
      </div>

      {/* Bottom Sheet */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[10000] bg-black/50 animate-overlay-in"
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet — 🛡️ 2026-05-14: max-h-[85dvh] + 태블릿 max-w-[540px]. */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] sm:max-w-[540px] z-[10001] animate-sheet-up max-h-[85dvh] overflow-y-auto">
            <div>
              <div
                className="bg-gray-50 dark:bg-[#121212] rounded-t-3xl"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 bg-gray-600 rounded-full" />
                </div>

                <div className="px-6 pb-6">
                  {/* Close — 🛡️ 2026-06-10: 시트의 유일한 진입이 ➕(만들기)가 되어 타이틀 통일 */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {t('bottomNav.sheetTitleCreate', { defaultValue: '만들기' })}
                    </h3>
                    <button onClick={() => setSheetOpen(false)} aria-label={t('bottomNav.closeSheetAria', { defaultValue: '시트 닫기' })} className="p-1 rounded-full hover:bg-white/10">
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* 🧲 2026-06-10: 동네 공구 제안 — 수요 신호 수집 (모든 사용자에게 최상단 노출).
                       제안 → 어드민/에이전시 검토 → 매장 영입 → 공구 오픈 시 제안자에게 알림(루프). */}
                  <button
                    onClick={() => { setSheetOpen(false); navigate('/community-group-buy/new') }}
                    className="w-full mb-3 flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl active:scale-[0.98] transition-transform"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-[15px] font-bold text-white">{t('bottomNav.proposeDeal', { defaultValue: '우리 동네 공구 제안하기' })}</p>
                      <p className="text-[12px] text-white/80 mt-0.5">{t('bottomNav.proposeDealDesc', { defaultValue: '원하는 가게를 제안하면 모아서 열어드려요' })}</p>
                    </div>
                  </button>

                  {/* Seller: live + 식사권 + dashboard (+ agency 겸직이면 아래 블록도)
                       🏁 2026-06-11 (사용자 요청 — 겸직 유저 1탭 등록): 유저 모드(active_role='user')여도
                       seller_token 보유(카카오 연결 셀러)면 등록 카드 직접 노출. 등록 페이지 가드
                       (requireSeller)는 토큰 존재만 검사라 전환/리로드 없이 바로 진입 가능.
                       'DISPLAY 는 active_role 로만' 룰은 탭/내비 표시용 — ➕ 시트는 역할 행동 메뉴라 토큰 기준. */}
                  {(isSeller || hasSellerToken) && (
                    <div className="space-y-3">
                      {/* 🏭 2026-06-04 라이브커머스 잠정 중단 — '라이브 방송 시작하기' 진입 숨김. */}
                      {!LIVE_COMMERCE_SUSPENDED && (
                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/live-broadcast') }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <Radio className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-white">{t('bottomNav.liveBroadcastStart', { defaultValue: '라이브 방송 시작하기' })}</p>
                          <p className="text-[12px] text-white/70 mt-0.5">{t('bottomNav.liveBroadcastDesc', { defaultValue: 'YouTube 연동으로 바로 방송 시작' })}</p>
                        </div>
                      </button>
                      )}

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/meal-voucher/new') }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <Utensils className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-white">{t('bottomNav.mealVoucherRegister', { defaultValue: '식사권 상품 등록' })}</p>
                          <p className="text-[12px] text-white/80 mt-0.5">{t('bottomNav.mealVoucherDesc', { defaultValue: '맛집 식사권을 공구 상품으로 올리기' })}</p>
                        </div>
                      </button>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller') }}
                        className="w-full flex items-center gap-4 p-4 bg-gray-100 dark:bg-[#1A1A1A] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-[#333] flex items-center justify-center">
                          <LayoutDashboard className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('bottomNav.sellerDashboard', { defaultValue: '셀러 대시보드' })}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">{t('bottomNav.sellerDashboardDesc', { defaultValue: '상품 관리, 주문, 매출 확인' })}</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* 에이전시 권한도 있으면 (셀러 + 에이전시 겸직) 별도 링크 */}
                  {(isSeller || hasSellerToken) && (isAgency || hasAgencyToken) && (
                    <button
                      onClick={() => { setSheetOpen(false); navigate('/agency') }}
                      className="w-full mt-2 flex items-center gap-3 p-3 bg-gray-100 dark:bg-[#1A1A1A] hover:bg-[#222] rounded-xl active:scale-[0.98] transition-transform"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <span className="text-lg">💼</span>
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white">{t('bottomNav.agencyDashboard', { defaultValue: '에이전시 대시보드' })}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{t('bottomNav.agencyDashboardDesc', { defaultValue: '소속 셀러 관리' })}</p>
                      </div>
                    </button>
                  )}

                  {/* 에이전시만 있고 셀러 아님 */}
                  {!(isSeller || hasSellerToken) && (isAgency || hasAgencyToken) && (
                    <div className="space-y-3">
                      <button
                        onClick={() => { setSheetOpen(false); navigate('/agency') }}
                        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <span className="text-xl">💼</span>
                        </div>
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('bottomNav.agencyDashboard', { defaultValue: '에이전시 대시보드' })}</p>
                          <p className="text-[12px] text-gray-900 dark:text-white/70 mt-0.5">{t('bottomNav.agencyDashboardDesc2', { defaultValue: '소속 셀러 관리, 계약, 정산' })}</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Logged in but no seller/agency role — 권한 추가 유도 */}
                  {isLoggedIn && !isSeller && !hasSellerToken && !isAgency && !hasAgencyToken && (
                    <SellerUpgradePanel
                      onDone={() => { setSheetOpen(false) }}
                    />
                  )}

                  {/* Not logged in — 셀러 전용 */}
                  {!isLoggedIn && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {t('bottomNav.loginDesc', { defaultValue: '셀러 계정으로 로그인하세요.' })}
                      </p>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/login') }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <LogIn className="w-5 h-5" />
                        {t('bottomNav.sellerLogin', { defaultValue: '셀러 로그인' })}
                      </button>

                      <button
                        onClick={() => { setSheetOpen(false); navigate('/seller/register') }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-900 dark:text-white font-bold text-[15px] rounded-2xl active:scale-[0.98] transition-transform"
                      >
                        <UserPlus className="w-5 h-5" />
                        {t('bottomNav.sellerSignup', { defaultValue: '셀러 회원가입' })}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
