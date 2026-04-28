import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, Package, DollarSign,
  Bell, Image, Monitor, LogOut, Menu, X, Store, ClipboardList, Search, Gift, Ticket, Play, BookOpen, Building2, UserCheck, Settings, Send, CreditCard,
  BarChart3, Shield, UserCog, Radio, Users, MessageSquare, Megaphone, Sparkles, AlertTriangle, TrendingUp,
  type LucideIcon
} from 'lucide-react'
import { clearAuthData } from '@/utils/auth'
import DashboardNotificationBell from './DashboardNotificationBell'

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

const NAV_GROUPS: NavGroup[] = [
  {
    title: '운영',
    items: [
      { path: '/admin',                  label: '대시보드',      icon: LayoutDashboard, exact: true },
      { path: '/admin/insights',         label: '운영 인사이트', icon: AlertTriangle },
      { path: '/admin/operations-guide', label: '운영 가이드',   icon: BookOpen },
      { path: '/admin/revenue',          label: '매출 분석',     icon: BarChart3 },
      { path: '/admin/live-monitor',     label: '라이브 모니터', icon: Radio },
    ],
  },
  {
    title: '파트너',
    items: [
      { path: '/admin/users',           label: '유저 관리',     icon: Users },
      { path: '/admin/seller-approval', label: '셀러 관리',     icon: UserCheck },
      { path: '/admin/agencies',        label: '에이전시',      icon: Building2 },
    ],
  },
  {
    title: '거래',
    items: [
      { path: '/admin/orders',           label: '주문 관리',     icon: ShoppingBag },
      { path: '/admin/products',         label: '상품 관리',     icon: Package },
      { path: '/admin/settlement',       label: '정산',          icon: DollarSign },
      { path: '/admin/settlements-bulk', label: '정산 일괄',     icon: CreditCard },
      { path: '/admin/deals',            label: '딜 모니터링',   icon: Gift },
      { path: '/admin/coupons',          label: '쿠폰 관리',    icon: Ticket },
      { path: '/admin/castings',         label: '캐스팅',        icon: Megaphone },
      { path: '/admin/tiktok-discovery', label: 'TikTok 발굴',   icon: Sparkles },
      { path: '/admin/restaurant-demand', label: '맛집 수요 신호', icon: TrendingUp },
    ],
  },
  {
    title: '콘텐츠',
    items: [
      { path: '/admin/review-moderation', label: '리뷰 관리',     icon: MessageSquare },
      { path: '/admin/banners',           label: '배너 관리',     icon: Image },
      { path: '/admin/replay',            label: '다시보기 관리', icon: Play },
      { path: '/admin/blog',              label: '블로그 관리',   icon: BookOpen },
      { path: '/admin/notices',           label: '공지사항',      icon: Send },
    ],
  },
  {
    title: '시스템',
    items: [
      { path: '/admin/accounts',          label: '관리자 계정',   icon: UserCog },
      { path: '/admin/audit-log',         label: '감사 로그',     icon: Shield },
      { path: '/admin/platform-settings', label: '플랫폼 설정',   icon: Settings },
      { path: '/admin/alimtalk',          label: '브랜드메시지',  icon: Bell },
      { path: '/admin/sample-requests',   label: '샘플 신청',     icon: ClipboardList },
      { path: '/admin/kv-monitoring',     label: 'KV 모니터링',   icon: Monitor },
      { path: '/admin/cafe24',            label: 'Cafe24 연동',   icon: Store },
    ],
  },
]

interface AdminLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
  pendingCount?: number
}

export default function AdminLayout({ title, children, headerRight, pendingCount = 0 }: AdminLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
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

  const adminName = localStorage.getItem('admin_name') || localStorage.getItem('admin_email') || '관리자'

  function logout() {
    clearAuthData('admin')
    navigate('/admin/login')
  }

  function isActive(path: string, exact?: boolean) {
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  const Sidebar = () => (
    <aside className="w-[232px] flex-shrink-0 flex flex-col h-full" style={{ background: '#0A0A0B' }}>
      {/* Branding */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <span
            className="font-extrabold italic text-white"
            style={{ fontSize: '13px', letterSpacing: '-0.03em' }}
          >
            UR·DEAL
          </span>
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
        {NAV_GROUPS.map((group) => (
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
                  className="flex items-center gap-2.5 px-4 py-[7px] text-[12px] font-semibold transition-colors"
                  style={
                    active
                      ? {
                          color: '#FFFFFF',
                          borderLeft: '2.5px solid #FCD34D',
                          background: 'linear-gradient(to right, rgba(252,211,77,0.12), transparent)',
                        }
                      : {
                          color: 'rgba(255,255,255,0.55)',
                          borderLeft: '2.5px solid transparent',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = '#FFFFFF'
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                  }}
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
        <Sidebar />
      </div>

      <div className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
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
