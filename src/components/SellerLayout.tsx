import { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingBag, Package, Play, DollarSign, Megaphone, Rocket,
  Bell, Building2, Settings, LogOut, Menu, X, Heart, MessageCircle, BarChart3, Globe, Ticket, Star, BarChart2, BookOpen, Tag, Sparkles, Boxes, ScanLine
} from 'lucide-react'
import { logoutSeller } from '@/lib/seller-auth'
import api from '@/lib/api'
import { HOSTING_HIDDEN } from '@/shared/feature-flags'
import { getRoleShortLabel, isStoreOwner } from '@/shared/seller-roles'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { toast } from '@/hooks/useToast'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import UrDealLogo from '@/components/brand/UrDealLogo'
import DashboardNotificationBell from './DashboardNotificationBell'
import SellerKakaoLinkBanner from './SellerKakaoLinkBanner'

type SellerType = 'influencer' | 'store_owner' | 'both'

/**
 * 🛡️ 2026-05-17: Mode-based IA — 각 nav 항목에 'mode' 표시.
 *   live   = 라이브 송출 (인플루언서) 전용
 *   store  = 매장 운영 (이용권 발행) 전용
 *   common = 둘 다 사용
 * 사용자가 selectedMode 토글하면 해당 mode + common 만 노출.
 * 'both' 셀러는 상단에 segmented control 로 모드 전환 가능.
 */
type SellerMode = 'live' | 'store' | 'common'

