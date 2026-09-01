import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { clearServerSessionCookies } from '@/utils/auth'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import { usePersistScroll } from '@/hooks/usePersistScroll'
import DashboardNotificationBell from './DashboardNotificationBell'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { ArrowRightLeft, BookOpen, Calendar, Handshake, LayoutDashboard, List, LogOut, Menu, Radio, Settings, Store, TrendingUp, UserPlus, Users, Utensils, X, type LucideIcon } from 'lucide-react'

/**
 * 🛡️ 2026-05-17: Agency mode-based IA — 셀러와 동일 패턴.
 *   에이전시는 agency_type 컬럼 없으므로 사용자 UI 선호 기반 토글 (localStorage).
 *   default 'all' = 모든 항목 노출 (backward compat).
 *   'live' / 'store' 선택 시 해당 모드 + common 만 노출.
 */
type AgencyMode = 'all' | 'live' | 'store'

interface NavItem {
  path: string
  label: string         // Korean fallback (i18n 미적용 시)
  i18nKey?: string      // 'agency.nav.dashboard' 등 — 우선 사용
  icon: LucideIcon
  exact?: boolean
  badge?: string
  liveBadge?: boolean
  mode?: 'live' | 'store' | 'common'  // 'common' = 둘 다 / undefined = 'common' 취급
}

interface NavGroup {
  label: string         // Korean fallback
  i18nKey?: string      // 'agency.nav.operations' 등
  items: NavItem[]
}

