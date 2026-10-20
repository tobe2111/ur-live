# API 라우트 매핑

## /api/seller 라우터 매핑 도표

`/api/seller` prefix 로 여러 라우터가 마운트됨. Non-overlapping 하도록 sub-path 분리.
**새 엔드포인트 추가 시 이 표 먼저 확인.**

| Prefix | 라우터 | 파일 | 등록 path |
|---|---|---|---|
| `/api/seller` | sellerAuthRoutes | `features/auth/api/seller-auth.routes.ts` | `/login`, `/register`, `/refresh`, `/forgot-password` |
| `/api/seller` | sellerManagementRoutes | `features/seller/api/seller-management.routes.ts` | `/profile`, `/business-info`, `/stats`, `/settlements`, `/change-password`, `/upload-image`, `/register-from-user`, `/switch-to-*` |
| `/api/seller` | sellerPinRoutes | `features/seller/api/seller-pin.routes.ts` | `/set-pin`, `/verify-pin`, `/pin-status`, `/request-kakao-stepup` |
| `/api/seller` | sellerOrdersRoutes | `features/seller/api/seller-orders.routes.ts` | `/orders`, `/orders/:id/*`, `/products`, `/products/:id/*` |
| `/api/seller` | sellerDonationsRoutes | `features/donations/api/seller-donations.routes.ts` | `/donations`, `/donations/summary`, `/donations/settlements` |
| `/api/seller/analytics` | sellerAnalyticsRoutes | `features/seller/api/seller-analytics.routes.ts` | (전용 prefix) |
| `/api/seller/streams` | sellerStreamsRoutes | `features/seller/api/seller-streams.routes.ts` | (전용 prefix) |
| `/api/seller/alimtalk` | alimtalkRoutes | `features/alimtalk/api/alimtalk.routes.ts` | `/credits`, `/logs` 등 (전용 prefix) |
| `/api/seller/restaurant-settlements` | sellerSettlementRoutes | (전용 prefix) | |
| `/api/seller/youtube` | youtubeRoutes | `features/seller/api/youtube.routes.ts` | (전용 prefix) |
| `/api/sellers` | sellersRouter | `worker/routes/seller.routes.ts` | `/`, `/:id`, `/:id/public`, `/:sellerId/products-public` (복수형! 공개 조회용) |

**주의**: `/api/seller` 복수 라우터는 path 충돌 시 **등록 순서** 대로 우선권. 현 순서: auth → management → pin → orders → donations.

## 파일-라우트 매핑 (실수 방지)

- 홈(`/`) → **`MainHomePage.tsx`** (NOT ~~HomePage.tsx~~ — 삭제됨)
- 마이페이지(`/user/profile`) → **`UserProfilePage.tsx`**
- 라우트 확인: `App.tsx` 의 `<Route>` 컴포넌트 확인 필수

## Co-mounted routing (의식적 허용)

`/api/orders`, `/api/seller` — path 충돌 0건 (2026-04-26 audit, `docs/DOUBLE_ROUTING_AUDIT.md`).

- worker = 핵심 CRUD
- feature = 부가 기능
- `/api/payments` 의 dead `/rollback` 제거 완료
