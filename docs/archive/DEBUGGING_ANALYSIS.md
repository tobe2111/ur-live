# 🚨 인증 문제 전체 분석 및 해결 방안

## 📋 문제 요약
- **증상**: 로그인 성공 후 장바구니 추가 시 `POST /api/cart` → 401 Unauthorized → 무한 로그인 리다이렉트
- **원인 가설**: Custom Token이 ID Token으로 교환되지 않고 API 요청에 그대로 사용됨

## 🔍 전체 인증 흐름 분석

### 1️⃣ 정상 인증 흐름 (예상)
```
1. 카카오 로그인 성공
2. 서버가 Custom Token 생성 → URL에 추가 (?firebase_token=...)
3. 클라이언트가 URL에서 Custom Token 읽음
4. signInWithCustomToken(customToken) 호출
5. Firebase Auth가 Custom Token → ID Token 교환
6. ID Token을 localStorage에 저장
7. API 호출 시 auth.currentUser.getIdToken() → ID Token 획득
8. Authorization: Bearer <ID_Token> 헤더 추가
9. 서버가 ID Token 검증 성공 → 200 OK
```

### 2️⃣ 실제 발생 가능한 문제들

#### 🔴 Problem 1: Custom Token이 localStorage에 저장됨
**증상**: 
- `signInWithCustomToken()` 후 ID Token 교환이 완료되기 전에 Custom Token을 저장
- API 호출 시 Custom Token이 Authorization 헤더에 포함됨
- 서버가 Custom Token 검증 시도 → 실패 (issuer/audience 불일치)

**원인**:
```typescript
// AuthContext.tsx - WRONG PATTERN
localStorage.setItem('firebase_token', customToken);  // ❌ Custom Token 저장!
await signInWithCustomToken(auth, customToken);
```

**해결**:
```typescript
// AuthContext.tsx - CORRECT PATTERN
const userCredential = await signInWithCustomToken(auth, customToken);
const idToken = await userCredential.user.getIdToken();  // ✅ ID Token 획득
localStorage.setItem('firebase_token', idToken);  // ✅ ID Token 저장
```

**상태**: ✅ **이미 수정됨** (AuthContext.tsx 라인 79, 242, 272)

---

#### 🔴 Problem 2: auth.currentUser가 null (타이밍 문제)
**증상**:
- 페이지 로드 직후 API 호출 시 `auth.currentUser === null`
- API 인터셉터가 토큰을 첨부하지 못함
- Authorization 헤더 없이 요청 → 401 Unauthorized

**원인**:
```typescript
// api.ts - RACE CONDITION
if (auth.currentUser) {
  const token = await auth.currentUser.getIdToken();
  // ...
} else {
  console.warn('No currentUser');  // ⚠️ Firebase 초기화 전 호출
}
```

**해결**:
```typescript
// api.ts - WAIT FOR AUTH
if (!auth.currentUser) {
  await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
    setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, 3000);  // 3초 타임아웃
  });
}
```

**상태**: ✅ **이미 수정됨** (api.ts 라인 74-93)

---

#### 🔴 Problem 3: URL 파라미터의 Custom Token이 제거되지 않음
**증상**:
- URL에 `?firebase_token=<custom_token>` 남아있음
- 페이지 새로고침 시 Custom Token을 다시 읽어서 저장 시도
- Custom Token이 재사용됨

**원인**:
```typescript
// AuthContext.tsx - URL 파라미터 제거 로직 누락
const params = new URLSearchParams(window.location.search);
const customToken = params.get('firebase_token');
// ... 처리 후 URL에서 제거하지 않음 ❌
```

**해결**:
```typescript
// AuthContext.tsx - URL 파라미터 제거
const params = new URLSearchParams(window.location.search);
const customToken = params.get('firebase_token');
// ... 처리 완료
params.delete('firebase_token');  // ✅ URL에서 제거
window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
```

**상태**: ✅ **이미 수정됨** (AuthContext.tsx 라인 75-76)

---

#### 🔴 Problem 4: JWKS 캐시가 stale 상태
**증상**:
- 서버가 Google JWKS에서 public key를 캐싱
- Firebase가 키 순환(rotation) 시 캐시된 키가 만료됨
- 유효한 ID Token임에도 서명 검증 실패 → 401

**원인**:
```typescript
// firebase-token-verify.ts - 캐시 무효화 로직 부족
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
// Worker 인스턴스 수명 동안 캐시 유지 → stale 가능성 ⚠️
```

**해결**:
```typescript
// firebase-token-verify.ts - kid not found 시 캐시 무효화
if (error instanceof errors.JWTInvalid && error.message.includes('kid')) {
  invalidateJWKSCache();  // ✅ 캐시 리셋
  console.warn('JWKS cache invalidated → retry possible');
}
```

