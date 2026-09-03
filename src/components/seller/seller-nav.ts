/**
 * 🧭 셀러 대시보드 네비게이션 정의 (SSOT) — SellerLayout 에서 추출 (2026-08-20)
 *
 * 왜 분리했나: ① SellerLayout 이 파일크기 래칫(616줄)을 넘어섰고 ② 셀러 대시보드 V2 개편
 * (docs/design/seller-dashboard-v2.md — 매장업주·중개자 공용 콘솔)에서 nav 가 계속 바뀔 파일이라
 * 레이아웃 셸과 분리해 두는 것이 맞다. **여기는 데이터만** — 렌더링/필터링은 SellerLayout 이 한다.
 */
import { LayoutDashboard, PlusCircle, ShoppingBag, Package, DollarSign, Megaphone, Bell, Building2, Heart, BarChart3, Ticket, Star, BarChart2, BookOpen, Tag, Sparkles, Boxes, ScanLine, Handshake, Receipt, Gift, Play, Rocket, Undo2, Users } from 'lucide-react'
import { LIVE_COMMERCE_SUSPENDED, SELLER_STORE_ONLY_MODE } from '@/shared/feature-flags'

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
     *      수정 버튼은 이 페이지 안에만 있으므로 *"이용권 수정도 안되는구나"* 도 같은 원인이다.
     *   ② 매장 단독 셀러는 심플 nav 라 보이긴 했는데 이름이 **"내 딜"** 이었다 — 대표가 찾던
     *      "이용권 관리"로 읽히지 않는다.
     * ⇒ 등록과 관리를 같은 가시성으로 맞춘다(`common`) + 이름을 하는 일 그대로 쓴다.
     */
    labelKey: 'seller.layout.vouchers',
    items: [
      /**
       * 🎟️ 2026-08-23 (대표 — "왼쪽 카테고리에도 이용권 등록 버튼이 있어야지") → 2026-09-03
       *   (대표 — *"이용권 등록이랑 같이 이용권 통합 관리 페이지 있으면 되겠네"*): 홈 그룹에 혼자
       *   떠 있던 등록을 **관리와 같은 묶음**으로 옮겼다. 셀러가 하는 일은 '만들고, 운영한다' 둘이다.
       */
      { path: '/seller/meal-voucher/new', labelKey: 'seller.registerVoucher', icon: PlusCircle, mode: 'common' as SellerMode },
      /**
       * 🎟️ **nav 는 하나, 페이지 안에서 탭** (2026-09-03 대표 *"이용권 관련한 통합으로 한 페이지에"*).
       * 목록·사용처리·후기 인증은 `SellerVoucherTabs` 로 한 화면처럼 묶인다 —
       * `also` 가 그 형제 라우트에서도 이 항목을 켠다(안 넣으면 탭 이동 중 사이드바가 꺼져 길을 잃는다).
       * `/seller/products/` 는 이용권 **수정** 화면이라 함께 켠다.
       */
      { path: '/seller/group-buy', labelKey: 'seller.nav.voucherManage', icon: Ticket, mode: 'common' as SellerMode,
        also: ['/seller/scan', '/seller/review-verifications', '/seller/products/'] },
      // 🏁 2026-06-12 (4차 감사 D5) → 🏪 2026-07-19 상품그룹 숨김에 따라 이용권 그룹으로 이동:
      //   크리에이터 대행 등록 검토/승인(매장) — 이용권 운영의 일부.
      { path: '/seller/proxy-products', labelKey: 'seller.nav.proxyProducts', icon: Package, mode: 'store' },
      // 🏭 2026-06-04 역할 큐레이션 — 숙소는 매장(오프라인 숙박) 전용. 크리에이터에겐 숨김.
      { path: '/seller/stays', labelKey: 'seller.nav.stays', icon: Building2, mode: 'store', hideFor: ['influencer'] },
      { path: '/seller/stays/bookings', labelKey: 'seller.nav.staysBookings', icon: BarChart3, mode: 'store', hideFor: ['influencer'] },
    ],
  },
  {
    labelKey: 'seller.layout.ordersCustomers',
    items: [
      { path: '/seller/orders', labelKey: 'seller.orders', icon: ShoppingBag, mode: 'common' },
      // ↩️ 2026-08-01 세션 ⑤ — 반품 큐. API(`GET /api/returns/seller`)는 있었는데 **소비 화면이 0건**이라
      //    운영자가 자기 상품 반품을 볼 데가 없었다(체크리스트 §5.4 🟡).
      { path: '/seller/returns', labelKey: 'seller.nav.returns', icon: Undo2, mode: 'common' },
      { path: '/seller/reviews', labelKey: 'seller.nav.reviews', icon: Star, mode: 'common' },
      { path: '/seller/coupons', labelKey: 'seller.nav.coupons', icon: Ticket, mode: 'common' },
      { path: '/seller/promo-codes', labelKey: 'seller.nav.promoCodes', icon: Tag, mode: 'common' },
      // 🤝 2026-07-10: 소개 파트너 우대 커미션 협업 deal (marketing.routes sellerApp — 기존 API)
      { path: '/seller/influencer-deals', labelKey: 'seller.nav.influencerDeals', icon: Handshake, mode: 'common' },
      // 📣 2026-08-20 — 유어애즈 DB 탐색 + 협업 제안(발송은 유어딜 대행)
      { path: '/seller/influencers', labelKey: 'seller.nav.findInfluencers', icon: Megaphone, mode: 'common' },
      // 🎁 2026-07-12 WP-A: 체험 캠페인(무료 응모·추첨 체험단). 생성은 게이트 뒤, 관리는 상시.
      { path: '/seller/experience-campaigns', labelKey: 'seller.nav.experienceCampaigns', icon: Gift, mode: 'common' },
      { path: '/seller/followers', labelKey: 'seller.nav.followers', icon: Heart, mode: 'common' },
    ],
  },
  {
    labelKey: 'seller.layout.revenue',
    items: [
      { path: '/seller/analytics', labelKey: 'seller.analytics', icon: BarChart2, mode: 'common' },
      { path: '/seller/settlements', labelKey: 'seller.revenue', icon: DollarSign, mode: 'common' },
      // 🤝 2026-07-10: 3단 위임/promo 투명성 (§4.3) — promo 지출(불변원칙 #1)·매장 위임(grant/revoke)
      { path: '/seller/promo-spend', labelKey: 'seller.nav.promoSpend', icon: Receipt, mode: 'common' },
      // 🏪 2026-08-20 seller-dashboard-v2 — 매장 관리(추가·삭제·위임)·운영자
      { path: '/seller/stores', labelKey: 'seller.nav.stores', icon: Building2, mode: 'common' },
      { path: '/seller/agency-delegation', labelKey: 'seller.nav.agencyDelegation', icon: Handshake, mode: 'common' },
      // 🏪 2026-08-19 매장 운영자 관리 (store-operator-model.md 2단계) — 소유자만 실제로 쓸 수 있고,
      //   비소유자가 들어가면 서버가 403 을 준다(화면 숨김은 편의, 게이트는 서버).
      { path: '/seller/operators', labelKey: 'seller.nav.operators', icon: Users, mode: 'common' },
      { path: '/seller/donations', labelKey: 'seller.donations', icon: Heart, hideFor: ['store_owner'], mode: 'live' },
      { path: '/seller/castings', labelKey: 'seller.nav.castings', icon: Megaphone, mode: 'live' },
      { path: '/seller/promote-boosts', labelKey: 'seller.nav.promoteBoosts', icon: Rocket, mode: 'live' },
    ],
  },
  // 🛡️ 2026-05-25 (migration 0278/0280): 큐레이터 유어샵 통합 — 셀러도 본인 user 계정 큐레이터 가능
  // 🏭 2026-06-04 역할 큐레이션 — 유어샵/큐레이터/영입은 크리에이터 전용. 매장사장님에겐 숨김.
  {
    labelKey: 'seller.layout.curator',
    hideFor: ['store_owner'],
    items: [
      { path: '/host', labelKey: 'seller.nav.hosting', icon: Sparkles, mode: 'common' },
      { path: '/u/me/earnings', labelKey: 'seller.nav.curatorEarnings', icon: Sparkles, mode: 'common' },
      // 🛡️ 2026-05-27: 매장 영입 prospects (인플루언서 only)
      { path: '/seller/prospects', labelKey: 'seller.nav.prospects', icon: Sparkles, mode: 'common' },
    ],
  },
  {
    labelKey: 'seller.layout.settings',
    items: [
      { path: '/seller/business-info', labelKey: 'seller.businessInfo', icon: Building2, mode: 'common' },
      { path: '/seller/mini-shop', labelKey: 'seller.nav.miniShop', icon: Megaphone, mode: 'common' },
      { path: '/seller/streaming-guide', labelKey: 'seller.nav.streamingGuide', icon: Play, mode: 'live' },
      { path: '/seller/alimtalk', labelKey: 'seller.brandMessage', icon: Bell, mode: 'common' },
      { path: '/seller/notify-followers', labelKey: 'seller.nav.notifyFollowers', icon: Megaphone, mode: 'live' },
      { path: '/seller/guide', labelKey: 'seller.nav.guide', icon: BookOpen, mode: 'common' },
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
