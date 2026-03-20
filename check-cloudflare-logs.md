# Cloudflare Functions 로그 확인 방법

## 방법 1: Cloudflare Dashboard (추천)

1. https://dash.cloudflare.com 접속
2. **Pages** → **ur-live** 선택
3. **Functions** → **Logs** 탭 클릭
4. **시간 범위**: 최근 30분
5. **필터**: `[Auth]` 또는 `[Firebase]` 또는 `[Cart]`
6. 다음 로그를 찾아주세요:

```
[Auth] 🔐 requireAuth called, path: /api/cart
[Auth] 📝 Authorization header present: true
[Auth] 🎫 Token received (first 30 chars): eyJhbGciOiJSUzI1NiIsImtpZCI6...
[Auth] 🔑 JWT_SECRET available: true
[Auth] ⚠️ JWT verification failed, trying Firebase...
[Auth] 🔥 Firebase Project ID: urteam-live-commerce-5b284
[Auth] 🔑 FIREBASE_PRIVATE_KEY available: ??? ← 이게 true인지 false인지
[Auth] 📧 FIREBASE_CLIENT_EMAIL available: ??? ← 이게 true인지 false인지
[Firebase] 🔍 Starting Firebase token verification...
[Firebase] 📄 Token header alg: RS256 kid: xxx...
[Firebase] ❌ ... (어떤 에러?)
```

## 방법 2: wrangler tail (로컬에서)

```bash
# Cloudflare API 토큰이 필요합니다
# https://dash.cloudflare.com/profile/api-tokens
# "Edit Cloudflare Workers" 템플릿 사용

export CLOUDFLARE_API_TOKEN="your-token-here"
npx wrangler pages deployment tail --project-name=ur-live
```

## 방법 3: Response Body 다시 확인

브라우저 DevTools → Network → /api/cart (500) → Response 탭에서:

```json
{
  "success": false,
  "error": "...",
  "debug": {
    "message": "구체적인 에러 메시지",
    "name": "Error",
    "stack": "..."
  }
}
```

이 내용을 전체 복사해 주세요!

---

## 예상되는 원인

1. **Cloudflare Pages 환경 변수 누락**:
   - `FIREBASE_PROJECT_ID` ✅ (있음, 로그 확인됨)
   - `FIREBASE_PRIVATE_KEY` ❓ (없을 가능성)
   - `FIREBASE_CLIENT_EMAIL` ❓ (없을 가능성)

2. **Firebase 토큰 검증 실패**:
   - Google 공개키 가져오기 실패
   - 서명 검증 실패
   - 만료 시간 검증 실패

3. **D1 DB 연결 실패** (GET /api/cart도 실패하므로):
   - DB 바인딩 누락
   - 테이블 스키마 문제

---

## 즉시 시도해볼 것

### A. Cloudflare Dashboard에서 로그 확인
가장 빠르고 정확합니다.

### B. Response Body 다시 복사
DevTools → Network → /api/cart (GET 또는 POST 500) → Response 탭

### C. 테스트 토큰 확인
브라우저 콘솔에서:
```javascript
localStorage.getItem('accessToken')
```

이 토큰이 Firebase ID Token인지 확인 (RS256, kid 있어야 함):
```javascript
const token = localStorage.getItem('accessToken');
const parts = token.split('.');
const header = JSON.parse(atob(parts[0]));
console.log('Token header:', header);
// 결과: { alg: 'RS256', kid: '732ca967...', typ: 'JWT' }
```
