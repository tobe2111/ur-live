import { useState, useEffect } from 'react'
import { loadRoute } from '@/lib/route-preload'
import { cfImage } from '@/utils/cf-image'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import { isWholesaleSurface } from '@/utils/domain'
// 🎫 2026-09-02 (대표 시안 — 코레일톡 하단 탭): 다섯 탭 전부 유어딜 아이콘. 비활성 = 선, 활성 = 면(`filled`).
import { UrShopIcon, HomeIcon, GiftBoxIcon, TicketStubIcon, PersonIcon } from '@/components/icons/urdeal-icons'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
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
  })
  useEffect(() => {
    const userType = localStorage.getItem('user_type') || ''
    setAuthState({
      userType,
      activeRole: localStorage.getItem('active_role') || userType || 'user',
      hasSessionLogin: !!localStorage.getItem('session_login'),
      hasAccessToken: !!localStorage.getItem('access_token'),
      hasSellerToken: !!localStorage.getItem('seller_token'),
    })
  }, [location.pathname])
  const { hasSessionLogin, hasAccessToken, hasSellerToken } = authState
  const isLoggedIn = hasAccessToken || hasSessionLogin || hasSellerToken

  // 🛡️ 2026-05-25 (신모델 전환): 라이브 → 유어샵.
  //   사용자 결정: 유어샵 탭은 본인 공개페이지 (/u/{handle}).
  //   수익은 마이페이지 (/user/profile) 에 인라인 카드 — 유어샵 페이지에는 노출 X.
  // 🛡️ 2026-05-25 (loading P0): localStorage cache 우선 — UMeRedirectPage chunk + getDashboard API 0 round-trip.
  //   - linked_seller_username 캐시 있으면 /profile/{username} 직행 (셀러 공개페이지)
  //   - user_handle 캐시 있으면 /u/{handle} 직행 (큐레이터 공개페이지)
  //   - 캐시 없으면 /u/me (UMeRedirectPage 가 1회 API 호출 후 캐시 저장)
  //   - 미로그인이면 /u/me (로그인 후 UMeRedirect 가 본인 핸들 해석 → /u/{handle}, 신규만 /host/new 폴백)
  // 🛡️ 2026-05-27 (영구 fix): seller_token JWT payload 에서 username 추출.
  //   문제: seller_username localStorage cache 가 없을 때 (KakaoCallback fix 이전 로그인 등)
  //   /u/me 로 fallback → curator dashboard API → linked_user_id 매핑 없으면 /host/new fall through.
  //   해결: seller_token 의 JWT payload (signed by server) 에 이미 username 포함 → 즉시 추출.
  //   localStorage 도 update → 다음부터 직접 cache 사용.
  // 🛡️ 2026-05-28 [UNLOCK_LOADING] (SSR Phase 2 잔여): linkshopPath → useState + useEffect.
  //   render 함수 안 localStorage 직접 호출 제거 (SSR-safe). 동작 동일.
  const [linkshopPath, setLinkshopPath] = useState('/u/me')
  useEffect(() => {
    if (typeof window === 'undefined') return
    // 🔗 2026-06-17 [UNLOCK_LOADING] (사용자 "가장 이상적으로"): 로그아웃 시 /host/new(만들기) → /u/me.
    //   /u/me 도 로그인을 요구하지만 로그인 후 본인 핸들을 해석 → 기존 유저는 /u/{handle}(자기 유어샵),
    //   핸들 없는 신규만 UMeRedirect 가 /host/new 로 폴백. 기존: 이미 유어샵 있는 사람도 만들기 페이지에 떨궈짐.
    if (!isLoggedIn) { setLinkshopPath('/u/me'); return }
    try {
      // 🏭 2026-06-05: stale/예약 핸들 가드 (옛 'user' generic 핸들 등 → /u/user 400 차단).
      const RESERVED = new Set(['user', 'me', 'admin', 'seller', 'api', 'host', 'new'])
      const badHandle = (v: string | null): boolean => !v || v.length < 3 || RESERVED.has(v.toLowerCase())
      // 🔗 2026-06-17 [UNLOCK_LOADING] (사용자 결정 — 유어샵 /u/ 단일화): 소비자(큐레이터) 계정이 있으면
      //   통합 유어샵 /u/{handle} 우선. 셀러여도 /u/{handle} 는 CuratorPage 가 linked_seller 면 셀러
      //   storefront 를 inline 렌더 → 콘텐츠 손실 없이 URL 만 /profile→/u 통일(unification 북극성).
      //   셀러-only(소비자 계정 없음)만 /profile 유지 — 그들의 유일한 유어샵이라 회귀 방지.
      const cachedHandle = localStorage.getItem('user_handle')
      if (cachedHandle && !badHandle(cachedHandle)) { setLinkshopPath(`/u/${cachedHandle}`); return }
      if (cachedHandle && badHandle(cachedHandle)) { try { localStorage.removeItem('user_handle') } catch { /* */ } }
      const hasConsumer = hasAccessToken || hasSessionLogin
      if (hasConsumer) { setLinkshopPath('/u/me'); return } // 핸들 캐시 없음 → UMeRedirect 가 본인 핸들 해석

      // 셀러-only fallback (소비자 계정 없음) — 셀러 공개페이지가 유일한 유어샵.
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
  //   순서 = 홈 / 동네딜 / 쇼핑 / 유어샵 / 마이. 교환권 콘텐츠는 홈 상단 + /vouchers 전체보기로 유지.
  //   linkshop localStorage 경로 로직·active-path 패턴은 그대로 보존.
  // 🛡️ 2026-06-04: lazy 라우트 청크를 "누르려는 순간(pointerdown/hover)" 미리 받기 → 클릭 후 청크 대기 제거.
  //   홈(eager)과 달리 동네딜·쇼핑·마이는 lazy 라 클릭 시 청크 다운로드 동안 PageLoader 스피너가 떴음(카드 늦게 뜸).
  //   intent 시에만 발화 → 홈 초기로딩(Lighthouse) 영향 0. Vite 가 App.tsx 의 동일 청크로 dedup.
  // 🛡️ 2026-06-10 [UNLOCK_LOADING] 하단바 재구성 (사용자 승인): 쇼핑 탭 잠정 숨김 → 가운데 ➕(만들기).
  //   SHOPPING_TAB_HIDDEN=false 로 바꾸면 쇼핑 탭 즉시 복원(가역). /browse 라우트·prefetch 코드는 보존.
  //   ➕ 는 시트를 열어 (유저) 동네 공구 제안 / (셀러) 이용권 등록으로 분기 — 수요 신호 수집기.
  //   🗑️ 2026-10-12 (대표 *"대시보드는 완전히 지워줘"*): 그 ➕ 탭은 이후 5탭 확정(06-19)으로 빠졌고, 시트는 열 방법이 없는
  //   **죽은 화면**으로 남아 '셀러 대시보드'·'셀러 로그인' 버튼을 품고 있었다 — 시트·➕ 분기·업그레이드 패널을 통째로 지웠다.
  //   가게 등록은 마이 판매 구역·유어샵 관리가, 동네딜은 홈이 맡는다.
  const navItems = [
    { icon: HomeIcon,    label: t('nav.home',  { defaultValue: '홈' }),    path: '/' },
    // 🎟️ 2026-06-19 [UNLOCK_LOADING] (대표 5탭 확정 — 홈=동네딜이라 동네딜 탭은 홈과 중복): 동네딜 탭 → 교환권(기프티콘).
    //   홈이 이미 동네딜 피드라 별도 동네딜 탭은 중복 → 두 상품축(동네딜=홈 / 교환권=탭2)을 모두 노출.
    //   전체 동네딜(지역/검색)은 홈 '전체 동네딜 보기' 링크로 진입. isActivePath 는 홈(/) 이 /group-buy 에서도 활성.
    // 🛍️ 2026-06-20 (대표 결정 — 홈=동네딜지도 / 일반상품을 교환권 탭에 통합): 탭2 = '쇼핑'(교환권 기프티콘 + 일반상품).
    //   라벨 교환권→쇼핑, 아이콘 Gift→ShoppingBag. path 는 /vouchers 그대로(페이지가 교환권+일반상품 포괄).
    // 🎟️ 2026-07-10 [UNLOCK_LOADING] (대표 결정 — 일반상품 SHOPPING_TAB_HIDDEN 게이트로 숨김·교환권 유지):
    //   /vouchers 가 순수 교환권 페이지로 복귀(06-19 형태) → 라벨 쇼핑→교환권, 아이콘 ShoppingBag→Gift.
    //   path/prefetch 불변. SHOPPING_TAB_HIDDEN=false 로 일반상품 복원 시 라벨 재검토.
    { icon: GiftBoxIcon, label: t('nav.vouchers', { defaultValue: '교환권' }), path: '/vouchers', prefetch: () => loadRoute('vouchers') },
    // 🎟️ 2026-06-18 (대표 결정): 가운데 → '이용권'. 교환권(기프티콘)은 MMS 발송 카탈로그(탭2)이고,
    //   이용권(동네딜 이용권 등)은 매장에서 QR/PIN 으로 '앱에서 꺼내 쓰는' 지갑이라 상시 탭 가치가 높음.
    { icon: TicketStubIcon, label: t('nav.myGbVouchers', { defaultValue: '이용권' }), path: '/my-vouchers', prefetch: () => loadRoute('myVouchers') },
    // 🧭 2026-06-10: 유어샵도 청크+데이터 동시 워밍 (동네딜과 동일) — 누르는 순간 선요청.
    // 🚀 2026-10-15: 탭 미리받기는 전부 `loadRoute(이름)` — App.tsx 가 등록한 lazyPage 로더라 받아 두면 그 화면이 "준비됨" 이 되어
    //   탭을 눌러도 "페이지 로딩 중" 이 안 뜬다(직접 import 는 코드만 받고 그 표시를 못 바꿨다 — lib/boot-page).
    { icon: UrShopIcon,  label: t('nav.linkshop', { defaultValue: '유어샵' }), path: linkshopPath, prefetch: () => {
      if (linkshopPath.startsWith('/u/') && !linkshopPath.startsWith('/u/me')) {
        // 🖼️ 2026-07-01 (로딩 딥다이브, additive): 사업자 유어샵(/u/ + linked_seller)은 CuratorPage 가
        //   SellerPublicPage 를 lazy 렌더 → 그 청크도 함께 워밍(직렬 청크 대기 제거). 소비자-only 는 no-op 수준.
        if (localStorage.getItem('linked_seller_username')) { loadRoute('sellerPublic').catch(() => {}) }
        return loadRoute('linkshop').then((m) => { (m as { warmCurator?: (h: string) => void } | undefined)?.warmCurator?.(linkshopPath.slice(3)) })
      }
      if (linkshopPath.startsWith('/profile/')) return loadRoute('sellerPublic')
      return loadRoute('uMe')
    } },
    { icon: PersonIcon,  label: t('nav.my',    { defaultValue: '마이' }),  path: '/user/profile', prefetch: () => loadRoute('my') },
  ]

  const isActivePath = (path: string) => {
    const cur = location.pathname
    if (cur === path) return true
    // 🎟️ 2026-06-19 [UNLOCK_LOADING]: 홈 = 동네딜 피드 → 홈 탭은 /group-buy·/stays·/meal-vouchers 에서도 활성.
    //   (동네딜 전용 탭을 교환권으로 교체했으므로 동네딜 surface 활성표시는 홈 탭이 담당.)
    if (path === '/' && (cur.startsWith('/group-buy') || cur.startsWith('/stays') || cur.startsWith('/meal-vouchers'))) return true
    if (path !== '/' && cur.startsWith(path)) return true
    // v37 FIX: 마이페이지 범주에 /my-* 및 관련 계정/주문 경로 포함
    if (path === '/my-vouchers' && cur.startsWith('/my-vouchers')) return true
    // 🎟️ 2026-08-31 (지갑 분리): 교환권 보관함(/my-gifticons)은 '교환권' 탭 소속 — 이용권 탭과 이중 활성 방지.
    if (path === '/vouchers' && cur.startsWith('/my-gifticons')) return true
    // 🎟️ 2026-06-18: /my-vouchers 는 '이용권' 탭 전용 활성 → 마이 탭 정규식에서 제외(이중 활성 방지).
    if (path === '/user/profile' && /^\/(my-orders|my-coupons|my-reviews|my-group-buys|wishlist|interest-list|account|mypage|my-returns)(\/|$)/.test(cur)) {
      return true
    }
    // 🛡️ 2026-05-25: 유어샵 탭 active — /u/, /host/, /g/, /profile/ 모두 포함
    // 🛡️ 2026-05-27: linkshopPath 가 localStorage cache 따라 /profile/{username} 도 가능 →
    //   현재 location 이 /profile/ 또는 /s/ (셀러 공개) 면 유어샵 탭 활성화 (사용자가 직접 본인 페이지로 진입한 경우 포함).
    const isLinkshopTab = path.startsWith('/u/') || path.startsWith('/host') || path.startsWith('/profile/')
    if (isLinkshopTab) {
      if (cur.startsWith('/u/') || cur.startsWith('/host') || cur.startsWith('/g/') ||
          cur.startsWith('/profile/') || cur.startsWith('/s/')) return true
    }
    return false
  }

  // 🎬 2026-11-02 [UNLOCK_LOADING] 시안 D1(대표 승인 "셋 다 넣기"): 누른 탭 아이콘이 살짝 눌렸다 튀어 오른다.
  //   누를 때만 — 페이지를 새로 열 때 활성 탭이 저절로 튀지 않게 마운트 상태와 무관한 카운터로 고른다.
  const [press, setPress] = useState<{ path: string; n: number } | null>(null)

  const renderItem = ({ icon: Icon, label, path, prefetch }: typeof navItems[0] & { prefetch?: () => Promise<unknown> }) => {
    const active = isActivePath(path)
    const TabIcon = Icon
    const isMyTab = path === '/user/profile'
    // intent(hover/press) 시 lazy 청크 prefetch — dedup 되므로 다중 호출 안전, 실패 무시.
    const warm = prefetch ? () => { try { prefetch().catch(() => {}) } catch { /* noop */ } } : undefined

    return (
      <button
        key={label}
        onClick={() => { setPress((p) => ({ path, n: (p?.n ?? 0) + 1 })); navigate(path) }}
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
              active ? 'ring-2 ring-gray-900 dark:ring-white ring-offset-1 ring-offset-white dark:ring-offset-[#11141C]' : ''
            }`}
            loading="lazy"
            decoding="async"
            onError={() => setProfileImage(null)}
          />
        ) : (
          <span key={press?.path === path ? press.n : 0} className={`block leading-none ${press?.path === path ? 'ur-press' : ''}`}>
            <TabIcon
              size={22}
              filled={active}
              className="text-gray-900 dark:text-white"
              strokeWidth={1.6}
            />
          </span>
        )}
        {/* ⚫ 2026-10-14 (대표 시안 — 야놀자 NOL 하단바 *"버튼들 검정색에 클릭 시 색이 채워지는 식으로 … 더 깔끔하게"*):
            다섯 탭 모두 잉크색, 활성은 **아이콘이 채워지는 것(filled)과 라벨 굵기** 두 가지로만 말한다.
            종전(09-01)의 회색 비활성 + 아래 브랜드 점은 걷었다 — 회색은 눌러도 되는지 흐리게 보였고, 점은 신호가 겹쳤다. */}
        <span className={`text-[12px] mt-1 text-gray-900 dark:text-white ${active ? 'font-medium' : 'font-normal'}`}>
          {label}
        </span>
      </button>
    )
  }

  // 🏭 이중 방어선: 도매몰(B2B) surface 에서는 소비자 BottomNav 절대 미표시.
  //   1차 가드는 App.tsx hideBottomNav(마운트 자체 차단)이지만, allowlist 가 깨지거나
  //   회귀해도 컴포넌트가 자기-차단해 도매몰에 소비자 UI 누출을 구조적으로 막음.
  //   (모든 hook 호출 이후의 early-return — rules-of-hooks 안전.)
  if (isWholesaleSurface(location.pathname)) return null

  return (
    <>
      {/* Nav bar — 모바일 + 큰 폰 + 태블릿 표시. PC (lg+) 는 DesktopTopNav 가 대신 표시. */}
      {/* 🛡️ 2026-05-16 (반응형 영구 fix): 화면 폭에 따라 inner nav 자연스럽게 확장.
         - 모바일 (≤640px): max-w-[430px] (한 손 조작 친화)
         - sm (640~768px): max-w-[540px] (큰 폰 가로모드)
         - md (768~1024px): max-w-[640px] (작은 태블릿)
         - lg+ (≥1024px): hidden, DesktopTopNav 사용
         배경 + border 는 항상 화면 전체 폭. */}
      {/* 🖥️ 2026-06-20 (대표 시안 — PC 단일 정체성, "1,2 모두 진행" 승인): PC(lg+)에서도 하단 네비를
          액자 안에 노출(lg:hidden 제거). app-frame-bar 가 lg+ 에서 프레임 폭(430)으로 중앙 정렬.
          모바일(<lg)은 app-frame-bar inert → 종전 full-width 동작 그대로. linkshopPath/isActivePath
          로직은 무변경(표시 위치만). */}
      <div data-testid="bottom-nav" className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none hide-on-keyboard app-frame-bar">
        {/* 🛡️ 2026-05-19: 사용자 요청 — 진한 border-t (검정색 선) 제거. 다크 모드는 그대로, 라이트는 미세 회색 (gray-100). */}
        <div className="pointer-events-auto bg-white dark:bg-[#11141C] border-t border-gray-100 dark:border-[#2C2F35]"
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
    </>
  )
}
