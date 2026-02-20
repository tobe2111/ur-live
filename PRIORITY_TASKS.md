# 🔥 UR-Live 현재 구현 필요 항목 (중요도순)

마지막 업데이트: 2026-02-19 (알림 시스템, 재고 관리 완료 후)

---

## ✅ 최근 완료된 작업
- ✅ **알림 시스템** - 신규 주문, 배송 상태, 재고 부족 알림 완료
- ✅ **재고 관리 강화** - 낙관적 락, 재고 부족 알림, 재고 로그
- ✅ **YouTube Live API** - 자동 생성/종료/통계/채팅 API (OAuth 설정 대기 중)

---

## 🔴 긴급 구현 필요 (1주 내)

### 1️⃣ **R2 이미지 업로드 활성화** ⭐⭐⭐
**현재 상태:**
- ✅ 프론트엔드 압축 기능 완료 (browser-image-compression)
- ✅ ImageUpload 컴포넌트 완료
- ❌ Cloudflare R2 버킷 미생성
- ❌ 업로드 API 미구현

**왜 중요한가:**
- 셀러가 상품 이미지를 직접 업로드할 수 없음
- 현재는 URL만 입력 가능 (불편함)
- 이미지 품질 관리 불가

**필요한 작업:**
```bash
# 1. Cloudflare Dashboard에서 R2 활성화
# 2. 버킷 생성
npx wrangler r2 bucket create ur-live-images

# 3. wrangler.jsonc 설정 추가
"r2_buckets": [{
  "binding": "IMAGES",
  "bucket_name": "ur-live-images"
}]

# 4. API 구현
POST /api/seller/upload-image  # R2 업로드
GET /api/images/:key           # R2에서 가져오기
```

**예상 시간**: 2-3시간  
**예상 비용**: 무료 (10GB까지)

---

### 2️⃣ **알림 벨 UI 컴포넌트** ⭐⭐
**현재 상태:**
- ✅ 백엔드 API 5개 완료
- ✅ 알림 자동 생성 완료
- ❌ 프론트엔드 UI 없음

**왜 중요한가:**
- 알림은 생성되지만 사용자가 볼 수 없음
- 셀러가 신규 주문을 놓칠 수 있음

**필요한 작업:**
```tsx
// components/NotificationBell.tsx
- 헤더 우측에 벨 아이콘
- 읽지 않은 알림 배지 (빨간 점)
- 드롭다운으로 최근 5개 알림 표시
- 5초마다 자동 갱신 (polling)

// 알림 클릭 시 이동
- 신규 주문 → /seller/orders
- 배송 상태 → /user/orders
- 재고 부족 → /seller/products
```

**예상 시간**: 3-4시간

---

### 3️⃣ **관리자 셀러 승인 UI 개선** ⭐⭐
**현재 상태:**
- ✅ 백엔드 API 완료 (approve/reject)
- ⚠️ AdminPage에 승인 버튼만 있음
- ❌ Pending 셀러 필터 없음
- ❌ 거부 사유 입력 모달 없음

**왜 중요한가:**
- 관리자가 승인 대기 중인 셀러를 찾기 어려움
- 거부 시 사유를 남길 수 없음

**필요한 작업:**
```tsx
// AdminPage.tsx 개선
- "승인 대기" 탭 추가
- 승인 대기 중인 셀러만 필터링
- 거부 모달: 사유 입력 텍스트박스
- 승인/거부 후 알림 발송
```

**예상 시간**: 2-3시간

---

## 🟡 중요 구현 (2-4주)

### 4️⃣ **주문 관리 고도화** ⭐⭐⭐
**현재 문제:**
- 104건 주문이 필터 없이 전체 표시
- 검색 불가
- 페이징 없음

