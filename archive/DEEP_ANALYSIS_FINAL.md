# 🔍 완전 재검토: 모든 가능한 문제점

## 🚨 발견된 문제들

### 1. **useEffect 의존성 배열 문제 (CRITICAL)**

**파일:** `src/contexts/AuthContext.tsx:358`
```typescript
}, [searchParams.get('firebase_token'), navigate])
```

**문제:**
- `searchParams.get('firebase_token')`를 **직접 호출**하고 있음
- 이 함수는 **매번 새로운 참조**를 반환
- React는 이를 **"값이 변경됨"**으로 판단
- → useEffect가 **무한 재실행**될 수 있음

**증거:**
- 로그에서 `[AuthContext] 🔍 URL 파라미터 처리 시작`이 여러 번 나타남
- 429 에러 발생 (중복 API 호출)

**수정:**
```typescript
// ❌ 잘못됨
}, [searchParams.get('firebase_token'), navigate])

// ✅ 올바름
const firebaseToken = searchParams.get('firebase_token')
}, [firebaseToken, navigate])
```

---

### 2. **signInWithCustomToken과 navigate의 경쟁 상태**

**파일:** `src/contexts/AuthContext.tsx:335-346`
```typescript
const userCredential = await signInWithCustomToken(auth, firebaseToken)
// ← 여기서 onAuthStateChanged가 트리거됨!

setTimeout(() => {
  navigate(returnUrl, { replace: true })  // ← 이것과 경쟁!
}, 500)
```

**흐름:**
1. `signInWithCustomToken` 성공
2. → `onAuthStateChanged` 트리거 (line 92)
3. → `setUser(firebaseUser)` 실행 (line 224)
4. → AuthContext 리렌더링
5. → UserProfilePage가 리렌더링
6. → `useEffect` 실행 → `navigate('/login')` 가능
7. 동시에 `setTimeout`의 `navigate(returnUrl)` 실행
8. → **리다이렉트 충돌**

---

### 3. **onAuthStateChanged의 async 함수 문제**

**파일:** `src/contexts/AuthContext.tsx:92`
```typescript
const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
  // ... 긴 async 작업들
  await firebaseUser.getIdToken()
  await firebaseUser.getIdTokenResult()
  await api.post('/api/auth/firebase/sync', ...)  // ← 시간 걸림
  
  setUser(firebaseUser)  // ← 한참 후에 실행
  setIsAuthReady(true)
})
```

**문제:**
- async 작업이 완료되기 **전에** 컴포넌트가 렌더링됨
- `isAuthReady === true`인데 `user === null`인 순간이 존재
- → 페이지가 "로그인 안 됨"으로 판단

---

### 4. **localStorage 타이밍 이슈 (여전히 존재)**

**순서:**
1. `onAuthStateChanged` 트리거 (line 92)
2. Custom Claims에서 `userId` 추출 (line 113)
3. `localStorage.setItem('user_id', ...)` (line 117)
4. **하지만** UserProfilePage의 `useEffect`는 이미 실행됨
5. → `getUserId() === null`
6. → `requireLogin()` 호출

---

### 5. **syncAttempted 상태 관리 문제**

**파일:** `src/contexts/AuthContext.tsx:56, 186`
```typescript
const [syncAttempted, setSyncAttempted] = useState(false)

// ...
} finally {
  setSyncAttempted(true)  // ← 한 번만 true
}
```

**문제:**
- `syncAttempted`는 **컴포넌트 생명주기 동안 한 번만** true로 설정
- 로그아웃 → 재로그인 시에도 sync가 **스킵**됨
- → user_id가 저장되지 않을 수 있음

---

### 6. **React Strict Mode 중복 실행 가능성**

**파일:** `src/main.tsx` (아마도)
```typescript
<React.StrictMode>
  <App />
</React.StrictMode>
```

**문제:**
- Dev 모드에서 useEffect가 **2번 실행**됨
- → API 호출도 2번 → Rate Limit 걸림
- → 429 에러 발생

---

## ✅ 해결 방안 (우선순위)

### Priority 1: useEffect 의존성 수정 (CRITICAL)
```typescript
// src/contexts/AuthContext.tsx
useEffect(() => {
  const firebaseToken = searchParams.get('firebase_token')
  // ...
}, [searchParams, navigate])  // ✅ searchParams 전체를 의존성으로
```

### Priority 2: navigate 경쟁 상태 제거
```typescript
const userCredential = await signInWithCustomToken(auth, firebaseToken)
console.log('[AuthContext] ✅ Firebase 로그인 성공:', userCredential.user.uid)

// ❌ navigate 제거: onAuthStateChanged에서 처리
// setTimeout(() => {
//   navigate(returnUrl, { replace: true })
// }, 500)
```

### Priority 3: onAuthStateChanged 동기화
```typescript
// setUser와 setIsAuthReady를 항상 함께 실행
setUser(firebaseUser)
setUserRole(role || 'user')
setIsAuthReady(true)  // ← 여기로 이동
```

### Priority 4: syncAttempted를 uid별로 관리
```typescript
const [syncAttemptedUids, setSyncAttemptedUids] = useState<Set<string>>(new Set())

if (!syncAttemptedUids.has(firebaseUser.uid)) {
  // sync 로직
  setSyncAttemptedUids(prev => new Set(prev).add(firebaseUser.uid))
}
```

### Priority 5: user_id를 즉시 설정 (이미 완료)
```typescript
// ✅ 이미 구현됨
const userIdFromClaims = idTokenResult.claims.userId
if (userIdFromClaims) {
  localStorage.setItem('user_id', userIdFromClaims.toString())
}
```

---

## 🎯 예상 효과

### Before (현재)
```
1. URL 파라미터 처리 useEffect 실행
2. searchParams.get() 호출 → 새 참조 반환
3. useEffect 재실행
4. signInWithCustomToken 중복 호출
5. onAuthStateChanged 여러 번 트리거
6. API sync 중복 호출 → 429
7. navigate 경쟁 상태 → 무한 리다이렉트
```

### After (수정 후)
```
1. URL 파라미터 처리 useEffect 한 번만 실행
2. signInWithCustomToken 한 번만 호출
3. onAuthStateChanged 한 번만 트리거
4. user_id 즉시 저장
5. navigate 충돌 없음
6. 페이지 정상 렌더링
```

---

## 📋 수정 체크리스트

- [ ] useEffect 의존성 배열 수정
- [ ] navigate 중복 제거
- [ ] setIsAuthReady 위치 조정
- [ ] syncAttempted uid별 관리
- [ ] React Strict Mode 확인
- [ ] 빌드 & 테스트
- [ ] 배포

---

## 🔬 디버그 로그 추가 권장

```typescript
console.log('[AuthContext] 🔍 useEffect 트리거 카운트:', ++effectCounter)
console.log('[AuthContext] 🔍 onAuthStateChanged 카운트:', ++authChangeCounter)
console.log('[AuthContext] 🔍 searchParams:', searchParams.toString())
```