const NAV_GROUPS: {
  label?: string
  labelKey?: string
  hideFor?: SellerType[]
  items: {
    path: string
    labelKey: string
    icon: any
    exact?: boolean
    highlight?: boolean
    hideFor?: SellerType[]
    mode?: SellerMode
    /** 🧭 탭으로 묶인 형제 라우트 — 이 경로들에서도 본 항목을 활성 표시. */
    also?: string[]
  }[]
  mode?: SellerMode
}[] = [
  {
    label: '', // 홈 (그룹 라벨 없음)
    items: [
      { path: '/seller', labelKey: 'seller.dashboard', icon: LayoutDashboard, exact: true, mode: 'common' },
    ],
  },
  // 🏭 2026-06-04 (사용자 요청): 방송 그룹(라이브 방송/송출 키/쇼츠/라이브 분석) 숨김 — 셀러 대시보드 간소화.
  {
    // 🛡️ 2026-06-01: '판매'(12) → 상품·소싱 / 공구·숙소 / 주문·고객 3그룹 분할 (탐색성). mode/hideFor 보존.
    labelKey: 'seller.layout.products',
    items: [
      // 🧭 2026-06-09 IA 정리: 묶음/재고는 상품 페이지 상단 SellerProductTabs 로 이동 — nav 1항목.
      //   라우트는 보존(딥링크 안전), also 로 탭 형제 라우트에서도 활성 표시.
      { path: '/seller/products', labelKey: 'seller.nav.products', icon: Package, mode: 'common', also: ['/seller/bundles', '/seller/inventory'] },
      // 🏁 2026-06-12 (4차 감사 D5): /seller/proxy-products 고아 라우트 진입점 — 크리에이터 대행 등록 검토/승인 (매장).
      { path: '/seller/proxy-products', labelKey: 'seller.nav.proxyProducts', icon: Package, mode: 'store' },
      // 🛡️ 2026-06-01 도매몰 노출: 셀러가 도매 카탈로그에서 상품 소싱 → 내 스토어 등록.
      { path: '/seller/supply', labelKey: 'seller.nav.supply', icon: Boxes, mode: 'common' },
    ],
  },
  {
    labelKey: 'seller.layout.groupbuy',
    mode: 'store',
    items: [
      // group-buy(교환권/공구) 는 매장·크리에이터 공통 (둘 다 발행).
      // 🧭 2026-06-10: 계산대 스캔 — 현장에서 가장 자주 쓰는 동선이라 그룹 최상단.
      { path: '/seller/scan', labelKey: 'seller.nav.voucherScan', icon: ScanLine, mode: 'store' },
      { path: '/seller/group-buy', labelKey: 'seller.nav.mealVoucher', icon: Ticket, mode: 'store' },
      // 🏭 2026-06-04 역할 큐레이션 — 숙소는 매장(오프라인 숙박) 전용. 크리에이터에겐 숨김.
      { path: '/seller/stays', labelKey: 'seller.nav.stays', icon: Building2, mode: 'store', hideFor: ['influencer'] },
      { path: '/seller/stays/bookings', labelKey: 'seller.nav.staysBookings', icon: BarChart3, mode: 'store', hideFor: ['influencer'] },
    ],
  },
  {
    labelKey: 'seller.layout.ordersCustomers',
    items: [
      { path: '/seller/orders', labelKey: 'seller.orders', icon: ShoppingBag, mode: 'common' },
      { path: '/seller/reviews', labelKey: 'seller.nav.reviews', icon: Star, mode: 'common' },
      { path: '/seller/coupons', labelKey: 'seller.nav.coupons', icon: Ticket, mode: 'common' },
      { path: '/seller/promo-codes', labelKey: 'seller.nav.promoCodes', icon: Tag, mode: 'common' },
      { path: '/seller/followers', labelKey: 'seller.nav.followers', icon: Heart, mode: 'common' },
    ],
  },
  {
    labelKey: 'seller.layout.revenue',
    items: [
      { path: '/seller/analytics', labelKey: 'seller.analytics', icon: BarChart2, mode: 'common' },
      { path: '/seller/settlements', labelKey: 'seller.revenue', icon: DollarSign, mode: 'common' },
      { path: '/seller/donations', labelKey: 'seller.donations', icon: Heart, hideFor: ['store_owner'], mode: 'live' },
      { path: '/seller/castings', labelKey: 'seller.nav.castings', icon: Megaphone, mode: 'live' },
      { path: '/seller/promote-boosts', labelKey: 'seller.nav.promoteBoosts', icon: Rocket, mode: 'live' },
    ],
  },
  // 🛡️ 2026-05-25 (migration 0278/0280): 큐레이터 링크샵 통합 — 셀러도 본인 user 계정 큐레이터 가능
  // 🏭 2026-06-04 역할 큐레이션 — 링크샵/큐레이터/영입은 크리에이터 전용. 매장사장님에겐 숨김.
  {
    labelKey: 'seller.layout.curator',
    hideFor: ['store_owner'],
    items: [
      { path: '/host', labelKey: 'seller.nav.hosting', icon: Sparkles, mode: 'common' },
      { path: '/u/me/earnings', labelKey: 'seller.nav.curatorEarnings', icon: Sparkles, mode: 'common' },
      // 🛡️ 2026-05-27: 매장 영입 prospects (인플루언서 only)
      { path: '/seller/prospects', labelKey: 'seller.nav.prospects', icon: Sparkles, mode: 'common' },
    ],
  },
  {
    labelKey: 'seller.layout.settings',
    items: [
      { path: '/seller/business-info', labelKey: 'seller.businessInfo', icon: Building2, mode: 'common' },
      { path: '/seller/mini-shop', labelKey: 'seller.nav.miniShop', icon: Megaphone, mode: 'common' },
      { path: '/seller/streaming-guide', labelKey: 'seller.nav.streamingGuide', icon: Play, mode: 'live' },
      { path: '/seller/alimtalk', labelKey: 'seller.brandMessage', icon: Bell, mode: 'common' },
      { path: '/seller/notify-followers', labelKey: 'seller.nav.notifyFollowers', icon: Megaphone, mode: 'live' },
      { path: '/seller/guide', labelKey: 'seller.nav.guide', icon: BookOpen, mode: 'common' },
    ],
  },
]

/** mode segmented control 가시성: 'both' 셀러만 토글 가능. 다른 타입은 고정.
 *  라이브 중단 시 모두 'store'(공구/매장) 단일 모드 → 토글 숨김 + 라이브 메뉴 비노출. */
function modesForSellerType(st: SellerType): SellerMode[] {
  if (LIVE_COMMERCE_SUSPENDED) return ['store']
  if (st === 'influencer') return ['live']
  if (st === 'store_owner') return ['store']
  return ['live', 'store']  // both
}

interface SellerLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  pendingOrders?: number
}

