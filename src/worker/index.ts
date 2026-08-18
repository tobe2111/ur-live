// ============================================================
// Cloudflare Worker - Main Entry Point (Unified)
// Global Marketplace API — ALL routes consolidated here
// Legacy src/index.tsx has been retired.
// ============================================================

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import { ROUTE_CHUNK_MAP } from './generated/route-chunk-map'; // 🚀 2026-07-12 라우트 청크 modulepreload(빌드 시 자동 생성)
import { docsRoutes } from './routes/docs.routes'; // 2026-04-27 TD-006 split (openapi/swagger)
import { internalDiagnosticsRoutes } from './routes/internal-diagnostics.routes'; // 2026-04-27 TD-006 split
import { internalAdminToolsRoutes } from './routes/internal-admin-tools.routes'; // 2026-04-27 TD-006 Phase C
import { smokeTestRoutes } from './routes/smoke-test.routes'; // 2026-04-27 TD-006 Phase D
import { repairSchemaRoutes } from './routes/repair-schema.routes'; // 2026-04-27 TD-006 Phase E
import { errorTelemetryRoutes } from './routes/error-telemetry.routes'; // 2026-05-23 frontend 에러 수집
import { healthcheckRoutes } from './routes/healthcheck.routes'; // 2026-05-23 결제/인증 사전 점검
import { selftestRoutes } from './routes/selftest.routes'; // 2026-05-23 운영 인프라 자가 점검

// ---- Worker-local routes (multi-seller MVP) ----
import type { Env } from './types/env';
import { authRouter } from './routes/auth.routes';
import { authTokenRoutes } from './routes/auth-token.routes'; // Phase 2.3
import { healthRoutes } from './routes/health.routes';
import { killerSwRoutes } from './routes/killer-sw.routes'; // 2026-04-27 PWA 사고 복구
import kakaoSkillWebhookRoutes from './routes/kakao-skill-webhook.routes'; // 💬 2026-07-19 CS FAQ 봇(오픈빌더 스킬, KAKAO_SKILL_SECRET 미설정=404)
import { sitemapRoutes } from './routes/sitemap.routes'; // 2026-04-27 TD-006 분할
import { ordersRouter } from './routes/order.routes';
import { paymentsRouter } from './routes/payment.routes';
import { stripeRouter } from './routes/stripe.routes';
import { sellersRouter } from './routes/seller.routes';
import { emailRoutes } from '../features/notifications/api/email.routes';
import { appointmentsRoutes } from '../features/appointments/api/appointments.routes';
import { adminPayoutsRoutes } from '../features/admin/api/admin-payouts.routes';
import { adminFeeBreakdownRoutes } from '../features/admin/api/admin-fee-breakdown.routes';
// 🧾 2026-07-10 불변식 #44 검증 콕핏 (promo 재원 원장 감사 — read-only, finance role)
import { adminPromoLedgerRoutes } from '../features/admin/api/admin-promo-ledger.routes';
import { funnelRoutes } from '../features/analytics/api/funnel.routes';
import { adminTaxRoutes } from '../features/admin/api/admin-tax.routes';
import { ledgerRoutes } from '../features/ledger/api/ledger.routes';
import { usersRouter } from './routes/users.routes';      // ✅ /api/users/role, /api/users/init
import { meRegionRoutes, adminRegionRoutes, publicRegionRoutes } from './routes/region.routes'; // 🗺️ 내 동네 + 동별 밀도 + 좌표해석
import { adminMatchingRoutes } from '../features/marketing/api/admin-matching.routes'; // 🤝 성과기반 매칭(어드민 전용 내부 도구)
import { acquisitionRoutes } from './routes/acquisition.routes'; // 📡 유입 소스 어트리뷰션 (?src= 퍼널)
import { termsRoutes } from './routes/terms.routes'; // 📜 약관 동의 로그 (누가·언제·몇 버전)
import { i18nMiddleware } from './middleware/i18n.middleware';
import { rateLimitMiddleware as rateLimiterMiddleware } from './middleware/rate-limiter';
import { globalErrorHandler as errorHandler } from './middleware/error-handler';
import { errorRateMonitor } from './middleware/error-rate-monitor';
import { edgeCache, publicCache } from './middleware/edge-cache';

// ---- Feature module routes ----
import { accountRoutes } from '../features/account/api/account.routes';
import { adminManagementRoutes, adminBannersRoutes, adminFlagsRoutes } from '../features/admin/api/index';
import { adminCouponsRoutes } from '../features/admin/api/admin-coupons.routes';
import { adminBulkEmailRoutes } from '../features/admin/api/admin-bulk-email.routes';
import { adminSideBannersRoutes } from '../features/admin/api/admin-side-banners.routes';
import { adminSettlementsRoutes } from '../features/admin/api/admin-settlements.routes';
// 🏬 몰 관리 CRUD — 파일 위치는 features/supply 지만 **소비자 번들에 실린다**(아래 마운트 주석 참조).
import { adminWholesaleMallRoutes } from '../features/supply/api/wholesale-malls-admin.routes';
import { adminStatsRoutes } from '../features/admin/api/admin-stats.routes';
import { adminSellersRoutes } from '../features/admin/api/admin-sellers.routes';
import { adminProductsRoutes } from '../features/admin/api/admin-products.routes';
// 🏭 [wholesale-split 2026-07-16] adminSuppliersRoutes → src/worker/mount-wholesale.ts (도매 분리)
// 🛡️ 2026-05-18: 숙소 공구 (stay_voucher) 어드민 — PR 1 Foundation.
import { adminStaysRoutes } from '../features/admin/api/admin-stays.routes';
// 🛡️ 2026-05-19: KT Alpha (기프티쇼) 어드민.
import { adminKtAlphaRoutes } from '../features/admin/api/admin-kt-alpha.routes';
// 🛡️ 2026-05-19: 원천징수 + 지급조서 어드민.
import { adminWithholdingRoutes } from '../features/admin/api/admin-withholding.routes';
import { adminOrdersRoutes } from '../features/admin/api/admin-orders.routes';
import { adminStreamsRoutes } from '../features/admin/api/admin-streams.routes';
import { adminAccountsRoutes } from '../features/admin/api/admin-accounts.routes';
import { adminAnalyticsRoutes } from '../features/admin/api/admin-analytics.routes';
import { adminModerationRoutes } from '../features/admin/api/admin-moderation.routes';
import { adminUsersRoutes } from '../features/admin/api/admin-users.routes';
import { adminMiscRoutes } from '../features/admin/api/admin-misc.routes';
import { adminAbuseRoutes } from '../features/admin/api/admin-abuse.routes';
import { adminReviewGeneratorRoutes } from '../features/admin/api/admin-review-generator.routes';
import { adminRoutes as adminAuthRoutes } from '../features/auth/api/admin.routes';
import { kakaoRoutes } from '../features/auth/api/kakao.routes';
import { sellerRoutes as sellerAuthRoutes } from '../features/auth/api/seller.routes';
// import { googleRoutes } from '../features/auth/api/google.routes';  // 🔒 2026-07-28 마운트 해제(#806)
import { bannerRoutes } from '../features/banners/api/banners.routes';
import { cartRoutes } from '../features/cart/api/cart.routes';
import { notificationsRoutes } from '../features/notifications/api/notifications.routes';
import { resendWebhookRoutes } from '../features/notifications/api/resend-webhook.routes';
import { ordersRoutes as featureOrdersRoutes } from '../features/orders/api/orders.routes';
import { productsRoutes as featureProductsRoutes } from '../features/products/api/products.routes';
import { pushRoutes } from '../features/push/api/push.routes';
import { sellerManagementRoutes } from '../features/seller/api/seller-management.routes';
import { sellerAdSlotsRoutes } from '../features/seller/api/seller-ad-slots.routes';
import { sellerKakaoLinkRoutes } from '../features/seller/api/seller-kakao-link.routes';
import { sellerScanDevicesRoutes } from '../features/seller/api/seller-scan-devices.routes';
import { sellerAlimtalkMgmtRoutes } from '../features/seller/api/seller-alimtalk-mgmt.routes';
import { sellerRegistrationRoutes } from '../features/seller/api/seller-registration.routes';
import { sellerProfileRoutes } from '../features/seller/api/seller-profile.routes';
import { sellerSettlementsRoutes } from '../features/seller/api/seller-settlements.routes';
// 🛡️ 2026-05-18: 숙소 공구 (stay_voucher) 셀러 CRUD — PR 1 Foundation.
import { sellerStaysRoutes } from '../features/seller/api/seller-stays.routes';
import { sellerAccountRoutes } from '../features/seller/api/seller-account.routes';
import { consignmentRoutes } from '../features/seller/api/consignment.routes';
import { giftsRoutes } from '../features/gifts/api/gifts.routes';
import { fundingRoutes } from '../features/funding/api/funding.routes';
import { sellerPinRoutes } from '../features/seller/api/seller-pin.routes';
import { sellerOrdersRoutes } from '../features/seller/api/seller-orders.routes';
import { sellerGbRoutes } from '../features/seller/api/seller-gb.routes';
import { sellerAnalyticsRoutes } from '../features/seller/api/seller-analytics.routes';
import { sellerOnboardingRoutes } from '../features/seller/api/seller-onboarding.routes';
import { optimalTimeRoutes } from '../features/seller/api/optimal-time.routes';
// 🤝 2026-07-10 위임 3단 모델 + promo 투명성 (vendor-commission-passthrough §4.3 — 돈 이동 0)
import { sellerDelegationRoutes } from '../features/seller/api/seller-delegation.routes';
import { sellerPromoSpendRoutes } from '../features/seller/api/seller-promo-spend.routes';
import { faqBotRoutes } from '../features/guides/api/faq-bot.routes';
import { moderationRoutes } from '../features/moderation/api/moderation.routes';
import { adminTikTokDiscoveryRoutes } from '../features/admin/api/admin-tiktok-discovery.routes';
import { adminOpsInsightsRoutes } from '../features/admin/api/admin-ops-insights.routes';
import { adminNotificationSettingsRoutes } from '../features/admin/api/admin-notification-settings.routes';
import { adminBusinessMonitoringRoutes } from '../features/admin/api/admin-business-monitoring.routes';
import { agencySelfEventsRoutes } from '../features/agency/api/agency-self-events.routes';
import { promoteBoostsAgencyRoutes, promoteBoostsSellerRoutes } from '../features/agency/api/promote-boosts.routes';
import { sellerTransferRoutes } from '../features/agency/api/seller-transfer.routes';
import { sellerTransferRespondRoutes } from '../features/seller/api/seller-transfer-respond.routes';
// 🥗 2026-07-15 워커 다이어트(대표 승인): 라이브커머스 영구중단(LIVE_COMMERCE_SUSPENDED) 잔재 라우트 분리 —
//   casting(캐스팅/광고주, 페이지 없음·nav 숨김) · donation-booster(쓰는 컴포넌트 0). 클라 미호출이라 라이브 영향 0. 재도입=원복.
// import {
//   adminAdvertiserRoutes,
//   adminCastingRoutes,
//   sellerCastingRoutes,
// } from '../features/casting/api/casting.routes';
// import { donationBoosterRoutes, donationBoosterPublicRoutes } from '../features/donations/api/donation-booster.routes';
import { shippingAddressRoutes } from '../features/shipping/api/shipping-address.routes';
import { wishlistRoutes } from '../features/wishlists/api/wishlists.routes';
// 🏭 [wholesale-split 2026-07-16] 도매(features/supply) 라우트 import 는 src/worker/mount-wholesale.ts 로 이동.
//   소비자(ur-live) 번들에서 제외 — WHOLESALE_BUNDLE=1 빌드에서만 동적 import(esbuild DCE). 상세: mount-wholesale.ts 헤더.
//   partnership(광고/제휴 문의)은 도매 아님 → 소비자 유지(아래 1줄 잔류).
import { partnershipPublicRoutes, adminPartnershipRoutes } from './routes/partnership.routes';
import { platformMetricsRoutes } from '../features/admin/api/platform-metrics.routes';
import { alimtalkRoutes } from '../features/alimtalk/api/alimtalk.routes';
import { restaurantSuggestionsRoutes } from '../features/restaurant-suggestions/api/restaurant-suggestions.routes';
// 🥗 2026-07-15 워커 다이어트 3차(대표 AskUserQuestion 4항목 명시 승인): 라이브커머스 영구중단 잔재 라우트 분리 —
//   donations(라이브 후원·소비자 미호출)·youtube(라이브 유튜브 연동)·multi-platform(멀티스트림)·tiktok(아래). 도달 0. 재도입=원복.
// import { donationsRoutes } from '../features/donations/api/donations.routes';
// import { sellerDonationsRoutes } from '../features/donations/api/seller-donations.routes';
// import youtubeRoutes from '../features/youtube/api/youtube.routes';
// import { multiPlatformRoutes } from '../features/multi-platform/api/multi-platform.routes';
import { cafe24Routes } from '../features/cafe24/api/cafe24.routes';

import { ALLOWED_ORIGINS, FIREBASE_RTDB_URL, FIREBASE_APP_URL } from '../shared/constants';
import { requireAdmin, requireAuth, requireSeller } from './middleware/auth';
import { adminIpWhitelist, adminAuditMiddleware } from './middleware/admin-security';
import { adminRbacMiddleware } from './middleware/admin-rbac';
import { rateLimit } from './middleware/rate-limit';
import { hashPassword } from '../lib/password';
import { botProtection } from './middleware/bot-detection';
import { bodyLimit } from './middleware/body-limit';
import { csrfProtection, csrfTokenHandler } from '../lib/csrf';

// 🛡️ 2026-04-26: 파일 중간 import 를 상단으로 이동 (CLAUDE.md 금지 패턴 — 2026-04-22 사고 재발 방지)
import { blogRoutes } from '../features/blog/api/blog.routes';
import { blogSeoRoutes } from '../features/blog/api/blog-seo.routes';
import { buildBlogPostMeta, buildBlogListJsonLd } from '../features/blog/api/blog-ssr-meta';
import { buildBlogPostBody, buildBlogListBody } from '../features/blog/api/blog-ssr-body';
import { resolveRenamedBlogPath } from '../features/blog/api/blog-slug-redirects';
import { buildDetailMeta, buildStayDetailMeta, buildProductMeta } from './utils/detail-ssr-meta';
// 🔎 2026-07-29 정적 소비자 표면 메타 SSOT(워커·클라 공용). ⚠️ 워커 값 import 는 alias 금지 — 상대경로.
import { resolveConsumerSurfaceSeo } from '../shared/seo/consumer-surfaces';
import { resolveConsumerAlias } from '../shared/seo/consumer-redirects';
import { applySurfaceMeta, buildSellerSurfaceMeta, shouldNoindexMissingEntity, resolveRegionSeo } from './utils/surface-ssr-meta';
import { agencyRoutes } from '../features/agency/api/agency.routes';
import { agencyKakaoLinkRoutes } from '../features/agency/api/agency-kakao-link.routes';
import { agencyStatsRoutes } from '../features/agency/api/agency-stats.routes';
// 🛡️ 2026-05-20: 에이전시 = 가게 입점 영업 모델 (Phase 2).
import { agencyIntroducedStoresRoutes } from '../features/agency/api/agency-introduced-stores.routes';
import { agencySettlementsRoutes } from '../features/agency/api/agency-settlements.routes';
// 🛡️ 2026-05-18: 숙소 공구 에이전시 모니터링 — PR 1 Foundation.
import { agencyStaysRoutes } from '../features/agency/api/agency-stays.routes';
import { agencyOpsRoutes } from '../features/agency/api/agency-ops.routes';
import { agencySellersRoutes } from '../features/agency/api/agency-sellers.routes';
import { agencyPinRoutes } from '../features/agency/api/agency-pin.routes';
import { agencyCampaignsRoutes } from '../features/agency/api/agency-campaigns.routes';
import { agencyIncentivesRoutes } from '../features/agency/api/agency-incentives.routes';
import { agencyMessagesRoutes } from '../features/agency/api/agency-messages.routes';
import { agencyCouponsRoutes } from '../features/agency/api/agency-coupons.routes';
import { agencyMembersRoutes } from '../features/agency/api/agency-members.routes';
import { agencyCalendarRoutes } from '../features/agency/api/agency-calendar.routes';
import { agencyInvitesRoutes, inviteCodePublicRoutes } from '../features/agency/api/agency-invites.routes';
// 🛡️ 2026-05-27 (영업 검증 Layer 2): 매장 사전 등록 prospects.
import { prospectsRoutes } from '../features/seller-prospects/api/seller-prospects.routes';
// 🎯 [urads-split Phase D 2026-07-16] 유어애즈 로컬 폴백(marketingRoutes·shortLinkRedirectRoutes) 제거 —
//   prod 컷오버 확인(`x-served-by: ur-ads`) 후 설계(docs/design/urads-worker-split.md §4 Phase D)대로.
//   /api/ads/*·/l/* 는 Service Binding 프록시(env.ADS)가 ur-ads 워커로 위임(아래 app.use('*') 블록).
//   ⚠️ ADS_WORKER_ENABLED=true + ADS 바인딩이 이제 필수(폴백 없음) — 끄면 유어애즈 다운. 재도입=원복.
// import { marketingRoutes } from '../features/marketing/api/marketing.routes';
// import { shortLinkRedirectRoutes } from '../features/marketing/api/routes/shortlink-redirect.routes';
// /api/admin/ads 는 메인 어드민 JWT 사용이라 잔류(프록시 비위임 설계 유지).
import { adminAdsRoutes } from '../features/marketing/api/admin-ads.routes';
import { adsPayRoutes, adminAdsPayRoutes } from '../features/marketing/api/ads-pay.routes'; // 💳 서비스몰 토스(게이트 OFF 기본)
import { adsKakaoAuthRoutes } from '../features/marketing/api/ads-kakao-auth.routes'; // 🟡 유어애즈 카카오 로그인
// 🤝 B2B 파트너(업체) 풀 — 유어애즈 어드민(메인 JWT, 프록시 비위임). 격리 테이블 ad_company_leads.
import { partnerPoolRoutes } from '../features/marketing/api/partner-pool.routes';
import { storeProspectsRoutes } from '../features/marketing/api/store-prospects.routes';
import { newOpeningsPublicRoutes } from '../features/marketing/api/new-openings-public.routes';
import { areaReportPublicRoutes } from '../features/marketing/api/area-report-public.routes';
import { govNoticesRoutes } from '../features/marketing/api/gov-notices.routes';
import { influencerApplyRoutes } from '../features/marketing/api/influencer-apply.routes';
import { creatorClaimRoutes } from '../features/marketing/api/lead-claim'; // 🔗 신청 → 가입 연결(초대 코드 클레임)
// 📣 2026-08-09 캠페인 인플루언서 모집(방배 등) — 신청 = 파트너 등록(계정+동의+ref 링크)
import { campaignApplyRoutes } from '../features/marketing/api/campaign-apply.routes';
import { adminCampaignApplicationsRoutes } from '../features/admin/api/admin-campaign-applications.routes';
// ⏳ [TEMP-TEST] 도매 워커 배포 전 라이브 검증용 임시 마운트(아래 app.route 참조) — ur-wholesale 배포 시 제거.
import { buyerPoolRoutes as buyerPoolTestRoutes } from '../features/supply/api/buyer-pool.routes';
import { makerPoolRoutes as makerPoolTestRoutes } from '../features/supply/api/maker-pool.routes';
import { buyerIngestRoutes } from '../features/supply/api/buyer-ingest.routes';
import { agencyKpiRoutes } from '../features/agency/api/agency-kpi.routes';
import { agencyDelegationRoutes } from '../features/agency/api/agency-delegation.routes'; // 🤝 2026-07-10 에이전시 위임/promo 투명성 (vendor-commission-passthrough §4.3 — read-only + 요청만)
import { agencyMatchSuggestionsRoutes } from '../features/agency/api/agency-match-suggestions.routes';
import { agencyPublicRoutes, agencyPublicEditRoutes } from '../features/agency/api/agency-public.routes';
import { adminAgencyRoutes } from '../features/admin/api/admin-agency.routes';
import { payoutCenterRoutes } from '../features/admin/api/admin-payout-center.routes';
import { adminAgencyApprovalsRoutes } from '../features/admin/api/admin-agency-approvals.routes';
import { proxyRoutes } from './routes/proxy.routes';
import { debugRoutes } from './routes/debug.routes';
import { publicUtilityRoutes } from './routes/public-utility.routes';
// 🥗 2026-07-15 워커 다이어트 3차(대표 승인): 틱톡 Login/Display 라우트 분리(위 참조). 재도입=원복.
// import { tiktokRoutes } from '../features/multi-platform/api/tiktok.routes';
import { bundlePublicRoutes, bundleSellerRoutes, bundleCartRoutes } from '../features/bundles/api/bundle.routes';
import { guideRoutes } from '../features/guides/api/guide.routes';
import { inviteRewardRoutes } from '../features/referral/api/invite-reward.routes';
import { referralTreeRoutes } from '../features/referral/api/referral-tree.routes';
import { reportsRoutes } from '../features/reports/api/reports.routes';
import { loyaltyRoutes } from '../features/loyalty/api/loyalty.routes';
import { interestRoutes } from '../features/loyalty/api/interest.routes';
import { kakaoSocialRoutes } from '../features/kakao-social/api/kakao-social.routes';
import { affiliateRoutes } from '../features/affiliate/api/affiliate.routes';
import { adminToolsRoutes } from '../features/admin/api/admin-tools.routes';
import { adminMetricsRoutes } from '../features/admin/api/admin-metrics.routes';
import { adminSystemMonitoringRoutes } from '../features/admin/api/admin-system-monitoring.routes';
import { blogRoutes as adminBlogRoutes } from '../features/blog/api/blog.routes';
// 🥗 2026-07-15 워커 다이어트(대표 승인): 소셜 자동화(게이트 OFF·미사용)의 정적 import 를 제거해
//   메인 워커 번들에서 그래프 분리 → Cloudflare Free 1MB 압축한도 회복(배포 언블록). 재도입 시 아래 mount 와
//   함께 원복(1줄) + 크론 원복. features/social 소비자 소셜그래프와 무관.
// import { socialMediaRoutes } from '../features/social-media/api/social-media.routes';
import { restaurantSettlementRoutes, sellerSettlementRoutes } from '../features/settlement/api/restaurant-settlement.routes';
import { pointsRoutes } from '../features/points/api/points.routes';
// 🥗 2026-07-15 워커 다이어트(대표 승인): 쇼츠(라이브커머스 영구중단, /shorts UI 제거됨) 라우트 분리 — 클라 미호출. 재도입=원복.
// import { shortsRoutes } from '../features/shorts/api/shorts.routes';
import { groupBuyRoutes } from '../features/group-buy/api/group-buy.routes';
// 🛡️ 2026-05-18: 숙소 공구 (stay_voucher) 사용자 측 public — PR 1 Foundation.
import { staysPublicRoutes } from '../features/group-buy/api/stays-public.routes';
// 🗺️ 2026-08-03 (대표 — 도시별 페이지 + 구글 색인): 지역별 딜 집계(페이지·인덱스·sitemap 공용 SSOT).
import { regionsRoutes } from '../features/group-buy/api/regions.routes';
// 🛡️ 2026-05-18: R2 이미지 업로드 (seller/admin/agency/user 공용).
import { uploadRoutes } from '../features/upload/api/upload.routes';
import { sellerMarketingRoutes, influencerSettlementRoutes, adminPayoutRoutes, influencerDiscoverRoutes, influencerRankingsRoutes } from '../features/group-buy/api/marketing.routes';
import { reviewBonusUserRoutes, reviewBonusAdminRoutes, reviewBonusSellerRoutes } from '../features/group-buy/api/review-bonus.routes';
// 🧾 2026-07-13 상권 쿠폰(영수증 페이백) — 병렬 엔티티(vouchers 무접촉), district-coupon-estimate-2026-07.md
import { districtPublicRoutes } from '../features/district/api/district-coupon.routes';
import { districtAdminRoutes } from '../features/district/api/district-coupon-admin.routes';
import { gbCockpitRoutes } from '../features/group-buy/api/gb-cockpit.routes';
import { fcfsRoutes, fcfsAdminRoutes } from '../features/group-buy/api/fcfs.routes';
import { experienceCampaignPublicRoutes, experienceCampaignAdminRoutes, experienceCampaignSellerRoutes } from '../features/group-buy/api/experience-campaign.routes';
import { gbMarketplaceRoutes } from '../features/group-buy/api/gb-marketplace.routes';
import { mallPublicRoutes } from '../features/mall/api/mall-public.routes';
import { isMallLookupCandidate } from './utils/mall-consumer';
// 🏬 2026-08-09 [UNLOCK_LOADING] 몰 상품 OG 배선 — 세션 ③-a 가 만들고 미배선(dead code)이던 것.
import { buildMallProductMeta, resolveMallProductSlot, mallProductPathSurfaceMeta } from './utils/mall-ssr-meta';
import { gbProposalsRoutes } from '../features/group-buy/api/gb-proposals.routes';
import { voucherDisputeRoutes, voucherDisputeAdminRoutes } from '../features/group-buy/api/voucher-dispute.routes';
// 🛡️ 2026-05-20: requireAdmin 은 위 (line 127) 에서 이미 import — 중복 제거.
import { ogRoutes } from './routes/og-image.routes';
import { curatorRoutes } from './routes/curator.routes'; // 2026-05-25 큐레이터 링크샵
import { shippingRoutes } from './routes/shipping.routes'; // 2026-05-25 배송 재설계 (migration 0279)
import { hostingRoutes } from './routes/hosting.routes'; // 2026-05-25 호스팅 (migration 0280)
import { analyticsRoutes } from './routes/analytics.routes';
import { flagRoutes } from './routes/feature-flag.routes';
import { currencyRoutes } from './routes/currency.routes';
import { ocrRoutes } from './routes/ocr.routes';
import { disputesRoutes } from './routes/disputes.routes';
import { twofaRoutes } from './routes/twofa.routes';
import { sellerPublicRoutes } from '../features/seller-public/api/seller-public.routes';
import { promoRoutes } from '../features/promo/api/promo.routes';
import { csrfIssue } from './middleware/csrf';
import { couponRoutes } from '../features/coupons/api/coupons.routes';
import { digitalRoutes } from '../features/digital/api/digital.routes';
import { socialRoutes } from '../features/social/api/social.routes';
import { reviewsRoutes } from '../features/reviews/api/reviews.routes';
import { sellerTiersRoutes } from '../features/seller-tiers/api/seller-tiers.routes';
import { inventoryRoutes } from '../features/inventory/api/inventory.routes';
import { sectionsRoutes } from '../features/sections/api/sections.routes';
import { youtubeGrowthRoutes, youtubeGrowthAdminRoutes } from '../features/youtube-growth/api/youtube-growth.routes';
import { dashboardNotificationsRoutes } from '../features/notifications/api/dashboard-notifications.routes';
import { bulkUploadRoutes } from '../features/bulk-upload/api/bulk-upload.routes';
import { returnsRoutes } from '../features/returns/api';
import { auctionRoutes } from '../features/auction/api/auction.routes';
import { timedealRoutes } from '../features/timedeal/api/timedeal.routes';
import { communityGroupBuyRoutes } from '../features/community-group-buy/api/community-group-buy.routes';
import { referralRoutes } from '../features/referral/api/referral.routes';
// 🖼️ 2026-07-02 (대표 "사진이 빠르게 안 나타남"): 상세 히어로 preload URL 생성 — 클라와 동일 함수 재사용
//   (typeof navigator/window 가드 보유라 워커 안전). URL 이 클라 렌더값과 byte-일치해야 preload 적중.
import { cfImage, cfSrcSet } from '../utils/cf-image';