**상태**: ✅ **이미 구현됨** (firebase-token-verify.ts 라인 142-145)

---

#### 🔴 Problem 5: Firebase Project ID 불일치
**증상**:
- 서버가 검증 시 잘못된 Project ID 사용
- `aud` (audience) 검증 실패 → 401

**확인 방법**:
```bash
# 환경 변수 확인
echo $FIREBASE_PROJECT_ID

# 토큰 디코딩 (jwt.io)
# payload.aud === Project ID 여야 함
{
  "iss": "https://securetoken.google.com/urteam-live-commerce-5b284",
  "aud": "urteam-live-commerce-5b284",  // ← 이게 맞아야 함
  "sub": "kakao_4735311250"
}
```

**해결**:
```typescript
// index.tsx - 환경 변수 사용
const projectId = c.env.FIREBASE_PROJECT_ID || 'urteam-live-commerce-5b284';
await verifyFirebaseIdToken(token, projectId);
```

**상태**: ✅ **이미 구현됨** (index.tsx 라인 527)

---

#### 🟡 Problem 6: 서버 로그가 클라이언트에 전달되지 않음
**증상**:
- Cloudflare Workers console.log는 클라이언트 브라우저에 출력되지 않음
- 401 발생 시 서버 측 정확한 실패 이유를 알 수 없음
- 클라이언트는 "Authentication failed" 같은 일반 메시지만 받음

**원인**:
```typescript
// index.tsx - BEFORE
if (!auth) {
  return c.json({ 
    success: false, 
    error: 'Authentication failed'  // ❌ 상세 정보 없음
  }, 401);
}
```

**해결**:
```typescript
// index.tsx - AFTER (현재 배포 중)
if (!auth || auth.userId === 0) {
  const errorDetails = auth?.errorDetails || {
    code: 'AUTH_FAILED',
    message: 'Token verification failed'
  };
  
  return c.json({ 
    success: false, 
    error: errorDetails.message,
    code: errorDetails.code,  // ✅ 에러 코드 추가
    debug: {  // ✅ 디버그 정보 추가
      tokenProvided: !!authHeader,
      tokenLength: authHeader?.length || 0,
      ...errorDetails.tokenInfo
    }
  }, 401);
}
```

**상태**: 🚀 **현재 배포 중** (Commit: 84731cd)

---

## 🔧 적용된 수정 사항 (우선순위 순)

### ✅ Critical Fix 1: Custom Token 검증 로직 추가
**파일**: `src/index.tsx` (라인 497-519)
```typescript
// 토큰 페이로드 디코딩 후 issuer 검증
if (payload.iss && payload.iss.includes('iam.gserviceaccount.com')) {
  console.error('CUSTOM TOKEN DETECTED!');
  return {
    userId: 0,
    userType: '',
    errorDetails: {
      code: 'CUSTOM_TOKEN_DETECTED',
      message: 'Custom Token should be exchanged for ID Token on client',
      tokenInfo: { iss: payload.iss, aud: payload.aud }
    }
  } as any;
}
```

### ✅ Critical Fix 2: Token Verification 에러 상세 정보 반환
**파일**: `src/index.tsx` (라인 564-574)
```typescript
} catch (firebaseError) {
  const errorInfo = parseVerifyError(firebaseError);
  return {
    userId: 0,
    userType: '',
    errorDetails: {
      code: errorInfo.code,  // TOKEN_EXPIRED, INVALID_SIGNATURE, etc.
      message: errorInfo.message,
      tokenInfo: { length: token.length, preview: token.substring(0, 30) }
    }
  } as any;
}
```

### ✅ Critical Fix 3: 클라이언트 에러 표시 강화
**파일**: `src/lib/api.ts` (라인 186-204)
```typescript
// 서버 에러 상세 정보 추출 및 표시
console.error('[API] 🚨 Firebase auth failed (401)');
console.error('[API] 📊 Server error details:', errorData);

if (errorData?.code) {
  console.error('[API] 🔍 Error Code:', errorData.code);
  console.error('[API] 💬 Error Message:', errorData.error);
  if (errorData.debug) {
    console.error('[API] 🐛 Debug Info:', errorData.debug);
  }
}

const errorMsg = errorData?.error || 'Authentication failed';
const errorCode = errorData?.code || 'UNKNOWN';
alert(`인증 실패 (${errorCode})\n\n${errorMsg}\n\n다시 로그인해주세요.`);
```

---

## 🧪 테스트 시나리오

### 시나리오 1: Custom Token 감지 테스트
**목적**: 서버가 Custom Token을 올바르게 거부하는지 확인

