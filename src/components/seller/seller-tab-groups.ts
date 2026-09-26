import { Ticket, ShoppingBag, DollarSign, Tag, Handshake, Building2, Bell, BedDouble } from 'lucide-react'
import type { SellerMode, SellerType } from './seller-nav'
import { SELLER_COUPONS_HIDDEN, SELLER_DORMANT_HIDDEN } from '@/shared/feature-flags'

/**
 * 🧭 **한 가지 일 = 사이드바 한 줄, 나머지는 그 안의 탭** (2026-09-03 대표 승인 "전부").
 *
 * ## 왜
 * 사이드바 항목이 36개였다. 대표가 *"페이지들 통폐합도 해서 최대한 필요한 것들만"* 이라고 했고,
 * 같은 날 이용권에서 먼저 해 본 방식(`nav 하나 + 페이지 안 탭`)이 잘 읽혀서 대시보드 전체에 적용한다.
 *
 * ## 지우는 게 아니라 접는 것이다
 * **라우트는 하나도 없애지 않는다.** 북마크·기존 링크·딥링크가 전부 그대로 열린다. 바뀌는 것은
 * 사이드바 줄 수와 각 화면 위의 탭 줄뿐이다. 되돌리려면 이 파일과 `seller-nav` 의 묶음만 풀면 된다.
 *
 * ## 규칙 (어기면 오늘 고친 사고가 그대로 재발한다)
 * - **첫 항목이 그 묶음의 착지점**이고, 사이드바에는 그것만 나온다.
 * - 사이드바 항목의 `also` 에 **나머지 형제 경로 전부**가 들어가야 한다. 안 넣으면 탭으로 이동한
 *   순간 사이드바에서 그 줄이 꺼져 **사용자가 자기 위치를 잃는다.** 그 쌍은 테스트가 강제한다.
 * - 탭은 `SellerLayout` 이 **한 곳에서** 그린다(페이지마다 붙이지 않는다). 페이지 24곳 중 6곳은
 *   `DashboardPageHeader` 를 안 쓰기 때문에 헤더에 붙이면 **그 여섯에서 탭이 사라진다** —
 *   그중 `/seller/stores` 는 묶음의 착지점이라, 거기서 탭이 없으면 위임·운영자로 갈 길이 없어진다.
 *   (오늘 고친 "페이지는 있는데 닿을 수 없다"와 정확히 같은 사고다.)
 * - 역할 조건(`mode`/`hideFor`)은 **탭에도** 건다. 매장 전용 화면이 크리에이터 탭에 뜨면
 *   눌러 봐야 서버가 403 을 준다.
 */
export interface SellerTab {
  path: string
  labelKey: string
  fallback: string
  mode?: SellerMode
  hideFor?: SellerType[]
}

export interface SellerTabGroup {
  /** 사이드바에 나오는 이름 */
  labelKey: string
  fallback: string
  icon: any
  /** 첫 항목 = 착지점(사이드바가 가리키는 곳) */
  tabs: SellerTab[]
  mode?: SellerMode
  hideFor?: SellerType[]
}

