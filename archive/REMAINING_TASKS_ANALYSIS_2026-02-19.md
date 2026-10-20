# 🔍 UR-Live 서비스 남은 작업 분석 (2026-02-19)

## 📊 현재 완성도

### 전체 통계
- **페이지**: 44개
- **API 엔드포인트**: 123개
- **마이그레이션**: 46개 (0046은 미적용)
- **전체 완성도**: 약 75%

### 영역별 완성도
- **코어 기능** (회원, 상품, 주문, 결제): 90% ✅
- **셀러 기능**: 85% ✅
- **관리자 기능**: 70% ⚠️
- **사용자 편의 기능**: 40% ⚠️
- **고급 기능**: 10% ❌

---

## 🔥 긴급 구현 필요 (1-2주 내)

### 1. ⚠️ **재고 관리 시스템 강화**
**현재 상태**: 낙관적 락 구현됨, 하지만 불완전
**문제점**:
- 재고 부족 알림 없음
- 재고 변동 이력 추적 없음
- 결제 실패 시 재고 복구 로직 미흡

**필요 작업**:
```typescript
// 1. 재고 변동 로그
migrations/0046_add_notifications.sql 적용
logInventoryChange() 함수 구현

// 2. 재고 부족 알림
if (stock < threshold) {
  notifySellerLowStock(sellerId, productId, stock)
}

// 3. 결제 실패 시 재고 롤백
catch (paymentError) {
  rollbackInventory(orderId)
}
```

**예상 시간**: 4-6시간  
**우선순위**: 🔴 높음

---

### 2. ⚠️ **기본 알림 시스템**
**현재 상태**: 테이블만 준비됨 (0046 migration)
**문제점**:
- 셀러가 신규 주문을 즉시 알 수 없음
- 사용자가 배송 상태 변경을 알 수 없음
- 재고 부족 시 알림 없음

**필요 작업**:
```typescript
// 1. 백엔드 알림 API
POST   /api/notifications
GET    /api/seller/notifications
GET    /api/seller/notifications/unread-count
PATCH  /api/notifications/:id/read
DELETE /api/notifications/:id

// 2. 프론트엔드 컴포넌트
components/NotificationBell.tsx
pages/SellerNotificationsPage.tsx

// 3. 알림 발송 로직
- 주문 생성 시 → 셀러 알림
- 상태 변경 시 → 사용자 알림
- 재고 부족 시 → 셀러 알림
```

**예상 시간**: 6-8시간  
**우선순위**: 🔴 높음

---

### 3. ⚠️ **관리자 셀러 승인 시스템**
**현재 상태**: 셀러 가입은 되지만 승인 UI 없음
**문제점**:
- 관리자가 pending 셀러를 볼 수 없음
- 승인/거부 버튼 없음
- 승인 후 알림 없음

**필요 작업**:
```typescript
// 1. 관리자 페이지 개선
AdminPage.tsx에 "셀러 승인 대기" 섹션 추가

// 2. 승인 API
PATCH /api/admin/sellers/:id/approve
PATCH /api/admin/sellers/:id/reject

// 3. 알림 발송
승인 시 → 셀러 이메일/시스템 알림
거부 시 → 거부 사유 포함 알림
```

**예상 시간**: 3-4시간  
**우선순위**: 🔴 높음

---

## 🟡 중요 구현 필요 (1개월 내)

### 4. 📦 **리뷰 시스템**
**현재 상태**: 완전히 없음
**문제점**:
- 상품 구매 후 리뷰 작성 불가
- 상품 상세 페이지에 리뷰 없음
- 셀러 평점 시스템 없음

**필요 작업**:
```sql
-- Migration 필요
CREATE TABLE product_reviews (
  id INTEGER PRIMARY KEY,
  product_id INTEGER,
  user_id INTEGER,
  order_id INTEGER,
  rating INTEGER, -- 1-5
  content TEXT,
  images TEXT, -- JSON array
  created_at DATETIME
);
```

**예상 시간**: 8-10시간  
**우선순위**: 🟡 중간

---

### 5. 🎫 **쿠폰 시스템**
**현재 상태**: 완전히 없음
**필요 작업**:
```sql
CREATE TABLE coupons (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,
  discount_type TEXT, -- 'percentage' | 'fixed'
  discount_value INTEGER,
  min_order_amount INTEGER,
  max_discount INTEGER,
  valid_from DATETIME,
  valid_until DATETIME,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0
);

CREATE TABLE user_coupons (
  user_id INTEGER,
  coupon_id INTEGER,
  is_used BOOLEAN DEFAULT 0,
  used_at DATETIME
);
```

**예상 시간**: 10-12시간  
**우선순위**: 🟡 중간

---

### 6. 💰 **포인트/적립금 시스템**
**현재 상태**: 완전히 없음
**필요 작업**:
```sql
CREATE TABLE user_points (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  amount INTEGER,
  type TEXT, -- 'earn' | 'use' | 'expire'
  reason TEXT,
  order_id INTEGER,
  created_at DATETIME
);

ALTER TABLE users ADD COLUMN total_points INTEGER DEFAULT 0;
```

**예상 시간**: 8-10시간  
**우선순위**: 🟡 중간

---

