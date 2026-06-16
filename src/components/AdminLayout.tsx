import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingBag, Package, DollarSign,
  Bell, Image, Monitor, LogOut, Menu, X, Store, ClipboardList, Search, Gift, Ticket, Play, BookOpen, Building2, UserCheck, Settings, Send, CreditCard,
  BarChart3, Shield, UserCog, Radio, Users, MessageSquare, Megaphone, Sparkles, AlertTriangle, TrendingUp, AlertOctagon, Wallet, Layers, Mail, Crown,
  ChevronDown, Wrench, RotateCcw,
  type LucideIcon
} from 'lucide-react'
import { clearAuthData } from '@/utils/auth'
import { normalizeAdminRole, ADMIN_ROLE_LABEL, type AdminRole } from '@/shared/admin-roles'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import { usePersistScroll } from '@/hooks/usePersistScroll'
import DashboardNotificationBell from './DashboardNotificationBell'
import UrDealLogo from '@/components/brand/UrDealLogo'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  exact?: boolean
  /** 🧭 탭으로 묶인 형제 라우트 — 이 경로들에서도 본 항목을 활성 표시. */
  also?: string[]
}

interface NavGroup {
  title: string
  items: NavItem[]
  /** 🔧 진단성 그룹 등 평소 접어둘 그룹 (사용자 토글이 항상 우선). */
  defaultCollapsed?: boolean
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
      { path: '/admin/business-metrics', label: '비즈니스 지표', icon: BarChart3 },
      { path: '/admin/revenue',          label: '매출 분석',     icon: BarChart3 },
      { path: '/admin/operations-guide', label: '운영 가이드',   icon: BookOpen },
      { path: '/admin/abuse',            label: '어뷰징 탐지',   icon: AlertOctagon },
    ],
  },
  {
    // 🏭 도매몰 (유통스타트 B2B)
    title: '🏭 도매몰',
    items: [
      { path: '/admin/wholesale-overview', label: '도매 통합 현황', icon: LayoutDashboard },
      { path: '/admin/wholesale-malls',    label: '도매 몰 관리',  icon: Building2 },
      { path: '/admin/suppliers',          label: '공급자 관리',   icon: Store },
      { path: '/admin/distributor-grades', label: '유통사 등급',   icon: Layers },
      { path: '/admin/wholesale-orders',   label: '도매 주문',     icon: ShoppingBag },
      { path: '/admin/wholesale-banners',  label: '도매 배너',     icon: Image },
      { path: '/admin/wholesale-board',    label: '도매 게시판',   icon: Megaphone },
      { path: '/admin/partnership',        label: '광고·제휴 문의', icon: Mail },
      { path: '/admin/wholesale-products', label: '도매 프리미엄관', icon: Crown },
      { path: '/admin/wholesale-proposals', label: '도매 제안/신고', icon: MessageSquare },
      { path: '/admin/wholesale-deposits', label: '도매 예치금',   icon: Wallet },
      { path: '/admin/wholesale-withdrawals', label: '제조사 출금', icon: Wallet },
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
      // 🧭 2026-06-09 IA 정리: nav 미노출 고아 라우트 등재 — 반품/교환권 추적은 주문 운영 실무 페이지.
      { path: '/admin/returns',          label: '반품 검수',     icon: RotateCcw },
      { path: '/admin/kt-alpha',         label: 'KT Alpha (교환권)', icon: Gift },
      { path: '/admin/voucher-orders',   label: 'KT 발송 추적',  icon: Send },
      { path: '/admin/voucher-transactions', label: '교환권 거래', icon: Ticket },
      { path: '/admin/banners',          label: '배너 관리',     icon: Image },
    ],
  },
  {
    title: '회원/파트너',
    items: [
      { path: '/admin/users',           label: '유저 관리',     icon: Users },
      { path: '/admin/seller-approval', label: '셀러 관리',     icon: UserCheck },
      { path: '/admin/agency-creator-approval', label: '에이전시 셀러 심사', icon: UserCheck },
      { path: '/admin/prospects',       label: '영업 추적',     icon: UserCheck },
      { path: '/admin/agencies',        label: '에이전시',      icon: Building2 },
    ],
  },
  {
    title: '💰 정산/재무',
    items: [
      // 🧭 2026-06-09 IA 정리: 정산 4페이지(개별/일괄/Ledger/추천출금)는 페이지 상단 AdminFinanceTabs 로
      //   상호 이동 — nav 는 진입점 1개만. 라우트는 전부 보존(북마크 안전).
      { path: '/admin/settlement',       label: '정산 센터',     icon: DollarSign, also: ['/admin/settlements-bulk', '/admin/payouts', '/admin/commission-withdrawals', '/admin/payout-center'] },
      // 돈 관련 고아 라우트를 재무 그룹으로 — URL 직접 입력 없이 도달 가능하게.
      { path: '/admin/influencer-payouts', label: '인플루언서 송금', icon: Wallet },
      { path: '/admin/withholding',      label: '원천징수/지급조서', icon: Shield },
      { path: '/admin/commission-settings', label: '정산 마진 설정', icon: Settings },
      { path: '/admin/merchant-commissions', label: '매장 커미션', icon: Store },
    ],
  },
  {
    title: '검증/CS',
    items: [
      { path: '/admin/disputes',         label: '분쟁 큐',       icon: AlertOctagon },
      { path: '/admin/influencer-disputes', label: '인플루언서 분쟁', icon: AlertOctagon },
      { path: '/admin/business-verification', label: '사업자 검증', icon: Shield },
      { path: '/admin/review-moderation', label: '리뷰 관리',     icon: MessageSquare },
      { path: '/admin/kakao-reviews',    label: '카카오맵 후기 검증', icon: MessageSquare },
      { path: '/admin/policy',           label: '정책 대시보드', icon: Shield },
    ],
  },
  {
    title: '콘텐츠',
    items: [
      { path: '/admin/blog',              label: '블로그 관리',   icon: BookOpen },
      { path: '/admin/notices',           label: '공지사항',      icon: Send },
      { path: '/admin/bulk-email',        label: '단체메일',      icon: Mail },
      { path: '/admin/reviews',           label: '리뷰 자동 생성', icon: Sparkles },
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
      { path: '/admin/cafe24',            label: 'Cafe24 연동',   icon: Store },
    ],
  },
  {
    // 🔧 2026-06-09 IA 정리: 진단/디버그성 고아 라우트 — 평소엔 접어두는 개발자 도구 그룹.
    title: '🔧 개발자 도구',
    defaultCollapsed: true,
    items: [
      { path: '/admin/system-monitoring', label: '시스템 모니터링', icon: Monitor },
      { path: '/admin/kv-monitoring',     label: 'KV 모니터링',   icon: Monitor },
      { path: '/admin/health',            label: '헬스 체크',     icon: Shield },
      { path: '/admin/errors',            label: '에러 로그',     icon: AlertTriangle },
      { path: '/admin/env-check',         label: 'ENV 점검',      icon: Settings },
      { path: '/admin/kakao-test',        label: '카카오 연동 테스트', icon: Wrench },
      { path: '/admin/youtube-quota',     label: 'YouTube 쿼터',  icon: Play },
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

  // 🧭 2026-06-09 IA 정리: nav 그룹 접기/펼치기 — 가시 항목 60+개 과부하 해소.
  //   localStorage 영속(세션 간 유지). 활성 페이지가 속한 그룹은 접혀 있어도 강제 펼침(길 잃지 않게).
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('admin_nav_collapsed_v1') || '{}') as Record<string, boolean>
      const init: Record<string, boolean> = {}
      for (const g of VISIBLE_NAV_GROUPS) init[g.title] = saved[g.title] ?? !!g.defaultCollapsed
      return init
    } catch { return {} }
  })
  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] }
      try { localStorage.setItem('admin_nav_collapsed_v1', JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }

  // 🛡️ 2026-04-30: admin 세션 만료 5분 전 자동 refresh
  useTokenAutoRefresh('admin')

  // 🏁 2026-06-13: 사이드바 스크롤 영속 — 라우트 이동 시 좌측 카테고리 최상단 복귀 방지
  const navScrollRef = usePersistScroll('admin-sidebar')

  // 🏁 2026-06-14 (사용자 요청 — "좌측 카테고리에 신규 이슈 있으면 알람 숫자라도"):
  //   미읽음 어드민 알림(dashboard_notifications)의 link 를 nav 항목 path 에 매칭해 항목별 배지.
  //   60초 폴링. 알림 link 가 없거나 매칭 안 되면 무시(조용히). 추가 fetch 1개라 비용 미미.
  const [navBadges, setNavBadges] = useState<Record<string, number>>({})
  useEffect(() => {
    let alive = true
    // exact 항목(예: /admin 대시보드)은 정확 일치만, 나머지는 최장 prefix 매칭
    const navPaths = VISIBLE_NAV_GROUPS.flatMap(g => g.items.map(it => ({ path: it.path, exact: !!it.exact })))
    const bestPath = (link: string): string | null => {
      let best: string | null = null
      for (const { path, exact } of navPaths) {
        const match = exact ? link === path : (link === path || link.startsWith(path + '/') || link.startsWith(path + '?'))
        if (match && (!best || path.length > best.length)) best = path
      }
      return best
    }
    async function load() {
      try {
        const res = await api.get('/api/dashboard-notifications?unread_only=true&limit=100')
        if (!alive || !res.data?.success) return
        const list = (res.data.notifications || []) as Array<{ link?: string | null }>
        const counts: Record<string, number> = {}
        for (const n of list) {
          if (!n.link || !n.link.startsWith('/admin')) continue
          const p = bestPath(n.link)
          if (p) counts[p] = (counts[p] || 0) + 1
        }
        setNavBadges(counts)
      } catch { /* 실패해도 nav 는 정상 */ }
    }
    load()
    const iv = setInterval(load, 60000)
    return () => { alive = false; clearInterval(iv) }
  }, [])
  // 그룹 접힘 시 합계 배지
  const groupBadgeTotal = (items: { path: string }[]) => items.reduce((s, it) => s + (navBadges[it.path] || 0), 0)

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
  // 🛡️ 2026-06-16 RBAC 네비 게이트 — 슈퍼 전용 항목(계정/감사/2FA)은 슈퍼만 노출. 변경 권한 강제는 서버(admin-rbac).
  const [adminRole] = useState<AdminRole>(() => normalizeAdminRole(typeof window !== 'undefined' ? localStorage.getItem('admin_role') : null))
  const SUPER_ONLY_NAV = new Set(['/admin/accounts', '/admin/audit-log'])
  const roleNavGroups = adminRole === 'super'
    ? VISIBLE_NAV_GROUPS
    : VISIBLE_NAV_GROUPS
        .map((g) => ({ ...g, items: g.items.filter((it) => !SUPER_ONLY_NAV.has(it.path)) }))
        .filter((g) => g.items.length > 0)

  function logout() {
    clearAuthData('admin')
    navigate('/admin/login')
  }

  function isActive(path: string, exact?: boolean, also?: string[]) {
    if (also?.some((p) => location.pathname.startsWith(p))) return true
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

      {/* Grouped navigation — 그룹 헤더 클릭으로 접기/펼치기 (활성 그룹은 강제 펼침) */}
      <nav ref={navScrollRef} className="flex-1 overflow-y-auto scrollbar-hide pb-2">
        {roleNavGroups.map((group) => {
          const hasActive = group.items.some((it) => isActive(it.path, it.exact, it.also))
          const collapsed = !!collapsedGroups[group.title] && !hasActive
          return (
          <div key={group.title} className="mt-3 first:mt-1">
            <button
              type="button"
              onClick={() => toggleGroup(group.title)}
              aria-expanded={!collapsed}
              className="w-full flex items-center justify-between px-4 py-1.5 font-extrabold uppercase text-white/30 hover:text-white/60 transition-colors"
              style={{ fontSize: '9px', letterSpacing: '0.12em' }}
            >
              <span>{group.title}</span>
              <span className="flex items-center gap-1">
                {collapsed && groupBadgeTotal(group.items) > 0 && (
                  <span className="font-extrabold normal-case tracking-normal px-1.5 rounded-full bg-amber-400 text-[#0A0A0B] text-[9px]">{groupBadgeTotal(group.items)}</span>
                )}
                {collapsed && <span className="font-bold normal-case tracking-normal text-white/25">{group.items.length}</span>}
                <ChevronDown size={11} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
              </span>
            </button>
            {!collapsed && group.items.map(({ path, label, icon: Icon, exact, also }) => {
              const active = isActive(path, exact, also)
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
                  {/* 🏁 2026-06-14: 신규 이슈(미읽음 알림) 배지 */}
                  {(navBadges[path] || 0) > 0 && (
                    <span className="text-[9px] font-extrabold px-1.5 rounded-full bg-amber-400 text-[#0A0A0B] flex-shrink-0">
                      {navBadges[path]}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
          )
        })}
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
            <p className="text-[9px] text-white/50">
              플랫폼 운영팀 · <span className={adminRole === 'viewer' ? 'text-amber-300' : adminRole === 'super' ? 'text-red-300' : 'text-white/70'}>{ADMIN_ROLE_LABEL[adminRole]}</span>
              {adminRole === 'viewer' && ' (읽기전용)'}
            </p>
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
