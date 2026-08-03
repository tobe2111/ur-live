// ============================================================
// 🏭 도매몰(유통스타트) 라우트 마운트 — 별도배포 분리 (2026-07-16)
// ============================================================
// 이 모듈은 도매(B2B) HTTP 라우트 전부를 app/adminApp 에 마운트한다.
// index.ts 는 `__INCLUDE_WHOLESALE__` define 이 true 일 때만 이 모듈을 동적 import 한다.
//   - 소비자(ur-live): WHOLESALE_BUNDLE 미설정 → __INCLUDE_WHOLESALE__=false
//        → esbuild DCE 로 이 모듈 + 도매 라우트 그래프 전체가 번들에서 제외(워커 gzip ~200KB↓).
//   - 도매(ur-wholesale): 빌드 env WHOLESALE_BUNDLE=1 → __INCLUDE_WHOLESALE__=true → 포함.
//
// ⚠️ 정산 엔진(supply-settlement.ts)은 여기 없음 — 소비자 주문확정/환불/cron 이 직접 호출하므로
//    (order-commissions.ts / order-refund.ts / scheduled.ts 의 동적 import) index.ts 그래프에 잔류한다.
//    여긴 오직 HTTP 라우트 마운트만. 두 워커는 같은 D1 을 공유(데이터 분리 없음).
//
// ⚠️ adminApp 도매 마운트는 반드시 `app.route('/api/admin', adminApp)` 전에 등록돼야 하므로
//    index.ts 는 이 함수를 그 지점 직전에 TLA(await import)로 호출한다.
import type { Hono } from 'hono';
import type { Env } from './types/env';
import { publicCache, edgeCache } from './middleware/edge-cache';

import { adminSuppliersRoutes } from '../features/admin/api/admin-suppliers.routes';
import { supplyRoutes } from '../features/supply/api/supply.routes';
import { supplierAuthRoutes } from '../features/supply/api/supplier-auth.routes';
import { supplierDashboardRoutes } from '../features/supply/api/supplier-dashboard.routes';
import { distributorAdminRoutes } from '../features/supply/api/distributor-admin.routes';
import { wholesaleRoutes } from '../features/supply/api/wholesale.routes';
import { wholesaleSupplierRoutes } from '../features/supply/api/wholesale-supplier.routes';
import { wholesaleClaimsRoutes } from '../features/supply/api/wholesale-claims.routes';
import { naverCommerceRoutes } from '../features/supply/api/naver-commerce.routes';
import { coupangCommerceRoutes } from '../features/supply/api/coupang-commerce.routes';
import { wholesaleQuotesRoutes } from '../features/supply/api/wholesale-quotes.routes';
import { supplierAnalyticsRoutes } from '../features/supply/api/supplier-analytics.routes';
import { wholesalePriceReferenceRoutes } from '../features/supply/api/wholesale-price-reference.routes';
import wholesaleTaxRoutes from '../features/supply/api/wholesale-tax.routes';
import { wholesaleIntegrityRoutes } from '../features/supply/api/wholesale-integrity.routes';
import { wholesaleNotificationsRoutes } from '../features/supply/api/wholesale-notifications.routes';
import { wholesaleShipAddressRoutes } from '../features/supply/api/wholesale-ship-address.routes';
import { wholesaleDepositRoutes, adminWholesaleDepositRoutes } from '../features/supply/api/wholesale-deposit.routes';
import { wholesalePlusRoutes } from '../features/supply/api/wholesale-plus.routes';
import { supplierWithdrawalRoutes, adminWholesaleWithdrawalRoutes } from '../features/supply/api/supplier-withdrawal.routes';
import { wholesaleChatRoutes } from '../features/supply/api/wholesale-chat.routes';
import { wholesaleMainPublicRoutes, adminWholesaleBannerRoutes, adminWholesaleProposalRoutes, adminWholesaleProductRoutes, adminWholesaleDepositAccountRoutes } from '../features/supply/api/wholesale-main.routes';
import { wholesaleBoardPublicRoutes, wholesaleWishlistRoutes, adminWholesaleBoardRoutes } from '../features/supply/api/wholesale-board.routes';
import { adminWholesaleOverviewRoutes } from '../features/supply/api/wholesale-overview-admin.routes';
import { buyerPoolRoutes } from '../features/supply/api/buyer-pool.routes';
import { makerPoolRoutes } from '../features/supply/api/maker-pool.routes';

type App = Hono<{ Bindings: Env }>;

/**
 * 도매(B2B) 라우트를 메인 app + adminApp 에 마운트한다.
 * index.ts 의 원래 인라인 마운트(1673~1744 등)와 순서/경로/미들웨어 byte-동일.
 * @param app     메인 Hono 앱
 * @param adminApp 어드민 서브앱 — 반드시 app.route('/api/admin', adminApp) 호출 전에 전달할 것.
 */