1. 브라우저 개발자 도구 열기
2. `localStorage.clear(); sessionStorage.clear();`
3. 카카오 로그인 시도
4. **예상 결과**:
   - 콘솔에 Custom Token 감지 경고 없음
   - ID Token 페이로드: `iss: https://securetoken.google.com/urteam-live-commerce-5b284`
   
**실패 시**:
```
[API] 🚨 Firebase auth failed (401)
[API] 🔍 Error Code: CUSTOM_TOKEN_DETECTED
[API] 💬 Error Message: Custom Token should be exchanged for ID Token on client
Alert: 인증 실패 (CUSTOM_TOKEN_DETECTED)
```

---

### 시나리오 2: 토큰 만료 테스트
**목적**: 만료된 ID Token이 올바르게 처리되는지 확인

1. 로그인 후 1시간 대기 (ID Token 만료)
2. 장바구니 추가 시도
3. **예상 결과**:
   - Firebase가 자동으로 토큰 갱신
   - 또는 401 → `TOKEN_EXPIRED` 에러 코드

**실패 시**:
```
[API] 🔍 Error Code: TOKEN_EXPIRED
[API] 💬 Error Message: Token has expired. Please login again.
```

---

### 시나리오 3: JWKS 캐시 문제 테스트
**목적**: JWKS 캐시 무효화가 작동하는지 확인

1. 로그인 성공 후 정상 API 호출
2. Firebase 키 순환 발생 (자동, 불규칙적)
3. 다음 API 호출 시도
4. **예상 결과**:
   - 첫 요청 실패 (INVALID_KID)
   - 캐시 무효화 로그: `JWKS cache invalidated → retry possible`
   - 재시도 성공 (새 JWKS 로드)

**실패 시**:
```
[API] 🔍 Error Code: INVALID_KID
[API] 💬 Error Message: Public key not found for token
```

---

### 시나리오 4: auth.currentUser null 테스트
**목적**: API 인터셉터가 Firebase 초기화를 기다리는지 확인

1. 로그인 후 페이지 강제 새로고침 (Cmd+R)
2. 새로고침 완료 직후 장바구니 추가
3. **예상 결과**:
   - 콘솔: `[API] ⏳ Waiting for Firebase Auth initialization...`
   - 3초 이내 사용자 인증 완료
   - 토큰 첨부 성공

**실패 시**:
```
[API] ⚠️ No Firebase user for protected API after waiting: /api/cart
[API] 🔍 Error Code: NO_AUTH_HEADER
[API] 💬 Error Message: Missing Authorization header
```

---

## 📊 에러 코드 참조표

| 에러 코드 | 의미 | 원인 | 해결 방법 |
|---------|------|------|----------|
| `CUSTOM_TOKEN_DETECTED` | Custom Token이 API 요청에 사용됨 | AuthContext에서 ID Token 교환 실패 | AuthContext.tsx 로직 확인 |
| `TOKEN_EXPIRED` | ID Token 만료 | 1시간 경과 | Firebase 자동 갱신 확인 |
| `INVALID_SIGNATURE` | 토큰 서명 검증 실패 | 손상된 토큰 또는 JWKS 문제 | 재로그인 또는 JWKS 캐시 무효화 |
| `INVALID_ISSUER` | issuer 불일치 | 잘못된 Firebase 프로젝트 | Project ID 확인 |
| `INVALID_AUDIENCE` | audience 불일치 | 잘못된 Project ID | 환경 변수 FIREBASE_PROJECT_ID 확인 |
| `INVALID_KID` | 공개 키(kid) 찾을 수 없음 | JWKS 캐시 문제 | 자동 캐시 무효화 후 재시도 |
| `TOKEN_NOT_YET_VALID` | 토큰이 미래에 발급됨 | 시스템 시계 오차 | 시스템 시간 동기화 |
| `NO_AUTH_HEADER` | Authorization 헤더 누락 | auth.currentUser null 또는 API 인터셉터 문제 | api.ts 인터셉터 로직 확인 |
| `AUTH_FAILED` | 일반 인증 실패 | 알 수 없는 이유 | 서버 로그 확인 필요 |

---

## 🚀 배포 정보

### Current Deployment
- **Commit**: `84731cd` (2026-03-01 19:33 UTC)
- **Build Version**: `f525da763f9cdc41`
- **Worker Size**: 363.24 kB (+0.40 kB)
- **Deploy Time**: ~19:36-19:38 UTC (예상)

### Changes in This Deployment
1. ✅ Custom Token 감지 및 에러 반환
2. ✅ Token verification 에러 상세 정보 반환
3. ✅ 클라이언트 에러 표시 강화 (alert + console)
4. ✅ 서버 에러 디버그 정보 추가 (code, message, tokenInfo)

