# 🔧 Cart API 401 Debug Fix

## 수정 사항 요약

### 1. 백엔드 인증 미들웨어 강화 (src/worker/middleware/auth.ts)

#### A. Firebase 환경 변수 검증 추가
**변경 위치**: Line 325-335
```typescript
// ✅ Before
console.log('[Auth] 🔥 Firebase Project ID:', firebaseProjectId);

// ✅ After  
console.log('[Auth] 🔥 Firebase Project ID:', firebaseProjectId);
console.log('[Auth] 🔑 FIREBASE_PRIVATE_KEY available:', !!c.env.FIREBASE_PRIVATE_KEY);
console.log('[Auth] 📧 FIREBASE_CLIENT_EMAIL available:', !!c.env.FIREBASE_CLIENT_EMAIL);

if (!firebaseProjectId) {
  console.error('[Auth] ❌ FIREBASE_PROJECT_ID not configured');
  return c.json({ success: false, error: 'Firebase not configured' }, 500);
}
```

#### B. 401 대신 500 + 디버그 정보 반환 (임시)
**변경 위치**: Line 346-361
```typescript
// ✅ Before
console.log('[Auth] ❌ Both JWT and Firebase verification FAILED');
return c.json(unauthorizedResponse('Invalid or expired token'), 401);

// ✅ After
console.error('[Auth] ❌ Both JWT and Firebase verification FAILED');
console.error('[Auth] 🐛 DEBUG INFO:');
console.error('[Auth]   - Token (first 50 chars):', token.substring(0, 50));
console.error('[Auth]   - Firebase Project ID:', firebaseProjectId);
console.error('[Auth]   - Token format valid:', token.split('.').length === 3);

// Return 500 with debug info (change back to 401 after fix)
return c.json({
  success: false,
  error: 'Token verification failed',
  debug: {
    tokenFormat: token.split('.').length === 3 ? 'valid JWT format' : 'invalid format',
    jwtTried: true,
    firebaseTried: true,
    projectIdConfigured: !!firebaseProjectId,
    hint: 'Check Cloudflare environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL'
  }
}, 500);
```

#### C. Firebase 토큰 검증 로깅 강화
**변경 위치**: Line 157-170
```typescript
// ✅ After
console.log('[Firebase] 🔍 Starting Firebase token verification...');
console.log('[Firebase] 🎫 Token (first 50 chars):', token.substring(0, 50) + '...');

if (!projectId) {
  console.error('[Firebase] ❌ FIREBASE_PROJECT_ID is not set');
  return null;
}

console.log('[Firebase] 📋 Project ID:', projectId);
```

---

### 2. 프론트엔드 무한 루프 방지 (src/lib/api.ts)

#### A. 토큰 변경 여부 확인
**변경 위치**: Line 230-257
```typescript
// ✅ After - 토큰이 실제로 변경되었는지 확인
const newToken = await getCachedFirebaseToken(true); // force refresh
if (newToken) {
  console.log('[API] ✅ 새 토큰 획득 성공:', newToken.substring(0, 50) + '...');
  
  // Check if token actually changed
  const oldToken = originalRequest.headers['Authorization']?.toString().substring(7);
  if (oldToken === newToken) {
    console.error('[API] ⚠️ 토큰이 변경되지 않음 - 갱신 실패로 간주');
    throw new Error('Token refresh returned same token');
  }
  
  // ... rest of logic
}
```

#### B. 더 자세한 로깅
```typescript
console.log('[API] 🎫 Current token (first 50):', originalRequest.headers['Authorization']?.toString().substring(7, 57) + '...');
console.log('[API] 🔁 요청 재시도 with new token (first 50):', newToken.substring(0, 50) + '...');
console.error('[API] 🐛 Exception details:', err instanceof Error ? err.message : String(err));
```

---

## 🧪 디버깅 방법

### Step 1: 백엔드 로그 확인

**Cloudflare Pages 로그 접속**:
```
1. Cloudflare Dashboard 열기
2. Workers & Pages → ur-live 선택
3. Functions → Logs 탭
4. 최근 로그 확인
```

