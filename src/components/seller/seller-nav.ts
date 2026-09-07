/**
 * 🧭 셀러 대시보드 네비게이션 정의 (SSOT) — SellerLayout 에서 추출 (2026-08-20)
 *
 * 왜 분리했나: ① SellerLayout 이 파일크기 래칫(616줄)을 넘어섰고 ② 셀러 대시보드 V2 개편
 * (docs/design/seller-dashboard-v2.md — 매장업주·중개자 공용 콘솔)에서 nav 가 계속 바뀔 파일이라
 * 레이아웃 셸과 분리해 두는 것이 맞다. **여기는 데이터만** — 렌더링/필터링은 SellerLayout 이 한다.
 */
import { LayoutDashboard, PlusCircle, ShoppingBag, Package, DollarSign, Megaphone, Bell, Building2, Heart, BarChart3, Ticket, Star, BarChart2, BookOpen, Tag, Sparkles, Boxes, ScanLine, Handshake, Receipt, Gift, Play, Rocket, Undo2, Users } from 'lucide-react'
import { LIVE_COMMERCE_SUSPENDED, SELLER_STORE_ONLY_MODE } from '@/shared/feature-flags'
import { SELLER_TAB_GROUPS, tabGroupSiblings } from './seller-tab-groups'

export type SellerType = 'influencer' | 'store_owner' | 'both'

/**
 * 🛡️ 2026-05-17: Mode-based IA — 각 nav 항목에 'mode' 표시.
 *   live   = 라이브 송출 (인플루언서) 전용
 *   store  = 매장 운영 (이용권 발행) 전용
 *   common = 둘 다 사용
 * 사용자가 selectedMode 토글하면 해당 mode + common 만 노출.
 * 'both' 셀러는 상단에 segmented control 로 모드 전환 가능.
 */
export type SellerMode = 'live' | 'store' | 'common'

/**
 * 🧭 **묶음 하나 = 사이드바 한 줄** (2026-09-03 대표 승인 "전부" — 36줄 → 14줄).
 *
 * 착지점·이름·아이콘·형제 경로를 전부 `seller-tab-groups`(SSOT)에서 가져온다. 여기서 손으로 다시
 * 적지 않는 이유는 하나다 — **`also` 가 형제 경로와 어긋나면 탭으로 이동한 순간 사이드바 줄이 꺼져
 * 사용자가 자기 위치를 잃는다.** 파생시키면 어긋날 수가 없다.
 */
function navFromGroup(landingPath: string, extraAlso: string[] = []) {
  const g = SELLER_TAB_GROUPS.find(x => x.tabs[0].path === landingPath)
  if (!g) throw new Error(`[seller-nav] 알 수 없는 묶음: ${landingPath}`)
  return {
    path: landingPath,
    labelKey: g.labelKey,
    icon: g.icon,
    mode: (g.mode || 'common') as SellerMode,
    ...(g.hideFor ? { hideFor: g.hideFor } : {}),
    also: [...tabGroupSiblings(landingPath), ...extraAlso],
  }
}

