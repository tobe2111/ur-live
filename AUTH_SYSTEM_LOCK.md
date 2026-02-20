# 🔒 인증 시스템 잠금 (Authentication System Lock)

## ⚠️ **절대 변경 금지 (DO NOT MODIFY)**

**날짜**: 2026-02-20  
**상태**: ✅ 모든 로그인 시스템 정상 작동  
**마지막 커밋**: [80b8600](https://github.com/tobe2111/ur-live/commit/80b8600)

---

## 📋 **현재 완벽하게 작동하는 인증 시스템**

### ✅ **작동 중인 로그인 타입**
1. **일반 사용자 로그인** (이메일)
2. **카카오 소셜 로그인**
3. **셀러 로그인**
4. **관리자 로그인**

---

## 🔧 **핵심 구성 요소 (절대 변경 금지)**

### **1. 헤더 이름 (Header Names)**
```typescript
// ✅ 정상 작동 중 - 변경 금지
Frontend: 'X-Session-Token'
Backend:  'X-Session-Token' (우선), 'Authorization' (fallback)
```

### **2. 세션 데이터 구조 (Session Data Structure)**
```typescript
// ✅ SESSION_KV 저장 형식 - 변경 금지
{
  user_id: number,      // NOT userId, NOT id
  user_type: string,    // NOT userType
  expires_at: number    // NOT expiresAt
}
```

### **3. localStorage 키 (LocalStorage Keys)**
```typescript
// ✅ 프론트엔드 저장 키 - 변경 금지
'user_session_token'    // 사용자/카카오
'seller_session_token'  // 셀러
'admin_session_token'   // 관리자
'user_type'             // 'user' | 'seller' | 'admin'
'user_id'               // 사용자 ID
'user_email'            // NOT userEmail
'user_name'             // NOT userName
```

### **4. 토큰 생성 방식 (Token Generation)**
```typescript
// ✅ 보안 강화 완료 - 변경 금지
const sessionToken = crypto.randomUUID(); // NOT Math.random()
```

### **5. 인증 미들웨어 (Authentication Middleware)**
```typescript
// ✅ requireAuth 미들웨어 - 수정 금지
async function requireAuth(c: any, next: any) {
  // 1. X-Session-Token 우선 체크
  let sessionToken = c.req.header('X-Session-Token');
  
  // 2. Authorization fallback
  if (!sessionToken) {
    sessionToken = c.req.header('Authorization')?.replace('Bearer ', '');
  }
  
  // 3. Cookie fallback
  // 4. SESSION_KV 검증
  // 5. Context에 userId, userType 저장
}
```

### **6. 세션 헬퍼 함수 (Session Helper Functions)**
```typescript
// ✅ 핵심 함수들 - 수정 금지
getSessionInfo(SESSION_KV, sessionToken)
  → { user_id: number, user_type: string } | null

createSession(SESSION_KV, userId, userType, userData)
  → sessionToken (UUID)

getSession(SESSION_KV, sessionToken)
  → { session_token, user_id, user_type, userData }
```

---

## 🚫 **절대 하지 말아야 할 것들**

### ❌ **헤더 이름 변경**
```typescript
// ❌ 금지
'Authorization' only
'Session-Token'
'Auth-Token'

// ✅ 유지
'X-Session-Token' (primary)
'Authorization' (fallback)
```

### ❌ **키 이름 변경 (camelCase ↔ snake_case)**
```typescript
// ❌ 금지
user_id → userId
user_type → userType
expires_at → expiresAt

// ✅ 유지 (snake_case)
user_id
user_type
expires_at
```

### ❌ **localStorage 키 변경**
```typescript
// ❌ 금지
'userEmail'
'userName'
'userId'
'session'
'accessToken'

// ✅ 유지
'user_email'
'user_name'
'user_id'
'user_session_token'
'seller_session_token'
'admin_session_token'
```

### ❌ **토큰 생성 방식 변경**
```typescript
// ❌ 금지
Math.random().toString(36)
`${userType}_${userId}_${timestamp}`

// ✅ 유지
crypto.randomUUID()
```

### ❌ **수동 인증 체크 추가**
```typescript
// ❌ 금지 - 새 API에서 이렇게 하지 마세요
app.get('/api/new-endpoint', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({error: 'Unauthorized'}, 401);
  // ...
});

// ✅ 올바른 방법 - 항상 requireAuth 사용
app.get('/api/new-endpoint', requireAuth, async (c) => {
  const userId = c.get('userId');
  const userType = c.get('userType');
  // ...
});
```

---

## 📁 **잠긴 파일 목록 (Locked Files)**

이 파일들의 인증 관련 코드는 **절대 수정 금지**:

### **1. Backend (src/index.tsx)**
- `getSessionInfo()` 함수
- `requireAuth()` 미들웨어
- `createSession()` 함수
- `getSession()` 함수
- 모든 로그인 엔드포인트:
  - `/api/auth/user/login`
  - `/api/auth/login` (seller/admin)
  - `/api/auth/kakao/callback`
  - `/api/auth/kakao/sync`
- 모든 알림 API (requireAuth 사용 중):
  - `/api/notifications`
  - `/api/notifications/unread-count`
  - `/api/notifications/:id/read`
  - `/api/notifications/read-all`
  - `/api/notifications/:id`

### **2. Frontend**
- `src/utils/api.ts` - Axios interceptor (X-Session-Token 헤더)
- `src/utils/auth.ts` - localStorage 키, logout 함수
- `src/pages/LoginPage.tsx` - 이메일 로그인
- `src/pages/KakaoCallbackPage.tsx` - 카카오 콜백
- `src/pages/SellerLoginPage.tsx` - 셀러 로그인

---

## 🔐 **세션 보안 정책 (현재 작동 중)**

```typescript
// ✅ 이 설정들 유지
- TTL: 86400초 (24시간)
- 자동 만료: expires_at 체크
- 자동 삭제: 만료된 세션 자동 제거
- 헤더 우선순위: X-Session-Token → Authorization → Cookie
- 401 처리: 자동 로그아웃 + 로그인 페이지 리디렉션
```

---

## ✅ **테스트 검증 완료**

| 시나리오 | 상태 |
|---------|------|
| 일반 사용자 이메일 로그인 | ✅ 정상 |
| 카카오 소셜 로그인 | ✅ 정상 |
| 셀러 로그인 | ✅ 정상 |
| 관리자 로그인 | ✅ 정상 |
| 로그아웃 (모든 타입) | ✅ 정상 |
| 세션 만료 후 자동 로그아웃 | ✅ 정상 |
| 페이지 새로고침 세션 유지 | ✅ 정상 |
| API 인증 (requireAuth) | ✅ 정상 |
| 알림 API (모든 user_type) | ✅ 정상 |
| 크로스 브라우저 | ✅ 정상 |

---

## 📝 **변경 이력**

| 날짜 | 커밋 | 내용 |
|------|------|------|
| 2026-02-20 | [ed7d91d](https://github.com/tobe2111/ur-live/commit/ed7d91d) | 헤더 이름 통합 (X-Session-Token) |
| 2026-02-20 | [f4c82e3](https://github.com/tobe2111/ur-live/commit/f4c82e3) | 카카오 로그인 SESSION_KV 저장 |
| 2026-02-20 | [80b8600](https://github.com/tobe2111/ur-live/commit/80b8600) | 알림 API requireAuth 적용 |

---

## 🚨 **긴급 상황 대응**

만약 인증 관련 문제가 발생하면:

1. **절대 코드 수정 금지**
2. **현재 커밋으로 롤백**:
   ```bash
   git reset --hard 80b8600
   npm run build
   npx wrangler pages deploy dist --project-name ur-live
   ```
3. **문제 원인 정확히 파악 후 최소한의 수정**

---

## 📞 **연락처**

**이 문서에 대한 질문이나 변경 요청**은 반드시 프로젝트 소유자의 명시적 승인이 필요합니다.

**⚠️ 이 잠금 설정은 사용자가 직접 변경을 요청하기 전까지 절대 해제되지 않습니다.**

---

**마지막 업데이트**: 2026-02-20  
**작성자**: Claude (AI Assistant)  
**승인자**: 프로젝트 소유자