**확인할 로그**:
```
[Auth] 🔐 requireAuth called, path: /api/cart
[Auth] 📝 Authorization header present: true
[Auth] 🎫 Token received (first 30 chars): eyJhbGciOiJSUzI1NiIsIm...
[Auth] 🔑 JWT_SECRET available: true
[Auth] ⚠️ JWT verification failed, trying Firebase...
[Auth] 🔥 Firebase Project ID: urteam-live-commerce-5b284
[Auth] 🔑 FIREBASE_PRIVATE_KEY available: ??? <-- 이것 확인!
[Auth] 📧 FIREBASE_CLIENT_EMAIL available: ??? <-- 이것 확인!
[Firebase] 🔍 Starting Firebase token verification...
[Firebase] 🎫 Token (first 50 chars): eyJhbGciOiJSUzI1NiIs...
[Firebase] ❌ ... <-- 실패 원인 확인!
```

**예상 문제**:
1. ✅ `FIREBASE_PRIVATE_KEY available: false` → **환경 변수 누락**
2. ✅ `Firebase public key not found for kid:` → **토큰이 잘못됨 or 키 캐시 문제**
3. ✅ `Signature verification FAILED` → **PRIVATE_KEY 형식 오류**

---

### Step 2: Cloudflare 환경 변수 확인

```
1. Cloudflare Dashboard
2. Workers & Pages → ur-live
3. Settings → Environment variables
4. Production 탭

확인 필요:
✅ FIREBASE_PROJECT_ID = urteam-live-commerce-5b284
✅ FIREBASE_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
✅ FIREBASE_CLIENT_EMAIL = firebase-adminsdk-...@urteam-live-commerce-5b284.iam.gserviceaccount.com
```

**중요**: `FIREBASE_PRIVATE_KEY`는 **PEM 형식**이어야 함:
```
-----BEGIN PRIVATE KEY-----
MIIEvQ...실제키...==
-----END PRIVATE KEY-----
```

**잘못된 형식**:
```
{"type":"service_account","private_key":"-----BEGIN PRIVATE KEY-----\n..."} ❌
```

---

### Step 3: 브라우저 콘솔 로그 확인

**네트워크 탭**:
```
1. DevTools → Network 탭
2. POST /api/cart 찾기
3. Request Headers 확인:
   Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
4. Response 확인:
   Status: 500 (디버깅 모드)
   Body: { success: false, error: "...", debug: {...} }
```

**콘솔 로그**:
```
[API] 🔄 Firebase User 401 - 토큰 강제 갱신 시도...
[API] 🎫 Current token (first 50): eyJhbGciOiJSUzI1NiIsImtpZCI6IjZjOT...
[API] ✅ 새 토큰 획득 성공: eyJhbGciOiJSUzI1NiIsImtpZCI6IjZjOT...
[API] ⚠️ 토큰이 변경되지 않음 - 갱신 실패로 간주  <-- 문제!
```

**토큰 변경 안되는 경우**:
- Firebase `getIdToken(true)` 강제 갱신이 실패
- 토큰이 아직 유효해서 캐시 반환
- 네트워크 문제로 갱신 실패

---

### Step 4: Firebase 토큰 검증 (수동)

**Firebase Console에서 확인**:
```bash
# 1. Firebase Console 열기
https://console.firebase.google.com/project/urteam-live-commerce-5b284/settings/serviceaccounts/adminsdk

# 2. Service Account 확인
- Email: firebase-adminsdk-...@urteam-live-commerce-5b284.iam.gserviceaccount.com
- Key: Generate new private key 클릭 → JSON 다운로드

# 3. Private Key 형식 확인
cat firebase-adminsdk-key.json | jq -r '.private_key'
# 출력: -----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n
```

**Cloudflare에 설정**:
```bash
# 방법 1: wrangler CLI
wrangler secret put FIREBASE_PRIVATE_KEY
# 입력: (PEM 형식 전체 붙여넣기, \n 포함)

# 방법 2: Cloudflare Dashboard
1. Settings → Environment variables
2. Add variable
3. Name: FIREBASE_PRIVATE_KEY
4. Value: (PEM 형식 전체)
5. Type: Secret (encrypted)
```

---

## 🔑 환경 변수 설정 가이드

### Firebase Admin SDK 키 가져오기

```bash
# 1. Firebase Console
https://console.firebase.google.com/project/urteam-live-commerce-5b284/settings/serviceaccounts/adminsdk

# 2. Generate new private key 클릭 → JSON 다운로드

# 3. JSON에서 필요한 값 추출
cat firebase-adminsdk-key.json | jq -r '.project_id'
# Output: urteam-live-commerce-5b284

cat firebase-adminsdk-key.json | jq -r '.client_email'
# Output: firebase-adminsdk-...@urteam-live-commerce-5b284.iam.gserviceaccount.com

cat firebase-adminsdk-key.json | jq -r '.private_key'
# Output: -----BEGIN PRIVATE KEY-----\nMII...==\n-----END PRIVATE KEY-----\n
```