### 7. ❤️ **찜하기/위시리스트**
**현재 상태**: 완전히 없음
**필요 작업**:
```sql
CREATE TABLE wishlists (
  user_id INTEGER,
  product_id INTEGER,
  created_at DATETIME,
  PRIMARY KEY (user_id, product_id)
);
```

**예상 시간**: 4-6시간  
**우선순위**: 🟡 중간

---

### 8. 📊 **셀러 통계 대시보드 강화**
**현재 상태**: 기본 통계만 있음
**필요 작업**:
- 일별/주별/월별 매출 차트
- 상품별 판매량 분석
- 시간대별 방문자 분석
- 전환율 추적

**예상 시간**: 10-12시간  
**우선순위**: 🟡 중간

---

## 🔵 선택적 고급 기능 (2개월 이상)

### 9. 📹 **실제 WebRTC 스트리밍**
**현재 상태**: YouTube/TikTok URL만 지원
**문제점**:
- 자체 라이브 스트리밍 불가
- 외부 플랫폼 의존

**필요 작업**:
- WebRTC 서버 구축 (Cloudflare Calls 또는 별도 서버)
- OBS 연동
- RTMP 인제스트

**예상 시간**: 40-60시간  
**우선순위**: 🔵 낮음

---

### 10. 🎬 **다시보기 기능**
**현재 상태**: 없음
**필요 작업**:
- 라이브 녹화
- VOD 저장 (R2)
- 재생 플레이어

**예상 시간**: 20-30시간  
**우선순위**: 🔵 낮음

---

### 11. 🤖 **AI 추천 시스템**
**현재 상태**: 없음
**필요 작업**:
- 협업 필터링 알고리즘
- 사용자 행동 분석
- 개인화 추천

**예상 시간**: 60-80시간  
**우선순위**: 🔵 낮음

---

### 12. 💬 **챗봇 고객센터**
**현재 상태**: FAQ 페이지만 있음
**필요 작업**:
- AI 챗봇 통합
- 자동 응답 시스템
- 상담원 연결

**예상 시간**: 30-40시간  
**우선순위**: 🔵 낮음

---

## 🐛 알려진 버그/이슈

### 해결 필요:
1. ⚠️ **세션 만료 처리 미흡**
   - 세션 만료 시 자동 로그아웃 안 됨
   - 401 응답 시 리다이렉트 필요

2. ⚠️ **동시 주문 시 재고 처리**
   - 낙관적 락 구현했지만 추가 테스트 필요
   - 재시도 로직 개선 필요

3. ⚠️ **결제 실패 시 재고 복구**
   - 결제 실패 시 차감된 재고 복구 로직 확인 필요

4. ⚠️ **이미지 업로드 제한**
   - 대용량 이미지 업로드 시 에러
   - 이미지 압축 필요

5. ⚠️ **모바일 UI 개선**
   - 일부 페이지 모바일 최적화 부족
   - 반응형 디자인 개선 필요

---

## 📋 우선순위 로드맵

### 🔴 **Phase 1: 긴급 (1-2주)**
1. 재고 관리 강화 (4-6시간)
2. 알림 시스템 (6-8시간)
3. 관리자 승인 시스템 (3-4시간)
**총 예상 시간**: 13-18시간

### 🟡 **Phase 2: 중요 (1개월)**
4. 리뷰 시스템 (8-10시간)
5. 쿠폰 시스템 (10-12시간)
6. 포인트 시스템 (8-10시간)
7. 찜하기 (4-6시간)
8. 통계 대시보드 (10-12시간)
**총 예상 시간**: 40-50시간

### 🔵 **Phase 3: 고급 (2개월+)**
9. WebRTC 스트리밍 (40-60시간)
10. 다시보기 (20-30시간)
11. AI 추천 (60-80시간)
12. 챗봇 (30-40시간)
**총 예상 시간**: 150-210시간

---

## 🎯 권장 진행 순서

### 즉시 시작 (다음 작업):
```
1. Migration 0046 적용 (10분)
2. 알림 시스템 백엔드 (3시간)
3. 재고 관리 강화 (3시간)
4. 관리자 승인 UI (2시간)
```

### 1주차:
- 알림 시스템 프론트엔드
- 재고 부족 알림 연동
- 신규 주문 알림 연동

### 2주차:
- 관리자 승인 완성
- 세션 만료 처리
- 버그 수정

### 3-4주차:
- 리뷰 시스템
- 찜하기 기능

---

## 💡 결론

### ✅ 잘 되고 있는 것:
- 기본 커머스 기능 (주문, 결제, 상품)
- 라이브 기본 기능
- 셀러 관리 도구

### ⚠️ 개선 필요:
- 알림 시스템 (셀러/사용자 소통 부족)
- 재고 관리 (로그, 알림)
- 관리자 도구 (승인 시스템)

### 🎯 핵심 권장사항:
**먼저 Phase 1 (재고+알림+승인)을 완료하고, Phase 2로 넘어가세요.**
Phase 3은 비즈니스가 성장한 후에 고려하는 것이 효율적입니다.

---

**작성일**: 2026-02-19  
**분석 기준**: 현재 코드베이스 + 비즈니스 우선순위  
**다음 권장 작업**: Migration 0046 적용 + 알림 시스템 백엔드
