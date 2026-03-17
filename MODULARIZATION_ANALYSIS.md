# 백엔드 모듈화 문제 분석 및 해결 방안

**날짜**: 2026-03-17  
**프로젝트**: Global Marketplace (ur-live)

---

## 🔍 문제 원인: 과도한 모듈화

### 현재 구조
```
총 29개의 라우트 파일
├── src/worker/routes/ (8개)
│   ├── auth.routes.ts
│   ├── order.routes.ts
│   ├── product.routes.ts
│   ├── payment.routes.ts
│   ├── seller.routes.ts
│   ├── streams.routes.ts
│   ├── users.routes.ts
│   └── webhook.routes.ts
│
└── src/features/ (21개)
    ├── account/api/account.routes.ts
    ├── admin/api/
    │   ├── admin-banners.routes.ts
    │   └── admin-management.routes.ts  ← 여기에 products CRUD 추가됨
    ├── auth/api/
    │   ├── admin.routes.ts
    │   ├── google.routes.ts
    │   ├── kakao.routes.ts
    │   └── seller.routes.ts
    ├── banners/api/banners.routes.ts
    ├── cart/api/cart.routes.ts
    ├── notifications/api/notifications.routes.ts
    ├── orders/api/orders.routes.ts
    ├── payments/api/payment.routes.ts
    ├── products/api/products.routes.ts
    ├── push/api/push.routes.ts
    ├── seller/api/
    │   ├── seller-management.routes.ts
    │   ├── seller-orders.routes.ts
    │   └── seller-streams.routes.ts
    ├── shipping/api/shipping-address.routes.ts
    ├── wishlists/api/wishlists.routes.ts
    └── youtube/api/
        ├── youtube.routes.ts
        └── youtube-chat.routes.ts
```

---

## 🚨 발생한 문제들

### 1. API 엔드포인트 누락
**증상**:
- `DELETE /api/admin/products/:id` → 404 Not Found
- `POST /api/admin/products` → 404 Not Found
- `PUT /api/admin/products/:id` → 404 Not Found
- `PATCH /api/admin/products/:id` → 404 Not Found

**원인**:
- `admin-management.routes.ts`에 GET만 구현되고 나머지는 미구현
- 프론트엔드는 CRUD를 모두 호출하는데 백엔드는 일부만 존재

### 2. DB 스키마 불일치
**증상**:
- `/api/admin/sellers` → 500 Error (no such column: company_name)
- `/api/notifications` → 500 Error (no such table: notifications)

**원인**:
- 코드는 존재하지 않는 DB 컬럼/테이블 참조
- 각 feature가 독립적으로 개발되어 DB 스키마와 동기화 안됨

### 3. 중복된 엔드포인트
**증상**:
```typescript
// src/worker/routes/product.routes.ts
app.route('/api/products', productsRouter);

// src/features/products/api/products.routes.ts
app.route('/api/products', featureProductsRoutes);
```

**결과**: 어느 라우터가 먼저 등록되느냐에 따라 다른 동작

---

## 📊 모듈화의 장단점

### ✅ 장점
1. **코드 조직화**
   - 기능별로 명확하게 분리
   - 관련 로직이 한 곳에 모임

2. **팀 협업**
   - 각 feature를 독립적으로 개발
   - Git 충돌 최소화

3. **테스트 용이성**
   - 각 모듈별 독립 테스트 가능
   - Mock 데이터 관리 쉬움

4. **재사용성**
   - Feature를 다른 프로젝트로 이식 가능
   - 공통 로직 모듈화

### ❌ 단점 (현재 프로젝트에서 발생)

1. **API 누락 발견 어려움**
   - 29개 파일에 분산되어 어디에 무엇이 있는지 파악 힘듦
   - 프론트엔드 요청과 백엔드 구현 불일치 확인 어려움

2. **중복 위험**
   - 같은 경로에 여러 라우터 등록 가능
   - 우선순위 관리 복잡

3. **DB 스키마 동기화 어려움**
   - 각 feature가 독립적으로 DB 쿼리 작성
   - 전체 DB 스키마 파악 필요

4. **디버깅 복잡도 증가**
   - 에러 발생 시 어느 파일이 문제인지 찾기 어려움
   - 29개 파일을 모두 확인해야 함

5. **Import 의존성 복잡**
   - index.ts에서 모든 라우트를 import
   - 순환 참조 위험

---

## 💡 해결 방안

### 옵션 1: 현재 구조 유지 + 문서화 강화 (권장)

**장점**: 기존 구조 유지, 빠른 적용
**단점**: 근본적 해결 아님

**실행 방법**:
```bash
# 1. API 문서 자동 생성
npm install --save-dev @hono/swagger

# 2. 각 routes 파일에 OpenAPI 주석 추가
/**
 * @openapi
 * /api/admin/products:
 *   get:
 *     summary: Get all products
 *     tags: [Admin Products]
 */

# 3. API 체크리스트 생성
scripts/check-api-completeness.js
```