export default function SellerLayout({ title, children, headerRight, pendingOrders = 0 }: SellerLayoutProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  // 🛡️ 2026-04-30: 만료 5분 전 자동 refresh + 탭 복귀 시 검증
  useTokenAutoRefresh('seller')

  // 🏭 2026-06-30 [서비스 분리] 도매 전용(순수 판매사)만 도매몰로 — 겸업(소비자 셀러+판매사) lock-out 방지.
  //   배경: 기존엔 localStorage.is_distributor === '1' 만으로 무조건 /wholesale 로 튕겨, 소비자 셀러가
  //   도매 가입(/become-distributor)을 한 번이라도 하면 같은 셀러 행에 is_distributor=1 이 덧붙어
  //   셀러 대시보드에서 영구 차단됐다. is_distributor 는 '도매 접근권'(capability)일 뿐 '도매 전용'이 아님.
  //   → 서버 권위 판정(GET /api/seller/surface, SSOT computeWholesaleOnly)으로 '도매 전용'일 때만 redirect.
  //   기본은 대시보드 노출(절대 lock-out 금지): 판정 false/네트워크 실패 시 셀러 화면 유지. 도매 접근권 없는
  //   셀러는 조회 자체 skip.
  //
  //   ⚡ 이상화 3가지(SellerLayout 은 50개 셀러 페이지가 각자 렌더 → 페이지 이동마다 remount):
  //     ① 세션 캐시(`ur_seller_surface`) — 겸업(dual) 판정나면 이후 페이지 이동에서 /surface 재조회 skip(세션당 1회).
  //     ② 1회만 자동이동(`ur_seller_bounced`) — 한 번 도매몰로 보낸 뒤 사용자가 직접 /seller 로 되돌아오면 존중
  //        (분류기 오분류 — 예: 홍보전용 인플루언서, 상품 0 — 이어도 영구 트랩 불가).
  //     ③ `?as=seller`(도매몰의 '셀러 대시보드' 링크 등) 명시 진입은 강제이동 영구 면제.
  const [wholesaleOnly, setWholesaleOnly] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('is_distributor') !== '1') return // 도매 접근권 없으면 절대 도매 전용 아님
    try {
      const sp = new URLSearchParams(location.search)
      if (sp.get('as') === 'seller') sessionStorage.setItem('ur_force_seller', '1')
    } catch { /* noop */ }
    // 명시적 셀러 진입(?as=seller) 또는 이미 1회 자동이동된 뒤 직접 되돌아옴 → 절대 트랩 안 함.
    if (sessionStorage.getItem('ur_force_seller') === '1') return
    if (sessionStorage.getItem('ur_seller_bounced') === '1') return
    // 세션 캐시: 겸업(dual)으로 판정났으면 페이지 이동마다 재조회 안 함.
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
        else sessionStorage.setItem('ur_seller_surface', 'seller') // 겸업 — 이후 재조회 skip
      })
      .catch(() => { /* fail-open: 대시보드 유지(lock-out 금지) */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const sellerName = localStorage.getItem('seller_name') || 'Seller'
  const sellerType = (localStorage.getItem('seller_type') || 'influencer') as SellerType

  // 🛡️ 2026-05-17: Mode 토글 — 'both' 셀러는 라이브/매장 모드 전환.
  //   localStorage 에 저장하여 페이지 이동 후에도 유지.
  const availableModes = modesForSellerType(sellerType)
  const [activeMode, setActiveMode] = useState<SellerMode>(() => {
    if (availableModes.length === 1) return availableModes[0]
    const saved = (localStorage.getItem('seller_dashboard_mode') || 'live') as SellerMode
    return availableModes.includes(saved) ? saved : availableModes[0]
  })

  // 🏭 라이브 중단 시: 다른 컴포넌트(SellerPage 의 useSellerMode 등)도 store 로 인식하도록 동기화.
  useEffect(() => {
    if (LIVE_COMMERCE_SUSPENDED && localStorage.getItem('seller_dashboard_mode') !== 'store') {
      localStorage.setItem('seller_dashboard_mode', 'store')
      try { window.dispatchEvent(new CustomEvent('seller-mode-changed', { detail: 'store' })) } catch { /* noop */ }
    }
  }, [])
  function switchMode(m: SellerMode) {
    setActiveMode(m)
    localStorage.setItem('seller_dashboard_mode', m)
    // 🛡️ 2026-05-18: 같은 탭의 다른 컴포넌트 (SellerPage 등) 가 mode 변경에 반응하도록 이벤트 발행.
    //   storage event 는 다른 탭에만 발행되므로 같은 탭 동기화는 CustomEvent 필요.
    try { window.dispatchEvent(new CustomEvent('seller-mode-changed', { detail: m })) } catch { /* noop */ }
  }

  // 🏁 2026-06-14 (사용자 승인 — 공구 중심 재편): 라이브 영구중단 후엔 live/store 모드 토글이 아니라
  //   seller_type(크리에이터/매장)으로만 분기한다. 크리에이터는 매장 POS 도구(스캔/이용권 발행)를,
  //   매장은 큐레이터 그룹(hideFor)을 안 본다. live 항목은 항상 숨김.
  //   또한 user 세션 의존 항목(공구 호스팅/큐레이터 수익 = /host·/u/me/earnings)은 user_id 가 있을 때만
  //   노출 — 없으면 클릭 시 /login 으로 튕기던 바운스 버그 차단(카카오 셀러는 정상, 이메일 셀러는 숨김).
  const hasUserSession = typeof window !== 'undefined' && !!localStorage.getItem('user_id')
  const filteredNavGroups = NAV_GROUPS
    .filter(group => !group.hideFor?.includes(sellerType))
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.hideFor?.includes(sellerType)) return false
        const itemMode = item.mode || 'common'
        if (LIVE_COMMERCE_SUSPENDED) {
          if (itemMode === 'live') return false
          if (itemMode === 'store' && !isStoreOwner(sellerType)) return false
        } else if (itemMode !== 'common' && itemMode !== activeMode) {
          return false
        }
        // 🏁 2026-06-17 (HOSTING_HIDDEN): 공구 호스팅 카탈로그 진입 숨김
        if (item.path === '/host' && HOSTING_HIDDEN) return false
        // 크리에이터 user-세션 의존 항목 — user_id 없으면 숨김(바운스 방지)
        if ((item.path === '/host' || item.path === '/u/me/earnings') && !hasUserSession) return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0)

  // 🏁 2026-06-14: 공구 중심 정렬 — 각 역할의 핵심(크리에이터=큐레이터/호스팅, 매장=공구/숙소)을 홈 바로 다음으로.
  //   두 그룹은 역할 배타적(curator hideFor 매장, groupbuy 는 매장 위주)이라 각 역할이 자기 핵심을 상단에서 봄.
  const GROUP_ORDER = ['', 'seller.layout.curator', 'seller.layout.groupbuy', 'seller.layout.products', 'seller.layout.ordersCustomers', 'seller.layout.revenue', 'seller.layout.settings']
  const orderRank = (g: { labelKey?: string }) => {
    const i = GROUP_ORDER.indexOf(g.labelKey ?? '')
    return i === -1 ? GROUP_ORDER.length : i
  }
  const orderedNavGroups = [...filteredNavGroups].sort((a, b) => orderRank(a) - orderRank(b))

  const languages = [
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
  ]

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0]

  function changeLang(code: string) {
    i18n.changeLanguage(code)
    // v25 FIX: html lang 속성도 동기화 — 스크린리더가 올바른 TTS 음성 선택
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code
    }
    localStorage.setItem('i18nextLng', code)
    setLangOpen(false)
  }

  function isActive(path: string, exact?: boolean, also?: string[]) {
    if (also?.some((p) => location.pathname.startsWith(p))) return true
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  // 🛡️ 2026-06-04 (사용자 신고 — 영구 수정): 각 셀러 페이지가 자기 SellerLayout 을 렌더 →
  //   페이지 이동마다 사이드바 <nav> 가 unmount/remount → 스크롤이 top 으로 리셋되어
  //   하단 카테고리 클릭 시 시야가 위로 점프. 이전 fix(JSX 변수화)는 같은-페이지 re-render 만 막음.
  //   해법: <nav> 스크롤 위치를 sessionStorage 에 보존 → remount 시 동기 복원.
  //   sidebar JSX 가 데스크톱+모바일 2번 렌더되므로 ref 콜백으로 각 인스턴스 개별 처리
  //   (단일 ref 객체는 마지막=숨겨진 모바일만 잡힘). display:none 인 쪽은 scrollTop 무시되어 안전.
  const navScrollRef = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const saved = sessionStorage.getItem('seller_nav_scroll')
    if (saved) el.scrollTop = parseInt(saved, 10) || 0
    el.addEventListener('scroll', () => {
      try { sessionStorage.setItem('seller_nav_scroll', String(el.scrollTop)) } catch { /* quota */ }
    }, { passive: true })
  }, [])

  // 🛡️ 2026-05-21 Phase D-5: getRoleShortLabel helper 사용 (직접 비교 금지).
  const sellerTypeLabel = getRoleShortLabel(sellerType)

  // 🛡️ 사이드바를 함수 컴포넌트가 아닌 JSX 변수로 정의 — 부모 re-render 시 함수 참조가
  // 매번 새로 만들어져 React 가 unmount/remount → <nav> 의 scroll 위치가 reset 되던 버그.
  const sidebar = (
    <aside className="w-[232px] flex-shrink-0 flex flex-col h-full" style={{ background: '#0A0A0B' }}>
      {/* Branding */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <UrDealLogo size={14} forceDark />
          <span
            className="font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.08em', color: '#9ca3af' }}
          >
            SELLER STUDIO
          </span>
        </div>
        {/* Seller profile */}
        <div className="flex items-center gap-2.5 mt-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #4b5563, #6b7280)' }}
          >
            {sellerName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold text-white truncate">{sellerName}</p>
            <p className="text-white/50" style={{ fontSize: '9px' }}>{sellerTypeLabel}</p>
          </div>
        </div>
      </div>

      {/* 🛡️ 2026-05-17: Mode 토글 — 'both' 셀러만 표시 (라이브 ↔ 매장 모드 전환).
            mode 별로 nav 항목이 동적 필터링되어 인지 부담 감소. */}
      {availableModes.length > 1 && (
        <div className="px-4 py-2 border-y border-white/10 bg-white/[0.02]">
          <div className="flex gap-1 p-1 bg-black/30 rounded-full">
            <button
              type="button"
              onClick={() => switchMode('live')}
              className={`flex-1 py-1.5 px-2 rounded-full text-[10px] font-bold transition-colors ${
                activeMode === 'live'
                  ? 'bg-red-500 text-white shadow'
                  : 'text-white/60 hover:text-white'
              }`}
              aria-pressed={activeMode === 'live'}
            >
              📺 라이브 모드
            </button>
            <button
              type="button"
              onClick={() => switchMode('store')}
              className={`flex-1 py-1.5 px-2 rounded-full text-[10px] font-bold transition-colors ${
                activeMode === 'store'
                  ? 'bg-amber-500 text-white shadow'
                  : 'text-white/60 hover:text-white'
              }`}
              aria-pressed={activeMode === 'store'}
            >
              🏪 매장 모드
            </button>
          </div>
          <p className="text-[9px] text-white/40 mt-1.5 px-1">
            {activeMode === 'live'
              ? '라이브 송출 + 일반 상품 메뉴만 표시'
              : '매장 운영 + 이용권 발행 메뉴만 표시'}
          </p>
        </div>
      )}

      {/* Grouped navigation */}
      <nav ref={navScrollRef} className="flex-1 overflow-y-auto scrollbar-hide pb-2">
        {orderedNavGroups.map((group, gi) => (
          <div key={gi} className="mt-3 first:mt-1">
            {(group.label || group.labelKey) && (
              <div
                className="px-4 py-1.5 font-extrabold uppercase text-white/30"
                style={{ fontSize: '9px', letterSpacing: '0.12em' }}
              >
                {group.labelKey ? t(group.labelKey) : group.label}
              </div>
            )}
            {group.items.map(({ path, labelKey, icon: Icon, ...rest }) => {
              const exact = (rest as any).exact as boolean | undefined
              const highlight = (rest as any).highlight as boolean | undefined
              const active = isActive(path, exact, (rest as any).also as string[] | undefined)
              const label = t(labelKey)
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  // 🛡️ 2026-05-20: inline style 제거 (CSP unsafe-inline) — 색상/border 전부 Tailwind 클래스.
                  //   active gradient 는 index.css 의 .ur-seller-nav-active 유틸. hover 는 hover:text-white.
                  className={`flex items-center gap-2.5 px-4 py-[7px] text-[12px] font-semibold transition-colors border-l-[2.5px] ${
                    active
                      ? 'text-white border-[#9ca3af] ur-seller-nav-active'
                      : highlight
                      ? 'bg-red-500/20 border-red-500'
                      : 'text-white/55 hover:text-white border-transparent'
                  }`}
                >
                  <Icon size={14} strokeWidth={2} className={`flex-shrink-0 ${highlight && !active ? 'text-red-400' : ''}`} />
                  <span className={`flex-1 truncate ${highlight && !active ? 'text-red-400' : ''}`}>{label}</span>
                  {highlight && !active && <span className="ml-auto h-2 w-2 bg-red-500 rounded-full animate-pulse" />}
                  {labelKey === 'seller.orders' && pendingOrders > 0 && (
                    <span className="text-[9px] font-extrabold px-1.5 rounded-full bg-white/10 text-white">
                      {pendingOrders}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      {/* 🛡️ 2026-04-22 배치 126: '설정' → 셀러 프로필 편집 페이지 (이전엔 공개 프로필로 가던 UX 버그)
                                  '유저로 돌아가기' → 유저 마이페이지 (이전엔 메인 홈 — 모호한 UX) */}
      <div className="px-4 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* 🛡️ 2026-05-20: 사이드바 하단 버튼은 `preserveScroll: true` 로 스크롤 리셋 skip.
              사용자 요구: 하단 버튼 누르면 페이지 위로 점프하지 말고 자연스럽게 이동.
              빈 slug → /profile/ 무한 redirect 방지: 셀러 식별자 없으면 link 자체 비활성. */}
        <Link
          to="/seller/profile?tab=business"
          state={{ preserveScroll: true }}
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-2.5 px-1 py-1.5 text-[11px] font-medium text-white/55 hover:text-white transition-colors"
        >
          <Settings size={13} strokeWidth={2} />
          {t('seller.settings')}
        </Link>
        {(() => {
          const publicSlug = localStorage.getItem('seller_username') || localStorage.getItem('seller_id')
          if (!publicSlug) return null
          return (
            <Link
              to={`/profile/${publicSlug}`}
              state={{ preserveScroll: true }}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 px-1 py-1.5 text-[11px] font-medium text-white/55 hover:text-white transition-colors"
            >
              <Globe size={13} strokeWidth={2} />
              {t('seller.viewPublicProfile', { defaultValue: '공개 프로필 보기' })}
            </Link>
          )
        })()}
        {localStorage.getItem('user_id') && (
          <button
            onClick={() => {
              toast.success(t('seller.layout.backToUser'))
              setSidebarOpen(false)
              navigate('/user/profile', { state: { preserveScroll: true } })
            }}
            className="w-full flex items-center gap-2.5 px-1 py-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Globe size={13} strokeWidth={2} />
            {t('seller.layout.backToUser')}
          </button>
        )}
        <button
          onClick={() => logoutSeller(navigate)}
          className="w-full flex items-center gap-2.5 px-1 py-1.5 text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut size={13} strokeWidth={2} />
          {t('common.logout')}
        </button>
      </div>
    </aside>
  )

  // 🏭 도매 전용(순수 판매사) → /wholesale 리다이렉트 중에는 셀러 대시보드 렌더 X (깜빡임 방지).
  //   ⚠️ is_distributor 직접 비교 금지(겸업 lock-out) — 서버 권위 판정 결과(wholesaleOnly)로만 차단.
  if (wholesaleOnly) return null

  return (
    <div className="seller-light-theme flex h-screen overflow-hidden bg-[#F4F5F7] text-gray-900">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 🛡️ 2026-05-14: 태블릿+ (md=768px) 부터 sidebar 표시 — iPad 사용 셀러 UX 향상 */}
      <div className="hidden md:flex">
        {sidebar}
      </div>

      <div className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebar}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              aria-label={sidebarOpen ? t('common.closeSidebar', { defaultValue: '사이드바 닫기' }) : t('common.openSidebar', { defaultValue: '사이드바 열기' })}
              aria-expanded={sidebarOpen}
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <Globe className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{currentLang.flag} {currentLang.label}</span>
                <span className="text-xs sm:hidden">{currentLang.flag}</span>
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                  <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => changeLang(lang.code)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                          i18n.language === lang.code ? 'font-semibold text-blue-600 bg-blue-50' : 'text-gray-700'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <DashboardNotificationBell tokenKey="seller_token" />
            {headerRight}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-5">
          {/* 🔗 카카오 미연동 이메일 셀러 → 연동 권유 (dismissible, 1회 status 조회) */}
          <SellerKakaoLinkBanner />
          {children}
        </main>
      </div>

      {/* 카카오 채널 상담 플로팅 버튼
          🛡️ 2026-04-30: 모바일에서 '라이브 시작' FAB 와 겹침 방지 — 모바일은 bottom-24 로 위로 stack */}
      <a
        href="http://pf.kakao.com/_AITdn/chat"
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-24 lg:bottom-4 right-4 z-[35] flex items-center justify-center w-10 h-10 rounded-full bg-[#FEE500] hover:bg-[#FDD835] text-[#3C1E1E] shadow-md hover:shadow-lg transition-all duration-200 opacity-70 hover:opacity-100"
        title={t('seller.kakaoChat')}
      >
        <MessageCircle className="w-4 h-4" />
      </a>

      {/* 🏭 2026-06-04 (사용자 요청): 모바일 '라이브 시작' FAB 제거 — 셀러 대시보드 간소화. */}
    </div>
  )
}
