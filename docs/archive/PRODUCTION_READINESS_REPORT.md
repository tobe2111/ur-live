# 🎯 프로덕션 준비 상태 보고서
**작성일**: 2026-02-06  
**프로젝트**: 유어 라이브 커머스 (toss-live-commerce)  
**현재 완성도**: **75%**

---

## 📊 현재 구현 현황

### ✅ 완료된 기능 (75%)

#### 1. 인증 시스템 (100% 완료) ✅
- [x] **Kakao 로그인** (OAuth 2.0)
  - 인증 코드 교환
  - 사용자 정보 조회
  - 서비스 약관 동의 내역 저장
  - 24시간 세션 관리
- [x] **로그아웃**
- [x] **회원 탈퇴** (연결 해제)
- [x] **Webhook** (Kakao 계정 페이지 연결 해제)
- [x] **세션 검증 API**

**API 엔드포인트** (총 6개):
- `GET /auth/kakao/sync/callback` - OAuth 콜백
- `POST /api/auth/kakao/sync` - 토큰 검증
- `POST /api/auth/kakao/logout` - 로그아웃
- `POST /api/auth/kakao/unlink` - 회원 탈퇴
- `POST /webhooks/kakao/unlink` - Webhook
- `GET /api/auth/user/verify` - 세션 검증

**프론트엔드**:
- [x] 로그인 버튼 (live.html)
- [x] 로그아웃 버튼
- [x] 사용자 이름 표시

---

#### 2. 결제 시스템 (95% 완료) ✅
- [x] **NicePay 결제 통합**
  - 운영 환경 Client ID/Secret Key 설정
  - 결제창 호출 (AUTHNICE SDK)
  - 서버 승인 API
  - SHA-256 서명 검증
- [x] **주문 생성**
- [x] **결제 승인**
- [x] **주문 상태 업데이트**
- [x] **장바구니 비우기**
- [ ] 결제 취소/환불 (미구현) ⚠️

**API 엔드포인트** (총 2개):
- `POST /api/orders/create` - 주문 생성
- `POST /api/payments/nicepay/callback` - 결제 승인

**프론트엔드**:
- [x] 장바구니 페이지 (cart.html)
- [x] 결제 결과 페이지 (payment-result.html)
- [x] 주문 완료 페이지 (order-complete.html)
- [x] NicePay Client ID 환경 변수 주입

---

#### 3. 장바구니 시스템 (100% 완료) ✅
- [x] **장바구니 담기**
- [x] **수량 변경**
- [x] **아이템 삭제**
- [x] **장바구니 조회**

**API 엔드포인트** (총 4개):
- `POST /api/cart` - 장바구니 담기
- `GET /api/cart/:userId` - 조회
- `PUT /api/cart/:cartItemId` - 수량 변경
- `DELETE /api/cart/:cartItemId` - 삭제

**프론트엔드**:
- [x] 장바구니 UI (cart.html)
- [x] 수량 변경 버튼
- [x] 삭제 버튼
- [x] 총 금액 계산

---

#### 4. 주문 관리 (85% 완료) ✅
- [x] **주문 생성**
- [x] **주문 조회** (사용자별, 주문번호별)
- [x] **주문 내역 페이지**
- [x] **주문 상세 모달**
- [ ] 주문 취소/환불 요청 (미구현) ⚠️
- [ ] 배송 추적 (미구현) ⚠️

**API 엔드포인트** (총 3개):
- `POST /api/orders` - 주문 생성
- `GET /api/orders/user/:userId` - 사용자 주문 목록
- `GET /api/orders/:orderNo` - 주문 상세

**프론트엔드**:
- [x] 주문 내역 페이지 (my-orders.html)
- [x] 주문 목록 UI
- [x] 주문 상세 모달
- [ ] 주문 취소 버튼 (미구현)
- [ ] 배송 추적 UI (미구현)

---

#### 5. 라이브 스트리밍 (90% 완료) ✅
- [x] **YouTube 라이브 임베드**
- [x] **실시간 상품 표시**
- [x] **판매자/관리자 상품 변경**
- [x] **스트림 목록 조회**
- [x] **스트림 생성/수정/삭제**
- [ ] 채팅 기능 (미구현) ⚠️
- [ ] 실시간 시청자 수 (미구현) ⚠️