**필요한 기능:**
```tsx
// SellerOrdersPage 개선
- 상태별 필터 (결제완료/배송준비/배송중/배송완료/취소)
- 날짜 범위 필터 (오늘/일주일/한달/직접입력)
- 검색 (주문번호, 구매자명)
- 페이징 (20건씩)
- CSV 다운로드
- 일괄 상태 변경 (체크박스)
```

**예상 시간**: 6-8시간

---

### 5️⃣ **리뷰 시스템** ⭐⭐
**왜 중요한가:**
- 상품 구매 결정에 리뷰가 중요함
- 셀러 평판 관리
- 상품 품질 피드백

**필요한 작업:**
```sql
-- Migration
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

CREATE TABLE review_replies (
  id INTEGER PRIMARY KEY,
  review_id INTEGER,
  seller_id INTEGER,
  content TEXT,
  created_at DATETIME
);
```

```tsx
// UI 컴포넌트
- ProductDetailPage: 리뷰 목록 표시
- UserOrdersPage: "리뷰 작성" 버튼
- ReviewWritePage: 별점, 사진, 텍스트
- SellerProductsPage: 리뷰에 답글
```

**예상 시간**: 10-12시간

---

### 6️⃣ **쿠폰 시스템** ⭐⭐
**왜 중요한가:**
- 마케팅 도구
- 고객 유치/재방문 유도
- 프로모션 관리

**필요한 작업:**
```sql
CREATE TABLE coupons (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,
  discount_type TEXT, -- 'percentage' | 'fixed'
  discount_value INTEGER,
  min_order_amount INTEGER,
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

```tsx
// UI 컴포넌트
- AdminCouponPage: 쿠폰 생성/관리
- UserCouponsPage: 보유 쿠폰 목록
- CartPage: 쿠폰 적용
- CheckoutPage: 할인 금액 표시
```

**예상 시간**: 10-12시간

---

### 7️⃣ **포인트/적립금 시스템** ⭐
**왜 중요한가:**
- 고객 충성도 향상
- 재구매 유도
- 프로모션 도구

**필요한 작업:**
```sql
CREATE TABLE user_points (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  amount INTEGER,
  type TEXT, -- 'earn' | 'use' | 'expire'
  reason TEXT,
  order_id INTEGER,
  expires_at DATETIME,
  created_at DATETIME
);

