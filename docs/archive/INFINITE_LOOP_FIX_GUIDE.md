# 🚨 무한 로그인 루프 완전 해결 가이드

## ✅ 해결된 파일들

1. **`AuthContext.FIXED.tsx`** - loading 상태 추가, 중복 리다이렉트 제거
2. **`RouteGuards.tsx`** - ProtectedRoute, PublicRoute with loading 체크
3. **`App.FIXED.tsx`** - React Router v6 + Future Flags
4. **`LoginPage.FIXED.tsx`** - 중복 리다이렉트 로직 제거

---

## 🔧 적용 방법

### Step 1: 기존 파일 백업
```bash
cd /home/user/webapp/src
mv contexts/AuthContext.tsx contexts/AuthContext.OLD.tsx
mv App.tsx App.OLD.tsx
mv pages/LoginPage.tsx pages/LoginPage.OLD.tsx
```

### Step 2: 새 파일로 교체
```bash
mv contexts/AuthContext.FIXED.tsx contexts/AuthContext.tsx
mv App.FIXED.tsx App.tsx
mv pages/LoginPage.FIXED.tsx pages/LoginPage.tsx
```

### Step 3: RouteGuards 복사
```bash
# 이미 생성됨: src/components/auth/RouteGuards.tsx
```

---

## 🎯 무한 루프 원인 5가지 & 해결책

### ❌ 원인 1: **loading 상태 누락**

**문제 코드:**
```typescript
const { user } = useAuth()
if (!user) return <Navigate to="/login" /> // ← loading 체크 없음!
```

**해결 코드:**
```typescript
const { user, loading } = useAuth()
if (loading) return <LoadingSpinner />  // ✅ 1. loading 체크
if (!user) return <Navigate to="/login" />
```

---

### ❌ 원인 2: **useEffect dependency 배열 누락**

**문제 코드:**
```typescript
useEffect(() => {
  onAuthStateChanged(auth, setUser)
}) // ← 빈 배열 없음 → 매 렌더링마다 재등록!
```

**해결 코드:**
```typescript
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, setUser)
  return () => unsubscribe()
}, []) // ✅ 빈 배열: 마운트 시 한 번만
```

---

### ❌ 원인 3: **중복 리다이렉트 로직**

**문제 코드:**
```typescript
// AuthContext에서:
useEffect(() => {
  if (user) navigate('/') // ← 리다이렉트 1
}, [user])

// LoginPage에서:
useEffect(() => {
  if (user) navigate('/') // ← 리다이렉트 2 (중복!)
}, [user])
```

**해결 코드:**
```typescript
// ✅ AuthContext: 상태 관리만
// ✅ PublicRoute: 리다이렉트 로직 통합
<PublicRoute>
  <LoginPage />
</PublicRoute>
```

---

### ❌ 원인 4: **location.state 초기화 실패**

**문제 코드:**
```typescript
// 로그인 성공 후
navigate(from) // ← from이 /login이면 다시 /login으로...
```

**해결 코드:**
```typescript
const from = (location.state as any)?.from || '/'
if (from === '/login') {
  navigate('/', { replace: true }) // ✅ /login이면 홈으로
} else {
  navigate(from, { replace: true })
}
```

---

### ❌ 원인 5: **URL 파라미터 미제거**

**문제 코드:**
```typescript
useEffect(() => {
  const token = searchParams.get('firebase_token')
  if (token) {
    signInWithCustomToken(auth, token)
    // ← URL 파라미터를 제거하지 않음!
  }
}, [searchParams]) // ← searchParams가 계속 변경됨
```

**해결 코드:**
```typescript
useEffect(() => {
  const token = searchParams.get('firebase_token')
  if (token) {
    // ✅ 1. URL 파라미터 즉시 제거
    window.history.replaceState({}, '', window.location.pathname)
    
    // ✅ 2. 로그인 처리
    signInWithCustomToken(auth, token)
  }
}, [searchParams])
```

---

## 🔍 디버깅 체크리스트

### 1. **Console 로그 확인**

브라우저 콘솔에서 다음을 확인:

```
✅ [AuthContext] Render: { user: 'kakao_...', loading: false, ... }
✅ [ProtectedRoute] { user: 'kakao_...', loading: false, ... }
✅ [LoginPage] ✅ 이미 로그인됨
✅ [PublicRoute] ✅ 이미 로그인됨 → 리다이렉트: /
```

