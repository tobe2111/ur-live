# 🔴 Session Storage Unified Fix - 완전 해결

## 날짜
2026-02-15 20:30 KST

## 🐛 **핵심 문제**

### **문제 1: 세션 저장/조회 불일치**
```
❌ Kakao 콜백: session → admin_sessions DB 테이블에 저장
❌ requireAuth: session → SESSION_KV 스토어에서 조회
💥 결과: 세션을 찾을 수 없음 → 401 Unauthorized
```

### **문제 2: 결제 버튼 경로 오류**
```
❌ onClick={() => navigate('/checkout')}
✅ onClick={() => navigate('/cart')}
```

### **문제 3: API 요청 시 토큰 미전송**
```
❌ api.get('/api/cart') → No Authorization header, No Cookie
💥 결과: 백엔드가 세션 토큰을 받지 못함 → 401 Unauthorized
```

---

## ✅ **해결 방안**

### **1. Kakao 콜백 → SESSION_KV에 저장**

**변경 전 (`src/index.tsx` Line 1212-1214):**
```typescript
await DB.prepare(
  'INSERT INTO admin_sessions (session_token, user_type, expires_at) VALUES (?, ?, ?)'
).bind(sessionToken, 'user', expiresAt).run();
```

**변경 후:**
```typescript
const { SESSION_KV } = c.env;
const sessionToken = crypto.randomUUID();
const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

// Store session in SESSION_KV (to match requireAuth)
await SESSION_KV.put(
  `session:${sessionToken}`,
  JSON.stringify({
    user_id: userId,
    user_type: 'user',
    expires_at: expiresAt
  }),
  { expirationTtl: 24 * 60 * 60 }  // 24 hours
);
```

### **2. 프론트엔드 → Cookie에도 토큰 저장**

**변경 전 (`src/pages/LivePage.tsx` Line 136-138):**
```typescript
localStorage.setItem('session', sessionToken)
localStorage.setItem('user_id', userId || '')
localStorage.setItem('user_name', decodeURIComponent(userName || '카카오 사용자'))
```

**변경 후:**
```typescript
// Save to localStorage
localStorage.setItem('session', sessionToken)
localStorage.setItem('user_id', userId || '')
localStorage.setItem('user_name', decodeURIComponent(userName || '카카오 사용자'))

// ALSO save to cookie (for API requests)
document.cookie = `session=${sessionToken}; path=/; max-age=86400; SameSite=Lax`
```

### **3. 결제 버튼 경로 수정**

**변경 전 (`src/pages/LivePage.tsx` Line 1332):**
```typescript
<button onClick={() => navigate('/checkout')} ...>
```

**변경 후:**
```typescript
<button onClick={() => navigate('/cart')} ...>
```

---

## 🔄 **완전한 인증 흐름**

### **1. 로그인 (Kakao OAuth)**
```
사용자 → Add to Cart 클릭
     ↓
Kakao OAuth 팝업 → 사용자 인증
     ↓
Backend /auth/kakao/sync/callback
     ↓
✅ SESSION_KV에 세션 저장:
   Key: session:${uuid}
   Value: { user_id, user_type: 'user', expires_at }
   TTL: 24시간
     ↓
Redirect → /live/15?login=success&session=${uuid}&userId=3&userName=정지원
```

### **2. 프론트엔드 콜백 처리**
```typescript
// LivePage.tsx useEffect (Line 128-151)
const sessionToken = searchParams.get('session')

// 1️⃣ localStorage 저장 (UI 표시용)
localStorage.setItem('session', sessionToken)

// 2️⃣ Cookie 저장 (API 요청용)
document.cookie = `session=${sessionToken}; path=/; max-age=86400; SameSite=Lax`

// 3️⃣ URL 정리
window.history.replaceState({}, '', '/live/15')

// 4️⃣ 환영 메시지
showAlert('환영합니다, 정지원님!')
```

### **3. API 요청 (자동 인증)**
```
사용자 → "결제하기" 버튼 클릭
     ↓
navigate('/cart')
     ↓
CartPage → useEffect
     ↓
api.get('/api/cart')  ← Cookie 자동 전송!
     ↓
Backend requireAuth middleware:
  1. Authorization 헤더 확인 (없음)
  2. Cookie 헤더 확인 → session=xxx 발견
  3. SESSION_KV.get(`session:${xxx}`) → { user_id: 3 }
  4. c.set('userId', 3)
     ↓
/api/cart handler:
  const userId = c.get('userId')
  → 장바구니 조회 성공
     ↓
✅ 200 OK + 장바구니 데이터 반환
```

