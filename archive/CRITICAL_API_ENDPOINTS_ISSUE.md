# 🚨 긴급: API 엔드포인트 대량 누락 문제

## 📊 현황 분석

### 발견된 문제
- **기존 엔드포인트**: 204개 (src/index.tsx)
- **새 Worker 등록**: 약 10개 미만 (src/worker/index.ts)
- **누락된 엔드포인트**: ~200개
- **영향 범위**: 홈페이지, 라이브, 상품, 주문, 판매자 등 **거의 모든 기능**

### 500 에러 발생 중인 API (확인된 것만)
1. ❌ `/api/streams?status=live` - 라이브 방송 목록
2. ❌ `/api/products?limit=6&sort=popular&featured=true` - 인기 상품
3. ❌ `/api/live-streams` - 라이브 스트림 목록
4. ❌ `/api/products/:id` - 상품 상세
5. ❌ `/api/orders` - 주문 목록
6. ❌ `/api/seller/*` - 판매자 관련 모든 API
7. ❌ `/api/cart/*` - 장바구니 관련 모든 API
8. ❌ `/api/wishlists/*` - 위시리스트 관련 모든 API

## 🔍 근본 원인

### 1. 불완전한 아키텍처 마이그레이션
```typescript
// ❌ 기존 (16,031줄) - 204개 엔드포인트
// src/index.tsx
app.get('/api/streams', ...)        // ✅ 작동
app.get('/api/products', ...)       // ✅ 작동
app.get('/api/orders', ...)         // ✅ 작동
// ... 200개 더

// ❌ 새로운 (253줄) - 10개 미만만 등록
// src/worker/index.ts  
app.route('/api/products', productsRoutes);  // 일부만
app.route('/api/orders', ordersRoutes);      // 일부만
// app.route('/api/live-stream', liveStreamRoutes); // ❌ 주석 처리!
```

### 2. Feature 모듈 미완성
```bash
src/features/
├── auth/        ✅ 완료 (2-3개 엔드포인트)
├── products/    ⚠️ 불완전 (15개 중 5개만)
├── orders/      ⚠️ 불완전 (10개 중 3개만)
├── streams/     ❌ 없음! (20개 필요)
├── cart/        ❌ 없음! (8개 필요)
├── wishlists/   ❌ 없음! (5개 필요)
├── seller/      ❌ 없음! (30개 필요)
└── admin/       ❌ 없음! (15개 필요)
```

### 3. 빌드 설정 변경
```typescript
// vite.worker.config.ts
export default defineConfig({
  plugins: [
    pages({
      entry: 'src/worker/index.ts', // ⚠️ 새 진입점 (10개만)
      // 기존: 'src/index.tsx'      // ✅ 모든 204개 포함
    }),
  ],
})
```

## 🎯 해결책 (2가지 옵션)

### 옵션 1: 긴급 롤백 (⏱️ 5분)
**가장 빠른 해결책 - 즉시 실행 가능**

```bash
# 1. Worker 빌드 설정을 기존 파일로 되돌림
# vite.worker.config.ts 수정:
entry: 'src/index.tsx'  # 204개 모두 포함

# 2. 빌드 & 배포
npm run build:kr
npx wrangler pages deploy dist --project-name=ur-live
```

**장점**:
- ✅ 즉시 모든 API 복구
- ✅ 검증된 코드
- ✅ 위험 낮음

**단점**:
- ⚠️ 모듈식 아키텍처 포기 (임시로)
- ⚠️ 16,031줄 monolithic 파일 유지

### 옵션 2: 점진적 마이그레이션 (⏱️ 2-3일)
**장기적으로 올바른 방법**

**Phase 1: 즉시 (오늘)**
1. 기존 `src/index.tsx`를 임시 복구
2. 프로덕션 안정화

**Phase 2: 계획 (1일)**
1. 누락된 Feature 모듈 목록 작성
2. 우선순위 결정 (streams > products > orders > seller)
3. 테스트 계획 수립

**Phase 3: 구현 (2일)**
1. Stream Feature 완성 (20개 엔드포인트)
2. Products Feature 완성 (15개 엔드포인트)
3. Orders Feature 완성 (10개 엔드포인트)
4. 각 Feature마다 통합 테스트

**Phase 4: 전환 (1일)**
1. 스테이징 환경에서 새 Worker 테스트
2. Smoke Test 통과 확인
3. 프로덕션 배포
4. 모니터링

