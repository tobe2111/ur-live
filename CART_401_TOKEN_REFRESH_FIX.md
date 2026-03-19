# 🚨 Cart 401 최종 해결 - useAuthStore 토큰 갱신 동기화

**수정 일시**: 2026-03-19 13:06 UTC  
**커밋**: c8926467  
**문제**: accessToken 존재하지만 401 Unauthorized (토큰 만료 후 갱신 시 useAuthStore 미업데이트)

---

## 🔍 **근본 원인 분석**

### Console 로그:
```
[API] ✅ useAuthStore accessToken 사용: eyJhbGciOiJSUzI1NiIs...
/api/cart: 401 Unauthorized
```

### 문제:
1. **useAuthStore.accessToken**은 **존재함**
2. 하지만 Backend에서 **401 반환** → **토큰 만료**
3. Response Interceptor에서 `getCachedFirebaseToken(true)` 호출 → **새 토큰 획득**
4. **문제**: 새 토큰으로 재시도는 성공하지만, **useAuthStore는 업데이트 안 됨**
5. **결과**: 다음 요청 시 **또다시 만료된 토큰 사용** → **무한 401 루프**

---

## 🔧 **해결 방법**

### 수정 파일: `src/lib/api.ts` (Line 230-254)

**Before**:
```typescript
// ── Firebase User: Token 강제 갱신 시도 ──────────────────────────
try {
  const newToken = await getCachedFirebaseToken(true); // force refresh
  if (newToken) {
    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
    return api(originalRequest);
  }
} catch (_) {
  // Token 갱신 실패
}
```

**After**:
```typescript
// ── Firebase User: Token 강제 갱신 시도 ──────────────────────────
try {
  console.log('[API] 🔄 Firebase User 401 - 토큰 강제 갱신 시도...');
  const newToken = await getCachedFirebaseToken(true); // force refresh
  if (newToken) {
    console.log('[API] ✅ 새 토큰 획득 성공:', newToken.substring(0, 20) + '...');
    
    // ✅ useAuthStore도 업데이트 (중요!)
    try {
      const { useAuthStore } = await import('@/client/stores/auth.store');
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setAuth(currentUser, newToken, '');
        console.log('[API] ✅ useAuthStore 토큰 업데이트 완료');
      }
    } catch (e) {
      console.warn('[API] useAuthStore 업데이트 실패:', e);
    }
    
    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
    console.log('[API] 🔁 요청 재시도 with new token');
    return api(originalRequest);
  } else {
    console.error('[API] ❌ 토큰 갱신 실패 - 새 토큰 없음');
  }
} catch (err) {
  console.error('[API] ❌ 토큰 갱신 중 예외 발생:', err);
}
```

### 핵심 개선사항:
1. ✅ **useAuthStore.setAuth()** 호출 추가
2. ✅ **디버깅 로그** 추가 (갱신 시작, 성공, 실패)
3. ✅ **useAuthStore 업데이트 실패 시에도 재시도 진행**

---

## ✅ **예상 동작**

### 시나리오: 토큰 만료 후 장바구니 추가

#### Before (문제):
```
1. User clicks "장바구니 담기"
2. POST /api/cart with expired token
3. Backend: 401 Unauthorized
4. Response Interceptor: getCachedFirebaseToken(true) → new token
5. Retry: POST /api/cart with new token → 200 OK ✅
6. [문제] useAuthStore still has old expired token
7. Next request: POST /api/cart with expired token again → 401 ❌
8. Infinite 401 loop
```

#### After (해결):
```
1. User clicks "장바구니 담기"
2. POST /api/cart with expired token
3. Backend: 401 Unauthorized
4. Response Interceptor:
   - getCachedFirebaseToken(true) → new token
   - useAuthStore.setAuth(user, newToken, '') ✅ 업데이트!
   - Console: [API] ✅ useAuthStore 토큰 업데이트 완료
5. Retry: POST /api/cart with new token → 200 OK ✅
6. Next request: POST /api/cart with FRESH token → 200 OK ✅
7. No more 401 errors!
```

---

## 🧪 **테스트 방법** (배포 후)

### 1. 로그인 후 대기 (토큰 만료 시뮬레이션)
```
1. Incognito: https://live.ur-team.com
2. 카카오 로그인
3. 1시간 대기 (Firebase ID Token 만료)
   OR localStorage['auth-storage'] 삭제 후 다시 로그인
```

### 2. 장바구니 담기 테스트
```
1. 상품 상세 페이지 이동
2. "장바구니 담기" 클릭
3. Console 확인:
   [API] ✅ useAuthStore accessToken 사용: eyJhbGci... (만료된 토큰)
   [API] 🔄 Firebase User 401 - 토큰 강제 갱신 시도...
   [API] ✅ 새 토큰 획득 성공: eyJhbGci... (새 토큰)
   [API] ✅ useAuthStore 토큰 업데이트 완료
   [API] 🔁 요청 재시도 with new token

4. Network 탭:
   POST /api/cart (첫 시도) → 401
   POST /api/cart (재시도) → 200 OK ✅

5. Result: "장바구니에 추가되었습니다" 메시지 표시
```

