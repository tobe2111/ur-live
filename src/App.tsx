import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryProvider } from './lib/react-query'
import { ProtectedRoute, PublicRoute } from './components/auth/RouteGuards'
import IosTopupGate from './components/IosTopupGate'
import { isUtongstart, isWholesaleAllowedPath, isWholesaleSurface, isMarketingSurface } from './utils/domain'
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
import BrandLoader from '@/components/brand/BrandLoader'
import { trackFunnel } from '@/lib/funnel'
import ConsumerTopChrome from '@/components/main/ConsumerTopChrome'
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
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { isKorea } from '@/shared/config/region'
// TD-006: route group files
import { SellerRoutes } from './routes/seller.routes'
import { AdminRoutes } from './routes/admin.routes'
import { AgencyRoutes } from './routes/agency.routes'
import { SupplierRoutes } from './routes/supplier.routes'

// ❌ REMOVED: Duplicate Sentry initialization (already done in main.tsx)

// ✅ Public / User 페이지들 lazy loading (초기 번들 크기 최소화)
// 🏠 2026-06-20 (대표 결정 — 홈=동네딜 지도+바텀시트): 홈 `/` 메인 콘텐츠를 RestaurantMapPage(지도+
//   드래그 바텀시트+카테고리 칩+내 주변)로 전환. RestaurantMapPage 는 lazy(아래 167행) — 지도는 어차피
//   카카오 SDK async 로드라 컴포넌트 청크 페치(~50-100ms)는 SDK 준비 대비 무시 가능. 기존 MainHomePage(교환권
//   blend)는 dead route 가 되어 import 제거(엔트리 축소). 일반상품/교환권은 '쇼핑' 탭(/vouchers)으로 이전.
//   ⚠️ [UNLOCK_LOADING] 트레이드오프: 홈 SSR 슬롯(__SSR_INITIAL_MAIN__) 미사용 → 홈 첫 화면이 지도 로딩.
//   worker/index.ts SSR inject 는 무수정(주입은 되나 지도 홈이 안 읽음 — 무해).
const WholesaleCatalogPage = lazy(() => import('./pages/WholesaleCatalogPage'))
const WholesaleDashboardPage = lazy(() => import('./pages/WholesaleDashboardPage'))
const WholesaleDepositPage = lazy(() => import('./pages/WholesaleDepositPage'))
const WholesaleProductPage = lazy(() => import('./pages/WholesaleProductPage'))
const WholesaleCheckoutPage = lazy(() => import('./pages/WholesaleCheckoutPage'))
const WholesaleCartPage = lazy(() => import('./pages/WholesaleCartPage'))
const WholesaleSuccessPage = lazy(() => import('./pages/WholesaleSuccessPage'))
const WholesaleOrdersPage = lazy(() => import('./pages/WholesaleOrdersPage'))
const WholesaleStatementPage = lazy(() => import('./pages/WholesaleStatementPage'))
const WholesaleDocsPage = lazy(() => import('./pages/WholesaleDocsPage'))
const WholesaleOemPage = lazy(() => import('./pages/WholesaleOemPage'))
const WholesaleQuotesPage = lazy(() => import('./pages/wholesale/WholesaleQuotesPage'))
const WholesaleLayout = lazy(() => import('./pages/wholesale/WholesaleLayout'))
const WholesaleNaverPage = lazy(() => import('./pages/wholesale/WholesaleNaverPage'))
const WholesaleStartPage = lazy(() => import('./pages/wholesale/WholesaleStartPage'))
const WholesaleBoardPage = lazy(() => import('./pages/wholesale/WholesaleBoardPage'))
const WholesaleSupportPage = lazy(() => import('./pages/wholesale/WholesaleSupportPage'))
const WholesaleChannelsPage = lazy(() => import('./pages/wholesale/WholesaleChannelsPage'))
const WholesaleTermsPage = lazy(() => import('./pages/wholesale/WholesaleTermsPage'))
const WholesalePrivacyPage = lazy(() => import('./pages/wholesale/WholesalePrivacyPage'))
const PartnershipInquiryPage = lazy(() => import('./pages/PartnershipInquiryPage'))
const WholesaleWishlistPage = lazy(() => import('./pages/wholesale/WholesaleWishlistPage'))
const WholesaleProposalsPage = lazy(() => import('./pages/wholesale/WholesaleProposalsPage'))
const WholesaleStaffPage = lazy(() => import('./pages/wholesale/WholesaleStaffPage'))
const WholesaleStaffLoginPage = lazy(() => import('./pages/wholesale/WholesaleStaffLoginPage'))
const WholesaleIntroPage = lazy(() => import('./pages/WholesaleIntroPage'))
const WholesaleJoinPage = lazy(() => import('./pages/WholesaleJoinPage'))
const WholesaleLoginPage = lazy(() => import('./pages/WholesaleLoginPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const IntroducePage = lazy(() => import('./pages/IntroducePage'))
const CreatorApplyPage = lazy(() => import('./pages/CreatorApplyPage')); const CreatorStartPage = lazy(() => import('./pages/CreatorStartPage'))
const CampaignApplyPage = lazy(() => import('./pages/CampaignApplyPage')) // 📣 2026-08-09 캠페인 인플루언서 모집(방배 등)
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
const CartPage = lazy(() => import('./pages/CartPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
// 🛡️ 2026-05-25 (migration 0278): 큐레이터 링크샵
const CuratorPage = lazy(() => import('./pages/CuratorPage'))
const CuratorEarningsPage = lazy(() => import('./pages/CuratorEarningsPage'))
// 🏁 2026-06-22 (대표 — 상품/이용권 전용 추가 페이지): 링크샵 핀 picker.
const LinkshopPinPicker = lazy(() => import('./pages/curator-page/LinkshopPinPicker'))
// 🛡️ 2026-05-25 (migration 0280): 호스팅 (Phase 3)
const HostingPage = lazy(() => import('./pages/HostingPage'))
const HostingNewPage = lazy(() => import('./pages/HostingNewPage'))
const HostInvitePage = lazy(() => import('./pages/HostInvitePage'))
// 🛡️ 2026-05-25 (Phase 2 잔여): 반품 회수 송장 추적 UI
const MyReturnsPage = lazy(() => import('./pages/MyReturnsPage'))
// 🛡️ 2026-05-25: /u/me → 본인 공개페이지 redirect
const UMeRedirectPage = lazy(() => import('./pages/UMeRedirectPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const WishlistPage = lazy(() => import('./pages/WishlistPage'))
const FollowingPage = lazy(() => import('./pages/FollowingPage'))
const MyVouchersPage = lazy(() => import('./pages/MyVouchersPage'))
const MyStorePage = lazy(() => import('./pages/MyStorePage'))
const StoreScanPage = lazy(() => import('./pages/StoreScanPage'))
const InfluencerSettlementPage = lazy(() => import('./pages/InfluencerSettlementPage'))
const InfluencerDiscoverPage = lazy(() => import('./pages/InfluencerDiscoverPage'))
const InfluencerAnalyticsPage = lazy(() => import('./pages/InfluencerAnalyticsPage'))
const InfluencerRankingsPage = lazy(() => import('./pages/InfluencerRankingsPage'))
const MyFollowsPage = lazy(() => import('./pages/MyFollowsPage'))
const MyDigitalLibraryPage = lazy(() => import('./pages/MyDigitalLibraryPage'))
const VoucherVerifyPage = lazy(() => import('./pages/VoucherVerifyPage'))
const StoreStatsPage = lazy(() => import('./pages/StoreStatsPage'))
const BrowsePage = lazy(() => import('./pages/BrowsePage'))
// 🛡️ 2026-05-19: 교환권 전용 페이지 — /browse 와 분리 (카카오 선물하기 스타일).
const VouchersPage = lazy(() => import('./pages/VouchersPage'))
const ExperienceCampaignsPage = lazy(() => import('./pages/ExperienceCampaignsPage'))
// 🆕 2026-06-26 통합 마케팅 서비스(가칭) — 3번째 서비스 /ads (유어딜/도매몰과 분리된 surface)
// 🆕 2026-06-27 /ads = 공개 랜딩(소개), /ads/dashboard = 로그인 후 입점 대시보드
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
const VoucherDetailPage = lazy(() => import('./pages/VoucherDetailPage'))
// 🗺️ 2026-07-03 (대표 결정 — /group-buy 은퇴): 홈(/)이 동네딜 목록·지도·지역선택을 담당 → 중복.
//   /group-buy 는 홈으로 리다이렉트(아래 Route). GroupBuyListPage 는 미라우팅(파일 보존). /group-buy/:id 상세는 유지.
const GroupBuyDetailPage = lazy(() => import('./pages/GroupBuyDetailPage'))
const GroupBuyConfirmPaymentPage = lazy(() => import('./pages/GroupBuyConfirmPaymentPage'))
// 🛡️ 2026-05-18: 숙소 공구 사용자 페이지 — PR 3/6, PR 6/6.
const StaysSearchPage = lazy(() => import('./pages/StaysSearchPage'))
const StayDetailPage = lazy(() => import('./pages/StayDetailPage'))
const MyStaysPage = lazy(() => import('./pages/MyStaysPage'))
// 🛡️ 2026-06-12 (전수조사 4차 B-1): 숙소 Toss 결제 returnUrl 경량 confirm 페이지.
const StayCheckoutReturnPage = lazy(() => import('./pages/StayCheckoutReturnPage'))
// 🛡️ 2026-05-18: 인플루언서 referral 대시보드.
const InfluencerDashboardPage = lazy(() => import('./pages/InfluencerDashboardPage'))
// 🛡️ 2026-05-15: PC 랜딩 (자영업자/인플루언서/에이전시 영업)
const BusinessLandingPage = lazy(() => import('./pages/BusinessLandingPage'))
const SellerProspectsPage = lazy(() => import('./pages/SellerProspectsPage'))
const SellerProxyProductsPage = lazy(() => import('./pages/SellerProxyProductsPage'))
const SellerPlusFriendGuidePage = lazy(() => import('./pages/SellerPlusFriendGuidePage'))
const InfluencerLandingPage = lazy(() => import('./pages/InfluencerLandingPage')); const InfluencerOfferAcceptPage = lazy(() => import('./pages/InfluencerOfferAcceptPage'))
const AgencyPartnerLandingPage = lazy(() => import('./pages/AgencyPartnerLandingPage'))
const InterestListPage = lazy(() => import('./pages/InterestListPage'))
const CouponClaimPage = lazy(() => import('./pages/CouponClaimPage'))
const GiftClaimPage = lazy(() => import('./pages/GiftClaimPage'))

// User 페이지들
const AddressManagementPage = lazy(() => import('./pages/AddressManagementPage'))
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'))
const MyCouponsPage = lazy(() => import('./pages/MyCouponsPage'))
const MyReviewsPage = lazy(() => import('./pages/MyReviewsPage'))
const ReferralIndexPage = lazy(() => import('./pages/ReferralIndexPage'))
const MyCommissionsPage = lazy(() => import('./pages/MyCommissionsPage'))
const MyAppointmentsPage = lazy(() => import('./pages/MyAppointmentsPage'))
const MyGroupBuysPage = lazy(() => import('./pages/MyGroupBuysPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))

// Account (탈퇴) 페이지들
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const AccountDeleteWarningPage = lazy(() => import('./pages/AccountDeleteWarningPage'))
const AccountDeletedPage = lazy(() => import('./pages/AccountDeletedPage'))

const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const BlogListPage = lazy(() => import('./pages/BlogListPage'))
const NewOpeningsPage = lazy(() => import('./pages/NewOpeningsPage')) // 🎉 우리 동네 새 가게(공공 인허가 개업 피드)
const AreaReportPage = lazy(() => import('./pages/AreaReportPage')) // 📊 상권 리포트(아웃리치 이메일 미끼·SEO)
// 🗺️ 2026-08-03 지역 허브 + 시/도·시군구 착지 페이지(도시별 색인). 롤백은 REGION_PAGES_ENABLED.
const RegionIndexPage = lazy(() => import('./pages/region/RegionIndexPage'))
const RegionPage = lazy(() => import('./pages/region/RegionPage'))
const BlogDetailPage = lazy(() => import('./pages/BlogDetailPage'))
const ReferralPage = lazy(() => import('./pages/ReferralPage'))
const RestaurantMapPage = lazy(() => import('./pages/RestaurantMapPage'))
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
const AgencyPartnerTermsPage = lazy(() => import('./pages/AgencyPartnerTermsPage'))
const GroupBuyTermsPage = lazy(() => import('./pages/GroupBuyTermsPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'))
const GDPRPage = lazy(() => import('./pages/GDPRPage'))
const AffiliatePage = lazy(() => import('./pages/AffiliatePage'))
const GbMarketplacePage = lazy(() => import('./pages/GbMarketplacePage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))

// 🔧 Debug 페이지
const KakaoDebugPage = lazy(() => import('./pages/KakaoDebugPage'))

// Redirect component for old product URL
function ProductRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/products/${id}`} replace />;
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
const PageLoader = () => <BrandLoader fullScreen />

// 🚑 2026-07-10 [UNLOCK_LOADING] (로딩 전수조사): 대시보드(/seller·/admin·/agency)·유어애즈(/ads) 전용
//   라이트 로더 — worker 가 이 표면들의 #root 를 라이트 #F4F5F7 placeholder 로 깔아주는데, Suspense
//   fallback 이 테마 추종 PageLoader(다크 토글 사용자는 다크 로고)라 [라이트 빈화면 → 다크 로더 →
//   라이트 대시보드] 색 점프가 났음. 도매 WholesaleLoader 와 동일한 정합을 유어딜 브랜드로.
//   (대시보드는 라이트 고정 규칙 — dark: variant 금지 표면이라 forceLight 가 맞는 동작.)
const DashboardLoader = () => (
  <div style={{ background: '#F4F5F7' }}>
    <BrandLoader fullScreen forceLight />
  </div>
)
const isDashboardLoaderSurface = (pathname: string) =>
  /^\/(seller|admin|agency|ads)(\/|$)/.test(pathname)

// 🏭 2026-06-29 (대표 요청 — 도매몰 페이지 로딩 애니메이션): 도매 surface(/wholesale·/supplier)
//   전용 *라이트* 브랜드 로더. 소비자 PageLoader 는 다크(흰 spinner) 라 라이트 도매 배경(#F4F5F7)에서
//   어색 → Suspense fallback 을 surface 별로 분기(아래 isWholesaleSurface). 색상은 WT SSOT
//   (wholesale-theme.ts: ink #0C2454 / brand #FC5424 / fill #F4F5F7 / line2 #E7E9ED)을 인라인 하드코딩 —
//   소비자 메인 청크에 wholesale-theme 를 끌어들이지 않기 위함(값은 브랜드 고정). 멀티-몰 커스텀
//   브랜딩은 로딩 순간엔 기본(유통스타트)으로 표시(전환 잔상 방지보다 단순/안정 우선).
const WholesaleLoader = () => (
  <div
    className="flex flex-col items-center justify-center gap-5 min-h-[100dvh]"
    style={{ background: '#F4F5F7' }}
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    {/* 🏷️ 브랜드 로고(라이트 배경용 PNG, public/utong-start-logo.png) — 은은한 pulse 로 '로딩 중' 표현.
        로고 종횡비 900:310 → height 52 / width 151 명시(CLS 0). 로고 교체는 public 파일만 변경하면 반영. */}
    <img
      src="/utong-start-logo.png"
      alt="유통스타트 도매몰"
      width={151}
      height={52}
      decoding="async"
      draggable={false}
      className="w-auto select-none animate-pulse"
      style={{ height: 52 }}
    />
    {/* 회전 아크(오렌지 액센트) — 명확한 로딩 모션. 200ms 후 회전 시작해 짧은 로딩엔 모션 깜빡임 방지 */}
    <div className="relative w-6 h-6">
      <div className="absolute inset-0 rounded-full" style={{ border: '2.5px solid #E7E9ED' }} />
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{ border: '2.5px solid transparent', borderTopColor: '#FC5424', animationDelay: '200ms' }}
      />
    </div>
    <span className="sr-only">유통스타트 도매몰 로딩 중…</span>
  </div>
)

// ✅ Router 내부에서 실행될 컴포넌트
function AppContent() {
  // ✅ authInitialized ref: 중복 초기화 방지 (StrictMode 이중 마운트 대비)
  const authInitialized = useRef(false)

  // 🔑 2026-07-02 (인증 회복력 P1a — 대표 "상품등록 흰화면"): 역할 토큰 proactive refresh 를 App 전역에.
  //   기존엔 대시보드 레이아웃(Seller/Admin/Agency)에서만 갱신 → 사업자 유저가 소비자 앱(링크샵) 체류 중엔
  //   seller_token 이 안 갱신돼, 만료 후 '상품등록' 진입 시 401 폭포 → 흰화면. 훅은 토큰 없으면 no-op(안전),
  //   refresh inflight 락으로 대시보드 중복마운트도 무해. 링크샵에 있어도 셀러 토큰이 신선하게 유지됨.
  useTokenAutoRefresh('seller')
  useTokenAutoRefresh('agency')

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
      //   로그인 사용자가 BottomNav 의 링크샵 클릭 시 cache 없으면 /u/me → dashboard → /host/new.
      //   idle 시 background 로 dashboard 호출 → linked_seller_username / user_handle localStorage 채움.
      //   다음 링크샵 클릭 즉시 /profile/{username} 또는 /u/{handle} 직행 (0 RTT).
      //   5분 이내 이미 cache 있으면 skip — 불필요한 API 호출 방지.
      // 🛡️ 2026-06-30 (무한 리다이렉트 루프 근본수정): 링크샵/큐레이터 프리페치는 *소비자(user) 세션* 전용.
      //   /api/curator/me/dashboard 는 consumer 인증 필요 → admin/seller 토큰만으론 무조건 401.
      //   admin-only 사용자가 이 401 을 유발해 리다이렉트 루프가 났다. 소비자 세션(user_id/session_login)
      //   있을 때만 프리페치 — 사업자 유저(seller)도 소비자 계정이 있어 user_id 보유하므로 링크샵 워밍 정상.
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

  // 네이티브 앱 + 모바일 브라우저: 페이지에 따라 상태바 스타일 / theme-color 변경
  useEffect(() => {
    // 화이트 테마 페이지 (CLAUDE.md 정책)
    const lightPages = ['/browse', '/vouchers', '/checkout', '/my-orders', '/account/', '/cart',
      '/referral/', '/map', '/restaurant-map', '/products/', '/wishlist', '/my-vouchers', '/search', '/group-buy', '/community-group-buy']
    const isLight = lightPages.some(p => location.pathname === p || location.pathname.startsWith(p))

    // 1. Capacitor 네이티브 앱 — StatusBar 플러그인
    import('./lib/native').then(({ setStatusBarStyle }) => {
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
      dynamic.setAttribute('content', isLight ? '#FAF7F5' : '#0F151D') // 🎨 2026-07-19 지시서 §6 — 라이트 #FAF7F5 / 다크 #0F151D
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
            toast.success(`🎉 내 링크샵 생성! /u/${res.handle} — 첫 핀이 추가됐어요`)
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

  // 🛡️ 2026-05-24 (regression fix): /pay/widget 누락 → BottomNav 가 결제 버튼 가림.
  //   결제 위젯 마운트하는 모든 경로는 반드시 여기 등록. 신규 추가 시 tests/unit/toss-fullscreen-routes.test.ts
  //   가 자동 검증 (App.tsx 의 fullScreenPrefixes 와 TossPaymentWidget 마운트 라우트 일치 확인).
  const fullScreenPrefixes = ['/cart', '/checkout', '/payment', '/pay', '/points', '/seller', '/admin', '/agency', '/login', '/register', '/auth', '/embed', '/introduce', '/blog', '/about', '/partners', '/creators', '/my-orders', '/store/scan']
  const fullScreen = fullScreenPrefixes.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  // 🏭 유통스타트 B2B(도매몰/제조사)는 소비자 BottomNav/TopNav 미표시 — 별도 도메인·업태.
  //   isWholesaleSurface = SSOT (`/wholesale*`·`/supplier*`). 같은 헬퍼를 BottomNav·DesktopTopNav
  //   컴포넌트가 자기-차단에도 사용 → 1차(여기서 마운트 차단) + 2차(컴포넌트 self-guard) 이중 방어.
  // 🏁 2026-06-26 [UNLOCK_LOADING] (대표 결정 — "특정 링크로 들어온 방문자는 네비 숨김"):
  //   /u/{handle}?embed=1 로 진입하면 standalone 매장처럼 상/하단 네비를 숨긴다. 한 번 본 플래그는
  //   sessionStorage 로 세션 유지(상품 클릭→뒤로 등 인앱 이동에도 깨끗) + 링크샵 표면(/u·/profile·/s)에서만
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
  const hideBottomNav = fullScreen || location.pathname.startsWith('/products/')
    || isWholesaleSurface(location.pathname) || isMarketingSurface(location.pathname) || embedHideNav
    || mallSurface
  // 🗺️ 2026-06-20 (대표 — 홈=리스트 / 지도는 버튼 이동): 지도 페이지(/restaurant-map)만 h-screen 자체관리
  //   풀스크린(바텀시트가 하단 담당) → main 하단 네비 여백 제외. 홈(/)=리스트는 일반 페이지(여백 필요).
  //   ⚠️ 도매/제조사(isWholesaleSurface)는 위 hideBottomNav 가 이미 커버(여백 0) — 여기 중복 불필요.
  const mapFullScreen = location.pathname === '/map' || location.pathname === '/restaurant-map'

  return (
    <>
      <FrameWrapper>
        {/* 🏭 2026-06-29 (대표 요청): 도매 surface 는 라이트 브랜드 로더로, 그 외(소비자)는 기존 PageLoader.
            isWholesaleSurface = `/wholesale`·`/supplier` SSOT(소비자 경로엔 byte-동일 — PageLoader 유지).
            🚑 2026-07-10: 대시보드/애즈는 라이트 고정 DashboardLoader — worker 라이트 placeholder 와 색 정합. */}
        <Suspense fallback={
          isWholesaleSurface(location.pathname) ? <WholesaleLoader />
            : isDashboardLoaderSurface(location.pathname) ? <DashboardLoader />
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
          <Suspense fallback={null}><OnboardingTrigger /></Suspense>
          <Suspense fallback={null}><RestoreAccountModal /></Suspense>
          {/* 📜 2026-07-05 (대표 "들어오자마자 나오면 안 되지 — 자연스럽게"): 약관 동의 차단 모달(TermsConsentGate)
              제거. 소비자 동의 = LoginPage 간주 고지(제5조) + 가입 시점 1회 서버 기록(kakao.routes isNewUser →
              terms_agreements). 개정 재동의가 필요해지면 /api/terms/status 로 비차단 배너를 붙이는 것이 후속안. */}
          <OfflineBanner />
          <ConfirmHost />
          <ScrollToTop />
          <Suspense fallback={null}><PushNotificationSetup /></Suspense>
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
          {/* 🏭 2026-06-04 도매몰 도메인 SPA 가드 — utongstart.com 비-도매몰 경로 navigate() 차단.
              worker 302(src/worker/index.ts)가 주 방어, 이건 SPA 내부 이동 보강(직접 로드는 worker 가 처리). */}
          {isUtongstart() && !isWholesaleAllowedPath(location.pathname) && <Navigate to="/wholesale" replace />}
          <div key={location.pathname} className={pageEnterCls}>
          <Routes>
            {/* Public 페이지들 */}
            <Route path="/introduce" element={<IntroducePage />} />
            <Route path="/creators/apply" element={<CreatorApplyPage />} /><Route path="/creators/start" element={<CreatorStartPage />} />
            {CAMPAIGN_SIGNUP_ENABLED && <Route path="/campaign/:code" element={<CampaignApplyPage />} />}{/* 📣 캠페인 신청 — 기존 가입과 게이트 분리(이 플래그는 이 라우트만 가림) */}
            <Route path="/about" element={<AboutServicePage />} /><Route path="/about/print" element={<AboutPage />} /><Route path="/partners" element={<PartnersPage />} /><Route path="/creators" element={<CreatorsPage />} />
            <Route path="/" element={isUtongstart() ? <Navigate to="/wholesale" replace /> : <HomeRoute />} />{/* 🖥️ lg+ = 당근 PC 홈 / 그 외 = 지도(홈=지도, 대표 2026-07-15) */}
            <Route path="/wholesale/intro" element={<WholesaleIntroPage />} />
            <Route path="/wholesale/join" element={<WholesaleJoinPage />} />
            <Route path="/wholesale/login" element={<WholesaleLoginPage />} />
            <Route path="/wholesale" element={<WholesaleCatalogPage key="home" />} />
            {/* 💬 채팅 알림 딥링크 — 같은 카탈로그를 렌더하되 채팅 위젯 자동 오픈(WholesaleChatButton 이 pathname 감지) */}
            <Route path="/wholesale/chat" element={<WholesaleCatalogPage key="home" />} />
            {/* 🏬 2026-06-14 (사용자 요청): 컬렉션 전용 페이지 — 같은 컴포넌트 mode 재사용.
                key 로 컬렉션 전환 시 강제 리마운트(초기 정렬/필터 재적용). */}
            <Route path="/wholesale/best" element={<WholesaleCatalogPage key="best" mode="best" />} />
            <Route path="/wholesale/new" element={<WholesaleCatalogPage key="new" mode="new" />} />
            {/* 🏭 2026-07-03 (대표): '고마진 특가'(/wholesale/margin) 완전 숨김 — 나브 진입 제거 + 직접 URL 도 전체상품으로 리다이렉트. */}
            <Route path="/wholesale/margin" element={<Navigate to="/wholesale" replace />} />
            <Route path="/wholesale/premium" element={<WholesaleCatalogPage key="premium" mode="premium" />} />
            <Route path="/wholesale/brands" element={<WholesaleCatalogPage key="brands" mode="brands" />} />
            {/* 🏭 2026-06-27 (대표 — 모든 도매 페이지 공통 상단바): 도매 app 페이지를 WholesaleLayout 으로 감싸
                상단 WholesaleUtilBar(회원·예치금 실시간·충전·대시보드·로그아웃) 자동 표시. 카탈로그는 자체
                풀헤더에 동일 바 존재 → 제외. 인증·랜딩(start/staff-login)·비도매(partnership)도 제외. */}
            <Route element={<WholesaleLayout />}>
              <Route path="/wholesale/dashboard" element={<WholesaleDashboardPage />} />
              <Route path="/wholesale/deposits" element={<WholesaleDepositPage />} />
              <Route path="/wholesale/product/:id" element={<WholesaleProductPage />} />
              <Route path="/wholesale/cart" element={<WholesaleCartPage />} />
              <Route path="/wholesale/checkout" element={<WholesaleCheckoutPage />} />
              <Route path="/wholesale/success" element={<WholesaleSuccessPage />} />
              <Route path="/wholesale/orders" element={<WholesaleOrdersPage />} />
              <Route path="/wholesale/statement" element={<WholesaleStatementPage />} />
              <Route path="/wholesale/documents" element={<WholesaleDocsPage />} />
              <Route path="/wholesale/oem" element={<WholesaleOemPage />} />
              <Route path="/wholesale/quotes" element={<WholesaleQuotesPage />} />
              <Route path="/wholesale/naver" element={<WholesaleNaverPage />} />
              <Route path="/wholesale/board" element={<WholesaleBoardPage />} />
              <Route path="/wholesale/support" element={<WholesaleSupportPage />} />
              <Route path="/wholesale/channels" element={<WholesaleChannelsPage />} />
              <Route path="/wholesale/terms" element={<WholesaleTermsPage />} />
              <Route path="/wholesale/privacy" element={<WholesalePrivacyPage />} />
              <Route path="/wholesale/wishlist" element={<WholesaleWishlistPage />} />
              <Route path="/wholesale/proposals" element={<WholesaleProposalsPage />} />
              <Route path="/wholesale/staff" element={<WholesaleStaffPage />} />
            </Route>
            <Route path="/wholesale/start" element={<WholesaleStartPage />} />
            <Route path="/partnership" element={<PartnershipInquiryPage />} />
            <Route path="/wholesale/staff-login" element={<WholesaleStaffLoginPage />} />
            {/* 🗑️ 2026-07-07 라이브커머스 제거: /shorts 라우트 제거 */}
            <Route path="/v/:code" element={<VoucherVerifyPage />} />
            {/* 🛡️ 2026-04-28: 선물 받기 페이지 (인증 불필요) */}
            <Route path="/gift/claim/:token" element={<GiftClaimPage />} />
            <Route path="/store/stats/:productId" element={<StoreStatsPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/vouchers" element={<VouchersPage />} />
            <Route path="/experience" element={<ExperienceCampaignsPage />} />
            {/* 🆕 통합 마케팅 서비스(가칭) — 3번째 서비스. 도매몰처럼 자체 surface 로 분리 */}
            {/* 🆕 2026-06-27 /ads = 공개 랜딩(소개), /ads/dashboard = 로그인 후 입점 대시보드 */}
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
            {/* confirm-payment 가 :id 매칭 우선 — 더 구체적인 path 먼저 */}
            <Route path="/group-buy/confirm-payment" element={<GroupBuyConfirmPaymentPage />} />
            <Route path="/group-buy/:id" element={<GroupBuyDetailPage />} />
            {/* 🏙️ 2026-07-04 상권관 랜딩 — 지역코드 하나로 그 상권의 동네딜+체험단 전체(B2G QR/링크 진입). */}
            <Route path="/local/:code" element={<LocalTownPage />} />
            <Route path="/district/:slug" element={<ErrorBoundary><DistrictCouponPage /></ErrorBoundary>} />
            {/* 🛡️ 2026-05-18: 숙소 공구 사용자 페이지 — PR 3/6 */}
            <Route path="/stays" element={<StaysSearchPage />} />
            {/* 🛡️ 2026-06-12 (B-1): Toss returnUrl confirm 페이지 — :id 보다 구체적 path (정적 세그먼트 우선 매칭) */}
            <Route path="/stays/checkout-return" element={<ProtectedRoute requireUser><StayCheckoutReturnPage /></ProtectedRoute>} />
            <Route path="/stays/:id" element={<StayDetailPage />} />
            <Route path="/my-stays" element={<MyStaysPage />} />
            <Route path="/influencer/dashboard" element={<InfluencerDashboardPage />} />
            {/* 🛡️ 2026-05-15: B2B 랜딩 — PC 풀 너비, 영업/모집용. ⚠️ 2026-07-29: `/influencer` 가 중복 등록돼 이 랜딩이 두 달간 도달 불가였다(대시보드가 선점) → 대시보드를 /influencer/dashboard 로 이사. 가드: check-duplicate-routes */}
            <Route path="/business" element={<BusinessLandingPage />} />
            <Route path="/influencer" element={<InfluencerLandingPage />} /><Route path="/i/offer/:token" element={<InfluencerOfferAcceptPage />} />
            <Route path="/agency-partner" element={<AgencyPartnerLandingPage />} />
            {/* 🛡️ 2026-05-27 (영업 검증 Layer 2): 영업자 prospects dashboard. */}
            <Route path="/agency/prospects" element={<SellerProspectsPage />} />
            <Route path="/seller/prospects" element={<SellerProspectsPage />} />
            <Route path="/seller/proxy-products" element={<SellerProxyProductsPage />} />
            <Route path="/seller/plus-friend-guide" element={<SellerPlusFriendGuidePage />} />
            {/* 🗑️ 2026-07-07 라이브커머스 제거: /live·/live/recap·/live/:streamId 라우트 제거 */}
            <Route path="/products/:id" element={<ErrorBoundary><ProductDetailPage /></ErrorBoundary>} />
            {/* Redirect old single product URL to plural */}
            <Route path="/product/:id" element={<ProductRedirect />} />
            <Route path="/search" element={<SearchPage />} />

            {/* 🛡️ 2026-05-25 큐레이터 링크샵 (migration 0278) */}
            {/* 🏁 2026-06-15 (옵션 1): /creator = 크리에이터 콘솔 정식 URL (메인 앱 내, 별도 로그인 X). /u/me/earnings 는 하위호환 alias. */}
            <Route path="/creator" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><CuratorEarningsPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/u/me/earnings" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><CuratorEarningsPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            {/* 🏁 2026-06-22 (대표 — 상품/이용권 전용 추가 페이지): 링크샵에 상품·이용권 핀 picker. */}
            <Route path="/u/me/add" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><LinkshopPinPicker /></ErrorBoundary>
              </ProtectedRoute>
            } />
            {/* 🛡️ 2026-05-25: /u/me → 본인 공개페이지 자동 redirect */}
            <Route path="/u/me" element={
              <ProtectedRoute requireUser>
                <ErrorBoundary><UMeRedirectPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
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
            {/* NOTE: called as function (not JSX component) so RR6 createRoutesFromChildren
                sees the Fragment+Route tree directly instead of a non-Route component wrapper */}
            {SellerRoutes()}

            {/* Admin 페이지들 (공개 + 보호) — src/routes/admin.routes.tsx */}
            {AdminRoutes()}

            {/* Agency 페이지들 (공개 + 보호) — src/routes/agency.routes.tsx */}
            {AgencyRoutes()}

            {/* Supplier(도매 공급자) 페이지들 — src/routes/supplier.routes.tsx (도매몰 INC-6) */}
            {SupplierRoutes()}

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
              <ProtectedRoute requireUser>
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
              <ProtectedRoute requireUser>
                <MyVouchersPage />
              </ProtectedRoute>
            } />
            {/* 🏪 2026-06-22 사업자 유저 경량 '내 매장'(원장+분쟁) — 풀 셀러 대시보드 대신 앱 내. */}
            <Route path="/my-store" element={
              <ProtectedRoute requireUser>
                <MyStorePage />
              </ProtectedRoute>
            } />
            {/* 🎟️ 2026-07-06 독립 계산대 스캔 POS — 마이 탭에서 1탭, 셀러 대시보드 안 거침. seller_token 자체가드. */}
            <Route path="/store/scan" element={
              <ProtectedRoute requireUser>
                <StoreScanPage />
              </ProtectedRoute>
            } />
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
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/new-openings" element={<NewOpeningsPage />} />
            {/* 🗺️ 2026-08-03 지역 페이지 — 라우트는 플래그와 무관하게 유지(플래그 OFF 는 노출·색인만 끔). 색인된 URL 을 404 로 만들면 회수에 수 주. */}
            <Route path="/region" element={<RegionIndexPage />} />
            <Route path="/region/:sido" element={<RegionPage />} />
            <Route path="/region/:sido/:sigungu" element={<RegionPage />} />
            <Route path="/area-report" element={<AreaReportPage />} />
            <Route path="/area-report/:region" element={<AreaReportPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />

            {/* Terms Pages */}
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/terms/influencer" element={<InfluencerTermsPage />} />
            <Route path="/terms/seller" element={<SellerTermsPage />} />
            <Route path="/terms/agency" element={<AgencyPartnerTermsPage />} />
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
            && !isFullBleedPcPath(location.pathname) /* 🖥️ PC 풀너비(홈·카탈로그)는 자체 레이아웃 */ && <Suspense fallback={null}><SideBanner /></Suspense>}
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
