# 🐛 로그인 깜빡임 & 느림 문제 진단 및 해결

**날짜**: 2026-03-19  
**증상**: 로그인 후 화면이 깜빡거리고 느림  

---

## 🔍 문제 원인 분석

### 1. **다중 Auth 상태 업데이트 충돌**

현재 3곳에서 Auth 상태를 업데이트하고 있습니다:

```typescript
// 1. KakaoCallbackPage.tsx (라인 82-99)
authStore.setUser(userCredential.user)           // ← 1차 업데이트
authStore.setAuthReady(true)                     // ← 1차 업데이트
useAuthStore.getState().setAuth(...)             // ← 1차 업데이트

// 2. useAuthKR.ts initializeAuth() (라인 189-234)
// onAuthStateChanged 콜백이 다시 실행되어
set({ user: firebaseUser, ... })                // ← 2차 업데이트 (중복!)
useAuthStore.getState().setAuth(...)             // ← 2차 업데이트 (중복!)

// 3. App.tsx (라인 176-195)
useAuthKR.getState().initializeAuth()            // ← 3차 초기화
```

**결과**: 
- 로그인 완료 → KakaoCallback에서 상태 업데이트
- 0.5초 후 → onAuthStateChanged가 감지하고 **또 업데이트**
- React 리렌더링 2-3회 발생 → **깜빡임**

---

### 2. **불필요한 토큰 갱신**

```typescript
// KakaoCallbackPage.tsx (라인 73)
const idToken = await userCredential.user.getIdToken(true)  // ← 강제 갱신 (600ms)

// 바로 뒤에 useAuthKR.ts (라인 200)에서
const idToken = await firebaseUser.getIdToken(false)        // ← 캐시 사용 (50ms)
```

**문제**: 
- `getIdToken(true)` = 강제 갱신 (네트워크 요청, ~600ms)
- 이미 갱신했는데 onAuthStateChanged가 또 호출됨
- **총 로그인 시간 ~3-5초**

---

### 3. **React Query 리페칭**

로그인 완료 → Auth 상태 변경 → 모든 컴포넌트 리렌더링 → React Query가 데이터 다시 fetch

---

## ✅ 해결 방법

### 방법 1: **onAuthStateChanged 중복 호출 방지** (권장)

KakaoCallbackPage에서 이미 완료된 로그인은 **onAuthStateChanged가 무시**하도록 수정:

```typescript
// useAuthKR.ts (라인 189 수정)
unsubscribeFn = await onAuthStateChanged(async (firebaseUser) => {
  if (firebaseUser) {
    // ✅ 이미 KakaoCallback에서 처리했으면 스킵
    const lastProcessedUid = sessionStorage.getItem('auth_processed_uid');
    if (lastProcessedUid === firebaseUser.uid) {
      console.log('[AuthKR] ⏩ 이미 처리된 UID, 스킵:', firebaseUser.uid);
      set({ isAuthReady: true });
      return;
    }
    
    // ... 나머지 로직
  }
});
```

```typescript
// KakaoCallbackPage.tsx (라인 99 다음에 추가)
console.log('[KakaoCallback] ✅ Store 업데이트 완료 (accessToken 설정됨)')

// ✅ 중복 처리 방지 플래그
sessionStorage.setItem('auth_processed_uid', userCredential.user.uid);
```

---

### 방법 2: **토큰 갱신 최적화**

```typescript
// KakaoCallbackPage.tsx (라인 73 수정)
// ❌ 강제 갱신 (느림)
const idToken = await userCredential.user.getIdToken(true)

// ✅ 캐시 사용 (Custom Token 직후라 이미 최신)
const idToken = await userCredential.user.getIdToken(false)
```

**효과**: 600ms → 50ms (~92% 빠름)

---

### 방법 3: **React Query Suspense 비활성화** (임시)

```typescript
// src/lib/react-query.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,  // ✅ 추가
      refetchOnMount: false,        // ✅ 추가 (로그인 직후)
    },
  },
})
```

---

## 🚀 즉시 적용 가능한 최소 수정

### 수정 1: useAuthKR.ts

```diff
// src/shared/stores/useAuthKR.ts (라인 189)

unsubscribeFn = await onAuthStateChanged(async (firebaseUser) => {
  if (firebaseUser) {
+   // ✅ 중복 처리 방지: KakaoCallback에서 이미 처리했으면 스킵
+   const lastProcessed = sessionStorage.getItem('auth_processed_uid');
+   if (lastProcessed === firebaseUser.uid) {
+     console.log('[AuthKR] ⏩ Already processed, skip:', firebaseUser.uid);
+     set({ isAuthReady: true });
+     return;
+   }
    
    // Firebase 유저 있음 → user_type 이 seller/admin 이면 간섭하지 않음
    const currentType = localStorage.getItem('user_type');
    if (currentType === 'seller' || currentType === 'admin') {
      // Seller/Admin 탭에서 Firebase 이벤트가 와도 무시
      set({ isAuthReady: true });
      return;
    }

    try {
      const idToken = await firebaseUser.getIdToken(false); // 캐시된 토큰 사용
      
      // ... 역할 조회 및 Store 업데이트
      
+     // ✅ 처리 완료 플래그 설정
+     sessionStorage.setItem('auth_processed_uid', firebaseUser.uid);
      
      set({
        user: firebaseUser,
        userRole: role,
        isLoading: false,
        isAuthReady: true,
        error: null,
      });
    } catch (err) {
      // ...
    }
  } else {
+   // ✅ 로그아웃 시 플래그 제거
+   sessionStorage.removeItem('auth_processed_uid');
    
    // Firebase 유저 없음
    localStorage.removeItem('lastLoginUid');
    set({
      user: null,
```