**API 엔드포인트** (총 11개):
- `GET /api/streams` - 스트림 목록
- `GET /api/streams/:id` - 스트림 상세
- `GET /api/streams/:streamId/products` - 스트림 상품 목록
- `GET /api/streams/:streamId/current-product` - 현재 상품
- `POST /api/seller/streams` - 스트림 생성 (판매자)
- `PUT /api/seller/streams/:id` - 스트림 수정 (판매자)
- `DELETE /api/seller/streams/:id` - 스트림 삭제 (판매자)
- `POST /api/seller/streams/:streamId/change-product` - 상품 변경 (판매자)
- `POST /api/admin/streams` - 스트림 생성 (관리자)
- `PUT /api/admin/streams/:id` - 스트림 수정 (관리자)
- `POST /api/admin/streams/:streamId/change-product` - 상품 변경 (관리자)

**프론트엔드**:
- [x] 라이브 페이지 (live.html)
- [x] YouTube 플레이어
- [x] 상품 카드
- [x] 장바구니 담기 버튼
- [ ] 채팅 UI (미구현)

---

#### 6. 상품 관리 (80% 완료) ✅
- [x] **상품 목록 조회**
- [x] **상품 상세 조회**
- [x] **재고 확인**
- [x] **판매자 상품 CRUD**
- [x] **상품 옵션 관리**
- [ ] 상품 상세 페이지 (프론트엔드 미구현) ⚠️
- [ ] 상품 검색 (미구현) ⚠️
- [ ] 상품 필터링 (미구현) ⚠️

**API 엔드포인트** (총 9개):
- `GET /api/products/:id` - 상품 상세
- `GET /api/products/:id/stock` - 재고 확인
- `GET /api/streams/:streamId/products` - 스트림별 상품 목록
- `GET /api/seller/products` - 판매자 상품 목록
- `POST /api/seller/products` - 상품 생성
- `PUT /api/seller/products/:id` - 상품 수정
- `DELETE /api/seller/products/:id` - 상품 삭제
- `GET /api/seller/products/:id/options` - 옵션 조회
- `POST /api/seller/products/:id/options` - 옵션 추가

**프론트엔드**:
- [x] 상품 카드 (live.html)
- [ ] 상품 상세 페이지 (미구현) ⚠️
- [ ] 상품 검색 (미구현)

---

#### 7. 판매자 기능 (70% 완료) ✅
- [x] **판매자 등록**
- [x] **사업자 정보 등록**
- [x] **판매자 통계**
- [x] **상품 관리**
- [x] **스트림 관리**
- [x] **세금계산서 자동 발행**
- [ ] 판매자 대시보드 UI (프론트엔드 미구현) ⚠️
- [ ] 매출 리포트 (미구현) ⚠️
- [ ] 정산 내역 (미구현) ⚠️

**API 엔드포인트** (총 15개+):
- `POST /api/seller/register` - 판매자 등록
- `GET /api/seller/stats` - 통계
- `POST /api/seller/business-info` - 사업자 정보 등록
- `GET /api/seller/business-info` - 사업자 정보 조회
- `GET /api/seller/products` - 상품 목록
- `POST /api/seller/products` - 상품 생성
- (상품 CRUD 외 다수)

**프론트엔드**:
- [x] 판매자 JavaScript (seller.js)
- [ ] 판매자 대시보드 HTML (미구현) ⚠️

---

#### 8. 관리자 기능 (60% 완료) ⚠️
- [x] **관리자 로그인**
- [x] **스트림 관리**
- [x] **판매자 승인**
- [x] **주문 조회**
- [ ] 관리자 대시보드 UI (프론트엔드 미구현) ⚠️
- [ ] 사용자 관리 (미구현) ⚠️
- [ ] 통계/리포트 (미구현) ⚠️

**API 엔드포인트** (총 10개+):
- `POST /api/admin/login` - 관리자 로그인
- `GET /api/admin/orders` - 주문 조회
- `GET /api/admin/sellers` - 판매자 목록
- `POST /api/admin/sellers` - 판매자 생성
- (스트림 관리 외 다수)

**프론트엔드**:
- [x] 관리자 JavaScript (admin.js)
- [ ] 관리자 대시보드 HTML (미구현) ⚠️

---

#### 9. 배송지 관리 (100% 완료) ✅
- [x] **배송지 조회**
- [x] **배송지 추가**
- [x] **배송지 수정**
- [x] **배송지 삭제**