export const NAV_GROUPS: {
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
      // 🏪 2026-07-19 (대표 확정 — "상품은 유어샵에서만"): 상품(물건) 판매 표면 = 유어샵. nav 최상단 진입.
      ...(SELLER_STORE_ONLY_MODE ? [{ path: '/u/me', labelKey: 'seller.nav.myLinkshop', icon: Sparkles, mode: 'common' as SellerMode }] : []),
    ],
  },
  // 🏭 2026-06-04 (사용자 요청): 방송 그룹(라이브 방송/송출 키/쇼츠/라이브 분석) 숨김 — 셀러 대시보드 간소화.
  // 🏪 2026-07-19 (대표 확정 — SELLER_STORE_ONLY_MODE): 상품·소싱 그룹(온라인 상품 관리/도매 소싱) 숨김 —
  //   셀러 대시보드 = 순수 매장(이용권) 콘솔. 상품 판매는 유어샵으로 일원화. 라우트/코드 보존(가역).
  ...(SELLER_STORE_ONLY_MODE ? [] : [{
    // 🛡️ 2026-06-01: '판매'(12) → 상품·소싱 / 공구·숙소 / 주문·고객 3그룹 분할 (탐색성). mode/hideFor 보존.
    labelKey: 'seller.layout.products',
    items: [
      // 🧭 2026-06-09 IA 정리: 묶음/재고는 상품 페이지 상단 SellerProductTabs 로 이동 — nav 1항목.
      //   라우트는 보존(딥링크 안전), also 로 탭 형제 라우트에서도 활성 표시.
      { path: '/seller/products', labelKey: 'seller.nav.products', icon: Package, mode: 'common' as SellerMode, also: ['/seller/bundles', '/seller/inventory'] },
      // 🛡️ 2026-06-01 도매몰 노출: 셀러가 도매 카탈로그에서 상품 소싱 → 내 스토어 등록.
      { path: '/seller/supply', labelKey: 'seller.nav.supply', icon: Boxes, mode: 'common' as SellerMode },
    ],
  }]),
  {
    /**
     * 🎟️ **이용권** — 2026-09-03 대표 신고 *"이용권 관리에 대한 통합 페이지가 따로 없어보여.
     *   셀러 대시보드 왼쪽 카테고리에도 없지 않아?"* 로 재편.
     *
     * 실제로 페이지는 있었다(`/seller/group-buy`). 문제는 **닿을 수가 없었다**는 것이다:
     *   ① 이 그룹 전체가 `mode: 'store'` 였다 → `isStoreOwner` 가 아닌 셀러(크리에이터·기본값)에겐
     *      통째로 숨겨졌다. 그런데 **이용권 *등록*은 `common`**(2026-08-23 대표 지시)이라
     *      **누구나 만들 수는 있는데 만든 뒤 목록·수정에 갈 링크가 하나도 없었다.**
     *      수정 버튼은 그 페이지 안에만 있으므로 *"이용권 수정도 안되는구나"* 도 같은 원인이다.
     *   ② 매장 단독 셀러는 심플 nav 라 보이긴 했는데 이름이 **"내 딜"** 이었다.
     */
    labelKey: 'seller.layout.vouchers',
    items: [
      // 셀러가 하는 일은 '만들고, 운영한다' 둘이다 — 등록과 관리를 같은 묶음에 둔다.
      { path: '/seller/meal-voucher/new', labelKey: 'seller.registerVoucher', icon: PlusCircle, mode: 'common' as SellerMode },
      // `/seller/products/` 는 이용권 **수정** 화면이라 이 줄을 함께 켠다(탭 이동 중 길 잃음 방지).
      navFromGroup('/seller/group-buy', ['/seller/products/']),
      navFromGroup('/seller/stays'),
    ],
  },
  {
    labelKey: 'seller.layout.sales',
    items: [
      navFromGroup('/seller/orders'),
      navFromGroup('/seller/settlements'),
    ],
  },
  {
    labelKey: 'seller.layout.growth',
    items: [
      navFromGroup('/seller/coupons'),
      navFromGroup('/seller/influencer-deals'),
      // 🏭 크리에이터 전용 — 매장 사장님에겐 숨긴다(hideFor 는 항목 단위로 유지).
      { path: '/u/me/earnings', labelKey: 'seller.nav.curatorEarnings', icon: Sparkles, mode: 'common' as SellerMode, hideFor: ['store_owner'] as SellerType[] },
      { path: '/seller/prospects', labelKey: 'seller.nav.prospects', icon: Sparkles, mode: 'common' as SellerMode, hideFor: ['store_owner'] as SellerType[] },
      /**
       * 🎥 **라이브 전용 — 지금은 아무에게도 안 보인다**(`LIVE_COMMERCE_SUSPENDED` 가 렌더에서 거른다).
       * 2026-09-03 통폐합 때 이 줄들을 **빠뜨렸다가 `check-orphan-routes` 가 잡았다.**
       * 화면엔 어차피 안 뜨지만 정의에서 지우면 **라우트가 어디에서도 닿을 수 없는 상태**가 되고,
       * 라이브가 돌아오는 날 조용히 사라진 채로 남는다. **숨기는 것과 없애는 것은 다르다.**
       */
      { path: '/seller/donations', labelKey: 'seller.donations', icon: Heart, mode: 'live' as SellerMode, hideFor: ['store_owner'] as SellerType[] },
      { path: '/seller/castings', labelKey: 'seller.nav.castings', icon: Megaphone, mode: 'live' as SellerMode },
      { path: '/seller/promote-boosts', labelKey: 'seller.nav.promoteBoosts', icon: Rocket, mode: 'live' as SellerMode },
    ],
  },
  {
    labelKey: 'seller.layout.settings',
    items: [
      { path: '/seller/business-info', labelKey: 'seller.businessInfo', icon: Building2, mode: 'common' as SellerMode },
      navFromGroup('/seller/stores'),
      navFromGroup('/seller/alimtalk'),
      // 🎥 라이브 전용 — 위와 같은 이유로 정의에 남긴다(렌더에서는 게이트가 숨긴다).
      { path: '/seller/streaming-guide', labelKey: 'seller.nav.streamingGuide', icon: Play, mode: 'live' as SellerMode },
      { path: '/seller/notify-followers', labelKey: 'seller.nav.notifyFollowers', icon: Megaphone, mode: 'live' as SellerMode },
    ],
  },
]

