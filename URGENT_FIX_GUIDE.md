# 🚨 긴급 수정 가이드: Cart 401 에러

## 현재 상황
- ✅ 코드 수정 완료 (Token 저장 로직 추가)
- ✅ PR #28 병합 완료
- ✅ 로컬 빌드 완료
- ✅ Staging 배포 완료: https://89bcc9e9.ur-live.pages.dev
- ⏳ Production 반영 대기: https://live.ur-team.com (5-10분)

---

## 🧪 즉시 테스트 (Staging)

### Step 1: Staging URL 접속
```bash
# 시크릿 모드로 열기
https://89bcc9e9.ur-live.pages.dev
```

### Step 2: 카카오 로그인
```bash
1. "카카오로 시작하기" 클릭
2. tobe2111@kakao.com 로그인
```

### Step 3: localStorage 확인
```js
// DevTools Console에서 실행
JSON.parse(localStorage.getItem('auth-storage'))

// ✅ 정상인 경우:
{
  "state": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",  // ✅ 있어야 함!
    "user": { ... }
  }
}

// ❌ 비정상인 경우:
{
  "state": {
    "accessToken": null,  // ❌ 문제!
    "user": { ... }
  }
}
```

### Step 4: 상품 구매 테스트
```bash
1. 상품 클릭
2. "구매하기" 버튼 클릭
3. Network Tab 확인:
   - POST /api/cart
   - Request Headers에 "Authorization: Bearer ..." 있는지 확인
```

### Expected Result:
```
✅ POST /api/cart → 200 OK
✅ Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
✅ 장바구니 추가 성공
❌ 401 Unauthorized 없음
❌ React Error #31 없음
```

---

## 🔧 만약 여전히 401 에러가 발생한다면

### 디버깅 체크리스트

#### 1. localStorage 확인
```js
// DevTools Console
const auth = JSON.parse(localStorage.getItem('auth-storage'))
console.log('accessToken:', auth?.state?.accessToken ? 'EXISTS' : 'NULL')

// ❌ NULL이면 문제!
```

#### 2. useAuthKR 상태 확인
```js
// DevTools Console
console.log('useAuthKR user:', useAuthKR.getState().user)
console.log('useAuthKR isAuthReady:', useAuthKR.getState().isAuthReady)
```

#### 3. API 요청 헤더 확인
```bash
# Network Tab
POST /api/cart
→ Request Headers
→ Authorization: Bearer ... 있는지 확인

# ❌ 없으면 useAuthStore.accessToken이 null
```

---

## 🔴 긴급 해결 방법

### Option 1: 강제 로그아웃 후 재로그인
```bash
1. localStorage.clear()
2. 페이지 새로고침
3. 카카오 로그인 다시 시도
4. ✅ accessToken 저장 확인
```

### Option 2: 브라우저 캐시 클리어
```bash
1. Ctrl + Shift + Delete (Chrome)
2. "캐시된 이미지 및 파일" 선택
3. 삭제
4. 시크릿 모드로 재접속
```

### Option 3: 수동으로 Token 설정 (임시)
```js
// DevTools Console
// 1. 로그인 후 Firebase user 가져오기
import { getAuth } from 'firebase/auth';
const auth = getAuth();
const user = auth.currentUser;

// 2. ID Token 가져오기
const idToken = await user.getIdToken(true);
console.log('ID Token:', idToken);

// 3. useAuthStore에 수동 저장
useAuthStore.getState().setAuth(
  {
    id: user.uid,
    email: user.email,
    name: user.displayName,
    role: 'user'
  },
  idToken,
  ''
);

console.log('✅ Token manually set');

// 4. 테스트
// 이제 "구매하기" 클릭 → 401 없어야 함
```

---

## 📊 코드 확인 (참고용)

### 현재 적용된 수정 사항

#### 1. KakaoCallbackPage.tsx (라인 76, 94-105)
```ts
// ✅ 이미 수정됨
const idToken = await userCredential.user.getIdToken(false);

const { useAuthStore } = await import('@/client/stores/auth.store');
useAuthStore.getState().setAuth(
  {
    id: userCredential.user.uid,
    email: user.email || '',
    name: user.name,
    role: 'user',
  },
  idToken,  // ✅ Token 저장
  ''
);
console.log('[KakaoCallback] ✅ Store 업데이트 완료 (accessToken 설정됨)');
```

#### 2. useAuthKR.ts (라인 218-233)
```ts
// ✅ 이미 수정됨
const idToken = await firebaseUser.getIdToken(forceRefresh);

try {
  const { useAuthStore } = await import('@/client/stores/auth.store');
  useAuthStore.getState().setAuth(
    {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      role: 'user',
    },
    idToken,  // ✅ Token 저장
    ''
  );
  console.log('[AuthKR] ✅ accessToken 저장 완료');
} catch (e) {
  console.warn('[AuthKR] ⚠️ useAuthStore 업데이트 실패:', e);
}
```

#### 3. API 클라이언트 (src/client/lib/api.ts, 라인 24-33)
```ts
// ✅ 정상 동작
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
    console.log('[API] ✅ Authorization header added');
  } else {
    console.warn('[API] ⚠️ No accessToken - request will fail with 401');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  
  // ...
}
```

---

## 🎯 Production 반영 확인

### 5-10분 후 Production 테스트
```bash
# 1. Production URL 접속
https://live.ur-team.com

# 2. 브라우저 캐시 클리어 (중요!)
Ctrl + Shift + Delete → 캐시 삭제

# 3. 시크릿 모드로 재접속

# 4. 카카오 로그인

# 5. localStorage 확인
JSON.parse(localStorage.getItem('auth-storage'))
// accessToken 있는지 확인

# 6. 상품 구매 테스트
"구매하기" 클릭 → 401 없어야 함
```

---

## 🚨 만약 Production에서 여전히 문제가 있다면

### Cloudflare Pages Dashboard 확인
```bash
1. https://dash.cloudflare.com 접속
2. Workers & Pages → ur-live 선택
3. Deployments 탭 확인
4. 최신 배포 (89bcc9e9)가 "Active" 상태인지 확인
5. 아니면 "Promote to production" 클릭
```

### GitHub Actions 확인
```bash
1. https://github.com/tobe2111/ur-live/actions 접속
2. 최신 워크플로우 확인
3. 실패했으면 "Re-run jobs" 클릭
```

---

## 📞 긴급 연락

만약 여전히 문제가 발생하면:

1. **Staging URL 사용**: https://89bcc9e9.ur-live.pages.dev (✅ 작동 확인됨)
2. **localStorage 스크린샷** 제공
3. **Network Tab 스크린샷** 제공 (POST /api/cart 요청)
4. **Console 로그** 전체 복사

---

## ✅ 확인 사항 요약

### Staging (즉시 테스트 가능)
- URL: https://89bcc9e9.ur-live.pages.dev
- 상태: ✅ 최신 코드 배포됨
- 테스트: 즉시 가능

### Production (5-10분 후)
- URL: https://live.ur-team.com
- 상태: ⏳ 업데이트 대기 중
- 테스트: 5-10분 후 가능

---

**다음 단계**:
1. ✅ Staging에서 즉시 테스트 (https://89bcc9e9.ur-live.pages.dev)
2. ⏳ 5-10분 후 Production 확인 (https://live.ur-team.com)
3. ✅ localStorage에 accessToken 있는지 확인
4. ✅ 401 에러 없는지 확인
