import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ShoppingBag, Package, DollarSign,
  Bell, Image, Monitor, LogOut, Menu, X, Store, ClipboardList, Search, Gift, Ticket, Play, BookOpen, Building2, UserCheck, Settings, Send, CreditCard,
  BarChart3, Shield, UserCog, Radio, Users, MessageSquare, Megaphone, Sparkles, AlertTriangle, TrendingUp, AlertOctagon, Wallet, Layers, Mail, Crown,
  ChevronDown, Wrench, RotateCcw, Upload, History, MapPin, Scale,
  type LucideIcon
} from 'lucide-react'
import { logout as authLogout } from '@/utils/auth'
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
  /** 🆕 도메인 태그 — 도메인-한정 역할(wholesale)에게 이 도메인 그룹만 노출. */
  domain?: 'wholesale'
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
      { path: '/admin/region-density',   label: '동네별 딜 밀도', icon: MapPin },
      { path: '/admin/abuse',            label: '어뷰징 탐지',   icon: AlertOctagon },
      { path: '/admin/env-readiness',    label: '환경 준비상태', icon: Wrench },
    ],
  },
  {
    // 🎯 유어애즈(UR Ads) — 마케팅 서비스 운영
    title: '🎯 유어애즈 · 운영',
    items: [
      { path: '/admin/ads-accounts',     label: '유어애즈 가입자', icon: Megaphone },
    ],
  },
  {
    // 🏭 도매몰 (유통스타트 B2B) — 운영: 카탈로그·주문·회원·설정
    title: '🏭 도매몰 · 운영',
    domain: 'wholesale',
    items: [
      { path: '/admin/wholesale-overview', label: '도매 통합 현황', icon: LayoutDashboard },
      // 🏭 2026-06-29 (대표 — 판매사 승인 통합): '판매사 승인' 별도 항목 제거 → '판매사 관리'(아래) 의 '승인' 탭으로 통합.
      { path: '/admin/suppliers',          label: '제조사 관리', icon: Store },
      { path: '/admin/wholesale-import',   label: '상품 일괄 등록', icon: Upload },
      { path: '/admin/wholesale-products', label: '도매 프리미엄관', icon: Crown },
      { path: '/admin/wholesale-orders',   label: '도매 주문',     icon: ShoppingBag },
      { path: '/admin/wholesale-quotes',   label: '도매 견적',     icon: ClipboardList },
      // 🗂️ 2026-06-26 (대표 요청): 4개 탭(등급·마진 / 여신·외상 / 제안·세금 / 공급가·채널·OEM)이
      //   한 페이지(AdminDistributorGradesPage)라 좌측 nav 도 1개로 통합. 페이지 내부 탭으로 4영역 이동.
      //   딥링크 라우트(/admin/distributor-credit 등)는 그대로 유지 — 페이지 탭이 사용.
      { path: '/admin/distributor-grades', label: '판매사 관리', icon: Layers, also: ['/admin/distributor-approval', '/admin/distributor-credit', '/admin/distributor-tax', '/admin/distributor-supply'] },
      { path: '/admin/wholesale-malls',    label: '도매 몰 관리',  icon: Building2 },
      { path: '/admin/wholesale-activity', label: '처리 이력 (누가 처리?)', icon: History },
    ],
  },
  {
    // 🏭 도매몰 — 정산/머니
    title: '💰 도매몰 · 정산',
    domain: 'wholesale',
    items: [
      { path: '/admin/wholesale-deposits', label: '도매 예치금',   icon: Wallet },
      { path: '/admin/wholesale-withdrawals', label: '제조사 출금', icon: Wallet },
      { path: '/admin/wholesale-tax',      label: '도매 세무/정산', icon: Wallet },
      // 🗂️ 2026-06-17: '도매 무결성'(진단 전용)은 상단 nav에서 강등 — '통합 현황' 카드 링크로 접근(/admin/wholesale-integrity 라우트 유지).
    ],
  },
  {
    // 🏭 도매몰 — CS / 콘텐츠
    title: '🛟 도매몰 · CS·콘텐츠',
    domain: 'wholesale',
    items: [
      { path: '/admin/wholesale-claims',   label: '도매 클레임',   icon: AlertTriangle },
      { path: '/admin/wholesale-proposals', label: '도매 제안/신고', icon: MessageSquare },
      { path: '/admin/partnership',        label: '광고·제휴 문의', icon: Mail },
      { path: '/admin/wholesale-board',    label: '도매 게시판',   icon: Megaphone },
      { path: '/admin/wholesale-banners',  label: '도매 배너',     icon: Image },
      { path: '/admin/wholesale-guide',    label: '도매몰 운영 가이드', icon: BookOpen },
    ],
  },
  {
    // 🏪 오프라인 공구 (매장 공구 / 교환권 / 숙소)
    title: '🏪 오프라인 공구',
    items: [
      { path: '/admin/group-buy',        label: '공동구매',      icon: Ticket },
      { path: '/admin/dongnedeal-import', label: '동네딜 상품 등록', icon: Upload },
      { path: '/admin/fcfs',             label: '선착순 응모 관리', icon: Gift },
      { path: '/admin/voucher-disputes', label: '사용처리 분쟁',  icon: AlertOctagon },
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
      // 🔧 2026-07-01 (대표 "무슨 말인지 모르겠어"): '수수료 규칙 비교'(fee-resolver 그림자검증 — 개발/검증 전용,
      //   기본 OFF·돈 안 움직임)는 재무 실무 메뉴에서 오해 소지 → 아래 '개발자 도구' 그룹으로 이동.
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
      { path: '/admin/login-history',     label: '로그인 이력(IP)', icon: History },
      { path: '/admin/audit-log',         label: '감사 로그',     icon: Shield },
      { path: '/admin/set-pin',           label: '로그인 PIN',    icon: Shield },
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
      { path: '/admin/fee-breakdown',     label: '수수료 규칙 검증(개발)', icon: Scale },
    ],
  },
]

