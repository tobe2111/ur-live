# 🎯 다음 구현 사항 (현재 상태 기반)

## ✅ 이미 구현된 기능들

### 1. ✅ 실시간 채팅
- **Firebase Realtime Database** 사용
- 실시간 메시지 송수신
- 투명 배경 + 그라디언트 마스크
- 최신 50개 메시지만 유지
- 구매 시 자동 채팅 메시지
- 슬라이드인 애니메이션

### 2. ✅ 결제 시스템
- **나이스페이먼츠** 실제 연동
- 주문서 작성 페이지 (`/checkout`)
- 주문 생성 API (`/api/orders/create`)
- 결제 승인 API (`/api/payments/nicepay/confirm`)
- 결제 성공/실패/리턴 페이지
- seller_id 추적 및 10% 수수료 자동 계산
- 주문 내역 조회

### 3. ✅ 셀러 대시보드 (기본)
- **이미 있음!** `/seller` 페이지
- 통계: 매출, 주문 수, 라이브 스트림, 시청자
- 라이브 스트림 목록
- 상품 목록 (Mock 데이터)
- **하지만**: 실제 기능 연동 필요

---

## 🔥 바로 구현해야 할 것들

### 1️⃣ **셀러 대시보드 실제 기능 연동** (Priority: HIGH)

현재 SellerPage.tsx에 Mock 데이터만 있습니다:

```typescript
// Mock data for demo
setStats({
  totalRevenue: 12450000,
  totalOrders: 342,
  activeStreams: 2,
  totalViewers: 1523
})
```

**필요 작업:**
- [ ] **실제 판매자 주문 조회 API** 연동
  ```typescript
  GET /api/seller/orders?seller_id=X&status=pending
  ```
- [ ] **실제 매출 통계 API** 연동 (이미 있음: `/api/seller/sales`)
- [ ] **상품 관리 기능**
  - [ ] 상품 등록 모달/페이지
  - [ ] 상품 수정/삭제
  - [ ] 재고 관리
- [ ] **라이브 스트림 관리**
  - [ ] 새 라이브 생성
  - [ ] 라이브 수정/삭제
  - [ ] YouTube Video ID 설정
- [ ] **주문 처리**
  - [ ] 주문 상태 변경 (준비중 → 배송중 → 배송완료)
  - [ ] 송장 번호 입력
  - [ ] 주문 상세 조회

---

### 2️⃣ **관리자 기능 완성** (Priority: MEDIUM)

현재 DB 스키마만 있고 UI/API 없음:

**필요 작업:**
- [ ] **관리자 대시보드 페이지** (`/admin`)
  - [ ] 전체 매출 통계
  - [ ] 전체 주문 관리
  - [ ] 사용자 관리
- [ ] **판매자 승인 시스템**
  - [ ] 판매자 신청 목록
  - [ ] 승인/거부 기능
- [ ] **전체 정산 관리**
  - [ ] 정산 승인/반려
  - [ ] 수수료 설정

---

### 3️⃣ **상품 관리 CRUD** (Priority: HIGH)

현재 상품은 DB에만 있고 판매자가 직접 추가할 수 없음:

**필요 작업:**
- [ ] **상품 등록 API**
  ```typescript
  POST /api/seller/products
  {
    name, description, price, original_price, 
    discount_rate, image_url, stock, category
  }
  ```
- [ ] **상품 수정 API**
  ```typescript
  PUT /api/seller/products/:id
  ```
- [ ] **상품 삭제 API**
  ```typescript
  DELETE /api/seller/products/:id
  ```
- [ ] **상품 목록 조회 API** (판매자별)
  ```typescript
  GET /api/seller/products?seller_id=X
  ```
- [ ] **프론트엔드 상품 관리 페이지**
  - [ ] 상품 목록 테이블
  - [ ] 상품 등록 모달
  - [ ] 상품 수정 모달
  - [ ] 이미지 업로드 (Cloudflare R2 or 외부 CDN)

---

### 4️⃣ **주문 관리 기능** (Priority: HIGH)

구매자는 주문할 수 있지만, 판매자가 주문을 관리할 수 없음:

**필요 작업:**
- [ ] **판매자 주문 조회 API**
  ```typescript
  GET /api/seller/orders?seller_id=X&status=pending
  ```
- [ ] **주문 상태 변경 API**
  ```typescript
  PUT /api/seller/orders/:id/status
  { status: 'preparing' | 'shipped' | 'delivered' }
  ```
- [ ] **송장 번호 입력 API**
  ```typescript
  PUT /api/seller/orders/:id/tracking
  { tracking_number: 'CJ1234567890' }
  ```
