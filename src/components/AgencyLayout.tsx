import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import DashboardNotificationBell from './DashboardNotificationBell'
import UrDealLogo from '@/components/brand/UrDealLogo'
import {
  LayoutDashboard, Users, ShoppingBag, BarChart2, LogOut, Menu, X,
  Settings, Bell, Target, Calendar, Utensils, FileText, GitCompare,
  TrendingUp, Radio, UserPlus, BookOpen, Megaphone, Award, MessageSquare, Ticket, QrCode, Swords, ArrowRightLeft, Trophy, Rocket,
  type LucideIcon
} from 'lucide-react'

interface NavItem {
  path: string
  label: string         // Korean fallback (i18n 미적용 시)
  i18nKey?: string      // 'agency.nav.dashboard' 등 — 우선 사용
  icon: LucideIcon
  exact?: boolean
  badge?: string
  liveBadge?: boolean
}

interface NavGroup {
  label: string         // Korean fallback
  i18nKey?: string      // 'agency.nav.operations' 등
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: '운영', i18nKey: 'agency.nav.operations',
    items: [
      { path: '/agency',          label: '대시보드',    i18nKey: 'agency.nav.dashboard', icon: LayoutDashboard, exact: true },
      { path: '/agency/sellers',  label: '담당 셀러',   i18nKey: 'agency.nav.sellers', icon: Users },
      { path: '/agency/streams',  label: '라이브 현황',  i18nKey: 'agency.nav.streams', icon: Radio, liveBadge: true },
      { path: '/agency/schedule', label: '방송 캘린더',  i18nKey: 'agency.nav.schedule', icon: Calendar },
    ],
  },
  {
    label: '판매 관리', i18nKey: 'agency.nav.sales',
    items: [
      { path: '/agency/orders',    label: '주문 현황', i18nKey: 'agency.nav.orders', icon: ShoppingBag },
      { path: '/agency/group-buy', label: '공동구매',  i18nKey: 'agency.nav.groupBuy', icon: Utensils },
      { path: '/agency/returns',   label: '반품/CS',  i18nKey: 'agency.nav.returns', icon: ShoppingBag },
    ],
  },
  {
    label: '분석 & 성과', i18nKey: 'agency.nav.analytics',
    items: [
      { path: '/agency/stats',   label: '통계 분석', i18nKey: 'agency.nav.stats', icon: BarChart2 },
      { path: '/agency/ranking', label: '셀러 랭킹', i18nKey: 'agency.nav.ranking', icon: BarChart2 },
      { path: '/agency/compare', label: '셀러 비교', i18nKey: 'agency.nav.compare', icon: GitCompare },
      { path: '/agency/targets', label: '매출 목표', i18nKey: 'agency.nav.targets', icon: Target },
    ],
  },
  // 🛡️ 2026-04-26: TikTok Backstage 학습 기반 신규 운영 도구
  {
    label: '캠페인 & 영업', i18nKey: 'agency.nav.campaignSales',
    items: [
      { path: '/agency/campaigns',  label: '캠페인',       i18nKey: 'agency.nav.campaigns', icon: Megaphone },
      { path: '/agency/incentives', label: '인센티브 규칙', i18nKey: 'agency.nav.incentives', icon: Award },
      { path: '/agency/messages',   label: '메시지 템플릿', i18nKey: 'agency.nav.messages', icon: MessageSquare },
      { path: '/agency/coupons',    label: '쿠폰 배포',     i18nKey: 'agency.nav.coupons', icon: Ticket },
      { path: '/agency/calendar',   label: '라이브 캘린더', i18nKey: 'agency.nav.calendar', icon: Calendar },
      { path: '/agency/invites',    label: '셀러 영입',     i18nKey: 'agency.nav.invites', icon: QrCode },
      { path: '/agency/match-suggestions', label: '자동 매칭 제안', i18nKey: 'agency.nav.matchSuggestions', icon: UserPlus },
      { path: '/agency/pk',         label: 'PK 이벤트',     i18nKey: 'agency.nav.pk', icon: Swords },
      { path: '/agency/events',     label: '자사 챌린지',   i18nKey: 'agency.nav.events', icon: Trophy },
      { path: '/agency/promote-boosts', label: '노출 부스팅', i18nKey: 'agency.nav.promoteBoosts', icon: Rocket },
      { path: '/agency/transfers',  label: '셀러 이전',     i18nKey: 'agency.nav.transfers', icon: ArrowRightLeft },
    ],
  },
  {
    label: '팀 운영', i18nKey: 'agency.nav.teamOps',
    items: [
      { path: '/agency/members', label: '팀 멤버', i18nKey: 'agency.nav.members', icon: Users },
    ],
  },
  {
    label: '재무 & 설정', i18nKey: 'agency.nav.finance',
    items: [
      { path: '/agency/settlements', label: '정산 관리',   i18nKey: 'agency.nav.settlements', icon: TrendingUp },
      { path: '/agency/contracts',   label: '계약 관리',   i18nKey: 'agency.nav.contracts', icon: FileText },
      { path: '/agency/notices',     label: '셀러 공지',   i18nKey: 'agency.nav.notices', icon: Bell },
      { path: '/agency/guide',       label: '운영 가이드',  i18nKey: 'agency.nav.guide', icon: BookOpen },
      { path: '/agency/profile',     label: '프로필 설정',  i18nKey: 'agency.nav.profile', icon: Settings },
    ],
  },
]

interface AgencyLayoutProps {
  title: string
  children: React.ReactNode
  headerRight?: React.ReactNode
}

export default function AgencyLayout({ title, children, headerRight }: AgencyLayoutProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 🛡️ 2026-04-30: agency 세션 만료 5분 전 자동 refresh
  useTokenAutoRefresh('agency')

  const [agencyName, setAgencyName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('agency_name') : null) || '에이전시')
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

  // 🛡️ 사이드바를 함수 컴포넌트가 아닌 JSX 변수로 — re-render 시 새 함수 참조 방지
  // (이전엔 navigation 마다 unmount/remount → <nav> 스크롤 reset 버그 발생).
  const sidebar = (
    <aside className="w-[224px] flex-shrink-0 flex flex-col h-full" style={{ background: '#0A0A0B' }}>
      {/* Branding */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <UrDealLogo size={14} forceDark />
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
              {isVerifiedPartner ? t('agency.verifiedPartner', { defaultValue: '인증 파트너' }) : t('agency.partner', { defaultValue: '파트너' })}
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
              {group.i18nKey ? t(group.i18nKey, group.label) : group.label}
            </div>
            {group.items.map(({ path, label, i18nKey, icon: Icon, exact, badge, liveBadge }) => {
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
                  <span className="flex-1 truncate">{i18nKey ? t(i18nKey, label) : label}</span>
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
            {/* 🛡️ 2026-04-28: 에이전시 알림 벨 — 이전엔 마운트 안 됐었음 */}
            <DashboardNotificationBell tokenKey="agency_token" />
            {headerRight}
          </div>
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
