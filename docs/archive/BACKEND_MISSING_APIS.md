# 🔴 프론트엔드만 구현되고 백엔드 미구현 API 목록

**작성일**: 2026-03-08  
**상태**: 백엔드 구현 필요 항목 분석

---

## 📊 현재 백엔드 구현 상태

### ✅ 완전 구현된 백엔드 API (7개 feature)

1. **인증 (Auth)**
   - ✅ `POST /api/auth/kakao/callback` - 카카오 로그인
   - ✅ `GET /auth/kakao/sync/callback` - 카카오 싱크 콜백
   - ✅ `POST /api/auth/kakao/firebase` - Firebase 토큰 생성
   - ✅ `POST /api/auth/google/register` - 구글 회원가입
   - ✅ `POST /api/seller/login` - 셀러 로그인 ⭐ **NEW**
   - ✅ `POST /api/admin/login` - 관리자 로그인 ⭐ **NEW**
   - ✅ `GET /api/users/role` - 사용자 역할 조회

2. **상품 (Products)**
   - ✅ `GET /api/products` - 상품 목록 조회
   - ✅ `GET /api/products/:id` - 상품 상세 조회
   - ✅ `POST /api/products` - 상품 등록 (셀러)
   - ✅ `PUT /api/products/:id` - 상품 수정
   - ✅ `DELETE /api/products/:id` - 상품 삭제

3. **주문 (Orders)**
   - ✅ `GET /api/orders` - 주문 목록 조회
   - ✅ `GET /api/orders/:id` - 주문 상세 조회
   - ✅ `POST /api/orders` - 주문 생성
   - ✅ `PUT /api/orders/:id/status` - 주문 상태 업데이트

4. **계정 (Account)**
   - ✅ `POST /api/account/delete` - 계정 삭제

---

## ❌ 백엔드 미구현 API 목록 (총 32개 엔드포인트)

### 🔴 높은 우선순위 (즉시 필요, 13개)

#### 1. 셀러 관리 API (6개)
```typescript
// 셀러 프로필 및 비즈니스 정보
POST   /api/seller/register          // 셀러 회원가입 (프론트: SellerRegisterPage)
GET    /api/seller/profile            // 셀러 프로필 조회 (프론트: SellerProfileEditPage)
PUT    /api/seller/profile            // 셀러 프로필 수정
GET    /api/seller/business-info      // 사업자 정보 조회 (프론트: SellerBusinessInfoPage)
PUT    /api/seller/business-info      // 사업자 정보 수정
GET    /api/seller/stats               // 셀러 통계 (프론트: SellerPage, SellerDashboardPage)
```

**구현 필요도**: ⭐⭐⭐⭐⭐ (매우 높음)  
**예상 소요 시간**: 4-5시간  
**프론트엔드 페이지**: SellerPage, SellerProfileEditPage, SellerBusinessInfoPage, SellerDashboardPage

#### 2. 셀러 주문 관리 API (2개)
```typescript
// 셀러의 주문 관리
GET    /api/seller/orders             // 셀러 주문 목록 (프론트: SellerOrdersPage)
PUT    /api/seller/orders/:id/status  // 배송 상태 업데이트
```

**구현 필요도**: ⭐⭐⭐⭐⭐ (매우 높음)  
**예상 소요 시간**: 2-3시간  
**프론트엔드 페이지**: SellerOrdersPage (773줄)

#### 3. 셀러 상품 관리 API (1개)
```typescript
// 셀러 전용 상품 조회
GET    /api/seller/products           // 셀러 상품 목록 (프론트: SellerProductsPage)
```

**구현 필요도**: ⭐⭐⭐⭐⭐ (매우 높음)  
**예상 소요 시간**: 1시간  
**프론트엔드 페이지**: SellerProductsPage (342줄)

#### 4. 장바구니 API (2개)
```typescript
// 장바구니 관리
GET    /api/cart                      // 장바구니 조회 (프론트: CartPage)
POST   /api/cart                      // 장바구니 추가
PUT    /api/cart/:id                  // 장바구니 수정
DELETE /api/cart/:id                  // 장바구니 아이템 삭제
POST   /api/cart/clear                // 장바구니 비우기 (프론트: CartPage)
```

