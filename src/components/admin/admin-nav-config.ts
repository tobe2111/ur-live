/**
 * 🧱 2026-07-20 (AdminLayout god 파일 분해 + 즐겨찾기 기능 여유 확보): 어드민 좌측 nav 데이터/섹션/
 *   RBAC 경로 상수를 AdminLayout.tsx 에서 verbatim 추출. **데이터/배치/RBAC/collapse/active 전부 불변** —
 *   렌더 로직(AdminLayout)과 데이터(이 파일)를 분리했을 뿐. 아이콘/라벨/라우트/그룹 순서 byte-동일.
 */
import {
  LayoutDashboard, ShoppingBag, Package, DollarSign,
  Bell, Image, Monitor, Store, ClipboardList, Gift, Ticket, Play, BookOpen, Building2, UserCheck, Settings, Send,
  BarChart3, Shield, UserCog, Radio, Users, MessageSquare, Megaphone, Sparkles, AlertTriangle, TrendingUp, AlertOctagon, Wallet, Layers, Mail, Crown,
  Wrench, RotateCcw, Upload, History, MapPin, Scale, FileText, Rocket, Share2,
  type LucideIcon
} from 'lucide-react'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { isUtongstart } from '@/utils/domain'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  exact?: boolean
  /** 🧭 탭으로 묶인 형제 라우트 — 이 경로들에서도 본 항목을 활성 표시. */
  also?: string[]
}