- [ ] **프론트엔드 주문 관리 페이지**
  - [ ] 주문 목록 (상태별 필터)
  - [ ] 주문 상세 조회
  - [ ] 송장 번호 입력 폼
  - [ ] 배송 상태 변경 버튼

---

## 🟡 그 다음 구현 사항 (Phase 2)

### 5️⃣ **라이브 스트림 관리**
- [ ] 새 라이브 생성 페이지
- [ ] 라이브 일정 설정
- [ ] YouTube 라이브 연동 가이드
- [ ] 라이브 종료 기능

### 6️⃣ **알림 시스템**
- [ ] 라이브 시작 알림 (이메일/푸시)
- [ ] 주문 상태 변경 알림
- [ ] 배송 시작 알림

### 7️⃣ **리뷰 시스템**
- [ ] 상품 리뷰 작성
- [ ] 리뷰 목록 조회
- [ ] 별점 시스템
- [ ] 리뷰 이미지 업로드

---

## 🟢 장기 로드맵 (Phase 3)

### 8️⃣ **소셜 기능**
- [ ] 팔로우/팔로워
- [ ] 좋아요
- [ ] 실제 SNS 공유 (카카오톡, 페이스북)

### 9️⃣ **쿠폰/할인**
- [ ] 쿠폰 생성 (판매자)
- [ ] 쿠폰 적용
- [ ] 특가 상품 설정

### 🔟 **통계 및 분석**
- [ ] 조회수 추적
- [ ] 구매 전환율
- [ ] 인기 상품 추천
- [ ] Google Analytics 연동

---

## 📊 우선순위 정리

### 🔥 **지금 바로 해야 할 것**
1. **셀러 대시보드 실제 연동** (Mock → Real Data)
2. **상품 관리 CRUD** (판매자가 상품을 추가/수정/삭제)
3. **주문 관리 기능** (판매자가 주문을 처리)

### 🟡 **다음 스프린트**
4. **관리자 기능** (판매자 승인, 전체 통계)
5. **라이브 스트림 관리** (판매자가 직접 라이브 생성)
6. **알림 시스템** (이메일/푸시)

### 🟢 **장기적으로**
7. 리뷰 시스템
8. 소셜 기능
9. 쿠폰/할인
10. 통계/분석

---

## 🎯 다음 스프린트 추천

### **Sprint 1: 셀러 대시보드 완성** (3-5일)

**목표:** 판매자가 자신의 상품과 주문을 관리할 수 있도록

**작업 항목:**
1. **Day 1-2: 상품 관리 CRUD**
   - POST /api/seller/products (상품 등록)
   - PUT /api/seller/products/:id (상품 수정)
   - DELETE /api/seller/products/:id (상품 삭제)
   - GET /api/seller/products (판매자 상품 목록)
   - 프론트엔드 상품 관리 페이지

2. **Day 3-4: 주문 관리**
   - GET /api/seller/orders (판매자 주문 조회)
   - PUT /api/seller/orders/:id/status (상태 변경)
   - PUT /api/seller/orders/:id/tracking (송장 입력)
   - 프론트엔드 주문 관리 페이지

3. **Day 5: 통계 연동**
   - SellerPage.tsx Mock 데이터 → Real API 연동
   - 실제 매출/주문 통계 표시
   - 테스트 및 버그 수정

---

## 💻 코드 예시

### 상품 등록 API (예시)

```typescript
// src/index.tsx
app.post('/api/seller/products', async (c) => {
  const { env } = c;
  const sessionToken = c.req.header('X-Session-Token');
  
  // 1. 세션 확인 (판매자 인증)
  const session = await env.DB.prepare(
    'SELECT seller_id FROM admin_sessions WHERE session_token = ?'
  ).bind(sessionToken).first();
  
  if (!session) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  
  // 2. 상품 정보 받기
  const { name, description, price, original_price, discount_rate, image_url, stock, category } = await c.req.json();
  
  // 3. 상품 등록
  const result = await env.DB.prepare(`
    INSERT INTO products (
      name, description, price, original_price, discount_rate, 
      image_url, stock, category, seller_id, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(
    name, description, price, original_price, discount_rate, 
    image_url, stock, category, session.seller_id
  ).run();
  
  return c.json({ 
    success: true, 
    productId: result.meta.last_row_id 
  });
});
```

---

**작성일:** 2026년 2월 4일  
**현재 상태:** MVP 완료 (채팅 + 결제 + 기본 대시보드)  
**다음 단계:** 셀러 기능 완성 (상품 관리 + 주문 처리)
