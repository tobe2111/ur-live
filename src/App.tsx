import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryProvider } from './lib/react-query'
import { runAfterLoad } from './lib/after-load'
import { ProtectedRoute, PublicRoute } from './components/auth/RouteGuards'
import IosTopupGate from './components/IosTopupGate'
import { isMarketingSurface } from './utils/domain'
import ToastContainer from './components/ToastContainer'
import { ConfirmHost } from './components/ui/confirm-dialog'
import NewVersionBanner from './components/main/NewVersionBanner'
import ErrorBoundary from './components/ErrorBoundary'
import FrameWrapper from './components/FrameWrapper'
import { useMultiTabSync } from './hooks/useMultiTabSync'
import { useTokenAutoRefresh } from './hooks/useTokenAutoRefresh'
import HomeRoute from './pages/pc-home/HomeRoute' // 🖥️ 홈 뷰포트 분기(lg+ PC 홈 / 그 외 지도)
import { isFullBleedPcPath } from './shared/pc-fullbleed' // 🖥️ 풀너비 PC 페이지(홈·카탈로그)
import { isMallSurfacePath } from './shared/mall/resolve' // 🏬 운영자 몰 표면(본진 크롬 차단)
import ScrollToTop from './components/ScrollToTop'
import OfflineBanner from './components/OfflineBanner'
import BottomNav from '@/components/main/BottomNav'
import BrandLoader, { BootFirstScreenLoader } from '@/components/brand/BrandLoader'
import { trackFunnel } from '@/lib/funnel'
import { registerRoutePreload } from '@/lib/route-preload'; import { lazyPage, registerBootPage } from '@/lib/boot-page'; import { isCuratorShopPath } from '@/shared/route-surface'
import ConsumerTopChrome from '@/components/main/ConsumerTopChrome'
import { isFullScreenPath, consumerChromeHiddenByPath } from '@/lib/consumer-chrome'
import { swallow } from '@/shared/utils/swallow'
import KakaoConsultButton from '@/components/KakaoConsultButton'
import { featureFlags } from '@/shared/config/feature-flags'
import { CAMPAIGN_SIGNUP_ENABLED } from '@/shared/feature-flags'
import { captureInflowRef } from '@/utils/affiliate-track'
// lazy-loaded — only rendered conditionally, not on initial paint
const PushNotificationSetup = lazy(() => import('./components/PushNotificationSetup'))
const PWAInstallPrompt = lazy(() => import('./components/PWAInstallPrompt'))
const OnboardingTrigger = lazy(() => import('./components/onboarding/OnboardingTrigger'))
const RestoreAccountModal = lazy(() => import('./components/account/RestoreAccountModal'))
const SideBanner = lazy(() => import('@/components/SideBanner'))
const DesignVariantsPage = lazy(() => import('./pages/design-variants/DesignVariantsPage')) // 🎨 내부 시안 갤러리(링크 0 · robots 차단 · noindex)
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { isKorea } from '@/shared/config/region'
import { isNativeShell } from '@/lib/native-platform'
// TD-006: route group files
import { sellerTopLevelRoutes } from './routes/seller-public.routes'; const SellerRouteTree = lazy(() => import('./routes/seller.routes')) // ⚡ 2026-10-18 셀러 표는 셀러 경로에서만 받는다(seller-public.routes 머리말)
import { AgencyConsoleRoutes, AgencyAwareGuest } from './routes/agency-console.routes'
const AdminRouteTree = lazy(() => import('./routes/admin.routes')) // ⚡ 2026-10-12 어드민 표는 어드민 경로에서만 받는다(admin.routes 머리말)

// ❌ REMOVED: Duplicate Sentry initialization (already done in main.tsx)