ALTER TABLE users ADD COLUMN total_points INTEGER DEFAULT 0;
```

```tsx
// 적립 로직
- 주문 완료 시 1% 적립
- 리뷰 작성 시 보너스 포인트
- 포인트 사용 (결제 시 차감)
- 1년 후 자동 만료
```

**예상 시간**: 8-10시간

---

### 8️⃣ **찜하기/위시리스트** ⭐
**왜 중요한가:**
- 사용자 편의성
- 재방문 유도
- 구매 전환율 향상

**필요한 작업:**
```sql
CREATE TABLE wishlists (
  user_id INTEGER,
  product_id INTEGER,
  created_at DATETIME,
  PRIMARY KEY (user_id, product_id)
);
```

```tsx
// UI 컴포넌트
- ProductCard: 하트 아이콘
- ProductDetailPage: 찜하기 버튼
- UserWishlistPage: 찜한 상품 목록
- 알림: 찜한 상품 가격 변동
```

**예상 시간**: 4-6시간

---

### 9️⃣ **셀러 통계 대시보드 강화** ⭐
**현재 상태:**
- ✅ 기본 통계 (총 매출, 상품 수 등)
- ❌ 차트 없음
- ❌ 상품별 분석 없음

**필요한 기능:**
```tsx
// SellerDashboardPage 강화
- 일별/주별/월별 매출 차트 (Chart.js)
- 상품별 판매량 순위
- 시간대별 주문 분석
- 전환율 추적
- Top 10 상품
```

**예상 시간**: 10-12시간

---

## 🔵 선택적 고급 기능 (2개월+)

### 🔟 **WebRTC 자체 스트리밍**
**현재:** YouTube/TikTok URL만 지원  
**목표:** 자체 스트리밍 서버

**필요 기술:**
- Cloudflare Calls (WebRTC)
- RTMP 인제스트
- OBS 연동

**예상 시간**: 40-60시간  
**예상 비용**: $100-500/월

---

### 1️⃣1️⃣ **VOD 다시보기**
**필요 기능:**
- 라이브 자동 녹화
- R2에 저장
- 타임스탬프 북마크

**예상 시간**: 20-30시간  
**예상 비용**: Cloudflare Stream $5/월 + $1/1000분

---

### 1️⃣2️⃣ **AI 추천 시스템**
**필요 기능:**
- 협업 필터링
- 사용자 행동 분석
- 개인화 추천

**예상 시간**: 60-80시간  
**예상 비용**: ~₩50,000/월

---

## 📊 우선순위 요약표

| 순위 | 기능 | 중요도 | 예상 시간 | 비용 | 상태 |
|------|------|--------|-----------|------|------|
| 1 | R2 이미지 업로드 | 🔴 긴급 | 2-3h | 무료 | ❌ |
| 2 | 알림 벨 UI | 🔴 긴급 | 3-4h | 무료 | ❌ |
| 3 | 관리자 승인 UI | 🔴 긴급 | 2-3h | 무료 | ⚠️ |
| 4 | 주문 관리 고도화 | 🟡 중요 | 6-8h | 무료 | ❌ |
| 5 | 리뷰 시스템 | 🟡 중요 | 10-12h | 무료 | ❌ |
| 6 | 쿠폰 시스템 | 🟡 중요 | 10-12h | 무료 | ❌ |
| 7 | 포인트 시스템 | 🟡 중요 | 8-10h | 무료 | ❌ |
| 8 | 찜하기 | 🟡 중요 | 4-6h | 무료 | ❌ |
| 9 | 통계 대시보드 | 🟡 중요 | 10-12h | 무료 | ❌ |
| 10 | WebRTC 스트리밍 | 🔵 고급 | 40-60h | $200/월 | ❌ |
| 11 | VOD 다시보기 | 🔵 고급 | 20-30h | $10/월 | ❌ |
| 12 | AI 추천 | 🔵 고급 | 60-80h | ₩50k/월 | ❌ |

---

## 🎯 다음 작업 추천

### **즉시 시작 (오늘~내일):**
1. **R2 이미지 업로드** (2-3시간)
   - Cloudflare Dashboard에서 R2 활성화
   - 버킷 생성
   - API 구현

### **이번 주:**
2. **알림 벨 UI** (3-4시간)
3. **관리자 승인 UI 개선** (2-3시간)

### **다음 주:**
4. **주문 관리 고도화** (6-8시간)
5. **찜하기 기능** (4-6시간)

### **2주차:**
6. **리뷰 시스템** (10-12시간)

### **3-4주차:**
7. **쿠폰 시스템** (10-12시간)
8. **포인트 시스템** (8-10시간)

---

## 💡 핵심 결론

### ✅ **서비스는 이미 작동 중!**
- 주문/결제/배송 정상
- 라이브 커머스 기본 기능 완비
- 알림/재고 관리 완료

### 🔴 **긴급 필요 (운영 편의성):**
1. R2 이미지 업로드 - 셀러가 이미지 직접 올리기
2. 알림 벨 UI - 알림을 볼 수 있게
3. 관리자 승인 개선 - 승인 대기 셀러 쉽게 찾기

### 🟡 **중요 필요 (비즈니스 성장):**
4. 주문 필터링 - 104건 관리 용이
5. 리뷰 시스템 - 신뢰도 향상
6. 쿠폰/포인트 - 마케팅 도구

### 🔵 **장기 목표 (경쟁력):**
7. WebRTC 스트리밍 - 자체 플랫폼
8. AI 추천 - 개인화

---

**작성일**: 2026-02-19  
**다음 권장 작업**: R2 이미지 업로드 활성화