---

### 수정 2: KakaoCallbackPage.tsx

```diff
// src/pages/KakaoCallbackPage.tsx (라인 73)

// 2. Firebase Custom Token으로 로그인
const userCredential = await signInWithCustomToken(customToken)
console.log('[KakaoCallback] ✅ Firebase 로그인 성공:', userCredential.user.uid)

// 3. ID Token 갱신 (Custom Claims 로드)
- const idToken = await userCredential.user.getIdToken(true)
+ const idToken = await userCredential.user.getIdToken(false)  // ✅ 캐시 사용 (이미 최신)
console.log('[KakaoCallback] ✅ ID Token 갱신 완료')
```

```diff
// src/pages/KakaoCallbackPage.tsx (라인 99 다음에 추가)

console.log('[KakaoCallback] ✅ Store 업데이트 완료 (accessToken 설정됨)')

+ // ✅ 중복 처리 방지: onAuthStateChanged가 이 UID를 다시 처리하지 않도록
+ sessionStorage.setItem('auth_processed_uid', userCredential.user.uid);

// 6. returnUrl 결정 (state > localStorage > '/')
```

---

### 수정 3: React Query 설정 (선택)

```diff
// src/lib/react-query.ts

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
+     refetchOnWindowFocus: false,  // ✅ 탭 포커스 시 리페칭 방지
+     refetchOnMount: false,        // ✅ 마운트 시 리페칭 방지 (로그인 직후)
    },
  },
})
```

---

## 📊 예상 개선 효과

| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| 로그인 시간 | 3-5초 | 1-2초 | ~60% 빠름 |
| 깜빡임 횟수 | 2-3회 | 0회 | -100% |
| Token 갱신 시간 | 600ms | 50ms | ~92% 빠름 |
| 불필요한 리렌더링 | 3-4회 | 1회 | -75% |

---

## 🧪 검증 방법

### Test 1: 깜빡임 확인

```
1. Incognito → https://live.ur-team.com
2. 카카오 로그인
3. Console 확인:
   ✅ [KakaoCallback] ✅ Store 업데이트 완료
   ✅ [AuthKR] ⏩ Already processed, skip: kakao_473531250
   ❌ [AuthKR] ✅ accessToken 저장 완료 (나오면 안 됨 - 중복!)
   
4. 화면 관찰:
   ✅ 깜빡임 없이 부드럽게 전환
   ✅ 로딩 스피너 1회만 표시
```

---

### Test 2: 속도 확인

```
1. Network Tab에서 Performance 기록
2. 카카오 로그인 클릭부터 메인 페이지까지 시간 측정
3. Console Timeline 확인:
   
   Before:
   0ms:  Kakao OAuth 시작
   1000ms: /api/auth/kakao/callback → 200 OK
   1600ms: getIdToken(true) → 완료 (600ms 소요)
   2200ms: onAuthStateChanged 감지
   2800ms: getIdToken(false) → 완료 (50ms 소요)
   3000ms: 메인 페이지 렌더링 완료
   
   After:
   0ms:  Kakao OAuth 시작
   1000ms: /api/auth/kakao/callback → 200 OK
   1050ms: getIdToken(false) → 완료 (50ms 소요)  ✅ 빠름!
   1100ms: sessionStorage.setItem('auth_processed_uid')
   1200ms: onAuthStateChanged 감지 → 스킵  ✅ 중복 방지!
   1300ms: 메인 페이지 렌더링 완료  ✅ 1.7초 단축!
```

---

## 🎯 우선순위

### 🔴 즉시 적용 (필수)
1. ✅ useAuthKR.ts: 중복 처리 방지 (sessionStorage 플래그)
2. ✅ KakaoCallbackPage.tsx: `getIdToken(false)` 사용
3. ✅ KakaoCallbackPage.tsx: sessionStorage 플래그 설정

### 🟡 추후 개선 (선택)
4. React Query: refetchOnWindowFocus/Mount 비활성화
5. 로딩 상태 UI 개선 (Skeleton UI 추가)

---

## 📝 최종 체크리스트

- [ ] useAuthKR.ts 수정 (중복 방지)
- [ ] KakaoCallbackPage.tsx 수정 (토큰 캐시 + 플래그)
- [ ] 로컬 테스트 (깜빡임 확인)
- [ ] 빌드 & 배포
- [ ] Production 테스트 (속도 측정)

---

**작성 시간**: 2026-03-19 07:50 UTC  
**예상 개선 시간**: ~60% (3-5초 → 1-2초)  
**예상 작업 시간**: 10분