// ✅ Public / User 페이지들 lazy loading (초기 번들 크기 최소화)
// 🏠 2026-06-20 (대표 결정 — 홈=동네딜 지도+바텀시트): 홈 `/` 메인 콘텐츠를 RestaurantMapPage(지도+
//   드래그 바텀시트+카테고리 칩+내 주변)로 전환. RestaurantMapPage 는 lazy(아래 167행) — 지도는 어차피
//   카카오 SDK async 로드라 컴포넌트 청크 페치(~50-100ms)는 SDK 준비 대비 무시 가능. 기존 MainHomePage(교환권
//   blend)는 dead route 가 되어 import 제거(엔트리 축소). 일반상품/교환권은 '쇼핑' 탭(/vouchers)으로 이전.
//   ⚠️ [UNLOCK_LOADING] 트레이드오프: 홈 SSR 슬롯(__SSR_INITIAL_MAIN__) 미사용 → 홈 첫 화면이 지도 로딩.
//   worker/index.ts SSR inject 는 무수정(주입은 되나 지도 홈이 안 읽음 — 무해).
const PartnershipInquiryPage = lazy(() => import('./pages/PartnershipInquiryPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const IntroducePage = lazy(() => import('./pages/IntroducePage'))
const CreatorApplyPage = lazy(() => import('./pages/CreatorApplyPage')); const CreatorStartPage = lazy(() => import('./pages/CreatorStartPage'))
const CampaignApplyPage = lazy(() => import('./pages/CampaignApplyPage')); const MallAdminPage = lazy(() => import('./pages/MallAdminPage')) // 📣 캠페인 모집 · 🏬 몰 운영자 콘솔(공구 서비스)
const AboutPage = lazy(() => import('./pages/AboutPage')); const AboutServicePage = lazy(() => import('./pages/AboutServicePage')); const PartnersPage = lazy(() => import('./pages/PartnersPage')); const CreatorsPage = lazy(() => import('./pages/CreatorsPage')) // 🧭 2026-07-19 웹페이지 3종 (구 소개서 = /about/print)

const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const JoinChoicePage = lazy(() => import('./pages/JoinChoicePage'))
const KakaoCallbackPage = lazy(() => import('./pages/KakaoCallbackPage'))
const KakaoConsentCallbackPage = lazy(() => import('./pages/KakaoConsentCallbackPage'))
const KakaoLinkCallbackPage = lazy(() => import('./pages/KakaoLinkCallbackPage'))
const PaymentDemoPage = lazy(() => import('./pages/PaymentDemoPage'))
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'))
const PaymentFailPage = lazy(() => import('./pages/PaymentFailPage'))
const PointsChargePage = lazy(() => import('./pages/PointsChargePage'))
// 🛡️ 2026-05-24: 딜 사용 내역 페이지 (사용자 요청 — 충전/사용/적립/환불 히스토리)
const MyDealHistoryPage = lazy(() => import('./pages/MyDealHistoryPage'))
const TossWidgetPayPage = lazy(() => import('./pages/TossWidgetPayPage'))
const TossDebugPage = lazy(() => import('./pages/TossDebugPage'))
const PointsChargeSuccessPage = lazy(() => import('./pages/PointsChargeSuccessPage'))
const CartPage = lazyPage(() => import('./pages/CartPage')); registerBootPage('cart', CartPage.load)
const SearchPage = lazyPage(() => import('./pages/SearchPage')); registerBootPage('search', SearchPage.load)
// 🛡️ 2026-05-25 (migration 0278): 큐레이터 유어샵
const CuratorPage = lazyPage(() => import('./pages/CuratorPage')); registerBootPage('linkshop', () => (isCuratorShopPath(location.pathname) ? CuratorPage.load() : Promise.resolve())); registerRoutePreload('linkshop', CuratorPage.load)
const CuratorEarningsPage = lazy(() => import('./pages/CuratorEarningsPage'))
// 🏁 2026-06-22 (대표 — 상품/이용권 전용 추가 페이지): 유어샵 핀 picker.
const LinkshopPinPicker = lazy(() => import('./pages/curator-page/LinkshopPinPicker'))
// 🛡️ 2026-05-25 (migration 0280): 호스팅 (Phase 3)
const HostingPage = lazy(() => import('./pages/HostingPage'))
const HostingNewPage = lazy(() => import('./pages/HostingNewPage'))
const StoreClaimPage = lazy(() => import('./pages/StoreClaimPage')) // 🏪 매장 등록 단일 목적지(/store/new)
const StoreOwnerClaimPage = lazy(() => import('./pages/StoreOwnerClaimPage')); const StoreAgencyInvitePage = lazy(() => import('./pages/StoreAgencyInvitePage')) // 🙋 내 가게 찾기 — 소유권 신청(/store/find) · 🔗 에이전시 매장 초대 링크(/store/agency/:token)
const StoreGoPage = lazy(() => import('./pages/StoreGoPage')) // 🔗 2026-10-10 사장님 문자 링크 → 카카오 로그인 → 그 매장 좌석 → 목적 화면(shared/store-deep-link)
const HostInvitePage = lazy(() => import('./pages/HostInvitePage'))
// 🛡️ 2026-05-25 (Phase 2 잔여): 반품 회수 송장 추적 UI
const MyReturnsPage = lazy(() => import('./pages/MyReturnsPage'))
// 🛡️ 2026-05-25: /u/me → 본인 공개페이지 redirect
const UMeRedirectPage = lazyPage(() => import('./pages/UMeRedirectPage')); registerRoutePreload('uMe', UMeRedirectPage.load)
// 🔧 2026-09-28 (대표 확정 e3): 유어샵 관리 화면 — 유어샵은 손님 화면 하나뿐, 고치는 일은 전부 여기.
const UShopManagePage = lazy(() => import('./pages/UShopManagePage'))
const UserProfilePage = lazyPage(() => import('./pages/UserProfilePage')); registerRoutePreload('my', UserProfilePage.load)
const WishlistPage = lazy(() => import('./pages/WishlistPage'))
const FollowingPage = lazy(() => import('./pages/FollowingPage'))
const MyVouchersPage = lazyPage(() => import('./pages/MyVouchersPage')); registerRoutePreload('myVouchers', MyVouchersPage.load)
const GuestPassPage = lazyPage(() => import('./pages/guest/GuestPassPage')); const GuestUrShopPage = lazyPage(() => import('./pages/guest/GuestUrShopPage')); const GuestMyPage = lazyPage(() => import('./pages/guest/GuestMyPage')); registerBootPage('guestPass', GuestPassPage.load); registerBootPage('guestUShop', GuestUrShopPage.load); registerBootPage('guestMy', GuestMyPage.load) // 🚪 로그인 전 탭 화면(2026-10-12)
const MyGifticonsPage = lazy(() => import('./pages/MyGifticonsPage'))  // 🎟️ 2026-08-31 지갑 분리 — 교환권 보관함
const StoreScanPage = lazy(() => import('./pages/StoreScanPage'))
const InfluencerSettlementPage = lazy(() => import('./pages/InfluencerSettlementPage'))
const InfluencerDiscoverPage = lazy(() => import('./pages/InfluencerDiscoverPage'))
const InfluencerAnalyticsPage = lazy(() => import('./pages/InfluencerAnalyticsPage'))
const InfluencerRankingsPage = lazy(() => import('./pages/InfluencerRankingsPage'))
const MyFollowsPage = lazy(() => import('./pages/MyFollowsPage'))
const MyDigitalLibraryPage = lazy(() => import('./pages/MyDigitalLibraryPage'))
const VoucherVerifyPage = lazy(() => import('./pages/VoucherVerifyPage'))
const StoreStatsPage = lazy(() => import('./pages/StoreStatsPage'))
const BrowsePage = lazyPage(() => import('./pages/BrowsePage')); registerBootPage('browse', BrowsePage.load)
// 🎬 2026-09-07 유어쇼츠 뷰어(세로 한 편씩) + 2026-09-21 전체 보기(도시·종류 그리드) — **둘 다 lazy**(홈이 재생 코드를 받으면 안 된다)
const VideosPage = lazy(() => import('./pages/VideosPage'))
const UrShortsBrowsePage = lazyPage(() => import('./pages/UrShortsBrowsePage')); registerBootPage('urshorts', UrShortsBrowsePage.load)
// 🛡️ 2026-05-19: 교환권 전용 페이지 — /browse 와 분리 (카카오 선물하기 스타일).
const VouchersPage = lazyPage(() => import('./pages/VouchersPage')); registerBootPage('vouchers', VouchersPage.load); registerRoutePreload('vouchers', VouchersPage.load)
const ExperienceCampaignsPage = lazy(() => import('./pages/ExperienceCampaignsPage'))
// 🆕 2026-06-26 통합 마케팅 서비스(가칭) — 3번째 서비스 /ads(유어딜/도매몰과 분리된 surface). 2026-06-27: /ads = 공개 랜딩, /ads/dashboard = 입점 대시보드
const MarketingLandingPage = lazy(() => import('./pages/marketing/MarketingLandingPage'))
const MarketingLoginPage = lazy(() => import('./pages/marketing/MarketingLoginPage'))
const MarketingSignupPage = lazy(() => import('./pages/marketing/MarketingSignupPage'))
const MarketingAccountPage = lazy(() => import('./pages/marketing/MarketingAccountPage'))
const MarketingForgotPage = lazy(() => import('./pages/marketing/MarketingForgotPage'))
const MarketingResetPage = lazy(() => import('./pages/marketing/MarketingResetPage'))
const MarketingLegalPage = lazy(() => import('./pages/marketing/MarketingLegalPage'))
const MarketingUnlockPage = lazy(() => import('./pages/marketing/MarketingUnlockPage'))
const MarketingDashboardPage = lazy(() => import('./pages/marketing/MarketingDashboardPage'))
const MarketingKakaoCallbackPage = lazy(() => import('./pages/marketing/MarketingKakaoCallbackPage'))
const VoucherDetailPage = lazyPage(() => import('./pages/VoucherDetailPage')); registerBootPage('voucherDetail', VoucherDetailPage.load)
// 🗺️ 2026-07-03 /group-buy 은퇴(홈이 담당) → 홈 리다이렉트. 🎟️ 09-16 상세 정본은 `/pass/:id`(옛 주소는 301).
const GroupBuyDetailPage = lazyPage(() => import('./pages/GroupBuyDetailPage')); registerBootPage('gbDetail', GroupBuyDetailPage.load); registerRoutePreload('gbDetail', GroupBuyDetailPage.load) // 홈 카드가 미리 받는다
const GroupBuyConfirmPaymentPage = lazy(() => import('./pages/GroupBuyConfirmPaymentPage'))
// 🛡️ 2026-05-18: 숙소 공구 사용자 페이지 — PR 3/6, PR 6/6.
const StaysSearchPage = lazyPage(() => import('./pages/StaysSearchPage')); registerBootPage('stays', StaysSearchPage.load); const SoonPage = lazy(() => import('./pages/SoonPage')) /* 🌱 오픈 예정 모아보기 */
const LifePage = lazy(() => import('./pages/life/LifePage')); const LifeRequestFormPage = lazy(() => import('./pages/life/LifeRequestFormPage')); const LifeMyRequestsPage = lazy(() => import('./pages/life/LifeMyRequestsPage')); const LifeRequestDetailPage = lazy(() => import('./pages/life/LifeRequestDetailPage')); const LifeProPage = lazy(() => import('./pages/life/LifeProPage')); const LifeProRequestPage = lazy(() => import('./pages/life/LifeProRequestPage')); const LifeSharePage = lazy(() => import('./pages/life/LifeSharePage')); const LifeBizPage = lazy(() => import('./pages/life/LifeBizPage')) /* 🏠 생활 견적(2026-10-24) */
const StayDetailPage = lazyPage(() => import('./pages/StayDetailPage')); registerBootPage('stayDetail', StayDetailPage.load); registerRoutePreload('stayDetail', StayDetailPage.load) // 숙소 카드·지도가 미리 받는다
const MyStaysPage = lazy(() => import('./pages/MyStaysPage'))
// 🛡️ 2026-06-12 (전수조사 4차 B-1): 숙소 Toss 결제 returnUrl 경량 confirm 페이지.
const StayCheckoutReturnPage = lazy(() => import('./pages/StayCheckoutReturnPage'))
// 🛡️ 2026-05-18: 인플루언서 referral 대시보드.
const InfluencerDashboardPage = lazy(() => import('./pages/InfluencerDashboardPage'))
// 🛡️ 2026-05-15: PC 랜딩 (자영업자/인플루언서/에이전시 영업)
const InfluencerOfferAcceptPage = lazy(() => import('./pages/InfluencerOfferAcceptPage')); const InfluencerJoinPage = lazy(() => import('./pages/InfluencerJoinPage')) // 🔑 2026-09-19 협업 코드 착지
const InterestListPage = lazy(() => import('./pages/InterestListPage'))
const CouponClaimPage = lazy(() => import('./pages/CouponClaimPage'))
const GiftClaimPage = lazy(() => import('./pages/GiftClaimPage')); const VoucherGiftReceivePage = lazy(() => import('./pages/VoucherGiftReceivePage')) // 🎁 2026-10-11 이용권 선물 받기

// User 페이지들
const AddressManagementPage = lazy(() => import('./pages/AddressManagementPage'))
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'))
const MyCouponsPage = lazy(() => import('./pages/MyCouponsPage'))
const MyReviewsPage = lazy(() => import('./pages/MyReviewsPage'))
const ReferralIndexPage = lazy(() => import('./pages/ReferralIndexPage'))
const MyCommissionsPage = lazy(() => import('./pages/MyCommissionsPage'))
const MyAppointmentsPage = lazy(() => import('./pages/MyAppointmentsPage'))
const MyGroupBuysPage = lazy(() => import('./pages/MyGroupBuysPage'))
const ProductDetailPage = lazyPage(() => import('./pages/ProductDetailPage')); registerBootPage('product', ProductDetailPage.load)

// Account (탈퇴) 페이지들
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const AccountDeleteWarningPage = lazy(() => import('./pages/AccountDeleteWarningPage'))
const AccountDeletedPage = lazy(() => import('./pages/AccountDeletedPage'))

const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const BlogListPage = lazyPage(() => import('./pages/BlogListPage')); registerBootPage('blog', BlogListPage.load)
const NewOpeningsPage = lazy(() => import('./pages/NewOpeningsPage')) // 🎉 우리 동네 새 가게(공공 인허가 개업 피드)
const AreaReportPage = lazy(() => import('./pages/AreaReportPage')) // 📊 상권 리포트(아웃리치 이메일 미끼·SEO)
// 🗺️ 2026-08-03 지역 허브 + 시/도·시군구 착지 페이지(도시별 색인). 롤백은 REGION_PAGES_ENABLED.
const RegionIndexPage = lazyPage(() => import('./pages/region/RegionIndexPage')); registerBootPage('region', RegionIndexPage.load)
const RegionPage = lazyPage(() => import('./pages/region/RegionPage')); registerBootPage('region', RegionPage.load)
const BrandPage = lazy(() => import('./pages/brand/BrandPage')) // 🏷️ 2026-10-17 프랜차이즈 브랜드 페이지(/brand/:slug)
const BlogDetailPage = lazyPage(() => import('./pages/BlogDetailPage')); registerBootPage('blogPost', BlogDetailPage.load)
const ReferralPage = lazy(() => import('./pages/ReferralPage'))
const RestaurantMapPage = lazyPage(() => import('./pages/RestaurantMapPage')); registerRoutePreload('map', RestaurantMapPage.load); registerBootPage('map', RestaurantMapPage.load) // 🗺️ 홈이 미리 받는다(lib/route-preload)
// 🏙️ 2026-07-04 상권관 랜딩(B2G 상권 패키지) — /local/:code (시군구/행정동 코드).
const LocalTownPage = lazy(() => import('./pages/LocalTownPage'))
// 🧾 2026-07-13 상권 쿠폰(영수증 페이백) — /district/:slug 랜딩 + /district/my 지갑 (한 컴포넌트)
const DistrictCouponPage = lazy(() => import('./pages/DistrictCouponPage'))
const UserGroupBuyCreatePage = lazy(() => import('./pages/UserGroupBuyCreatePage'))
const CommunityGroupBuyMessagesPage = lazy(() => import('./pages/CommunityGroupBuyMessagesPage'))

// Error 페이지들
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
// 🏬 운영자 몰 홈(`urdeal.kr/{슬러그}`) — 세션 ③-a. catch-all 직전 라우트라 lazy 로 둔다.
const MallHomePage = lazy(() => import('./pages/MallHomePage'))
const MallProductPage = lazy(() => import('./pages/MallProductPage'))
const ServerErrorPage = lazy(() => import('./pages/ServerErrorPage'))

// 약관 페이지들
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const InfluencerTermsPage = lazy(() => import('./pages/InfluencerTermsPage'))
const SellerTermsPage = lazy(() => import('./pages/SellerTermsPage'))
const GroupBuyTermsPage = lazy(() => import('./pages/GroupBuyTermsPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'))
const GDPRPage = lazy(() => import('./pages/GDPRPage'))
const AffiliatePage = lazy(() => import('./pages/AffiliatePage'))
const GbMarketplacePage = lazy(() => import('./pages/GbMarketplacePage'))
const FAQPage = lazyPage(() => import('./pages/FAQPage')); registerBootPage('faq', FAQPage.load)

// 🔧 Debug 페이지
const KakaoDebugPage = lazy(() => import('./pages/KakaoDebugPage'))

// Redirect component for old product URL
// 옛 `:id` 경로 → 정본 (앱 내부 이동용; 하드로드용 301 은 `shared/seo/consumer-redirects.ts`).
function PathRedirect({ base }: { base: string }) {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`${base}/${id}`} replace />;
}

// 🛡️ 2026-05-25 (migration 0278): 큐레이터 핀 SPA fallback
//   서버 /api/curator/:handle/p/:productId/redirect 가 302 안 될 때 (SPA pushState 라우팅)
//   client 에서 localStorage.affiliate_ref 직접 세팅 + 클릭 로그 호출 후 상품 페이지로 navigate.
function CuratorPinClientRedirect() {
  const { handle = '', productId = '' } = useParams<{ handle: string; productId: string }>()
  // best-effort: 서버에 클릭 추적 + ref 부여 redirect 위임 → 그래도 SPA 가 가로채면 fallback 으로 직접 navigate.
  // 가장 단순한 영구 방어: window.location.replace 로 서버 302 흐름 강제.
  if (typeof window !== 'undefined' && handle && productId) {
    window.location.replace(`/api/curator/${encodeURIComponent(handle)}/p/${encodeURIComponent(productId)}/redirect`)
    return null
  }
  return <Navigate to={`/products/${productId}`} replace />
}

// 로딩 컴포넌트 — 배경 투명, 최소 UI로 흰 화면 방지
// 🎨 2026-06-29 (대표 — 공통 페이지 로딩 애니메이션): 무채색 스피너 → UrDeal 브랜드 로더.
//   로고 호흡 + 진행 바 스윕(BrandLoader SSOT). 라우트 청크 로딩 순간 전용 — SSR/스켈레톤 첫페인트 불변.
// 🌑 2026-09-16 (대표 — "로딩도 좀 문제 있어보이고"): 도착이 다크 고정인 표면(/videos)은 청크 로더도
//   다크로. 라이트 사용자에게 [흰 로더 → 검은 로더] 점프가 났다(실측 531ms). 아래 forceLight 의 반대 방향.
const isDarkLoaderSurface = (pathname: string) => /^\/videos(\/|$)/.test(pathname)
const PageLoader = () => <BootFirstScreenLoader forceDark={isDarkLoaderSurface(window.location.pathname)} />

// 🚑 2026-07-10 [UNLOCK_LOADING] (로딩 전수조사): 대시보드(/seller·/admin)·유어애즈(/ads) 전용
//   라이트 로더 — worker 가 이 표면들의 #root 를 라이트 #F4F5F7 placeholder 로 깔아주는데, Suspense
//   fallback 이 테마 추종 PageLoader(다크 토글 사용자는 다크 로고)라 [라이트 빈화면 → 다크 로더 →
//   라이트 대시보드] 색 점프가 났음. 라이트 고정 로더로 색을 맞춘다.
//   (대시보드는 라이트 고정 규칙 — dark: variant 금지 표면이라 forceLight 가 맞는 동작.)
const DashboardLoader = () => (
  <div style={{ background: '#F4F5F7' }}><BrandLoader fullScreen forceLight /></div>
)
const isDashboardLoaderSurface = (pathname: string) => /^\/(seller|admin|ads)(\/|$)/.test(pathname)


// ✅ Router 내부에서 실행될 컴포넌트
function AppContent() {
  // ✅ authInitialized ref: 중복 초기화 방지 (StrictMode 이중 마운트 대비)
  const authInitialized = useRef(false)

  // 🔑 2026-07-02 (인증 회복력 P1a — 대표 "상품등록 흰화면"): 역할 토큰 proactive refresh 를 App 전역에.
  //   기존엔 대시보드 레이아웃(Seller/Admin)에서만 갱신 → 사업자 유저가 소비자 앱(유어샵) 체류 중엔
  //   seller_token 이 안 갱신돼, 만료 후 '상품등록' 진입 시 401 폭포 → 흰화면. 훅은 토큰 없으면 no-op(안전),
  //   refresh inflight 락으로 대시보드 중복마운트도 무해. 유어샵에 있어도 셀러 토큰이 신선하게 유지됨.
  useTokenAutoRefresh('seller')

  // 🛡️ 2026-05-01 (D fix): 카카오 OAuth callback URL → localStorage 처리는
  //   src/utils/auth-callback-bootstrap.ts 로 이전됨 (main.tsx 에서 React mount 전 동기 호출).
  //   render 함수 안에서 localStorage / history 를 건드리지 않음 — pure render.

  // 🛡️ 2026-05-01: 카카오 콜백 에러 파라미터 처리 — 무한 로딩 방지.
  //   sync/callback 이 세션 쿠키 발급 실패 / 카카오 토큰 교환 실패 등으로 ?error=... 부착 시
  //   사용자에게 명시적 토스트 + URL 정리. 묵음 실패 → 무한 스피너 시나리오 차단.
  // 🆕 2026-06-29 퍼널 계측: 앱 진입(세션당 1회, 익명) — DAU/리텐션 기준점.
  useEffect(() => { trackFunnel('app_open') }, [])

  // 📡 2026-07-05 유입 소스 어트리뷰션: ?src=(시설물 QR)/utm_source first-touch 30일 캡처 +
  //   로그인 상태면 유저 귀속(claim, 멱등). 랜딩→가입→첫구매 퍼널의 클라 시작점 (lib/acquisition.ts).
  useEffect(() => {
    import('@/lib/acquisition').then(({ captureAcquisitionSource, claimAcquisitionIfLoggedIn }) => {
      captureAcquisitionSource()
      import('@/utils/auth').then(({ isLoggedInSync }) => {
        const loggedIn = isLoggedInSync()
        claimAcquisitionIfLoggedIn(loggedIn)
        // 📡 2026-07-13 (데이터 감사 2단계): 익명 유입 클릭 → 유저 귀속(멱등, 완결고리 '유입' 노드).
        import('@/utils/affiliate-track').then(({ bindInflowClicksIfLoggedIn }) => {
          bindInflowClicksIfLoggedIn(loggedIn)
        }).catch(() => {})
      }).catch(() => {})
    }).catch(swallow('app:acquisition-import'))
  }, [])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const errorCode = urlParams.get('error')
    if (!errorCode) return

    const errorMessages: Record<string, string> = {
      session_cookie_failed: '로그인 세션 발급에 실패했어요. 다시 시도해주세요.',
      kakao_auth_failed: '카카오 인증에 실패했어요. 다시 시도해주세요.',
      kakao_sync_failed: '카카오 로그인에 일시적 문제가 발생했어요. 다시 시도해주세요.',
      database_error: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
      firebase_config_error: '인증 설정 오류가 발생했어요. 관리자에게 문의해주세요.',
      env_missing: '서버 환경 설정이 누락됐어요. 관리자에게 문의해주세요.',
      no_code: '카카오 인증 코드를 받지 못했어요. 다시 시도해주세요.',
      oauth_state_mismatch: '인증 정보가 만료됐어요. 다시 시도해주세요.',
      oauth_state_expired: '로그인 세션이 만료됐어요. 처음부터 다시 시도해주세요.',
    }
    const msg = errorMessages[errorCode] || `로그인 중 오류가 발생했어요 (${errorCode})`

    import('@/hooks/useToast').then(({ toast }) => toast.error(msg)).catch(swallow('app:oauth-error-toast-import'))

    // 잘못된 세션 흔적 정리 — 모든 카카오 콜백 에러에서 localStorage 인증 흔적 제거.
    //   세션이 발급 안 됐는데 user_id 만 stale 하게 남아있으면 ProtectedRoute 통과 → 401 무한 루프.
    //   database_error 도 포함 (사용자 신고: toss_user_id 컬럼 누락 → INSERT 실패 → /user/profile redirect).
    const authErrors = [
      'session_cookie_failed', 'kakao_auth_failed', 'kakao_sync_failed',
      'database_error', 'firebase_config_error', 'no_code', 'oauth_state_mismatch',
      'env_missing', 'oauth_state_expired',
    ]
    const isKakaoOAuthError = errorCode.startsWith('kakao_oauth_')
    if (authErrors.includes(errorCode) || isKakaoOAuthError) {
      try {
        localStorage.removeItem('user_type')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_name')
        localStorage.removeItem('user_email')
        localStorage.removeItem('user_profile_image')
        localStorage.removeItem('session_login')
      } catch { /* ignore */ }
      // 🛡️ 2026-05-08: 보호 경로 + OAuth 에러 시 history 를 '/' 로 치환했던 로직 제거.
      // 부작용으로 브라우저 뒤로가기가 이전 페이지가 아닌 메인으로 점프하는 회귀 버그 발생.
      // localStorage 인증 상태가 이미 위에서 클리어되었으므로, 다음 render 에서 ProtectedRoute 가
      // 자연스럽게 /login 으로 redirect 하면서 history 스택은 유지됨.
    }

    urlParams.delete('error'); urlParams.delete('detail')
    const clean = urlParams.toString()
    window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname)
  }, [])

  // 🛡️ 2026-05-01: firebase_token URL 처리 useEffect REMOVED.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.has('firebase_token')) {
      p.delete('firebase_token')
      const clean = p.toString()
      window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname)
    }
  }, [])

  // 🛡️ 2026-05-02: 카카오 로그인 직후 토스트 제거 (사용자 요청).
  //   이전: '${name}님으로 로그인됐어요. 다른 계정이면 마이페이지에서 전환할 수 있어요.'
  //   sessionStorage 키는 잔존 가능성 있어 cleanup 만 유지.
  useEffect(() => {
    try { sessionStorage.removeItem('ur_kakao_login_welcome') } catch { /* */ }
  }, [])

  // 🛡️ 2026-05-27 (P2 referral): URL ?invite={inviterUserId} 감지 → localStorage 저장.
  //   친구가 초대 링크로 진입 → 가입 (KakaoCallback) 시 referral_tree 등록.
  //   24시간 유효 (timestamp). self-invite 는 KakaoCallback 에서 차단.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const inviter = params.get('invite')
      if (inviter && /^\d+$/.test(inviter)) {
        localStorage.setItem('pending_referral_inviter', JSON.stringify({ id: inviter, ts: Date.now() }))
      }
      // 📣 2026-08-09: 루트 등 상세 밖 랜딩의 ?ref= 도 유입 클릭(inflow_clicks)에 적재.
      //   affiliate.routes 가 발급하는 share_url(`urdeal.kr/?ref=`)·캠페인 완료화면 링크가 지금까지
      //   미적재되던 갭. 유입 기록만이며 어필리에이트 구매 귀속(affiliate_ref 저장)은 종전과 동일
      //   (상세 페이지들의 storeAffiliateRef 만) — 머니 경로 무접촉. 캠페인 코드(?c=)는 함께 태워진다.
      captureInflowRef(params.get('ref') || params.get('aff'))
    } catch { /* ignore */ }
  }, [])

  // ✅ Auth 초기화 — KR 은 Firebase 미사용, 글로벌만 Firebase 초기화.
  useEffect(() => {
    if (authInitialized.current) return
    authInitialized.current = true

    const userType = localStorage.getItem('user_type')

    // 🔥 2026-08-04 (대표 승인 — Firebase 완전 제거): 외부 인증 SDK 초기화가 사라졌다.
    //   KR 은 2026-05-01 부터 카카오 세션 쿠키 only 였고, GLOBAL 분기는 미런칭·폐기(#804)라
    //   도달 경로가 없었다. ⇒ 어떤 경우든 즉시 ready.
    void userType
    useAuthKR.getState().setAuthReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 🔄 다중 탭 동기화
  useMultiTabSync()

  const location = useLocation()
  // 🚦 2026-10-12 (대표 "처음 접속하는 디바이스 유저는 너무 느려"): 아래 넷은 **조건이 맞을 때만** 마운트한다.
  //   넷 다 lazy 지만 청크가 `app-components`(151KB)+`lucide`(51KB)에 들어 있어, 마운트만 해도 첫 방문자가
  //   **보지도 않는 화면**을 위해 그 봉투를 통째로 받았다(느린 4G 재생 실측 — 엔트리 실행 직후 2차 다운로드).
  //   판정은 각 컴포넌트가 스스로 하던 것과 **같은 조건**이다(안에서도 그대로 다시 본다 — 여기는 문지기일 뿐).
  const qs = location.search
  const shellNeed = {
    onboarding: qs.includes('new=1'),                       // OnboardingTrigger: ?new=1 일 때만 모달
    restore: qs.includes('restorable=1'),                   // RestoreAccountModal: ?restorable=1 일 때만
    push: (() => { try { return !!(localStorage.getItem('user_id') || localStorage.getItem('seller_id') || localStorage.getItem('admin_id') || localStorage.getItem('agency_id')) } catch { return false } })(),
    sideBanner: typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)').matches, // `hidden lg:flex` — 폰에선 안 보인다
  }
  // 🧭 2026-06-10 페이지 전환 페이드 — 첫 로드(LCP)는 제외, 라우트 이동부터 적용.
  // 🚑 2026-07-10 [UNLOCK_LOADING]: 기준을 location.key → pathname 변경 여부로. key 기준이면 쿼리-전용
  //   내비(setSearchParams — 정렬/카테고리 칩)가 첫 내비일 때 클래스가 처음 붙으며 전체 페이드가 재생됨
  //   (아래 div key 가 pathname 인 지금은 리마운트 없이 class 추가만으로 애니메이션이 1회 발화하는 아티팩트).
  //   실제 경로 이동이 한 번이라도 있으면 클래스 상시 유지 — 애니메이션은 리마운트(key=pathname 변경)가 트리거.
  const initialPathRef = useRef(location.pathname)
  const pathChangedRef = useRef(false)
  if (location.pathname !== initialPathRef.current) pathChangedRef.current = true
  const pageEnterCls = pathChangedRef.current ? 'ur-page-enter' : undefined

  // 🛡️ 2026-05-27 v5 [UNLOCK_LOADING] (Lighthouse 100점 시도, 사용자 명령):
  //   idle prefetch 전체 제거 — Lighthouse 메인 페이지 측정 시 lazy chunk 동시 fetch → 점수 ↓.
  //   trade-off: 탭 클릭 시 chunk download wait 200-500ms (이전엔 즉시 navigation).
  //   사용자가 메인에서 머무는 동안 prefetch 발생 → 사용자 체감 wait 0 의 효과 포기.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const preload = () => {
      /* idle prefetch 제거 — 탭 클릭 시 lazy load */
      // 🛡️ 2026-05-27 (영구 fix — /host/new fall through 사용자 보고):
      //   로그인 사용자가 BottomNav 의 유어샵 클릭 시 cache 없으면 /u/me → dashboard → /host/new.
      //   idle 시 background 로 dashboard 호출 → linked_seller_username / user_handle localStorage 채움.
      //   다음 유어샵 클릭 즉시 /profile/{username} 또는 /u/{handle} 직행 (0 RTT).
      //   5분 이내 이미 cache 있으면 skip — 불필요한 API 호출 방지.
      // 🛡️ 2026-06-30 (무한 리다이렉트 루프 근본수정): 유어샵/큐레이터 프리페치는 *소비자(user) 세션* 전용.
      //   /api/curator/me/dashboard 는 consumer 인증 필요 → admin/seller 토큰만으론 무조건 401.
      //   admin-only 사용자가 이 401 을 유발해 리다이렉트 루프가 났다. 소비자 세션(user_id/session_login)
      //   있을 때만 프리페치 — 사업자 유저(seller)도 소비자 계정이 있어 user_id 보유하므로 유어샵 워밍 정상.
      //   (api.ts 의 '토큰 있으면 소비자 401 로 대시보드 리다이렉트 안 함' 가드와 이중 방어.)
      const hasConsumerSession = !!(localStorage.getItem('user_id') || localStorage.getItem('session_login'))
      if (hasConsumerSession) {
        const lastWarm = Number(localStorage.getItem('linkshop_dashboard_warm_ts') || 0)
        if (Date.now() - lastWarm > 5 * 60_000) {
          import('@/lib/api').then(m => {
            m.default.get('/api/curator/me/dashboard').then((r: { data: { linked_seller?: { username?: string }; handle?: string | null } }) => {
              try {
                if (r.data?.linked_seller?.username) localStorage.setItem('linked_seller_username', r.data.linked_seller.username)
                if (r.data?.handle) localStorage.setItem('user_handle', r.data.handle)
                localStorage.setItem('linkshop_dashboard_warm_ts', String(Date.now()))
              } catch { /* quota / storage 손상 */ }
            }).catch(() => { /* 401 / 네트워크 — silent */ })
          }).catch(() => {})
        }
      }
    }
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
    if (ric) {
      ric(preload, { timeout: 3000 })
    } else {
      const t = setTimeout(preload, 1500)
      return () => clearTimeout(t)
    }
  }, [])

  // 🚪 2026-10-15 하단 탭 화면 코드를 첫 화면 뒤(load + 한가 + 3초)에 미리 받는다 — 탭을 처음 눌러도 로더가 안 뜨게(src/lib/tab-warm.ts).
  //   그 모듈은 **따로** 받는다 — 정적으로 묶으면 대시보드(마이·어드민·에이전시) 첫 화면까지 +1.7KB 가 실렸다(surface-budgets).
  //   그 모듈조차 첫 화면 **뒤**(load + 한가)에 받는다 — 마운트 즉시 받으면 홈 첫 화면 청크가 26 → 27 이 됐다(surface-chunk-runtime).
  //   개발 서버에선 안 한다 — vite dev 가 그 페이지들의 의존성을 새로 찾아 페이지를 통째로 다시 불러오고, 그 사이 React 가
  //   두 벌이 되어 `useState` of null 이 났다(2026-10-15 render smoke). 미리받기는 운영에서만 의미가 있다.
  useEffect(() => { if (import.meta.env.DEV) return; let stop: (() => void) | undefined; let off = false; const stopLoad = runAfterLoad(() => { import('./lib/tab-warm').then((m) => { if (!off) stop = m.startTabWarm(location.pathname) }).catch(() => {}) }); return () => { off = true; stopLoad(); stop?.() } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 네이티브 앱 + 모바일 브라우저: 페이지에 따라 상태바 스타일 / theme-color 변경
  useEffect(() => {
    // 화이트 테마 페이지 (CLAUDE.md 정책)
    const lightPages = ['/browse', '/vouchers', '/checkout', '/my-orders', '/account/', '/cart',
      '/referral/', '/map', '/restaurant-map', '/products/', '/wishlist', '/my-vouchers', '/my-gifticons', '/search', '/group-buy', '/community-group-buy']
    const isLight = lightPages.some(p => location.pathname === p || location.pathname.startsWith(p))

    // 1. Capacitor 네이티브 앱 — StatusBar 플러그인
    //    웹에선 부르지 않는다 — 앱 SDK 청크(capacitor)를 매 화면 받던 것(2026-10-13 유어샵 실측 4.38초).
    if (isNativeShell()) import('./lib/native').then(({ setStatusBarStyle }) => {
      setStatusBarStyle(isLight ? 'light' : 'dark')
    }).catch((err) => { if (import.meta.env.DEV) console.warn('[App] setStatusBarStyle failed:', err) })

    // 2. 모바일 브라우저 — <meta name="theme-color"> 동적 update
    //    Chrome/Samsung/Edge 가 status bar 배경색을 이 값으로 칠함.
    //    iOS Safari 는 black-translucent 메타라 영향 X (페이지 배경 그대로).
    try {
      // index.html 의 media-query 메타 2개를 dynamic 단일 메타로 override
      const existing = document.querySelectorAll('meta[name="theme-color"]')
      existing.forEach(el => {
        // dynamic override 마크 — re-render 시 같은 노드 재사용
        if (el.getAttribute('data-dynamic') !== '1') el.remove()
      })
      let dynamic = document.querySelector('meta[name="theme-color"][data-dynamic="1"]') as HTMLMetaElement | null
      if (!dynamic) {
        dynamic = document.createElement('meta')
        dynamic.setAttribute('name', 'theme-color')
        dynamic.setAttribute('data-dynamic', '1')
        document.head.appendChild(dynamic)
      }
      dynamic.setAttribute('content', isLight ? '#F8F7FC' : '#11141C') // 🎨 2026-07-19 지시서 §6 — 라이트 #F8F7FC / 다크 #11141C
    } catch { /* SSR / 브라우저 미지원 */ }
  }, [location.pathname])

  // 🛡️ 2026-05-25 (migration 0278): 큐레이터 자동 핀 (Phase 1-B).
  //   비로그인 → PinButton 클릭 → localStorage 'pending_pin_product_id' + 카카오 로그인.
  //   로그인 후 App.tsx mount 시 pending 검사 → 자동 핀 추가 + toast.
  //   1탭 UX 의 핵심 — 로그인 후 사용자가 따로 클릭하지 않아도 의도 보존.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (cancelled) return
        const raw = localStorage.getItem('pending_pin_product_id')
        if (!raw) return
        const pid = Number(raw)
        if (!Number.isFinite(pid) || pid <= 0) {
          localStorage.removeItem('pending_pin_product_id')
          return
        }
        const { useAuthStore } = await import('@/client/stores/auth.store')
        const state = useAuthStore.getState() as any
        if (!state?.isAuthenticated || !state?.user) return // 아직 미인증 → 다음 mount 까지 보존
        localStorage.removeItem('pending_pin_product_id')
        const { curatorApi } = await import('@/features/curator/api/curator-api')
        const { toast } = await import('@/hooks/useToast')
        const res = await curatorApi.addPin(pid)
        if (res.success) {
          if (res.handle_just_created && res.handle) {
            toast.success(`🎉 내 유어샵 생성! /u/${res.handle} — 첫 핀이 추가됐어요`)
          } else {
            toast.success('📌 핀이 추가되었어요')
          }
        } else if (res.code === 'ALREADY_PINNED') {
          toast.info('이미 핀에 있는 상품이에요')
        }
      } catch { /* silent — UX 방해 X */ }
    })()
    return () => { cancelled = true }
  }, [])

  // 🧢 전체 화면 주소 목록·판정은 lib/consumer-chrome.ts(SSOT) — 부팅 전 PC 네비 준비(warmDesktopChrome)도 같은 함수를 쓴다.
  const fullScreen = isFullScreenPath(location.pathname)
  // 🏭 유통스타트 B2B(도매몰/제조사)는 소비자 BottomNav/TopNav 미표시 — 별도 도메인·업태.
  //   컴포넌트가 자기-차단에도 사용 → 1차(여기서 마운트 차단) + 2차(컴포넌트 self-guard) 이중 방어.
  // 🏁 2026-06-26 [UNLOCK_LOADING] (대표 결정 — "특정 링크로 들어온 방문자는 네비 숨김"):
  //   /u/{handle}?embed=1 로 진입하면 standalone 매장처럼 상/하단 네비를 숨긴다. 한 번 본 플래그는
  //   sessionStorage 로 세션 유지(상품 클릭→뒤로 등 인앱 이동에도 깨끗) + 유어샵 표면(/u·/profile·/s)에서만
  //   적용 → 방문자가 홈 등으로 나가면 네비 복귀(갇힘 방지). 기존 hideBottomNav 조건은 불변(additive).
  const embedFlag = (() => {
    try {
      const sp = new URLSearchParams(location.search)
      if (sp.get('embed') === '1') { sessionStorage.setItem('ur_linkshop_embed', '1'); return true }
      return sessionStorage.getItem('ur_linkshop_embed') === '1'
    } catch { return new URLSearchParams(location.search).get('embed') === '1' }
  })()
  const embedHideNav = embedFlag && /^\/(u|profile|s)(\/|$)/.test(location.pathname)
  // 🏬 2026-08-02 — **운영자 몰 표면(`urdeal.kr/{슬러그}`)에서 유어딜 크롬 전부 차단.**
  //   대표 UX 기준 ⑤ *"본진 입구 금지"*. `MallHomePage` 는 그 기준을 지키려고 `powered by 유어딜`
  //   조차 **클릭 안 되는 문자열**로 두는데(:188), 정작 그 페이지 아래에 유어딜 5탭 하단바가,
  //   PC 에선 상단 네비와 사이드배너까지 붙고 있었다. 페이지가 아무리 조심해도 **셸이 새고 있었다.**
  //   ⇒ 판정은 `isMallSurfacePath`(shared SSOT, 워커와 같은 규칙) 하나로.
  const mallSurface = isMallSurfacePath(location.pathname)
  const hideBottomNav = consumerChromeHiddenByPath(location.pathname) || embedHideNav
    || mallSurface
  // 🗺️ 2026-06-20 (대표 — 홈=리스트 / 지도는 버튼 이동): 지도 페이지(/restaurant-map)만 h-screen 자체관리
  //   풀스크린(바텀시트가 하단 담당) → main 하단 네비 여백 제외. 홈(/)=리스트는 일반 페이지(여백 필요).
  const mapFullScreen = location.pathname === '/map' || location.pathname === '/restaurant-map'

  return (
    <>
      <FrameWrapper>
        {/* 🚑 2026-07-10: 대시보드/애즈는 라이트 고정 DashboardLoader — worker 라이트 placeholder 와 색 정합. */}
        <Suspense fallback={
          isDashboardLoaderSurface(location.pathname) ? <DashboardLoader />
            : <PageLoader />
        }>
          {/* 📐 2026-05-03: PC 풀너비 활성화 — 모바일 폭 강제 제거.
              각 페이지가 자체 `ur-content-narrow/medium/wide/full` 토큰으로 max-width 관리.
              MobileAppLayout 의 `data-mobile-only="true"` (라이브/쇼츠) 페이지는 여전히 430px 액자 유지. */}
          <div className="min-h-dvh">
          {/* 📐 2026-05-03: PC 상단 네비게이션 — 모바일 BottomNav 의 PC 대응. lg+ 에서만 표시. */}
          {!hideBottomNav && <ConsumerTopChrome />}
          <div className="flex-1">
          {/* 🗑️ 2026-06-20 (대표 요청): InAppBrowserBanner 미마운트(노이즈) — 카카오 로그인은 카톡 인앱에서도
              정상. 2026-07-23: 카톡 자동 외부-redirect 도 제거(autoRedirectKakaoToExternal=no-op) → 모든 인앱은
              배너/팝업/강제이동 없이 렌더, 기능별 제한(카메라 등)만 InAppFeatureBlockedModal 이 사용 시점 안내.
              복원: `import InAppBrowserBanner from './components/InAppBrowserBanner'` 후 여기 렌더. */}
          {/* 🗑️ 2026-06-17 (사용자 요청): 앱 설치 팝업(PWAInstallPrompt) 제거 */}
          {shellNeed.onboarding && <Suspense fallback={null}><OnboardingTrigger /></Suspense>}
          {shellNeed.restore && <Suspense fallback={null}><RestoreAccountModal /></Suspense>}
          {/* 📜 2026-07-05 (대표 "들어오자마자 나오면 안 되지 — 자연스럽게"): 약관 동의 차단 모달(TermsConsentGate)
              제거. 소비자 동의 = LoginPage 간주 고지(제5조) + 가입 시점 1회 서버 기록(kakao.routes isNewUser →
              terms_agreements). 개정 재동의가 필요해지면 /api/terms/status 로 비차단 배너를 붙이는 것이 후속안. */}
          <OfflineBanner />
          <ConfirmHost />
          <ScrollToTop />
          {shellNeed.push && <Suspense fallback={null}><PushNotificationSetup /></Suspense>}
          {/* 🛡️ 2026-06-04 (사용자 신고 — 영구 수정): 모바일 BottomNav(fixed h-14 lg:hidden)가
              콘텐츠 하단을 가림. BottomNav 표시 페이지에만 하단 여백(높이+safe-area) 예약.
              hideBottomNav 페이지(결제/풀스크린/대시보드 등)는 여백 0 — 자체 레이아웃 보존. */}
          {/* 🖥️ 2026-06-20: 하단 네비가 이제 PC(lg+) 액자에도 표시되므로 lg:pb-0 제거 — 모든 뷰포트에서 하단 여백 예약. */}
          <main id="main-content" className={(hideBottomNav || mapFullScreen) ? undefined : 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'}>
          {/* 🚑 2026-07-10 [UNLOCK_LOADING] (대표 신고 "로딩 → 새로고침 → 다시 로딩" — 라이브 재현으로 특정):
              key 를 location.key → location.pathname 으로. location.key 는 **쿼리만 바뀌는
              setSearchParams(정렬/카테고리/브랜드 칩, /vouchers 첫 진입 자동 카테고리 선택 등)에도 매번
              새 값** → 페이지 전체 리마운트 + enter 페이드 재생 + (리마운트로 SSR 시드 미매칭 →) 풀스크린
              로더 재등장 — "방금 뜬 페이지가 리셋되고 다시 로딩"의 정체. pathname keying 은 실제 페이지
              이동(06-10 페이드 의도)에만 리마운트/페이드, 쿼리 변경은 제자리 갱신(각 페이지 effect 가
              searchParams deps 로 이미 처리 — 06-05 "화면 비우지 않고 백그라운드 교체" 설계 복원). */}
          <ErrorBoundary key={location.pathname}>
          <div key={location.pathname} className={pageEnterCls}>
          <Routes>
            {/* Public 페이지들 */}
            <Route path="/introduce" element={<IntroducePage />} />
            <Route path="/creators/apply" element={<CreatorApplyPage />} /><Route path="/creators/start" element={<CreatorStartPage />} />
            {CAMPAIGN_SIGNUP_ENABLED && <Route path="/campaign/:code" element={<CampaignApplyPage />} />}{/* 📣 캠페인 신청 — 기존 가입과 게이트 분리(이 플래그는 이 라우트만 가림) */}
            <Route path="/about" element={<AboutServicePage />} /><Route path="/about/print" element={<AboutPage />} /><Route path="/partners" element={<PartnersPage />} /><Route path="/creators" element={<Navigate to="/influencer" replace />} /><Route path="/mall-admin" element={<MallAdminPage />} />{/* 🏬 몰 운영자 콘솔 — 게이트 없음(서버가 operator_user_id 로 403 = fail-closed 는 서버에) */}
            <Route path="/" element={<HomeRoute />} />{/* 🖥️ lg+ = 당근 PC 홈 / 그 외 = 지도(홈=지도, 대표 2026-07-15) */}
            {/* 🧨 2026-10-11 도매몰 철거(대표 "도매몰 잔해들은 아예 다 삭제해줘") — /wholesale/* 라우트 42줄 제거.
                공구 서비스(운영자 몰, `/:mallSlug`)는 별개 레일이라 무접촉 — 계획: docs/design/wholesale-teardown-plan.md */}
            <Route path="/partnership" element={<PartnershipInquiryPage />} />
            {/* 🗑️ 2026-07-07 라이브커머스 제거: /shorts 라우트 제거 */}
            <Route path="/v/:code" element={<VoucherVerifyPage />} />
            {/* 🛡️ 2026-04-28: 선물 받기 페이지 (인증 불필요) */}
            <Route path="/gift/claim/:token" element={<GiftClaimPage />} />
            <Route path="/gift/v/:token" element={<VoucherGiftReceivePage />} />
            <Route path="/store/stats/:productId" element={<StoreStatsPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/vouchers" element={<VouchersPage />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/urshorts" element={<UrShortsBrowsePage />} />
            <Route path="/experience" element={<ExperienceCampaignsPage />} />
            {/* 🆕 통합 마케팅 서비스(가칭) — 3번째 서비스(도매몰처럼 자체 surface). /ads = 공개 랜딩, /ads/dashboard = 입점 대시보드 */}
            <Route path="/ads" element={<ErrorBoundary><MarketingLandingPage /></ErrorBoundary>} />
            <Route path="/ads/login" element={<ErrorBoundary><MarketingLoginPage /></ErrorBoundary>} />
            <Route path="/ads/signup" element={<ErrorBoundary><MarketingSignupPage /></ErrorBoundary>} />
            <Route path="/ads/account" element={<ErrorBoundary><MarketingAccountPage /></ErrorBoundary>} />
            <Route path="/ads/forgot" element={<ErrorBoundary><MarketingForgotPage /></ErrorBoundary>} />
            <Route path="/ads/reset" element={<ErrorBoundary><MarketingResetPage /></ErrorBoundary>} />
            <Route path="/ads/terms" element={<ErrorBoundary><MarketingLegalPage /></ErrorBoundary>} />
            <Route path="/ads/privacy" element={<ErrorBoundary><MarketingLegalPage /></ErrorBoundary>} />
            <Route path="/ads/unlock" element={<ErrorBoundary><MarketingUnlockPage /></ErrorBoundary>} />
            <Route path="/ads/kakao" element={<ErrorBoundary><MarketingKakaoCallbackPage /></ErrorBoundary>} />
            <Route path="/ads/dashboard" element={<ErrorBoundary><MarketingDashboardPage /></ErrorBoundary>} />
            {/* 🛡️ 2026-05-23: 교환권 전용 detail 페이지 (deal 결제). voucher 와 group-buy UI 분리. */}
            <Route path="/vouchers/:id" element={<VoucherDetailPage />} />
            {/* 🍽️ 2026-08-11: BrowsePage 로는 이용권이 구조적으로 0건이라 홈 카테고리 필터(정본)로. 서버 301 은 consumer-redirects.ts */}
            <Route path="/meal-vouchers" element={<Navigate to="/?category=meal_voucher" replace />} />
            {/* 🗺️ 2026-07-03 (대표 결정): /group-buy 은퇴 → 홈 리다이렉트. 기존 15+ 링크·북마크·SEO 모두 홈으로 흡수. */}
            <Route path="/group-buy" element={<Navigate to="/" replace />} />
            <Route path="/group-buy/confirm-payment" element={<GroupBuyConfirmPaymentPage />} />{/* :id 보다 먼저 — 더 구체적인 path */}
            <Route path="/pass/:id" element={<GroupBuyDetailPage />} />{/* 🎟️ 이용권 상세 정본(2026-09-16) */}
            <Route path="/group-buy/:id" element={<PathRedirect base="/pass" />} />{/* 지우면 앱 안에서 갈 곳이 없다(301 은 하드로드만) */}
            {/* 🏙️ 2026-07-04 상권관 랜딩 — 지역코드 하나로 그 상권의 동네딜+체험단 전체(B2G QR/링크 진입). */}
            <Route path="/local/:code" element={<LocalTownPage />} />
            <Route path="/district/:slug" element={<ErrorBoundary><DistrictCouponPage /></ErrorBoundary>} />
            {/* 🛡️ 2026-05-18: 숙소 공구 사용자 페이지 — PR 3/6 */}
            <Route path="/stays" element={<StaysSearchPage />} /><Route path="/soon" element={<SoonPage />} />
            <Route path="/life" element={<LifePage />} /><Route path="/life/pro" element={<LifeProPage />} /><Route path="/life/pro/requests/:id" element={<LifeProRequestPage />} /><Route path="/life/q/:token" element={<LifeSharePage />} /><Route path="/life/biz/:id" element={<LifeBizPage />} />
            <Route path="/life/request/:category" element={<LifeRequestFormPage />} /><Route path="/life/requests" element={<ProtectedRoute requireUser><LifeMyRequestsPage /></ProtectedRoute>} /><Route path="/life/requests/:id" element={<ProtectedRoute requireUser><LifeRequestDetailPage /></ProtectedRoute>} />
            {/* 🛡️ 2026-06-12 (B-1): Toss returnUrl confirm 페이지 — :id 보다 구체적 path (정적 세그먼트 우선 매칭) */}
            <Route path="/stays/checkout-return" element={<ProtectedRoute requireUser><StayCheckoutReturnPage /></ProtectedRoute>} />
            <Route path="/stays/:id" element={<StayDetailPage />} />
            <Route path="/my-stays" element={<MyStaysPage />} />
            <Route path="/influencer/dashboard" element={<InfluencerDashboardPage />} />
            {/* 🛡️ 2026-05-15: B2B 랜딩 — PC 풀 너비, 영업/모집용. ⚠️ 2026-07-29: `/influencer` 가 중복 등록돼 이 랜딩이 두 달간 도달 불가였다(대시보드가 선점) → 대시보드를 /influencer/dashboard 로 이사. 가드: check-duplicate-routes */}
            {/* 🗑️ 2026-09-16 (대표 "지워줘") — 랜딩은 `/partners` 하나다. 앱 안 이동용 폴백(서버는 301). */}
            <Route path="/business" element={<Navigate to="/partners" replace />} />
            <Route path="/influencer" element={<CreatorsPage />} />{/* 📣 2026-10-31 대표 "인플루언서용은 하나로 통일 · /influencer 로" — 옛 /creators 는 301 */}<Route path="/i/offer/:token" element={<InfluencerOfferAcceptPage />} /><Route path="/i/join/:code" element={<InfluencerJoinPage />} />
            {/* 🕳️ 2026-09-27: 셀러 라우트 셋(prospects · proxy-products · plus-friend-guide)을 아래
                SellerRoutes 표로 이사했다 — 여기 홀로 있던 탓에 마이 시트가 열 수 없었다(시트가 그 표를
                렌더한다). 같은 Routes 안이고 경로·element 가 그대로라 대시보드 동작은 불변.
                되돌리려면 seller.routes.tsx 의 세 줄을 도로 이 자리로 옮긴다. */}
            {/* 🗑️ 2026-07-07 라이브커머스 제거: /live·/live/recap·/live/:streamId 라우트 제거 */}
            <Route path="/products/:id" element={<ErrorBoundary><ProductDetailPage /></ErrorBoundary>} />
            {/* Redirect old single product URL to plural */}
            <Route path="/product/:id" element={<PathRedirect base="/products" />} />
            <Route path="/search" element={<SearchPage />} />

            {/* 🛡️ 큐레이터 유어샵(0278). /creator = 소개 콘솔 정식 URL, /u/me/earnings 는 하위호환 alias. */}
            <Route path="/creator" element={<ProtectedRoute requireUser><ErrorBoundary><CuratorEarningsPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/u/me/earnings" element={<ProtectedRoute requireUser><ErrorBoundary><CuratorEarningsPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/u/me/manage" element={<ProtectedRoute requireUser><ErrorBoundary><UShopManagePage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/u/me/add" element={<ProtectedRoute requireUser><ErrorBoundary><LinkshopPinPicker /></ErrorBoundary></ProtectedRoute>} />
            {/* 🛡️ 2026-05-25: /u/me → 본인 공개페이지 자동 redirect */}
            <Route path="/u/me" element={<ProtectedRoute requireUser guest={<GuestUrShopPage />}><ErrorBoundary><UMeRedirectPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/u/:handle" element={<ErrorBoundary><CuratorPage /></ErrorBoundary>} />
            {/* SPA fallback: /u/:handle/p/:productId 클릭 시 서버 302 가 작동 안 할 때 ref 부여 후 navigate. */}
            <Route path="/u/:handle/p/:productId" element={<CuratorPinClientRedirect />} />

            {/* 🛡️ 2026-05-25 호스팅 (migration 0280) */}
            <Route path="/host" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><HostingPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/host/new" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><HostingNewPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/g/:invite_code" element={<ErrorBoundary><HostInvitePage /></ErrorBoundary>} />

            {/* 🛡️ 2026-05-25 반품 회수 송장 추적 */}
            <Route path="/my-returns" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><MyReturnsPage /></ErrorBoundary>
              </ProtectedRoute>
            } />

            {/* Public Auth 페이지들 */}
            <Route path="/login" element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            } />
            <Route path="/join" element={<JoinChoicePage />} />
            <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />
            <Route path="/auth/kakao/sync/callback" element={<KakaoCallbackPage />} />
            <Route path="/auth/kakao/consent/callback" element={<KakaoConsentCallbackPage />} />
            <Route path="/auth/kakao/link/callback" element={<KakaoLinkCallbackPage />} />

            {/* Seller 페이지들 (공개 + 보호) — src/routes/seller.routes.tsx */}
            {/* ⚡ 2026-10-13 `/seller/*` 는 하위 트리로(손님 이동마다 셀러 71경로를 맞춰 보지 않게) — 공개 가게 경로만 여기 */}
            {sellerTopLevelRoutes()}<Route path="/seller/*" element={<SellerRouteTree />} />

            {/* Admin 페이지들 (공개 + 보호) — src/routes/admin.routes.tsx */}
            <Route path="/admin/*" element={<AdminRouteTree />} />

            {/* 🏢 2026-10-11 새 에이전시 콘솔(이메일 전용 계정·직원) — 2026-09-04 에 일몰된 옛 에이전시
                (대시보드·커미션·카카오 로그인)와 다른 것이다. src/routes/agency-console.routes.tsx */}
            {AgencyConsoleRoutes()}


            {/* 장바구니: 비로그인도 접근 가능 (결제 시에만 로그인 필요) */}
            <Route path="/cart" element={<ErrorBoundary><CartPage /></ErrorBoundary>} />
            <Route path="/checkout" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><CheckoutPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/mypage" element={
              <ProtectedRoute requireUser>
                <UserProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/user/profile" element={
              <ProtectedRoute requireUser guest={<AgencyAwareGuest guest={<GuestMyPage />} />}>
                <UserProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/mypage/addresses" element={
              <ProtectedRoute requireUser>
                <AddressManagementPage />
              </ProtectedRoute>
            } />
            <Route path="/mypage/wishlist" element={
              <ProtectedRoute requireUser>
                <WishlistPage />
              </ProtectedRoute>
            } />
            <Route path="/mypage/group-buys" element={
              <ProtectedRoute requireUser>
                <MyGroupBuysPage />
              </ProtectedRoute>
            } />
            <Route path="/community-group-buy/new" element={
              <ProtectedRoute requireUser>
                <UserGroupBuyCreatePage />
              </ProtectedRoute>
            } />
            <Route path="/wishlist" element={
              <ProtectedRoute requireUser>
                <WishlistPage />
              </ProtectedRoute>
            } />
            <Route path="/following" element={
              <ProtectedRoute requireUser>
                <FollowingPage />
              </ProtectedRoute>
            } />
            <Route path="/interest-list" element={
              <ProtectedRoute requireUser>
                <InterestListPage />
              </ProtectedRoute>
            } />
            <Route path="/my-vouchers" element={
              <ProtectedRoute requireUser guest={<GuestPassPage />}>
                <MyVouchersPage />
              </ProtectedRoute>
            } />
            <Route path="/my-gifticons" element={<ProtectedRoute requireUser><MyGifticonsPage /></ProtectedRoute>} />
            {/* 🏪 2026-09-28 (대표 "끝까지 해줘") — **`/my-store` 는 마이로 보낸다.**
                2026-06-22 에 "풀 대시보드 대신 앱 내" 로 만든 297줄 페이지인데, 2026-09-25 에 마이 맨 위에
                '내 가게' 섹션이 생기면서 **타일 여섯이 그대로 중복**됐다(주문 확인·상품 관리·상품 등록·
                이용권 등록·내 유어샵·셀러 대시보드 — 전부 마이에 있다). 같은 날 그 버튼은 지웠지만
                **페이지가 남아 있으면 도구가 하나 늘 때 두 곳을 고쳐야 하고 반드시 한쪽을 잊는다.**
                ⚠️ **라우트는 남긴다** — 이미 나간 링크·북마크가 404 가 되면 안 된다. `replace` 라 뒤로가기가
                이 주소로 되돌아오지 않는다(무한 왕복 방지). */}
            <Route path="/my-store" element={<Navigate to="/user/profile" replace />} />
            {/* 🎟️ 계산대(seller_token·스캔기기키 자체가드 — 소비자 로그인 요구 X: 에이전시 직원·스캔 기기 링크가 막혔다, 2026-10-12) · 🏪 매장 등록.
                한 줄 표기는 file-size 래칫 때문 — 동작은 블록 표기와 동일하다. */}
            <Route path="/store/scan" element={<StoreScanPage />} />
            <Route path="/store/new" element={<ProtectedRoute requireUser><ErrorBoundary><StoreClaimPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/store/find" element={<ProtectedRoute requireUser><ErrorBoundary><StoreOwnerClaimPage /></ErrorBoundary></ProtectedRoute>} /><Route path="/store/agency/:token" element={<ProtectedRoute requireUser><ErrorBoundary><StoreAgencyInvitePage /></ErrorBoundary></ProtectedRoute>} /><Route path="/store/partner/:agencyId" element={<ProtectedRoute requireUser><ErrorBoundary><StoreAgencyInvitePage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/store/go" element={<ProtectedRoute requireUser><ErrorBoundary><StoreGoPage /></ErrorBoundary></ProtectedRoute>} />
            <Route path="/influencer/settlement" element={
              <ProtectedRoute requireUser>
                <InfluencerSettlementPage />
              </ProtectedRoute>
            } />
            <Route path="/influencer/discover" element={
              <ProtectedRoute requireUser>
                <InfluencerDiscoverPage />
              </ProtectedRoute>
            } />
            <Route path="/influencer/analytics" element={
              <ProtectedRoute requireUser>
                <InfluencerAnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/influencer/rankings" element={<InfluencerRankingsPage />} />
            {/* 🛡️ 2026-05-15: 단골 알림 매트릭스 설정 */}
            <Route path="/my/follows" element={
              <ProtectedRoute requireUser>
                <MyFollowsPage />
              </ProtectedRoute>
            } />
            <Route path="/my/digital" element={
              <ProtectedRoute requireUser>
                <MyDigitalLibraryPage />
              </ProtectedRoute>
            } />
            <Route path="/my-orders" element={
              <ProtectedRoute requireUser>
                <MyOrdersPage />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute requireUser>
                <MyOrdersPage />
              </ProtectedRoute>
            } />
            <Route path="/my-coupons" element={
              <ProtectedRoute requireUser>
                <MyCouponsPage />
              </ProtectedRoute>
            } />
            <Route path="/my-reviews" element={
              <ProtectedRoute requireUser>
                <MyReviewsPage />
              </ProtectedRoute>
            } />
            <Route path="/referral" element={<ReferralIndexPage />} />
            <Route path="/my-commissions" element={<MyCommissionsPage />} />
            <Route path="/my-appointments" element={<MyAppointmentsPage />} />
            <Route path="/account/settings" element={
              <ProtectedRoute requireUser>
                <AccountSettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/account/delete-warning" element={
              <ProtectedRoute requireUser>
                <AccountDeleteWarningPage />
              </ProtectedRoute>
            } />
            <Route path="/account/deleted" element={<AccountDeletedPage />} />
            <Route path="/notifications" element={
              <ProtectedRoute requireUser>
                <NotificationsPage />
              </ProtectedRoute>
            } />

            {/* Payment 페이지들 */}
            {/* /payment/demo: dev 전용 — 프로덕션 빌드 시 tree-shake */}
            {import.meta.env.DEV && <Route path="/payment/demo" element={<ErrorBoundary><PaymentDemoPage /></ErrorBoundary>} />}

            {/* 임베드 위젯 (외부 서비스용) */}
            {/* 🗑️ 2026-07-07 라이브커머스 제거: /embed/live·/embed/seller-overlay 라우트 제거 */}
            <Route path="/payment/success" element={<ErrorBoundary><PaymentSuccessPage /></ErrorBoundary>} />
            <Route path="/success" element={<ErrorBoundary><PaymentSuccessPage /></ErrorBoundary>} />
            <Route path="/payment/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />
            {/* 🛡️ 2026-05-23: widget 키 (_wt_) 환경에서 충전/공구 결제용 공용 in-page 위젯 페이지. */}
            <Route path="/pay/widget" element={<ProtectedRoute requireUser><TossWidgetPayPage /></ProtectedRoute>} />
            {/* 🛡️ 2026-05-23: 결제 진단 페이지 (운영자 ground truth 수집용).
                🔒 2026-06-12 (4차 감사 D6): prod 에선 어드민 토큰 필요 (진단 도구라 DEV 게이트로
                죽이지 않고 requireAdmin — ERROR_DEBUGGING_PLAYBOOK 의 ground truth 수집 용도 보존). */}
            <Route path="/toss-debug" element={
              import.meta.env.DEV
                ? <ErrorBoundary><TossDebugPage /></ErrorBoundary>
                : <ProtectedRoute requireAdmin><ErrorBoundary><TossDebugPage /></ErrorBoundary></ProtectedRoute>
            } />

            {/* 딜 포인트 충전 — iOS IAP 게이트(플래그 OFF 기본=children 그대로) */}
            <Route path="/points/charge" element={<ProtectedRoute requireUser><IosTopupGate><PointsChargePage /></IosTopupGate></ProtectedRoute>} />
            <Route path="/points/charge/success" element={<ErrorBoundary><PointsChargeSuccessPage /></ErrorBoundary>} />
            <Route path="/my-deal-history" element={<ProtectedRoute requireUser><MyDealHistoryPage /></ProtectedRoute>} />
            <Route path="/points/charge/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />
            <Route path="/fail" element={<ErrorBoundary><PaymentFailPage /></ErrorBoundary>} />

            {/* 친구 초대 공동구매 */}
            <Route path="/referral/:code" element={<ReferralPage />} />

            {/* 맛집 지도 */}
            {/* 🗺️ 2026-06-23 (대표 — 주소 간소화): 지도 페이지 canonical = /map. 옛 /restaurant-map 은 리다이렉트(북마크/외부링크 보존). */}
            <Route path="/map" element={<RestaurantMapPage />} />
            <Route path="/restaurant-map" element={<Navigate to="/map" replace />} />

            {/* 블로그 */}
            <Route path="/design/variants" element={<DesignVariantsPage />} /><Route path="/blog" element={<BlogListPage />} />
            <Route path="/new-openings" element={<NewOpeningsPage />} />
            {/* 🗺️ 2026-08-03 지역 페이지 — 라우트는 플래그와 무관하게 유지(플래그 OFF 는 노출·색인만 끔). 색인된 URL 을 404 로 만들면 회수에 수 주. */}
            <Route path="/region" element={<RegionIndexPage />} />
            <Route path="/region/:sido" element={<RegionPage />} />
            <Route path="/region/:sido/:sigungu" element={<RegionPage />} />
            <Route path="/brand/:slug" element={<BrandPage />} />
            <Route path="/area-report" element={<AreaReportPage />} />
            <Route path="/area-report/:region" element={<AreaReportPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />

            {/* Terms Pages */}
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/terms/influencer" element={<InfluencerTermsPage />} />
            <Route path="/terms/seller" element={<SellerTermsPage />} />
            <Route path="/terms/group-buy" element={<GroupBuyTermsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/gdpr" element={<GDPRPage />} />
            <Route path="/user/affiliate" element={<AffiliatePage />} />
            <Route path="/gb-market" element={<GbMarketplacePage />} />
            <Route path="/refund" element={<RefundPolicyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            {/* ✅ 마이페이지 메뉴에서 사용하는 긴 형식 경로 → 짧은 경로로 리다이렉트 */}
            <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
            <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
            <Route path="/refund-policy" element={<Navigate to="/refund" replace />} />
            <Route path="/shipping-policy" element={<Navigate to="/refund" replace />} />
            <Route path="/coupon/:code" element={<CouponClaimPage />} />

            {/* 커뮤니티 공구 상세 (ReferralPage 재사용) */}
            <Route path="/community-group-buy/:code" element={<ReferralPage />} />
            {/* 🔗 2026-06-12 (4차 감사 #1): 알림 딥링크 착지 — 참여자/제안자/식당 메시지 스레드 */}
            <Route path="/community-group-buy/:code/messages" element={<CommunityGroupBuyMessagesPage />} />

            {/* Debug 페이지 (개발 환경만) — 프로덕션에선 라우트 등록 안 됨 */}
            {import.meta.env.DEV && <Route path="/kakao-debug" element={<KakaoDebugPage />} />}

            {/* Error 페이지들 */}
            <Route path="/500" element={<ServerErrorPage />} />

            {/* 🏬 2026-08-01 세션 ③-a — 운영자 몰 `urdeal.kr/{슬러그}`.
                🔴 **catch-all 바로 앞**이 이 라우트의 자리다. 위에 두면 1-세그먼트 경로를 전부 삼켜
                   나중에 추가되는 라우트가 조용히 죽는다(이 레포의 중복 라우트 사고와 같은 클래스).
                🔴 슬러그가 몰이 아니면 페이지가 스스로 `NotFoundPage` 를 렌더한다 —
                   즉 여기 있어도 **기존 404 동작이 바뀌지 않는다.** */}
            <Route path="/:mallSlug/p/:id" element={<MallProductPage />} />
            <Route path="/:mallSlug" element={<MallHomePage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </div>
          </ErrorBoundary>
          </main>
          </div>
          {!hideBottomNav && <BottomNav />}
          {!fullScreen && !mallSurface /* 🏬 몰 표면엔 유어딜 배너 금지(본진 입구) */
            && !isFullBleedPcPath(location.pathname) /* 🖥️ PC 풀너비(홈·카탈로그)는 자체 레이아웃 */ && shellNeed.sideBanner && <Suspense fallback={null}><SideBanner /></Suspense>}
          {/* 🛡️ 2026-05-24 (사용자 명령): 우하단 카카오 FAB 잠시 숨김 (featureFlags.kakaoFab=false).
              복원: src/shared/config/feature-flags.ts 의 kakaoFab 을 true 로. 대신 /user/profile 페이지에 별도 배치. */}
          {!fullScreen && featureFlags.kakaoFab && <KakaoConsultButton />}
          </div>
        </Suspense>
      </FrameWrapper>
      <ToastContainer />
      <NewVersionBanner />
    </>
  )
}

// 🛡️ 2026-05-28 (SSR Phase 3 Step 3-1): Router 를 prop 으로 받음.
//   client: <App /> → BrowserRouter (기존 동작 100% 보존).
//   server: <App Router={StaticRouter} routerProps={{ location: url }} />.
//   타입: ComponentType 추상화 (BrowserRouter 와 StaticRouter prop 인터페이스 다름).
import type { ComponentType, ReactNode } from 'react'
type RouterLike = ComponentType<{ children?: ReactNode; [key: string]: unknown }>
export type { RouterLike }

interface AppProps {
  Router?: RouterLike
  routerProps?: Record<string, unknown>
}

function App({
  Router = BrowserRouter as unknown as RouterLike,
  // 🎯 2026-07-18 (대표 신고 — "로딩 순간 유어딜 로더 말고도 보임"): v7_startTransition=true 면 React Router 가
  //   네비게이션을 startTransition 으로 감싸, 목적지 lazy 청크가 아직 안 받아졌을 때 React 18 이 Suspense
  //   fallback(유어딜 BrandLoader)을 '건너뛰고' 현재 화면(예: /map 분할)을 그대로 붙잡아 둠 → 청크 다운로드
  //   동안 이전 페이지가 남아 보였음(=로더 말고 다른 게 보이는 원인). false 로 두면 청크 미로드 시 즉시
  //   fallback(불투명 BrandLoader) 표출 → "클릭 → 유어딜 로더 → 상세" 로 통일. (이미 로드된 청크는 서스펜드
  //   안 해 즉시 전환 — 플래시 없음. BrandLoader 는 위상동기라 짧은 로드도 블링크 없음.)
  routerProps = { future: { v7_startTransition: false, v7_relativeSplatPath: true } },
}: AppProps = {}) {
  return (
    // 🛡️ 청크(배포 전환) + 일반 에러를 단일 ErrorBoundary 가 처리(청크는 recoverFromChunkError 자동복구).
    //   기존 ChunkErrorBoundary 는 최내곽 per-route ErrorBoundary 가 먼저 잡아 死코드였음 → 제거·통합.
    <ErrorBoundary>
      <HelmetProvider>
        <QueryProvider>
          <Router {...routerProps}>
            <AppContent />
          </Router>
        </QueryProvider>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

export default App
