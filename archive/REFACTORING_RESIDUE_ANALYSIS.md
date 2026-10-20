# 🔍 대규모 리팩토링 후 잔여물 완전 분석

**작성일**: 2026-03-12  
**목적**: 리팩토링 후 남은 레거시 코드, 중복, 불일치 패턴 완전 제거

---

## 📊 현재 상황 요약

### 코드베이스 규모
- **총 소스 파일**: 303개 (TypeScript/TSX)
- **인증 관련 파일**: 5개
- **문서 파일**: 400+ 개 (대부분 마이그레이션 문서)

### 발견된 주요 문제

#### 🔴 Critical Issues

1. **Deprecated 함수 계속 사용**
   - `saveUserInfo()` - 3곳에서 사용 중
   - `saveJwtTokens()` - deprecated 경고만 있음
   - `getSessionToken()` - deprecated 경고만 있음

2. **중복된 인증 로직**
   - `utils/auth.ts` - 클라이언트 인증
   - `auth-utils.ts` - Worker 인증
   - `seller-auth.ts` - Seller 전용
   - `lib/firebase-auth.ts` - Firebase 래퍼

3. **Firebase 마이그레이션 불완전**
   - 일부 페이지에서 여전히 레거시 함수 사용
   - URL 파라미터 처리 로직 중복

---

## 🔴 Critical: Deprecated 함수 사용 현황

### 1. `saveUserInfo()` 사용처

#### ❌ `hooks/useLoginUrlParams.ts`
```typescript
import { saveUserInfo } from '@/utils/auth'

// ...
saveUserInfo(
  userId,
  userName, 
  sessionToken,
  userEmail,
  profileImage
)
```

**문제점**:
- Deprecated 함수 사용
- Firebase 전환 후에도 레거시 패턴 유지
- `saveFirebaseTokens()` 사용해야 함

**영향도**: 🔴 High (URL 파라미터 로그인 흐름)

---

#### ❌ `pages/CheckoutPage.tsx`
```typescript
import { requireLogin, getUserId, isLoggedIn, saveUserInfo } from '@/utils/auth'

// URL 파라미터에서 로그인 정보 추출 시
saveUserInfo(userId, userName, sessionToken)
```

**문제점**:
- 체크아웃 페이지에서 레거시 인증 로직 사용
- Firebase Custom Token 방식으로 전환해야 함

**영향도**: 🔴 Critical (결제 흐름)

---

#### ❌ `pages/HomePage.tsx`
```typescript
import { getUserName, getUserId, saveUserInfo, logout } from '@/utils/auth'

// URL 파라미터 처리
saveUserInfo(userId, userName, sessionToken)
```

**문제점**:
- 홈페이지에서 레거시 URL 파라미터 로그인
- 이미 `loginWithFirebaseToken()`이 있는데 중복

**영향도**: 🟡 Medium

---

### 2. Deprecated 함수 정의 위치

#### `utils/auth.ts` (라인 488-530)
```typescript
/**
 * @deprecated Firebase 전환 후 이 함수는 saveFirebaseTokens로 대체됩니다.
 */
export function saveJwtTokens(...) {
  console.warn('[Auth] ⚠️ saveJwtTokens는 deprecated입니다.')
  saveFirebaseTokens(accessToken, userId, userName, userType, userEmail, profileImage)
}

/**
 * @deprecated Firebase 전환 후 이 함수는 saveFirebaseTokens로 대체됩니다.
 */
export function saveUserInfo(...) {
  console.warn('[Auth] ⚠️ saveUserInfo는 deprecated입니다.')
  // 임시 호환 처리: sessionToken을 firebase_token으로 저장
  localStorage.setItem('firebase_token', sessionToken)
  localStorage.setItem('user_id', userId.toString())
  localStorage.setItem('user_name', userName)
  localStorage.setItem('user_type', 'user')
  // ...
}

/**
 * @deprecated Firebase 전환 후 이 함수는 getAccessToken으로 대체됩니다.
 */
export function getSessionToken(): string | null {
  console.warn('[Auth] ⚠️ getSessionToken는 deprecated입니다.')
  return getAccessToken() || 
         localStorage.getItem('access_token') ||
         localStorage.getItem('session_token')
}
```

**문제점**:
- Deprecated 함수가 여전히 export되고 사용됨
- 경고만 출력하고 실제 제거는 안 됨
- 호환성 유지 목적이지만 혼란 야기

---

## 🟡 Medium: 중복 인증 로직

### 인증 파일 구조

