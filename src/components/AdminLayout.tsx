import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingBag, Package, DollarSign,
  Bell, Image, Monitor, LogOut, Menu, X, Store, ClipboardList, Search, Gift, Ticket, Play, BookOpen, Building2, UserCheck, Settings, Send, CreditCard,
  BarChart3, Shield, UserCog, Radio, Users, MessageSquare, Megaphone, Sparkles, AlertTriangle, TrendingUp, AlertOctagon, Wallet, Layers,
  type LucideIcon
} from 'lucide-react'
import { clearAuthData } from '@/utils/auth'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import DashboardNotificationBell from './DashboardNotificationBell'
import UrDealLogo from '@/components/brand/UrDealLogo'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

// 🏭 2026-06-04 (사용자 결정): 3개 사업라인 중심 IA — 도매몰 / 오프라인 공구 / 온라인 쇼핑 + 공통.
//   ⚠️ 라우트/아이콘/라벨 전부 보존 — 그룹 배치만 변경(데이터 reorder, 로직 불변). 라이브 항목은
//   VISIBLE_NAV_GROUPS 필터에서 별도 숨김(잠정 중단).
const NAV_GROUPS: NavGroup[] = [
  {
    title: '운영',
    items: [
      { path: '/admin',                  label: '대시보드',      icon: LayoutDashboard, exact: true },
      { path: '/admin/insights',         label: '운영 인사이트', icon: AlertTriangle },
      { path: '/admin/revenue',          label: '매출 분석',     icon: BarChart3 },
      { path: '/admin/operations-guide', label: '운영 가이드',   icon: BookOpen },
      { path: '/admin/abuse',            label: '어뷰징 탐지',   icon: AlertOctagon },
    ],
  },
  {
    // 🏭 도매몰 (유통스타트 B2B)
    title: '🏭 도매몰',
    items: [
      { path: '/admin/suppliers',          label: '공급자 관리',   icon: Store },
      { path: '/admin/distributor-grades', label: '유통사 등급',   icon: Layers },
      { path: '/admin/wholesale-orders',   label: '도매 주문',     icon: ShoppingBag },
      { path: '/admin/wholesale-claims',   label: '도매 클레임',   icon: AlertTriangle },
      { path: '/admin/wholesale-quotes',   label: '도매 견적',     icon: ClipboardList },
      { path: '/admin/wholesale-tax',      label: '도매 세무/정산', icon: Wallet },
      { path: '/admin/wholesale-integrity', label: '도매 무결성',   icon: Shield },
      { path: '/admin/wholesale-guide',    label: '도매몰 운영 가이드', icon: BookOpen },
    ],
  },
  {
    // 🏪 오프라인 공구 (매장 공구 / 교환권 / 숙소)
    title: '🏪 오프라인 공구',
    items: [
      { path: '/admin/group-buy',        label: '공동구매',      icon: Ticket },
      { path: '/admin/stays',            label: '숙소 운영',     icon: Building2 },
      { path: '/admin/pending-sellers',  label: '매장 검수',     icon: UserCheck },
      { path: '/admin/coupons',          label: '쿠폰 관리',     icon: Ticket },
      { path: '/admin/deals',            label: '딜 모니터링',   icon: Gift },
      { path: '/admin/restaurant-demand', label: '맛집 수요 신호', icon: TrendingUp },
    ],
  },
  {
    // 🛒 온라인 쇼핑 (일반 상품 / 주문 / 교환권 발행)
    title: '🛒 온라인 쇼핑',
    items: [
      { path: '/admin/products',         label: '상품 관리',     icon: Package },
      { path: '/admin/orders',           label: '주문 관리',     icon: ShoppingBag },
      { path: '/admin/kt-alpha',         label: 'KT Alpha (교환권)', icon: Gift },
      { path: '/admin/banners',          label: '배너 관리',     icon: Image },
    ],
  },
  {
    title: '회원/파트너',
    items: [
      { path: '/admin/users',           label: '유저 관리',     icon: Users },
      { path: '/admin/seller-approval', label: '셀러 관리',     icon: UserCheck },
      { path: '/admin/prospects',       label: '영업 추적',     icon: UserCheck },
      { path: '/admin/agencies',        label: '에이전시',      icon: Building2 },
    ],
  },
  {
    title: '정산/재무',
    items: [
      { path: '/admin/settlement',       label: '정산',          icon: DollarSign },
      { path: '/admin/settlements-bulk', label: '정산 일괄',     icon: CreditCard },
      { path: '/admin/payouts',          label: '💸 통합 정산 (ledger)', icon: Wallet },
      { path: '/admin/commission-withdrawals', label: '추천 출금 승인', icon: DollarSign },
    ],
  },
  {
    title: '검증/CS',
    items: [
      { path: '/admin/disputes',         label: '분쟁 큐',       icon: AlertOctagon },
      { path: '/admin/business-verification', label: '사업자 검증', icon: Shield },
      { path: '/admin/review-moderation', label: '리뷰 관리',     icon: MessageSquare },
    ],
  },
  {
    title: '콘텐츠',
    items: [
      { path: '/admin/blog',              label: '블로그 관리',   icon: BookOpen },
      { path: '/admin/notices',           label: '공지사항',      icon: Send },
    ],
  },
  {
    // 📺 라이브커머스 — 잠정 중단(LIVE_COMMERCE_SUSPENDED). 그룹째 숨김, 재개 시 플래그만 false → 복원.
    title: '📺 라이브커머스',
    items: [
      { path: '/admin/live-monitor',     label: '라이브 모니터', icon: Radio },
      { path: '/admin/ad-slots',         label: '광고 슬롯',     icon: Megaphone },
      { path: '/admin/castings',         label: '캐스팅',        icon: Megaphone },
      { path: '/admin/tiktok-discovery', label: 'TikTok 발굴',   icon: Sparkles },
      { path: '/admin/replay',           label: '다시보기 관리', icon: Play },
    ],
  },
  {
    title: '시스템',
    items: [
      { path: '/admin/accounts',          label: '관리자 계정',   icon: UserCog },
      { path: '/admin/audit-log',         label: '감사 로그',     icon: Shield },
      { path: '/admin/2fa',               label: '2단계 인증',    icon: Shield },
      { path: '/admin/platform-settings',      label: '플랫폼 설정',   icon: Settings },
      { path: '/admin/notification-settings',  label: '알림 채널 설정', icon: Bell },
      { path: '/admin/alimtalk',               label: '브랜드메시지',  icon: Bell },
      { path: '/admin/sample-requests',   label: '샘플 신청',     icon: ClipboardList },
      { path: '/admin/kv-monitoring',     label: 'KV 모니터링',   icon: Monitor },
      { path: '/admin/cafe24',            label: 'Cafe24 연동',   icon: Store },
    ],
  },
]

