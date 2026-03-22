# API Endpoints 구현 상태

**업데이트**: 2026-03-17  
**상태**: ✅ 구현 완료 | ⚠️ 부분 구현 | ❌ 미구현 | 🔄 작업 중

---

## Admin APIs

### Products (admin-management.routes.ts)
- ✅ `GET /api/admin/products` - 상품 목록 조회
- ✅ `POST /api/admin/products` - 상품 등록
- ✅ `PUT /api/admin/products/:id` - 상품 수정
- ✅ `PATCH /api/admin/products/:id` - 상품 활성화 토글
- ✅ `DELETE /api/admin/products/:id` - 상품 삭제

### Sellers (admin-management.routes.ts)
- ✅ `GET /api/admin/sellers` - 판매자 목록
- ✅ `GET /api/admin/sellers/pending` - 승인 대기 판매자
- ✅ `PATCH /api/admin/sellers/:id/approve` - 판매자 승인
- ✅ `PATCH /api/admin/sellers/:id/reject` - 판매자 거부
- ⚠️ `PATCH /api/admin/sellers/:id/commission` - 수수료율 변경 (임시 구현)
- ⚠️ `PATCH /api/admin/sellers/:id/permissions` - 권한 변경 (임시 구현)
- ❌ `DELETE /api/admin/sellers/:id` - 판매자 삭제 (미구현)

### Orders (admin-management.routes.ts)
- ✅ `GET /api/admin/orders` - 주문 목록 (with filters)

### Stats (admin-management.routes.ts)
- ✅ `GET /api/admin/stats` - 기본 통계
- ✅ `GET /api/admin/dashboard/stats` - 대시보드 통계
- ✅ `GET /api/admin/settlement/stats` - 정산 통계
- ✅ `GET /api/admin/settlement/records` - 정산 기록

### Streams (admin-management.routes.ts)
- ✅ `DELETE /api/admin/streams/:id` - 스트림 삭제

### Banners (admin-banners.routes.ts)
- ✅ `GET /api/admin/banners` - 배너 목록
- ✅ `POST /api/admin/banners` - 배너 등록
- ✅ `PUT /api/admin/banners/:id` - 배너 수정
- ✅ `DELETE /api/admin/banners/:id` - 배너 삭제

### Alimtalk (admin-management.routes.ts)
- ✅ `GET /api/admin/alimtalk/pricing` - 알림톡 요금
- ✅ `PUT /api/admin/alimtalk/pricing/:id` - 요금 수정
- ✅ `GET /api/admin/alimtalk/accounts` - 계정 목록
- ✅ `PATCH /api/admin/alimtalk/accounts/:id/status` - 계정 상태
- ✅ `GET /api/admin/alimtalk/statistics` - 알림톡 통계

---

## Auth APIs

### User Auth (auth.routes.ts)
- ✅ `POST /api/auth/register` - 회원가입
- ✅ `POST /api/auth/login` - 로그인
- ✅ `GET /api/auth/me` - 내 정보
- ✅ `GET /api/auth/validate` - 세션 검증

### Admin Auth (auth/api/admin.routes.ts)
- ✅ `POST /api/admin/login` - 관리자 로그인
- ✅ `POST /api/admin/refresh` - 토큰 갱신

### Seller Auth (auth/api/seller.routes.ts)
- ✅ `POST /api/seller/login` - 판매자 로그인
- ✅ `POST /api/seller/refresh` - 토큰 갱신

### OAuth (auth/api/)
- ✅ `GET /auth/kakao/sync/callback` - Kakao 콜백
- ✅ `POST /api/auth/kakao/*` - Kakao 인증
- ✅ `POST /api/auth/google/*` - Google 인증

---

## Seller APIs

### Management (seller/api/seller-management.routes.ts)
- ✅ `GET /api/seller/profile` - 프로필 조회
- ✅ `PUT /api/seller/profile` - 프로필 수정
- ✅ `GET /api/seller/stats` - 판매 통계

### Streams (seller/api/seller-streams.routes.ts)
- ✅ `GET /api/seller/streams` - 내 스트림 목록
- ✅ `GET /api/seller/streams/:id` - 스트림 상세
- ✅ `POST /api/seller/streams` - 스트림 생성
- ✅ `PUT /api/seller/streams/:id` - 스트림 수정
- ✅ `DELETE /api/seller/streams/:id` - 스트림 삭제