**체크리스트 예시**:
```typescript
// scripts/check-api-completeness.js
const expectedEndpoints = {
  'GET /api/admin/products': 'admin-management.routes.ts',
  'POST /api/admin/products': 'admin-management.routes.ts',
  'PUT /api/admin/products/:id': 'admin-management.routes.ts',
  'DELETE /api/admin/products/:id': 'admin-management.routes.ts',
  // ... 모든 엔드포인트 나열
};

// 실제 구현 확인
checkImplementation(expectedEndpoints);
```

### 옵션 2: 라우트 통합 (Admin 전용)

**개념**: Admin API만 하나의 파일로 통합
```
src/features/admin/api/
├── admin.routes.ts  ← 모든 admin API 통합
└── admin.repository.ts
```

**장점**:
- Admin 관련 모든 API를 한 곳에서 관리
- 누락 발견 쉬움

**단점**:
- 파일이 커짐 (1000+ lines)

### 옵션 3: Mono-file 라우터 (극단적)

**개념**: 모든 API를 하나의 파일로
```
src/worker/routes/
└── all-routes.ts  ← 모든 API
```

**장점**: 한눈에 모든 API 파악
**단점**: 유지보수 지옥, Git 충돌 폭증

### 옵션 4: 라우트 레지스트리 패턴 (추천)

**개념**: 중앙 레지스트리에서 모든 라우트 관리
```typescript
// src/worker/route-registry.ts
export const ROUTE_REGISTRY = {
  admin: {
    products: {
      GET: '/api/admin/products',
      POST: '/api/admin/products',
      PUT: '/api/admin/products/:id',
      DELETE: '/api/admin/products/:id',
      PATCH: '/api/admin/products/:id',
    },
    sellers: {
      GET: '/api/admin/sellers',
      // ...
    }
  }
};

// 자동 검증
validateRoutes(ROUTE_REGISTRY);
```

**장점**:
- 모든 엔드포인트 한눈에 파악
- 자동 검증 가능
- 타입 안정성

**단점**:
- 초기 설정 복잡

---

## 🎯 즉시 적용 가능한 해결책

### 1. API 문서 생성 (5분)
```bash
cd /home/user/webapp
cat > API_ENDPOINTS.md << 'EOF'
# Admin API Endpoints

## Products
- [x] GET /api/admin/products
- [x] POST /api/admin/products
- [x] PUT /api/admin/products/:id
- [x] PATCH /api/admin/products/:id
- [x] DELETE /api/admin/products/:id

## Sellers
- [x] GET /api/admin/sellers
- [x] GET /api/admin/sellers/pending
- [x] PATCH /api/admin/sellers/:id/approve
- [ ] DELETE /api/admin/sellers/:id  ← 미구현
...
EOF
```

### 2. Pre-commit Hook (10분)
```bash
# .husky/pre-commit
npm run check-api-completeness
```

### 3. 테스트 자동화 (15분)
```typescript
// tests/api-coverage.test.ts
describe('API Coverage', () => {
  it('should have all CRUD endpoints for admin products', () => {
    expect(routes).toInclude('GET /api/admin/products');
    expect(routes).toInclude('POST /api/admin/products');
    expect(routes).toInclude('PUT /api/admin/products/:id');
    expect(routes).toInclude('DELETE /api/admin/products/:id');
  });
});
```

---

## 📝 권장 사항

### 단기 (지금 당장)
1. ✅ `API_ENDPOINTS.md` 작성 (전체 엔드포인트 목록)
2. ✅ 각 routes 파일에 주석으로 구현 여부 명시
3. ✅ 프론트엔드와 백엔드 API 매핑 문서 작성

### 중기 (1-2주)
1. 🔄 Swagger/OpenAPI 문서 자동 생성
2. 🔄 E2E 테스트로 모든 엔드포인트 검증
3. 🔄 CI/CD에 API 완성도 체크 추가

### 장기 (리팩토링 시)
1. 📋 Feature 단위 라우트 리뷰
2. 📋 중복 제거 및 통합 고려
3. 📋 라우트 레지스트리 패턴 도입

---

## 🎓 교훈

### 모듈화 시 주의사항
1. **문서화가 필수**
   - 어디에 무엇이 있는지 명확히

2. **자동 검증 도구**
   - 누락/중복 자동 체크

3. **팀 컨벤션**
   - 라우트 명명 규칙 통일
   - Feature 분리 기준 명확히

4. **정기적 리뷰**
   - 분기별 API 완성도 체크
   - 사용하지 않는 엔드포인트 정리

---

## 결론

**모듈화 자체는 나쁘지 않지만**, 이 프로젝트는 **과도하게 모듈화**되어:
- 29개 파일로 분산
- API 누락 발견 어려움
- DB 스키마 불일치

**해결책**: 문서화 + 자동 검증 + 주기적 리뷰로 관리 강화

현재는 급한대로 수동으로 누락된 API를 추가했지만, 장기적으로는 **라우트 레지스트리 패턴** 도입을 권장합니다.
