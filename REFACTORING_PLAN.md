# 🏗️ UR-Live 아키텍처 리팩토링 실행 계획

**작성일**: 2026-03-09  
**목표**: 16,057줄 모놀리스 (`src/index.tsx`) → 모듈화된 구조

---

## 📊 현재 상태

### 파일 구조
```
src/index.tsx (16,057줄) - 모든 API 엔드포인트 포함
├── 인증 API (30개) - 라인 1912~3583
├── 주소 관리 API (5개) - 라인 3614~3779  
├── 상품 API (25개)
├── 주문 API (30개)
├── 결제 API (20개)
├── 장바구니 API (10개)
├── 라이브 API (25개)
├── 판매자 API (30개)
├── 관리자 API (20개)
└── 기타 API (22개)

총 212개 엔드포인트
```

### 문제점
1. ❌ Git conflict 발생률 높음
2. ❌ 코드 리뷰 불가능
3. ❌ 여러 개발자 협업 어려움
4. ❌ IDE 느림 (16,000줄 파일)
5. ❌ 버그 추적 매우 어려움

---

## 🎯 리팩토링 전략

### Phase 1: 점진적 분리 (권장)
- ✅ **안전**: 기존 코드 유지하면서 점진적 이동
- ✅ **테스트 가능**: 각 모듈 이동 후 즉시 테스트
- ✅ **롤백 가능**: 문제 발생 시 쉽게 되돌림

### 작업 순서
1. 새 라우트 파일에 코드 복사
2. 테스트 실행 및 검증
3. `index.tsx`에서 원본 코드 제거
4. 라우트 등록 추가
5. 최종 테스트

---

## 📋 실행 계획 (8~12시간)

### Step 1: 준비 작업 (1시간) ✅
- [x] 백업 파일 삭제 (완료)
- [x] 리팩토링 계획 문서 작성 (완료)
- [ ] 테스트 환경 확인

### Step 2: 인증 API 분리 (2시간)
파일: `src/features/auth/api/auth.routes.ts`
- [ ] 30개 인증 엔드포인트 이동
- [ ] 테스트 실행
- [ ] index.tsx에 라우트 등록

### Step 3: 상품 API 분리 (1.5시간)
파일: `src/features/products/api/products.routes.ts`
- [ ] 25개 상품 엔드포인트 이동
- [ ] 테스트 실행

### Step 4: 주문 API 분리 (2시간)
파일: `src/features/orders/api/orders.routes.ts`
- [ ] 30개 주문 엔드포인트 이동
- [ ] 테스트 실행

### Step 5: 결제 API 분리 (1.5시간)
파일: `src/features/payments/api/payment.routes.ts`
- [ ] 20개 결제 엔드포인트 이동
- [ ] 테스트 실행

### Step 6: 기타 API 분리 (2시간)
- 장바구니, 라이브, 판매자, 관리자 등
- 각 모듈별 테스트

### Step 7: 최종 정리 (2시간)
- [ ] index.tsx 최종 정리 (목표: <500줄)
- [ ] 전체 테스트 실행
- [ ] 문서 업데이트
- [ ] Git 커밋 및 푸시

---

## 🎯 목표 구조

### After (리팩토링 후)
```
src/index.tsx (< 500줄)
├── import 문
├── Hono app 초기화
├── 미들웨어 설정
├── 라우트 등록만
└── export default app

src/features/
├── auth/api/auth.routes.ts (30개 API)
├── products/api/products.routes.ts (25개 API)
├── orders/api/orders.routes.ts (30개 API)
├── payments/api/payment.routes.ts (20개 API)
├── cart/api/cart.routes.ts (10개 API)
├── live/api/live.routes.ts (25개 API)
├── seller/api/seller.routes.ts (30개 API)
├── admin/api/admin.routes.ts (20개 API)
└── shipping/api/shipping.routes.ts (22개 API)
```

---

## ✅ 체크리스트

### 각 모듈 이동 시 확인사항
- [ ] 모든 import 문 포함
- [ ] Hono 인스턴스 생성
- [ ] 타입 정의 포함
- [ ] 미들웨어 적용 확인
- [ ] 에러 핸들링 포함
- [ ] 테스트 통과 확인

### 최종 검증
- [ ] 모든 API 엔드포인트 정상 작동
- [ ] 테스트 508개 모두 통과
- [ ] 빌드 성공
- [ ] 프로덕션 배포 정상

---

**예상 완료 시간**: 8~12시간 (1~2일)  
**우선순위**: 🔴 Critical (즉시 시작)
