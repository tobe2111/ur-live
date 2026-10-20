# 🚨 Cart 401 Debug 배포 완료

**배포 시간**: 2026-03-19 12:40 UTC  
**커밋**: a047ea85  
**문제**: accessToken 존재하지만 백엔드에서 401 Unauthorized 반환

---

## 🔍 추가된 디버그 로그

### Backend (`src/worker/middleware/auth.ts`)

#### requireAuth() 미들웨어
```typescript
[Auth] 🔐 requireAuth called, path: /api/cart
[Auth] 📝 Authorization header present: true
[Auth] 🎫 Token received (first 30 chars): eyJhbGciOiJSUzI1NiIsImtpZCI...
[Auth] 🔑 JWT_SECRET available: true
[Auth] ⚠️ JWT verification failed, trying Firebase...
[Auth] 🔥 Firebase Project ID: urteam-live-commerce-5b284
[Auth] ✅ Firebase verification SUCCESS, user: kakao_4735311250
OR
[Auth] ❌ Both JWT and Firebase verification FAILED
```

#### verifyFirebaseToken() 상세 로그
```typescript
[Firebase] 🔍 Starting Firebase token verification...
[Firebase] 📋 Project ID: urteam-live-commerce-5b284
[Firebase] 📄 Token header alg: RS256 kid: abc123def456...
[Firebase] 🔑 Fetching public keys...
[Firebase] ✅ Public key found for kid: abc123def456...
[Firebase] 🔐 Verifying signature...
[Firebase] ✅ Signature verification SUCCESS
[Firebase] 📦 Token payload - sub: kakao_4735311250 exp: 1234567890 now: 1234567890
[Firebase] ✅ Token NOT expired (remaining: 3600 sec)
[Firebase] ✅✅✅ ALL VERIFICATIONS PASSED - User: kakao_4735311250
```

**에러 시 표시될 메시지**:
- `[Firebase] ❌ FIREBASE_PROJECT_ID is not set`
- `[Firebase] ❌ Invalid JWT structure (parts !== 3)`
- `[Firebase] ❌ Missing JWT parts`
- `[Firebase] ❌ Firebase token must use RS256, got: HS256`
- `[Firebase] ❌ Missing kid in header`
- `[Firebase] ❌ Firebase public key not found for kid: xxx`
- `[Firebase] ❌ Signature verification FAILED`
- `[Firebase] ❌ Token EXPIRED (exp: xxx now: yyy diff: zzz sec)`
- `[Firebase] ❌ Token iss mismatch. Expected: xxx Got: yyy`
- `[Firebase] ❌ Token aud mismatch. Expected: xxx Got: yyy`
- `[Firebase] ❌ Token missing sub (user ID)`
- `[Firebase] ❌ Exception during verification: [error message]`

### Frontend (`src/hooks/useCart.ts`)

```typescript
[useCart] 🛒 장바구니 데이터 조회 중...
[useCart] 🎫 Token before API call: eyJhbGciOiJSUzI1NiIs... OR NULL
[useCart] 📡 API 전체 응답: {...}
[useCart] ✅ 최종 장바구니 데이터: {...}
OR
[useCart] ❌ 401 Unauthorized - stopping retry
```

---

## 🛠️ 수정 사항

### 1. Backend 디버그 로그 추가
**파일**: `src/worker/middleware/auth.ts`

- `requireAuth()` 함수 (Line 254-310):
  - Authorization 헤더 존재 여부
  - 토큰 첫 30자 (민감 정보 마스킹)
  - JWT_SECRET 환경변수 확인
  - JWT vs Firebase 검증 경로 구분
  - 최종 성공/실패 메시지

- `verifyFirebaseToken()` 함수 (Line 157-275):
  - 11단계 검증 과정 모두 로깅
  - 각 검증 단계별 SUCCESS/FAILED 표시
  - 토큰 만료 시 남은 시간 계산
  - 공개키 kid 목록 표시 (키 매칭 실패 시)

### 2. Frontend 무한 로딩 방지
**파일**: `src/hooks/useCart.ts`

- API 호출 전 토큰 존재 여부 확인 로그
- **401 에러 시 재시도 중단**:
  ```typescript
  retry: (failureCount, error: any) => {
    if (error?.response?.status === 401) {
      console.error('[useCart] ❌ 401 Unauthorized - stopping retry')
      return false  // ← 재시도 중단
    }
    return failureCount < 2  // 다른 에러는 2회 재시도
  }
  ```

---

## 📊 예상 진단 결과

### 시나리오 A: 토큰 만료
```
[Firebase] ❌ Token EXPIRED (exp: 1710838800 now: 1710842400 diff: 3600 sec)
```
**해결**: 프론트엔드 `getCachedFirebaseToken(true)` 강제 갱신

### 시나리오 B: 서명 검증 실패
```
[Firebase] ✅ Public key found for kid: abc123...
[Firebase] ❌ Signature verification FAILED
```
**원인**: 토큰이 조작되었거나 잘못된 키로 서명됨  
**해결**: 로그인 다시 시도

### 시나리오 C: Project ID 불일치
```
[Firebase] ❌ Token aud mismatch. Expected: urteam-live-commerce-5b284 Got: other-project-123
```
**원인**: 다른 Firebase 프로젝트의 토큰 사용  
**해결**: 환경변수 `FIREBASE_PROJECT_ID` 확인

### 시나리오 D: 공개키 매칭 실패
```
[Firebase] ❌ Firebase public key not found for kid: xyz789
[Firebase] Available kids: abc123, def456, ghi789
```
**원인**: Google 공개키 캐시 만료 또는 토큰이 너무 오래됨  
**해결**: 로그인 다시 시도

