# 🚨 [긴급] Firebase Auth 401 Unauthorized 해결

## 📋 현재 상황

**에러:**
```
POST https://live.ur-team.com/api/auth/firebase/sync 401 (Unauthorized)
[AuthContext] ❌ D1 동기화 실패: AxiosError: Request failed with status code 401
```

**원인:**
- Firebase ID Token 검증 코드는 이미 수정됨 (`payload.sub` 사용)
- **하지만 프로덕션에 배포가 안 된 상태**

---

## ✅ 해결 방법

### 1. GitHub Actions 배포 확인 (필수)

**URL:** https://github.com/tobe2111/ur-live/actions

**확인 사항:**
- 최신 2개 workflow 실행 중
  - `eb7a74d` - "Trigger redeploy for Firebase Auth fix"
  - `0fb60c5` - "Add detailed logging for Firebase token verification"
- 예상 배포 시간: **10-15분**
- 상태: 🟡 진행 중 → 🟢 완료 대기

### 2. 배포 완료 후 테스트

**프로덕션 URL:** https://live.ur-team.com

**테스트 순서:**
1. 브라우저 캐시 삭제 (Ctrl+Shift+Delete)
2. 시크릿 모드로 접속
3. 카카오 로그인 시도
4. **콘솔 로그 확인:**

**✅ 성공 시 로그:**
```
[Firebase Sync] Syncing user to D1: {firebaseUid: "kakao_4735311250", email: null}
[Firebase] ✅ Token verified: {sub: "kakao_4735311250", email: null}
[Firebase Sync] Token decoded: {
  hasDecoded: true, 
  decodedSub: "kakao_4735311250", 
  firebaseUid: "kakao_4735311250",
  match: true
}
[Firebase Sync] ✅ Token verified successfully
[Firebase Sync] ✅ 기존 사용자 업데이트 완료: 42
[AuthContext] ✅ D1 동기화 완료
```

**❌ 실패 시 로그 (401):**
```
[Firebase Sync] ❌ Token validation failed: {
  decoded: true,
  expectedUid: "kakao_4735311250",
  actualSub: "...",  // 이게 다르면 문제!
}
```

---

## 🔍 코드 변경 내용

### verifyFirebaseIdToken() 함수
```typescript
// src/index.tsx

async function verifyFirebaseIdToken(idToken: string): Promise<any> {
  try {
    if (!FIREBASE_JWKS) {
      FIREBASE_JWKS = createRemoteJWKSet(
        new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
      );
      console.log('[Firebase] ✅ JWK Set initialized');
    }
    
    // JWT 검증
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    
    console.log('[Firebase] ✅ Token verified:', { sub: payload.sub, email: payload.email });
    return payload;  // ✅ payload.sub가 UID
  } catch (error: any) {
    console.error('[Firebase] ❌ Token verification failed:', error.message);
    return null;
  }
}
```

### /api/auth/firebase/sync 엔드포인트
```typescript
app.post('/api/auth/firebase/sync', cors(), async (c) => {
  const { DB, CACHE_KV } = c.env;
  
  try {
    const { idToken, firebaseUid, email, displayName } = await c.req.json();
    
    // Firebase ID Token 검증
    const decoded = await verifyFirebaseIdToken(idToken);
    console.log('[Firebase Sync] Token decoded:', { 
      hasDecoded: !!decoded, 
      decodedSub: decoded?.sub,  // ✅ payload.sub 사용
      firebaseUid,
      match: decoded?.sub === firebaseUid  // ✅ 비교
    });
    
    // ✅ decoded.sub와 firebaseUid 비교
    if (!decoded || decoded.sub !== firebaseUid) {
      console.error('[Firebase Sync] ❌ Token validation failed');
      return c.json({ success: false, error: 'Invalid Firebase token' }, 401);
    }
    
    console.log('[Firebase Sync] ✅ Token verified successfully');
    
    // D1 동기화 로직...
  } catch (error) {
    console.error('[Firebase Sync] Error:', error);
    return c.json({ success: false, error: 'Sync failed' }, 500);
  }
});
```

---

## 📊 Firebase JWT 구조

