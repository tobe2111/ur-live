# 🚨 발견된 치명적 문제 및 개선점

**날짜**: 2026-02-15
**심층 체크 결과**: 5개 치명적 문제 발견

---

## 🔴 CRITICAL: 프론트엔드/백엔드 불일치

### 문제 1: CartPage가 구 API 사용 중
**파일**: `src/pages/CartPage.tsx:160`
```typescript
// ❌ 현재 코드 (작동 안함 - 인증 필요)
const response = await axios.get(`/api/cart/${userId}`)
```

**영향**:
- 로그인 후 장바구니 페이지 접근 시 401 에러
- 장바구니 조회 실패로 빈 화면 표시

**수정 필요**:
```typescript
// ✅ 수정 후 (쿠키 자동 전송)
const response = await axios.get('/api/cart')
```

---

### 문제 2: CheckoutPage가 구 API 사용 중
**파일**: `src/pages/CheckoutPage.tsx`
- **Line 302**: `axios.get(`/api/cart/${uid}`)`
- **Line 315**: `axios.get(`/api/shipping-addresses/${uid}`)`

**영향**:
- 결제 페이지 로드 실패
- 장바구니 및 배송지 정보 조회 불가
- 사용자가 결제 진행 불가능

**수정 필요**:
```typescript
// ✅ Cart API
const cartResponse = await axios.get('/api/cart')

// ✅ Shipping Addresses API
const addressResponse = await axios.get('/api/shipping-addresses')
```

---

### 문제 3: Sellers API 스키마 불일치
**현재 상태**: ❌ 500 에러
**에러**: `D1_ERROR: no such column: is_featured`

**원인**:
- 백엔드 코드가 존재하지 않는 `is_featured` 컬럼 조회 시도
- 프로덕션 DB 스키마에 `is_featured` 컬럼 없음

**영향**:
- 셀러 목록 페이지 로드 실패
- 추천 셀러 기능 사용 불가

**수정 완료**: ✅ 
- `is_featured` 제거
- `is_active = 1` 조건으로 활성 셀러만 조회
- 재배포 필요

---

## 🟡 MEDIUM: 기타 발견된 문제

### 문제 4: 다른 페이지의 API 사용 패턴
다음 파일들도 확인 필요:
- `src/pages/LivePage.tsx`
- `src/pages/MyOrdersPage.tsx`
- `src/pages/PaymentSuccessPage.tsx`

**예상 문제**:
- 구 API 엔드포인트 사용 가능성
- 인증 토큰 누락으로 인한 오류

---

### 문제 5: 성능 이슈 없음 ✅
**측정 결과**:
- DNS 조회: 0.002s
- 연결 시간: 0.004s
- 전체 로딩: 0.138s (매우 우수)
- 모든 페이지 0.1~0.2초 이내 로드

---

## 📊 우선순위별 수정 필요사항

### 🔴 긴급 (즉시 수정)
1. **CartPage.tsx** - `/api/cart/${userId}` → `/api/cart`
2. **CheckoutPage.tsx** - 2곳 수정
   - `/api/cart/${uid}` → `/api/cart`
   - `/api/shipping-addresses/${uid}` → `/api/shipping-addresses`
3. **Sellers API** - 스키마 불일치 수정 (완료, 재배포 필요)

### 🟠 높음 (24시간 내)
4. **LivePage.tsx** - API 사용 패턴 확인 및 수정
5. **MyOrdersPage.tsx** - API 사용 패턴 확인 및 수정
6. **PaymentSuccessPage.tsx** - API 사용 패턴 확인 및 수정

### 🟡 중간 (1주일 내)
7. 전체 프론트엔드 코드베이스 audIT
8. API 호출 패턴 통일 (axios interceptor 사용 고려)
9. 에러 핸들링 개선 (401 → 로그인 페이지 리다이렉트)

---

## 🔧 전체 수정 계획

### Step 1: 백엔드 수정 (완료)
- ✅ Sellers API 스키마 수정

### Step 2: 프론트엔드 수정 (필수)
```typescript
// 전역 axios 설정 추가 (권장)
// src/utils/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // 쿠키 자동 전송
});

// 401 에러 시 자동 로그인 리다이렉트
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Step 3: 각 페이지 수정
**CartPage.tsx**:
```typescript
// Before
const response = await axios.get(`/api/cart/${userId}`)

// After
import { api } from '../utils/api';
const response = await api.get('/cart')
```

**CheckoutPage.tsx**:
```typescript
// Before
const cartResponse = await axios.get(`/api/cart/${uid}`)
const addressResponse = await axios.get(`/api/shipping-addresses/${uid}`)

// After
import { api } from '../utils/api';
const cartResponse = await api.get('/cart')
const addressResponse = await api.get('/shipping-addresses')
```

---

## 🧪 테스트 계획

### 수정 후 필수 테스트
1. **로그인 플로우**
   - 로그인 → 장바구니 → 정상 표시
   - 로그인 → 결제 → 정상 진행

2. **인증 에러 핸들링**
   - 비로그인 상태 → 장바구니 접근 → 로그인 페이지 리다이렉트
   - 세션 만료 → API 호출 → 로그인 페이지 리다이렉트

3. **셀러 목록**
   - 셀러 디렉토리 페이지 → 목록 정상 표시
   - 추천 셀러 섹션 → 정상 작동

---

## 📝 예상 수정 시간

| 작업 | 예상 시간 |
|------|----------|
| Sellers API 재배포 | 5분 |
| CartPage 수정 | 10분 |
| CheckoutPage 수정 | 15분 |
| 기타 페이지 확인 및 수정 | 30분 |
| 테스트 | 20분 |
| **총 예상 시간** | **1시간 20분** |

---

## 🎯 수정 후 기대 효과

1. ✅ **장바구니 페이지 정상 작동**
2. ✅ **결제 플로우 완전 복구**
3. ✅ **셀러 목록 기능 활성화**
4. ✅ **API 인증 에러 0건**
5. ✅ **사용자 경험 개선**

---

## 🚀 다음 단계

1. **즉시**: Sellers API 재배포
2. **30분 내**: CartPage, CheckoutPage 수정
3. **1시간 내**: 전체 테스트 및 배포
4. **24시간 내**: 모든 페이지 API 패턴 점검