```
src/
├── utils/auth.ts              # 클라이언트 인증 (메인)
├── auth-utils.ts              # Worker 인증 (백엔드)
├── lib/
│   ├── firebase-auth.ts       # Firebase 래퍼
│   └── seller-auth.ts         # Seller JWT 전용
├── features/auth/
│   └── login-flow.service.ts  # 통합 로그인 서비스
└── worker/middleware/
    └── auth.ts                # Worker 미들웨어
```

**분석**:
- ✅ **auth-utils.ts**: Worker 전용 → 분리 정당함
- ✅ **seller-auth.ts**: Seller 전용 → 분리 정당함
- ⚠️ **utils/auth.ts**: 너무 많은 책임 (400+ 라인)
- ⚠️ **login-flow.service.ts**: 일부 로직 중복

### 중복 로직 예시

#### `utils/auth.ts`
```typescript
export async function logout(type?: 'seller' | 'admin' | 'user' | null): Promise<void> {
  // 모든 로그아웃 로직
}
```

#### `features/auth/login-flow.service.ts`
```typescript
export async function logout(userType?: 'user' | 'seller' | 'admin'): Promise<void> {
  // 거의 동일한 로그아웃 로직 (최근 수정 버전)
}
```

**문제점**:
- 두 곳에서 `logout()` 정의
- `utils/auth.ts`는 구버전 (타입 다름)
- `login-flow.service.ts`는 신버전 (최근 수정)
- 어느 것을 사용해야 할지 불명확

---

## 🟢 Low: URL 파라미터 처리 중복

### 중복 코드 패턴

#### Pattern 1: `useLoginUrlParams.ts`
```typescript
export function useLoginUrlParams() {
  const [searchParams] = useSearchParams()
  
  useEffect(() => {
    const userId = searchParams.get('userId')
    const userName = searchParams.get('userName')
    const sessionToken = searchParams.get('session')
    
    if (userId && sessionToken) {
      saveUserInfo(userId, userName || '', sessionToken)
      // URL 정리
    }
  }, [searchParams])
}
```

#### Pattern 2: `CheckoutPage.tsx`
```typescript
useEffect(() => {
  const userId = searchParams.get('userId')
  const userName = searchParams.get('userName')
  const sessionToken = searchParams.get('session')
  
  if (userId && sessionToken) {
    saveUserInfo(userId, userName || '', sessionToken)
    window.history.replaceState({}, '', window.location.pathname)
  }
}, [searchParams])
```

#### Pattern 3: `HomePage.tsx`
```typescript
useEffect(() => {
  const userId = searchParams.get('userId')
  const userName = searchParams.get('userName')
  const sessionToken = searchParams.get('session')
  
  if (userId && sessionToken) {
    saveUserInfo(userId, userName || '', sessionToken)
    navigate(window.location.pathname, { replace: true })
  }
}, [searchParams])
```

**문제점**:
- 동일한 로직이 3곳에 중복
- `useLoginUrlParams` 훅이 있는데 사용 안 함
- URL 정리 방법도 각각 다름 (replaceState vs navigate)

---

## 🔍 Root Cause Analysis: 왜 잔여물이 많은가?

### 1️⃣ 단계적 마이그레이션 전략

**의도**:
- JWT → Firebase 점진적 전환
- 호환성 유지하며 리스크 최소화

**부작용**:
- Deprecated 함수를 제거하지 않고 경고만 추가
- 신구 방식이 공존하며 혼란
- 마이그레이션 완료 후 정리 단계 누락

### 2️⃣ 여러 개발자/세션의 작업

**증거**:
- 동일한 로직의 다른 구현 (logout 2개)
- 일관되지 않은 패턴 (URL 정리 방법)
- 문서 400+ 개 (각 세션마다 새 문서 생성)

**문제**:
- 코드 리뷰 부족
- 리팩토링 가이드라인 미준수
- 중복 확인 없이 새 코드 추가

### 3️⃣ 테스트 커버리지 부족

**현황**:
- 단위 테스트 없음
- E2E 테스트 없음
- 레거시 함수 제거 시 영향도 불명확

**결과**:
- Deprecated 함수 제거 두려움
- "일단 작동하면 건드리지 않기" 멘탈리티
- 기술 부채 누적

### 4️⃣ 문서 과잉 생성

**통계**:
- TODO 문서: 3개
- 마이그레이션 문서: 50+ 개
- 가이드 문서: 100+ 개
- 분석 문서: 100+ 개

**문제**:
- 어떤 문서가 최신인지 불명확
- 중복된 정보
- 실제 코드와 문서 불일치

---

## ✅ 해결 방안

### Phase 1: Deprecated 함수 제거 (🔴 Critical)

#### Step 1-1: `saveUserInfo()` 사용처 교체

**파일**: `hooks/useLoginUrlParams.ts`

**Before**:
```typescript
saveUserInfo(userId, userName, sessionToken, userEmail, profileImage)
```