---

## 🎯 **왜 이전 방법이 실패했는가?**

### **HttpOnly Cookie 방식의 문제**
```
❌ 백엔드에서 Set-Cookie로 HttpOnly 쿠키 설정
❌ 프론트엔드는 쿠키 읽기 불가 (HttpOnly)
❌ localStorage에 별도로 토큰 저장 필요
💥 쿠키 vs localStorage 불일치 발생
```

### **Authorization Header 방식의 문제**
```
❌ API 인터셉터가 매 요청마다 헤더 추가 필요
❌ 프론트엔드 코드가 복잡해짐
❌ 인터셉터 누락 시 401 에러
```

### **✅ 현재 방식 (Simple Cookie)**
```
✅ 프론트엔드가 직접 일반 쿠키 설정
✅ 브라우저가 자동으로 모든 API 요청에 쿠키 포함
✅ 백엔드는 Cookie 헤더만 읽으면 됨
✅ 간단하고 명확한 흐름
```

---

## 🧪 **테스트 방법**

### **1. 초기화**
```javascript
// 브라우저 콘솔
localStorage.clear()
sessionStorage.clear()
document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"))
// Ctrl + Shift + R (하드 리프레시)
```

### **2. 로그인 테스트**
```
1. https://05d113fc.ur-live.pages.dev/live/15 접속
2. "장바구니에 담기" 클릭 → Kakao 로그인
3. 로그인 완료 → "환영합니다, 정지원님!" 팝업 확인
4. 콘솔 확인:
   ✅ localStorage.getItem('session') → uuid
   ✅ document.cookie → session=uuid
```

### **3. 장바구니 테스트**
```
1. "결제하기" 버튼 클릭
2. /cart 페이지로 이동 (NOT /checkout)
3. 네트워크 탭:
   ✅ GET /api/cart
   ✅ Request Headers → Cookie: session=xxx
   ✅ Status: 200 OK
   ✅ Response: 장바구니 데이터
```

### **4. 예상 결과**
```
✅ 로그인 후 "결제하기" 클릭 시 즉시 장바구니 페이지로 이동
✅ 401 에러 없음
✅ 재로그인 요구 없음
✅ 장바구니 데이터 정상 로드
```

---

## 📊 **Before vs After**

| 항목 | Before (문제) | After (해결) |
|------|--------------|-------------|
| **세션 저장** | admin_sessions DB | SESSION_KV |
| **세션 조회** | SESSION_KV | SESSION_KV ✅ |
| **토큰 전송** | 전송 안 됨 ❌ | Cookie 자동 전송 ✅ |
| **결제 버튼** | /checkout ❌ | /cart ✅ |
| **401 에러** | 발생 ❌ | 없음 ✅ |

---

## 🚀 **배포 정보**

- **Git Commit**: `be866a2`
- **배포 시각**: 2026-02-15 20:30 KST
- **Production URL**: https://live.ur-team.com
- **Preview URL**: https://05d113fc.ur-live.pages.dev

---

## 📝 **핵심 교훈**

1. **저장 위치와 조회 위치를 일치시켜라**
   - Kakao 콜백 → SESSION_KV 저장
   - requireAuth → SESSION_KV 조회
   - ✅ 일치!

2. **브라우저 쿠키를 활용하라**
   - localStorage (UI 표시용) + Cookie (API 요청용)
   - 브라우저가 자동으로 쿠키 전송
   - 간단하고 안정적

3. **API 경로를 정확히 확인하라**
   - /checkout (존재하지 않는 경로)
   - /cart (장바구니 페이지)

4. **롤백 후에는 전체 코드를 검토하라**
   - 백엔드만 롤백 → 프론트엔드와 불일치
   - 전체 인증 흐름을 다시 추적
   - 일관성 확보

---

## ✅ **결론**

이제 사용자는:
1. Kakao 로그인 완료
2. "결제하기" 클릭
3. **즉시 장바구니 페이지로 이동**
4. **재로그인 없이 결제 진행 가능**

**완전히 해결되었습니다! 🎉**