// 🏭 2026-06-04 라이브커머스 잠정 중단 — 어드민 nav 에서 라이브 전용 항목 숨김 (플래그 재사용, 복원 가능).
//   라이브 모니터 / 광고 슬롯(입찰) / 캐스팅 / TikTok 발굴 / 다시보기(라이브 replay).
const LIVE_ADMIN_PATHS = new Set<string>([
  '/admin/live-monitor', '/admin/ad-slots', '/admin/castings', '/admin/tiktok-discovery', '/admin/replay',
  // 🏭 2026-07-01 (대표 "라이브 관련 내용 다 빼줘") YouTube 쿼터는 YouTube-라이브 전용 진단 → 라이브 중단 시 숨김.
  '/admin/youtube-quota',
])
const VISIBLE_NAV_GROUPS: NavGroup[] = LIVE_COMMERCE_SUSPENDED
  ? NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => !LIVE_ADMIN_PATHS.has(it.path)) })).filter((g) => g.items.length > 0)
  : NAV_GROUPS

// 🎟️🏭 2026-07-01 (대표 "유어딜·도매몰 철저히 UX/UI 분리 — 전체적으로"): 좌측 nav 를 서비스 밴드로 구획.
//   super 어드민은 전 그룹을 보는데 유어딜(소비자)·유통스타트(도매몰)·공통 그룹이 섞여 보였음(구분=이모지 뿐) →
//   섹션 헤더 밴드로 3분할(운영 '홈'은 최상단 무밴드). 그룹 정의/RBAC(도매 role=wholesale 그룹만)/collapse/active 전부 불변 — 렌더 구획만.
type NavSectionKey = 'home' | 'urdeal' | 'wholesale' | 'common'
const navSectionOf = (g: NavGroup): NavSectionKey =>
  g.domain === 'wholesale' ? 'wholesale'
    : g.title === '운영' ? 'home'
      : (g.title === '🏪 오프라인 공구' || g.title === '🛒 온라인 쇼핑') ? 'urdeal'
        : 'common'
const NAV_SECTIONS: Array<{ key: NavSectionKey; label?: string; accent?: string }> = [
  { key: 'home' },
  { key: 'urdeal', label: '🎟️ 유어딜 · 소비자', accent: '#a5b4fc' },
  { key: 'wholesale', label: '🏭 유통스타트 · 도매몰 (B2B)', accent: '#fbbf24' },
  { key: 'common', label: '⚙️ 공통 · 회원·재무·검증·시스템', accent: '#94a3b8' },
]