**구현 필요도**: ⭐⭐⭐⭐⭐ (매우 높음)  
**예상 소요 시간**: 2-3시간  
**프론트엔드 페이지**: CartPage (400줄), ProductDetailPage (370줄)

#### 5. 배송지 관리 API (1개)
```typescript
// 배송지 관리
GET    /api/shipping-addresses        // 배송지 목록 (프론트: AddressManagementPage, CheckoutPage)
POST   /api/shipping-addresses        // 배송지 추가
PUT    /api/shipping-addresses/:id    // 배송지 수정
DELETE /api/shipping-addresses/:id    // 배송지 삭제
```

**구현 필요도**: ⭐⭐⭐⭐⭐ (매우 높음)  
**예상 소요 시간**: 2-3시간  
**프론트엔드 페이지**: AddressManagementPage (413줄), CheckoutPage (1,136줄)

#### 6. 결제 관리 API (2개)
```typescript
// 결제 처리
POST   /api/payments/confirm          // 결제 승인 (프론트: CheckoutPage)
POST   /api/payments/rollback         // 결제 취소/환불
```

**구현 필요도**: ⭐⭐⭐⭐⭐ (매우 높음)  
**예상 소요 시간**: 3-4시간  
**프론트엔드 페이지**: CheckoutPage (1,136줄)

---

### 🟡 중간 우선순위 (기능 완성, 11개)

#### 7. 라이브 스트리밍 API (3개)
```typescript
// 라이브 스트림 관리
GET    /api/streams                   // 라이브 목록 (프론트: HomePage, LivePageV2)
GET    /api/streams/:id               // 라이브 상세
POST   /api/streams                   // 라이브 생성
PUT    /api/streams/:id               // 라이브 수정
DELETE /api/streams/:id               // 라이브 삭제

// 셀러 전용 라이브
GET    /api/seller/streams            // 셀러 라이브 목록 (프론트: SellerStreamNewPage)
POST   /api/seller/youtube/create-live // YouTube 라이브 생성 (프론트: SellerStreamNewPage)
```

**구현 필요도**: ⭐⭐⭐⭐ (높음)  
**예상 소요 시간**: 5-6시간  
**프론트엔드 페이지**: HomePage (571줄), LivePageV2 (1,846줄), SellerStreamNewPage (460줄)

#### 8. 관리자 대시보드 API (2개)
```typescript
// 관리자 통계
GET    /api/admin/dashboard/stats     // 전체 통계 (프론트: AdminPage)
GET    /api/admin/sellers             // 셀러 목록
GET    /api/admin/sellers/pending     // 승인 대기 셀러 (프론트: AdminPage)
PUT    /api/admin/sellers/:id/approve // 셀러 승인
PUT    /api/admin/sellers/:id/suspend // 셀러 정지
```

**구현 필요도**: ⭐⭐⭐⭐ (높음)  
**예상 소요 시간**: 3-4시간  
**프론트엔드 페이지**: AdminPage (684줄)

#### 9. 배너 관리 API (1개)
```typescript
// 배너 관리
GET    /api/banners                   // 배너 목록 (프론트: HomePage)
GET    /api/admin/banners             // 관리자 배너 관리 (프론트: AdminBannersPage)
POST   /api/admin/banners             // 배너 추가
PUT    /api/admin/banners/:id         // 배너 수정
DELETE /api/admin/banners/:id         // 배너 삭제
```

**구현 필요도**: ⭐⭐⭐ (중간)  
**예상 소요 시간**: 2-3시간  
**프론트엔드 페이지**: HomePage (571줄), AdminBannersPage (443줄)

#### 10. 세금계산서 관리 API (2개)
```typescript
// 셀러 세금계산서
GET    /api/seller/tax-invoices       // 세금계산서 목록 (프론트: SellerTaxInvoicesPage)
POST   /api/seller/tax-invoices       // 세금계산서 발행
GET    /api/seller/tax-invoices/auto-issue-logs // 자동 발행 로그
```