export interface NavGroup {
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
export const NAV_GROUPS: NavGroup[] = [
  {
    title: '운영',
    items: [
      { path: '/admin',                  label: '대시보드',      icon: LayoutDashboard, exact: true },
      { path: '/admin/insights',         label: '운영 인사이트', icon: AlertTriangle },
      { path: '/admin/funnel',           label: '소비자 퍼널',   icon: TrendingUp },
      { path: '/admin/business-metrics', label: '비즈니스 지표', icon: BarChart3 },
      { path: '/admin/revenue',          label: '매출 분석',     icon: BarChart3 },
      { path: '/admin/operations-guide', label: '운영 가이드',   icon: BookOpen },
      { path: '/admin/platform-model',   label: '플랫폼 모델',   icon: FileText },
      { path: '/admin/region-density',   label: '동네별 딜 밀도', icon: MapPin },
      { path: '/admin/district-report',  label: '상권 성과 리포트', icon: BarChart3 },
      { path: '/admin/visit-rewards',    label: '상권 방문 리워드', icon: MapPin },
      { path: '/admin/abuse',            label: '어뷰징 탐지',   icon: AlertOctagon },
      { path: '/admin/env-readiness',    label: '환경 준비상태', icon: Wrench },
    ],
  },
  {
    // 🎯 유어애즈(UR Ads) — 마케팅 서비스 운영
    title: '🎯 유어애즈 · 운영',
    items: [
      { path: '/admin/ads-accounts',     label: '유어애즈 가입자', icon: Megaphone },
      { path: '/admin/ads-services',     label: '서비스몰 주문', icon: Megaphone },
      { path: '/admin/influencer-pool',  label: '인플루언서 풀', icon: Megaphone },
      { path: '/admin/buyer-pool',       label: '🌐 해외 바이어 풀', icon: Megaphone }, // 도매 RBAC 스코프 밖 → 여기(전-어드민)
      { path: '/admin/partner-pool',     label: '🤝 파트너 풀', icon: Megaphone }, // B2B 파트너(업체) 수집 — 매장 입점 영업
      { path: '/admin/store-prospects',  label: '🏪 매장 후보', icon: Megaphone }, // 인허가 발굴 — 유어딜 입점 대상 매장(store_prospects)
      { path: '/admin/gov-notices',      label: '📢 공고 스캐너', icon: Megaphone }, // 나라장터+기업마당 공고(gov_notices)
    ],
  },
  {
    // 🏭 도매몰 (유통스타트 B2B) — 운영: 카탈로그·주문·회원·설정
    title: '🏭 도매몰 · 운영',
    domain: 'wholesale',
    items: [
      { path: '/admin/wholesale-overview', label: '도매 통합 현황', icon: LayoutDashboard },
      // 🏭 2026-06-29 (대표 — 판매사 승인 통합): '판매사 승인' 별도 항목 제거 → '판매사 관리'(아래) 의 '승인' 탭으로 통합.
      // 🗂️ 2026-07-02 (IA 통합): '제조사 출금'(/admin/wholesale-withdrawals)은 이 페이지의 '출금 처리' 탭으로
      //   통합 — also 로 딥링크/RBAC 허용 + 활성 표시.
      { path: '/admin/suppliers',          label: '제조사 관리', icon: Store, also: ['/admin/wholesale-withdrawals'] },
      // 🗂️ 2026-06-26 (대표 요청): 4개 탭이 한 페이지(AdminDistributorGradesPage)라 nav 1개 통합.
      //   딥링크 라우트(/admin/distributor-credit 등)는 그대로 — 페이지 탭이 사용.
      // 🗂️ 2026-07-02 (대표 요청): 판매사 관리를 제조사 관리 바로 아래로 이동(회원 관리 짝 배치).
      // 🗂️ 2026-07-02 (IA 통합): '도매 예치금'(/admin/wholesale-deposits)도 '예치금' 탭으로 통합 — also 에 추가.
      { path: '/admin/distributor-grades', label: '판매사 관리', icon: Layers, also: ['/admin/distributor-approval', '/admin/distributor-credit', '/admin/distributor-tax', '/admin/distributor-supply', '/admin/wholesale-deposits'] },
      { path: '/admin/wholesale-import',   label: '상품 일괄 등록', icon: Upload },
      { path: '/admin/wholesale-products', label: '도매 프리미엄관', icon: Crown },
      { path: '/admin/wholesale-orders',   label: '도매 주문',     icon: ShoppingBag },
      { path: '/admin/wholesale-quotes',   label: '도매 견적',     icon: ClipboardList },
      { path: '/admin/wholesale-activity', label: '처리 이력 (누가 처리?)', icon: History },
    ],
  },
  {
    // 🏭 도매몰 — 정산/머니
    title: '💰 도매몰 · 정산',
    domain: 'wholesale',
    items: [
      // 🗂️ 2026-07-02 (IA 통합): '도매 예치금'은 '판매사 관리'의 '예치금' 탭, '제조사 출금'은 '제조사 관리'의
      //   '출금 처리' 탭으로 이동 — 중복 nav 항목 제거(딥링크 라우트는 각 컨테이너 페이지의 탭으로 열림).
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
      // 🏬 2026-08-03 (대표 "도매몰은 잔재도 없애는거야"): 몰 관리는 **도매 그룹에서 여기로 옮겼다.**
      //   이 화면이 정하는 건 도매몰이 아니라 `urdeal.kr/{슬러그}`(운영자 몰 = 소비자 표면)의 존재·공개·색이다.
      //   같은 날 API 도 도매 번들 밖으로 옮겼다(worker/index.ts). 철거 계획 §1(c) "몰 인프라는 물려받는다".
      { path: '/admin/wholesale-malls',  label: '운영자 몰 관리', icon: Building2 },
      { path: '/admin/gb-cockpit',       label: '공구 엔진 조종석', icon: Rocket },
      { path: '/admin/dongnedeal-import', label: '동네딜 상품 등록', icon: Upload },
      { path: '/admin/fcfs',             label: '추첨 응모 관리', icon: Gift },
      { path: '/admin/experience-campaigns', label: '체험 캠페인',   icon: Gift },
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
      // 🧾 2026-07-10: 불변식 #44 콕핏 — promo 재원/원장 platform:revenue 대칭 감사 (read-only, 8월 flip 검증 표면).
      { path: '/admin/promo-ledger',     label: 'promo 재원 원장', icon: FileText },
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
      { path: '/admin/district-coupons', label: '상권 쿠폰(영수증 페이백)', icon: Ticket },
      { path: '/admin/policy',           label: '정책 대시보드', icon: Shield },
    ],
  },
  {
    title: '콘텐츠',
    items: [
      { path: '/admin/blog',              label: '블로그 관리',   icon: BookOpen },
      // 🥗 2026-07-15 소셜 자동화는 ur-ads 워커로 이전(메인 슬림 유지). ur-ads 컷오버 완료 후 메뉴 재노출.
      { path: '/admin/social',            label: '소셜 홍보',     icon: Share2 },
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
/**
 * 🧨 **도매 철거 — 소비자 도메인에서 도매 밴드를 숨긴다** 〔2026-08-03 대표 "도매몰은 잔재도 없애는거야"〕
 *
 * 릴리즈 체크리스트 **A6**(*"도매 잔재가 안 보인다 — 어드민 메뉴에 도매 항목 0"*)의 안전한 절반이다.
 *
 * 🔴 **숨겨도 잃는 게 없다**: 도매 어드민 API 는 `mount-wholesale.ts` 안에 있어 소비자 배포(ur-live)에는
 *   **애초에 없다**(`__INCLUDE_WHOLESALE__=false` → DCE). urdeal.kr 에서 이 메뉴들은 **이미 죽은 링크**였다.
 *   즉 이 필터는 기능을 끄는 게 아니라 *없는 기능을 안 보이게* 한다.
 *
 * 🔴 **왜 화면 삭제가 아니라 숨김인가**: 철거 계획 §4 가 *"머니 게이트 4항목(예치금·미확인 충전요청·
 *   미지급 정산금·plus)이 0 임을 확인한 뒤에 삭제"* 로 못박았고, 그 **확인 경로가 `/admin/wholesale-overview`**
 *   다. 도매 도메인에서 그 화면이 살아 있어야 대표가 잔액을 확인하고 환급할 수 있다.
 *   ⇒ 소비자 도메인에서만 숨기고, 삭제는 게이트 통과 후 **별도 PR**(계획 §5-3, 대표 확정 "삭제는 고립").
 *
 * 탈출구: `?wholesale=1`(`isUtongstart` 가 이미 지원) · 호스트에 `wholesale` 포함(`ur-wholesale.pages.dev`).
 */
export function isWholesaleAdminSurface(): boolean {
  if (isUtongstart()) return true                      // utongstart.com · ?wholesale=1 — 호스트 SSOT
  if (typeof window === 'undefined' || !window.location) return false
  return window.location.hostname.toLowerCase().includes('wholesale')  // ur-wholesale.pages.dev 등
}

/** 도매 밴드 제거 — 도매 배포에서는 그대로 둔다. `domain: 'wholesale'` 그룹만 대상. */
export const withoutWholesaleOnConsumer = (groups: NavGroup[]): NavGroup[] =>
  isWholesaleAdminSurface() ? groups : groups.filter((g) => g.domain !== 'wholesale')

export const VISIBLE_NAV_GROUPS: NavGroup[] = LIVE_COMMERCE_SUSPENDED
  ? NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => !LIVE_ADMIN_PATHS.has(it.path)) })).filter((g) => g.items.length > 0)
  : NAV_GROUPS

