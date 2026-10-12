import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Search } from 'lucide-react'
import api from '@/lib/api'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import UrDealLogo from '@/components/brand/UrDealLogo'
import BrandLoader from '@/components/brand/BrandLoader'
import { GridIcon } from '@/components/icons/urdeal-icons'
import { applyBizFavicon, restoreDefaultFavicon } from '@/lib/biz-favicon'
import DashboardNotificationBell from './DashboardNotificationBell'
import StoreSwitcher from '@/components/seller/StoreSwitcher'
import SellerKakaoLinkBanner from './SellerKakaoLinkBanner'
import SellerApprovalBanner from '@/components/seller/SellerApprovalBanner'
import BackToMyBar from '@/components/seller/BackToMyBar'
import AgencySeatBar from '@/components/seller/AgencySeatBar'
import SellerGroupTabs from './seller/SellerGroupTabs'
import { useSellerNavModel } from './seller-layout/useSellerNavModel'
import CommandPalette from '@/components/dashboard/CommandPalette'
import { useSellerEmbedded } from '@/shared/seller-embed'
import { consoleRedirectFor, myRedirectFor, shouldSendAgencyToConsole, shouldSendOwnerToMy } from '@/lib/seller-deep-link'

/** 🧭 전체 메뉴(더보기) 주소 — 사이드바·하단 탭이 하던 일을 이 한 화면이 맡는다(2026-10-12 4단계). */
export const SELLER_MENU_PATH = '/seller/more'

interface SellerLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  /** @deprecated 2026-10-12 — 하단 탭·사이드바 배지가 사라졌다. 호출부 호환으로만 남는다(주문 수는 주문 화면이 말한다). */
  pendingOrders?: number
  /**
   * 🪟 **껍데기 없이 본문만** (2026-09-26, 설계 §21) — 마이 안 시트가 대시보드 페이지를
   * *그대로* 열 때 쓴다. 같은 폼을 두 벌 만들지 않기 위한 유일한 길이다.
   *
   * ⚠️ 이때 사이드바·상단바·하단 탭·⌘K 는 물론 **도매 전용 리다이렉트도 건너뛴다** — 좌석은
   * 마이가 이미 확인하고 열었고, 시트 안에서 `/wholesale` 로 튕기면 마이가 통째로 사라진다.
   * ⚠️ 훅은 그대로 다 돈다(토큰 자동 갱신 포함) — 조기 반환은 **모든 훅 뒤**에 둔다.
   * ⚠️ 라이트 고정은 **호출부가 라이트 섬 클래스로** 준다(이 페이지들은 `dark:` 가 금지돼 있다) —
   *   `VoucherNewSheet` 를 볼 것. 여기서는 그 클래스를 **쓰지도, 이름을 적지도 않는다**:
   *   `dark-contrast-coverage` 가 소스를 원시 텍스트로 훑어 사용처를 찾기 때문에
   *   주석에 적기만 해도 "이 파일이 섬을 만든다" 로 오탐된다(실제로 한 번 그랬다).
   */
  bare?: boolean
}

/**
 * 🧭 **셀러 대시보드 껍데기 — 얇은 틀** (2026-10-12 셀러 대시보드 제거 4단계, 대표 *"셀러 대시보드를 없애는 것을 목표로"*).
 *
 *   카카오 사장님은 마이에서, 에이전시 직원은 콘솔에서 일한다(3단계 리다이렉트). 이 틀에 남는 사람은
 *   **마이가 없는 옛 계정 · 콘솔 로그인이 없는 좌석 · 시트로 못 여는 화면(`?dash=1`)** 뿐이다.
 *   그래서 종전의 사이드바(PC)·하단 탭 다섯(폰)을 걷어내고 **머리줄 하나**만 남긴다:
 *     [매장(전환 겸용) · 제목]  ……  [매장 드롭다운(PC) · 검색 · 알림 · 전체 메뉴]
 *   메뉴 전체는 `/seller/more` 한 화면이 받는다(다섯 대분류 + 이용권 등록 + 나머지 + 계정) —
 *   목록 계산은 그대로 `useSellerNavModel`(SSOT)이라 마이의 '전체 도구'와 갈리지 않는다.
 *
 *   ⚠️ 숨김 화면(쿠폰·공급·숙소·리뷰 검수·체험단)은 지우지 않는다 — 대표 결정 "남겨 두기".
 *   ⚠️ 남기는 배선: 깊은 링크 리다이렉트 · 토큰 자동 갱신 · 도매 전용 바운스 · 귀환 띠 · 좌석 띠 · 승인 배너.
 */