**구현 필요도**: ⭐⭐⭐ (중간)  
**예상 소요 시간**: 3-4시간  
**프론트엔드 페이지**: SellerTaxInvoicesPage (477줄)

#### 11. 알림톡 API (3개)
```typescript
// 셀러 알림톡
GET    /api/seller/alimtalk/balance   // 알림톡 잔액 (프론트: SellerAlimtalkDashboardPage)
GET    /api/seller/alimtalk/messages  // 발송 내역 (프론트: AlimtalkSendPage)
POST   /api/seller/alimtalk/send      // 알림톡 발송 (프론트: AlimtalkSendPage)
GET    /api/seller/alimtalk/templates // 템플릿 목록

// 관리자 알림톡
GET    /api/admin/alimtalk/statistics // 알림톡 통계 (프론트: AdminPage)
GET    /api/admin/alimtalk/accounts   // 알림톡 계정 관리 (프론트: AdminPage)
GET    /api/admin/alimtalk/pricing    // 요금제 관리 (프론트: AdminAlimtalkPricingPage)
PUT    /api/admin/alimtalk/pricing    // 요금제 수정
```

**구현 필요도**: ⭐⭐⭐ (중간)  
**예상 소요 시간**: 4-5시간  
**프론트엔드 페이지**: AlimtalkSendPage, AdminAlimtalkPricingPage

---

### 🟢 낮은 우선순위 (선택적 기능, 8개)

#### 12. 정산 관리 API (2개)
```typescript
// 정산 관리
GET    /api/admin/settlement          // 정산 내역 (프론트: AdminSettlementPage)
POST   /api/admin/settlement/batch-complete // 일괄 정산 완료
```

**구현 필요도**: ⭐⭐ (낮음)  
**예상 소요 시간**: 3-4시간  
**프론트엔드 페이지**: AdminSettlementPage (428줄)

#### 13. KV 모니터링 API (1개)
```typescript
// KV 스토리지 모니터링
GET    /api/debug/kv-usage            // KV 사용량 (프론트: KVMonitoringPage)
```

**구현 필요도**: ⭐ (매우 낮음, 개발 도구)  
**예상 소요 시간**: 1-2시간  
**프론트엔드 페이지**: KVMonitoringPage

#### 14. 찜 목록 API (2개)
```typescript
// 찜 목록
GET    /api/wishlist                  // 찜 목록 조회 (프론트: WishlistPage)
POST   /api/wishlist                  // 찜 추가
DELETE /api/wishlist/:id              // 찜 제거
```

**구현 필요도**: ⭐⭐ (낮음)  
**예상 소요 시간**: 2-3시간  
**프론트엔드 페이지**: WishlistPage (264줄)

#### 15. 검색 API (1개)
```typescript
// 상품 검색
GET    /api/products/search           // 검색 (프론트: SearchPage)
```

**구현 필요도**: ⭐⭐⭐ (중간)  
**예상 소요 시간**: 2-3시간  
**프론트엔드 페이지**: SearchPage (152줄)

#### 16. 사용자 프로필 API (2개)
```typescript
// 사용자 프로필
GET    /api/user/profile              // 프로필 조회 (프론트: UserProfilePage)
PUT    /api/user/profile              // 프로필 수정
```

**구현 필요도**: ⭐⭐ (낮음)  
**예상 소요 시간**: 1-2시간  
**프론트엔드 페이지**: UserProfilePage (165줄)

---

## 📊 백엔드 구현 우선순위 요약

### 즉시 구현 필요 (1-2주, 19-23시간)
1. ⭐⭐⭐⭐⭐ **셀러 관리** (6 endpoints, 4-5h)
2. ⭐⭐⭐⭐⭐ **셀러 주문** (2 endpoints, 2-3h)
3. ⭐⭐⭐⭐⭐ **셀러 상품** (1 endpoint, 1h)
4. ⭐⭐⭐⭐⭐ **장바구니** (5 endpoints, 2-3h)
5. ⭐⭐⭐⭐⭐ **배송지** (4 endpoints, 2-3h)
6. ⭐⭐⭐⭐⭐ **결제** (2 endpoints, 3-4h)