### Cloudflare에 환경 변수 설정

```bash
# wrangler CLI 사용
wrangler secret put FIREBASE_PROJECT_ID
# 입력: urteam-live-commerce-5b284

wrangler secret put FIREBASE_CLIENT_EMAIL  
# 입력: firebase-adminsdk-...@urteam-live-commerce-5b284.iam.gserviceaccount.com

wrangler secret put FIREBASE_PRIVATE_KEY
# 입력: (아래 형식)
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
...
-----END PRIVATE KEY-----
```

**중요 주의사항**:
- ✅ `\n` (줄바꿈) 문자 포함해야 함
- ✅ `-----BEGIN` 과 `-----END` 줄 포함
- ❌ JSON 형식 전체 붙이면 안됨
- ❌ Base64 인코딩하면 안됨 (PEM 형식 그대로)

---

## 📊 예상 결과

### 환경 변수 설정 전 (현재)
```
[Auth] 🔑 FIREBASE_PRIVATE_KEY available: false  ❌
[Auth] 📧 FIREBASE_CLIENT_EMAIL available: false  ❌
[Firebase] ❌ Firebase public key not found for kid: ...
```

### 환경 변수 설정 후
```
[Auth] 🔑 FIREBASE_PRIVATE_KEY available: true  ✅
[Auth] 📧 FIREBASE_CLIENT_EMAIL available: true  ✅
[Firebase] ✅ Signature verification SUCCESS  ✅
[Firebase] ✅ Token NOT expired  ✅
[Firebase] ✅✅✅ ALL VERIFICATIONS PASSED - User: abc123  ✅
[Auth] ✅ Firebase verification SUCCESS, user: abc123  ✅
```

### 브라우저 응답
```
POST /api/cart - 201 Created  ✅
{
  "success": true,
  "data": {
    "id": 123,
    "product_id": 1,
    "quantity": 1,
    "options": null
  },
  "message": "Item added to cart"
}
```

---

## 🎯 체크리스트

### 즉시 확인 (5분)
- [ ] Cloudflare Dashboard → ur-live → Settings → Environment variables
- [ ] `FIREBASE_PROJECT_ID` 설정 확인
- [ ] `FIREBASE_PRIVATE_KEY` 설정 확인 (Secret으로 표시됨)
- [ ] `FIREBASE_CLIENT_EMAIL` 설정 확인
- [ ] Cloudflare Functions → Logs 확인

### 환경 변수 누락 시 (10분)
- [ ] Firebase Console에서 Service Account JSON 다운로드
- [ ] JSON에서 `project_id`, `client_email`, `private_key` 추출
- [ ] Cloudflare에 환경 변수 설정 (Secret type)
- [ ] 배포 후 테스트 (GitHub Actions 트리거)

### 테스트 (2분)
- [ ] 브라우저 하드 리프레시 (Ctrl+Shift+R)
- [ ] 로그인
- [ ] 상품 상세 → "장바구니 담기" 클릭
- [ ] Network 탭: POST /api/cart → 201 Created 확인
- [ ] Cloudflare Logs: `[Firebase] ✅✅✅ ALL VERIFICATIONS PASSED` 확인

---

## 🚨 배포 후 500 에러를 401로 변경

**디버깅 완료 후** 아래 코드를 원래대로 복원:

```typescript
// src/worker/middleware/auth.ts Line 346-361
// ❌ 임시 (디버깅용)
return c.json({
  success: false,
  error: 'Token verification failed',
  debug: { ... }
}, 500);

// ✅ 복원 (정상 운영)
return c.json(unauthorizedResponse('Invalid or expired token'), 401);
```

---

## 📚 관련 파일

- **src/worker/middleware/auth.ts** - 백엔드 인증 미들웨어 (Line 157, 325-361)
- **src/lib/api.ts** - 프론트엔드 API 클라이언트 (Line 230-257)
- **wrangler.toml** - Cloudflare 환경 설정

---

**빌드 완료**: ✅ dist/_worker.js (621.9 KB)  
**배포 필요**: 🚀 GitHub Actions 트리거  
**예상 수정 시간**: 5-15분 (환경 변수 설정 + 배포)