export /** mode segmented control 가시성: 'both' 셀러만 토글 가능. 다른 타입은 고정.
 *  라이브 중단 시 모두 'store'(공구/매장) 단일 모드 → 토글 숨김 + 라이브 메뉴 비노출. */
function modesForSellerType(st: SellerType): SellerMode[] {
  if (LIVE_COMMERCE_SUSPENDED) return ['store']
  if (st === 'influencer') return ['live']
  if (st === 'store_owner') return ['store']
  return ['live', 'store']  // both
}

/**
 * 🔎 **검색에만 나오는 페이지** (2026-09-03 대표 *"셀러대시보드도 어드민처럼 페이지 검색이 필요해"*).
 *
 * 셀러 라우트 64개 중 사이드바에 있는 건 절반뿐이고, 나머지에는 **실제로 쓰는 화면이 섞여 있다**
 * (내 정보·등급·예약·매장 원장·교환권 발송 이력…). 사이드바에 다 올리면 지금도 긴 메뉴가 두 배가 되고,
 * 안 올리면 존재조차 모른다 — 오늘 이용권 관리에서 그 대가를 치렀다.
 * ⇒ **사이드바는 그대로, 검색은 전부 닿게.** 로그인·콜백 같은 통과 화면은 넣지 않는다(갈 데가 아니다).
 */
export const SELLER_SEARCH_ONLY: { path: string; labelKey: string; fallback: string; icon: any; group: string }[] = [
  { path: '/seller/profile', labelKey: 'seller.nav.profile', fallback: '내 정보', icon: Users, group: '설정' },
  { path: '/seller/tier', labelKey: 'seller.nav.tier', fallback: '셀러 등급', icon: Star, group: '설정' },
  { path: '/seller/2fa', labelKey: 'seller.nav.twoFactor', fallback: '2단계 인증', icon: Bell, group: '설정' },
  { path: '/seller/appointments', labelKey: 'seller.nav.appointments', fallback: '예약 관리', icon: BarChart3, group: '주문·고객' },
  { path: '/seller/ledger', labelKey: 'seller.nav.ledger', fallback: '매장 원장', icon: Receipt, group: '수익' },
  { path: '/seller/store-dashboard', labelKey: 'seller.nav.storeDashboard', fallback: '매장 현황', icon: Building2, group: '수익' },
  { path: '/seller/realtime', labelKey: 'seller.nav.realtime', fallback: '실시간 현황', icon: BarChart2, group: '수익' },
  { path: '/seller/voucher-orders', labelKey: 'seller.nav.voucherOrders', fallback: '교환권 발송 이력', icon: Gift, group: '수익' },
  { path: '/seller/transfers', labelKey: 'seller.nav.transfers', fallback: '매장 이관', icon: Handshake, group: '설정' },
  { path: '/seller/marketing', labelKey: 'seller.nav.marketing', fallback: '마케팅', icon: Megaphone, group: '주문·고객' },
  { path: '/seller/ad-slots', labelKey: 'seller.nav.adSlots', fallback: '광고 슬롯', icon: Rocket, group: '주문·고객' },
]