**❌ 문제 패턴:**
```
❌ [AuthContext] Render: { user: null, loading: true, ... }
❌ [ProtectedRoute] ❌ 미로그인 → /login 리다이렉트
❌ [PublicRoute] ✅ 미로그인 → 렌더링
❌ [AuthContext] Render: { user: 'kakao_...', loading: false, ... }
❌ [PublicRoute] ✅ 이미 로그인됨 → 리다이렉트: /
❌ [ProtectedRoute] ❌ 미로그인 → /login 리다이렉트
(무한 반복...)
```

---

### 2. **React DevTools 확인**

**AuthContext 상태:**
- `loading`: true → false로 변경되는지 확인
- `user`: null → User 객체로 변경되는지 확인
- `isAuthReady`: false → true로 변경되는지 확인

**리렌더링 횟수:**
- AuthProvider가 무한 리렌더링되는지 확인
- LoginPage가 마운트/언마운트 반복되는지 확인

---

### 3. **Network 탭 확인**

**API 호출:**
- `/api/cart`, `/api/shipping-addresses` 등이 401 반환하는지 확인
- 401 반환 시 → 서버에서 토큰 검증 실패 → 401 에러 핸들러가 /login으로 리다이렉트

**해결:**
```typescript
// api.ts에서 401 에러 핸들러 수정
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // ✅ 이미 로그인 페이지면 리다이렉트 안 함
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
```

---

## 🧪 테스트 시나리오

### Scenario 1: 직접 /login 접속

1. localStorage.clear()
2. 브라우저에서 `/login` 접속
3. **예상 결과:**
   - `loading: true` → 로딩 UI
   - `loading: false, user: null` → 로그인 폼 표시
   - ❌ 리다이렉트 없음

### Scenario 2: 카카오 로그인

1. `/login`에서 "카카오로 계속하기" 클릭
2. `/auth/kakao/sync/callback?firebase_token=...&userName=...`로 리다이렉트
3. **예상 결과:**
   - URL 파라미터 즉시 제거
   - Firebase 로그인 성공
   - `user: User` 상태 업데이트
   - PublicRoute가 `/`로 리다이렉트

### Scenario 3: 보호된 페이지 접속

1. 로그아웃 상태에서 `/profile` 접속
2. **예상 결과:**
   - ProtectedRoute가 `/login`으로 리다이렉트
   - `state: { from: '/profile' }` 전달
3. 로그인 성공
4. **예상 결과:**
   - `/profile`로 리다이렉트 (from 복원)

---

## 📦 주요 개선 사항 요약

| 개선 항목 | Before | After |
|---------|--------|-------|
| **loading 상태** | ❌ 없음 | ✅ 추가 |
| **onAuthStateChanged** | ❌ 매 렌더링마다 재등록 | ✅ 한 번만 등록 |
| **리다이렉트 로직** | ❌ AuthContext + LoginPage 중복 | ✅ RouteGuards로 통합 |
| **URL 파라미터** | ❌ 제거 안 함 | ✅ 즉시 제거 |
| **디버그 로그** | ❌ 부족 | ✅ 상세 |
| **Future Flags** | ❌ 없음 | ✅ v7 대비 |

---

## 🚀 최종 체크리스트

- [ ] `AuthContext.tsx` 교체 완료
- [ ] `RouteGuards.tsx` 추가 완료
- [ ] `App.tsx` 교체 완료
- [ ] `LoginPage.tsx` 교체 완료
- [ ] 빌드 오류 없음
- [ ] 콘솔에 무한 루프 로그 없음
- [ ] 로그인 → 홈 이동 정상
- [ ] 로그아웃 → 로그인 페이지 이동 정상
- [ ] 보호된 페이지 접근 → 로그인 → 복원 정상

---

## 🆘 여전히 문제가 있다면?

### 1. 콘솔 로그 전체 복사
```
[AuthContext] Render: ...
[ProtectedRoute] ...
[PublicRoute] ...
...
```

### 2. 현재 코드 공유
- AuthContext
- ProtectedRoute
- LoginPage

### 3. 에러 메시지 공유

**질문할 내용:**
- "무한 루프가 발생하는 정확한 URL 경로는?"
- "콘솔에 특정 로그가 몇 번 반복되나요?"
- "Network 탭에서 401 에러가 보이나요?"