## 📋 누락된 엔드포인트 전체 목록

### Streams (라이브) - 20개
```
GET    /api/streams
GET    /api/streams/:id
GET    /api/live-streams
GET    /api/live-streams/:id
GET    /api/streams/:streamId/products
GET    /api/streams/:streamId/current-product
GET    /api/streams/:streamId/product-wait
POST   /api/streams
PUT    /api/streams/:id
DELETE /api/streams/:id
... (10개 더)
```

### Products (상품) - 15개
```
GET    /api/products                  ⚠️ 500 에러
GET    /api/products/popular
GET    /api/products/search
GET    /api/products/:id
GET    /api/products/:id/options
GET    /api/products/:id/stock
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
... (6개 더)
```

### Seller (판매자) - 30개
```
GET    /api/seller/products
GET    /api/seller/streams
GET    /api/seller/analytics/products
GET    /api/seller/stats/products
POST   /api/seller/products
... (25개 더)
```

### Cart (장바구니) - 8개
```
GET    /api/cart/:userId
POST   /api/cart/add
PUT    /api/cart/update
DELETE /api/cart/remove
... (4개 더)
```

### Orders (주문) - 10개
```
GET    /api/orders
GET    /api/orders/user/:userId
GET    /api/orders/:id
POST   /api/orders
... (6개 더)
```

### Wishlists (위시리스트) - 5개
```
GET    /api/wishlists/:userId
POST   /api/wishlists/add
DELETE /api/wishlists/remove
... (2개 더)
```

### 기타 - ~100개
- Payments (결제)
- Shipping (배송)
- Admin (관리자)
- Analytics (통계)
- Reviews (리뷰)
- Notifications (알림)
- etc.

## 🚀 권장 조치

### 즉시 실행 (긴급)
```bash
# 1. Worker 진입점을 기존 파일로 변경
cd /home/user/webapp

# 2. vite.worker.config.ts 수정
# entry: 'src/index.tsx' 로 변경

# 3. 빌드 & 배포
npm run build:kr
npx wrangler pages deploy dist --project-name=ur-live

# 4. 검증
curl https://live.ur-team.com/api/streams?status=live
curl https://live.ur-team.com/api/products?limit=6
```

### 다음 단계 (1주일 내)
1. **스테이징 환경 구축** - 프로덕션과 동일한 환경
2. **통합 테스트 작성** - 모든 API 엔드포인트 자동 테스트
3. **Feature 모듈 완성** - 누락된 모든 엔드포인트 마이그레이션
4. **점진적 전환** - 스테이징 검증 → 프로덕션 배포

## 📊 영향 분석

### 현재 상태
- 🔴 **홈페이지**: 인기 상품 로딩 실패
- 🔴 **라이브 페이지**: 라이브 목록 로딩 실패
- 🔴 **상품 상세**: 모든 상품 조회 실패
- 🔴 **장바구니**: 전체 기능 불가
- 🔴 **주문**: 주문 조회/생성 불가
- 🔴 **판매자**: 판매자 페이지 전체 불가
- 🟢 **로그인**: 정상 (Kakao/Firebase)
- 🟢 **결제**: 부분 정상 (TossPayments SDK)

### 복구 후 (옵션 1 실행)
- 🟢 **모든 페이지**: 정상 작동
- 🟢 **모든 API**: 200 OK
- 🟡 **아키텍처**: Monolithic (개선 필요)

## 🎓 교훈

### 문제점
1. ❌ **Big Bang Migration** - 한 번에 전체 변경
2. ❌ **스테이징 환경 없음** - 프로덕션에서 직접 발견
3. ❌ **통합 테스트 부재** - 누락 감지 불가
4. ❌ **배포 전 검증 없음** - Smoke Test 미실행

### 개선 방안
1. ✅ **Strangler Fig Pattern** - 점진적 마이그레이션
2. ✅ **스테이징 환경 필수** - 프로덕션 배포 전 검증
3. ✅ **자동화된 테스트** - 모든 엔드포인트 테스트
4. ✅ **배포 후 자동 검증** - CI/CD에 Smoke Test 포함

---

**작성일**: 2026-03-05  
**심각도**: 🔴 Critical  
**예상 복구 시간**: 5분 (옵션 1) / 2-3일 (옵션 2)  
**권장 조치**: 옵션 1 (긴급 롤백) 즉시 실행