---

## 🧪 테스트 방법

### 1. GitHub Actions 배포 확인
```bash
# GitHub Actions 페이지 열기
https://github.com/tobe2111/ur-live/actions

# 최신 워크플로우 상태 확인
- Commit: a047ea85 "fix(critical): Add comprehensive auth debug logging"
- Status: In Progress / Success
```

### 2. 배포 완료 후 (약 5-10분)
```bash
# Production에서 브라우저 콘솔 열기
1. Incognito 모드로 https://live.ur-team.com 접속
2. F12 → Console 탭
3. 카카오 로그인
4. /cart 페이지 이동
```

### 3. 콘솔 로그 확인
**프론트엔드**:
```
[useCart] 🛒 장바구니 데이터 조회 중...
[useCart] 🎫 Token before API call: eyJhbGciOiJSUzI1NiIs...
[API] ✅ useAuthStore accessToken 사용: eyJhbGciOiJSUzI1NiIs...
```

**백엔드** (Cloudflare Workers Logs):
```bash
# Cloudflare Dashboard에서 확인
1. https://dash.cloudflare.com/
2. Workers & Pages → ur-live → Logs
3. 실시간 로그 스트림 확인
```

또는 `wrangler` CLI:
```bash
npx wrangler tail --project-name=ur-live
```

---

## 🔍 예상되는 로그 출력 (정상 케이스)

```
[Auth] 🔐 requireAuth called, path: /api/cart
[Auth] 📝 Authorization header present: true
[Auth] 🎫 Token received (first 30 chars): eyJhbGciOiJSUzI1NiIsImtpZCI6I...
[Auth] 🔑 JWT_SECRET available: true
[Auth] ⚠️ JWT verification failed, trying Firebase...
[Auth] 🔥 Firebase Project ID: urteam-live-commerce-5b284

[Firebase] 🔍 Starting Firebase token verification...
[Firebase] 📋 Project ID: urteam-live-commerce-5b284
[Firebase] 📄 Token header alg: RS256 kid: abc123def456...
[Firebase] 🔑 Fetching public keys...
[Firebase] ✅ Public key found for kid: abc123def456...
[Firebase] 🔐 Verifying signature...
[Firebase] ✅ Signature verification SUCCESS
[Firebase] 📦 Token payload - sub: kakao_4735311250 exp: 1710842400 now: 1710838800
[Firebase] ✅ Token NOT expired (remaining: 3600 sec)
[Firebase] ✅✅✅ ALL VERIFICATIONS PASSED - User: kakao_4735311250

[Auth] ✅ Firebase verification SUCCESS, user: kakao_4735311250
```

**결과**: GET /api/cart → **200 OK**

---

## 🔍 예상되는 로그 출력 (에러 케이스)

### 케이스 1: 토큰 만료
```
[Firebase] 📦 Token payload - sub: kakao_4735311250 exp: 1710838800 now: 1710842400
[Firebase] ❌ Token EXPIRED (exp: 1710838800 now: 1710842400 diff: 3600 sec)
[Auth] ❌ Both JWT and Firebase verification FAILED
```

### 케이스 2: 서명 검증 실패
```
[Firebase] 🔐 Verifying signature...
[Firebase] ❌ Signature verification FAILED
[Auth] ❌ Both JWT and Firebase verification FAILED
```

### 케이스 3: Project ID 불일치
```
[Firebase] ❌ Token aud mismatch. Expected: urteam-live-commerce-5b284 Got: other-project
[Auth] ❌ Both JWT and Firebase verification FAILED
```

---

## 📝 다음 단계

### 1. 배포 완료 대기 (5-10분)
- GitHub Actions workflow 진행 상황 확인
- Cloudflare Pages 배포 완료 확인

### 2. Production 테스트
```
1. Incognito: https://live.ur-team.com
2. F12 Console 열기
3. 카카오 로그인
4. Console에서 토큰 저장 확인:
   [KakaoCallback] ✅ Store 업데이트 완료
   [AuthKR] ⏩ Already processed

5. /cart 페이지 이동
6. Console 로그 복사:
   - Frontend: [useCart], [API] 로그
   - Backend: Cloudflare Workers Logs (wrangler tail)

7. Network 탭 확인:
   - Request: GET /api/cart
   - Headers: Authorization: Bearer eyJhbGci...
   - Status: 200 OK (success) or 401 (fail)
```

### 3. 로그 분석
**성공 시**:
```
[Firebase] ✅✅✅ ALL VERIFICATIONS PASSED
GET /api/cart → 200 OK
```
→ 문제 해결 완료!

**실패 시**:
```
[Firebase] ❌ [구체적인 에러 메시지]
GET /api/cart → 401 Unauthorized
```
→ 에러 메시지를 복사해서 제공해 주세요. 정확한 원인과 해결책을 제시하겠습니다.

---

## 🎯 문제 해결 우선순위

1. **토큰 만료** → 자동 갱신 강화
2. **서명 검증 실패** → 로그인 플로우 점검
3. **환경변수 오류** → Cloudflare Workers 환경변수 확인
4. **공개키 매칭 실패** → 캐시 무효화 + 재시도

---

**최종 커밋**: a047ea85  
**배포 트리거**: GitHub Actions (자동)  
**예상 완료**: 2026-03-19 12:45-12:50 UTC  
**Logs 확인**: `npx wrangler tail --project-name=ur-live`

**배포 완료 후 Console 로그를 복사해서 보내주시면 정확한 원인을 파악하겠습니다!** 🔍