// 🛡️ 2026-06-17 (대표 신고 — 로그인 시 화면이 미친듯이 깜빡): 강제 보안 설정/계정 보안 페이지는
//   역할과 무관하게 항상 도달 가능해야 한다. 도매 RBAC 리다이렉트(아래)가 강제 PIN 게이트
//   (/admin/set-pin)와 충돌하면 /admin/set-pin ⟷ /admin/wholesale-overview 무한 루프 →
//   AdminLayout remount 반복 → 화면 깜빡 + dashboard-notifications 폭주(429). 이 경로들은 RBAC 리다이렉트에서 면제.
const ALWAYS_ALLOWED_ADMIN_PATHS = ['/admin/set-pin', '/admin/2fa']
// 🆕 2026-06-24: '도매 통합 현황'의 승인 큐 카드가 가리키는 비-도매-nav 경로 — 도매 파트너도 도달 허용.
//   (상품 승인/가격변경 = /admin/products 의 '제조사 등록 상품' 탭 / 판매사 승인 = /admin/seller-approval)
//   nav 에는 노출 안 하되(소비자 어드민 메뉴는 계속 숨김), 큐 클릭 시 wholesale-overview 로 바운스되던 것 차단.
//   /admin/products 진입 시 AdminProductsPage 가 도매 파트너에게는 '제조사 등록 상품' 탭만 노출(소비자 상품관리 차단).
const WHOLESALE_EXTRA_ALLOWED_PATHS = ['/admin/products', '/admin/wholesale-integrity']

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
  // 🔒 슈퍼 전용 nav — 계정/감사/2FA + 2026-06-29(대표) '도매 몰 관리'(멀티-몰 CRUD). 도매 파트너도 숨김(서버도 super-only).
  const SUPER_ONLY_NAV = new Set(['/admin/accounts', '/admin/audit-log', '/admin/login-history', '/admin/wholesale-malls'])
  const stripSuperOnly = (groups: typeof VISIBLE_NAV_GROUPS) => groups
    .map((g) => ({ ...g, items: g.items.filter((it) => !SUPER_ONLY_NAV.has(it.path)) }))
    .filter((g) => g.items.length > 0)
  const roleNavGroups = adminRole === 'super'
    ? VISIBLE_NAV_GROUPS
    : adminRole === 'wholesale'
      // 🆕 도매 파트너 — 도매 도메인 그룹만 노출(유어딜 소비자 어드민 전부 숨김) + 슈퍼전용(몰 관리 등) 제외.
      ? stripSuperOnly(VISIBLE_NAV_GROUPS.filter((g) => g.domain === 'wholesale'))
      : stripSuperOnly(VISIBLE_NAV_GROUPS)

  // 🆕 도매 파트너가 비-도매 어드민 경로(/admin 소비자 홈, /admin/users 등)로 직접 진입 시 도매 현황으로 리다이렉트.
  //   서버 RBAC 가 데이터는 이미 403 차단 — 이건 깨진 화면 대신 안전한 랜딩을 위한 UX 가드.
  useEffect(() => {
    if (adminRole !== 'wholesale') return
    // 🏭 2026-06-29: nav item 의 `also` 경로도 도달 가능 집합에 포함 — `also` 는 "이 항목에 속한 딥링크/통합 서브탭"
    //   선언(통합현황 큐 카드의 `/admin/distributor-approval` 등)이라 RBAC 도 허용해야 바운스 안 됨. 안 그러면
    //   판매사 승인 통합 후 큐 카드 클릭이 /admin/wholesale-overview 로 튕김(이 가드가 isActive 와 동일 의미를 갖도록).
    const allowed = [
      ...roleNavGroups.flatMap((g) => g.items.flatMap((it) => [it.path, ...(it.also || [])])),
      ...ALWAYS_ALLOWED_ADMIN_PATHS, ...WHOLESALE_EXTRA_ALLOWED_PATHS,
    ]
    const ok = allowed.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))
    if (!ok) navigate('/admin/wholesale-overview', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRole, location.pathname])

  // 🆕 보안 PIN 강제 설정 게이트 — 강제 대상(도매 파트너/슈퍼)인데 미설정이면 PIN 설정 페이지로 가둠.
  //   로그인 시 must_set_pin 플래그 설정 → 설정 성공 시 해제. /admin/set-pin 자신은 면제(루프 방지).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('admin_must_set_pin') === '1' && location.pathname !== '/admin/set-pin') {
      navigate('/admin/set-pin', { replace: true })
    }
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

      {/* Grouped navigation — 그룹 헤더 클릭으로 접기/펼치기 (활성 그룹은 강제 펼침) */}
      <nav ref={navScrollRef} className="flex-1 overflow-y-auto scrollbar-hide pb-2">
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

  return (
    <div className="admin-light-theme flex h-screen overflow-hidden bg-[#F4F5F7] text-gray-900 [color-scheme:light]">
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
