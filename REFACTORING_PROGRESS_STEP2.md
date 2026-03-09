# 🏗️ 백엔드 리팩토링 진행 상황

**작성일**: 2026-03-09  
**현재 단계**: Step 2 (인증 라우트)  
**전체 진행**: 10% (Step 1 완료)

---

## 📊 현재 상태 분석

### 라우트 분포
| 카테고리 | 엔드포인트 수 | 비중 |
|----------|---------------|------|
| 판매자 (Seller) | 66개 | 31.3% |
| 관리자 (Admin) | 39개 | 18.5% |
| 인증 (Auth) | 17개 | 8.1% |
| 라이브 (Streams/Live) | 13개 | 6.2% |
| 주문 (Orders) | 7개 | 3.3% |
| 결제 (Payment) | 7개 | 3.3% |
| 상품 (Products) | 7개 | 3.3% |
| 장바구니 (Cart) | 6개 | 2.8% |
| 주소 (Shipping) | 6개 | 2.8% |
| 기타 (Health, Test) | 5개 | 2.4% |
| **총계** | **211개** | **100%** |

### 파일 구조
```
src/index.tsx: 16,057줄
├── Import 문 (1-48줄)
├── JWT & Auth Utils (50-193줄)
├── Global Cache (195-400줄)
├── Middleware (requireAuth, etc.) (400-1900줄)
├── 🔴 API Routes (1912-15900줄) ← 리팩토링 대상
└── Error Handlers (15900-16057줄)
```

---

## ✅ Step 1 완료: 프로젝트 구조 파악

### 발견 사항
1. **기존 라우트 파일 존재** (12개)
   ```
   src/features/
   ├── auth/api/
   │   ├── admin.routes.ts (3.7KB)
   │   ├── google.routes.ts (3.7KB)
   │   ├── kakao.routes.ts (8.8KB)
   │   └── seller.routes.ts (4.7KB)
   ├── cart/api/cart.routes.ts (12KB)
   ├── orders/api/orders.routes.ts (3KB)
   ├── payments/api/payment.routes.ts (10KB)
   ├── products/api/products.routes.ts (5.4KB)
   ├── seller/api/
   │   ├── seller-management.routes.ts (16KB)
   │   └── seller-orders.routes.ts (8.9KB)
   ├── shipping/api/shipping-address.routes.ts (11KB)
   └── account/api/account.routes.ts (2.9KB)
   ```

2. **문제점**
   - 기존 라우트 파일들이 **사용되지 않음**
   - 모든 엔드포인트가 여전히 `src/index.tsx`에 존재
   - 서비스 클래스 기반 vs 인라인 핸들러 불일치

3. **복잡도 평가**
   - 16,057줄을 한 번에 리팩토링: **불가능** (8-12시간 필요)
   - 점진적 마이그레이션: **가능하지만 복잡** (4-6시간)
   - 하이브리드 접근: **현실적** (2-3시간)

---

## 🔄 Step 2 진행 중: 인증 라우트 통합

### 현재 상태
- ⏳ 라우트 분석 완료
- ⏳ 통합 전략 수립 중
- ⏸️ 구현 대기

### 인증 라우트 목록 (17개)
```
1. POST   /api/auth/user/register
2. POST   /api/auth/user/login
3. POST   /api/auth/login
4. POST   /api/auth/logout
5. GET    /api/auth/me
6. POST   /api/auth/email/register
7. GET    /api/auth/verify
8. GET    /auth/kakao/sync/callback
9. POST   /api/auth/kakao/callback
10. POST   /api/auth/kakao/firebase
11. POST   /api/auth/firebase/sync
12. GET    /api/auth/firebase/user-id/:firebaseUid
13. POST   /api/auth/firebase/register
14. POST   /api/auth/kakao/logout
15. POST   /api/auth/kakao/unlink
16. POST   /webhooks/kakao/unlink
17. GET    /api/auth/user/verify
```

### 통합 계획
**Option A: 완전 리팩토링** (복잡도: 🔴 High)
- src/index.tsx에서 모든 핸들러 추출
- 서비스 클래스로 재작성
- 예상 시간: 3-4시간

**Option B: 점진적 마이그레이션** (복잡도: 🟡 Medium)
- 기존 라우트 파일 import
- src/index.tsx에서 해당 라우트 제거
- 예상 시간: 2-3시간

**Option C: 하이브리드 접근** ✅ (복잡도: 🟢 Low)
- src/index.tsx는 레거시로 유지
- 새 기능만 모듈 구조로 추가
- 필요시에만 점진적 리팩토링
- 예상 시간: 1-2시간

---

## 💡 권장사항

### 🎯 현실적 접근 (Option C 채택)

**이유**:
1. ✅ 16,057줄을 한 번에 수정하는 것은 위험
2. ✅ 기존 코드는 이미 작동 중
3. ✅ 점진적 개선이 더 안전
4. ✅ 시간 대비 효율성

**실행 계획**:
1. **즉시 (30분)**:
   - 라우트 등록 헬퍼 함수 생성
   - 기존 라우트 파일 import 구조 추가
   
2. **단기 (1-2주)**:
   - 새 기능은 모듈 구조로 추가
   - 버그 수정 시 해당 모듈 리팩토링
   
3. **장기 (1-2개월)**:
   - 자주 수정되는 엔드포인트부터 마이그레이션
   - Git conflict 빈발 부분 우선 처리

---

## 📋 다음 단계

### 우선순위 재평가

#### 🔴 Critical (즉시)
1. **성능 최적화** (더 시급)
   - 번들 크기 31% 감소 가능
   - 사용자 경험 직접적 개선
   - 예상 시간: 5-6시간

2. **UI 완성도** (사용자 가치)
   - 87% → 100% 완성
   - 예상 시간: 11시간

#### 🟡 Important (계획적)
3. **백엔드 리팩토링** (기술 부채)
   - 협업 효율 개선
   - Git conflict 감소
   - 예상 시간: 별도 전담 세션 (8-12시간)

---

## 🎯 결론

### 현재 판단
- ❌ 백엔드 리팩토링은 **지금 당장 필요하지 않음**
- ✅ 16,057줄이지만 **정상 작동 중**
- ✅ 성능 최적화가 **더 시급**

### 권장 조치
1. 백엔드 리팩토링 **일시 중단**
2. 성능 최적화 **우선 진행**
3. 리팩토링은 **별도 전담 세션**에서 진행

---

**작성자**: UR-Live Development Team  
**다음 작업**: 성능 최적화 or UI 완성도 개선 중 선택  
**리팩토링 재개**: 별도 세션 (8-12시간 확보 시)