**API 엔드포인트** (총 4개):
- `GET /api/shipping-addresses/:userId` - 조회
- `POST /api/shipping-addresses` - 추가
- `PUT /api/shipping-addresses/:id` - 수정
- `DELETE /api/shipping-addresses/:id` - 삭제

---

#### 10. 세금계산서 자동 발행 (90% 완료) ✅
- [x] **바로빌 연동**
- [x] **자동 발행**
- [x] **재시도 로직**
- [x] **발행 로그**
- [ ] 세금계산서 취소 (미구현) ⚠️

**API 엔드포인트** (총 3개):
- `POST /api/seller/tax-invoices/auto` - 자동 발행
- `POST /api/seller/tax-invoices/retry` - 재시도
- `GET /api/seller/tax-invoices` - 로그 조회

---

### 📦 데이터베이스 (Cloudflare D1)

#### 완료된 테이블 (19개)
1. `users` - 사용자 정보
2. `admin_sessions` - 세션 관리
3. `cart_items` - 장바구니
4. `orders` - 주문
5. `order_items` - 주문 아이템
6. `products` - 상품
7. `product_options` - 상품 옵션
8. `streams` - 라이브 스트림
9. `sellers` - 판매자
10. `seller_business_info` - 사업자 정보
11. `shipping_addresses` - 배송지
12. `tax_invoices` - 세금계산서
13. `tax_invoice_auto_issue_log` - 발행 로그
14. (기타 관리 테이블들)

#### 마이그레이션
- **총 19개 마이그레이션** 완료
- **최신**: `0019_add_service_terms_to_users.sql`

---

### 🌐 배포 및 인프라 (100% 완료) ✅

#### Cloudflare Pages 배포
- [x] **프로덕션 배포**: https://live.ur-team.com
- [x] **환경 변수 설정** (Secrets)
  - NICEPAY_CLIENT_ID
  - NICEPAY_SECRET_KEY
  - KAKAO_JS_KEY
  - KAKAO_REST_API_KEY
  - KAKAO_REDIRECT_URI
- [x] **Cloudflare D1 연동**
- [x] **Cloudflare KV 연동** (세션 스토리지)
- [x] **Worker 라우팅** 설정

#### Git 관리
- [x] Git 저장소 초기화
- [x] .gitignore 설정
- [x] 정기적인 커밋
- [x] 의미 있는 커밋 메시지

---

## 🚧 미구현 기능 (25%)

### 우선순위 P0 - 즉시 필요 (론칭 전 필수)

#### 1. 상품 상세 페이지 ⚠️
**현재 상태**: 백엔드 API 완료, 프론트엔드 미구현  
**예상 소요 시간**: 3-4시간

**필요 기능**:
- [ ] 상품 이미지 갤러리 (메인 이미지 + 썸네일)
- [ ] 상품 정보 (이름, 가격, 설명, 스펙)
- [ ] 옵션 선택 (사이즈, 색상 등)
- [ ] 수량 선택
- [ ] 장바구니 담기 버튼
- [ ] 바로 구매 버튼
- [ ] 재고 표시
- [ ] 관련 상품 추천 (선택)

**구현 방법**:
```html
<!-- public/static/product.html -->
<!DOCTYPE html>
<html>
<head>
    <title>상품 상세</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <!-- 상품 갤러리 -->
    <div id="product-gallery"></div>
    
    <!-- 상품 정보 -->
    <div id="product-info"></div>
    
    <!-- 옵션 선택 -->
    <div id="product-options"></div>
    
    <!-- 구매 버튼 -->
    <button id="add-to-cart">장바구니 담기</button>
    <button id="buy-now">바로 구매</button>
</body>
<script src="/static/product.js"></script>
</html>
```

**라우트 추가**:
```typescript
// src/index.tsx
app.get('/product/:id', async (c) => {
  const productId = c.req.param('id');
  // HTML 서빙
});
```

---

#### 2. 메인 페이지 개선 ⚠️
**현재 상태**: 기본 구조만 있음  
**예상 소요 시간**: 2-3시간

**필요 기능**:
- [ ] 진행 중인 라이브 목록 (카드 형식)
- [ ] 예정된 라이브 목록
- [ ] 인기 상품 섹션
- [ ] 카테고리 네비게이션
- [ ] 검색 바
- [ ] 배너/슬라이드