// 🎟️🏭 2026-07-01 (대표 "유어딜·도매몰 철저히 UX/UI 분리 — 전체적으로"): 좌측 nav 를 서비스 밴드로 구획.
//   super 어드민은 전 그룹을 보는데 유어딜(소비자)·유통스타트(도매몰)·공통 그룹이 섞여 보였음(구분=이모지 뿐) →
//   섹션 헤더 밴드로 3분할(운영 '홈'은 최상단 무밴드). 그룹 정의/RBAC(도매 role=wholesale 그룹만)/collapse/active 전부 불변 — 렌더 구획만.
export type NavSectionKey = 'home' | 'urdeal' | 'wholesale' | 'common'
export const navSectionOf = (g: NavGroup): NavSectionKey =>
  g.domain === 'wholesale' ? 'wholesale'
    : g.title === '운영' ? 'home'
      : (g.title === '🏪 오프라인 공구' || g.title === '🛒 온라인 쇼핑') ? 'urdeal'
        : 'common'
export const NAV_SECTIONS: Array<{ key: NavSectionKey; label?: string; accent?: string }> = [
  { key: 'home' },
  { key: 'urdeal', label: '🎟️ 유어딜 · 소비자', accent: '#a5b4fc' },
  { key: 'wholesale', label: '🏭 유통스타트 · 도매몰 (B2B)', accent: '#fbbf24' },
  { key: 'common', label: '⚙️ 공통 · 회원·재무·검증·시스템', accent: '#94a3b8' },
]

// 🛡️ 2026-06-17 (대표 신고 — 로그인 시 화면이 미친듯이 깜빡): 강제 보안 설정/계정 보안 페이지는
//   역할과 무관하게 항상 도달 가능해야 한다. 도매 RBAC 리다이렉트가 강제 PIN 게이트와 충돌하면 무한 루프.
export const ALWAYS_ALLOWED_ADMIN_PATHS = ['/admin/set-pin', '/admin/2fa']
// 🆕 2026-06-24: '도매 통합 현황'의 승인 큐 카드가 가리키는 비-도매-nav 경로 — 도매 파트너도 도달 허용.
// 🗂️ 2026-07-02 (1페이지화): 예치금/출금 nav 항목이 판매사·제조사 관리의 탭으로 흡수되며 딥링크
//   경로가 nav 주항목에서 사라짐 → wholesale role 도달성 명시 허용(탭으로 열림).
export const WHOLESALE_EXTRA_ALLOWED_PATHS = ['/admin/products', '/admin/wholesale-integrity', '/admin/wholesale-deposits', '/admin/wholesale-withdrawals']