export function mountWholesale(app: App, adminApp: App): void {
  // ── 어드민 서브앱: 공급자 계정 관리 + 제조사 출금 승인 (원래 index.ts:1615/1617) ──
  adminApp.route('/', adminSuppliersRoutes);
  adminApp.route('/', adminWholesaleWithdrawalRoutes);

  // ── Supply chain (공급가 시스템) ──
  app.route('/api/supply', supplyRoutes);
  app.route('/api/supplier', supplierAuthRoutes); // 도매몰 INC-3: 외부 도매상 인증
  app.route('/api/supplier', supplierDashboardRoutes); // 도매몰 INC-4/6: 공급자 카탈로그 self-serve + 대시보드
  app.route('/api/admin/distributor', distributorAdminRoutes); // 유통스타트: 판매사 등급/마진 설정 (Phase 1b)
  // 🏭 도매 user-agnostic 엔드포인트 엣지캐시 — 라우트 mount 보다 먼저 등록해야 적용됨.
  app.use('/api/wholesale/banners', publicCache(120));
  app.use('/api/wholesale/mall', publicCache(300));
  app.use('/api/wholesale/board/posts', publicCache(120));
  // 🏭 상품 상세(/catalog/:id) 게스트 엣지캐시 — edgeCache(bypassIfAuthed): 게스트=캐시, 로그인=bypass.
  app.use('/api/wholesale/catalog/*', edgeCache(120));
  app.route('/api/wholesale', wholesaleRoutes); // 유통스타트: 판매사 도매 카탈로그 + B2B 주문 (Phase 2)
  app.route('/api/supplier/wholesale', wholesaleSupplierRoutes); // 유통스타트: 제조사 도매주문 송장/반품 (Phase 3)
  app.route('/api/wholesale', wholesaleClaimsRoutes); // BIZ-1: 판매사 발의 클레임/RMA + admin 검수
  app.route('/api/wholesale/naver', naverCommerceRoutes); // 🛒 판매사 스마트스토어 연동 (네이버 커머스API)
  app.route('/api/wholesale/coupang', coupangCommerceRoutes); // 🛒 판매사 쿠팡 연동 (Wing 오픈API — 내보내기)
  app.route('/api/wholesale', wholesaleQuotesRoutes);  // BIZ-3: 견적/발주(Quote/PO) 워크플로
  app.route('/api/wholesale', wholesaleNotificationsRoutes); // NOTI-1: 재입고 알림 + 주문 메모 스레드
  app.route('/api/wholesale', wholesaleShipAddressRoutes); // 🚚 판매사 배송지 주소록(기본/최근) — 체크아웃
  app.route('/api/supplier', supplierAnalyticsRoutes); // BIZ-6: 공급사 분석 + 가격일괄/재고import
  app.route('/api/supplier', supplierWithdrawalRoutes); // 🏦 제조사 정산금 출금 신청/내역 (requireSupplier)
  app.route('/api/admin/wholesale', wholesalePriceReferenceRoutes); // BIZ-5: 네이버 최저가 참고값(어드민 검수)
  app.route('/api/admin/wholesale', wholesaleTaxRoutes); // TAX-1: 미수/미지급 aging + 매입 역발행(수동)
  app.route('/api/admin/wholesale/integrity', wholesaleIntegrityRoutes); // DATA-1: 고아행 무결성 리포트
  app.route('/api/wholesale', wholesaleDepositRoutes); // 🏦 예치금(선불) 결제 — 판매사 잔액/충전요청
  app.route('/api/wholesale/plus', wholesalePlusRoutes); // 🏅 프로 멤버십(연 구독) — 예치금 차감
  app.route('/api/admin/wholesale-deposits', adminWholesaleDepositRoutes); // 🏦 예치금 입금확인/거절/보정 (어드민)
  app.route('/api/wholesale/chat', wholesaleChatRoutes); // 💬 판매사↔제조사 채팅 (D1 polling)
  // 🏭 도매몰 메인 — 배너/제안·신고/프리미엄/입금계좌
  app.route('/api/wholesale', wholesaleMainPublicRoutes); // 공개 배너 캐러셀 + 판매사 제안·신고
  app.route('/api/admin/wholesale-banners', adminWholesaleBannerRoutes); // 어드민 배너 CRUD
  app.route('/api/wholesale/board', wholesaleBoardPublicRoutes); // 🏭 통합 게시판(공지/자료실) 공개 읽기
  app.route('/api/wholesale/wishlist', wholesaleWishlistRoutes); // 🏭 판매사 찜리스트 (로그인)
  app.route('/api/admin/wholesale-board', adminWholesaleBoardRoutes); // 어드민 게시글 CRUD
  app.route('/api/admin/wholesale-proposals', adminWholesaleProposalRoutes); // 어드민 제안·신고 큐/처리
  app.route('/api/admin/wholesale-products', adminWholesaleProductRoutes); // 어드민 프리미엄 전용관 토글
  app.route('/api/admin/wholesale-deposit-account', adminWholesaleDepositAccountRoutes); // 어드민 예치금 입금계좌 설정
  // 🏬 멀티-몰 관리 CRUD 는 여기 없다 — `worker/index.ts` 가 **게이트 밖에서** 마운트한다.
  //   이유: 그 API 가 지배하는 건 도매몰이 아니라 `urdeal.kr/{슬러그}`(소비자 표면)다. 여기로 되돌리면
  //   소비자 배포에서 어드민 화면만 남고 API 가 다시 404 가 된다(2026-08-03 실측). 중복 마운트도 금지.
  app.route('/api/admin/wholesale-overview', adminWholesaleOverviewRoutes); // 🏬 어드민 도매 통합 현황
  app.route('/api/admin/buyer-pool', buyerPoolRoutes); // 🌐 해외 수출 바이어 파이프라인(무료 수집·유어딜 무관·격리 테이블·게이트 OFF)
  app.route('/api/admin/maker-pool', makerPoolRoutes); // 🏭 제조사(브랜드사)·판매사 후보 풀(도매 격리 테이블·게이트 OFF)
}
