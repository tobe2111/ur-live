import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import {
  LayoutDashboard, Users, ShoppingBag, BarChart2, LogOut, Menu, X,
  Settings, Bell, Target, Calendar, Utensils, FileText, GitCompare,
  TrendingUp, Radio, UserPlus, BookOpen, Megaphone, Award, MessageSquare, Ticket,
  type LucideIcon
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  exact?: boolean
  badge?: string
  liveBadge?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: '운영',
    items: [
      { path: '/agency',          label: '대시보드',    icon: LayoutDashboard, exact: true },
      { path: '/agency/sellers',  label: '담당 셀러',   icon: Users },
      { path: '/agency/streams',  label: '라이브 현황',  icon: Radio, liveBadge: true },
      { path: '/agency/schedule', label: '방송 캘린더',  icon: Calendar },
    ],
  },
  {
    label: '판매 관리',
    items: [
      { path: '/agency/orders',    label: '주문 현황', icon: ShoppingBag },
      { path: '/agency/group-buy', label: '공동구매',  icon: Utensils },
      { path: '/agency/returns',   label: '반품/CS',  icon: ShoppingBag },
    ],
  },
  {
    label: '분석 & 성과',
    items: [
      { path: '/agency/stats',   label: '통계 분석', icon: BarChart2 },
      { path: '/agency/ranking', label: '셀러 랭킹', icon: BarChart2 },
      { path: '/agency/compare', label: '셀러 비교', icon: GitCompare },
      { path: '/agency/targets', label: '매출 목표', icon: Target },
    ],
  },
  // 🛡️ 2026-04-26: TikTok Backstage 학습 기반 신규 운영 도구
  {
    label: '캠페인 & 영업',
    items: [
      { path: '/agency/campaigns',  label: '캠페인',       icon: Megaphone },
      { path: '/agency/incentives', label: '인센티브 규칙', icon: Award },
      { path: '/agency/messages',   label: '메시지 템플릿', icon: MessageSquare },
      { path: '/agency/coupons',    label: '쿠폰 배포',     icon: Ticket },
    ],
  },
  {
    label: '재무 & 설정',
    items: [
      { path: '/agency/settlements', label: '정산 관리',   icon: TrendingUp },
      { path: '/agency/contracts',   label: '계약 관리',   icon: FileText },
      { path: '/agency/notices',     label: '셀러 공지',   icon: Bell },
      { path: '/agency/guide',       label: '운영 가이드',  icon: BookOpen },
      { path: '/agency/profile',     label: '프로필 설정',  icon: Settings },
    ],
  },
]

interface AgencyLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
}

export default function AgencyLayout({ title, children, headerRight }: AgencyLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [agencyName, setAgencyName] = useState(localStorage.getItem('agency_name') || '에이전시')
  const [agencyStatus, setAgencyStatus] = useState<string | null>(null)
  const [sellerCount, setSellerCount] = useState(0)
  const [revenue30d, setRevenue30d] = useState<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('agency_token')
    if (!token) return
    api.get('/api/agency/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const name = r.data?.data?.name
        const status = r.data?.data?.status
        if (name) {
          setAgencyName(name)
          localStorage.setItem('agency_name', name)
        }
        if (status) setAgencyStatus(status)
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[AgencyLayout] profile fetch failed:', e) })
    api.get('/api/agency/sellers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const sellers = r.data?.data || []
        setSellerCount(sellers.length)
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[AgencyLayout] sellers fetch failed:', e) })
    api.get('/api/agency/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const rev = r.data?.data?.revenue_30d
        if (typeof rev === 'number') setRevenue30d(rev)
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[AgencyLayout] stats fetch failed:', e) })
  }, [])

  // 인증 파트너 라벨은 status === 'approved'일 때만 표시 (그 외엔 일반 파트너)
  const isVerifiedPartner = agencyStatus === 'approved'
  // 성장 활성 라벨은 최근 30일 매출이 있을 때만 표시
  const hasActiveGrowth = revenue30d != null && revenue30d > 0

  function logout() {
    ['agency_token', 'agency_id', 'agency_name', 'agency_email'].forEach(k => localStorage.removeItem(k))
    navigate('/agency/login')
  }

  function isActive(path: string, exact?: boolean) {
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  const initials = agencyName.slice(0, 2).toUpperCase()

  const Sidebar = () => (
    <aside className="w-[224px] flex-shrink-0 flex flex-col h-full" style={{ background: '#0A0A0B' }}>
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
            className="font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.08em', color: '#8B5CF6' }}
          >
            AGENCY PARTNER
          </span>
        </div>
      </div>

      {/* Agency info card */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #EC4899)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold text-white truncate">{agencyName}</p>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {isVerifiedPartner ? '인증 파트너' : '파트너'}
            </p>
          </div>
        </div>
        {/* Mini stat grid */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div
            className="rounded-lg px-2.5 py-2 text-center"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <p className="text-[10px] font-bold text-white/40">담당</p>
            <p className="text-[13px] font-extrabold text-white">{sellerCount}<span className="text-[9px] text-white/50 ml-0.5">셀러</span></p>
          </div>
          <div
            className="rounded-lg px-2.5 py-2 text-center"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <p className="text-[10px] font-bold text-white/40">30일 매출</p>
            {revenue30d == null ? (
              <p className="text-[13px] font-extrabold text-white/50">—</p>
            ) : hasActiveGrowth ? (
              <p className="text-[13px] font-extrabold" style={{ color: '#10B981' }}>
                <TrendingUp size={10} className="inline mr-0.5" style={{ verticalAlign: 'middle' }} />
                활성
              </p>
            ) : (
              <p className="text-[13px] font-extrabold text-white/60">휴면</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation — 그룹별 */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide pb-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="mt-3 first:mt-1">
            <div
              className="px-4 py-1.5 font-extrabold uppercase text-white/30"
              style={{ fontSize: '9px', letterSpacing: '0.12em' }}
            >
              {group.label}
            </div>
            {group.items.map(({ path, label, icon: Icon, exact, badge, liveBadge }) => {
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
                          borderLeft: '2.5px solid #8B5CF6',
                          background: 'linear-gradient(to right, rgba(139,92,246,0.18), transparent)',
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
                  {liveBadge && (
                    <span
                      className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#F87171' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                  {badge && (
                    <span className="text-[9px] font-extrabold px-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }}>
                      {badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: invite button + logout */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => navigate('/agency/sellers')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-extrabold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
        >
          <UserPlus size={14} strokeWidth={2} />
          셀러 초대
        </button>
        <button
          onClick={logout}
          className="mt-2 flex items-center gap-2 px-1 py-1 text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut size={12} strokeWidth={2} />
          로그아웃
        </button>
      </div>
    </aside>
  )

  return (
    <div className="agency-light-theme flex h-screen overflow-hidden bg-[#F4F5F7] text-gray-900">
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
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-5">
          {children}
        </main>
      </div>

      {/* Mobile quick-action FAB */}
      <div className="lg:hidden fixed bottom-6 right-4 z-40">
        <button
          onClick={() => navigate('/agency/schedule')}
          className="flex items-center gap-2 px-5 py-3 rounded-full text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(90deg, #8B5CF6, #EC4899)', boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}
        >
          <Calendar className="w-4 h-4" />
          라이브 편성
        </button>
      </div>
    </div>
  )
}