**After** (제안):
```typescript
// ❌ URL 파라미터 로그인은 더 이상 사용하지 않음!
// ✅ Firebase Custom Token 방식으로 전환됨
// 이 훅 전체를 deprecated 처리하고 제거

// 대신 firebase_token 파라미터만 처리
const firebaseToken = searchParams.get('firebase_token')
if (firebaseToken) {
  await loginWithFirebaseToken(firebaseToken)
}
```

**파일**: `pages/CheckoutPage.tsx`, `pages/HomePage.tsx`

**Before**:
```typescript
saveUserInfo(userId, userName, sessionToken)
```

**After**:
```typescript
// ✅ 이미 UserProfilePage에 있는 패턴 사용
const firebaseToken = searchParams.get('firebase_token')
if (firebaseToken) {
  await loginWithFirebaseToken(firebaseToken)
}
```

#### Step 1-2: Deprecated 함수 제거

**파일**: `utils/auth.ts`

**Action**:
```typescript
// ❌ 삭제
export function saveUserInfo() { ... }
export function saveJwtTokens() { ... }
export function getSessionToken() { ... }
```

**Impact Check**:
1. 전체 코드베이스 검색
2. 사용처 모두 교체 확인
3. 빌드 테스트
4. 삭제 실행

---

### Phase 2: 중복 로직 통합 (🟡 Medium)

#### Step 2-1: `logout()` 통합

**결정**: `features/auth/login-flow.service.ts`의 신버전 사용

**Action**:
1. `utils/auth.ts`의 `logout()` 삭제
2. 모든 사용처를 `login-flow.service.ts`로 변경
3. Export 경로 통일

```typescript
// ❌ Before
import { logout } from '@/utils/auth'

// ✅ After
import { logout } from '@/features/auth/login-flow.service'
```

#### Step 2-2: URL 파라미터 처리 통합

**결정**: `useLoginUrlParams` 훅 제거, 각 페이지에서 직접 처리

**이유**:
- Firebase 전환 후 URL 파라미터 로그인 불필요
- `firebase_token` 파라미터만 처리하면 됨
- 각 페이지의 컨텍스트에 맞게 처리하는 것이 더 명확

**Action**:
1. `hooks/useLoginUrlParams.ts` deprecated 처리
2. 각 페이지에서 직접 처리 (UserProfilePage 패턴)
3. 모든 사용처 확인 후 훅 제거

---

### Phase 3: utils/auth.ts 리팩토링 (🟢 Low)

**현재 상태**: 540+ 라인, 너무 많은 책임

**제안 구조**:
```
src/utils/
├── auth/
│   ├── index.ts              # Public exports
│   ├── storage.ts            # localStorage 관리
│   ├── firebase.ts           # Firebase 관련
│   ├── jwt.ts                # JWT 관련 (Seller/Admin)
│   └── helpers.ts            # 유틸리티 함수
```

**장점**:
- 각 파일 200 라인 이하
- 책임 명확히 분리
- 테스트 작성 용이
- 유지보수성 향상

**단점**:
- Import 경로 변경 필요
- 대규모 리팩토링 (위험도 높음)

**결정**: Phase 4로 연기 (우선순위 낮음)

---

### Phase 4: 문서 정리 (🟢 Low)

#### Step 4-1: TODO 문서 통합

**현재**:
- `TODO_NOW.md`
- `TODO_REMAINING_TASKS.md`
- `UI_UX_IMPROVEMENT_TODO.md`

**제안**:
```
TODO.md  # 단일 TODO 파일
├── Critical (지금 바로)
├── High (이번 주)
├── Medium (다음 주)
└── Low (나중에)
```

#### Step 4-2: 마이그레이션 문서 아카이브

**Action**:
```bash
mkdir -p docs/archive/migrations
mv *MIGRATION*.md docs/archive/migrations/
mv *REFACTORING*.md docs/archive/migrations/
```

**보존**:
- 최신 문서만 루트에 유지
- 나머지는 `docs/archive/` 이동

#### Step 4-3: 핵심 문서만 유지

**루트에 유지할 문서**:
- `README.md` - 프로젝트 소개
- `TODO.md` - 현재 작업
- `ARCHITECTURE.md` - 시스템 아키텍처
- `DEPLOYMENT.md` - 배포 가이드
- `CRITICAL_AUTH_SEPARATION_ANALYSIS.md` - 최신 인증 분석 (금일 작성)

**모든 나머지 → `docs/` 이동**

---

## 📋 실행 계획

### 우선순위별 작업