export default function SellerLayout({ title, children, headerRight, bare = false }: SellerLayoutProps) {
  // 🪟 마이 시트 안인가. **페이지가 아니라 여기가 읽는다** — 41개 화면에 prop 을 뚫으면
  //   반드시 몇 개를 빠뜨리고, 빠진 화면은 시트 안에 사이드바를 통째로 그린다.
  const embedded = useSellerEmbedded()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // 🛡️ 2026-04-30: 만료 5분 전 자동 refresh + 탭 복귀 시 검증
  useTokenAutoRefresh('seller')

  // 🏭 2026-06-30 [서비스 분리] 도매 전용(순수 판매사)만 도매몰로 — 겸업(소비자 셀러+판매사) lock-out 방지.
  //   is_distributor 는 '도매 접근권'(capability)일 뿐 '도매 전용'이 아님 → 서버 권위 판정(GET /api/seller/surface,
  //   SSOT computeWholesaleOnly)으로 '도매 전용'일 때만 redirect. 기본은 대시보드 노출(절대 lock-out 금지).
  //   ① 세션 캐시(`ur_seller_surface`) ② 1회만 자동이동(`ur_seller_bounced`) ③ `?as=seller` 명시 진입은 영구 면제.
  const [wholesaleOnly, setWholesaleOnly] = useState(false)
  // 🚑 2026-07-10: 판정이 필요한 조건이면 판정이 끝날 때까지 라이트 로더 — 오표면 플래시 제거. fail-open.
  const [surfacePending, setSurfacePending] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      if (localStorage.getItem('is_distributor') !== '1') return false
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('as') === 'seller') return false
      if (sessionStorage.getItem('ur_force_seller') === '1') return false
      if (sessionStorage.getItem('ur_seller_bounced') === '1') return false
      if (sessionStorage.getItem('ur_seller_surface') === 'seller') return false
      return true
    } catch { return false }
  })
  useEffect(() => { applyBizFavicon(); return restoreDefaultFavicon }, []) // 🎨 확정 로고: 셀러 탭=biz 파비콘(이탈 원복)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('is_distributor') !== '1') return // 도매 접근권 없으면 절대 도매 전용 아님
    try {
      const sp = new URLSearchParams(location.search)
      if (sp.get('as') === 'seller') sessionStorage.setItem('ur_force_seller', '1')
    } catch { /* noop */ }
    if (sessionStorage.getItem('ur_force_seller') === '1') return
    if (sessionStorage.getItem('ur_seller_bounced') === '1') return
    if (sessionStorage.getItem('ur_seller_surface') === 'seller') return
    const bounce = () => {
      sessionStorage.setItem('ur_seller_surface', 'wholesale')
      sessionStorage.setItem('ur_seller_bounced', '1') // 1회만 자동이동 — 되돌아오면 존중
      setWholesaleOnly(true)
      navigate('/wholesale', { replace: true })
    }
    if (sessionStorage.getItem('ur_seller_surface') === 'wholesale') { bounce(); return }
    let alive = true
    api.get('/api/seller/surface')
      .then((r) => {
        if (!alive) return
        if ((r?.data as { wholesale_only?: boolean })?.wholesale_only) bounce()
        else {
          sessionStorage.setItem('ur_seller_surface', 'seller') // 겸업 — 이후 재조회 skip
          setSurfacePending(false)
        }
      })
      .catch(() => { if (alive) setSurfacePending(false) /* fail-open: 대시보드 유지(lock-out 금지) */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const sellerName = localStorage.getItem('seller_name') || 'Seller'
  const { commandItems } = useSellerNavModel()

  // 🏭 라이브 중단 시: 다른 컴포넌트가 store 로 인식하도록 동기화(모드 토글 UI 는 2026-09-14 에 제거 — 라이브 영구 중단 뒤
  //   가능한 모드가 'store' 하나뿐이라 토글이 그려질 조건이 없었다).
  useEffect(() => {
    if (localStorage.getItem('seller_dashboard_mode') !== 'store') {
      localStorage.setItem('seller_dashboard_mode', 'store')
      try { window.dispatchEvent(new CustomEvent('seller-mode-changed', { detail: 'store' })) } catch { /* noop */ }
    }
  }, [])

  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 🪟 마이 안 시트 — 본문만 돌려준다. **모든 훅 뒤**라 토큰 자동 갱신 등은 그대로 돈다.
  //   ⚠️ 도매 전용 리다이렉트보다 **먼저** 반환한다: 시트 안에서 튕기면 마이가 통째로 사라진다.
  //
  //   🩸 2026-09-26: 종전엔 `<>{children}</>` 였는데, 그러면 **스코프가 통째로 사라진다** —
  //     `.seller-light-theme` 에 걸린 규칙들(장식 아이콘 칩 숨김 · 폰에서 페이지 제목 한 번만)이
  //     시트 안에서만 죽었고, 평소 `<main>` 이 주던 여백(`p-3 sm:p-5`)도 없어 화면이 **가장자리에
  //     딱 붙어** 그려졌다. 껍데기를 벗기는 것과 스코프를 잃는 것은 다른 일이다.
  //   ⚠️ `ur-embed-page` 는 "시트 안" 표시다 — 시트 머리가 이미 이름을 말하므로 페이지 h1 을
  //     한 번 더 그리지 않는다(CSS 한 줄, `index.css`). 부제는 남긴다(정보다).
  if (bare || embedded) {
    return (
      <div className="seller-light-theme ur-embed-page p-3 sm:p-5 space-y-3 sm:space-y-5">
        {children}
      </div>
    )
  }

  // 🚪 2026-10-12 셀러 대시보드 제거 3단계 — 카카오 사장님은 깊은 링크(알림톡·메일)로 와도 **마이에서** 연다.
  //   주소를 그대로 `?tool=` 에 실어 보내고, 마이 판매 구역이 같은 화면을 시트로 연다(`@/lib/seller-deep-link`).
  //   ⚠️ 시트 안(`embedded`)은 위에서 이미 반환했다 — 여기는 단독 대시보드일 때만 온다.
  const toMy = shouldSendOwnerToMy(false) ? myRedirectFor(location.pathname, location.search) : null
  if (toMy) return <Navigate to={toMy} replace />
  // 🏢 2026-10-12 — 에이전시 직원은 마이 대신 **에이전시 콘솔**로(콘솔이 그 매장 판에서 같은 시트를 연다).
  const toConsole = !toMy && shouldSendAgencyToConsole(false) ? consoleRedirectFor(location.pathname, location.search) : null
  if (toConsole) return <Navigate to={toConsole} replace />

  // 🏭 도매 전용(순수 판매사) → /wholesale 리다이렉트 중에는 렌더 X. is_distributor 직접 비교 금지(겸업 lock-out).
  if (wholesaleOnly) return null
  if (surfacePending) {
    return (
      <div className="seller-light-theme bg-warm">
        <BrandLoader fullScreen forceLight />
      </div>
    )
  }

  return (
    <div className="seller-light-theme flex h-[100dvh] flex-col overflow-hidden bg-warm text-gray-900">
      {/* 🏷️ 머리줄 하나 — 2026-09-15 A2 "매장이 제목"은 그대로: 폰은 제목 자리 = 매장(전환 겸용), 페이지 제목은 본문 첫 줄.
          PC 는 로고 + 브레드크럼 `매장 / 제목`. 사이드바·하단 탭이 하던 이동은 오른쪽 '전체 메뉴' 하나가 맡는다. */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between gap-2 border-b border-rule bg-white px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:hidden">
          <StoreSwitcher variant="title" />
        </div>
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <Link to="/seller" aria-label={t('seller.layout.home', { defaultValue: '판매 관리 처음으로' })} className="shrink-0">
            <UrDealLogo size={15} />
          </Link>
          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <span className="truncate font-semibold text-gray-500">{sellerName}</span>
            <span className="text-gray-300">/</span>
            <h1 className="truncate text-[13px] font-bold text-gray-900">{title}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* 🏪 2026-08-19 매장 전환 — PC 는 우측 드롭다운(2곳 이상일 때만), 폰은 위 제목형이 맡는다. */}
          <div className="hidden md:block"><StoreSwitcher /></div>
          {/* 🔎 페이지 검색(⌘K) — 메뉴에 없는 화면까지 이름으로. 👆 2026-10-01: `ur-btn-md` 눈금 40px. */}
          <button type="button" onClick={() => setPaletteOpen(true)} aria-label={t('seller.pageSearch', { defaultValue: '페이지 검색' })} className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
            <Search size={18} />
          </button>
          <DashboardNotificationBell tokenKey="seller_token" />
          {headerRight}
          <Link
            to={SELLER_MENU_PATH}
            aria-label={t('seller.layout.menu', { defaultValue: '전체 메뉴' })}
            className="flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-100"
          >
            <GridIcon size={18} />
            <span className="hidden md:inline">{t('seller.layout.menu', { defaultValue: '전체 메뉴' })}</span>
          </Link>
        </div>
      </header>

      <main
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        {/* 📱 A2: 폰의 페이지 제목 줄 — 헤더는 매장이 차지했으므로 제목은 여기 한 번만(공용 DashboardPageHeader 의 h1 은 폰에서 숨긴다). */}
        <div className="dash-phone-title flex items-center justify-between gap-2 px-1 md:hidden">
          <h2 className="truncate text-[17px] font-extrabold tracking-tight text-gray-900">{title}</h2>
        </div>
        {/* ↩️ 2026-09-26 (대표 *"모두 마이에서 하도록"*): 마이에서 들어온 동안만 뜨는 귀환 띠.
            페이지마다 붙이면 안 붙인 페이지가 생기고, 하필 거기서 일이 끝나면 길을 잃는다. */}
        <BackToMyBar />
        <AgencySeatBar />
        {/* 🥕 2026-09-16: 대기·반려도 대시보드를 쓰므로 화면이 상태를 말한다(승인이면 아무것도 안 그린다). */}
        <SellerApprovalBanner />
        {/* 🔗 카카오 미연동 이메일 셀러 → 연동 권유 (dismissible, 1회 status 조회) */}
        <SellerKakaoLinkBanner />
        {/* 🧭 2026-09-03: 묶음 안의 탭 줄 — 레이아웃 한 곳에서 그린다(페이지마다 붙이면 안 붙인 페이지가 생긴다). */}
        <SellerGroupTabs />
        {children}
      </main>

      {/* 카카오 채널 상담 — 위치는 `index.css` 의 `.seller-chat-fab` 이 정한다(Tailwind `bottom-24` 아님). 페이지가
          자기 하단 고정 바(`SellerBottomBar`)를 그리면 그만큼 비켜야 하는데, 그건 이 컴포넌트가 알 수
          없어서 **바가 body 에 켜 주는 신호**로 CSS 가 처리한다. 2026-09-15 대표 신고 "버튼들이 겹친다". */}
      <a
        href="http://pf.kakao.com/_AITdn/chat"
        target="_blank" rel="noopener noreferrer"
        className="seller-chat-fab fixed md:bottom-4 right-4 z-[35] flex items-center justify-center w-10 h-10 rounded-full bg-brand hover:bg-[#1557C8] text-white shadow-md hover:shadow-lg transition-all duration-200 opacity-70 hover:opacity-100"
        title={t('seller.kakaoChat')}
      >
        <MessageCircle className="w-4 h-4" />
      </a>

      {/* 🔎 페이지 검색 — 전체 메뉴 + 메뉴에 없는 화면까지(어드민과 같은 컴포넌트). */}
      <CommandPalette items={commandItems} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