### Previous Deployments
- **68a3baf**: Custom Token 디버깅 로그 추가
- **3efbdfc**: API 인터셉터 auth.currentUser 대기 로직

---

## 📝 추가 확인 사항

### 1. Cloudflare Workers 환경 변수
```bash
# Cloudflare Dashboard에서 확인
FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
FIREBASE_PRIVATE_KEY=<service-account-private-key>
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@urteam-live-commerce-5b284.iam.gserviceaccount.com
```

### 2. Firebase 프로젝트 설정
- Project ID: `urteam-live-commerce-5b284`
- JWKS URL: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`

### 3. 클라이언트 토큰 저장 위치
```javascript
// localStorage에 저장되는 키
localStorage.getItem('firebase_token')  // ← ID Token만 저장되어야 함
localStorage.getItem('user_id')
localStorage.getItem('user_name')
localStorage.getItem('user_type')
```

---

## 🎯 다음 단계

### 배포 후 즉시 테스트
1. ✅ `localStorage.clear(); sessionStorage.clear(); location.reload();`
2. ✅ 카카오 로그인
3. ✅ 콘솔에서 토큰 페이로드 확인 (`iss`, `aud`)
4. ✅ 장바구니 추가 시도
5. ✅ Network 탭에서 `/api/cart` 요청 확인
   - Request Headers: `Authorization: Bearer <jwt>`
   - Response: 200 OK (성공) 또는 401 (에러 코드 확인)

### 401 발생 시 체크리스트
1. 📋 **에러 코드 확인**: Alert 팝업 또는 콘솔
2. 📋 **토큰 타입 확인**: jwt.io에서 디코딩
   - `iss`: `https://securetoken.google.com/...` (✅) vs `iam.gserviceaccount.com` (❌)
3. 📋 **토큰 만료 확인**: `exp` 필드 (현재 Unix timestamp와 비교)
4. 📋 **JWKS 캐시 문제**: `INVALID_KID` 에러 코드 확인
5. 📋 **Cloudflare Workers 로그**: Cloudflare Dashboard → Workers → Logs

### 최종 검증
- ✅ 장바구니 추가 → 200 OK
- ✅ 구매하기 버튼 → `/checkout` 이동 (401 없음)
- ✅ 로그인 상태 유지 (리다이렉트 루프 없음)

---

## 📌 중요 참고 자료

### Firebase ID Token vs Custom Token
| 속성 | ID Token | Custom Token |
|-----|---------|--------------|
| **issuer** | `https://securetoken.google.com/<project-id>` | `firebase-adminsdk-...@<project-id>.iam.gserviceaccount.com` |
| **audience** | `<project-id>` | `https://identitytoolkit.googleapis.com/...` |
| **용도** | API 인증 (Bearer Token) | Firebase Auth 로그인 (1회용) |
| **유효기간** | 1시간 | 사용 즉시 교환 (ID Token 획득) |
| **갱신** | Firebase SDK 자동 갱신 | 갱신 불가 (재발급 필요) |

### 링크
- **Live Site**: https://live.ur-team.com
- **GitHub Repo**: https://github.com/tobe2111/ur-live
- **Latest Commit**: https://github.com/tobe2111/ur-live/commit/84731cd
- **GitHub Actions**: https://github.com/tobe2111/ur-live/actions
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **JWT Debugger**: https://jwt.io

---

## 🏁 결론

**모든 가능성 있는 문제를 체계적으로 분석하고 수정했습니다:**

1. ✅ Custom Token 저장 방지
2. ✅ auth.currentUser null 대기 로직
3. ✅ URL 파라미터 제거
4. ✅ JWKS 캐시 무효화
5. ✅ Project ID 검증
6. ✅ **서버 에러 상세 정보 반환** (현재 배포 중)

**배포 후 테스트 시 확인할 사항:**
- 에러 코드가 명확하게 표시되는지 (`CUSTOM_TOKEN_DETECTED`, `TOKEN_EXPIRED`, etc.)
- Alert 팝업에 상세 메시지가 나오는지
- 콘솔에 서버 응답 전체가 로그되는지

**성공 기준:**
- `POST /api/cart` → 200 OK
- Authorization 헤더에 유효한 ID Token 포함
- 로그인 리다이렉트 루프 없음
- 에러 발생 시 정확한 에러 코드 표시

**실패 시 제공할 정보:**
1. Alert 팝업 스크린샷 (에러 코드 포함)
2. 콘솔 로그 전체 (빨간색 에러 포함)
3. Network 탭 스크린샷 (Authorization 헤더, Response 탭)
4. jwt.io에 토큰 디코딩한 페이로드 (iss, aud, exp)

---

**작성**: 2026-03-01 19:34 UTC  
**버전**: 1.0  
**상태**: 배포 진행 중 (Commit 84731cd)