**구현 파일**: `public/index.html` (또는 `public/static/home.html`)

---

#### 3. 결제 취소/환불 ⚠️
**현재 상태**: 미구현  
**예상 소요 시간**: 2-3시간

**필요 API**:
```typescript
// NicePay 결제 취소 API
app.post('/api/payments/nicepay/cancel', async (c) => {
  const { tid, cancelAmt, cancelMsg } = await c.req.json();
  
  // NicePay 취소 API 호출
  const response = await fetch('https://api.nicepay.co.kr/v1/payments/cancel', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(clientId + ':' + secretKey)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tid, cancelAmt, cancelMsg })
  });
  
  // DB 업데이트: payment_status = 'cancelled'
  // 재고 복구
  
  return c.json({ success: true });
});
```

**프론트엔드**:
- 주문 상세 페이지에 "취소 요청" 버튼 추가
- 취소 사유 입력 모달

---

#### 4. 에러 처리 개선 ⚠️
**현재 상태**: 기본적인 try-catch만 있음  
**예상 소요 시간**: 2-3시간

**필요 작업**:
- [ ] 전역 에러 핸들러
```typescript
app.onError((err, c) => {
  console.error('[Global Error]', err);
  
  if (c.req.path.startsWith('/api/')) {
    return c.json({ 
      success: false, 
      error: err.message || 'Internal Server Error' 
    }, 500);
  }
  
  // HTML 에러 페이지
  return c.html('<h1>500 - 서버 오류</h1>', 500);
});
```

- [ ] 사용자 친화적 에러 메시지
```javascript
// 프론트엔드
try {
  const response = await axios.post('/api/cart', data);
} catch (error) {
  if (error.response?.status === 401) {
    alert('로그인이 필요합니다.');
    redirectToLogin();
  } else if (error.response?.status === 400) {
    alert(error.response.data.error || '잘못된 요청입니다.');
  } else {
    alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}
```

- [ ] 404 페이지
```html
<!-- public/404.html -->
<h1>404 - 페이지를 찾을 수 없습니다</h1>
<a href="/">홈으로 돌아가기</a>
```

- [ ] 로깅 시스템 (Cloudflare Workers Analytics)

---

#### 5. 재고 관리 개선 ⚠️
**현재 상태**: 기본 재고 확인만 가능  
**예상 소요 시간**: 1-2시간

**필요 기능**:
- [ ] 실시간 재고 표시
- [ ] 품절 처리 (구매 버튼 비활성화)
- [ ] 재고 부족 경고 (10개 이하 등)
- [ ] 재고 자동 차감 (주문 생성 시)
- [ ] 재고 복구 (주문 취소 시)

**구현 예시**:
```typescript
// 주문 생성 시 재고 차감
app.post('/api/orders', async (c) => {
  const { items } = await c.req.json();
  
  // 트랜잭션 시작
  for (const item of items) {
    // 재고 확인
    const product = await DB.prepare(
      'SELECT stock FROM products WHERE id = ?'
    ).bind(item.productId).first();
    
    if (product.stock < item.quantity) {
      return c.json({ 
        success: false, 
        error: `재고 부족: ${item.productName}` 
      }, 400);
    }
    
    // 재고 차감
    await DB.prepare(
      'UPDATE products SET stock = stock - ? WHERE id = ?'
    ).bind(item.quantity, item.productId).run();
  }
  
  // 주문 생성...
});
```

---

### 우선순위 P1 - 중요하지만 나중에 가능

#### 6. 검색 기능 ⚠️
**예상 소요 시간**: 2-3시간

**필요 API**:
```typescript
app.get('/api/products/search', async (c) => {
  const query = c.req.query('q');
  
  const products = await DB.prepare(`
    SELECT * FROM products 
    WHERE name LIKE ? OR description LIKE ?
    AND is_deleted = 0
    LIMIT 20
  `).bind(`%${query}%`, `%${query}%`).all();
  
  return c.json({ success: true, data: products.results });
});
```

**프론트엔드**:
```html
<input type="text" id="search-input" placeholder="상품 검색...">
<button onclick="searchProducts()">검색</button>
```

---

#### 7. 상품 리뷰 시스템 ⚠️
**예상 소요 시간**: 3-4시간