#### 🔴 Priority 1 (즉시 - 오늘)
1. **Deprecated 함수 사용처 교체**
   - [ ] `hooks/useLoginUrlParams.ts` 수정
   - [ ] `pages/CheckoutPage.tsx` 수정
   - [ ] `pages/HomePage.tsx` 수정
   - [ ] 빌드 테스트
   - [ ] 커밋: "refactor(auth): remove deprecated function usage"

2. **Deprecated 함수 제거**
   - [ ] `utils/auth.ts`에서 3개 함수 삭제
   - [ ] 전체 코드베이스 검색 (사용처 0개 확인)
   - [ ] 빌드 테스트
   - [ ] 커밋: "refactor(auth): remove deprecated functions"

#### 🟡 Priority 2 (이번 주)
3. **logout() 통합**
   - [ ] `utils/auth.ts`의 `logout()` 제거
   - [ ] 모든 사용처 `login-flow.service.ts`로 변경
   - [ ] 테스트
   - [ ] 커밋: "refactor(auth): unify logout function"

4. **URL 파라미터 처리 정리**
   - [ ] `useLoginUrlParams` 훅 deprecated
   - [ ] 각 페이지 직접 처리로 변경
   - [ ] 테스트
   - [ ] 커밋: "refactor(auth): clean up URL param handling"

#### 🟢 Priority 3 (다음 주)
5. **문서 정리**
   - [ ] TODO 문서 통합
   - [ ] 마이그레이션 문서 아카이브
   - [ ] 핵심 문서만 루트 유지
   - [ ] 커밋: "docs: reorganize documentation"

6. **utils/auth.ts 분리** (선택사항)
   - [ ] 구조 설계
   - [ ] 단계적 분리
   - [ ] 테스트
   - [ ] 커밋: "refactor(auth): split utils/auth.ts"

---

## 🧪 테스트 체크리스트

### 각 Phase 후 실행

#### Build Test
```bash
npm run build
# 0 errors, 0 warnings 확인
```

#### Type Check
```bash
npm run type-check
# 0 errors 확인
```

#### Runtime Test (수동)
```bash
# 1. Dev Server
npm run dev

# 2. 시나리오 테스트
- User Kakao 로그인
- User Email 로그인
- Seller 로그인
- Admin 로그인
- User 로그아웃
- Seller 로그아웃
- URL 파라미터 정리 확인
```

---

## 📊 예상 소요 시간

| Phase | 작업 | 예상 시간 |
|-------|------|----------|
| 1 | Deprecated 함수 제거 | 2시간 |
| 2 | 중복 로직 통합 | 3시간 |
| 3 | utils/auth.ts 리팩토링 | 8시간 (선택) |
| 4 | 문서 정리 | 1시간 |
| **합계** | | **6-14시간** |

---

## 💡 교훈

### 리팩토링 후 정리가 중요한 이유

1. **기술 부채 누적**
   - Deprecated 코드를 남기면 계속 사용됨
   - "나중에 제거"는 절대 오지 않음

2. **코드 복잡도 증가**
   - 신구 방식 공존 → 혼란
   - 어느 패턴을 따라야 할지 불명확

3. **유지보수 비용 증가**
   - 중복 코드 유지보수 2배
   - 버그 수정도 여러 곳에서 필요

4. **새로운 개발자 온보딩 어려움**
   - "왜 두 가지 방법이 있나요?"
   - 문서와 코드 불일치

### 개선 방안

1. **마이그레이션 체크리스트**
   ```markdown
   ## 마이그레이션 완료 기준
   - [ ] 모든 코드 전환 완료
   - [ ] Deprecated 함수 제거
   - [ ] 중복 로직 제거
   - [ ] 문서 업데이트
   - [ ] 테스트 통과
   ```

2. **코드 리뷰 강화**
   - 중복 코드 체크
   - Deprecated 함수 사용 금지
   - 일관된 패턴 강제

3. **정기 점검**
   - 월 1회 레거시 코드 스캔
   - Deprecated 함수 사용 현황
   - TODO 주석 정리

---

## 🎯 결론

### 발견된 문제
- ✅ Deprecated 함수 3개 (여전히 사용 중)
- ✅ 중복 로직 (logout 2개, URL 처리 3곳)
- ✅ 문서 과잉 (400+ 개)
- ✅ 불일치 패턴 (여러 구현 방식 공존)

### 해결 우선순위
1. 🔴 **Critical**: Deprecated 함수 제거 (2시간)
2. 🟡 **High**: 중복 로직 통합 (3시간)
3. 🟢 **Low**: 문서 정리 (1시간)
4. 🟢 **Optional**: utils/auth.ts 분리 (8시간)

### 다음 작업
**오늘 바로 시작**: Phase 1 실행 (Deprecated 함수 제거)

---

**작성일**: 2026-03-12  
**작성자**: UR Live Development Team  
**다음 리뷰**: Phase 1 완료 후