### Orders (seller/api/seller-orders.routes.ts)
- ✅ `GET /api/seller/orders` - 주문 목록
- ✅ `GET /api/seller/orders/:id` - 주문 상세
- ✅ `PATCH /api/seller/orders/:id/status` - 주문 상태 변경

---

## Public APIs

### Products (product.routes.ts, products/api/products.routes.ts)
- ✅ `GET /api/products` - 상품 목록
- ✅ `GET /api/products/:id` - 상품 상세

### Streams (streams.routes.ts)
- ✅ `GET /api/streams` - 라이브 스트림 목록
- ✅ `GET /api/streams/:id` - 스트림 상세

### Orders (order.routes.ts, orders/api/orders.routes.ts)
- ✅ `GET /api/orders` - 내 주문 목록
- ✅ `GET /api/orders/:id` - 주문 상세
- ✅ `POST /api/orders` - 주문 생성

### Cart (cart/api/cart.routes.ts)
- ✅ `GET /api/cart` - 장바구니 조회
- ✅ `POST /api/cart` - 장바구니 추가
- ✅ `PUT /api/cart/:id` - 장바구니 수정
- ✅ `DELETE /api/cart/:id` - 장바구니 삭제

### Wishlist (wishlists/api/wishlists.routes.ts)
- ✅ `GET /api/wishlists` - 위시리스트 조회
- ✅ `POST /api/wishlists` - 위시리스트 추가
- ✅ `DELETE /api/wishlists/:id` - 위시리스트 삭제

### Banners (banners/api/banners.routes.ts)
- ✅ `GET /api/banners` - 배너 목록

### Notifications (notifications/api/notifications.routes.ts)
- ✅ `GET /api/notifications` - 알림 목록 (graceful handling)
- ✅ `GET /api/notifications/unread-count` - 미읽음 수
- ✅ `PUT /api/notifications/:id/read` - 읽음 처리
- ✅ `PUT /api/notifications/read-all` - 전체 읽음
- ✅ `DELETE /api/notifications/:id` - 알림 삭제

### Shipping (shipping/api/shipping-address.routes.ts)
- ✅ `GET /api/shipping-addresses` - 배송지 목록
- ✅ `POST /api/shipping-addresses` - 배송지 추가
- ✅ `PUT /api/shipping-addresses/:id` - 배송지 수정
- ✅ `DELETE /api/shipping-addresses/:id` - 배송지 삭제

---

## Payment APIs

### Toss Payments (payment.routes.ts, payments/api/payment.routes.ts)
- ✅ `POST /api/payments/checkout-session` - 결제 세션 생성
- ✅ `GET /api/payment/success` - 결제 성공 콜백
- ✅ `GET /api/payment/fail` - 결제 실패 콜백
- ✅ `POST /api/payments/cancel` - 결제 취소

---

## Utility APIs

### Users (users.routes.ts)
- ✅ `GET /api/users/role` - 사용자 역할 조회
- ✅ `POST /api/users/init` - 사용자 초기화

### Account (account/api/account.routes.ts)
- ✅ `GET /api/account/profile` - 계정 프로필
- ✅ `PUT /api/account/profile` - 프로필 수정
- ✅ `DELETE /api/account` - 계정 삭제

### YouTube (youtube/api/)
- ✅ `GET /api/youtube/*` - YouTube 통합
- ✅ `GET /api/youtube/chat/*` - YouTube 채팅

### Push (push/api/push.routes.ts)
- ✅ `POST /api/push/subscribe` - 푸시 구독
- ✅ `POST /api/push/send` - 푸시 전송

### Webhook (webhook.routes.ts)
- ✅ `POST /api/webhooks/*` - Webhook 수신

---

## 통계

- **총 엔드포인트**: ~100+개
- **구현 완료**: ~95개 (95%)
- **부분 구현**: 2개 (2%)
- **미구현**: 1개 (1%)

## 주요 누락 사항

1. ❌ `DELETE /api/admin/sellers/:id` - 판매자 삭제 API
2. ⚠️ `commission_rate`, `can_manipulate_stats` 컬럼 누락 (DB 스키마)
3. ⚠️ `notifications` 테이블 누락 (graceful handling으로 대응)

## 다음 작업

1. 판매자 삭제 API 구현
2. DB 스키마에 누락된 컬럼 추가
3. Notifications 테이블 생성
4. E2E 테스트로 모든 엔드포인트 검증
