# 🏗️ 백엔드 리팩토링 진행 상황

**작성일**: 2026-03-09  
**현재 단계**: Step 2 (인증 API 통합)

---

## ✅ Step 1 완료 (준비 작업)

### 확인된 사항

#### 1. 프로젝트 구조
- ✅ `src/index.tsx`: 16,057줄 (모놀리식)
- ✅ `src/features/*`: 기능별 디렉터리 존재
- ✅ 테스트 환경: Vitest, Playwright 설정됨
- ✅ TypeScript 설정: tsconfig.json 존재

#### 2. 기존 인증 라우트 파일
이미 일부 분리되어 있음:

| 파일 | 라인 수 | 설명 |
|------|---------|------|
| `admin.routes.ts` | 150 | 관리자 로그인 |
| `google.routes.ts` | 125 | Google OAuth |
| `kakao.routes.ts` | 277 | Kakao OAuth |
| `seller.routes.ts` | 175 | 판매자 로그인 |
| **총합** | **727** | |

#### 3. index.tsx에 남아있는 인증 API
여전히 `src/index.tsx`에 있는 엔드포인트:

| 라인 | 엔드포인트 | 설명 |
|------|-----------|------|
| 1912 | POST `/api/auth/user/register` | 일반 사용자 회원가입 |
| 1965 | POST `/api/auth/user/login` | 일반 사용자 로그인 |
| 2040 | POST `/api/auth/login` | 통합 로그인 |
| 2048 | POST `/api/auth/logout` | 로그아웃 |
| 2068 | GET `/api/auth/me` | 현재 사용자 정보 |
| 2092 | POST `/api/auth/email/register` | 이메일 회원가입 |
| 2186 | POST `/api/seller/register` | 판매자 회원가입 (중복?) |
| 2295 | POST `/api/admin/login` | 관리자 로그인 (중복?) |
| 2398 | POST `/api/seller/login` | 판매자 로그인 (중복?) |
| 2513 | GET `/api/auth/verify` | 이메일 인증 |
| 2578 | GET `/auth/kakao/sync/callback` | Kakao 콜백 |
| 2849 | POST `/api/auth/kakao/callback` | Kakao 인증 처리 |
| 2944 | POST `/api/auth/kakao/firebase` | Kakao → Firebase |
| 3035 | POST `/api/auth/firebase/sync` | Firebase 동기화 |
| 3215 | GET `/api/auth/firebase/user-id/:firebaseUid` | Firebase UID 조회 |
| 3267 | POST `/api/auth/firebase/register` | Firebase 회원가입 |
| 3334 | POST `/api/auth/kakao/logout` | Kakao 로그아웃 |
| 3353 | POST `/api/auth/kakao/unlink` | Kakao 연결 해제 |
| 3471 | POST `/webhooks/kakao/unlink` | Kakao Webhook |
| 3537 | GET `/api/auth/user/verify` | 사용자 인증 상태 |

**총 20개 엔드포인트** 추가 이동 필요

---

## 🔄 Step 2 진행 중 (인증 API 통합)

### 전략

#### Option 1: 통합 라우트 파일 생성 (권장)
```
src/features/auth/api/
├── admin.routes.ts (기존, 150줄)
├── seller.routes.ts (기존, 175줄)
├── kakao.routes.ts (기존, 277줄)
├── google.routes.ts (기존, 125줄)
└── auth.routes.ts (신규) ← 20개 엔드포인트 통합
```

**장점**:
- 기존 파일 유지 (안전)
- 새 파일에 나머지 API 통합
- 점진적 마이그레이션

#### Option 2: 기존 파일에 병합
```
src/features/auth/api/
├── user.routes.ts (일반 사용자 인증)
├── admin.routes.ts (관리자 인증, 확장)
├── seller.routes.ts (판매자 인증, 확장)
├── kakao.routes.ts (Kakao OAuth, 확장)
└── firebase.routes.ts (Firebase 관련, 신규)
```

**단점**:
- 기존 파일 수정 필요
- 더 복잡한 마이그레이션

### 선택: Option 1 (통합 라우트)

---

## 📋 다음 작업

### 1. `auth.routes.ts` 생성
새 파일 생성: `src/features/auth/api/auth.routes.ts`

**포함할 엔드포인트** (20개):
- 일반 사용자 회원가입/로그인
- 통합 로그인/로그아웃
- 현재 사용자 정보
- 이메일 인증
- Firebase 관련 (sync, register 등)
- Kakao Webhook

### 2. 통합 라우트 파일 생성
새 파일: `src/features/auth/api/index.ts`

**역할**:
- 모든 인증 라우트를 하나로 통합
- `admin.routes.ts`, `seller.routes.ts`, `kakao.routes.ts`, `google.routes.ts`, `auth.routes.ts` import
- 단일 `authRoutes` export

### 3. index.tsx 수정
- 기존 인증 엔드포인트 제거
- `app.route('/api/auth', authRoutes)` 추가

---

## 🎯 예상 결과

### Before (현재)
```typescript
// src/index.tsx (16,057줄)
app.post('/api/auth/user/register', ...)
app.post('/api/auth/user/login', ...)
app.post('/api/auth/login', ...)
// ... 200+ 엔드포인트
```

### After (목표)
```typescript
// src/index.tsx (< 500줄)
import { authRoutes } from './features/auth/api';

app.route('/api/auth', authRoutes);
app.route('/api/products', productRoutes);
app.route('/api/orders', orderRoutes);
// ... 간결한 라우트 등록만
```

---

## 📊 진행률

| 단계 | 상태 | 진행률 |
|------|------|--------|
| Step 1: 준비 | ✅ 완료 | 100% |
| Step 2: 인증 API | 🔄 진행 중 | 50% |
| Step 3: 상품 API | ⏳ 대기 | 0% |
| Step 4: 주문 API | ⏳ 대기 | 0% |
| Step 5: 결제 API | ⏳ 대기 | 0% |
| Step 6: 기타 API | ⏳ 대기 | 0% |
| Step 7: 최종 정리 | ⏳ 대기 | 0% |
| **전체** | **🔄** | **14%** |

---

## 🚨 주의사항

### 기존 라우트 파일 문제
현재 `admin.routes.ts`, `seller.routes.ts` 등에서:
- `/login` 엔드포인트만 정의
- 접두사 없이 상대 경로 사용

**문제**:
```typescript
// admin.routes.ts
adminRoutes.post('/login', ...)  // ← 이렇게 되어있음

// 실제로는 이렇게 되어야 함:
adminRoutes.post('/api/admin/login', ...)
```

**해결 방법**:
1. `index.tsx`에서 라우트 등록 시 접두사 추가
2. 또는 각 라우트 파일에 전체 경로 명시

---

## 🔗 관련 문서

- `REFACTORING_PLAN.md` - 전체 리팩토링 계획
- `FUNCTIONAL_SPEC_REPORT_2026-03-09.md` - 212개 API 상세

---

**작성일**: 2026-03-09  
**다음 작업**: `auth.routes.ts` 생성 및 20개 엔드포인트 이동