// ---- Durable Objects (re-exported for wrangler binding) ----
export { LiveStreamDurableObject } from '../durable-object';
export { RateLimiterDurableObject } from '../durable-objects/rate-limiter';

// ============================================================
// Cache Control Middleware — adds CDN + browser cache headers
// for read-heavy GET endpoints to reduce origin load
// ============================================================
function cacheControl(maxAge: number, swr?: number) {
  // 🛡️ 2026-05-22: stale-while-revalidate 추가 — edge 에 stale 응답 있으면 즉시 반환 +
  //   백그라운드에서 origin 재요청 → 100% edge hit, 사용자는 D1 cold-start 절대 안 만남.
  const staleWhileRevalidate = swr ?? maxAge * 4
  return async (c: Context, next: Next) => {
    await next();
    if (c.res.status === 200 && c.req.method === 'GET') {
      c.header('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
      c.header('CDN-Cache-Control', `max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
    }
  };
}

// 🔒 2026-04-22: 인증 필요 엔드포인트는 CDN 캐싱 금지
// auth.routes.ts 의 /me, /orders, /cart 등 개인화된 응답이 CDN 에 캐싱되면
// 다른 유저에게 노출될 수 있음 (계정 탈취와 동급의 정보 유출).
function privateNoCache() {
  return async (c: Context, next: Next) => {
    await next();
    c.header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Vary', 'Authorization, Cookie');
  };
}

// 🏭 [wholesale-split 2026-07-16] 빌드타임 상수 — esbuild `define` 로 치환됨.
//   build-worker.js: 기본 false(소비자 ur-live) → 도매 그래프 DCE 제외. WHOLESALE_BUNDLE=1 → true(도매 ur-wholesale).
declare const __INCLUDE_WHOLESALE__: boolean;

const app = new Hono<{ Bindings: Env }>();

// ============================================================
// 🛡️ 2026-07-20 (대표 신고 — urdeal.kr 에서 /assets/*.js 가 text/html 반환 → "Expected a JavaScript
//   module ... MIME type text/html" → 앱 로드 불능): 도메인 이전 후 '새 존' 정적 서빙 404 우회.
//   근본원인(#598 이 robots.txt·네이버 파일로 이미 확인): urdeal.kr 신규 존에서 _routes.json exclude 로
//   워커를 우회한 정적 경로가 404 → SPA HTML 폴백. /assets/* 도 exclude 라 동일 증상(청크 404→HTML→MIME).
//   → 워커가 env.ASSETS 로 직접 서빙(존재하면 원본 MIME + immutable, 없으면 깔끔한 404 로 정정해
//   HTML-as-JS MIME 에러 재발 차단 + 클라 청크-복구가 정상 동작). _routes.json 에서 /assets/* 를 exclude
//   에서 제거해 이 핸들러로 라우팅. ⚠️ 반드시 전-라우트 미들웨어(CSP/SSR/nonce) *앞*에 등록 —
//   에셋은 오버헤드 0 로 즉시 서빙 + 응답을 가로채는 rewriter 를 안 탐. immutable 라 엣지/브라우저 캐시.
// ============================================================
app.get('/assets/*', async (c) => {
  try {
    const assets = (c.env as unknown as { ASSETS?: { fetch: (r: Request) => Promise<Response> } }).ASSETS;
    if (!assets?.fetch) return c.text('Not Found', 404, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    const res = await assets.fetch(c.req.raw);
    const ctype = res.headers.get('content-type') || '';
    // env.ASSETS 는 미존재 파일에 SPA index.html(text/html)을 200 으로 돌려줌 → 그건 에셋이 아니므로 404 로
    //   정정(HTML 을 .js 로 주면 브라우저가 "Expected a JavaScript module ... text/html" 로 거부 = 원래 버그).
    //   404 면 클라(chunk-error.ts)가 __cb 캐시버스트로 최신 HTML(새 해시)을 받아 자가복구.
    if (!res.ok || ctype.includes('text/html')) {
      return c.text('Not Found', 404, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    }
    // ⚠️ res 를 init 으로 그대로 복제 → Content-Type/Content-Encoding/ETag 등 body 와 정합 유지
    //   (headers 재조립 시 인코딩 헤더/본문 불일치로 브라우저 디코드 오류 나는 footgun 회피). Cache-Control 만 override.
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // content-hash 파일 — _headers /assets/* 와 동일(워커 서빙 시 _headers 미적용이라 명시)
    return out;
  } catch {
    return c.text('Not Found', 404, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
  }
});

// ============================================================
// Admin Sub-Application (code-level separation)
// All admin routes go through their own Hono app with:
//   1. CORS
//   2. IP whitelist (ADMIN_IP_WHITELIST env var)
//   3. requireAdmin() auth
//   4. Audit logging middleware
// ============================================================
const adminApp = new Hono<{ Bindings: Env }>();
adminApp.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));
adminApp.use('*', adminIpWhitelist());
adminApp.use('*', requireAdmin());
adminApp.use('*', adminAuditMiddleware());

// ============================================================
// Global Middleware
// ============================================================

app.use('*', timing());
app.use('*', logger());
// Reject any request body larger than 1MB before it hits route handlers.
// Bulk-upload routes apply a larger limit locally if needed.
// 🔖 바이어 풀 북마클릿 인제스트는 상세 HTML 묶음(배치)을 받으므로 더 큰 바디 허용(자체 토큰 인증+CORS).
//    나머지 /api/* 는 1MB. (전역 1MB 가 이 경로의 배치를 CORS 없는 413 으로 잘라 북마클릿 실패하던 것 해소.)
const _bodyLimit1m = bodyLimit(1_000_000);
// buyer-ingest 는 상세 HTML 배치라 1MB 보다 커야 하나, 큰 캡은 무인증 파싱 증폭(DoS) 표면 → 1.5MB 로 축소.
//   북마클릿은 배치를 1.2MB 마다 flush(MAXB) 하므로 1.5MB 안에 충분히 들어감(Content-Length 초과분은 파싱 전 413).
//   토큰 검사가 바디 파싱 이후라, 캡이 낮을수록 무토큰 공격자의 사전-파싱 비용이 작아짐.
const _bodyLimitIngest = bodyLimit(1_500_000);
app.use('/api/*', (c, next) => c.req.path === '/api/buyer-ingest' ? _bodyLimitIngest(c, next) : _bodyLimit1m(c, next));
app.use('/api/*', i18nMiddleware);
// 인제스트는 토큰 인증 + 크로스오리진 → 전역 IP 레이트리밋 제외(429 가 CORS 없이 나가 북마클릿 배치 실패 방지). /known 서브경로 포함.
app.use('/api/*', (c, next) => c.req.path.startsWith('/api/buyer-ingest') ? next() : (rateLimiterMiddleware as any)(c, next));

// CORS — multi-region support
const _globalCors = cors({
  origin: (origin, c) => {
    const env = (c as any).env as Env;
    const allowed: string[] = [
      ...ALLOWED_ORIGINS,
      ...(env?.FRONTEND_URL ? [env.FRONTEND_URL] : []),
    ];
    if (!origin || allowed.includes(origin)) return origin ?? '';
    return '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Idempotency-Key',
    'X-Request-ID',
    'Accept-Language',
  ],
  exposeHeaders: ['X-Request-ID', 'Server-Timing'],
  credentials: true,
  maxAge: 86400,
});
// 🔖 북마클릿 인제스트(/api/buyer-ingest[/known])는 토큰 인증 + 자체 CORS(외부 B2B 오리진 허용) — 전역 cors(오리진 화이트리스트) 우회.
app.use('*', (c, next) => c.req.path.startsWith('/api/buyer-ingest') ? next() : _globalCors(c, next));

// ============================================================
// Security Headers (CSP etc.)
// ============================================================

// 🆔 Request ID 미들웨어 (2026-04-22 추가)
// CF ray ID 또는 crypto.randomUUID() 로 고유 ID 부여 후 response 헤더로 반환.
// 장애 발생 시 사용자가 이 ID 만 알려주면 Cloudflare Logs 에서 즉시 해당 요청 추적 가능.
app.use('*', async (c, next) => {
  const rayId = c.req.header('CF-Ray') || crypto.randomUUID();
  c.set('requestId' as never, rayId);
  await next();
  c.header('X-Request-Id', rayId);
});

// 🚨 5xx 스파이크 자동 감지 + Discord 알림 (1인 운영자용)
app.use('/api/*', errorRateMonitor());

// 🛡️ 2026-05-15: CSRF cookie 발급 (모든 GET 응답) — double-submit pattern.
//   POST/PATCH/DELETE 검증은 endpoint 별 csrfGuard() 적용 (Bearer 토큰은 자동 면제).
app.use('*', csrfIssue());

app.use('*', async (c, next) => {
  await next();
  // 🛡️ 2026-04-22: CSP nonce — 요청별 랜덤 nonce 로 inline script 허용 범위 제한.
  // 'unsafe-inline' 은 nonce 미지원 구형 브라우저용 fallback (CSP2+ 는 nonce 우선).
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes)).replace(/[+/=]/g, '');

  // Content-Security-Policy — worker-src blob: allows Web Workers from blob URLs
  // CSP — 공통 script sources (script-src와 script-src-elem에서 공유)
  // 🛡️ 2026-04-22 배치 121: strict-dynamic 재도입 + HTMLRewriter 가 모든 script 태그
  //   (inline & external src) 에 nonce 부여. 지난번 실패 원인: 외부 src script 에 nonce
  //   누락 → strict-dynamic 이 차단. 이번엔 HTMLRewriter 를 확장하여 script[src] 도 포함.
  //
  // 구성:
  //   - CSP3 브라우저: strict-dynamic 이 host allowlist 무시, nonce 만 신뢰. dynamic import()
  //     로 로드되는 chunk 는 부모 script 의 nonce 자동 propagation.
  //   - CSP2 브라우저: strict-dynamic 무시 → host allowlist 로 fallback.
  //   - 둘 다 unsafe-inline 도 설정되지만 CSP3 에서는 nonce 존재 시 자동 무시됨.
  const scriptSources = [
    "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'unsafe-inline'", "blob:",
    "https://*.cloudflare.com", "https://static.cloudflareinsights.com", "https://cloudflareinsights.com",
    "https://*.googletagmanager.com", "https://*.google-analytics.com",
    "https://*.tosspayments.com", "https://js.tosspayments.com",
    "https://*.stripe.com", "https://js.stripe.com", "https://m.stripe.network", "https://m.stripe.com",
    "https://*.firebase.google.com", "https://*.firebaseio.com", "https://*.firebasedatabase.app",
    FIREBASE_RTDB_URL,
    "https://apis.google.com", "https://*.googleapis.com",
    "https://kauth.kakao.com", "https://*.kakao.com", "https://t1.kakaocdn.net", "https://*.daumcdn.net",
    "https://www.youtube.com", "https://youtube.com", "https://s.ytimg.com", "https://*.youtube.com",
    "https://cdn.jsdelivr.net", "https://unpkg.com", "https://*.sentry.io",
    `https://*.firebaseapp.com`, FIREBASE_APP_URL,
  ].join(' ');

  c.header('Content-Security-Policy',
    "default-src 'self'; " +
    `script-src ${scriptSources}; ` +
    `script-src-elem ${scriptSources}; ` +
    "worker-src 'self' blob:; " +
    // 🛡️ 2026-05-21 REVERT: style-src nonce 도입 시도 → CSP3 가 unsafe-inline 무력화 →
    //   Tailwind/React inline style (수천 곳) nonce 없이 전부 차단 → 화면 깨짐.
    //   nonce 도입은 큰 리팩토링 필요. 일단 unsafe-inline 유지 (style 은 script 보다 XSS 위험 낮음).
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://*.stripe.com https://m.stripe.network; " +
    // img-src 'unsafe-inline' 은 CSP 스펙상 의미 없는 키워드 (제거 유지).
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
    `connect-src 'self' https: wss: https://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebaseio.com wss://*.firebasedatabase.app wss://${new URL(FIREBASE_RTDB_URL).host}; ` +
    "frame-src 'self' " +
      // 🛡️ 2026-07-20: Turnstile 위젯은 challenges.cloudflare.com iframe 필수 — 누락 시
      //   위젯 렌더 실패 → 토큰 없음 → (TURNSTILE_SECRET 설정 후) 로그인 전면 차단.
      "https://challenges.cloudflare.com " +
      "https://*.tosspayments.com https://js.tosspayments.com " +
      "https://*.stripe.com https://js.stripe.com https://m.stripe.network https://m.stripe.com " +
      `https://*.firebaseapp.com ${FIREBASE_APP_URL} ` +
      "https://*.firebase.google.com https://*.firebaseio.com " +
      "https://accounts.google.com https://*.google.com " +
      "https://apis.google.com " +
      "https://kauth.kakao.com https://*.kakao.com " +
      "https://www.youtube.com https://youtube.com https://*.youtube.com https://www.youtube-nocookie.com " +
      "https://player.vimeo.com; " +
    "child-src 'self' blob:; " +
    "media-src 'self' https: blob:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'self'; " +
    "report-uri /api/csp-report; report-to csp-endpoint;"
  );
  c.header(
    'Report-To',
    '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"/api/csp-report"}]}'
  );
  const url = new URL(c.req.url);
  // /embed/ 경로는 외부 사이트에서 iframe으로 임베드 가능하도록 허용
  if (url.pathname.startsWith('/embed/')) {
    c.header('Content-Security-Policy', c.res.headers.get('Content-Security-Policy')?.replace("frame-ancestors 'self'", "frame-ancestors *") || '');
    // X-Frame-Options 헤더 제거 (iframe 허용)
    c.res.headers.delete('X-Frame-Options');
  } else if (url.pathname.startsWith('/s/') || url.pathname.startsWith('/profile/') || url.pathname.startsWith('/live/')) {
    // 셀러 공개 페이지 + 라이브: 같은 도메인 iframe 허용 (대시보드 미리보기)
    c.header('X-Frame-Options', 'SAMEORIGIN');
  } else {
    c.header('X-Frame-Options', 'SAMEORIGIN');
  }
  if (url.hostname !== 'localhost' && url.protocol === 'https:') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  c.header('X-Content-Type-Options', 'nosniff');
  // ✅ X-XSS-Protection 제거: deprecated — 일부 브라우저에서 오히려 XSS를 유발 (HSTS/CSP로 대체)
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 🛡️ 2026-05-13: autoplay + fullscreen + picture-in-picture 명시 허용 — YouTube iframe 라이브 재생 차단 사고.
  //   기존 헤더에 autoplay 누락 → 브라우저 기본값 'self' 적용 → cross-origin YouTube iframe 의 autoplay 차단.
  //   결과: 셀러는 송출 됨, 시청자 페이지는 "터치하여 시청 시작" 영구 오버레이 후 클릭해도 무반응.
  //   iframe 의 allow="autoplay" 만으로는 부족 — 부모 페이지 Permissions-Policy 가 우선.
  c.header(
    'Permissions-Policy',
    'geolocation=(self), microphone=(self), camera=(self), payment=(self), usb=(), ' +
    'autoplay=*, fullscreen=*, picture-in-picture=*, encrypted-media=*'
  );
  // 2026-04-22 추가: Spectre-class 공격 차단 + cross-origin 이슈 방지
  c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // 카카오/구글 OAuth 팝업 허용
  c.header('Cross-Origin-Resource-Policy', 'same-site');
  c.header('X-Permitted-Cross-Domain-Policies', 'none'); // Flash/PDF 크로스도메인 차단

  // 🛡️ 2026-04-22 배치 121: HTML 응답에 nonce 주입 — 모든 <script> (inline & external src).
  //   strict-dynamic + nonce 조합: 신뢰된 script 가 dynamic 하게 로드하는 하위 script 는
  //   브라우저가 자동으로 nonce propagation (createElement('script') 케이스).
  // 🛡️ 2026-05-25 (loading P0): 메인 페이지 SSR inline — KV cache 에서 group-buy/products
  //   조회 + <head> 에 type="application/json" 으로 inject. 클라이언트는 inline 우선 사용.
  //   효과: 모바일 메인 LCP -0.3~0.5s (첫 API fetch waterfall 제거).
  //   부하: KV read 1회 + 정적 inject. 매 메인 요청 1회 (publicCache 5분 HIT 보장).
  const ct = c.res.headers.get('Content-Type') || '';
  if (ct.includes('text/html') && c.res.body) {
    const url = new URL(c.req.url);
    const isMainPage = url.pathname === '/' || url.pathname === '/index.html';

    // 🛡️ 2026-05-27 (loading P0): SSR data 사전 fetch — multi-page robust.
    //   페이지별 critical endpoint 1개를 KV → self-fetch (150ms) 순서로 inject.
    //   클라이언트는 __SSR_INITIAL_${slot}__ 읽어 useQuery initialData 로 즉시 render.
    //   - main: /api/group-buy/products?status=active&category=all
    //   - detail (/group-buy/:id): /api/group-buy/products/:id
    //   - seller (/profile/:username): /api/sellers/:username/public
    type SsrTarget = { slot: string; path: string };
    let ssrTarget: SsrTarget | null = null;

    if (isMainPage) {
      // 🛡️ 2026-06-18 [UNLOCK_LOADING] (대표 결정 — 홈 = 동네딜 중심): 홈 SSR 슬롯을 교환권(deal_only) →
      //   동네딜(group-buy active) 데이터로 전환. GroupBuyFeed(category='all')가 __SSR_INITIAL_MAIN__ 를
      //   consume → 0-RTT. 이 path 는 cache-prewarm HOT_PATHS 의 '/api/group-buy/products?status=active&category=all'
      //   와 1:1 일치(이미 prewarm 됨). 교환권은 홈에서 강등 → /vouchers(자체 __SSR_INITIAL_VOUCHERS__).
      ssrTarget = { slot: 'MAIN', path: '/api/group-buy/products?status=active&category=all' };
    } else if (url.pathname === '/vouchers' && !url.search) {
      // 🛡️ 2026-05-27: VouchersPage first-paint inject (no query — default 페이지).
      //   클라이언트가 categoryParam/brand 변경 시 새 fetch — SSR 첫 진입만 효과.
      //   /api/vouchers/categories 는 cron warming + publicCache 5분 → edge cache 항상 hit.
      ssrTarget = { slot: 'VOUCHERS', path: '/api/products?page=1&limit=20&deal_only=1&sort=price_low' };
    } else if (url.pathname === '/browse' && !url.search) {
      ssrTarget = { slot: 'BROWSE', path: '/api/products?page=1&limit=20&exclude_deal_only=1' };
    // 🥗 2026-07-15 워커 다이어트: /live SSR 슬롯 제거 — 라이브커머스 영구중단으로 /live 라우트·/api/streams 마운트 모두 제거됨(죽은 self-fetch).
    // } else if (url.pathname === '/live' && !url.search) {
    //   ssrTarget = { slot: 'LIVE', path: '/api/streams?status=live&limit=20' };
    // 🗑️ 2026-07-10 [UNLOCK_LOADING] (로딩 전수조사): GROUPBUY 슬롯 제거 — `/group-buy` 는 App.tsx 에서
    //   `<Navigate to="/" replace/>`(홈으로 즉시 리다이렉트)이고 유일 소비자 GroupBuyListPage 는 미라우팅.
    //   콜드 시 최대 1.5s self-fetch 로 리다이렉트 응답만 느리게 만들던 순수 낭비였음. (라우트가 부활하면
    //   이 분기 + GroupBuyListPage 의 __SSR_INITIAL_GROUPBUY__ 소비를 함께 복원할 것.)
    } else if (url.pathname === '/wholesale' && !url.search) {
      // 🏭 2026-06-10 [LOADING_ADDITIVE] (사용자 신고 — 도매몰 상품 느림): guest 카탈로그 SSR inject.
      //   HTML→JS→fetch 3-RTT 워터폴 제거 — 카드가 첫 페인트에 즉시. 비로그인(공유 응답)만 consume
      //   (로그인 등급가는 클라가 fetch — 등급 캐시로 빠름). prewarm 키와 동일 path.
      ssrTarget = { slot: 'WHOLESALE', path: '/api/wholesale/catalog' };
    } else if (url.pathname === '/blog' && !url.search) {
      // 📝 2026-07-01 블로그 목록 SSR — BlogListPage 가 __SSR_INITIAL_BLOG__ 를 0-RTT consume(마운트 후
      //   cold fetch 워터폴 제거) + 아래 head rewrite 에서 Blog/ItemList 구조화데이터 주입(검색 리치결과).
      //   path 는 클라(limit=100)와 정확히 일치해야 edge-key hit — prewarm 키도 동일하게 추가.
      ssrTarget = { slot: 'BLOG', path: '/api/blog/public?limit=100' };
    } else if (/^\/blog\/[^/]+$/.test(url.pathname)) {
      // 📝 2026-07-01 블로그 상세 SSR — 비-JS 크롤러(네이버/카카오/소셜 스크래퍼)용 서버 메타/JSON-LD 주입 +
      //   0-RTT. /api/blog/public/:slug 는 publicCache(180) → edge-hit. 아래 head rewrite 에서 payload 로 메타 생성.
      const blogSlug = decodeURIComponent(url.pathname.slice('/blog/'.length));
      if (blogSlug) ssrTarget = { slot: 'BLOGPOST', path: `/api/blog/public/${encodeURIComponent(blogSlug)}` };
    } else {
      // 🛡️ 2026-05-30 (loading): /products/:id 상세 SSR inject — 기존엔 누락되어 마운트 후
      //   useProduct fetch 워터폴(HTML→JS→fetch 3-RTT). /api/products/:id 는 publicCache(120) → edge-hit.
      const productMatch = url.pathname.match(/^\/products\/(\d+)(?:[/?#]|$)/);
      // 🛡️ 2026-05-27: 셋 다 같은 endpoint → 같은 SSR slot. 🎟️ 2026-08-16 정본은 `/pass/:id`
      //   (옛 `/group-buy/:id` 도 남긴다 — 301 이 안 걸린 요청도 시드를 받게, 방어적).
      const detailMatch = url.pathname.match(/^\/(?:pass|group-buy|vouchers)\/(\d+)(?:[/?#]|$)/);
      // 🏨 2026-07-20 (대표 — 숙소 상세 SSR/OG): /stays/:id 도 DETAIL 패턴으로 0-RTT + 서버 메타.
      const stayMatch = url.pathname.match(/^\/stays\/(\d+)(?:[/?#]|$)/);
      if (productMatch) {
        ssrTarget = { slot: 'PRODUCT', path: `/api/products/${productMatch[1]}` };
      } else if (detailMatch) {
        ssrTarget = { slot: 'DETAIL', path: `/api/group-buy/products/${detailMatch[1]}` };
      } else if (stayMatch) {
        ssrTarget = { slot: 'STAYDETAIL', path: `/api/group-buy/stays/${stayMatch[1]}` };
      } else {
        // 🛡️ 2026-05-27: /profile/:sellerId 외 /s/:sellerId 도 동일 SellerPublicPage — SSR inject 확장.
        const profileMatch = url.pathname.match(/^\/(?:profile|s)\/([A-Za-z0-9_-]{1,40})(?:[/?#]|$)/);
        if (profileMatch) {
          ssrTarget = { slot: 'SELLER', path: `/api/sellers/${profileMatch[1]}/public` };
        } else {
          // 🛡️ 2026-05-27 (큐레이터 SSR): /u/:handle 도 inject — 큐레이터 페이지 로딩 ↓.
          const curatorMatch = url.pathname.match(/^\/u\/([A-Za-z0-9_-]{1,40})(?:[/?#]|$)/);
          if (curatorMatch && curatorMatch[1] !== 'me') {
            ssrTarget = { slot: 'CURATOR', path: `/api/curator/${curatorMatch[1]}` };
          } else {
            // 🏬 2026-08-01 세션 ③-a — 운영자 몰 `urdeal.kr/{슬러그}`.
            //   🔴 **매처 중 가장 마지막**이다. 1-세그먼트를 전부 후보로 볼 수 있으므로,
            //      `isMallLookupCandidate` 로 **예약어(=실 라우트)와 문법 밖을 먼저 잘라낸다.**
            //      그래서 기존 소비자 경로는 이 분기에 **도달조차 하지 않고**, self-fetch 도 안 생긴다.
            //   ⚠️ 몰이 아니면 `/api/mall/:slug` 가 404 → ssrPayload 없음 → **기본 메타 그대로**(fail-soft).
            const mallSeg = url.pathname.split('/')[1] || '';
            if (isMallLookupCandidate(mallSeg) && !url.pathname.slice(1).includes('/')) {
              ssrTarget = { slot: 'MALL', path: `/api/mall/${encodeURIComponent(mallSeg)}` };
            } else {
              // 🏬 2026-08-11 몰 상품 상세 — 없으면 카톡 카드가 제네릭(근거: resolveMallProductSlot).
              ssrTarget = resolveMallProductSlot(url.pathname) ?? ssrTarget;
            }
          }
        }
      }
    }

    let ssrPayload: string | null = null;
    let ssrStatus = 'skip';
    // 🛡️ 2026-05-27 (production 측정): Server-Timing 헤더 — Chrome DevTools 에서 직접 확인.
    //   edge-read / self-fetch 각각 시간 기록 → 어디서 시간 쓰는지 즉시 파악.
    const timings: string[] = [];
    if (ssrTarget) {
      // 🛡️ 2026-05-27 (비용 최적화 + 속도): edge cache (`caches.default`) 직접 read.
      //   기존: KV second-layer read (~50ms) → KV write 한도 초과 → 비용 발생.
      //   변경: edge cache 직접 read (~5ms). KV 의존성 0, 비용 $0, 속도 더 빠름.
      //   miss 시 self-fetch fallback (publicCache middleware 가 edge cache 자동 write).
      const edgeStart = Date.now();
      try {
        const origin = new URL(c.req.url).origin;
        const cacheKey = new Request(`${origin}${ssrTarget.path}`, { method: 'GET' });
        // @ts-expect-error — Cloudflare Workers 전역 caches
        const cached = await caches.default.match(cacheKey);
        if (cached && cached.status >= 200 && cached.status < 300) {
          const body = await cached.text();
          ssrPayload = body.replace(/<\/script/gi, '<\\/script');
          ssrStatus = 'edge-hit';
        }
      } catch { /* edge cache unavailable */ }
      timings.push(`edge;dur=${Date.now() - edgeStart}`);

      // 🌍 2026-07-12 [UNLOCK_LOADING] (대표 "계속, 이상적으로" — 콜드 콜로 TTFB 마감): edge(콜로별) miss 여도
      //   self-fetch(콜드 D1, 0.5~1.5s 를 응답 전에 대기) 전에 **전역 KV**(cron 이 15분 표본화로 기록,
      //   cache-prewarm.ts SSR_KV_PATHS)를 먼저 본다 — 어느 콜로든 ~수십 ms 에 페이로드 확보 → TTFB 급감.
      //   CACHE_KV 미바인딩/미기록 키(상세 등 롱테일)는 miss → 기존 self-fetch 로 폴백(현행 100% 동일).
      //   잠긴 caches.default read·self-fetch 타임아웃·주입 로직 전부 불변 — 계층 1개 additive.
      if (!ssrPayload && c.env.CACHE_KV) {
        const kvStart = Date.now();
        try {
          const raw = await c.env.CACHE_KV.get(`ssr:${ssrTarget.path}`, 'text');
          if (raw && raw.startsWith('{')) {
            ssrPayload = raw.replace(/<\/script/gi, '<\\/script');
            ssrStatus = 'kv-hit';
          }
        } catch { /* KV 불가 — self-fetch 폴백 */ }
        timings.push(`kv;dur=${Date.now() - kvStart}`);
      }

      if (!ssrPayload) {
        // 🛡️ 2026-05-27 v2: timeout 증가 — cold start 시 fresh inject 보장.
        //   이전: MAIN 150ms / DETAIL 250ms — cold 시 self-fetch-timeout → 클라가 직접 fetch → 10초+ timeout
        //   변경: MAIN 1500ms / DETAIL/SELLER 2000ms — wait 후 fresh data inject 보장.
        //   trade-off: cold 첫 사용자 1-2초 wait. warm 사용자 (99%+) 영향 0 (edge-hit 가 먼저 응답).
        // 🏭 2026-06-19 [UNLOCK_LOADING] (대표 신고 — 도매 카탈로그 스켈레톤 고착, HTML 증거: __SSR_INITIAL_WHOLESALE__
        //   미주입): 저트래픽 도매몰은 colo 캐시가 대부분 cold → self-fetch 가 콜드 D1(isolate 콜드스타트+ensure+조회)을
        //   1.5초 안에 못 끝내 timeout → 빈 ssrPayload → 주입 스킵 → 클라가 또 콜드 fetch(스켈레톤 장기화).
        //   WHOLESALE 만 3000ms 로 상향 → 콜드여도 데이터 주입 완료(첫 사용자만 ~2-3초 문서 wait, 이후 colo 캐시 300s).
        //   warm(edge-hit) 경로·타 슬롯·소비자 페이지 전부 불변. 근본 해결은 CACHE_KV 전역 워밍(self-fetch=KV-HIT).
        // 🧭 2026-06-30 [UNLOCK_LOADING] (대표 신고 — /u/ 링크샵 로딩): CURATOR(/u/:handle)는 사업자면
        //   SELLER(/profile)와 **동일한 SellerPublicPage** 를 그리고 콜드 D1 비용도 비슷한데 타임아웃이 1500ms 라
        //   /profile(2000ms)보다 cold self-fetch 가 더 자주 timeout → SSR 미주입 → CuratorPage 스켈레톤 더 자주 노출.
        //   같은 페이지군이므로 CURATOR 를 2000ms 로 맞춤(warm/edge-hit·타 슬롯·소비자 페이지 불변 — 콜드 첫 사용자만 영향).
        const timeoutMs = (ssrTarget.slot === 'DETAIL' || ssrTarget.slot === 'SELLER' || ssrTarget.slot === 'PRODUCT' || ssrTarget.slot === 'CURATOR' || ssrTarget.slot === 'BLOGPOST' || ssrTarget.slot === 'BLOG' || ssrTarget.slot === 'STAYDETAIL') ? 2000
          : ssrTarget.slot === 'WHOLESALE' ? 3000
          : 1500;
        const ctlr = new AbortController();
        const timer = setTimeout(() => ctlr.abort(), timeoutMs);
        const selfStart = Date.now();
        try {
          const origin = new URL(c.req.url).origin;
          const r = await fetch(`${origin}${ssrTarget.path}`, {
            signal: ctlr.signal,
            headers: { 'x-ssr-prefetch': '1', 'User-Agent': 'ur-live-ssr-prefetch/1.0' },
          });
          if (r.ok) {
            const body = await r.text();
            ssrPayload = body.replace(/<\/script/gi, '<\\/script');
            ssrStatus = 'self-fetch-hit';
          } else {
            ssrStatus = `self-fetch-${r.status}`;
          }
        } catch {
          ssrStatus = 'self-fetch-timeout';
        } finally {
          clearTimeout(timer);
        }
        timings.push(`self;dur=${Date.now() - selfStart}`);
      }
      c.res.headers.set('X-SSR-Status', `${ssrTarget.slot}:${ssrStatus}`);
      if (timings.length > 0) c.res.headers.set('Server-Timing', timings.join(', '));
    }

    // 🛡️ 2026-05-30 (loading): Early Hints — cross-origin preconnect 를 응답 Link 헤더로 송출.
    //   index.html <head> 의 잠긴 3개 preconnect origin 과 동일(미러 — 변경 아님).
    //   Cloudflare Early Hints(대시보드 Speed→Optimization toggle) 켜지면 103 으로 HTML 본문 전 송출(무료).
    //   toggle off 여도 응답 헤더라 브라우저가 본문 파싱 전 preconnect 시작 → 소폭 이득, 회귀 0.
    c.res.headers.append('Link', '<https://cdn.jsdelivr.net>; rel=preconnect; crossorigin, <https://t1.kakaocdn.net>; rel=preconnect; crossorigin, <https://img1.kakaocdn.net>; rel=preconnect; crossorigin');

    const ssrSlot = ssrTarget?.slot ?? 'MAIN';
    // 🏭 2026-06-05 (사용자 신고 — 도매몰 진입 시 소비자 홈 화면이 잠깐 깜빡임):
    //   prerender 된 index.html 의 #root 에는 소비자 홈 shell(다크 테마·라이브/동네딜 nav 등)이 구워져 있어
    //   /wholesale·/supplier 를 hard-load 하면 React 가 도매 페이지로 라우팅하기 전 그 소비자 shell 이 첫 paint 에
    //   잠깐 보임(다른 업태·다른 테마라 이질적). 해당 surface 에서만 #root 를 도매 라이트 배경 placeholder 로 비워
    //   깜빡임 제거. createRoot(비-hydrate)라 안전. 소비자 페이지의 0-RTT shell·SSR inject 는 불변(additive).
    const isWholesaleSurface = /^\/(wholesale|supplier)(\/|$)/.test(url.pathname);
    // 🏁 2026-06-13 [LOADING_ADDITIVE] (사용자 신고 — "대부분 페이지 로딩 중 / 홈이 잠깐 등장"):
    //   대시보드(seller/admin/agency) hard-load 시에도 prerender 된 #root 의 소비자 홈 shell(다크·라이브 nav)이
    //   첫 paint 에 잠깐 보임 → 도매 surface 와 동일하게 #root 를 라이트 placeholder 로 비워 깜빡임 제거.
    //   createRoot(비-hydrate)라 안전 · 소비자 페이지 SSR inject/0-RTT shell 불변(additive).
    const isDashboardSurface = /^\/(seller|admin|agency)(\/|$)/.test(url.pathname);
    // 🆕 2026-06-26 3번째 서비스(통합 마케팅, /ads) — 도매몰처럼 자체 라이트 surface. 소비자 홈 shell 깜빡임 차단(additive).
    const isMarketingSurface = /^\/(ads)(\/|$)/.test(url.pathname);
    const needsRootBlank = isWholesaleSurface || isDashboardSurface || isMarketingSurface;
    // 🗑️ 2026-07-10 [UNLOCK_LOADING] (로딩 전수조사): isLinkshopSurface(06-21)·isDetailSurface(06-22) 데드
    //   변수 제거 — 2026-07-07 catch-all `else` 가 두 표면을 포함한 모든 잔여 HTML 라우트에 URDEAL 정적 로더를
    //   주입하면서 대체됐는데(#root 분기에서 미참조), 정의와 낡은 주석("#root 비움")만 남아 오독을 유발했음.
    // 📝 2026-07-01 블로그(/blog·/blog/:slug)도 소비자 테마 페이지 — 홈 shell 잔상 제거(#root 비움).
    const isBlogSurface = /^\/blog(?:\/|$)/.test(url.pathname);
    // 🚀 2026-07-12 [UNLOCK_LOADING] (대표 "이용권 페이지 로딩 아쉬워" — /group-buy/2609 실측): 하드로드
    //   로더 구간(~1.2s)의 대부분이 **lazy 페이지 청크 직렬 다운로드**(엔트리 실행 후에야 발견) —
    //   라우트별 청크를 modulepreload 로 head 에 주입해 엔트리와 **병렬** 다운로드.
    //   맵은 빌드 시 vite manifest 로 생성(generate-route-chunk-map.mjs → generated/route-chunk-map.ts,
    //   같은 빌드의 해시와 항상 일치). 맵에 없는 표면/빈 맵(로컬 워커 단독 빌드)은 조용히 생략.
    const chunkSurface = url.pathname === '/' || url.pathname === '/index.html' ? 'home'
      : /^\/(?:pass|group-buy)\/\d+(?:[/?#]|$)/.test(url.pathname) ? 'gbDetail'
      : /^\/vouchers\/\d+(?:[/?#]|$)/.test(url.pathname) ? 'voucherDetail'
      : /^\/products\/\d+(?:[/?#]|$)/.test(url.pathname) ? 'product'
      : /^\/(u|profile|s)(\/|$)/.test(url.pathname) ? 'linkshop'
      : url.pathname === '/vouchers' ? 'vouchers'
      : url.pathname === '/browse' ? 'browse'
      : null;
    const routeChunks = chunkSurface ? ROUTE_CHUNK_MAP[chunkSurface] : undefined;
    let rb = new HTMLRewriter()
      .on('script', {
        element(el) { el.setAttribute('nonce', nonce); },
      })
      .on('meta[name="csp-nonce"]', {
        element(el) { el.setAttribute('content', nonce); },
      })
      .on('head', {
        element(el) {
          // 🚀 2026-07-12 [UNLOCK_LOADING]: 라우트 청크 modulepreload 주입(엔트리와 병렬 다운로드) —
          //   Vite 가 index.html 에 넣는 modulepreload 와 동일 속성(crossorigin). css 는 preload(as=style).
          //   SSR payload 유무와 무관(청크는 항상 필요). 상세 주석은 위 chunkSurface 선언부.
          if (routeChunks) {
            for (const f of routeChunks.js) {
              el.append(`<link rel="modulepreload" crossorigin href="${f}">`, { html: true });
            }
            for (const f of routeChunks.css) {
              el.append(`<link rel="preload" as="style" crossorigin href="${f}">`, { html: true });
            }
          }
          if (ssrPayload) {
            // 🛡️ 2026-05-27: slot-prefixed script id — 클라이언트가 페이지별 inject 구별.
            //   기존 __SSR_INITIAL_MAIN__ 호환 유지 (main slot 은 같은 id).
            const scriptId = ssrSlot === 'MAIN' ? '__SSR_INITIAL_MAIN__' : `__SSR_INITIAL_${ssrSlot}__`;
            el.append(
              `<script id="${scriptId}" type="application/json">${ssrPayload}</script>`,
              { html: true },
            );
            // 🖼️ 2026-07-02 [UNLOCK_LOADING] (대표 "사진이 빠르게 안 나타남"): 공구/교환권 상세 히어로가
            //   프리로드 스캐너를 못 타(공구=CSS background-image, 교환권=React 렌더 후 <img>)
            //   [엔트리→페이지 청크→렌더] 뒤에야 다운로드 시작 → 사진이 늦게 뜸. seed 의 image_url 로
            //   클라와 **동일 함수**(cfImage/cfSrcSet 공유 import)로 URL 을 만들어 <link rel=preload as=image>
            //   주입 → HTML 파싱 즉시 병렬 다운로드, 렌더 시점엔 캐시 적중(byte-일치 보장).
            //   표면별 정합: /group-buy/:id 히어로=cfImage(900) 단일 URL ↔ /vouchers/:id 히어로=
            //   cfImage(800)+cfSrcSet(800) 밀도 srcSet → preload 도 각각 동일 형태로(불일치 시 이중 다운로드).
            //   (Save-Data 사용자만 quality 65 로 URL 이 달라 미적중 — 히어로 1장 한정 허용 트레이드오프.)
            if (ssrSlot === 'DETAIL') {
              try {
                const seed = JSON.parse(ssrPayload) as { data?: { image_url?: string } };
                const heroSrc = seed?.data?.image_url;
                if (heroSrc) {
                  const esc = (s: string) => s.replace(/"/g, '&quot;');
                  const isVoucherSurface = url.pathname.startsWith('/vouchers/');
                  const heroUrl = isVoucherSurface
                    ? cfImage(heroSrc, { width: 800, format: 'auto' })
                    : cfImage(heroSrc, { width: 900, format: 'auto' });
                  const heroSrcSet = isVoucherSurface ? cfSrcSet(heroSrc, 800) : '';
                  if (heroUrl && !heroUrl.startsWith('data:')) {
                    el.append(
                      `<link rel="preload" as="image" fetchpriority="high" href="${esc(heroUrl)}"${heroSrcSet ? ` imagesrcset="${esc(heroSrcSet)}"` : ''}>`,
                      { html: true },
                    );
                  }
                }
              } catch { /* seed 파싱 실패 — preload 생략(치명 아님) */ }
            }
          }
        },
      });
    if (isWholesaleSurface) {
      // 🏭 2026-06-08 도매 surface 서버측 OG/canonical 주입 — JS 안 도는 소셜 스크래퍼(카톡/페북/슬랙)·일부 봇은
      //   react-helmet(클라 렌더)을 못 보고 index.html 의 소비자 기본 메타만 봄. utongstart 정식 도메인 육성을 위해
      //   도매 surface 응답의 head 메타를 도매 브랜드값으로 rewrite + utongstart canonical append.
      //   (Googlebot 은 JS 렌더해 react-helmet 의 페이지별 정밀 메타를 봄 — 본 주입은 비-JS 크롤러용 fallback.)
      const wsTitle = '유통스타트 도매몰 — 제조사 직거래 B2B 도매사이트';
      const wsDesc = '검증 제조사 상품을 판매사 등급별 도매 공급가로. 무재고 위탁판매·OEM·사입까지, 도매가 거래 B2B 플랫폼.';
      const wsCanonical = `https://utongstart.com${url.pathname}`;
      rb = rb
        .on('title', { element(el) { el.setInnerContent(wsTitle); } })
        .on('meta[name="description"]', { element(el) { el.setAttribute('content', wsDesc); } })
        .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', wsTitle); } })
        .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', wsDesc); } })
        .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', wsCanonical); } })
        .on('meta[property="og:site_name"]', { element(el) { el.setAttribute('content', '유통스타트'); } })
        .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', wsTitle); } })
        .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', wsDesc); } })
        // 🏭 도매 surface 파비콘(브라우저 탭) = 유통스타트 마크(유어딜 UR 아님). 링크 href 를 도매 파비콘으로 rewrite.
        .on('link[rel="icon"]', { element(el) { el.setAttribute('href', '/favicon-utong.svg'); el.setAttribute('type', 'image/svg+xml'); } })
        .on('link[rel="apple-touch-icon"]', { element(el) { el.setAttribute('href', '/favicon-utong.svg'); } })
        .on('head', { element(el) { el.append(`<link rel="canonical" href="${wsCanonical}">`, { html: true }); } });
    }
    if (isMarketingSurface) {
      // 🆕 2026-07-01 유어애즈(/ads) surface 서버측 OG/canonical 주입 — 도매 surface 와 동일 패턴.
      //   비-JS 크롤러/소셜 스크래퍼(카톡/페북/슬랙)는 react-helmet(<SEO>)을 못 봐 index.html 의
      //   소비자(유어딜) 기본 메타만 봄 → 마케팅 랜딩 공유/검색 시 "유어딜..."로 오노출되던 것 교정.
      const adTitle = '유어애즈 UR Ads — 네이버 검색광고 자동화·키워드 분석 마케팅 툴';
      const adDesc = '연관키워드·검색량 분석, 자동입찰, 쇼핑 순위 추적, 부정클릭 방어, AI 주간 리포트까지. 네이버 광고 성과를 높이는 셀러 마케팅 자동화 도구.';
      const adCanonical = `${new URL(c.req.url).origin}${url.pathname}`;
      const adOgImg = `${new URL(c.req.url).origin}/og-urads.png`;
      rb = rb
        .on('title', { element(el) { el.setInnerContent(adTitle); } })
        .on('meta[name="description"]', { element(el) { el.setAttribute('content', adDesc); } })
        .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', adTitle); } })
        .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', adDesc); } })
        .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', adCanonical); } })
        .on('meta[property="og:site_name"]', { element(el) { el.setAttribute('content', '유어애즈'); } })
        .on('meta[property="og:image"]', { element(el) { el.setAttribute('content', adOgImg); } })
        .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', adTitle); } })
        .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', adDesc); } })
        .on('meta[name="twitter:image"]', { element(el) { el.setAttribute('content', adOgImg); } })
        .on('head', { element(el) { el.append(`<link rel="canonical" href="${adCanonical}">`, { html: true }); } });
    }
    // 📝 2026-07-01 블로그 서버측 메타/구조화데이터 주입 — JS 안 도는 크롤러(네이버/카카오/소셜)용.
    //   Googlebot 은 react-helmet(<SEO>)을 렌더해 보지만, 네이버·소셜 스크래퍼는 정적 HTML 메타만 봄.
    const origin2 = new URL(c.req.url).origin;
    if (ssrSlot === 'BLOGPOST' && ssrPayload) {
      // 📝 순수 계산은 blog-ssr-meta.ts 로 추출(god 파일 성장 방지) — 여기선 rewriter 배선만.
      const m = buildBlogPostMeta(ssrPayload, origin2);
      if (m) {
        rb = rb
          .on('title', { element(el) { el.setInnerContent(m.pageTitle); } })
          .on('meta[name="description"]', { element(el) { el.setAttribute('content', m.description); } })
          .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', m.title); } })
          .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', m.description); } })
          .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', m.canonical); } })
          .on('meta[property="og:type"]', { element(el) { el.setAttribute('content', 'article'); } })
          .on('meta[property="og:image"]', { element(el) { el.setAttribute('content', m.ogImage); } })
          .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', m.title); } })
          .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', m.description); } })
          .on('meta[name="twitter:image"]', { element(el) { el.setAttribute('content', m.ogImage); } })
          .on('head', { element(el) {
            el.append(`<link rel="canonical" href="${m.canonical}">`, { html: true });
            el.append(`<link rel="alternate" type="application/rss+xml" title="유어딜 블로그 RSS" href="${origin2}/blog/rss">`, { html: true });
            el.append(`<script type="application/ld+json">${m.jsonLd}</script>`, { html: true });
          } });
      }
    } else if (url.pathname === '/blog') {
      const bt = '유어딜 블로그 — 이용권·교환권·동네딜·링크샵 가이드';
      const bd = '할인가로 사서 매장에서 바로 쓰는 이용권, 기프티콘 교환권, 내 주변 동네딜, 나만의 링크샵까지. 유어딜 활용법과 서비스 소식을 전합니다.';
      const canon = `${origin2}/blog`;
      // 📝 목록 Blog+ItemList JSON-LD — payload 기반(콜드 timeout 시 '') 계산은 blog-ssr-meta.ts.
      const listJsonLd = buildBlogListJsonLd(ssrPayload, origin2, canon, bt, bd);
      rb = rb
        .on('title', { element(el) { el.setInnerContent(bt); } })
        .on('meta[name="description"]', { element(el) { el.setAttribute('content', bd); } })
        .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', bt); } })
        .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', bd); } })
        .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', canon); } })
        .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', bt); } })
        .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', bd); } })
        .on('head', { element(el) {
          el.append(`<link rel="canonical" href="${canon}">`, { html: true });
          el.append(`<link rel="alternate" type="application/rss+xml" title="유어딜 블로그 RSS" href="${origin2}/blog/rss">`, { html: true });
          if (listJsonLd) el.append(`<script type="application/ld+json">${listJsonLd}</script>`, { html: true });
        } });
    }
    // 🔗 2026-07-01 [UNLOCK_LOADING] (대표 승인 — 링크샵 전수조사): /u/:handle 링크샵 서버측 OG/canonical 주입.
    //   그간 CURATOR 슬롯은 __SSR_INITIAL_CURATOR__ 데이터만 주입하고 메타는 index.html 소비자 기본값(제네릭 홈)을
    //   그대로 서빙 → 카톡/소셜 공유·비-JS 크롤러가 "정지원 링크샵"이 아니라 "유어딜 홈" 카드를 봄. 개인화 OG 코드는
    //   실제 안 타는 app.get('*') fallback 에만 있었음(무효). WHOLESALE/BLOGPOST 와 동일하게 서빙 경로(HTMLRewriter)
    //   에서 rewrite. **SSR inject(__SSR_INITIAL_CURATOR__)·0-RTT·#root 비움·edgeCache 전부 불변 — 메타 rewrite만 additive.**
    // 🏬 2026-08-01 세션 ③-a 〔대표 UX 기준 ② — "OG 메타가 곧 매대다"〕
    //   카톡방에 몰 링크가 붙을 때 **누구의 판인지**가 먼저 읽혀야 한다. 몰 이름이 title 앞에 온다.
    //   ⚠️ 잘못 나간 미리보기는 카톡 스크랩 캐시에 **박제**된다 — 그래서 payload 가 없으면
    //      추측하지 않고 **기본 메타를 그대로 둔다**(mall-ssr-meta.ts 의 fail-closed 와 같은 방침).
    // 🏬 2026-08-11 몰 상품 카톡 카드. payload 없거나 모양이 다르면 기본 메타 그대로(fail-closed).
    if (ssrSlot === 'MALLPRODUCT' && ssrPayload) {
      const mpm = mallProductPathSurfaceMeta(ssrPayload, origin2, url.pathname);
      if (mpm) rb = applySurfaceMeta(rb, mpm);
    }
    if (ssrSlot === 'MALL' && ssrPayload) {
      try {
        const m = (JSON.parse(ssrPayload) as { mall?: { name?: string; slug?: string; intro?: string; logoUrl?: string | null; naver_verification?: string | null } })?.mall;
        if (m && m.name) {
          const mTitle = `${m.name} - 공동구매`;
          const mDesc = String(m.intro || '').slice(0, 200) || `${m.name}의 공동구매`;
          const mCanon = `${origin2}/${m.slug || ''}`;
          const mImg = m.logoUrl ? (String(m.logoUrl).startsWith('http') ? String(m.logoUrl) : `${origin2}${m.logoUrl}`) : `${origin2}/og-image.svg`;
          rb = rb
            .on('title', { element(el) { el.setInnerContent(mTitle); } })
            .on('meta[name="description"]', { element(el) { el.setAttribute('content', mDesc); } })
            .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', mTitle); } })
            .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', mDesc); } })
            .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', mCanon); } })
            .on('meta[property="og:image"]', { element(el) { el.setAttribute('content', mImg); } })
            .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', mTitle); } })
            .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', mDesc); } })
            .on('meta[name="twitter:image"]', { element(el) { el.setAttribute('content', mImg); } })
            .on('link[rel="canonical"]', { element(el) { el.setAttribute('href', mCanon); } });
          // 📣 2026-08-09 과업① — 몰별 네이버 웹마스터 소유확인 메타(사이트 전역 메타는 보존, **추가**만).
          //   영숫자만 저장되므로(어드민 검증) 속성 주입 안전. 경로 몰에선 참고용, 커스텀 도메인 연결 시 유효.
          const mNaver = String(m.naver_verification || '').trim();
          if (/^[a-zA-Z0-9]{8,80}$/.test(mNaver)) {
            rb = rb.on('head', { element(el) {
              el.append(`<meta name="naver-site-verification" content="${mNaver}">`, { html: true });
            } });
          }
        }
      } catch { /* 파싱 실패 — 기본 메타 유지 */ }
    }

    if (ssrSlot === 'CURATOR' && ssrPayload) {
      try {
        const cur = (JSON.parse(ssrPayload) as { curator?: { name?: string; bio?: string; handle?: string; profile_image?: string | null } })?.curator;
        if (cur && (cur.name || cur.handle)) {
          const cName = String(cur.name || '@' + (cur.handle || ''));
          const cTitle = `${cName} 링크샵 - 유어딜`;
          const cDesc = String(cur.bio || '').slice(0, 200) || `${cName}님의 추천 — 교환권·이용권 모음`;
          const canon = `${origin2}/u/${cur.handle || ''}`;
          // 🖼️ 2026-07-01 (전수조사 후속 A): og:image 는 전용 OG 카드(1200×630 SVG, 이름·핸들·프로필 합성)를
          //   사용 — 정사각 raw 프로필보다 소셜(카톡/트위터/FB) 카드 비율에 맞음(블로그 `/blog/og/:slug` 와 동일 방식).
          //   프로필 유무와 무관하게 카드가 렌더되므로 무조건 설정. `/api/og/curator/:handle` = og-image.routes.ts.
          const ogCard = `${origin2}/api/og/curator/${encodeURIComponent(cur.handle || '')}`;
          // 🔁 2026-07-29: 동일한 `.on()` 체인이 표면마다 복붙돼 있던 것을 `applySurfaceMeta` 로 통일
          //   (셀렉터·순서·값 전부 동일 — 출력 불변). canonical 은 이제 속성 이스케이프를 거친다.
          rb = applySurfaceMeta(rb, {
            pageTitle: cTitle, title: cTitle, description: cDesc,
            canonical: canon, ogType: 'profile', ogImage: ogCard,
          });
        }
      } catch { /* 파싱 실패 시 기본 메타 유지 */ }
    }
    // 🎯 2026-07-02 (대표 "아직 조금 끊김"): 워드마크를 UrDealLogo(React SSOT)와 픽셀 동일하게 —
    //   size34 사전계산. 이전 평문 "UR·DEAL" 은 React 로더 교체 순간 미세 점프.
    //   테마 가변 대응: dark: variant 로 다크/라이트 자동. CSS(ur-loader-breathe/sweep)는 번들에 존재.
    // 🎨 2026-07-19 [UNLOCK_LOADING] 대표 확정 로고(Final 핸드오프): "urdeal"+로즈 점 — UrDealLogo 재작성과 픽셀 동일
    //   (Poppins 800 · 자간 −3.5% · 점 6.12px/좌 2.72px = 34px 기준). 구조·위상동기·ur-loader-* 클래스 불변.
    const urdealLoaderHtml =
      '<div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px">' +
        '<div class="ur-loader-breathe text-[#1A2C42] dark:text-[#FAF7F5]" style="display:inline-flex;align-items:baseline;font-family:\'Poppins\',\'Pretendard Variable\',system-ui,sans-serif;font-weight:800;font-size:34px;letter-spacing:-0.035em;line-height:1">' +
          'urdeal' +
          '<span class="bg-brand" style="display:inline-block;width:6.12px;height:6.12px;border-radius:50%;margin-left:2.72px"></span>' +
        '</div>' +
        '<div class="bg-gray-200/70 dark:bg-white/10" style="position:relative;overflow:hidden;border-radius:9999px;width:96px;height:3px">' +
          '<div class="ur-loader-sweep bg-brand dark:bg-brand" style="position:absolute;top:0;bottom:0;left:0;border-radius:9999px;width:38%"></div>' +
        '</div>' +
      '</div>';
    // 🔎 2026-07-07 [UNLOCK_LOADING] (대표 "각 이용권 페이지마다 SEO 다 잘 되지?"): 공구/이용권/교환권 상세
    //   (DETAIL slot — /group-buy/:id · /vouchers/:id) 서버측 메타/JSON-LD 주입. 그간 DETAIL 은 데이터만
    //   주입하고 메타는 index.html 기본값(제네릭 홈)을 서빙 → 비-JS 크롤러(네이버/카카오/소셜)가 이용권 링크
    //   공유·색인 시 "유어딜 홈" 카드를 봄. BLOGPOST/CURATOR/WHOLESALE 과 동일 패턴으로 서빙경로에서 rewrite.
    //   **SSR inject(__SSR_INITIAL_DETAIL__)·0-RTT·#root 정적 로더·edgeCache 전부 불변 — 메타 rewrite만 additive.**
    //   순수 계산은 detail-ssr-meta.ts(god 파일 성장 방지). /vouchers/:id(교환권)는 noindex(클라 <SEO noindex> 대칭).
    if (ssrSlot === 'DETAIL' && ssrPayload) {
      const dm = buildDetailMeta(ssrPayload, origin2, url.pathname);
      if (dm) {
        // 교환권(/vouchers/:id)의 noindex 도 applySurfaceMeta 가 처리(meta.noindex).
        rb = applySurfaceMeta(rb, dm);
      }
    }
    // 🏨 2026-07-20 (대표 — 숙소 상세 SSR/OG): /stays/:id 서버 메타/JSON-LD(DETAIL 과 동일 패턴, 페이로드만 다름).
    if (ssrSlot === 'STAYDETAIL' && ssrPayload) {
      const sm = buildStayDetailMeta(ssrPayload, origin2, url.pathname);
      if (sm) {
        rb = applySurfaceMeta(rb, sm);
      }
    }
    // 🔎 2026-07-20 [UNLOCK_LOADING] 쇼핑 상품 상세(/products/:id · PRODUCT slot) 서버 메타 — DETAIL 과 동일 패턴.
    //   그간 PRODUCT 는 데이터만 주입하고 메타는 제네릭 홈 → 카톡/소셜 공유 시 상품 대신 '유어딜 홈' 카드.
    //   가격·할인율 OG + Product JSON-LD 주입(카톡 커머스 공유 카드와 정합). SSR inject·0-RTT·로더 전부 불변 — 메타 rewrite만 additive.
    if (ssrSlot === 'PRODUCT' && ssrPayload) {
      // 🏬 2026-08-09 [UNLOCK_LOADING] 몰 상품이면 몰 카드가 우선 — "OG 메타가 곧 매대다"(세션 ③-a).
      //   MallHomePage 카드는 `/products/:id` 로 링크하므로 몰 링크 공유의 실제 표면이 이 슬롯이다.
      //   판정·조회·fail-closed 는 전부 buildMallProductMeta(mall-ssr-meta.ts) — null 이면 기본 폴백.
      const mallMeta = await buildMallProductMeta(c.env.DB, ssrPayload, origin2, url.pathname).catch(() => null);
      if (mallMeta) {
        rb = applySurfaceMeta(rb, {
          pageTitle: mallMeta.title, title: mallMeta.title, description: mallMeta.description,
          canonical: mallMeta.canonical, ogType: mallMeta.ogType, ogImage: mallMeta.ogImage,
        });
      } else {
        const pm = buildProductMeta(ssrPayload, origin2, url.pathname);
        if (pm) {
          rb = applySurfaceMeta(rb, pm);
        }
      }
    }
    // 🔎 2026-07-29 [UNLOCK_LOADING] (대표 "소비자 쪽 성능·SEO·UX 점검" — 라이브 실측 수리):
    //   **정적 소비자 표면(`/`·`/vouchers`·`/browse`·`/map`)** + **셀러 링크샵(SELLER slot)** 서버 메타/canonical.
    //   실측: 앞 셋은 홈 메타를 그대로 서빙(title/description 동일, `og:url` 전부 `https://urdeal.kr`,
    //   canonical 없음)인데 sitemap 은 priority 0.9 로 제출 → 비-JS 크롤러엔 홈의 중복. `/s/*` 도 같은 상태
    //   (`/u/:handle` 만 2026-07-01 에 개인화됨). DETAIL/PRODUCT/CURATOR 와 **동일한 additive 패턴**.
    //   ⚠️ 정적 표면은 ssrSlot 이 아니라 **pathname** 으로 판정한다: `/vouchers?category=…` 는 슬롯 조건
    //   (`!url.search`)에 안 걸려 ssrSlot 이 'MAIN' 으로 떨어지지만 메타는 교환권 것이어야 한다(sitemap 이 제출).
    //   문구 SSOT = shared/seo/consumer-surfaces · 배선/빌더 = utils/surface-ssr-meta(god 파일 방지).
    //   `/area-report/:region` 은 그 표의 **동적 항목** — 지역명이 경로에 있어 조회 없이 메타가 나오고,
    //   지어낸 세그먼트(도어웨이)는 리졸버가 noindex 로 표시해 준다.
    //   SSR inject·0-RTT·`caches.default`·#root 로더·edgeCache 전부 불변 — head rewrite 만 추가.
    if (!isWholesaleSurface && !needsRootBlank) {
      const sm = resolveConsumerSurfaceSeo(url.pathname, url.search, origin2) ?? resolveRegionSeo(url.pathname, origin2);
      if (sm) rb = applySurfaceMeta(rb, sm);
    }
    // 🪦 2026-07-29 (소비자 SEO 실측): **사라진 상세 페이지가 `200 + index,follow` 로 나가고 있었다.**
    //   `/group-buy/99999999` → HTTP 200 · 제네릭 홈 메타 · robots `index, follow`. 워커 자신의 SSR
    //   self-fetch 는 그 순간 **404 를 받고 있었다**(`X-SSR-Status: DETAIL:self-fetch-404`) — 알고도 안 썼다.
    //   sitemap 이 상세 URL 을 829건(공구 329·상품 500) 제출하는데 상품은 내려간다. 내려갈 때마다
    //   "홈과 똑같은 내용의 색인 가능한 URL" 이 하나씩 생기는 구조였다(soft-404 — 에러가 없어 안 보인다).
    //   ⚠️ HTTP 상태는 200 그대로 둔다 — SPA 셸/청크 로딩·클라 라우팅에 영향을 주지 않기 위해서다.
    //   색인만 막는다. (진짜 404 상태 전환은 별개 결정 — handoff 참조.)
    const entityGone = shouldNoindexMissingEntity(ssrSlot, ssrStatus);
    if (entityGone) {
      rb = rb.on('meta[name="robots"]', { element(el) { el.setAttribute('content', 'noindex, follow'); } });
    }
    if (ssrSlot === 'SELLER' && ssrPayload) {
      const sellerMeta = buildSellerSurfaceMeta(ssrPayload, origin2, url.pathname);
      if (sellerMeta) rb = applySurfaceMeta(rb, sellerMeta);
    }
    if (needsRootBlank) {
      // 도매·대시보드 공통: 소비자 홈 shell 깜빡임 제거 (라이트 배경 placeholder).
      rb = rb.on('#root', {
        element(el) {
          el.setInnerContent('<div style="position:fixed;inset:0;background:#F4F5F7"></div>', { html: true });
        },
      });
    } else if (isBlogSurface) {
      // 📝 블로그 #root = 서버렌더 본문 HTML — JS 미실행 크롤러(네이버 Yeti·AI 크롤러)가 읽을 텍스트 확보.
      //   사유/렌더러 SSOT: features/blog/api/blog-ssr-body.ts. 실패 시 '' → 기존 '빈 #root'(무회귀).
      const blogBody = ssrSlot === 'BLOGPOST' && ssrPayload ? buildBlogPostBody(ssrPayload)
        : ssrSlot === 'BLOG' ? buildBlogListBody(ssrPayload) : '';
      rb = rb.on('#root', {
        element(el) { el.setInnerContent(blogBody, { html: true }); },
      });
    } else {
      // 🖼️ 2026-07-07 [UNLOCK_LOADING] (대표 신고 "로딩 중간에 이상한 페이지들" — 전수조사 + "홈도 이상적으로"):
      //   **catch-all 디폴트 = URDEAL 정적 로더**. prerender 된 `#root` 에는 홈(=RestaurantMapPage list) shell 이
      //   구워지는데, 기존 분기는 도매/대시보드/블로그/링크샵/상세만 특례 처리하고 **그 외(ELSE)를 안 막아**
      //   `/vouchers`·`/browse`·`/products/:id`·`/live`·`/search` 등 소비자 라우트가 하드로드 첫 페인트에
      //   그 홈 shell 을 노출(콘텐츠 점프 + raw i18n 키 + "0곳"). **홈(`/`) 자신도** 그 shell(스켈레톤/0곳)을
      //   먼저 보였다가 lazy RestaurantMapPage 로더로 교체 → [shell → 로더 → 콘텐츠] 3단 점프였음.
      //   → 홈 포함 **모든 HTML 라우트를 동일 로더**로 통일([로더 → 완성] 2단). 홈 shell 은 App.tsx:46 이
      //   명시하듯 __SSR_INITIAL_MAIN__ 을 홈이 소비 안 해 순수 낭비였으므로 손실 0. `__SSR_INITIAL_*` 데이터는
      //   <head> 주입(line 677)이라 #root 교체와 무관(0-RTT 불변). needsRootBlank/isBlogSurface 는 위에서 선처리.
      rb = rb.on('#root', {
        element(el) { el.setInnerContent(urdealLoaderHtml, { html: true }); },
      });
    }
    const rewritten = rb.transform(c.res);
    // 🪦 2026-07-29 사라진 엔티티는 **HTTP 404** 로 응답한다(본문은 SPA 셸 그대로).
    //   noindex 만으로는 이미 색인된 URL 이 늦게 빠지고 서치콘솔엔 계속 soft-404 로 잡힌다.
    //   404 는 "없어졌다"를 명시하는 유일한 신호다. 본문을 그대로 두므로 브라우저는 SPA 를 부팅해
    //   "없는 상품" 화면을 정상 렌더한다(HTTP 상태는 렌더를 막지 않는다).
    //   ⚠️ 판정 근거는 **우리 API 의 404** 뿐이다 — 타임아웃/5xx 는 제외(shouldNoindexMissingEntity).
    //   ⚠️ 정적 자산은 이 경로를 타지 않는다(text/html 청크포인트 안) → 청크 404 자가복구와 무관.
    c.res = entityGone
      ? new Response(rewritten.body, { status: 404, statusText: 'Not Found', headers: rewritten.headers })
      : new Response(rewritten.body, rewritten);
    // 🛡️ 2026-06-25 [UNLOCK_LOADING] (대표 승인 "가장 이상적으로 모두"): SPA HTML 셸은 항상 재검증.
    //   옛 HTML(옛 청크 해시)이 브라우저/bfcache 에 잔존 → 새 배포 후 그 청크 404 → 흰화면/안넘어감을
    //   *근본* 차단(서버가 매 하드로드마다 fresh HTML → fresh 청크 해시 보장). 클라 캐시버스트 복구와 이중 방어.
    //   ⚠️ SSR 0-RTT 무영향: 0-RTT 는 API 페이로드를 caches.default 에 캐시(line 553 .match)하는 것이고,
    //   HTML 셸 자체는 edge 캐시 안 함(caches.default.put / cacheEverything 없음 — 워커가 매요청 생성).
    //   no-cache 는 "저장하되 사용 전 재검증" — bfcache 는 유지(no-store 아님)되 stale 사용은 차단.
    c.res.headers.set('Cache-Control', 'no-cache');
  }
});

// ============================================================
// CSP Violation Report Endpoint
// Browsers POST violation reports here when CSP blocks a resource.
// Keep handler minimal and always return 204 to avoid influencing browser behavior.
// ============================================================
// /api/csp-report → public-utility.routes.ts (P1, 2026-04-26)

// ============================================================
// Health Check
// ============================================================

app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '2.0.0',
  environment: (c.env as Env).ENVIRONMENT ?? 'development',
}));

// 🚨 2026-04-27 (긴급 가드): sw.js 요청 시 Killer SW 직접 응답.
//   기존 PWA SW 가 브라우저에 등록된 사용자가 페이지 못 여는 문제 해결.
//   Worker 가 정적 파일 (dist/client/sw.js) 보다 먼저 응답 → 캐시 우회.
//   Killer SW: 자기 자신 unregister + 모든 캐시 삭제 후 종료.
//
//   재발 방지: 30일 후 (2026-05-27) 이 endpoint 제거 — TECHNICAL_DEBT.md 참조.
//   (2026-04-27 TD-006 split): 별도 라우터 파일로 분리.
app.route('/', killerSwRoutes);
app.route('/', sitemapRoutes);
// 📝 2026-07-01 블로그 SEO 보조 — /blog/og/:slug(공유 배너 SVG) · /blog/rss(피드). SPA fallback 전에 등록.
app.route('/', blogSeoRoutes);

// ============================================================
// 🎯 2026-07-14 유어애즈 독립 Worker(ur-ads) 게이트드 프록시 (Phase C)
//   설계 SSOT: docs/design/urads-worker-split.md.
//   ADS_WORKER_ENABLED==='true' + env.ADS 바인딩이 있으면 /api/ads/* · /l/* 를 ur-ads 로 위임.
//   🎯 [Phase D 2026-07-16] 로컬 폴백(marketingRoutes/shortLinkRedirectRoutes) 제거됨 — 이 프록시가 유일 경로.
//      ⚠️ ADS_WORKER_ENABLED=true + ADS 바인딩을 끄면 유어애즈 404(폴백 없음). 위임 예외 시 next()=SPA 셸.
//   /api/admin/ads/* 는 위임하지 않고 메인 유지(메인 어드민 JWT 사용).
app.use('*', async (c, next) => {
  const ads = c.env.ADS;
  if (c.env.ADS_WORKER_ENABLED === 'true' && ads?.fetch) {
    const p = new URL(c.req.url).pathname;
    const isAdsApi = p === '/api/ads' || p.startsWith('/api/ads/');
    const isShortLink = p === '/l' || p.startsWith('/l/');
    // 🥗 2026-07-15 소셜 홍보 자동화(ur-ads 로 이전) — 어드민 토큰째 위임(ur-ads 자체 requireAdmin, 같은 JWT_SECRET).
    const isAdminSocial = p === '/api/admin/social' || p.startsWith('/api/admin/social/');
    if (isAdsApi || isShortLink || isAdminSocial) {
      try {
        return await ads.fetch(c.req.raw);
      } catch {
        // ur-ads 위임 실패 → 로컬 폴백(아래 마운트가 처리). 라이브 중단 방지.
      }
    }
  }
  await next();
});

// 🎯 [urads-split Phase D] /l/{code} 단축링크 로컬 폴백 제거 — 위 프록시가 ur-ads 로 위임(컷오버 검증됨).
// app.route('/', shortLinkRedirectRoutes);

// 🏭 2026-06-08 호스트 인지 robots.txt — utongstart.com 은 도매 Sitemap 으로 (도매 정식 도메인 육성).
//   SSOT 는 public/robots.txt(ASSETS). utongstart 호스트일 때만 Sitemap 라인을 도매 도메인으로 치환.
//   urdeal.kr 등 다른 호스트는 원본 그대로(회귀 0).
app.get('/robots.txt', async (c) => {
  const host = new URL(c.req.url).hostname.toLowerCase();
  const isWholesaleHost = host === 'utongstart.com' || host === 'www.utongstart.com';
  let body = '';
  try {
    const assetUrl = new URL('/robots.txt', c.req.url);
    const res = await (c.env as { ASSETS?: { fetch?: (u: string) => Promise<Response> } }).ASSETS?.fetch?.(assetUrl.toString());
    if (res && res.ok) body = await res.text();
  } catch { /* ASSETS 미바인딩 — 아래 fallback */ }
  if (!body) body = 'User-agent: *\nAllow: /\nSitemap: https://urdeal.kr/sitemap.xml\n';
  if (isWholesaleHost) {
    body = body.replace(/Sitemap:\s*https?:\/\/\S+/i, 'Sitemap: https://utongstart.com/sitemap.xml');
  }
  return c.text(body, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
});

// 🔎 2026-07-20 네이버 서치어드바이저 소유확인 파일 — 워커가 직접 서빙(정적 자산 서빙이 새 존에서 404 나는 문제 우회).
//   _routes.json exclude 에서 빼서 이 라우트가 처리하도록 함. 내용은 네이버 발급 파일 본문 그대로(파일명=값).
//   ⚠️ Cloudflare Pages 가 `.html` URL 을 확장자 없는 경로로 308 리다이렉트하므로(html_handling),
//      네이버가 리다이렉트를 따라가도 통과되도록 두 경로(.html + 확장자 없음) 모두 동일 본문 서빙.
const naverVerifyBody = 'naver-site-verification: naverd3ccc68d1f14dc53e76aa95f4a02bb68.html';
const serveNaverVerify = (c: { text: (b: string, s: number, h: Record<string, string>) => Response }) =>
  c.text(naverVerifyBody, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
app.get('/naverd3ccc68d1f14dc53e76aa95f4a02bb68.html', (c) => serveNaverVerify(c));
app.get('/naverd3ccc68d1f14dc53e76aa95f4a02bb68', (c) => serveNaverVerify(c));
app.route('/', docsRoutes);
app.route('/', internalDiagnosticsRoutes);
app.route('/', internalAdminToolsRoutes);
app.route('/', smokeTestRoutes);
app.route('/', kakaoSkillWebhookRoutes); // 💬 CS FAQ 봇 — read-only, 시크릿 게이트(기본 404)
app.route('/', repairSchemaRoutes);
app.route('/', errorTelemetryRoutes);
app.route('/', healthcheckRoutes);
app.route('/', selftestRoutes);

// v32 FIX: PWA manifest MIME type 명시 (Workers asset serving은 _headers 미지원)
// Chrome "Manifest: Line: 1 Syntax error" 원인 — Worker가 HTML fallback으로 응답하거나
// MIME이 text/plain으로 나올 때 발생. 명시적 intercept로 application/manifest+json 반환.
// /manifest.webmanifest → public-utility.routes.ts (P1, 2026-04-26)

// 🛡️ 2026-05-08: 대역폭 probe — 클라이언트가 임의 사이즈 body POST → server 가 길이 응답.
//   클라이언트가 (size / elapsed) 로 업로드 처리량 추정. 라이브 시작 전 사고 예방.
//   인증 불필요 (간단 검증), 인입 사이즈 5MB 제한.
app.post('/api/probe/upload', async (c) => {
  const cl = parseInt(c.req.header('content-length') || '0')
  if (!cl || cl > 5_000_000) return c.json({ ok: false, reason: 'invalid size' }, 400)
  // Body 를 끝까지 읽어야 실제 업로드 시간 측정 됨
  await c.req.arrayBuffer()
  return c.json({ ok: true, bytes: cl })
})

app.get('/api/health', async (c) => {
  const env = c.env as Env;
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  // DB check
  try {
    await env.DB.prepare("SELECT 1").first();
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    checks.status = 'degraded';
  }

  // KV check — 🛡️ 2026-05-03: 미등록은 'warning' 으로만 표시 (smoke test 차단 회피).
  //   상세 점검은 /api/health/detailed 에서. 여기는 deploy gating 용 단순 health.
  try {
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.get('health-check');
      checks.kv = 'ok';
    } else if (env.SESSION_KV) {
      await env.SESSION_KV.get('health-check');
      checks.kv = 'session_kv_only'; // legacy fallback
    } else {
      // KV 미등록 — operational warning. status='ok' 유지 (smoke test 통과).
      // /api/health/detailed 또는 dashboard binding 점검으로 추가 모니터링.
      checks.kv = 'missing';
      checks.kv_warning = 'rate limit disabled — register RATE_LIMIT_KV in Dashboard';
    }
  } catch {
    checks.kv = 'error';
  }

  checks.version = '2.0.0';
  checks.region = env.REGION || 'unknown';
  checks.environment = env.ENVIRONMENT ?? 'development';

  return c.json(checks, checks.status === 'ok' ? 200 : 503);
});

// Extended health routes: /api/health/detailed, /api/health/circuits
// ⚠️ Mounted under a sub-path so it does NOT shadow the inline GET /api/health above.
app.route('/api/health/detailed', healthRoutes);
// 🔔 2026-07-01: 직관적 경로 별칭도 마운트 — /api/health/env-readiness · /migrations · /circuits.
//   인라인 GET /api/health(위, 먼저 등록)가 exact 매치를 이기므로 basic health 는 shadow 되지 않고,
//   서브경로(env-readiness 등)만 healthRoutes 로 라우팅됨. 기존 /api/health/detailed/* 도 유지(하위호환).
app.route('/api/health', healthRoutes);

// ============================================================
// 🔒 BOOTSTRAP: 대시보드 비밀번호 재설정
//   2026-04-22 배치 134: fixed 모드 제거 (배치 125 의 임시 동작).
//   로그인 복구 완료 후 보안 복원 — 이제 BOOTSTRAP_TOKEN secret 세팅 필수.
//   미세팅 시 404 로 엔드포인트 자체 숨김.
//
// 사용법:
//   curl -X POST https://urdeal.kr/api/_bootstrap/reset-dashboard-password \
//     -H "X-Bootstrap-Token: <BOOTSTRAP_TOKEN>" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"...","password":"...","role":"all|admin|seller|agency"}'
// ============================================================
// /api/_bootstrap/reset-dashboard-password → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// 클라이언트 빌드 버전 확인 — index.html의 스크립트 해시를 서버가 알려줌
// 프론트가 자신의 번들 해시와 비교해서 불일치 시 자동 리로드
// ============================================================
// 🩺 상세 헬스 대시보드 (2026-04-22 추가)
// GET /api/_internal/health-dashboard
// DB latency, 테이블 행 수, 최근 에러 수, 배포 시점 등 운영자용 종합 지표
// ============================================================
// 🛡️ 2026-04-22: admin 전용 (또는 INTERNAL_OPS_TOKEN 헤더 매치).
// 이전: 누구나 호출 가능 → DB 스키마 조작, 내부 구조 노출 위험.
// /api/_internal/health-dashboard → routes/internal-diagnostics.routes.ts (TD-006 split)

// _cachedBuildVersion 모듈 캐시 → public-utility.routes.ts 로 이동 (P1)
// ============================================================
// 🌐 Dynamic Sitemap.xml (2026-04-22 추가)
// 기존 정적 public/sitemap.xml 은 상품/스트림 누락 + 7일 stale.
// 서버가 현재 DB 상태로 매번 생성 → 검색엔진이 항상 최신 인덱싱.
// ============================================================
// /sitemap.xml → routes/sitemap.routes.ts (TD-006 partial split, 2026-04-27)

// /api/version → public-utility.routes.ts (P1, 2026-04-26)

// ============================================================
// 🩹 Self-healing schema repair (idempotent, 재실행 안전)
// 2026-04-22: D1 migration runner CI/CD 권한 부재 우회용.
// 모든 ALTER TABLE은 IF EXISTS / catch 처리 — 이미 있으면 무해 무동작.
// 운영자가 한 번 호출하면 누락된 컬럼이 자동 추가됨.
// ============================================================
// Migration 버전 추적 — 매 repair-schema 호출 시 현재 상태 기록.
// CI 에서 D1 권한 받으면 정식 migration runner 로 전환하고 이 엔드포인트는 deprecate.
// ensureMigrationTrackingTable → routes/repair-schema.routes.ts (TD-006 Phase E)

// ============================================================
// 🔑 어드민 복구 엔드포인트 (INTERNAL_API_TOKEN 보호)
// POST /api/_internal/clear-rate-limit  — rate limit 초기화
// POST /api/_internal/reset-admin-password — 어드민 비밀번호 초기화
// 사용법: X-Internal-Token: <INTERNAL_API_TOKEN 값> 헤더 필요
// ============================================================

// /api/_internal/clear-rate-limit → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// /api/_internal/reset-admin-password → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// 🛡️ 2026-04-27: 신규 마이그레이션 0207~0230 테이블 일괄 생성 (admin 전용).
// repair-schema 가 ALTER (컬럼 추가) 만 처리하므로, CREATE TABLE 신규 테이블은 본 endpoint 로 생성.
// 멱등 (CREATE TABLE IF NOT EXISTS).
// /api/_internal/repair-new-tables → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// 🛡️ 2026-04-27: 마이그레이션 적용 상태 검증 (admin 전용, 읽기만).
// 신규 에이전시/TikTok 테이블이 D1 에 적용됐는지 한 번에 확인.
// 응답: { summary: { applied, missing }, results: [{ table, exists }] }
// /api/_internal/migration-status → routes/internal-diagnostics.routes.ts (TD-006 split)

// 🛡️ 2026-04-22: admin 전용. 이전: 공개 → 누구나 DB 스키마 수정 가능 (CRITICAL)
// /api/_internal/repair-schema → routes/repair-schema.routes.ts (TD-006 Phase E)

// ============================================================
// 🔍 Self-Diagnostic Endpoints (2026-04-22)
// 사용자가 브라우저 콘솔에서 직접 복사해 공유할 수 있는 진단용
// Dashboard/Logs 접근 없이 '왜 500인지' 찾기 위한 안전한 메타데이터 반환
// ============================================================

// ============================================================
// 🩺 전수조사 스모크 테스트
// GET /api/_internal/smoke-test
// 모든 공개 API를 내부 fetch 로 호출하고 5xx 여부 리포트.
// 인증 필요 없는 엔드포인트만 테스트 (401은 정상으로 간주).
// ============================================================
// 🛡️ 2026-04-22: admin 전용. 내부 엔드포인트 구조 노출 차단.
// /api/_internal/smoke-test → routes/smoke-test.routes.ts (TD-006 Phase D)

// ============================================================
// 🩺 인증 스모크 테스트
// GET /api/_internal/smoke-test-auth
// 임시 JWT 토큰을 생성해 보호된 GET 엔드포인트를 호출.
// 5xx = 인증 통과 후 핸들러 자체가 크래시한다는 뜻 → 실패로 카운트.
// ============================================================
// /api/_internal/smoke-test-auth → routes/smoke-test.routes.ts (TD-006 Phase D)

// 배포 검증용 — 현재 worker 빌드가 언제 / 어떤 커밋에서 빌드됐는지 즉시 확인
// 이 핸들러의 존재 자체가 "최신 배포 반영" 증거
// build-info 는 src/worker/routes/debug.routes.ts 로 이동됨 (M9 분리, 2026-04-26)

// /api/debug/whoami + /api/debug/auth-trace → routes/internal-diagnostics.routes.ts (TD-006 split)

// ============================================================
// API Documentation (OpenAPI / Swagger UI) → routes/docs.routes.ts (TD-006 split, 2026-04-27)
// ============================================================
// Debug & Utilities
// ============================================================

// Debug endpoint to check bindings (admin only)
// bindings 는 src/worker/routes/debug.routes.ts 로 이동됨 (M9 분리, 2026-04-26)

// KV usage monitoring (admin only)
// /api/debug/kv-usage → routes/internal-diagnostics.routes.ts (TD-006 split)

// ============================================================
// Database Index Optimization (admin only)
// Creates indexes on frequently queried columns for faster lookups
// ============================================================
// /api/admin/optimize-db → routes/internal-admin-tools.routes.ts (TD-006 Phase C)

// ============================================================
// CSRF Token Endpoint + Protection for session-cookie routes
// ============================================================
// - GET /api/csrf-token issues a double-submit CSRF token
// - CSRF middleware only fires when the request uses session-cookie auth
//   (Bearer-token requests are skipped inside csrfProtection() itself).
app.get('/api/csrf-token', csrfTokenHandler);

// Session-cookie-authenticated mutation endpoints (Kakao/user flows).
// Admin/seller/Bearer-auth routes are intentionally NOT listed here — they use
// Authorization: Bearer headers which aren't cross-site-set-able.
app.use('/api/auth/logout', csrfProtection());
app.use('/api/auth/profile', csrfProtection());
app.use('/api/auth/change-password', csrfProtection());

// 🔒 인증 필요 엔드포인트 CDN 캐싱 차단 (개인정보 유출 방지)
app.use('/api/auth/me', privateNoCache());
app.use('/api/orders/*', privateNoCache());
app.use('/api/cart/*', privateNoCache());
app.use('/api/wishlists/*', privateNoCache());
app.use('/api/shipping-addresses/*', privateNoCache());
app.use('/api/points/*', privateNoCache());
app.use('/api/notifications/*', privateNoCache());
app.use('/api/account/*', privateNoCache());
app.use('/api/users/*', privateNoCache());
app.use('/api/coupons/*', privateNoCache());
app.use('/api/donations/*', privateNoCache());
app.use('/api/reviews/*', privateNoCache());
app.use('/api/returns/*', privateNoCache());
app.use('/api/referral/*', privateNoCache());

// ============================================================
// Auth Routes
// ============================================================

// -------------------------------------------------------
// Auth routing: TWO routers on /api/auth (non-overlapping sub-routes).
//
// authRouter     → POST /register, /login, /logout, /refresh, GET /me, /session/*
// authTokenRoutes → POST /id-token (Phase 2.3 backend token exchange)
//
// ⚠️ Both mounted on /api/auth — authRouter registered first for priority.
// -------------------------------------------------------
app.route('/api/auth', authRouter);
app.route('/api/auth', authTokenRoutes);

// Feature: Kakao OAuth  →  /auth/kakao/sync/callback + /api/auth/kakao/*
app.route('/auth/kakao', kakaoRoutes);
app.route('/api/auth/kakao', kakaoRoutes);

// 🛡️ 2026-04-22: 민감 endpoint 에 bot protection 적용 — 자동화 도구 차단
// 합법 bot (Googlebot, Kakao 등) 은 allowlist 로 통과.
// 🛡️ 2026-05-07 (CRITICAL fix): app.use(path) 가 path + 모든 sub-path 매칭하는 Hono prefix
//   동작 때문에 /api/seller/register 가 /api/seller/register-from-user 도 잡아 403 사고 발생.
//   → 정확 path + 정확 method 만 매칭하는 wrapper 로 변경. method 불일치 시 즉시 next() pass.
//   wildcard sub-path (/register-from-user, /register/business) 영향 0.
const exactPostBot = (exactPath: string) => {
  const bot = botProtection();
  return async (c: Context, next: Next) => {
    const url = new URL(c.req.url);
    if (c.req.method !== 'POST' || url.pathname !== exactPath) return next();
    return bot(c, next);
  };
};
app.use('/api/auth/register', exactPostBot('/api/auth/register'));
app.use('/api/auth/login', exactPostBot('/api/auth/login'));
app.use('/api/seller/register', exactPostBot('/api/seller/register'));
app.use('/api/seller/login', exactPostBot('/api/seller/login'));
app.use('/api/admin/login', exactPostBot('/api/admin/login'));
app.use('/api/agency/login', exactPostBot('/api/agency/login'));
app.use('/api/auth/forgot-password', exactPostBot('/api/auth/forgot-password'));
app.use('/api/seller/forgot-password', exactPostBot('/api/seller/forgot-password'));
app.use('/api/agency/forgot-password', exactPostBot('/api/agency/forgot-password'));

// Feature: Admin auth — rate limited: 5 attempts per 5 min per IP
// 🛡️ 2026-04-29 보안 audit (TD-016 HIGH): admin refresh / 2FA 도 rate limit.
//   refresh: brute-force 방어 / 2FA: 6자리 TOTP brute-force 방어 (1M 조합).
app.use('/api/admin/login', rateLimit({ action: 'admin_login', max: 5, windowSec: 300 }));
app.use('/api/admin/refresh', rateLimit({ action: 'admin_refresh', max: 10, windowSec: 60 }));
app.use('/api/admin/2fa/*', rateLimit({ action: 'admin_2fa', max: 5, windowSec: 300 }));
// 🛡️ 2026-06-16 어드민 RBAC 게이트 — 제한 역할(ops/cs/finance/viewer) 강제. 모든 /api/admin/* 라우트보다 먼저.
//   (login/refresh 는 토큰 전이라 통과 — 미들웨어가 role 미상 시 next). admin-payouts(하이픈)도 별도 게이트.
app.use('/api/admin/*', adminRbacMiddleware());
app.use('/api/admin-payouts/*', adminRbacMiddleware());
app.route('/api/admin', adminAuthRoutes);

// -------------------------------------------------------
// Seller routing: FOUR routers on /api/seller (non-overlapping sub-routes).
//
// sellerAuthRoutes       → POST /login, /register, GET /me  (auth)
// sellerManagementRoutes → /products/*, /profile, /dashboard (management CRUD)
// sellerOrdersRoutes     → /orders/*, /store-verify/*        (order management)
// sellerDonationsRoutes  → /donations/*                      (donation endpoints)
//
// ⚠️ All mounted on /api/seller — sellerAuthRoutes registered first for priority.
//    Rate limiting applied to /api/seller/login before route registration.
// -------------------------------------------------------
// Feature: Seller auth — rate limited: 10 attempts per 5 min per IP
app.use('/api/seller/login', rateLimit({ action: 'seller_login', max: 10, windowSec: 300 }));
app.route('/api/seller', sellerAuthRoutes);

// 🔒 2026-07-28: Google/Firebase 로그인 마운트 해제 — 사유·복원법은 auth.ts 주석 / AUDIT_INVARIANTS.md
// app.route('/api/auth/google', googleRoutes);

// ============================================================
// Users Routes  ← /api/users/role, /api/users/init
// 프론트엔드에서 /api/users/* 로 직접 호출
// ============================================================
app.route('/api/users', usersRouter);
app.route('/api/me', meRegionRoutes);              // 🗺️ 내 동네 설정/조회
app.route('/api/region', publicRegionRoutes);      // 🗺️ 좌표 → 동네 해석 (공개, 비로그인 자동감지)
app.route('/api/admin/region', adminRegionRoutes); // 🗺️ 동별 딜 밀도 (영입 타겟)
app.route('/api/admin/matching', adminMatchingRoutes); // 🤝 성과기반 매칭 — 어드민 전용(requireAdmin)
app.route('/api/acquisition', acquisitionRoutes);  // 📡 유입 소스 어트리뷰션 (시설물 QR ?src= 퍼널)
app.route('/api/terms', termsRoutes);              // 📜 약관 동의 로그 (버전 스탬프 + 재동의 골격)

// ============================================================
// Cache Control — read-heavy public endpoints
// ============================================================
// 🚀 Edge cache + Cache-Control 동시 적용 (1인 운영 D1 부하 감소)
// edge cache 는 CF edge 에서 응답 캐싱 → D1 쿼리 자체를 우회 → 빠르고 비용 절감
//
// 🛡️ 2026-05-23 (Task 1): publicCache() 도입 — user-agnostic endpoint 는 인증 헤더 무시 캐싱.
//   기존 edgeCache 는 Authorization/Cookie session 있으면 우회 → 로그인 사용자는 항상 D1 hit.
//   publicCache 는 인증 헤더 무시 → 로그인 사용자도 edge hit → D1 부하 추가 감소.
//   ⚠️ 응답이 user-specific 인 endpoint 에는 절대 사용 금지 (다른 유저 데이터 노출).
app.use('/api/products', publicCache(60), cacheControl(60));     // 1 min — list (user-agnostic)
// 🛡️ 2026-05-19 (사용자 신고: /products/:id 로딩 2-3초):
//   상품 상세 / 옵션 / 리뷰 summary 도 edge cache 로 D1 우회 → ~50ms (cache hit).
app.use('/api/products/:id', publicCache(120), cacheControl(120));      // 2 min — detail (user-agnostic)
app.use('/api/products/:id/options', publicCache(300), cacheControl(300));  // 5 min — 거의 안 변함
app.use('/api/reviews/product/:id/summary', publicCache(180), cacheControl(180));  // 3 min
// 🥗 2026-07-15 워커 다이어트: /api/streams 캐시 미들웨어 제거 — 해당 라우트 마운트가 없음(라이브커머스 영구중단).
// app.use('/api/streams', publicCache(30), cacheControl(30));      // 30 sec (공개 라이브 목록 — user-agnostic)
// 🧯 2026-07-02 (대표 "트래픽 폭주" 점검): 추첨 /active — 홈·지도 마운트마다 전 방문자 호출 + 캐시 0 + 상품별 COUNT → 폭주 시 D1 스탬피드. user-agnostic(내 응모는 /:id/me 인증 경로 별도) → 30s. 응모 직후 카운트는 POST /apply 응답이 fresh 라 UX 영향 0.
app.use('/api/fcfs/active', publicCache(30), cacheControl(30));
// 🛡️ 2026-05-22 사용자 신고 "메인 공구 상품 로딩 너무 느림" 영구 해결:
//   edge cache 60s → 300s + SWR 1800s.
//   stale-while-revalidate 1800s = 5분 fresh + 30분 stale 허용 동안 background revalidate.
//   → 두 번째 사용자부터는 0ms (edge hit), 첫 사용자만 D1 cold-start (KV cache 도 함께 작동).
app.use('/api/group-buy/products', publicCache(300), cacheControl(300, 1800)); // 5min fresh + 30min SWR
// 🛡️ 2026-05-15: 공구 detail (개별) 30초 — group_buy_current 자주 바뀌지만 stale-while-revalidate 가 사용성 보존
app.use('/api/group-buy/products/*', publicCache(30), cacheControl(30));
// 참여자 마스킹 리스트 — 1분 (자주 바뀌지만 prv 정보 X — 이름은 이미 마스킹됨)
app.use('/api/group-buy/products/*/participants', publicCache(60), cacheControl(60));
app.use('/api/group-buy/live-ticker', publicCache(30), cacheControl(30));
app.use('/api/og/group-buy/*', publicCache(3600), cacheControl(3600)); // OG image 1h
app.use('/api/og/curator/*', publicCache(3600), cacheControl(3600)); // 🖼️ 2026-07-01 링크샵 공유카드 — 공유마다 스크래퍼가 fetch → 1h 캐시(group-buy 와 동일)
app.use('/api/currency/rates', publicCache(3600), cacheControl(3600)); // 환율 1h (전역 데이터)
app.use('/api/banners', publicCache(300), cacheControl(300));    // 5 min (공개 배너)
// 🛡️ 2026-04-22: 추가 공개 read-only 엔드포인트 캐싱 (성능 감사 결과)
// 🥗 2026-07-15 워커 다이어트: 쇼츠 라우트 분리로 캐시 미들웨어도 불필요(라이브커머스 영구중단).
// app.use('/api/shorts', publicCache(60), cacheControl(60));                // 쇼츠 피드 1min (공개)
// app.use('/api/shorts/feed', publicCache(60), cacheControl(60));           // 쇼츠 feed 1min (공개)
app.use('/api/reviews/product/*', publicCache(120), cacheControl(120));   // 리뷰 목록 2min (리뷰 쓰기는 POST 라 캐시 무영향)
app.use('/api/restaurants', publicCache(300), cacheControl(300));         // 식당 목록 5min (공개)
// 🛡️ 2026-04-28: 메인페이지 통합 endpoint — 1회 호출 + 1분 edge cache (공개 — user 무관)
app.use('/api/home/bundle', publicCache(60), cacheControl(60));
// 🛡️ 2026-05-19: /api/home/categories — 25+ DB 쿼리 매번 실행되면 느림. 5분 cache.
app.use('/api/home/categories', publicCache(300), cacheControl(300));
// 🛡️ 2026-04-30 perf audit: 추가 공개 read-only 엔드포인트 캐싱
app.use('/api/sellers/*/public', publicCache(60), cacheControl(60));        // 셀러 공개 프로필 1min
// 🏭 2026-06-04 (링크샵 로딩 근본수정): /api/curator/:handle 는 manual 헤더만 있어 caches.default 에
//   write 안 됨 → worker SSR inject 가 항상 edge-MISS → 매 요청 cold self-fetch(최대 1.5s). publicCache
//   미들웨어가 cache.put 하여 SSR edge-HIT 0-RTT 보장. 공개 데이터(본인 편집은 /me/* + 클라 낙관).
//   exact 1세그먼트 매칭 → /:handle/p/* redirect·/me/* 미영향.
// 🏁 2026-06-17 [UNLOCK_LOADING] flip-flop(셀러↔핀 왔다갔다) 근본수정 — publicCache(300)+cacheControl(60,900) → edgeCache(300).
//   원인: publicCache(bypassIfAuthed:false)가 URL-key 캐시를 "소유자에게도" 서빙 + cacheControl 이 소유자 no-store 를 덮어씀
//   → curator.routes 의 owner-fresh 분기(line 178)가 사실상 dead → layout 결정 필드 linked_seller 가 stale캐시↔fresh 로 튐.
//   edgeCache(bypassIfAuthed:true): 인증(소유자/세션) 요청은 캐시 우회 → 핸들러의 owner-aware 헤더(owner=no-store, 익명=max-age60+CDN900)가 그대로 적용.
//   익명 방문자 + SSR self-fetch(무인증) + cron prewarm 은 그대로 caches.default 캐싱 → SSR 0-RTT/CDN 분리/KV-false 전부 불변(익명 경로 byte-동일).
app.use('/api/curator/:handle', edgeCache(300));    // 링크샵 — 소유자/인증 bypass→fresh, 익명/SSR/cron 만 edge 캐싱
app.use('/api/sections', publicCache(120), cacheControl(120));              // 홈 섹션 2min (변동 적음)
app.use('/api/seller-tiers', publicCache(300), cacheControl(300));          // 셀러 등급 5min (거의 안 변함)
app.use('/api/blog/public', publicCache(180), cacheControl(180));           // 📝 2026-07-01 블로그 목록(exact) — 목록 SSR 0-RTT edge-hit + prewarm 대상. `/*`(아래)는 상세만 매칭
app.use('/api/blog/public/*', publicCache(180), cacheControl(180));         // 블로그 공개 글 3min
app.use('/api/search/*', publicCache(30), cacheControl(30));                // 검색 결과 30s (query 기반 — user 무관)
// 🛡️ 2026-05-24 perf audit: 누락된 user-agnostic GET 추가 (실코드 검증 — auth/PII 없음, exact path 충돌 없음)
app.use('/api/vouchers/categories', publicCache(300), cacheControl(300, 1800));    // 교환권 카테고리 5min + SWR 30min — KT Alpha sync 시점에만 변경
app.use('/api/community-group-buy/popular', publicCache(60), cacheControl(60, 300)); // 인기 공구 (50명+) — exact path
app.use('/api/community-group-buy/list', publicCache(30), cacheControl(30, 120));    // 공개 공구 목록 — sort/filter query 기반
app.use('/api/community-group-buy/detail/:code', publicCache(30), cacheControl(30, 120)); // 초대 코드 detail (current_count 변경 위해 짧게)
app.use('/api/group-buy/stays/search', publicCache(60), cacheControl(60, 300));      // 숙소 검색 — query 기반 user 무관

// ============================================================
// Rate limits for read/write endpoints
// Applied per-IP (default key). Auth-sensitive routes fail closed.
// ============================================================
// 🛡️ 2026-05-19 (사용자 신고 fix): 검색 rate limit 상향.
//   30/min 은 typeahead + infinite scroll 페이지네이션 (페이지당 1 req) 합산 시 빠르게 도달.
//   120/min 으로 상향 — 정상 사용 충분, scraping 은 여전히 차단.
app.use('/api/search/*', rateLimit({ action: 'search', max: 120, windowSec: 60 }));
// 🛡️ 2026-05-13: KV 무료 한도 보호 — Products/Sellers 의 GET 트래픽이 rate-limit KV ops 의 대부분 차지.
//   이 endpoint 들은 캐시 (5-30s TTL) 가 있고 scraping abuse 위험 낮음 → rate-limit 제거.
//   필요 시 Cloudflare WAF 또는 turnstile 로 대체.
// app.use('/api/products', rateLimit({ action: 'product_list', max: 60, windowSec: 60 }));
// app.use('/api/sellers/*', rateLimit({ action: 'seller_view', max: 60, windowSec: 60 }));
// app.use('/api/moderation/*', rateLimit({ action: 'moderation_check', max: 60, windowSec: 60 }));
// HIGH-1: Upload endpoints — prevent abusive image/file uploads.
// Applied before route mount so it fires for POST/PUT/PATCH alike.
app.use('/api/seller/upload-image', rateLimit({ action: 'upload', max: 10, windowSec: 60 }));
app.use('/api/seller/upload-*', rateLimit({ action: 'upload', max: 10, windowSec: 60 }));

// 🗑️ 2026-07-07 (라이브커머스 제거 2/N): /api/streams(streamsRouter) 마운트 제거.

// ============================================================
// Product & Seller Routes
// ============================================================

// Feature products (extended CRUD) — 유일한 /api/products 핸들러
app.route('/api/products', featureProductsRoutes);
// 🎯 [urads-split Phase D] /api/ads 로컬 폴백 제거 — Service Binding 프록시(env.ADS→ur-ads)가 전담. 재도입=원복.
// app.route('/api/ads', marketingRoutes);
// 📥 크리에이터 제휴 인바운드 신청(공개) — ad_influencer_leads 는 메인 D1 이라 메인 워커에서 처리(프록시 X).
app.route('/api/creator-apply', influencerApplyRoutes); app.route('/api/creator-claim', creatorClaimRoutes);
// 📣 캠페인 신청(로그인 필수) + 어드민 신청자 조회/CSV — campaign_applications 는 메인 D1.
app.route('/api/campaign', campaignApplyRoutes); app.route('/api/admin/campaign-applications', adminCampaignApplicationsRoutes);
// 💳 유어애즈 서비스몰 토스 결제 — 메인 워커 전용(/api/ads/* 위임과 별개 네임스페이스, TOSS 키가 여기 있음).
//   게이트 ADS_TOSS_ENABLED(기본 OFF). SSOT 헬퍼 호출만(toss-gateway 무수정).
app.route('/api/ads-pay', adsPayRoutes);
app.route('/api/admin/ads-pay', adminAdsPayRoutes);
// 🟡 유어애즈 카카오 로그인(+유어딜 세션 브리지) — 메인 전용(KAKAO 키·ur_session 이 여기). 소비자 카카오(잠금) 무접촉.
app.route('/api/ads-auth', adsKakaoAuthRoutes);

// /api/search/popular — featureProductsRoutes의 /search/popular 에 alias
// (프론트엔드가 /api/search/popular 로 호출)
app.route('/api/search', featureProductsRoutes);

// Worker-native sellers list + public routes
app.route('/api/sellers', sellersRouter);

// Feature seller management (see /api/seller routing note above — non-overlapping sub-routes)
app.route('/api/seller', sellerManagementRoutes);
// 🎟️ 2026-08-01 세션 ③-b — 운영자가 자기 상품 공구를 직접 연다(소유권 검증 + 어드민과 동일 검증 SSOT).
app.route('/api/seller/gb', sellerGbRoutes);
// 2026-05-05: 광고 슬롯 입찰 (/ad-slots, /ad-slots/my-bids, /ad-slots/:id/bid)
app.route('/api/seller', sellerAdSlotsRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /register, /register-from-user, /my-seller-status, /switch-to-*
app.route('/api/seller', sellerRegistrationRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /profile (GET/PUT/PATCH) + /business-info (GET/POST/PUT/PATCH)
app.route('/api/seller', sellerProfileRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /settlements*, /dashboard/stats
app.route('/api/seller', sellerSettlementsRoutes);
// 🛡️ 2026-05-18: 숙소 공구 셀러 CRUD (PR 1 Foundation).
app.route('/api/seller', sellerStaysRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /personal-info, /change-password, /upload-image
app.route('/api/seller', sellerAccountRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /link-kakao, /unlink-kakao, /kakao-link-status
app.route('/api/seller', sellerKakaoLinkRoutes);
app.route('/api/seller', sellerScanDevicesRoutes); // 📟 2026-07-20 직원 폰/공기계 스캔 전용 기기 링크
// 🛡️ 2026-04-28 TD-006 (split): /alimtalk* (account/balance/test/send/messages/charge)
app.route('/api/seller', sellerAlimtalkMgmtRoutes);
// 🛡️ 2026-04-28: MD 위탁 판매 (셀러간 협업)
app.route('/api/seller/consignment', consignmentRoutes);
// 🛡️ 2026-04-28: 선물하기 (라이브 시청 중 다른 사람에게 상품 선물)
app.route('/api/gifts', giftsRoutes);
// 🛡️ 2026-04-28: 라이브 펀딩 (와디즈 모델 — 셀러 PB 사전 펀딩)
app.route('/api/funding', fundingRoutes);
app.route('/api/seller', sellerPinRoutes);
app.route('/api/seller', sellerOrdersRoutes);
app.route('/api/seller/analytics', sellerAnalyticsRoutes);
// 🗑️ 2026-07-07 (라이브커머스 제거 2/N): /api/seller/streams·/api/seller/viewers 마운트 제거.
// 🛡️ 2026-04-27 Phase 1-5: 셀러 7일 부트캠프 온보딩
app.route('/api/seller/onboarding', sellerOnboardingRoutes);
// 🛡️ 2026-04-27 Phase 3-1: 데이터 기반 최적 라이브 시간 추천
app.route('/api/seller/optimal-time', optimalTimeRoutes);
// 🤝 2026-07-10 매장 위임 관리 + promo 지출 투명성 (§4.3 — 돈 이동 0, 관계/read-only 만)
app.route('/api/seller/delegation', sellerDelegationRoutes);
app.route('/api/seller/promo-spend', sellerPromoSpendRoutes);
// 🛡️ 2026-04-27 Phase 3-2: FAQ 봇 (가이드 검색)
app.route('/api/faq-bot', faqBotRoutes);
// 🛡️ 2026-04-27 Phase 3-3: 채팅 모더레이션
// 🛡️ 2026-04-29 보안 audit (TD-016 MEDIUM): 인증 필수 — DoS / DB write 폭주 방어
// 🛡️ 2026-05-13: KV 무료 한도 보호 — moderation rate-limit 제거 (인증으로 충분, 1m 60회 abuse 위험 낮음)
app.use('/api/moderation/*', requireAuth());
app.route('/api/moderation', moderationRoutes);
// 🛡️ 2026-04-27 Phase 3-4: 어드민 TikTok 발굴
app.route('/api/admin/tiktok-discovery', adminTikTokDiscoveryRoutes);
// 🛡️ 2026-04-27 운영 안정: 어드민 운영 인사이트 (부진 검출)
app.route('/api/admin/ops-insights', adminOpsInsightsRoutes);
// 🛡️ 2026-04-28: 알림 채널 설정 (어드민 대시보드)
app.route('/api/admin/notification-settings', adminNotificationSettingsRoutes);
// 🛡️ 2026-04-28: business-monitoring (gift + consignment 운영 통계)
app.route('/api/admin/business-monitoring', adminBusinessMonitoringRoutes);
// 🛡️ 2026-04-27 자사 이벤트 (매출 챌린지)
app.route('/api/agency/self-events', agencySelfEventsRoutes);
// 🛡️ 2026-04-27 노출 부스팅 쿠폰 (Promote to Live)
app.route('/api/agency/promote-boosts', promoteBoostsAgencyRoutes);
app.route('/api/seller/promote-boosts', promoteBoostsSellerRoutes);
// 🗑️ 2026-07-07 (라이브커머스 제거 2/N): /api/seller/live-notify 마운트 제거.
// 🛡️ 2026-04-27 Phase 3-5: 셀러 이전 (Network 마켓플레이스)
app.route('/api/agency/transfers', sellerTransferRoutes);
// 🛡️ 2026-04-30 TD-016 CRITICAL: 셀러 본인이 직접 동의/거부 (agency 대행 금지)
app.route('/api/seller/transfers', sellerTransferRespondRoutes);
// 🥗 2026-07-15 워커 다이어트(대표 승인): 캐스팅 마켓플레이스(라이브커머스 잔재, 페이지 없음) 마운트 분리.
// app.route('/api/admin/advertisers', adminAdvertiserRoutes);
// app.route('/api/admin/castings', adminCastingRoutes);
app.route('/api/admin/ads', adminAdsRoutes); // 🎯 유어애즈 가입자 운영 어드민 (별개 기능 — 유지)
app.route('/api/admin/partner-pool', partnerPoolRoutes); // 🤝 B2B 파트너(업체) 풀 — 메인 어드민 JWT(프록시 비위임), ad_company_leads 격리
app.route('/api/admin/store-prospects', storeProspectsRoutes); // 🏪 매장 후보 — 인허가 발굴(store_prospects 격리), 메인 어드민 JWT
app.route('/api/public/new-openings', newOpeningsPublicRoutes); // 🎉 소비자 공개: 우리 동네 새 가게(연락처 미노출, CDN 캐시)
app.route('/api/public/area-report', areaReportPublicRoutes); // 📊 소비자 공개: 상권 리포트(이메일 아웃리치 미끼, CDN 캐시)
app.route('/api/admin/gov-notices', govNoticesRoutes); // 📢 공고 스캐너 — 나라장터+기업마당(gov_notices 격리), 메인 어드민 JWT
// 🌐 해외 수출 바이어 풀 정규 마운트는 유통스타트(도매) 워커 → mount-wholesale.ts(소비자 번들 DCE·유어딜 무관).
// ⏳ [TEMP-TEST 2026-07-20] 도매 워커가 아직 미배포라, 대표가 라이브 어드민(/admin/buyer-pool)에서 무료 소스
//   수집을 검증할 수 있게 소비자 워커에 임시 마운트. admin 전용(requireAdmin)+격리 테이블+게이트라 유어딜 데이터
//   무접촉. ur-wholesale 배포 시 이 3줄(import+mount) 제거 예정.
app.route('/api/admin/buyer-pool', buyerPoolTestRoutes);
// ⏳ [TEMP-TEST 2026-07-28] 제조사·판매사 후보 풀 — 도매 워커 배포 전까지 라이브 어드민에서 검증(admin 전용·격리 테이블).
app.route('/api/admin/maker-pool', makerPoolTestRoutes);
// 🔖 바이어 풀 북마클릿 인제스트 — requireAdmin 밖(크로스오리진, 토큰 인증+CORS). buyKorea 등에서 원클릭 전송.
app.route('/api/buyer-ingest', buyerIngestRoutes);
// app.route('/api/seller/castings', sellerCastingRoutes);
// 🥗 2026-07-15 워커 다이어트: 라이브 후원 부스터(쓰는 컴포넌트 0) 마운트 분리.
// app.route('/api/donation-boosters', donationBoosterRoutes);
// app.route('/api/donation-boosters-public', donationBoosterPublicRoutes);
// 🗑️ 2026-07-07 (라이브커머스 제거 3/N): PK 배틀(라이브 매출경쟁) 라우트 제거.

// Email notifications (global)
app.route('/api/email', emailRoutes);

// Affiliate marketing
app.route('/api/affiliate', affiliateRoutes);

// ============================================================
// Order & Payment Routes
// ============================================================

// -------------------------------------------------------
// Order routing: 두 라우터 — 이제 경로 non-overlapping (배치 112).
//
// ordersRouter  → worker/repositories/order.repository.ts (PRIMARY)
//   POST /, GET /, GET /:id, POST /refund, POST /:id/cancel
//
// featureOrdersRoutes → features/orders (delivery tracking & cron)
//   GET /:id/tracking, POST /:id/confirm,
//   POST /internal/auto-confirm, POST /internal/sync-deliveries
//
// 🛡️ 2026-04-22 배치 112: featureOrdersRoutes 의 중복 경로 (GET /, GET /:id, POST /)
//    삭제 완료 → 이제 완전 non-overlapping.
// -------------------------------------------------------
app.route('/api/orders', ordersRouter);
app.route('/api/orders', featureOrdersRoutes);

// -------------------------------------------------------
// Payment routing: /api/payments (single router)
//
// paymentsRouter → POST /confirm, POST /checkout-session, POST /webhook
//
// 과거에 featurePaymentRoutes (/rollback) 가 추가 마운트되어 있었으나,
// 호출처가 0건으로 dead code 확인되어 2026-04-26 제거.
// 결제 취소는 POST /api/orders/:id/cancel 사용.
// -------------------------------------------------------
app.route('/api/payments', paymentsRouter);

// ✅ Stripe routes (Global region): POST /api/payment/stripe/create-intent
app.route('/api/payment/stripe', stripeRouter);

// ============================================================
// Feature Module Routes
// ============================================================

// Cart
app.route('/api/cart', cartRoutes);

// Notifications
app.route('/api/notifications', notificationsRoutes);

// Resend email webhook (bounce / complaint → suppression list)
app.route('/api/webhooks/resend', resendWebhookRoutes);

// 유캔싸인 전자계약 webhook (문서 상태변경 → contract_signatures 갱신)

// Shipping addresses
app.route('/api/shipping-addresses', shippingAddressRoutes);

// Wishlists
app.route('/api/wishlists', wishlistRoutes);

// Banners
app.route('/api/banners', bannerRoutes);

// ============================================================
// Admin routes — all handled by adminApp (separate auth chain)
// adminApp has: CORS + IP whitelist + requireAdmin() + audit log
// ============================================================
adminApp.route('/agencies', adminAgencyRoutes);
// 🏦 2026-06-12 지급 센터 — 셀러/큐레이터/에이전시 신청→입금완료 통합 (사용자 결정)
adminApp.route('/payout-center', payoutCenterRoutes);
// 🛡️ 2026-04-26: 에이전시 셀러 심사 큐 (Agency P0 #1)
adminApp.route('/agency-creator-approvals', adminAgencyApprovalsRoutes);
// Admin tools (chart, sellers, banners, notices, settlements, reports, settings)
adminApp.route('/tools', adminToolsRoutes);
// Admin real-time health metrics (active streams, orders/min, stuck orders, webhooks)
adminApp.route('/metrics', adminMetricsRoutes);
adminApp.route('/business-metrics', platformMetricsRoutes); // 비즈니스 지표(GMV·순수익률·반복구매·여신미수)
// 🛡️ 2026-05-07: Cron / 알림톡 실패 모니터링 (admin 가시성)
adminApp.route('/', adminSystemMonitoringRoutes);
adminApp.route('/', adminManagementRoutes);
// 🛡️ 2026-04-22 배치 138 (TD-006 부분): admin-coupons 분리 — admin-management.routes.ts 줄임
adminApp.route('/', adminCouponsRoutes);

// 📧 2026-06-09 Wave 3b: 어드민 단체메일 (filtered bulk email) — /api/admin/bulk-email
adminApp.route('/', adminBulkEmailRoutes);
// 🛡️ 2026-04-22 배치 141 (TD-006 부분): admin-side-banners 분리
adminApp.route('/', adminSideBannersRoutes);
// 🛡️ 2026-04-22 배치 143 (TD-006 부분): admin-settlements 분리 (가장 큰 섹션 ~296줄)
adminApp.route('/', adminSettlementsRoutes);
// 🛡️ 2026-04-22 배치 144 (TD-006 부분): admin-stats 분리
adminApp.route('/', adminStatsRoutes);
// 🛡️ 2026-04-22 배치 146 (TD-006 부분): admin-sellers 분리 (272줄)
adminApp.route('/', adminSellersRoutes);
// 🛡️ 2026-04-22 배치 148 (TD-006 부분): admin-products + sample-requests 분리
adminApp.route('/', adminProductsRoutes);
// 🏭 [wholesale-split] 도매 admin 마운트(suppliers/withdrawal) → mount-wholesale.ts
//   (app.route('/api/admin', adminApp) 직전의 __INCLUDE_WHOLESALE__ 블록에서 TLA 로 등록)
// 🛡️ 2026-05-18: 숙소 공구 어드민 (PR 1 Foundation).
adminApp.route('/', adminStaysRoutes);
// 🛡️ 2026-05-19: KT Alpha 관리 (catalog sync, markup, biz money 잔액).
adminApp.route('/', adminKtAlphaRoutes);
// 🛡️ 2026-05-19: 원천징수 + 지급조서 export (소득세법 §164/165 의무).
adminApp.route('/', adminWithholdingRoutes);
// 🛡️ 2026-04-22 배치 149 (TD-006 부분): admin-orders 분리 (~356줄)
adminApp.route('/', adminOrdersRoutes);
// 🛡️ 2026-04-22 배치 150: admin-streams(알림톡 패키지/크레딧/통계 admin — 라이브 아님, 유지)
adminApp.route('/', adminStreamsRoutes);
// 🛡️ 2026-04-22 배치 151 (TD-006 부분): admin-accounts (관리자 CRUD) 분리
adminApp.route('/', adminAccountsRoutes);
// 🛡️ 2026-04-22 배치 152 (TD-006 부분): admin-analytics 분리
adminApp.route('/', adminAnalyticsRoutes);
// 🛡️ 2026-04-22 배치 153 (TD-006 부분): admin-moderation (리뷰 + 라이브 모니터) 분리
adminApp.route('/', adminModerationRoutes);
// 🛡️ 2026-04-22 배치 154 (TD-006 부분): admin-users 분리
adminApp.route('/', adminUsersRoutes);
// 🛡️ 2026-04-22 배치 155 (TD-006 부분): admin-misc (donations/deals/commission/audit) 분리
adminApp.route('/', adminMiscRoutes);
// 2026-05-05: 어뷰징 탐지 + 광고 슬롯 관리
adminApp.route('/', adminAbuseRoutes);
// 🛡️ 2026-04-22 배치 156 (TD-006 부분): admin-review-generator 분리
adminApp.route('/', adminReviewGeneratorRoutes);
adminApp.route('/banners', adminBannersRoutes);
// Feature flags / kill-switch (graceful degradation for traffic spikes)
adminApp.route('/flags', adminFlagsRoutes);
adminApp.route('/cafe24', cafe24Routes);
// Blog admin — mounted INSIDE adminApp (requireAdmin + IP whitelist + audit log)
adminApp.route('/blog', adminBlogRoutes);
// 🥗 2026-07-15 워커 다이어트(대표 승인): 소셜 자동화 라우트 마운트 분리(위 import 참조). 게이트 OFF·미사용이라
//   /api/admin/social/* 는 다이어트 기간 404 — 라이브 영향 0. 재도입=이 줄+import+크론 원복.
// adminApp.route('/social', socialMediaRoutes);
// Restaurant settlement (admin)
adminApp.route('/restaurant-settlement', restaurantSettlementRoutes);
// Naver Ad Scraper 제거됨 (2026-04-22) — 법적 리스크(PIPA/정보통신망법) + 기술 불안정
// 남은 `/api/scraper/d1/*` 엔드포인트도 단계적 제거. scraped_advertisers 테이블은 데이터 보존 목적으로 남김.

// 🛡️ 2026-04-22: Legacy scraper endpoint 제거 (법적 리스크 + 보안 위험)
// - /api/scraper/d1/emails, /api/scraper/d1/stats 모두 제거
// - 이유: adminApp 미들웨어 체인 (IP whitelist + audit) 을 우회하고 있었음
// - scraped_advertisers 테이블은 데이터 보존용으로 남겨둠 (직접 SQL 조회 가능)
// - 스크래핑 기능은 이미 CLAUDE.md 에 따라 제거됨 (PIPA/정보통신망법 리스크)

// 🏭 [wholesale-split 2026-07-16] 도매 라우트는 WHOLESALE_BUNDLE=1 빌드에서만 포함.
//   __INCLUDE_WHOLESALE__=false(소비자) → esbuild DCE 로 mount-wholesale + 도매 그래프 전체 제외(워커 gzip ~200KB↓).
//   ⚠️ adminApp 도매 마운트가 app.route('/api/admin', adminApp) 전에 등록돼야 해 TLA(await)로 여기서 호출.
if (__INCLUDE_WHOLESALE__) {
  const { mountWholesale } = await import('./mount-wholesale');
  mountWholesale(app, adminApp);
}
/**
 * 🏬 **몰 관리 CRUD 는 도매 게이트 밖이다** 〔2026-08-03 — 대표 실측 404〕
 *
 * 이 API 가 지배하는 대상은 도매몰이 아니라 **소비자 표면**이다:
 * 몰의 존재 · `consumer_path`(=`urdeal.kr/{슬러그}` 로 열지 말지) · 브랜드 색(라이트).
 * `lookupConsumerMall`(worker/utils/mall-consumer.ts)이 읽는 바로 그 행을 쓴다.
 *
 * 🔴 그런데 이게 `if (__INCLUDE_WHOLESALE__)` 안(mount-wholesale)에 있어서, 소비자 배포(ur-live)에선
 *   **어드민 화면만 실리고 API 는 DCE 로 빠졌다** — `/admin/wholesale-malls` 에서 몰을 만들면 404.
 *   화면이 있는데 그 화면이 부르는 API 가 없는 것은 배선 결함이지 설정 문제가 아니다.
 *
 * ⚠️ 도매 그래프를 되살리지 않는다: 이 라우트의 import 폐쇄는 `wholesale-malls.ts`(+`swallow`)와
 *   이미 소비자 번들에 있는 공용 미들웨어·`shared/mall/*` 뿐이다(~500줄). 200KB 도매 그래프와 무관.
 * ⚠️ `/api/admin` 마운트 **앞**에 있어야 한다(mount-wholesale 의 같은 주석과 동일 이유).
 */
app.route('/api/admin/wholesale-malls', adminWholesaleMallRoutes);
app.route('/api/admin', adminApp);
// Cafe24 public callback (no admin auth needed for OAuth redirect)
app.route('/admin/cafe24/callback', cafe24Routes);

// Push notifications
app.route('/', pushRoutes);  // pushRoutes already uses full path /api/push/*

// Account
app.route('/api/account', accountRoutes);

// 🏭 [wholesale-split 2026-07-16] 도매 라우트 마운트(supply/supplier/wholesale/admin-wholesale) →
//   src/worker/mount-wholesale.ts 로 이동, 위 __INCLUDE_WHOLESALE__ 블록에서 호출. 소비자 번들 제외.
app.route('/api/partnership', partnershipPublicRoutes); // 🤝 광고/제휴 문의 (공개 접수) — 도매 아님, 소비자 유지
app.route('/api/admin/partnership-inquiries', adminPartnershipRoutes); // 어드민 접수함

// 🔐 2026-06-11 SSR Phase 2 (docs/SSR_PHASE2_AUTH.md §3.2-4): 로그아웃 시 ud_* 토큰 쿠키 삭제.
//   클라 clearAuthData() 가 fire-and-forget 호출. 인증 불필요(쿠키 삭제는 무해·멱등).
app.post('/api/auth/logout-cookies', async (c) => {
  const { authTokenClearCookie } = await import('./utils/auth-cookies');
  const { clearSessionCookie } = await import('./utils/session');
  const host = new URL(c.req.url).hostname;
  // 🔑 2026-06-29 (로그아웃 근본수정): httpOnly *세션* 쿠키(ur_session/ur_seller_session/ur_admin_session/
  //   ur_agency_session)는 클라가 JS 로 못 지움 → 서버가 Set-Cookie Max-Age=0 으로 삭제해야 진짜 로그아웃.
  //   기존엔 ud_*(SSR 개인화 토큰)만 지우고 ur_session 을 남겨 /api/auth/me·/session/health 가 그 쿠키로
  //   재인증 → "로그아웃해도 로그인" 버그. type 지정=그 역할 세션만(선택적 로그아웃—듀얼로그인 보호), 미지정=전체.
  const body = await c.req.json<{ type?: string }>().catch(() => ({} as { type?: string }));
  const type = typeof body?.type === 'string' ? body.type : undefined;
  const clearSess = (t: 'user' | 'seller' | 'admin' | 'agency') => c.header('Set-Cookie', clearSessionCookie(t), { append: true });
  if (type === 'seller') clearSess('seller');
  else if (type === 'admin') clearSess('admin');
  else if (type === 'agency') clearSess('agency');
  else if (type === 'user') clearSess('user');
  else if (type === 'supplier') { /* 제조사: ur_* 세션쿠키 없음(Bearer 전용) — 아래 ud_* 만 청소, 타역할 세션 보존 */ }
  else { clearSess('user'); clearSess('seller'); clearSess('admin'); clearSess('agency'); }
  // ud_* SSR 토큰 정리 (기존 동작 보존 — 역할 무관 일괄).
  c.header('Set-Cookie', authTokenClearCookie('ud_seller_token', host), { append: true });
  c.header('Set-Cookie', authTokenClearCookie('ud_agency_token', host), { append: true });
  // 🔐 2026-06-17 쿠키 전환 Phase 1: admin/supplier ud_* 도 정리.
  c.header('Set-Cookie', authTokenClearCookie('ud_admin_token', host), { append: true });
  c.header('Set-Cookie', authTokenClearCookie('ud_supplier_token', host), { append: true });
  return c.json({ success: true });
});
// 🏭 [wholesale-split] 도매 admin 라우트(proposals/products/deposit-account/malls/overview) → mount-wholesale.ts

// 알림톡/브랜드메시지 크레딧 시스템 — rate limit send: 60/min per seller
app.use('/api/seller/alimtalk/send', rateLimit({ action: 'alimtalk_send', max: 60, windowSec: 60 }));
app.route('/api/seller/alimtalk', alimtalkRoutes);
// 🛡️ 2026-04-28: restaurant-map 옵션 B — 사용자 수요 신호 (셀러 영입/알림)
app.route('/api/restaurant-suggestions', restaurantSuggestionsRoutes);

// ── 후원(도네이션) ── 🥗 2026-07-15 워커 다이어트 3차(대표 승인): 라이브 후원(소비자 미호출·라이브 영구중단) 마운트 분리. 재도입=원복.
// app.route('/api/donations', donationsRoutes);
// app.route('/api/seller', sellerDonationsRoutes); // (see /api/seller routing note — non-overlapping /donations/* sub-routes)

// ── 식당 정산 (셀러용) ──
app.route('/api/seller/restaurant-settlements', sellerSettlementRoutes);

// ── 딜 포인트 ──
app.route('/api/points', pointsRoutes);

// ── 쇼츠 ── 🥗 2026-07-15 워커 다이어트(대표 승인): 라이브커머스 영구중단 — 마운트 분리. 재도입=원복.
// app.route('/api/shorts', shortsRoutes);

// ── 공동구매 & 바우처 ──
app.route('/api/group-buy', groupBuyRoutes);
app.route('/api/vouchers', groupBuyRoutes);
// 🛡️ 2026-05-18: 숙소 공구 사용자 측 (PR 1 Foundation).
app.route('/api/group-buy', staysPublicRoutes);
// 🗺️ 2026-08-03: 지역별 딜 집계 — `/region/*` 페이지·지역 인덱스·sitemap 이 같은 숫자를 보게 하는 SSOT.
app.route('/api/regions', regionsRoutes);
// 🛡️ 2026-05-18: R2 이미지 업로드 (multi-role).
app.route('/api', uploadRoutes);
// 🛡️ 2026-05-21: 자체 예약 캘린더 (뷰티/액티비티/건강/펫 등 sub-1day 예약).
//   숙소는 별도 stay_bookings 유지. routes 내부 prefix 가 /seller/, /products/, /appointments/ 등 다양.
app.route('/api', appointmentsRoutes);
// 🛡️ 2026-05-21 Phase C: 통합 정산 (payouts 어드민).
app.route('/api', adminPayoutsRoutes);
// 🆕 2026-06-29: fee-resolver 그림자 ↔ 현행 정산 비교(읽기 전용, authoritative 전환 검증용).
app.route('/api', adminFeeBreakdownRoutes);
// 🧾 2026-07-10 불변식 #44 검증 콕핏 (promo 재원 원장 감사 — read-only, finance role)
app.route('/api/admin/promo-ledger', adminPromoLedgerRoutes);
// 🆕 2026-06-29: 경량 퍼널 계측 (소비자 이탈률 측정 — 정체성 결정 근거).
app.route('/api', funnelRoutes);
// 🛡️ 2026-05-21 Phase D: 세무 (전자세금계산서 + 연말 리포트).
app.route('/api', adminTaxRoutes);
// 🛡️ 2026-05-21 Phase D-2: 셀러/에이전시 본인 ledger 조회.
app.route('/api', ledgerRoutes);
// 🛡️ 2026-05-16: 셀러 마케팅 (인플 차단) + 인플루언서 정산 + 어드민 송금 + 인플 카탈로그
app.route('/api/seller-marketing', sellerMarketingRoutes);
app.route('/api/influencer-settlement', influencerSettlementRoutes);
app.route('/api/district', districtPublicRoutes);
app.route('/api/admin/district', districtAdminRoutes);
// 🎟️ 2026-07-14 공구 엔진 어드민 조종석(STEP 2 선결 — 상품별 gb_mode 설정). 자체 requireAdmin.
app.route('/api/admin/gb-cockpit', gbCockpitRoutes);
app.use('/api/admin-payouts/*', requireAdmin());
app.route('/api/admin-payouts', adminPayoutRoutes);
app.route('/api/influencer-discover', influencerDiscoverRoutes);
// 🛡️ 2026-05-16: 인플 지역 ranking (공개 — 누구나 조회 가능)
app.route('/api/influencer-rankings', influencerRankingsRoutes);
// 🛡️ 2026-05-16: 카카오맵 후기 보너스
app.route('/api/review-bonus', reviewBonusUserRoutes);
app.use('/api/admin-review-bonus/*', requireAdmin());
app.route('/api/admin-review-bonus', reviewBonusAdminRoutes);
// 🗺️ 2026-07-02 카카오맵 리뷰 게이미피케이션 — 매장(셀러) 확인 큐 (대표 "매장에서 확인")
app.use('/api/seller/review-verifications/*', requireSeller());
app.route('/api/seller/review-verifications', reviewBonusSellerRoutes);
// 🎯 2026-06-20 선착순 응모 상품 (대표) — 공개(목록/상태) + 유저(지원) + 어드민(설정/지원자/선정)
app.route('/api/fcfs', fcfsRoutes);
app.route('/api/admin/fcfs', fcfsAdminRoutes);
// 🎁 2026-07-12 체험 캠페인 모듈 (trial-campaign-track). 공개+유저 / 어드민 대행 생성(1순위).
app.route('/api/experience-campaigns', experienceCampaignPublicRoutes);
app.route('/api/admin/experience-campaigns', experienceCampaignAdminRoutes);
app.route('/api/seller-experience-campaigns', experienceCampaignSellerRoutes);
// 🎟️ 2026-07-06 공구 엔진 §4 — 인플루언서 공구 탐색(promo 순). platform_settings.gb_engine_enabled 게이트.
app.route('/api/gb-marketplace', gbMarketplaceRoutes);
// 🏬 2026-08-01 세션 ③-a — 운영자 몰 소비자 공개 API(비로그인). consumer_path=1 인 몰만 200.
app.route('/api/mall', mallPublicRoutes);
// 🎟️ 2026-07-06 공구 엔진 §2-B — 양방향 공구 제안(인플↔매장). 상대방 승인 시 gb open.
app.route('/api/gb-proposals', gbProposalsRoutes);
// 🎟️ 2026-06-22 사용처리 분쟁(매장 "안 왔어요" 신고 → 정산 보류 + 어드민 중재)
app.route('/api/voucher-dispute', voucherDisputeRoutes);
app.route('/api/admin/voucher-dispute', voucherDisputeAdminRoutes);

// 🛡️ 2026-05-15: 동적 OG 이미지 (KakaoLink / Twitter / Meta 공유용)
app.route('/api/og', ogRoutes);

// 🛡️ 2026-05-25 (migration 0278): 큐레이터 링크샵 (모든 유저가 /u/:handle 공개 페이지)
app.route('/api/curator', curatorRoutes);

// 🛡️ 2026-05-25 (migration 0279): 배송 추적 (tracker.delivery 무료 GraphQL + 외부 URL fallback)
//   - /api/shipping/track/:carrier/:trackingNumber (public)
//   - /api/shipping/order/:orderId/track (requireUser)
//   - /api/shipping/admin/bulk-tracking (requireAdmin, CSV)
//   - /api/shipping/admin/sync (requireAdmin, 수동 cron trigger)
app.route('/api/shipping', shippingRoutes);

// 🛡️ 2026-05-25 (migration 0280): 호스팅 (누구나 voucher 공구 모집)
//   - /api/hosting/catalog (requireUser)
//   - /api/hosting/me (CRUD)
//   - /api/hosting/g/:invite_code (public)
app.route('/api/hosting', hostingRoutes);

// 🛡️ 2026-05-15: Web Vitals + funnel 수집 (1% sampling, KV 카운터, 0원 운영)
app.route('/api/analytics', analyticsRoutes);

// 🛡️ 2026-05-15: A/B Feature Flag (KV 기반, 0원 운영)
app.route('/api/flags', flagRoutes);

// 🛡️ 2026-05-15: 환율 (1시간 KV 캐시)
app.route('/api/currency', currencyRoutes);

// 🛡️ 2026-05-15: 메뉴 OCR (Workers AI llava-1.5-7b, 무료 10K req/day, fallback graceful)
app.route('/api/ocr', ocrRoutes);

// 🛡️ 2026-05-15: 분쟁 자동 분류 (Workers AI llama-3.1-8b, fallback graceful)
//   AI 가 voucher_refused / merchant_closed 분류 + confidence > 0.75 → 즉시 자동 환불
//   나머지는 어드민 escalation
app.route('/api/disputes', disputesRoutes);

// 🛡️ 2026-05-15: 2FA TOTP (셀러/어드민 추가 보안 — Workers crypto 만 사용, 외부 lib 0)
app.route('/api/2fa', twofaRoutes);

// 🛡️ 2026-05-15 (PRISM 따라잡기): 셀러 단골 / 라이브 예고 / 단골 push
app.route('/api/seller-public', sellerPublicRoutes);

// 🛡️ 2026-05-15: 셀러 자체 promo 코드 (단골 전용 할인 등)
app.route('/api/promo', promoRoutes);

// ── 쿠폰 ──
app.route('/api/coupons', couponRoutes);

// ── 디지털 상품 (2026-05-05): 전자책/강의/가이드/영상 ──
app.route('/api/digital', digitalRoutes);

// ── 소셜 (팔로우 + 알림) ──
app.route('/api/social', socialRoutes);

// ── 상품 리뷰 ──
app.route('/api/reviews', reviewsRoutes);

// ── 셀러 등급 ──
app.route('/api/seller-tiers', sellerTiersRoutes);

// ── 바코드 + 재고 관리 ──
app.route('/api/inventory', inventoryRoutes);

// ── 홈페이지 섹션 관리 ──
app.route('/api/sections', sectionsRoutes);

// ── YouTube 구독자 늘리기 ──
app.route('/api/youtube-growth', youtubeGrowthRoutes);
// SECURITY (HIGH-5): admin 엔드포인트는 adminApp 내부로 별도 마운트 (IP whitelist + audit log)
adminApp.route('/youtube-growth', youtubeGrowthAdminRoutes);

// ── 대시보드 알림 ──
app.route('/api/dashboard-notifications', dashboardNotificationsRoutes);

// ── 상품 대량등록 ──
app.route('/api/bulk-upload', bulkUploadRoutes);

// ── 반품/환불 ──
app.route('/api/returns', returnsRoutes);

// ── 라이브 경매 ──
app.route('/api/auction', auctionRoutes);

// ── 타임딜 룰렛 ──
app.route('/api/timedeal', timedealRoutes);

// ── 유저 공동구매 (커뮤니티) ──
app.use('/api/community-group-buy/create', rateLimit({ action: 'group_buy_create', max: 10, windowSec: 300 }));
app.use('/api/community-group-buy/join/*', rateLimit({ action: 'group_buy_join', max: 20, windowSec: 300 }));
app.route('/api/community-group-buy', communityGroupBuyRoutes);

// ── 친구 초대 공동구매 ──
app.route('/api/referral', referralRoutes);

// ── 초대 보상 ──
app.route('/api/invite', inviteRewardRoutes);

// ── 다단계 추천 커미션 ──
app.route('/api/referral-tree', referralTreeRoutes);

// ── CS 신고 (유저 신고 접수) ──
app.route('/api/reports', reportsRoutes);

// 🗑️ 2026-07-07 (라이브커머스 제거 2/N): /api/broadcast-notify(방송 알림 구독) 마운트 제거.

// ── VIP 등급 (유저 로열티) ──
app.route('/api/loyalty', loyaltyRoutes);

// ── 관심/알림 (맛집·상품·공동구매 관심 등록) ──
app.route('/api/interest', interestRoutes);

// ── 카카오 소셜 (메시지 + 캘린더) + 글로벌 (.ics) ──
app.route('/api/kakao-social', kakaoSocialRoutes);

// ── 외부 서비스 프록시 (kakao/naver place + image) ──
// 2026-04-26 worker/index.ts 비대화 해소를 위해 src/worker/routes/proxy.routes.ts 로 추출
app.route('/api', proxyRoutes);

// ── 디버그 (build-info, bindings) — 2026-04-26 M9 부분 추출
app.route('/api/debug', debugRoutes);

// ── 공개 유틸 (csp-report, manifest, version) — 2026-04-26 P1 추출
//    sub-paths 가 / (root), /api/csp-report, /manifest.webmanifest, /api/version 으로
//    분기되므로 prefix '' 마운트.
app.route('/', publicUtilityRoutes);

// ── 🛡️ 2026-04-26 T1: TikTok Login + Display API ── 🥗 2026-07-15 워커 다이어트 3차(대표 승인): 마운트 분리. 재도입=원복.
// app.route('/api/seller/tiktok', tiktokRoutes);

// ── 블로그 (어드민 CRUD + 공개 조회) ──
// SECURITY: /api/admin/blog는 adminApp 내부에서 등록되어 requireAdmin + IP 화이트리스트 적용
// /api/blog는 공개 GET /public, /public/:slug만 허용 (나머지는 라우터 내부에서 admin 체크)
app.route('/api/blog', blogRoutes); // public 엔드포인트 접근용 (내부에서 /public만 공개)

// ── 에이전시 ──
app.route('/api/agency', agencyPinRoutes);
app.route('/api/agency', agencyRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /link-kakao, /unlink-kakao, /kakao-link-status
app.route('/api/agency', agencyKakaoLinkRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /stats, /stats/kpi, /stats/daily, /stats/realtime, /stats/batch
app.route('/api/agency', agencyStatsRoutes);
app.route('/api/agency', agencyIntroducedStoresRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /settlements, /settlement-invoices, /settlement-invoices/:id, /settlements/request
app.route('/api/agency', agencySettlementsRoutes);
// 🛡️ 2026-05-18: 숙소 공구 에이전시 (PR 1 Foundation).
app.route('/api/agency', agencyStaysRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /notices, /monthly-tasks, /targets, /sellers/compare, /contracts
app.route('/api/agency', agencyOpsRoutes);
// 🛡️ 2026-04-28 TD-006 (split): /sellers*, /orders, /streams, /ranking, /schedule, /returns
app.route('/api/agency', agencySellersRoutes);
// 🛡️ 2026-04-26: Agency P0 #4 캠페인 관리
app.route('/api/agency/campaigns', agencyCampaignsRoutes);
// 🛡️ 2026-04-26: Agency P0 #5 인센티브 규칙 엔진
app.route('/api/agency/incentives', agencyIncentivesRoutes);
// 🛡️ 2026-04-26 Q2: 메시지 템플릿 + 일괄 발송
app.route('/api/agency/messages', agencyMessagesRoutes);
// 🛡️ 2026-04-26 Q7: 쿠폰 캐스케이드 (에이전시 → 셀러 → 시청자)
app.route('/api/agency/coupons', agencyCouponsRoutes);
// 🛡️ 2026-04-26 M4: 에이전시 멀티 권한 (owner/manager/agent/analyst)
app.route('/api/agency/members', agencyMembersRoutes);
// 🛡️ 2026-04-26 M5: 라이브 캘린더 + 에이전트 노트
app.route('/api/agency/calendar', agencyCalendarRoutes);
// 🛡️ 2026-04-27 Phase 1-3: QR/링크 영입 코드
app.route('/api/agency/invites', agencyInvitesRoutes);
app.route('/api/invite', inviteCodePublicRoutes);
app.route('/api/prospects', prospectsRoutes);
// 🛡️ 2026-04-27 Phase 1-4: 6대 KPI 대시보드 API
app.route('/api/agency/kpi', agencyKpiRoutes);
// 🤝 2026-07-10 에이전시 위임/promo 투명성 (§4.3 — grant 는 매장만, 에이전시는 조회+요청만)
app.route('/api/agency/delegation', agencyDelegationRoutes);
// 🛡️ 2026-04-27 Phase 1-7: 에이전시 공개 브랜딩 페이지
app.route('/api/agency-public', agencyPublicRoutes);          // 공개 (인증 X)
app.route('/api/agency/public-profile', agencyPublicEditRoutes); // 본인 편집 (인증)
// 2026-05-05: 신규 셀러 자동 매칭 제안 (수락/거절)
app.route('/api/agency', agencyMatchSuggestionsRoutes);
// adminAgencyRoutes는 위에서 adminApp에 등록됨

// 🛡️ 2026-04-23 배치 169: 번들(세트) 상품
app.route('/api/bundles', bundlePublicRoutes);
app.route('/api/bundles', bundleCartRoutes);
app.route('/api/seller/bundles', bundleSellerRoutes);

// 🛡️ 2026-04-23 배치 174: 운영 가이드 (어드민 편집, 셀러/에이전시 읽기)
app.route('/api/guides', guideRoutes);

// YouTube / Live streaming
// 🛡️ 2026-05-12 (재발 fix): POST /api/seller/youtube/live/create 를 top-level 직접 등록.
//   sub-router 마운트 순서 swap 으로도 405 가 계속 발생 → Hono v4 에서 같은 prefix 의
//   여러 sub-app 마운트 시 라우팅 분쟁이 있음. top-level 직접 등록은 분쟁 없음.
//   sub-router 내부 등록도 유지하여 정상 작동 시 동일하게 동작.
// 🗑️ 2026-07-07 (대표 지시 "라이브커머스 모두 제거"): youtube-live 방송 생성/OME admission/라이브 채팅
//   마운트 전부 제거(youtube-live.routes·youtube-chat.routes·ome-push/cache/hmac 삭제). 계정연동(youtubeRoutes)은 유지.
// 🥗 2026-07-15 워커 다이어트 3차(대표 승인): 유튜브라이브 계정연동 마운트 분리. 재도입=원복.
// app.route('/api/seller/youtube', youtubeRoutes);
// app.route('/api/youtube', youtubeRoutes); // legacy path alias

// 🥗 2026-07-15 워커 다이어트 3차(대표 승인): 다중 플랫폼(멀티스트림/RTMP, 라이브 전용) 마운트 분리. 재도입=원복.
// app.route('/api', multiPlatformRoutes);

// 🗑️ 2026-07-07 (라이브커머스 제거 2/N): /api/live·/api/chat(라이브 SSE+채팅) 마운트 제거.

// ── 사이드 배너 (공개 API, 인증 불필요) ──
app.get('/api/side-banners', async (c) => {
  const env = c.env as Env;
  try {
    // Auto-create table if not exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS side_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        link_url TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
    const { results } = await env.DB.prepare(
      `SELECT id, title, image_url, link_url, sort_order
       FROM side_banners WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC`
    ).all();
    return c.json({ success: true, data: results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// (Cafe24 is registered under adminApp above)


// ============================================================
// [참고] 라우트 등록 원칙 (이 주석을 절대 삭제하지 말 것)
// ============================================================
// 1. 동일 경로에 두 라우터를 app.route()하면 Hono는 먼저 등록된 것이 매칭됨.
//    → 같은 경로에 worker 라우터 + feature 라우터를 동시에 등록하지 말 것.
// 2. /api/streams  → streamsRouter   (이 파일에서만 관리)
// 3. /api/users/*  → usersRouter     (이 파일에서만 관리)
// 4. 프론트 호출 경로와 백엔드 app.route() 등록 경로가 반드시 일치해야 함.
//    프론트가 /api/streams 를 호출하는데 백엔드에 /api/seller/streams 만 있으면 404.
// 5. CORS allowed 목록에 실제 도메인이 반드시 포함되어야 함.

// ============================================================
// Image Optimization Proxy (Cloudflare Image Resizing)
// ============================================================

app.get('/api/image/resize', async (c) => {
  const url = c.req.query('url');
  // 🛡️ 2026-04-22: radix=10 명시 (legacy octal 해석 방지) + 범위 clamp
  const width = Math.min(2048, Math.max(16, parseInt(c.req.query('w') || '400', 10) || 400));
  const quality = Math.min(100, Math.max(10, parseInt(c.req.query('q') || '80', 10) || 80));

  if (!url) return c.json({ success: false, error: 'url required' }, 400);

  // SSRF 방어: 허용된 도메인만 프록시
  // 🛡️ 2026-05-27 (사용자 지적): naver image search / 카카오 daumcdn 호스트 추가.
  //   셀러 등록 시 naver 이미지 선택 → 다양한 외부 호스트 image_url 저장 → 변환 없으면 큰 트래픽.
  const ALLOWED_HOSTS = [
    'firebasestorage.googleapis.com', 'img.youtube.com', 'k.kakaocdn.net', 'images.unsplash.com',
    'urdeal.kr', 'ur-live.pages.dev',
    'pstatic.net',  // search.pstatic / shop-phinf / blogfiles / postfiles / phinf / mblogthumb-phinf 등
    'daumcdn.net',  // t1.daumcdn / i1.daumcdn / cf.daumcdn 등
    'giftishow.com', // KT Alpha (image / imghub / bizapi / mall / gift / static)
    'kt.com',        // gift-img.kt / image.kt / static.kt
    'ibb.co',        // ImgBB — 셀러가 api.imgbb.com 으로 업로드한 이미지 (i.ibb.co)
    'googleusercontent.com', // Google 프로필 (lh3.googleusercontent.com)
    'kakaocdn.net',  // 🛡️ 2026-05-27 (메인 페이지 카드 이미지 403 사고): img1/img2/k.kakaocdn.net 카카오 이미지 호스트.
                     //   cf-image.ts EXTERNAL_PROXY_HOSTS 에 추가했는데 worker ALLOWED_HOSTS 미추가 → /api/image/resize 403 → 카드 이미지 안 보임.
    'naver.net',     // 🩹 2026-07-21 전수조사: phinf.naver.net/imgnews.naver.net 가 향후 hotlink-proxy 로
                     //   가도 워커 403 안 나게 선제 등록(현재는 cdn-cgi 경유라 미도달이나 방어).
  ]
  try {
    const parsed = new URL(url)
    if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
      return c.json({ success: false, error: 'domain not allowed' }, 403)
    }
  } catch {
    return c.json({ success: false, error: 'invalid url' }, 400)
  }

  try {
    // 🔬 2026-06-11 (실측 기반 수리 — 사용자 신고 "업로드 카드 느림"):
    //   기존 cf.image fetch 가 Pages 환경에서 변환을 적용하지 않아(실측: 원본 42KB 그대로, 1.6~2.7s)
    //   업로드 이미지(/api/media → 이 프록시 경유)가 전부 원본+느림.
    //   수리: ① 요청 단위 엣지 캐시(repeat ~ms) ② zone 리사이저(cdn-cgi — 오늘 Enable, cf-resized 실측 OK)
    //   경유로 변환 ③ 변환 실패 시 원본 폴백(이미지는 항상 보임 — 기존 동작 보존).
    const cacheKey = new Request(c.req.url, { method: 'GET' });
    // @ts-expect-error — Cloudflare Workers 전역 caches (edge-cache.ts:110 동일 패턴)
    const edge = caches.default as Cache;
    const hit = await edge.match(cacheKey).catch(() => null);
    if (hit) return hit;

    const immutable = (body: BodyInit | ReadableStream | null, type: string) => {
      const headers = new Headers();
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Content-Type', type);
      return new Response(body as BodyInit, { headers });
    };

    // 🏁 2026-06-11 (사용자 — "이미지가 빠르진 않다" → 사전 생성 파이프라인): 변환 결과를 R2 에
    //   영구 저장. 엣지 캐시는 PoP/시간 한정이지만 R2 썸네일은 전 세계·영구 — 같은 이미지의
    //   변환 비용은 평생 1회(월 unique 한도 소비도 1회), 이후 모든 사용자는 즉시 응답.
    const R2 = (c.env as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET;
    const safeKey = btoa(unescape(encodeURIComponent(url))).replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/g, '').slice(0, 200);
    const thumbKey = `thumbs/v1/${width}q${quality}/${safeKey}`;
    if (R2) {
      const stored = await R2.get(thumbKey).catch(() => null);
      if (stored) {
        const out = immutable(stored.body, stored.httpMetadata?.contentType || 'image/webp');
        if (c.executionCtx) c.executionCtx.waitUntil(edge.put(cacheKey, out.clone()).catch(() => {}));
        return out;
      }
    }

    const origin = new URL(c.req.url).origin;
    let response = await fetch(`${origin}/cdn-cgi/image/width=${width},quality=${quality},format=auto/${url}`);
    const transformed = response.ok && !!response.headers.get('cf-resized');
    if (!transformed) {
      // 리사이저 미작동/소스 실패 — 원본 폴백 (변환 없이도 이미지는 표시)
      response = await fetch(url);
      if (!response.ok) return c.redirect(url);
    }

    const type = response.headers.get('Content-Type') || 'image/webp';
    // 변환본만 R2 영구 저장 (원본 폴백분은 저장 X — 다음 요청이 변환 재시도). 5MB 캡.
    if (R2 && transformed) {
      const buf = await response.arrayBuffer();
      const out = immutable(buf, type);
      if (c.executionCtx && buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
        c.executionCtx.waitUntil(R2.put(thumbKey, buf, { httpMetadata: { contentType: type } }).catch(() => {}));
        c.executionCtx.waitUntil(edge.put(cacheKey, out.clone()).catch(() => {}));
      }
      return out;
    }

    const out = immutable(response.body, type);
    if (c.executionCtx) c.executionCtx.waitUntil(edge.put(cacheKey, out.clone()).catch(() => {}));
    return out;
  } catch {
    return c.redirect(url);
  }
});

// ============================================================
// 404 for API routes not matched above
// ============================================================

app.all('/api/*', (c) => c.json({ success: false, error: 'Not found' }, 404));

// ============================================================
// SEO: 봇 감지 + 동적 메타 태그 주입 (SPA용)
// 구글/네이버/카카오/텔레그램 크롤러가 페이지 요청 시
// index.html의 메타 태그를 동적으로 교체하여 응답
// ============================================================

// 🛡️ 2026-04-28 결정적 fix: 일반 카톡 인앱 (kakaotalk/kakaostory/naver) 제거.
//   이들은 *일반 사용자의 인앱 브라우저* 라 SSR meta-only HTML 응답하면 흰화면 + 무한 reload.
//   진짜 검색엔진 크롤러만 유지: googlebot/bingbot/yandex/baiduspider/yeti/naverbot/daumoa
//   메신저 링크 preview 봇 유지 (link card 표시용):
//     - facebookexternalhit/twitterbot/linkedinbot/slackbot/whatsapp/telegram/discord
//     - 🛡️ 2026-04-28 추가: KakaoTalk-Scrap (카톡 link preview 봇) — 카톡 채팅방
//       link card 의 제목/이미지/설명 표시. 일반 카톡 인앱 'KAKAOTALK' 와 다른 UA.
const BOT_UA_REGEX = /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator|yeti|naverbot|daumoa|telegram|whatsapp|discord|KakaoTalk-Scrap/i;

const BASE_URL = 'https://urdeal.kr';
// 🛡️ 2026-05-21: 사용자 요청 — "돈버는 쇼핑" 키워드 노출 + 오프라인 공동구매 우선.
//   서버 side rendering 의 OG meta tag 와 크롤러용 fallback HTML (search bot).
const DEFAULT_OG = {
  title: '유어딜 - 돈버는 쇼핑, 이용권·교환권·동네딜',
  desc: '할인가로 사서 매장에서 바로 쓰는 이용권, 기프티콘 교환권, 내 주변 동네딜, 나만의 링크샵까지. 유어딜에서 돈버는 쇼핑.',
  image: `${BASE_URL}/og-image.png`,
};

app.get('*', async (c) => {
  const ua = c.req.header('user-agent') || '';
  const url = new URL(c.req.url);
  const path = url.pathname;

  // API 경로는 이미 위에서 처리됨 — 여기는 페이지 요청만
  if (path.startsWith('/api/') || path.startsWith('/auth/')) return c.notFound();

  // 🛡️ 2026-06-30 (배포 후 옛 청크 무한로딩 — 방어 in depth): 없는 정적 에셋(확장자 가진 경로)에
  //   SPA index.html(text/html)을 돌려주면 브라우저가 "Expected JS module, got text/html" 로 거부.
  //   ⚠️ 정직한 한계: 실제 청크(`/assets/*`)는 `_routes.json` 의 exclude 목록이라 이 worker 까지
  //      도달하지 않음 — Pages 가 직접 서빙하고, 없으면 Pages 가 HTML 404 를 반환(그게 대표가 본 MIME
  //      에러의 출처). 그래서 그 경로의 *근본 자가복구*는 (1) 클라 `reloadWithCacheBust`(chunk-error
  //      감지 → __cb 캐시버스트 reload) + (2) 아래 SPA 셸 no-cache(reload 가 항상 최신 HTML 수신)다.
  //   이 분기는 exclude 에 없는 확장자 경로(예: 오타·구버전 비-해시 참조)가 worker 에 도달했을 때
  //   HTML 셸 대신 깔끔한 404 를 주는 보조 방어(harmless). 청크 복구의 주역은 위 (1)+(2).
  if (path.startsWith('/assets/') || /\.(?:js|mjs|css|map|woff2?|ttf|otf|json|png|jpe?g|gif|svg|webp|avif|ico|wasm|txt|xml)$/i.test(path)) {
    return c.text('Not Found', 404, { 'Cache-Control': 'no-cache, no-store, must-revalidate' });
  }

  // 봇이 아니면 SPA index.html 반환 (Cloudflare Pages가 처리)
  if (!BOT_UA_REGEX.test(ua)) {
    // Worker에서 직접 index.html을 서빙할 수 없으므로 fetch
    const assetUrl = new URL('/', c.req.url);
    const res = await (c.env as any).ASSETS?.fetch?.(assetUrl.toString())
      || await fetch(assetUrl.toString());
    // 🛡️ 2026-06-30: SPA 셸 HTML 은 절대 stale 캐시 금지 — 옛 청크 해시 참조로 인한 무한로딩 근본차단.
    //   브라우저가 매 진입 시 재검증 → 배포 후 항상 최신 index.html(새 청크 해시) 수신.
    //   SSR inject(미들웨어 470) + caches.default API 캐시는 서버사이드라 HTML 브라우저캐시와 독립
    //   → SSR 0-RTT 최적화 불변(byte-identical). 비-SSR 대시보드/로그인 셸이 stale 안 되게만 보장.
    return new Response(res.body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // ── 봇: 동적 메타 태그 생성 ──
  const { DB } = c.env;
  let og = { ...DEFAULT_OG };
  let canonical = `${BASE_URL}${path}`;

  try {
    // /products/:id → 상품 정보
    const productMatch = path.match(/^\/products\/(\d+)/);
    if (productMatch) {
      const p = await DB.prepare('SELECT name, description, price, image_url FROM products WHERE id = ?')
        .bind(productMatch[1]).first<any>();
      if (p) {
        og.title = `${p.name} - 유어딜`;
        og.desc = p.description?.slice(0, 200) || `${p.name} ${p.price?.toLocaleString()}원 - 유어딜에서 구매하세요`;
        if (p.image_url) og.image = p.image_url;
      }
    }

    // 🏁 2026-06-12 (전 플로우 감사 🟡): /u/:handle 링크샵 + /group-buy/:id 공구 상세 —
    //   카카오 공유의 핵심 표면 2곳이 generic OG 였음(스크래퍼는 JS 미실행이라 클라 SEO 무용).
    const curatorMatch = path.match(/^\/u\/([A-Za-z0-9_-]{1,40})(?:[/?#]|$)/);
    if (curatorMatch && curatorMatch[1] !== 'me') {
      const u = await DB.prepare('SELECT name, bio, profile_image, handle FROM users WHERE handle = ?')
        .bind(curatorMatch[1]).first<any>().catch(() => null);
      if (u) {
        og.title = `${u.name || '@' + u.handle} 링크샵 - 유어딜`;
        og.desc = (u.bio || '').slice(0, 200) || `${u.name || '@' + u.handle}님의 추천 — 교환권·공구 모음`;
        const pi = u.profile_image as string | null;
        if (pi) og.image = pi.startsWith('r2://') ? `${BASE_URL}/api/media/${pi.slice(5)}` : (pi.startsWith('/') ? `${BASE_URL}${pi}` : pi);
      }
    }

    const gbMatch = path.match(/^\/group-buy\/(\d+)/);
    if (gbMatch) {
      const p2 = await DB.prepare('SELECT name, description, price, image_url, restaurant_name FROM products WHERE id = ?')
        .bind(gbMatch[1]).first<any>().catch(() => null);
      if (p2) {
        og.title = `${p2.name}${p2.restaurant_name ? ` · ${p2.restaurant_name}` : ''} - 유어딜 공구`;
        og.desc = (p2.description || '').slice(0, 200) || `같이 사면 더 싸다 — ${p2.name} 공동구매`;
        if (p2.image_url) og.image = p2.image_url;
      }
    }

    // /profile/:slug 또는 /s/:id → 셀러 정보
    const sellerMatch = path.match(/^\/(profile|s)\/(.+)/);
    if (sellerMatch) {
      const param = sellerMatch[2];
      const isNum = /^\d+$/.test(param);
      const s = isNum
        ? await DB.prepare('SELECT name, bio, profile_image FROM sellers WHERE id = ?').bind(param).first<any>()
        : await DB.prepare('SELECT name, bio, profile_image FROM sellers WHERE slug = ? OR username = ?').bind(param, param).first<any>();
      if (s) {
        og.title = `${s.name} - 유어딜`;
        og.desc = s.bio?.slice(0, 200) || `${s.name}의 스토어 - 유어딜`;
        if (s.profile_image) og.image = s.profile_image;
      }
    }

    // /live/:id → 라이브 방송
    const liveMatch = path.match(/^\/live\/(\d+)/);
    if (liveMatch) {
      const s = await DB.prepare('SELECT title, youtube_video_id FROM live_streams WHERE id = ?')
        .bind(liveMatch[1]).first<any>();
      if (s) {
        og.title = `🔴 ${s.title} - 유어딜 라이브`;
        og.desc = `지금 라이브 중! ${s.title} - 유어딜에서 실시간으로 시청하세요`;
        if (s.youtube_video_id) og.image = `https://img.youtube.com/vi/${s.youtube_video_id}/maxresdefault.jpg`;
      }
    }
    // /blog/:slug → 블로그 글
    const blogMatch = path.match(/^\/blog\/([a-z0-9-]+)$/);
    if (blogMatch) {
      const b = await DB.prepare('SELECT title, summary, thumbnail_url FROM blog_posts WHERE slug = ? AND is_published = 1')
        .bind(blogMatch[1]).first<any>();
      if (b) {
        og.title = `${b.title} - 유어딜 블로그`;
        og.desc = b.summary?.slice(0, 200) || '';
        if (b.thumbnail_url) og.image = b.thumbnail_url;
      }
    }

    // /blog → 블로그 목록
    if (path === '/blog') {
      og.title = '유어딜 블로그 — 라이브 커머스 가이드';
      og.desc = '셀러 가이드, 트렌드, 서비스 소식. 유어딜에서 라이브 커머스를 시작하세요.';
    }
  } catch {}

  // 🛡️ 2026-06-26 [보안] OG/메타 HTML 인젝션 차단 — og.title/desc/image/canonical 은
  //   products.name / users.bio / live_streams.title 등 사용자-제어 DB 값에서 옴.
  //   봇 UA 로 위장한 요청이 셀러가 심은 `"><script>...` 상품명을 받으면 속성/태그 탈출 →
  //   서빙 문서에 HTML 주입 + 모든 소셜/카톡 링크프리뷰 변조. 모든 보간값을 escape.
  const esc = (v: unknown): string =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // 메타 태그가 포함된 최소 HTML 반환
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${esc(og.title)}</title>
<meta name="description" content="${esc(og.desc)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(og.title)}" />
<meta property="og:description" content="${esc(og.desc)}" />
<meta property="og:image" content="${esc(og.image)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:site_name" content="유어딜" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(og.title)}" />
<meta name="twitter:description" content="${esc(og.desc)}" />
<meta name="twitter:image" content="${esc(og.image)}" />
<meta name="robots" content="index, follow" />
<meta name="naver-site-verification" content="7be066f6c7f451d994e3a5482aa76f87e96c3c2f" />
</head>
<body>
<div id="root"></div>
<!-- 🛡️ 2026-04-28: window.location.href 제거. 이전 코드: 같은 URL redirect →
     봇으로 잘못 매칭된 일반 사용자가 무한 reload + 흰화면 (카톡 인앱 사고).
     봇은 어차피 JS 실행 안 하므로 redirect 불필요. -->
</body>
</html>`;

  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
});

// ============================================================
// Error Handler
// ============================================================

app.onError(errorHandler);

// ============================================================
// Export Worker + Scheduled Handler (Cron Triggers)
// ============================================================

// 🛡️ 2026-04-27 (TD-006 부분): scheduled handler 를 src/worker/scheduled.ts 로 분리.
// worker/index.ts 가 90줄 줄어듦. cron 로직 변경 시 scheduled.ts 만 수정.
import { handleCronScheduled, wholesaleCronNoop } from './scheduled';

import { swallow } from './utils/swallow';
// 🏭 2026-06-01 유통스타트 도메인 진입 라우팅 (Phase 5, lock-safe 추가).
//   utongstart.com = 도매몰 전용. 도매몰 surface 밖의 페이지 경로는 /wholesale/intro 로 서버 302.
//   ⚠️ 잠긴 SSR inject / caches.default 블록은 미수정 — fetch 진입부에 additive 가드만.
//   urdeal.kr 등 다른 호스트는 즉시 app.fetch 로 통과(no-op).
const WHOLESALE_HOSTS = new Set(['utongstart.com', 'www.utongstart.com']);

// 🏭 2026-06-04 도매몰 도메인 게이팅 (사용자 승인 "가장 이상적이고 근본적으로").
//   utongstart.com 에서 접근 허용되는 경로 prefix. 이 목록 밖의 페이지 라우트는 302.
//   ⚠️ 추가만 OK — 제거 시 도매몰에 소비자몰 페이지가 노출됨.
//   동기화 대상: src/utils/domain.ts `isWholesaleAllowedPath` (클라 SPA 가드 — 같이 갱신).
const WHOLESALE_ALLOWED_PATHS = [
  '/api/', '/assets/', '/cdn-cgi/', '/locales/',  // 인프라 (호스트 무관 통과)
  '/wholesale', '/supplier',                        // 도매몰 + 제조사 surface
  '/seller/login', '/seller/register',              // 판매사 = 셀러 계정 인증
  '/auth/', '/login',                               // 카카오 OAuth 콜백 / 로그인
];

/** utongstart.com 에서 해당 경로가 허용되는지 (정적파일 + allowlist prefix). */
function isWholesaleAllowedPath(pathname: string): boolean {
  if (/\.[a-z0-9]+$/i.test(pathname)) return true; // 정적 파일 (favicon/robots/.js/.css …)
  for (const p of WHOLESALE_ALLOWED_PATHS) {
    if (pathname === p) return true;
    if (pathname.startsWith(p.endsWith('/') ? p : p + '/')) return true;
  }
  return false;
}

// 🏬 2026-06-09 멀티몰: wholesale_malls 에 등록된 host 도 '도매몰 전용'으로 인식(루트→/wholesale).
//   ⚠️ 소비자 호스트는 fast-path 로 DB 조회 skip(핫패스 byte-identical). 미지 호스트만 캐시된 몰-호스트 set 조회.
const CONSUMER_FAST_PATH = new Set(['urdeal.kr', 'www.urdeal.kr', 'live.ur-team.com', 'ur-live.pages.dev', 'localhost']);
// 🌐 2026-07-20 도메인 이전 (대표 확정 urdeal.kr): 구 소비자 도메인 — 내비게이션만 301, API 는 계속 서빙.
const LEGACY_CONSUMER_HOSTS = new Set(['live.ur-team.com']);
let _mallHostCache: { hosts: Set<string>; at: number } | null = null;
async function getWholesaleMallHosts(env: unknown): Promise<Set<string>> {
  const now = Date.now();
  if (_mallHostCache && now - _mallHostCache.at < 300_000) return _mallHostCache.hosts; // 5분 isolate 캐시
  const set = new Set<string>();
  try {
    const DB = (env as { DB?: D1Database }).DB;
    if (DB) {
      const { results } = await DB.prepare("SELECT host FROM wholesale_malls WHERE active = 1 AND host IS NOT NULL AND host != ''").all<{ host: string }>();
      for (const r of (results || [])) {
        for (const h of String(r.host).split(',')) {        // host 컬럼은 콤마 다중 호스트 허용
          const hh = h.trim().toLowerCase().replace(/^www\./, '');
          if (hh) { set.add(hh); set.add('www.' + hh); }
        }
      }
    }
  } catch { /* 테이블 미존재 환경 — 빈 set(폴백: 정적 WHOLESALE_HOSTS 만) */ }
  _mallHostCache = { hosts: set, at: now };
  return set;
}

export default {
  fetch: async (request: Request, env: unknown, ctx: unknown) => {
    try {
      const url = new URL(request.url);
      const host = url.hostname.toLowerCase();
      // 🌐 2026-07-20 도메인 이전 [UNLOCK_LOADING] (대표 확정 urdeal.kr — "같이 작업, 빠짐없이"):
      //   구 도메인 GET/HEAD 내비게이션 → https://urdeal.kr 301 (영구). 발급된 QR(/v/*)·카톡/MMS 링크·
      //   검색 색인 전부 이 한 블록이 새 도메인으로 인계.
      //   ❗ 제외 3종 (도메인 이전 문서 §C 근거):
      //   - /api/*  : 토스 웹훅(POST, 301 추종 미보장 — 머니) · 구 도메인에 열린 SPA 의 same-origin
      //               fetch(cross-origin 301 = CORS 실패) · 카카오 콘솔 등록 콜백 보존
      //   - /assets/*: 전환 순간 열려 있던 구 SPA 탭의 청크 lazy-load 보호 (문서 GET 은 어차피 301)
      //   - /.well-known/*: 딥링크 검증 파일은 각 호스트에서 직접 서빙
      //   www.urdeal.kr → urdeal.kr 정규화도 동일 블록이 처리.
      if (
        (LEGACY_CONSUMER_HOSTS.has(host) || host === 'www.urdeal.kr') &&
        (request.method === 'GET' || request.method === 'HEAD') &&
        !url.pathname.startsWith('/api/') &&
        !url.pathname.startsWith('/assets/') &&
        !url.pathname.startsWith('/.well-known/')
      ) {
        return Response.redirect(`https://urdeal.kr${url.pathname}${url.search || ''}`, 301);
      }
      // 🔗 블로그 슬러그 리네임 301 (맵/사유 SSOT: features/blog/api/blog-slug-redirects.ts)
      if (request.method === 'GET' || request.method === 'HEAD') {
        const renamed = resolveRenamedBlogPath(url.pathname);
        if (renamed) return Response.redirect(`${url.origin}${renamed}${url.search || ''}`, 301);
        // 🔀 2026-07-29 별칭 경로 301 (SSOT: shared/seo/consumer-redirects).
        //   `App.tsx` 에 `<Navigate>` 로만 있던 경로들 — 서버는 그 URL 에도 SPA 셸을 200 + index,follow
        //   로 내주고 있어서 크롤러에겐 "홈과 같은 내용의 색인 가능 URL" 이 7개 더 있는 셈이었다.
        //   클라 리다이렉트는 JS 를 돌리는 방문자에게만 통한다. SPA 내부 이동은 서버를 안 타므로
        //   App.tsx 의 <Navigate> 는 그대로 둔다(지우면 앱 안에서 갈 곳이 없어진다).
        const alias = resolveConsumerAlias(url.pathname);
        // 🍽️ 2026-08-11: 목적지가 이미 쿼리를 갖는 별칭이 생겼다(`/meal-vouchers` → `/?category=…`).
        //   그냥 이어붙이면 `…?category=x?foo=y` — 두 번째 `?` 는 값의 일부로 먹힌다.
        if (alias) return Response.redirect(`${url.origin}${alias}${url.search ? (alias.includes('?') ? `&${url.search.slice(1)}` : url.search) : ''}`, 301);
      }
      let isWhHost = WHOLESALE_HOSTS.has(host);
      // 멀티몰: 정적 set 밖 + 소비자 호스트 아닌 미지 호스트만 등록 몰-호스트 조회(캐시 — 핫패스 영향 0).
      if (!isWhHost && !CONSUMER_FAST_PATH.has(host)) {
        const mallHosts = await getWholesaleMallHosts(env);
        isWhHost = mallHosts.has(host);
      }
      if (isWhHost && !isWholesaleAllowedPath(url.pathname || '/')) {
        // 🏭 몰-first: 도매몰 도메인 비-도매몰 경로 → 카탈로그(/wholesale)로 302. (utongstart + 등록 몰 호스트)
        return Response.redirect(`${url.origin}/wholesale`, 302);
      }
      // 🔗 2026-06-17 [UNLOCK_LOADING] 링크샵 URL 통일 (사용자 승인 "전체 통일 + 301"):
      //   셀러 공개 URL /profile/:username · /s/:slug → 연결 유저 handle 있으면 /u/{handle} 로 301(영구).
      //   handle 없으면 통과(기존 SellerPublicPage 그대로). 검색 노출/외부링크를 /u/ 로 통일.
      //   /u/{seller-handle} 은 CuratorPage 가 linked_seller 감지해 SellerPublicPage 를 inline 렌더(기존 동작).
      //   additive 진입 가드 — 잠긴 SSR inject 블록 무수정. /profile/:x, /s/:x exact 1세그먼트만 매칭(서브경로 X).
      const lsMatch = url.pathname.match(/^\/(?:profile|s)\/([A-Za-z0-9_-]{1,40})\/?$/);
      if (lsMatch) {
        try {
          const DB = (env as { DB?: D1Database }).DB;
          if (DB) {
            const slug = lsMatch[1];
            const row = await DB.prepare(
              `SELECT u.handle AS handle FROM sellers s JOIN users u ON u.id = s.linked_user_id
               WHERE (s.username = ? OR CAST(s.id AS TEXT) = ?) AND u.handle IS NOT NULL AND u.handle != '' LIMIT 1`
            ).bind(slug, slug).first<{ handle: string }>();
            if (row?.handle && row.handle.toLowerCase() !== 'me' && row.handle.toLowerCase() !== slug.toLowerCase()) {
              return Response.redirect(`${url.origin}/u/${encodeURIComponent(row.handle)}${url.search || ''}`, 301);
            }
          }
        } catch { /* 조회 실패 — 기존 /profile 서빙으로 통과 */ }
      }
    } catch { /* URL 파싱 시 통과 */ }
    // 📊 2026-07-22 (대표 "모두 진행"): D1 rows_read 집계 프록시 — **저율 자동 샘플링(상시)**.
    //   토글(`D1_PROFILE_ENABLED='true'`)=100% 강제, 아니면 기본 2%(`D1_PROFILE_SAMPLE` 로 조정, '0'=OFF).
    //   샘플된 요청만 프록시 → 오버헤드 사실상 0인데 데이터는 상시 축적(수동 토글 불필요). 저장 쓰기 0.
    let fenv: unknown = env;
    try {
      const pe = env as { D1_PROFILE_ENABLED?: string; D1_PROFILE_SAMPLE?: string };
      const forceOn = pe?.D1_PROFILE_ENABLED === 'true';
      const rawSample = pe?.D1_PROFILE_SAMPLE;
      const sampleRate = forceOn ? 1 : (rawSample != null && rawSample !== '' ? Number(rawSample) : 0.02);
      if (sampleRate > 0 && (forceOn || Math.random() < sampleRate)) {
        const dbEnv = env as { DB?: D1Database };
        if (dbEnv.DB) {
          const { profileD1 } = await import('./utils/d1-profiler');
          fenv = { ...(env as object), DB: profileD1(dbEnv.DB, new URL(request.url).pathname) };
        }
      }
    } catch { /* 프로파일 배선 실패 — 원본 env 로 통과 */ }
    // @ts-expect-error — Hono app.fetch 시그니처로 위임 (env/ctx passthrough).
    return app.fetch(request, fenv, ctx);
  },
  scheduled: __INCLUDE_WHOLESALE__ === true ? wholesaleCronNoop : handleCronScheduled, // 극성 주의: `=== true` 만 no-op(느슨하게 바꾸면 소비자 cron 사망). 배경: scheduled.ts
};
