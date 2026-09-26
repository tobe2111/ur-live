/**
 * 🗺️ **마이 시트 안에서 열리는 셀러 화면 지도** (2026-09-26)
 *   대표: *"모두 다 마이로 가능하게끔 하고"*
 *
 * ## 화면을 복제하지 않는다 — 같은 파일을 연다
 * 셀러 화면은 41개다. 시트용으로 다시 만들면 두 벌이 갈리고, 그때부터 한쪽에만 고쳐진 화면이
 * 생긴다(이 레포가 반복해 당한 클래스). 그래서 여기 있는 것은 **주소 → 그 화면 모듈** 하나뿐이고,
 * 화면 자체는 대시보드가 쓰는 바로 그 파일이다. 껍데기는 `SellerEmbedProvider` 가 벗긴다.
 *
 * ## ⏳ 전부 `lazy` 다 — 누를 때 받는다
 * 38개를 정적으로 import 하면 마이 청크가 그만큼 커지고, **판매를 안 하는 사람도 그 값을 치른다**
 * (마이는 소비자 화면이다). `import()` 라 Rollup 이 각각 별도 청크로 가르고, 누른 것만 내려온다.
 * ⚠️ `import('...')` 의 인자는 **문자열 리터럴**이어야 한다 — 변수로 조립하면 Rollup 이 가를 수
 *   없어 전부 한 덩어리가 되거나 아예 못 찾는다.
 *
 * ## 🔴 시트로 못 여는 셋 (`FULL_SCREEN_ONLY`)
 * 빠뜨린 게 아니라 **이유가 있다.** 이유를 값으로 적어 두는 이유는, 다음 세션이 "왜 이건 없지?"
 * 를 코드에서 바로 읽고 판단하게 하기 위해서다. 이 셋은 종전과 똑같이 전체화면으로 열리고
 * 맨 위에 "마이로 돌아가기" 띠가 붙는다 — **닿지 못하는 화면은 하나도 없다.**
 *
 * ## 🧭 드리프트는 빨간불로 잡는다
 * 새 셀러 화면이 생기면 이 지도에도 들어와야 한다. 안 들어오면 조용히 "전체 도구에서 눌렀는데
 * 시트가 안 열리는 화면" 이 된다 — 그 침묵을 `seller-tool-pages` 테스트가 막는다(나브 색인의 모든
 * 경로가 지도 ∪ 제외목록 안에 있어야 한다).
 */

/** 주소 → 그 화면 모듈을 가져오는 함수. 값은 `React.lazy` 가 그대로 받는다. */
export const TOOL_PAGES: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  '/seller/2fa': () => import('@/pages/Seller2FASetupPage'),
  '/seller/alimtalk': () => import('@/pages/SellerAlimtalkPage'),
  '/seller/analytics': () => import('@/pages/SellerAnalyticsPage'),
  '/seller/appointments': () => import('@/pages/SellerAppointmentsPage'),
  '/seller/business-info': () => import('@/pages/SellerBusinessInfoPage'),
  '/seller/coupons': () => import('@/pages/SellerCouponsPage'),
  '/seller/experience-campaigns': () => import('@/pages/SellerExperienceCampaignsPage'),
  '/seller/followers': () => import('@/pages/SellerFollowersPage'),
  '/seller/group-buy': () => import('@/pages/SellerGroupBuyPage'),
  '/seller/guide': () => import('@/pages/SellerGuidePage'),
  '/seller/influencer-deals': () => import('@/pages/SellerInfluencerDealsPage'),
  '/seller/influencers': () => import('@/pages/SellerInfluencersPage'),
  '/seller/ledger': () => import('@/pages/MyLedgerPage'),
  '/seller/marketing': () => import('@/pages/SellerMarketingPage'),
  '/seller/notify-followers': () => import('@/pages/SellerNotifyFollowersPage'),
  '/seller/operating': () => import('@/pages/SellerOperatingSummaryPage'),
  '/seller/operators': () => import('@/pages/SellerOperatorsPage'),
  '/seller/orders': () => import('@/pages/SellerOrdersPage'),
  '/seller/products': () => import('@/pages/SellerProductsPage'),
  '/seller/profile': () => import('@/pages/SellerProfileEditPage'),
  '/seller/promo-codes': () => import('@/pages/SellerPromoCodesPage'),
  '/seller/promo-spend': () => import('@/pages/SellerPromoSpendPage'),
  '/seller/realtime': () => import('@/pages/SellerRealtimeDashboardPage'),
  '/seller/returns': () => import('@/pages/SellerReturnsPage'),
  '/seller/review-verifications': () => import('@/pages/SellerReviewVerificationsPage'),
  '/seller/reviews': () => import('@/pages/SellerReviewsPage'),
  '/seller/settlements': () => import('@/pages/SellerSettlementsPage'),
  '/seller/stays': () => import('@/pages/SellerStaysPage'),
  '/seller/stays/bookings': () => import('@/pages/SellerStaysBookingsPage'),
  '/seller/store': () => import('@/pages/SellerStoreInfoPage'),
  '/seller/store-dashboard': () => import('@/pages/StoreOwnerDashboardPage'),
  '/seller/stores': () => import('@/pages/SellerStoresPage'),
  '/seller/supply': () => import('@/pages/SellerSupplyPage'),
  '/seller/tier': () => import('@/pages/SellerTierPage'),
  '/seller/transfers': () => import('@/pages/SellerTransfersPage'),
  '/seller/voucher-orders': () => import('@/pages/SellerVoucherOrdersPage'),
}

/**
 * 시트로 **안** 여는 화면과 그 이유. 값(이유)은 사람이 읽으라고 있는 것이고,
 * 테스트는 키만 본다 — 이유 없이 목록만 늘리는 것을 막기 위해 빈 문자열은 금지한다.
 */
export const FULL_SCREEN_ONLY: Record<string, string> = {
  '/seller/scan':
    '카메라를 쓴다. QR 을 손님 앞에서 찍는 화면이라 85dvh 시트 안에서 뷰파인더가 잘린다 — ' +
    '마이는 이미 전용 전체화면(/store/scan)으로 보낸다.',
  '/seller/meal-voucher/new':
    '전용 시트(VoucherNewSheet)가 이미 있다. 여기 또 넣으면 같은 화면을 여는 길이 둘이 되고, ' +
    '둘은 반드시 갈린다(등록 후 목록 새로고침이 한쪽에만 붙는 식으로).',
  '/seller/ad-slots':
    'SellerLayout 을 안 쓴다 — 자체 헤더 + min-h-screen 이라 임베드 컨텍스트가 껍데기를 못 벗긴다. ' +
    '시트에 넣으면 헤더가 두 겹이 되고 화면 높이만큼 늘어난다. ' +
    '⇒ 이 페이지를 SellerLayout 으로 옮기면 지도에 한 줄 추가하는 것만으로 시트가 된다(후속).',
  '/seller/prospects':
    '위와 같다(SellerLayout 미사용 · 자체 헤더). 후속으로 껍데기를 맞추면 자동으로 시트가 된다.',
  '/seller/proxy-products':
    '위와 같다(SellerLayout 미사용 · 자체 헤더 + min-h-screen). 후속 대상.',
}

/** 이 주소를 마이 시트로 열 수 있나. */
export function canOpenInSheet(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(TOOL_PAGES, path)
}