// 🏪 2026-06-17 매장 영입 중심 IA 재편: 에이전시 핵심 = 오프라인 매장 영입(공구 운영).
//   '매장 영입' 그룹을 최상단으로, 라이브 시대의 '소속 셀러 관리'는 '셀러 관리' 보조 그룹으로 강등(코드/경로 전부 보존).
const NAV_GROUPS: NavGroup[] = [
  {
    label: '운영', i18nKey: 'agency.nav.operations',
    items: [
      { path: '/agency',          label: '대시보드',    i18nKey: 'agency.nav.dashboard', icon: LayoutDashboard, exact: true, mode: 'common' },
    ],
  },
  {
    // 🏪 매장 관계 — 영입 → 위임 → 승계. 일몰 후 남는 유일한 운영 축이다.
    label: '매장 관계', i18nKey: 'agency.nav.storeRecruit',
    items: [
      { path: '/agency/introduced-stores', label: '내 입점 가게', i18nKey: 'agency.nav.introducedStores', icon: Store, mode: 'common' },
      // 🤝 2026-07-10: 3단 위임 모델 (§4.3) — 매장 위임 조회/요청
      { path: '/agency/delegations', label: '매장 위임', i18nKey: 'agency.nav.delegations', icon: Handshake, mode: 'common' },
      { path: '/agency/prospects',  label: '매장 영입 현황', i18nKey: 'agency.nav.prospects', icon: UserPlus, mode: 'common' },
      { path: '/agency/sellers',  label: '담당 셀러',   i18nKey: 'agency.nav.sellers', icon: Users, mode: 'common' },
      // 승계 = 매장 본인 동의 필수(TD-016). 일몰 후에도 남는 이유가 이것이다.
      { path: '/agency/transfers',  label: '매장 이전',     i18nKey: 'agency.nav.transfers', icon: ArrowRightLeft, mode: 'common' },
    ],
  },
  {
    label: '정산 & 설정', i18nKey: 'agency.nav.finance',
    items: [
      { path: '/agency/settlements', label: '정산 관리',   i18nKey: 'agency.nav.settlements', icon: TrendingUp, mode: 'common' },
      // 📒 2026-08-01: 이 원장 화면(MyLedgerPage)은 **동작하는데 nav 에 없어** 아무도 못 갔다.
      //   ⚠️ 주석에 경로를 따옴표/백틱으로 적지 말 것 — orphan 가드가 그걸 '링크'로 세어
      //      nav 를 지워도 초록이 뜬다(이 줄을 쓰다가 실제로 그랬고 되돌려-검증이 잡았다).
      //   GET /api/ledger/my 핸들러가 user.type === 'agency' 를 **명시적으로 지원**한다(agency 계정)
      //   — 셀러 쪽 실시간 원장과 대칭이고, 정산 관리(확정 내역)와 달리 **실시간 미수/원장**을 본다.
      { path: '/agency/ledger', label: '실시간 원장', i18nKey: 'agency.nav.ledger', icon: BookOpen, mode: 'common' },
      { path: '/agency/guide',       label: '운영 가이드',  i18nKey: 'agency.nav.guide', icon: BookOpen, mode: 'common' },
      { path: '/agency/profile',     label: '프로필 설정',  i18nKey: 'agency.nav.profile', icon: Settings, mode: 'common' },
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

  // 🏁 2026-06-13: 사이드바 스크롤 영속 — 라우트 이동 시 좌측 카테고리 최상단 복귀 방지
  const navScrollRef = usePersistScroll('agency-sidebar')

  const [agencyName, setAgencyName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('agency_name') : null) || '에이전시')
  const [agencyStatus, setAgencyStatus] = useState<string | null>(null)
  // 🏪 2026-06-17 매장 영입 중심 — 사이드바 헤드라인 미니 통계를 '영입 가게' 수로.
  const [storeCount, setStoreCount] = useState(0)

  // 🛡️ 2026-05-17: Mode 토글 — 라이브 위주 에이전시 vs 매장 위주 에이전시 UI 선호.
  //   default 'all' = 모든 항목 (backward compat). localStorage 에 저장.
  const [activeMode, setActiveMode] = useState<AgencyMode>(() => {
    if (typeof window === 'undefined') return 'all'
    // 🏭 2026-06-04 라이브 중단 — 토글 숨김 + 'all'(=common+store, live는 필터 제외). stale 'live' 무시.
    if (LIVE_COMMERCE_SUSPENDED) return 'all'
    return (localStorage.getItem('agency_dashboard_mode') || 'all') as AgencyMode
  })
  function switchMode(m: AgencyMode) {
    setActiveMode(m)
    localStorage.setItem('agency_dashboard_mode', m)
  }

  // 🛡️ Mode 별 필터링 — 'all' 은 전부 노출. 그 외 'common' + 해당 mode 만.
  const filteredGroups = NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        const m = item.mode || 'common'
        // 🏭 2026-06-04 라이브커머스 잠정 중단 — live 전용 항목 숨김 (복원 가능).
        if (LIVE_COMMERCE_SUSPENDED && m === 'live') return false
        if (activeMode === 'all') return true
        return m === 'common' || m === activeMode
      }),
    }))
    .filter(group => group.items.length > 0)
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
    api.get('/api/agency/introduced-stores/summary', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const n = r.data?.data?.total_stores
        if (typeof n === 'number') setStoreCount(n)
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[AgencyLayout] stores summary fetch failed:', e) })
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

  async function logout() {
    // 🔑 2026-06-29 (로그아웃 근본수정): 서버 httpOnly agency 세션쿠키(ur_agency_session) 삭제를 await —
    //   기존엔 localStorage 만 지워 쿠키가 남아 재인증됐다(로그아웃해도 로그인). 유저/셀러/어드민 세션은 보존.
    await clearServerSessionCookies('agency')
    ;['agency_token', 'agency_refresh_token', 'agency_id', 'agency_name', 'agency_email'].forEach(k => localStorage.removeItem(k))
    // 🔑 2026-06-29 (PII 잔존 제거): RQ 캐시에 남은 에이전시 데이터(매장/정산/실적)를 비움 — logoutSeller 와 대칭.
    try { const { getQueryClient } = await import('@/lib/react-query'); getQueryClient().clear() } catch { /* best-effort */ }
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
            style={{ fontSize: '9px', letterSpacing: '0.08em', color: '#4b5563' }}
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
            style={{ background: 'linear-gradient(135deg, #4b5563, #6b7280)' }}
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
            <p className="text-[10px] font-bold text-white/40">영입</p>
            <p className="text-[13px] font-extrabold text-white">{storeCount}<span className="text-[9px] text-white/50 ml-0.5">가게</span></p>
          </div>
          <div
            className="rounded-lg px-2.5 py-2 text-center"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <p className="text-[10px] font-bold text-white/40">30일 매출</p>
            {revenue30d == null ? (
              <p className="text-[13px] font-extrabold text-white/50">—</p>
            ) : hasActiveGrowth ? (
              <p className="text-[13px] font-extrabold" style={{ color: '#6b7280' }}>
                <TrendingUp size={10} className="inline mr-0.5" style={{ verticalAlign: 'middle' }} />
                활성
              </p>
            ) : (
              <p className="text-[13px] font-extrabold text-white/60">휴면</p>
            )}
          </div>
        </div>
      </div>

      {/* 🛡️ 2026-05-17: Mode 토글 — 라이브/매장/전체 (UI 선호 기반 필터).
          🏭 2026-06-04: 라이브커머스 잠정 중단 시 토글 숨김 (live 모드 무의미). */}
      {!LIVE_COMMERCE_SUSPENDED && (
      <div className="px-4 py-2 border-y border-white/10 bg-white/[0.02]">
        <div className="flex gap-1 p-1 bg-black/30 rounded-full">
          {([
            { key: 'all',   label: '전체',     Icon: List },
            { key: 'live',  label: '라이브',   Icon: Radio },
            { key: 'store', label: '매장',     Icon: Store },
          ] as const).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => switchMode(m.key as AgencyMode)}
              className={`flex-1 py-1.5 px-2 rounded-full text-[10px] font-bold transition-colors ${
                activeMode === m.key
                  ? (m.key === 'live' ? 'bg-red-500' : m.key === 'store' ? 'bg-amber-500' : 'bg-gray-500') + ' text-white shadow'
                  : 'text-white/60 hover:text-white'
              }`}
              aria-pressed={activeMode === m.key}
            >
              <m.Icon className="w-3.5 h-3.5" aria-hidden="true" />{m.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Navigation — 그룹별 */}
      <nav ref={navScrollRef} className="flex-1 overflow-y-auto scrollbar-hide pb-2">
        {filteredGroups.map((group, gi) => (
          <div key={gi} className="mt-3 first:mt-1">
            <div
       className="px-4 py-1.5 font-extrabold text-white/30"
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
                  // 🛡️ 2026-05-20: inline style + onMouseEnter/Leave 제거 (CSP unsafe-inline).
                  //   violet gradient 는 index.css .ur-agency-nav-active.
                  className={`flex items-center gap-2.5 px-4 py-[7px] text-[12px] font-semibold transition-colors border-l-[2.5px] ${
                    active
                      ? 'text-white border-violet-500 ur-agency-nav-active'
                      : 'text-white/55 hover:text-white border-transparent'
                  }`}
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
          onClick={() => navigate('/agency/introduced-stores')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-extrabold text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #4b5563, #374151)' }}
        >
          <Store size={14} strokeWidth={2} />
          {t('agency.inviteStore', { defaultValue: '가게 영입' })}
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
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

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
            {/* 🛡️ 2026-04-28: 에이전시 알림 벨 — 이전엔 마운트 안 됐었음 */}
            <DashboardNotificationBell tokenKey="agency_token" />
            {headerRight}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-5">
          {children}
        </main>
      </div>

      {/* Mobile quick-action FAB — 🏁 2026-06-17 라이브 중단 시 '공구 관리'로 repurpose(복원 시 환원) */}
      <div className="md:hidden fixed bottom-6 right-4 z-40">
        <button
          onClick={() => navigate(LIVE_COMMERCE_SUSPENDED ? '/agency/group-buy' : '/agency/schedule')}
          className="flex items-center gap-2 px-5 py-3 rounded-full text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(90deg, #4b5563, #6b7280)', boxShadow: '0 8px 24px rgba(139,92,246,0.3)' }}
        >
          {LIVE_COMMERCE_SUSPENDED ? <Utensils className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
          {LIVE_COMMERCE_SUSPENDED
            ? t('agency.nav.manageGroupBuy', { defaultValue: '공구 관리' })
            : t('agency.fabScheduleLive', { defaultValue: '라이브 편성' })}
        </button>
      </div>
    </div>
  )
}