**필요 작업**:
- [ ] DB 테이블: `reviews` (product_id, user_id, rating, comment, images)
- [ ] API: 리뷰 작성, 조회, 수정, 삭제
- [ ] 프론트엔드: 리뷰 목록, 작성 폼, 별점

---

#### 8. 실시간 알림 시스템 ⚠️
**예상 소요 시간**: 3-4시간

**알림 종류**:
- 주문 상태 변경 (결제 완료, 배송 시작, 배송 완료)
- 라이브 방송 시작 (팔로우한 판매자)
- 좋아요한 상품 할인

**구현 방법**:
- Cloudflare Durable Objects (WebSocket)
- 또는 Server-Sent Events (SSE)
- 또는 Firebase Cloud Messaging (FCM)

---

#### 9. 라이브 채팅 ⚠️
**예상 소요 시간**: 4-5시간

**구현 방법**:
- Firebase Realtime Database (현재 프로젝트에 Firebase 설정 있음)
- 또는 Cloudflare Durable Objects

**기능**:
- 실시간 메시지 전송/수신
- 사용자 이름 표시
- 이모티콘
- 관리자 공지 (판매자/관리자만)

---

#### 10. 판매자 대시보드 UI ⚠️
**예상 소요 시간**: 1-2일

**필요 페이지**:
- [ ] `public/static/seller-dashboard.html`
- [ ] 실시간 매출 현황 (차트)
- [ ] 주문 관리 (목록, 상세, 상태 변경)
- [ ] 상품 관리 (CRUD)
- [ ] 라이브 스케줄 관리
- [ ] 정산 내역
- [ ] 통계/리포트

**참고**: 백엔드 API는 대부분 구현되어 있음

---

#### 11. 관리자 대시보드 UI ⚠️
**예상 소요 시간**: 2-3일

**필요 페이지**:
- [ ] `public/static/admin-dashboard.html`
- [ ] 사용자 관리
- [ ] 판매자 승인/관리
- [ ] 주문 관리
- [ ] 정산 관리
- [ ] 통계/리포트
- [ ] 시스템 설정

---

### 우선순위 P2 - 개선 사항 (선택)

#### 12. UI/UX 개선 ⚠️
- [ ] 로딩 상태 일관성 (스피너, 스켈레톤)
- [ ] 반응형 디자인 개선 (모바일 최적화)
- [ ] 접근성 개선 (ARIA 레이블, 키보드 네비게이션)
- [ ] 애니메이션/트랜지션
- [ ] 다크 모드 (선택)

---

#### 13. 성능 최적화 ⚠️
- [ ] 이미지 최적화 (Cloudflare Images 또는 R2)
- [ ] 코드 스플리팅 (Vite lazy loading)
- [ ] API 응답 캐싱 (Cloudflare KV)
- [ ] CDN 최적화
- [ ] 데이터베이스 쿼리 최적화 (인덱스)

---

#### 14. SEO 최적화 ⚠️
- [ ] 메타 태그 (title, description, og:image)
- [ ] sitemap.xml
- [ ] robots.txt
- [ ] 구조화된 데이터 (Schema.org)
- [ ] Open Graph 태그

---

#### 15. 분석 및 모니터링 ⚠️
- [ ] Google Analytics 통합
- [ ] Cloudflare Web Analytics
- [ ] 에러 추적 (Sentry 또는 Cloudflare Workers Analytics)
- [ ] 성능 모니터링

---

## 📋 프로덕션 런칭 체크리스트

### Phase 1: 핵심 기능 완성 (P0) - 2-3일

#### Day 1: 상품 페이지 & 에러 처리
- [ ] 상품 상세 페이지 구현 (3-4시간)
- [ ] 메인 페이지 개선 (2-3시간)
- [ ] 에러 처리 개선 (2-3시간)

#### Day 2: 결제 & 재고 관리
- [ ] 결제 취소/환불 구현 (2-3시간)
- [ ] 재고 관리 개선 (1-2시간)
- [ ] 전체 결제 플로우 테스트 (2시간)

#### Day 3: 테스트 & 버그 수정
- [ ] 전체 기능 통합 테스트
- [ ] 버그 수정
- [ ] 성능 테스트
- [ ] 보안 검토

---

### Phase 2: 중요 기능 추가 (P1) - 1주일