**Firebase ID Token Payload:**
```json
{
  "sub": "kakao_4735311250",  // ✅ 이게 실제 Firebase UID
  "email": null,
  "email_verified": false,
  "aud": "ur-live-1e63d",
  "iss": "https://securetoken.google.com/ur-live-1e63d",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**주의:**
- `payload.uid` ❌ - 존재하지 않음
- `payload.sub` ✅ - Firebase UID (Unique Subject Identifier)

---

## 🔧 추가 체크리스트

### 1. Firebase 프로젝트 설정 확인

**Firebase Console:** https://console.firebase.google.com/project/ur-live-1e63d

**확인 사항:**
- Project ID: `ur-live-1e63d` ✅
- Authentication 활성화 ✅
- Kakao OAuth Provider 설정 ✅
- Authorized domains:
  - `live.ur-team.com` ✅
  - `ur-live.pages.dev` ✅

### 2. Cloudflare Workers 환경 변수

**Cloudflare Dashboard:** https://dash.cloudflare.com

Workers & Pages → ur-live → Settings → Environment Variables

**필요한 변수:**
- `FIREBASE_PROJECT_ID` = `ur-live-1e63d` ✅
- `FIREBASE_DATABASE_URL` = `https://ur-live-1e63d-default-rtdb.firebaseio.com` ✅

### 3. Jose 패키지 설치 확인

```bash
cd /home/user/webapp
npm list jose
```

**예상 출력:**
```
webapp@1.0.0 /home/user/webapp
└── jose@5.9.6
```

---

## 🚀 배포 타임라인

| 시간 | 작업 | 상태 |
|------|------|------|
| T+0 | 코드 수정 완료 (`decoded.sub` 사용) | ✅ |
| T+0 | Jose 패키지 추가 | ✅ |
| T+0 | Commit & Push (`f4c135e`) | ✅ |
| T+2 | GitHub Actions 배포 트리거 | ✅ |
| T+5 | 디버깅 로그 추가 (`0fb60c5`) | ✅ |
| T+10 | 배포 완료 예상 | ⏳ |
| T+15 | 프로덕션 테스트 | ⏳ |

---

## 📞 문제 지속 시 대응

### 시나리오 A: 여전히 401 에러

**확인 사항:**
1. GitHub Actions 로그:
   ```
   https://github.com/tobe2111/ur-live/actions/runs/[RUN_ID]
   ```
   - 빌드 성공 확인
   - 배포 성공 확인

2. Cloudflare Pages 배포 확인:
   ```bash
   npx wrangler pages deployment list --project-name ur-live
   ```

3. 새로운 디버그 로그 확인:
   - `[Firebase Sync] Token decoded:` 로그
   - `decodedSub`와 `firebaseUid` 비교

### 시나리오 B: Jose 임포트 에러

**에러 메시지:**
```
Cannot find module 'jose'
```

**해결:**
```bash
cd /home/user/webapp
npm install jose --save
git add package.json package-lock.json
git commit -m "fix: Ensure jose package in dependencies"
git push origin main
```

### 시나리오 C: FIREBASE_PROJECT_ID 불일치

**로그:**
```
[Firebase] ❌ Token verification failed: 
"audience" claim does not match expected value
```

**해결:**
1. `src/index.tsx` 확인:
   ```typescript
   const FIREBASE_PROJECT_ID = 'ur-live-1e63d';  // ✅ 정확한지 확인
   ```

2. Firebase Console에서 프로젝트 ID 확인

---

## 📝 커밋 히스토리

```
0fb60c5 - debug: Add detailed logging for Firebase token verification
eb7a74d - chore: Trigger redeploy for Firebase Auth fix
f4c135e - fix: Add verifyFirebaseIdToken + Rate Limiting
51e34b7 - fix: Resolve 429 Rate Limiting + JWT URL explosion
```

**GitHub:** https://github.com/tobe2111/ur-live

---

## ✅ 예상 결과 (배포 후)

### 콘솔 로그 (성공)
```
[AuthContext] 🔥 onAuthStateChanged 트리거: {hasUser: true, email: null}
[AuthContext] ✅ 사용자 인증됨: {uid: 'kakao_4735311250', email: null, role: 'user'}
[API] 🔥 Firebase token attached
[Firebase Sync] Syncing user to D1: {firebaseUid: "kakao_4735311250", email: null}
[Firebase] ✅ JWK Set initialized
[Firebase] ✅ Token verified: {sub: "kakao_4735311250", email: null}
[Firebase Sync] Token decoded: {hasDecoded: true, decodedSub: "kakao_4735311250", ...}
[Firebase Sync] ✅ Token verified successfully
[Firebase Sync] ✅ 기존 사용자 업데이트 완료: 42
[AuthContext] ✅ D1 동기화 완료
[AuthContext] 로그인 상태 계산: {hasFirebaseUser: true, userRole: 'user', computedIsLoggedIn: true}
```

### 네트워크 (성공)
```
POST /api/auth/firebase/sync
Status: 200 OK
Response:
{
  "success": true,
  "user": {
    "id": 42,
    "email": "user@kakao.com",
    "name": "사용자"
  }
}
```

---

**작성일:** 2026-03-01  
**최종 업데이트:** 방금  
**상태:** 🟡 GitHub Actions 배포 대기 중 (10-15분)  
**예상 해결 시간:** T+15분