### 기능 완성용 (1개월, 17-22시간)
7. ⭐⭐⭐⭐ **라이브 스트리밍** (7 endpoints, 5-6h)
8. ⭐⭐⭐⭐ **관리자 대시보드** (5 endpoints, 3-4h)
9. ⭐⭐⭐ **배너 관리** (5 endpoints, 2-3h)
10. ⭐⭐⭐ **세금계산서** (3 endpoints, 3-4h)
11. ⭐⭐⭐ **알림톡** (8 endpoints, 4-5h)

### 선택적 기능 (2개월, 9-14시간)
12. ⭐⭐ **정산 관리** (2 endpoints, 3-4h)
13. ⭐⭐ **찜 목록** (3 endpoints, 2-3h)
14. ⭐⭐ **사용자 프로필** (2 endpoints, 1-2h)
15. ⭐⭐⭐ **검색** (1 endpoint, 2-3h)
16. ⭐ **KV 모니터링** (1 endpoint, 1-2h)

---

## 🎯 총 예상 작업량

| 우선순위 | 엔드포인트 수 | 예상 시간 | 비고 |
|---------|------------|----------|------|
| **높음 (즉시)** | 20개 | 19-23시간 | 서비스 오픈 필수 |
| **중간 (1개월)** | 28개 | 17-22시간 | 기능 완성 |
| **낮음 (선택)** | 9개 | 9-14시간 | 부가 기능 |
| **합계** | **57개** | **45-59시간** | 전체 백엔드 |

---

## 📁 관련 프론트엔드 페이지

### 백엔드 구현 대기 중인 주요 페이지
1. **CartPage.tsx** (400줄) - 장바구니 API 필요
2. **CheckoutPage.tsx** (1,136줄) - 결제/배송지 API 필요
3. **SellerPage.tsx** (717줄) - 셀러 통계 API 필요
4. **SellerOrdersPage.tsx** (773줄) - 셀러 주문 API 필요
5. **SellerProductsPage.tsx** (342줄) - 셀러 상품 API 필요
6. **LivePageV2.tsx** (1,846줄) - 라이브 스트리밍 API 필요
7. **AdminPage.tsx** (684줄) - 관리자 통계 API 필요
8. **AddressManagementPage.tsx** (413줄) - 배송지 API 필요

---

## ✅ 이미 구현된 백엔드

### 완료된 Feature
- ✅ **auth** (kakao.routes.ts, google.routes.ts, seller.routes.ts, admin.routes.ts)
- ✅ **products** (products.routes.ts)
- ✅ **orders** (orders.routes.ts)
- ✅ **account** (account.routes.ts)

### 파일 위치
```
src/features/
├── auth/api/
│   ├── kakao.routes.ts     ✅ 완료
│   ├── google.routes.ts    ✅ 완료
│   ├── seller.routes.ts    ✅ 완료 (NEW)
│   └── admin.routes.ts     ✅ 완료 (NEW)
├── products/api/
│   └── products.routes.ts  ✅ 완료
├── orders/api/
│   └── orders.routes.ts    ✅ 완료
└── account/api/
    └── account.routes.ts   ✅ 완료
```

---

## 🚀 다음 단계 권장사항

### Phase 1: 즉시 구현 (1-2주)
1. **셀러 기본 API** 구현 (셀러 프로필, 통계, 주문, 상품)
2. **장바구니 API** 구현
3. **배송지 관리 API** 구현
4. **결제 확인 API** 구현

**목표**: 셀러와 구매자의 핵심 기능 완성

### Phase 2: 기능 확장 (1개월)
1. **라이브 스트리밍 API** 구현
2. **관리자 대시보드 API** 구현
3. **배너/알림톡 API** 구현

**목표**: 전체 서비스 기능 완성

### Phase 3: 부가 기능 (선택)
1. **정산/세금계산서 API** 구현
2. **찜/검색 API** 구현
3. **모니터링 도구** 구현

**목표**: 사용자 편의성 향상

---

**작성일**: 2026-03-08  
**작성자**: UR-Live Development Team  
**이메일**: tobe2111@naver.com
