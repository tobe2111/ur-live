# 🔍 JWT → Firebase 마이그레이션 전체 문제 분석

## ❌ 근본 문제: 인증 상태 판단 로직의 불일치

### 문제 1: `isLoggedIn()` 함수의 타이밍 이슈

**현재 코드 (`src/utils/auth.ts:63-69`):**
```typescript
export function isLoggedIn(): boolean {
  const auth = getAuth(app)
  const firebaseUser = auth.currentUser
  const firebaseToken = localStorage.getItem(FIREBASE_STORAGE_KEYS.FIREBASE_TOKEN)
  const userId = getUserId()  // ⚠️ 문제: localStorage에서 읽음
  
  return !!(firebaseUser && firebaseToken && userId)  // ⚠️ userId가 없으면 false!
}
```

**흐름:**
1. Firebase 로그인 성공 → `firebaseUser` 존재
2. `AuthContext`가 Custom Claims에서 `userId` 추출
3. `localStorage.setItem('user_id', userId)` 실행
4. **하지만**: `isLoggedIn()`이 3번 전에 호출되면 `userId === null` → `false` 반환
5. 페이지가 "로그인 안 됨"으로 판단 → `/login`으로 리다이렉트

### 문제 2: 여러 곳에서 다른 방식으로 인증 체크

| 위치 | 체크 방식 | 문제점 |
|------|----------|-------|
| `utils/auth.ts` | `firebaseUser && firebaseToken && userId` | localStorage 의존 |
| `AuthContext.tsx` | `user !== null` | Firebase User 객체만 체크 |
| `CheckoutPage.tsx` | `isAuthReady && user` | useAuth 훅 사용 |
| `UserProfilePage.tsx` | `isAuthReady && user` | useAuth 훅 사용 |
| `lib/api.ts` | `firebase_token` 헤더 | localStorage만 체크 |

**결과: 타이밍에 따라 인증 상태가 다르게 판단됨**

---

## 🔥 Rate Limit 429 에러의 진짜 원인

### 문제 3: 중복 API 호출

**시퀀스:**
1. 카카오 로그인 성공 → URL에 `firebase_token` 파라미터
2. `AuthContext` 마운트 → `useEffect` 2개가 동시 실행:
   - URL 파라미터 처리 useEffect
   - `onAuthStateChanged` useEffect
3. `signInWithCustomToken(firebaseToken)` 호출
4. Firebase Auth 상태 변경 → `onAuthStateChanged` 트리거
5. **문제**: `user`가 변경될 때마다 `onAuthStateChanged` 다시 실행
6. 여러 번 `/api/auth/firebase/sync` 호출
7. **Rate Limit 429 발생**

### 문제 4: 무한 루프 메커니즘

```
1. 카카오 로그인 → firebase_token 파라미터
2. AuthContext: signInWithCustomToken() 호출
3. onAuthStateChanged 트리거 → user 설정
4. localStorage에 firebase_token 저장
5. ❌ user_id가 아직 저장 안 됨 (Rate Limit or 타이밍)
6. UserProfilePage: isLoggedIn() === false (userId 없음)
7. requireLogin() 호출 → /login으로 리다이렉트
8. LoginPage: Firebase user 있음 → / 로 리다이렉트
9. → 2번으로 돌아감 (무한 루프)
```

---

## ✅ 해결 방안: 전체 재설계

### 1. Single Source of Truth: Firebase Auth ONLY

**변경 전:**
```typescript
// ❌ localStorage 의존
export function isLoggedIn(): boolean {
  const firebaseUser = auth.currentUser
  const firebaseToken = localStorage.getItem('firebase_token')
  const userId = getUserId()  // localStorage
  return !!(firebaseUser && firebaseToken && userId)
}
```

**변경 후:**
```typescript
// ✅ Firebase Auth만 체크
export function isLoggedIn(): boolean {
  const auth = getAuth(app)
  return !!auth.currentUser
}
```

### 2. useAuth 훅으로 통일

**모든 페이지에서:**
```typescript
// ❌ 직접 호출 금지
import { isLoggedIn, getUserId } from '@/utils/auth'
if (!isLoggedIn()) { ... }

// ✅ useAuth 훅 사용
import { useAuth } from '@/contexts/AuthContext'
const { isAuthReady, user, userRole } = useAuth()

if (!isAuthReady) return <LoadingSpinner />
if (!user) { navigate('/login'); return }
```

### 3. Custom Claims에서 즉시 추출 (이미 완료)

```typescript
// ✅ API 호출 없이 즉시 저장
const userIdFromClaims = idTokenResult.claims.userId
if (userIdFromClaims) {
  localStorage.setItem('user_id', userIdFromClaims.toString())
}
```

### 4. URL 파라미터 즉시 제거 (이미 완료)

```typescript
// ✅ 비동기 처리 전에 URL 정리
const cleanUrl = window.location.pathname
window.history.replaceState({}, document.title, cleanUrl)

// 그 다음 Firebase 로그인
await signInWithCustomToken(auth, firebaseToken)
```

---

## 📋 수정 필요 파일 목록

### 우선순위 1 (핵심)
1. ✅ `src/utils/auth.ts` - `isLoggedIn()` 함수 수정
2. ⏳ `src/pages/CheckoutPage.tsx` - useAuth 훅으로 전환 확인
3. ⏳ `src/pages/UserProfilePage.tsx` - useAuth 훅으로 전환 확인
4. ⏳ `src/components/main/TopNav.tsx` - 인증 체크 방식 확인
5. ⏳ `src/lib/api.ts` - 토큰 첨부 로직 확인

### 우선순위 2 (정리)
6. `src/pages/LoginPage.tsx` - 레거시 JWT 코드 제거
7. `src/pages/CartPage.tsx` - 인증 체크 확인
8. `src/pages/MyOrdersPage.tsx` - 인증 체크 확인
9. `src/pages/AddressManagementPage.tsx` - 인증 체크 확인

### 우선순위 3 (백엔드)
10. `src/index.tsx` - Rate Limit 설정 검토
11. `src/lib/firebase-jwt-verify.ts` - 사용 여부 확인

---

## 🎯 수정 순서

1. **Step 1**: `isLoggedIn()` 함수 수정 (Firebase Auth만 체크)
2. **Step 2**: 모든 페이지 useAuth 훅 전환 확인
3. **Step 3**: localStorage 의존성 제거
4. **Step 4**: 빌드 & 테스트
5. **Step 5**: 배포 & 검증

---

## 예상 결과

### Before (현재)
```
✅ Firebase 로그인 성공
❌ user_id가 localStorage에 없음
❌ isLoggedIn() → false
❌ 무한 리다이렉트
```

### After (수정 후)
```
✅ Firebase 로그인 성공
✅ isLoggedIn() → true (firebaseUser만 체크)
✅ user_id는 Custom Claims에서 즉시 추출
✅ 페이지 정상 렌더링
```