- [ ] 검색 기능 (2-3시간)
- [ ] 상품 리뷰 (3-4시간)
- [ ] 실시간 알림 (3-4시간)
- [ ] 라이브 채팅 (4-5시간)
- [ ] 판매자 대시보드 UI (1-2일)
- [ ] 관리자 대시보드 UI (2-3일)

---

### Phase 3: 최적화 & 개선 (P2) - 지속적

- [ ] UI/UX 개선
- [ ] 성능 최적화
- [ ] SEO 최적화
- [ ] 분석/모니터링 설정

---

## 📊 현재 구현 통계

### 백엔드 API
- **총 77개 엔드포인트** 구현 완료
- **주요 영역**:
  - 인증: 6개
  - 결제: 2개
  - 장바구니: 4개
  - 주문: 3개
  - 상품: 9개
  - 라이브 스트림: 11개
  - 판매자: 15개+
  - 관리자: 10개+
  - 기타: 17개+

### 프론트엔드 페이지
- **구현 완료**: 7개
  - live.html (라이브 스트리밍)
  - cart.html (장바구니)
  - payment-result.html (결제 결과)
  - order-complete.html (주문 완료)
  - my-orders.html (주문 내역)
  - privacy.html (개인정보처리방침)
  - terms.html (이용약관)

- **미구현**: 5개 (추정)
  - index.html 또는 home.html (메인 페이지)
  - product.html (상품 상세)
  - seller-dashboard.html (판매자 대시보드)
  - admin-dashboard.html (관리자 대시보드)
  - 404.html (에러 페이지)

### JavaScript 파일
- **구현 완료**: 6개
  - app.js (공통 유틸리티)
  - live.js (라이브 페이지)
  - cart.js (장바구니)
  - my-orders.js (주문 내역)
  - seller.js (판매자)
  - admin.js (관리자)

- **미구현**: 2개 (추정)
  - product.js (상품 상세)
  - home.js (메인 페이지)

---

## 🎯 추천 구현 순서

### **즉시 시작 (오늘~내일)**
1. **상품 상세 페이지** (3-4시간) - 가장 중요
2. **메인 페이지 개선** (2-3시간) - 첫인상 중요
3. **에러 처리 개선** (2-3시간) - 사용자 경험

**예상 총 소요 시간**: 7-10시간 (1-2일)

---

### **단기 (3-7일 내)**
4. **결제 취소/환불** (2-3시간)
5. **재고 관리 개선** (1-2시간)
6. **검색 기능** (2-3시간)
7. **전체 테스트 및 버그 수정** (1일)

**예상 총 소요 시간**: 2-3일

---

### **중기 (1-2주 내)**
8. **상품 리뷰** (3-4시간)
9. **실시간 알림** (3-4시간)
10. **라이브 채팅** (4-5시간)
11. **판매자 대시보드 UI** (1-2일)
12. **관리자 대시보드 UI** (2-3일)

**예상 총 소요 시간**: 5-7일

---

### **장기 (지속적)**
13. **UI/UX 개선**
14. **성능 최적화**
15. **SEO 최적화**
16. **분석/모니터링**

---

## 🚀 최소 기능 프로덕트 (MVP) 기준

**지금 바로 런칭 가능한 최소 기능**:
- ✅ Kakao 로그인
- ✅ 라이브 스트리밍 시청
- ✅ 장바구니
- ✅ NicePay 결제
- ✅ 주문 내역
- ⚠️ **상품 상세 페이지 (필수 추가)**
- ⚠️ **메인 페이지 개선 (권장)**
- ⚠️ **에러 처리 (필수 추가)**

**결론**: **상품 상세 페이지**와 **에러 처리**만 추가하면 **바로 런칭 가능**합니다!

---

## 💡 다음 단계

제안드리는 작업 순서:
1. **A. 상품 상세 페이지 구현** (3-4시간)
2. **B. 메인 페이지 개선** (2-3시간)
3. **C. 에러 처리 개선** (2-3시간)
4. **D. 전체 테스트** (2-3시간)

**총 예상 시간**: **10-13시간** (약 2일)

**2일 후 런칭 가능!** 🎉

---

**어떤 작업부터 시작하시겠습니까?**
- A. 상품 상세 페이지
- B. 메인 페이지 개선
- C. 에러 처리 개선
- D. 결제 취소/환불
- E. 기타 (말씀해주세요!)