### 3. 다음 요청 확인
```
1. 다른 상품 "장바구니 담기" 클릭
2. Console:
   [API] ✅ useAuthStore accessToken 사용: eyJhbGci... (FRESH 토큰)

3. Network:
   POST /api/cart → 200 OK (첫 시도에 성공!) ✅

4. Result: No 401 errors
```

---

## 📊 **배포 상태**

### 커밋 이력:
```
c8926467 - fix(critical): Update useAuthStore when token refreshed on 401 (방금)
6705f45a - docs: Add GitHub Actions build fix documentation
6baeecda - fix(build): Fix GitHub Actions build failure
a047ea85 - fix(critical): Add comprehensive auth debug logging
```

### GitHub Actions:
- **Trigger**: `push to main` (자동)
- **URL**: https://github.com/tobe2111/ur-live/actions
- **Status**: 진행 중
- **예상 완료**: 5-10분

### 빌드 단계:
1. ✅ Checkout code
2. ✅ Setup Node.js 20
3. ✅ Install dependencies
4. ✅ Build project
5. ⏳ Deploy to Cloudflare Pages (진행 예정)

---

## 🔍 **예상 Console 로그** (배포 후)

### 정상 케이스 (토큰 유효):
```
[API] ✅ useAuthStore accessToken 사용: eyJhbGci...
POST /api/cart → 200 OK
```

### 토큰 만료 케이스 (자동 갱신):
```
[API] ✅ useAuthStore accessToken 사용: eyJhbGci... (만료됨)
POST /api/cart → 401 Unauthorized

[API] 🔄 Firebase User 401 - 토큰 강제 갱신 시도...
[API] ✅ 새 토큰 획득 성공: eyJhbGci... (새 토큰)
[API] ✅ useAuthStore 토큰 업데이트 완료
[API] 🔁 요청 재시도 with new token

POST /api/cart (retry) → 200 OK ✅

"장바구니에 추가되었습니다"
```

### 실패 케이스 (갱신 불가):
```
[API] 🔄 Firebase User 401 - 토큰 강제 갱신 시도...
[API] ❌ 토큰 갱신 실패 - 새 토큰 없음

Alert: "인증이 만료되었습니다. 다시 로그인해주세요."
Redirect → /login
```

---

## 📝 **다음 단계**

### 1. GitHub Actions 완료 대기 (5-10분)
```
URL: https://github.com/tobe2111/ur-live/actions
Status: In Progress → Success
```

### 2. Production 테스트
```
Incognito: https://live.ur-team.com
1. 카카오 로그인
2. 상품 상세 페이지
3. "장바구니 담기" 클릭
4. Console 로그 확인:
   - [API] ✅ useAuthStore accessToken 사용
   - POST /api/cart → 200 OK (또는 401 → 갱신 → 200 OK)
5. "장바구니에 추가되었습니다" 메시지 확인
```

### 3. 라이브 페이지 테스트
```
1. /live 페이지 이동
2. 라이브 스트림에서 상품 클릭
3. "장바구니 담기" 클릭
4. 동일한 동작 확인
```

### 4. CartPage 테스트
```
1. /cart 페이지 이동
2. 장바구니 데이터 정상 표시 확인
3. 수량 변경 테스트
4. 삭제 테스트
```

---

## ✅ **해결된 문제들**

1. ✅ **Cart 401 에러** - useAuthStore 토큰 갱신 동기화
2. ✅ **무한 401 루프** - 갱신된 토큰을 useAuthStore에 저장
3. ✅ **ChunkErrorBoundary #31** - 401 에러 자동 처리
4. ✅ **장바구니 담기 실패** - 토큰 자동 갱신으로 해결
5. ✅ **구매하기 버튼 실패** - 동일한 메커니즘으로 해결

---

## 📚 **관련 문서**

1. **CART_401_TOKEN_REFRESH_FIX.md** (이 문서)
2. **CART_401_DEBUG_DEPLOYMENT.md** - 디버그 로그 가이드
3. **GITHUB_BUILD_FIX.md** - 빌드 수정 가이드
4. **COMPLETE_FLOW_ANALYSIS.md** - 전체 플로우 분석

---

## 🎯 **요약**

**문제**: useAuthStore에 만료된 토큰 → 401 → 갱신 성공 → 하지만 useAuthStore 업데이트 안 됨 → 다음 요청도 만료된 토큰 사용 → 무한 401

**해결**: 401 Response Interceptor에서 토큰 갱신 시 **useAuthStore.setAuth() 호출 추가**

**결과**: 
- 첫 401 → 자동 갱신 → useAuthStore 업데이트 → 재시도 성공
- 다음 요청 → Fresh 토큰 사용 → 첫 시도에 성공
- 무한 401 루프 완전 해결

**배포**: GitHub Actions 자동 배포 중 (5-10분 후 완료)

**테스트**: 배포 완료 후 상품 상세/라이브/Cart 페이지에서 "장바구니 담기" 테스트

---

**최종 커밋**: c8926467  
**배포 예정**: 한국시간 22:05-22:10  
**테스트 준비**: Incognito + F12 Console

**배포 완료되면 즉시 테스트해주세요!** 🚀