export const SELLER_TAB_GROUPS: SellerTabGroup[] = [
  {
    labelKey: 'seller.nav.voucherManage', fallback: '이용권 관리', icon: Ticket,
    tabs: [
      { path: '/seller/group-buy', labelKey: 'seller.voucherTabs.list', fallback: '이용권' },
      { path: '/seller/scan', labelKey: 'seller.voucherTabs.scan', fallback: '사용처리' },
      // 후기 인증: `kakao_review_submissions` **0행**(2026-09-26 실측) — 탭만 내린다.
      ...(SELLER_DORMANT_HIDDEN ? [] : [{ path: '/seller/review-verifications', labelKey: 'seller.voucherTabs.reviews', fallback: '후기 인증' }]),
      // 크리에이터 대행 등록 검토/승인 — 매장이 하는 일이라 매장에게만 보인다.
      { path: '/seller/proxy-products', labelKey: 'seller.nav.proxyProducts', fallback: '대행 승인', mode: 'store' },
    ],
  },
  // 🛏️ 2026-09-26 (대표 *"뺄 것들 빼자"* → 실측): 셀러 소유 숙소 상품 **0** · 예약 **0**.
  //   쿠폰과 같은 판정이라 같은 방식으로 내린다 — 착지점(`/seller/stays`)이 사라지므로 묶음째.
  //   ⚠️ 지운 게 아니라 접은 것이다. 라우트·페이지·API·`StaysSheet` 전부 보존 — 플래그 false 면 복귀.
  ...(SELLER_DORMANT_HIDDEN ? [] : [{
    labelKey: 'seller.nav.stays', fallback: '숙소', icon: BedDouble, mode: 'store' as const, hideFor: ['influencer' as const],
    tabs: [
      { path: '/seller/stays', labelKey: 'seller.nav.stays', fallback: '숙소' },
      { path: '/seller/stays/bookings', labelKey: 'seller.nav.staysBookings', fallback: '예약' },
    ],
  }]),
  {
    labelKey: 'seller.orders', fallback: '주문', icon: ShoppingBag,
    tabs: [
      { path: '/seller/orders', labelKey: 'seller.orderTabs.orders', fallback: '주문' },
      { path: '/seller/returns', labelKey: 'seller.nav.returns', fallback: '환불' },
      { path: '/seller/reviews', labelKey: 'seller.nav.reviews', fallback: '리뷰' },
    ],
  },
  {
    labelKey: 'seller.revenue', fallback: '정산', icon: DollarSign,
    tabs: [
      { path: '/seller/settlements', labelKey: 'seller.revenue', fallback: '정산' },
      { path: '/seller/analytics', labelKey: 'seller.analytics', fallback: '매출 분석' },
      { path: '/seller/promo-spend', labelKey: 'seller.nav.promoSpend', fallback: 'promo 지출' },
    ],
  },
  // 🎫 2026-09-26 (대표 *"쿠폰은 앞으로 필요없을 것 같은데? 확인해줘"* → 실측 확인):
  //   이 묶음의 **착지점이 쿠폰**이라, 쿠폰을 사이드바에서 내리면 묶음도 같이 내려야 한다 —
  //   착지점이 사이드바에 없으면 탭으로 이동한 순간 사이드바 줄이 꺼져 사용자가 위치를 잃는다
  //   (`voucher-nav-reachability` 가 지키는 불변식이고, 실제로 이 커밋에서 그 가드가 잡았다).
  //   ⚠️ 함께 내려가는 `프로모 코드` 도 라이브 `promo_codes` **0행**이라 잃는 것이 없다.
  //   라우트·페이지는 둘 다 보존 — 플래그를 false 로 하면 묶음째 돌아온다.
  ...(SELLER_COUPONS_HIDDEN ? [] : [{
    labelKey: 'seller.nav.discounts', fallback: '할인', icon: Tag,
    tabs: [
      { path: '/seller/coupons', labelKey: 'seller.nav.coupons', fallback: '쿠폰' },
      { path: '/seller/promo-codes', labelKey: 'seller.nav.promoCodes', fallback: '프로모 코드' },
    ],
  }]),
  {
    labelKey: 'seller.nav.partners', fallback: '파트너', icon: Handshake,
    tabs: [
      { path: '/seller/influencer-deals', labelKey: 'seller.nav.influencerDeals', fallback: '협업 제안' },
      { path: '/seller/influencers', labelKey: 'seller.nav.findInfluencers', fallback: '파트너 찾기' },
      // 체험 캠페인: 캠페인 **0** · 응모 **0**(2026-09-26 실측) — 탭만 내린다.
      ...(SELLER_DORMANT_HIDDEN ? [] : [{ path: '/seller/experience-campaigns', labelKey: 'seller.nav.experienceCampaigns', fallback: '체험 캠페인' }]),
      { path: '/seller/followers', labelKey: 'seller.nav.followers', fallback: '팔로워' },
    ],
  },
  {
    labelKey: 'seller.nav.stores', fallback: '매장', icon: Building2,
    tabs: [
      { path: '/seller/stores', labelKey: 'seller.nav.stores', fallback: '매장' },
      { path: '/seller/store', labelKey: 'seller.nav.storeInfo', fallback: '업체 정보' },
      { path: '/seller/operators', labelKey: 'seller.nav.operators', fallback: '운영자' },
      { path: '/seller/operating', labelKey: 'seller.nav.operatingSummary', fallback: '운영 요약' },
    ],
  },
  {
    labelKey: 'seller.nav.notifyGuide', fallback: '알림·가이드', icon: Bell,
    tabs: [
      { path: '/seller/alimtalk', labelKey: 'seller.brandMessage', fallback: '브랜드메시지' },
      { path: '/seller/guide', labelKey: 'seller.nav.guide', fallback: '운영 가이드' },
    ],
  },
]

/** 이 경로가 속한 묶음(없으면 null). 정확 일치 또는 하위 경로. */
export function findSellerTabGroup(pathname: string): SellerTabGroup | null {
  for (const g of SELLER_TAB_GROUPS) {
    for (const t of g.tabs) {
      if (pathname === t.path || pathname.startsWith(t.path + '/')) return g
    }
  }
  return null
}

/** 착지점을 뺀 형제 경로 — 사이드바 `also` 가 이 값을 그대로 쓴다(쌍이 어긋나면 길을 잃는다). */
export function tabGroupSiblings(landingPath: string): string[] {
  const g = SELLER_TAB_GROUPS.find(x => x.tabs[0].path === landingPath)
  return g ? g.tabs.slice(1).map(t => t.path) : []
}
