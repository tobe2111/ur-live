import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import { useTranslation } from 'react-i18next'
import {
  LogOut, Menu, X, Search, ChevronDown, Star,
} from 'lucide-react'
import { logout as authLogout } from '@/utils/auth'
import { normalizeAdminRole, ADMIN_ROLE_LABEL, type AdminRole } from '@/shared/admin-roles'
import { useTokenAutoRefresh } from '@/hooks/useTokenAutoRefresh'
import { usePersistScroll } from '@/hooks/usePersistScroll'
import DashboardNotificationBell from './DashboardNotificationBell'
import UrDealLogo from '@/components/brand/UrDealLogo'
import BrandLoader from '@/components/brand/BrandLoader'
// 🧱 2026-07-20: nav 데이터/섹션/RBAC 경로 상수는 admin-nav-config 로 분리(AdminLayout 슬림화 + 즐겨찾기 여유).
import {
  type NavItem, type NavGroup,
  VISIBLE_NAV_GROUPS, NAV_SECTIONS, navSectionOf, withoutWholesaleOnConsumer,
  ALWAYS_ALLOWED_ADMIN_PATHS, WHOLESALE_EXTRA_ALLOWED_PATHS,
} from '@/components/admin/admin-nav-config'
import CommandPalette, { type CommandItem } from '@/components/dashboard/CommandPalette'


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

  // ⌘K 2026-07-20: 커맨드 팔레트(메뉴 빠른 이동). ⌘K/Ctrl+K 로 토글.
  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  // 🔒 슈퍼 전용 nav — 계정/감사/2FA + 2026-06-29(대표) '도매 몰 관리'(멀티-몰 CRUD). 도매 파트너도 숨김(서버도 super-only).
  const SUPER_ONLY_NAV = new Set(['/admin/accounts', '/admin/audit-log', '/admin/login-history', '/admin/wholesale-malls'])
  const stripSuperOnly = (groups: typeof VISIBLE_NAV_GROUPS) => groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !SUPER_ONLY_NAV.has(it.path)) }))
    .filter((g) => g.items.length > 0)
  // 🧨 2026-08-03 (대표 "도매몰은 잔재도 없애는거야") — 소비자 도메인에선 도매 밴드를 숨긴다.
  //   판정·근거는 `withoutWholesaleOnConsumer`(admin-nav-config) 주석. 도매 role 분기는 **건드리지 않는다** —
  //   그쪽에 적용하면 도매 파트너가 도매 도메인 밖에서 nav 가 통째로 비어 원인을 알 수 없게 된다.
  const roleNavGroups = adminRole === 'super'
    ? withoutWholesaleOnConsumer(VISIBLE_NAV_GROUPS)
    : adminRole === 'wholesale'
      // 🆕 도매 파트너 — 도매 도메인 그룹만 노출(유어딜 소비자 어드민 전부 숨김) + 슈퍼전용(몰 관리 등) 제외.
      ? stripSuperOnly(VISIBLE_NAV_GROUPS.filter((g) => g.domain === 'wholesale'))
      : withoutWholesaleOnConsumer(stripSuperOnly(VISIBLE_NAV_GROUPS))

  // ⭐ 2026-07-20 (대표 — "자주 쓰는 페이지를 좌측 상단에"): 즐겨찾기(고정). 각 메뉴의 ★ 토글로 고정하면
  //   사이드바 맨 위 '즐겨찾기' 섹션에 pin 순서대로 모임. 역할별로 보이는 항목만 고정 가능(roleNavGroups 해석).
  //   localStorage 영속. 최초(미설정)엔 역할별 기본값 시드 → 바로 유용하게 보이되 이후 자유 큐레이션.
  const allVisibleItems = roleNavGroups.flatMap((g) => g.items)
  // ⌘K 커맨드 팔레트 대상 — 역할 가시 항목 flat + 그룹명(맥락 표시/검색용).
  const commandItems: CommandItem[] = roleNavGroups.flatMap((g) =>
    g.items.map((it) => ({ path: it.path, label: it.label, icon: it.icon, group: g.title })),
  )
  const DEFAULT_PINS = adminRole === 'wholesale'
    ? ['/admin/wholesale-overview', '/admin/wholesale-orders', '/admin/suppliers']
    : ['/admin', '/admin/orders', '/admin/settlement', '/admin/seller-approval']
  // 🐛 2026-08-22 대표 신고 "즐겨찾기가 계속 초기화 돼" — 저장 위치를 **계정**으로 옮겼다.
  //   localStorage 는 오리진·브라우저·프로필마다 따로이고 시크릿창·"사이트 데이터 지우기"·
  //   기기 변경·도메인 전환(구 도메인 ↔ urdeal.kr 은 서로 다른 오리진)에 조용히 사라진다. 게다가 아래
  //   기본값 시드가 **저장되지 않아서**, 저장소가 비는 순간 항상 기본 4개로 돌아갔다 —
  //   그게 대표가 본 "초기화"의 모습이다.
  //   ⇒ localStorage 는 **첫 페인트용 캐시로만** 남기고(서버 왕복 동안 깜빡이지 않게),
  //     진짜 출처는 `GET/PUT /api/admin/me/prefs/nav_pins`(본인 토큰 id 만 사용).
  const persistPins = (next: string[]) => {
    try { localStorage.setItem('admin_nav_pinned_v1', JSON.stringify(next)) } catch { /* quota */ }
    // 서버 저장은 fail-soft — 실패해도 이번 세션 화면은 그대로다(로컬 캐시가 받친다).
    void api.put('/api/admin/me/prefs/nav_pins', { value: next }).catch(() => null)
  }
  const [pinnedPaths, setPinnedPaths] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('admin_nav_pinned_v1')
      if (raw == null) return DEFAULT_PINS // 최초 진입: 기본값 시드(서버 응답이 오면 대체)
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.filter((p): p is string => typeof p === 'string') : []
    } catch { return DEFAULT_PINS }
  })
  // 서버 값으로 1회 하이드레이트. 서버에 아무것도 없으면(최초) **지금 화면의 값을 승격 저장**한다 —
  // 시드를 저장하지 않은 것이 초기화의 절반이었다.
  const pinsHydrated = useRef(false)
  useEffect(() => {
    if (pinsHydrated.current) return
    pinsHydrated.current = true
    let alive = true
    api
      .get<{ success?: boolean; data?: { value?: unknown } }>('/api/admin/me/prefs/nav_pins')
      .then((res) => {
        if (!alive) return
        const v = res?.data?.data?.value
        if (Array.isArray(v)) {
          const clean = v.filter((p): p is string => typeof p === 'string')
          setPinnedPaths(clean)
          try { localStorage.setItem('admin_nav_pinned_v1', JSON.stringify(clean)) } catch { /* quota */ }
          return
        }
        // 서버에 없음 = 이 계정의 최초 진입. 현재(로컬/기본) 값을 계정에 승격시킨다.
        setPinnedPaths((prev) => { persistPins(prev); return prev })
      })
      .catch(() => null) // 조회 실패 시 로컬 값 유지 — 대시보드가 안 열리면 안 된다
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const togglePin = (path: string) => {
    setPinnedPaths((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
      persistPins(next)
      return next
    })
  }
  const isPinned = (path: string) => pinnedPaths.includes(path)
  // 고정 항목을 pin 순서대로 해석(역할 가시 항목만 — 역할 전환/메뉴 변경 시 사라진 경로는 조용히 제외).
  const pinnedItems = pinnedPaths
    .map((p) => allVisibleItems.find((it) => it.path === p))
    .filter((it): it is NavItem => !!it)

  // 🆕 도매 파트너가 비-도매 어드민 경로(/admin 소비자 홈, /admin/users 등)로 직접 진입 시 도매 현황으로 리다이렉트.
  //   서버 RBAC 가 데이터는 이미 403 차단 — 이건 깨진 화면 대신 안전한 랜딩을 위한 UX 가드.
  // 🚑 2026-07-10 (로딩 전수조사 — 바운스 전 오화면 플래시 제거): 리다이렉트 조건을 렌더 시점에 동기
  //   계산(willBounce*)해, 리다이렉트가 예정된 프레임엔 콘솔 대신 라이트 로더를 그림(아래 render 가드).
  //   조건·effect·ALWAYS_ALLOWED 면제는 전부 기존과 동일(무한루프 사고 방지 로직 불변) — 페인트만 억제.
  // 🏭 2026-06-29: nav item 의 `also` 경로도 도달 가능 집합에 포함 — `also` 는 "이 항목에 속한 딥링크/통합 서브탭"
  //   선언(통합현황 큐 카드의 `/admin/distributor-approval` 등)이라 RBAC 도 허용해야 바운스 안 됨. 안 그러면
  //   판매사 승인 통합 후 큐 카드 클릭이 /admin/wholesale-overview 로 튕김(이 가드가 isActive 와 동일 의미를 갖도록).
  const willBounceWholesale = (() => {
    if (adminRole !== 'wholesale') return false
    const allowed = [
      ...roleNavGroups.flatMap((g) => g.items.flatMap((it) => [it.path, ...(it.also || [])])),
      ...ALWAYS_ALLOWED_ADMIN_PATHS, ...WHOLESALE_EXTRA_ALLOWED_PATHS,
    ]
    return !allowed.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))
  })()
  useEffect(() => {
    if (willBounceWholesale) navigate('/admin/wholesale-overview', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRole, location.pathname])

  // 🆕 보안 PIN 강제 설정 게이트 — 강제 대상(도매 파트너/슈퍼)인데 미설정이면 PIN 설정 페이지로 가둠.
  //   로그인 시 must_set_pin 플래그 설정 → 설정 성공 시 해제. /admin/set-pin 자신은 면제(루프 방지).
  const willBouncePin = typeof window !== 'undefined'
    && localStorage.getItem('admin_must_set_pin') === '1'
    && location.pathname !== '/admin/set-pin'
  useEffect(() => {
    if (willBouncePin) navigate('/admin/set-pin', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  async function logout() {
    // 🔑 2026-06-29: 서버 httpOnly admin 세션쿠키 삭제를 await 한 뒤 이동 — 없으면 ur_admin_session 잔존 재인증.
    await authLogout('admin')
    // 🔑 2026-06-29 (PII 잔존 제거): RQ 캐시에 남은 어드민 데이터(회원/주문/정산 등)를 비움 —
    //   logoutSeller 와 대칭. 안 지우면 다음 로그인/방문자가 이전 세션 캐시를 잠깐 봄.
    try { const { getQueryClient } = await import('@/lib/react-query'); getQueryClient().clear() } catch { /* best-effort */ }
    navigate('/admin/login')
  }

  function isActive(path: string, exact?: boolean, also?: string[]) {
    if (also?.some((p) => location.pathname.startsWith(p))) return true
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  // ⭐ 2026-07-20: nav 한 줄 렌더러 — 즐겨찾기 섹션과 그룹 목록이 동일 마크업 공유(중복 제거).
  //   행 = [Link(아이콘·라벨·배지)] + [★ 토글(호버 시 노출, 고정 시 상시 노출)]. 별 클릭은 네비게이션 안 함.
  const renderNavItem = (item: NavItem) => {
    const { path, label, icon: Icon, exact, also } = item
    const active = isActive(path, exact, also)
    const pinned = isPinned(path)
    return (
      <div
        key={path}
        className={`group/nav flex items-center border-l-[2.5px] ${
          active ? 'border-amber-300 ur-admin-nav-active' : 'border-transparent'
        }`}
      >
        <Link
          to={path}
          onClick={() => setSidebarOpen(false)}
          // 🛡️ 2026-05-20: inline style + onMouseEnter/Leave 제거 (CSP unsafe-inline). amber 강조는 .ur-admin-nav-active.
          className={`flex-1 min-w-0 flex items-center gap-2.5 pl-4 pr-1 py-[7px] text-[12px] font-semibold transition-colors ${
            active ? 'text-white' : 'text-white/55 group-hover/nav:text-white'
          }`}
        >
          <Icon size={14} strokeWidth={2} className="flex-shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          {label === '주문 관리' && pendingCount > 0 && (
            <span className="text-[9px] font-extrabold px-1.5 rounded-full bg-white/10 text-white">{pendingCount}</span>
          )}
          {/* 🏁 2026-06-14: 신규 이슈(미읽음 알림) 배지 */}
          {(navBadges[path] || 0) > 0 && (
            <span className="text-[9px] font-extrabold px-1.5 rounded-full bg-amber-400 text-[#0A0A0B] flex-shrink-0">{navBadges[path]}</span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => togglePin(path)}
          aria-pressed={pinned}
          aria-label={pinned ? `${label} 즐겨찾기 해제` : `${label} 즐겨찾기 추가`}
          title={pinned ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          className={`flex-shrink-0 px-2 py-[7px] transition-opacity ${
            pinned ? 'opacity-100' : 'opacity-0 group-hover/nav:opacity-100 focus:opacity-100'
          }`}
        >
          <Star size={12} strokeWidth={2} className={pinned ? 'fill-amber-300 text-amber-300' : 'text-white/30 hover:text-white/60'} />
        </button>
      </div>
    )
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
            style={{ fontSize: '9px', letterSpacing: '0.08em', color: '#e5e7eb' }}
          >
            ADMIN CONSOLE
          </span>
          <span
            className="ml-auto font-extrabold rounded px-1.5 py-0.5"
            style={{ fontSize: '9px', background: '#e5e7eb', color: '#0A0A0B' }}
          >
            PROD
          </span>
        </div>
      </div>

      {/* 🛡️ 2026-04-28: Global search bar — 실제 동작.
           숫자만: 주문 / @포함: 유저 / 일반: 유저 검색 */}
      {/* 🔧 2026-06-24 (전수조사 MED-1): 전역 검색은 주문/유저(소비자 스코프)로 이동 → 도매 파트너(wholesale)는
          RBAC 바운스 → 검색이 안 먹히는 것처럼 보임. 도매 역할에는 숨김(스코프 밖 목적지 제거). */}
      {adminRole !== 'wholesale' && (
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
      )}

      {/* ⌘K 메뉴 빠른 이동 — 60여 개 메뉴를 이름으로 즉시 점프(전 역할). */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className={`mx-4 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left ${adminRole === 'wholesale' ? 'mt-3' : ''}`}
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <Search size={12} className="text-white/35 flex-shrink-0" />
        <span className="flex-1 text-[11px] text-white/40">메뉴 빠른 이동</span>
        <kbd className="text-[9px] font-bold text-white/40 bg-white/10 rounded px-1 py-0.5">⌘K</kbd>
      </button>

      {/* Grouped navigation — 그룹 헤더 클릭으로 접기/펼치기 (활성 그룹은 강제 펼침) */}
      <nav ref={navScrollRef} className="flex-1 overflow-y-auto scrollbar-hide pb-2">
        {/* ⭐ 즐겨찾기(고정) — 대표 "자주 쓰는 페이지를 좌측 상단에". 각 메뉴 ★ 토글로 큐레이션. */}
        {pinnedItems.length > 0 && (
          <div className="mt-1 mb-1 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-4 py-1.5 flex items-center gap-1.5 font-extrabold uppercase text-amber-300/80" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>
              <Star size={10} strokeWidth={2.5} className="fill-amber-300/80" />
              <span>즐겨찾기</span>
            </div>
            {pinnedItems.map((item) => renderNavItem(item))}
          </div>
        )}
        {NAV_SECTIONS.map((sec) => {
          const secGroups = roleNavGroups.filter((g) => navSectionOf(g) === sec.key)
          if (secGroups.length === 0) return null
          return (
          <div key={sec.key}>
            {sec.label && (
              <div className="mt-5 mb-0.5 px-4 flex items-center gap-2">
                <span className="text-[10px] font-black tracking-wider whitespace-nowrap" style={{ color: sec.accent }}>{sec.label}</span>
                <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${sec.accent}55, transparent)` }} />
              </div>
            )}
            {secGroups.map((group) => {
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
            {!collapsed && group.items.map((item) => renderNavItem(item))}
          </div>
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
              background: 'linear-gradient(135deg, #e5e7eb, #9ca3af)',
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

  // 🚑 2026-07-10 (로딩 전수조사): 리다이렉트 예정 프레임엔 콘솔 대신 라이트 로더 — 도매 RBAC/PIN 게이트
  //   바운스 직전에 다른 어드민 화면이 한 번 그려지던 플래시 제거. effect 가 즉시 navigate (조건 동일 — 위 주석).
  if (willBounceWholesale || willBouncePin) {
    return (
      <div className="admin-light-theme [color-scheme:light]" style={{ background: '#F4F5F7' }}>
        <BrandLoader fullScreen forceLight />
      </div>
    )
  }

  return (
    <div className="admin-light-theme flex h-screen overflow-hidden bg-[#F4F5F7] text-gray-900 [color-scheme:light]">
      {/* ⌘K 커맨드 팔레트 — 전 어드민 페이지 공통(레이아웃 마운트). */}
      <CommandPalette items={commandItems} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
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
