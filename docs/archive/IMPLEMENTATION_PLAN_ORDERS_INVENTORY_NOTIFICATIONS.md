# 주문 관리 고도화 + 재고 관리 + 알림 시스템 구현 계획

## ✅ 완료된 작업 (2026-02-19)

### 1. 셀러 회원가입 플로우 문서화
- 파일: `SELLER_SIGNUP_FLOW.md`
- 현재 플로우 분석 완료
- 개선사항 문서화 (보안, 승인 프로세스, Rate Limiting)

### 2. 주문 관리 페이지 개선
- 파일: `src/pages/SellerOrdersPage.tsx`
- ✅ 상태별 필터 (전체, 결제완료, 상품준비중, 배송중, 배송완료, 취소)
- ✅ 검색 기능 (주문번호, 주문자명, 전화번호)
- ✅ 날짜 범위 필터 (시작일~종료일)
- ✅ 페이징 (20건씩 표시)
- ✅ CSV 다운로드 기능
- ✅ 필터 초기화 버튼
- ✅ 현재 페이지 표시 및 이동

### 3. Migration 추가
- 파일: `migrations/0046_add_notifications.sql`
- ✅ notifications 테이블 생성
- ✅ inventory_logs 테이블 생성 (재고 변동 로그)
- ✅ products 테이블에 stock_alert_threshold 컬럼 추가
- ✅ 인덱스 생성

---

## 🔄 구현 중인 작업

### 4. 재고 관리 정교화
**목표**: Race Condition 방지, 실시간 재고 차감, 재고 부족 알림

#### 현재 상태 분석:
```typescript
// src/index.tsx 라인 2891-2926
// ✅ 이미 낙관적 락(Optimistic Locking) 구현됨
// ✅ version 컬럼 사용하여 동시성 처리
// ✅ 재시도 로직 포함

// 문제점:
// 1. 재고 부족 알림 없음
// 2. 재고 변동 로그 없음
// 3. seller_id 연결 필요
```

#### 추가 필요 기능:
1. **재고 변동 로그 기록**
   ```typescript
   async function logInventoryChange(
     DB, 
     productId, 
     sellerId, 
     changeAmount, 
     stockBefore, 
     stockAfter, 
     reason, 
     orderNumber?
   )
   ```

2. **재고 부족 알림 발송**
   ```typescript
   async function sendLowStockAlert(DB, productId, sellerId, currentStock)
   ```

3. **주문 생성 시 알림 발송**
   ```typescript
   async function notifySellerNewOrder(DB, sellerId, orderNumber, totalAmount)
   ```

---

### 5. 알림 시스템 구현
**목표**: 신규 주문 알림, 배송 상태 변경 알림, 재고 부족 알림

#### 백엔드 API:
```typescript
// 알림 생성
POST /api/notifications
{
  user_type: 'seller' | 'user' | 'admin',
  user_id: number,
  type: 'new_order' | 'stock_low' | 'order_status' | 'delivery',
  title: string,
  message: string,
  link?: string
}

// 알림 조회 (셀러용)
GET /api/seller/notifications
GET /api/seller/notifications/unread-count

// 알림 읽음 처리
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all

// 알림 삭제
DELETE /api/notifications/:id
```

#### 프론트엔드 컴포넌트:
```typescript
// 알림 벨 아이콘 (상단 네비게이션)
<NotificationBell 
  unreadCount={5}
  notifications={notifications}
  onRead={handleRead}
/>

// 알림 목록 페이지
/seller/notifications
```

---

## 📋 구현 단계

### Phase 1: 백엔드 알림 시스템 (30분)
1. ✅ Migration 0046 실행
2. ⏳ 알림 헬퍼 함수 추가 (src/index.tsx)
   - createNotification()
   - getNotifications()
   - markAsRead()
   - deleteNotification()

3. ⏳ 알림 API 엔드포인트 추가
   - POST /api/notifications
   - GET /api/seller/notifications
   - GET /api/seller/notifications/unread-count
   - PATCH /api/notifications/:id/read
   - PATCH /api/notifications/read-all
   - DELETE /api/notifications/:id

### Phase 2: 재고 로직 개선 (20분)
4. ⏳ 재고 변동 로그 함수 추가
   - logInventoryChange()

5. ⏳ 주문 생성 시 통합
   - 재고 차감 후 로그 기록
   - 재고 부족 시 알림 발송
   - 셀러에게 신규 주문 알림

6. ⏳ 상태 변경 시 알림
   - 배송중 → 사용자 알림
   - 배송완료 → 사용자 알림

### Phase 3: 프론트엔드 알림 UI (30분)
7. ⏳ NotificationBell 컴포넌트 생성
   - src/components/NotificationBell.tsx

8. ⏳ SellerPage에 알림 벨 추가

9. ⏳ 알림 목록 페이지 생성
   - src/pages/SellerNotificationsPage.tsx

### Phase 4: 테스트 & 배포 (20분)
10. ⏳ Migration 실행
11. ⏳ 빌드
12. ⏳ 배포
13. ⏳ 테스트

---

## 🚀 예상 소요 시간
- **Phase 1**: 30분
- **Phase 2**: 20분
- **Phase 3**: 30분
- **Phase 4**: 20분
- **총**: 약 1시간 40분

---

## 📊 예상 결과

### 셀러 경험 개선:
1. 주문 104건 → 필터링으로 10-20건씩 확인 가능
2. CSV 다운로드로 엑셀 관리 가능
3. 신규 주문 시 즉시 알림 수신
4. 재고 부족 시 알림으로 빠른 대응

### 시스템 안정성:
1. Race Condition 해결 (이미 구현됨)
2. 재고 변동 추적 가능
3. 알림 히스토리 확인 가능

### 비즈니스 효율:
1. 주문 처리 속도 향상
2. 재고 관리 정확도 향상
3. 고객 만족도 향상

---

**작성일**: 2026-02-19
**상태**: Phase 1 진행 중