// 🏭 2026-06-04 라이브커머스 잠정 중단 — 어드민 nav 에서 라이브 전용 항목 숨김 (플래그 재사용, 복원 가능).
//   라이브 모니터 / 광고 슬롯(입찰) / 캐스팅 / TikTok 발굴 / 다시보기(라이브 replay).
const LIVE_ADMIN_PATHS = new Set<string>([
  '/admin/live-monitor', '/admin/ad-slots', '/admin/castings', '/admin/tiktok-discovery', '/admin/replay',
])
const VISIBLE_NAV_GROUPS: NavGroup[] = LIVE_COMMERCE_SUSPENDED
  ? NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => !LIVE_ADMIN_PATHS.has(it.path)) })).filter((g) => g.items.length > 0)
  : NAV_GROUPS

interface AdminLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  pendingCount?: number
}

export default function AdminLayout({ title, children, headerRight, pendingCount = 0 }: AdminLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 🛡️ 2026-04-30: admin 세션 만료 5분 전 자동 refresh
  useTokenAutoRefresh('admin')

  // 🛡️ 2026-04-28: 전역 검색 — 실제 input + Enter 키로 분기 navigate.
  const [searchQuery, setSearchQuery] = useState('')
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    // 숫자만 = order_number 또는 id 조회 → /admin/users 또는 /admin/orders
    // @ 포함 = email 조회 → users
    // 그 외 = users 검색 (셀러 검색은 /admin/seller-approval 에서 별도)
    if (/^\d+$/.test(q)) {
      navigate(`/admin/orders?q=${encodeURIComponent(q)}`)
    } else if (q.includes('@')) {
      navigate(`/admin/users?q=${encodeURIComponent(q)}`)
    } else {
      navigate(`/admin/users?q=${encodeURIComponent(q)}`)
    }
    setSearchQuery('')
  }

  const [adminName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('admin_name') || localStorage.getItem('admin_email') : null) || '관리자')

  function logout() {
    clearAuthData('admin')
    navigate('/admin/login')
  }

  function isActive(path: string, exact?: boolean) {
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  // 🛡️ 사이드바를 함수 컴포넌트가 아닌 JSX 변수로 — re-render 시 새 함수 참조 방지
  // (이전엔 navigation 마다 unmount/remount → <nav> 스크롤 reset 버그 발생).
  const sidebar = (
    <aside className="w-[232px] flex-shrink-0 flex flex-col h-full" style={{ background: '#0A0A0B' }}>
      {/* Branding */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <UrDealLogo size={14} forceDark />
          <span
            className="font-bold uppercase text-white"
            style={{ fontSize: '9px', letterSpacing: '0.08em', color: '#FCD34D' }}
          >
            ADMIN CONSOLE
          </span>
          <span
            className="ml-auto font-extrabold rounded px-1.5 py-0.5"
            style={{ fontSize: '9px', background: '#FCD34D', color: '#0A0A0B' }}
          >
            PROD
          </span>
        </div>
      </div>

      {/* 🛡️ 2026-04-28: Global search bar — 실제 동작.
           숫자만: 주문 / @포함: 유저 / 일반: 유저 검색 */}
      <form onSubmit={handleSearch} className="px-4 py-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg focus-within:ring-1 focus-within:ring-white/20"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <Search size={13} strokeWidth={2} className="text-white/40 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="주문번호 / 이메일 / 이름…"
            aria-label="전역 검색 (주문번호 / 이메일 / 이름)"
            className="flex-1 bg-transparent text-white text-[11px] placeholder:text-white/40 focus:outline-none min-w-0"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-white/40 hover:text-white/70 text-xs flex-shrink-0"
              aria-label="검색어 지우기"
            >×</button>
          )}
        </div>
      </form>

      {/* Grouped navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide pb-2">
        {VISIBLE_NAV_GROUPS.map((group) => (
          <div key={group.title} className="mt-3 first:mt-1">
            <div
              className="px-4 py-1.5 font-extrabold uppercase text-white/30"
              style={{ fontSize: '9px', letterSpacing: '0.12em' }}
            >
              {group.title}
            </div>
            {group.items.map(({ path, label, icon: Icon, exact }) => {
              const active = isActive(path, exact)
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  // 🛡️ 2026-05-20: inline style + onMouseEnter/Leave 제거 (CSP unsafe-inline).
                  //   amber 강조 gradient 는 index.css .ur-admin-nav-active (border 색은 amber-300).
                  className={`flex items-center gap-2.5 px-4 py-[7px] text-[12px] font-semibold transition-colors border-l-[2.5px] ${
                    active
                      ? 'text-white border-amber-300 ur-admin-nav-active'
                      : 'text-white/55 hover:text-white border-transparent'
                  }`}
                >
                  <Icon size={14} strokeWidth={2} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {label === '주문 관리' && pendingCount > 0 && (
                    <span className="text-[9px] font-extrabold px-1.5 rounded-full bg-white/10 text-white">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom user profile */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FCD34D, #F59E0B)',
              color: '#0A0A0B',
            }}
          >
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold text-white truncate">{adminName}</p>
            <p className="text-[9px] text-white/50">플랫폼 운영팀 · 관리자</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-2.5 flex items-center gap-2 px-1 py-1 text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut size={12} strokeWidth={2} />
          로그아웃
        </button>
      </div>
    </aside>
  )

  return (
    <div className="admin-light-theme flex h-screen overflow-hidden bg-[#F4F5F7] text-gray-900">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="hidden lg:flex">
        {sidebar}
      </div>

      <div className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
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
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <DashboardNotificationBell tokenKey="admin_token" />
            {headerRight}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-5">
          {children}
        </main>
      </div>
    </div>
  )
}
