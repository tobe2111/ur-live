# 코딩 표준 (Coding Standards)

**프로젝트**: ur-live  
**최종 업데이트**: 2026-02-20  
**중요도**: 🔒 필수 준수 문서

---

## 목차
1. [인증 시스템](#1-인증-시스템)
2. [데이터베이스](#2-데이터베이스)
3. [API 엔드포인트](#3-api-엔드포인트)
4. [에러 처리](#4-에러-처리)
5. [환경 변수](#5-환경-변수)
6. [TypeScript](#6-typescript)
7. [프론트엔드](#7-프론트엔드)

---

## 1. 인증 시스템

### ✅ DO: 항상 `requireAuth` 미들웨어 사용

```typescript
// ✅ CORRECT
app.get('/api/protected-route', requireAuth, async (c) => {
  const userId = c.get('userId');
  const userType = c.get('userType');
  
  // 비즈니스 로직
  return c.json({ success: true });
});
```

### ❌ DON'T: 수동으로 Authorization 헤더 체크

```typescript
// ❌ WRONG - 절대 이렇게 하지 마세요
app.get('/api/protected-route', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // ... 수동 검증 로직
});
```

### 인증 헤더 우선순위

1. **`X-Session-Token`** (최우선)
2. **`Authorization: Bearer <token>`** (폴백)
3. **`session` 쿠키** (마지막 폴백)

### localStorage 키 이름 규칙 (snake_case)

```typescript
// ✅ CORRECT
localStorage.setItem('user_session_token', token);
localStorage.getItem('user_id');
localStorage.getItem('user_type');
localStorage.getItem('user_email');

// ❌ WRONG
localStorage.setItem('userSessionToken', token);  // camelCase 사용 금지
localStorage.getItem('userId');  // 레거시 키 사용 금지
```

---

## 2. 데이터베이스

### 세션 데이터 저장 (SESSION_KV)

```typescript
// ✅ CORRECT - snake_case 키 사용
const sessionData = {
  user_id: userId,
  user_type: userType,
  expires_at: Date.now() + 24 * 60 * 60 * 1000,  // 24시간
};

await c.env.SESSION_KV.put(
  `session:${token}`,
  JSON.stringify(sessionData),
  { expirationTtl: 24 * 60 * 60 }  // 24시간
);
```

### D1 데이터베이스 쿼리

```typescript
// ✅ CORRECT - Prepared statements 사용
const result = await c.env.DB.prepare(`
  SELECT * FROM users WHERE id = ? AND email = ?
`).bind(userId, email).first();

// ❌ WRONG - SQL injection 위험
const result = await c.env.DB.prepare(`
  SELECT * FROM users WHERE id = ${userId}
`).first();
```

---

## 3. API 엔드포인트

### 표준 응답 포맷

#### 성공 응답
```typescript
return c.json({
  success: true,
  data: { /* ... */ }
}, 200);
```

#### 에러 응답
```typescript
return c.json({
  success: false,
  error: '사용자에게 보여질 메시지',
  details: {  // 선택적
    field: 'email',
    code: 'INVALID_FORMAT'
  }
}, 400);
```

### HTTP 상태 코드 사용 규칙

- **200** OK: 성공
- **201** Created: 리소스 생성 성공
- **400** Bad Request: 잘못된 요청 (유효성 검사 실패)
- **401** Unauthorized: 인증 실패
- **403** Forbidden: 권한 없음
- **404** Not Found: 리소스 없음
- **500** Internal Server Error: 서버 에러

### 새 API 추가 시 체크리스트

- [ ] `requireAuth` 미들웨어 적용 (인증 필요 시)
- [ ] 요청 데이터 유효성 검사
- [ ] 표준 응답 포맷 사용
- [ ] 에러 핸들링 추가
- [ ] TypeScript 타입 정의
- [ ] 로그 추가 (필요 시)

---

## 4. 에러 처리

### 글로벌 에러 핸들러 사용

```typescript
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.url}`, err);
  
  if (c.req.path.startsWith('/api/')) {
    // 401 Unauthorized
    if (err.message.includes('Unauthorized') || err.message.includes('로그인')) {
      return c.json({
        success: false,
        error: '로그인이 필요합니다',
        code: 'UNAUTHORIZED'
      }, 401);
    }
    
    // 403 Forbidden
    if (err.message.includes('Forbidden') || err.message.includes('권한')) {
      return c.json({
        success: false,
        error: '권한이 없습니다',
        code: 'FORBIDDEN'
      }, 403);
    }
    
    // 500 Internal Server Error
    return c.json({
      success: false,
      error: '서버 오류가 발생했습니다',
      code: 'INTERNAL_ERROR'
    }, 500);
  }
  
  return c.text('Internal Server Error', 500);
});
```

### Try-Catch 블록 사용

```typescript
// ✅ CORRECT
app.post('/api/orders', requireAuth, async (c) => {
  try {
    const data = await c.req.json();
    
    // 비즈니스 로직
    
    return c.json({ success: true });
  } catch (error) {
    console.error('[API] Order creation error:', error);
    return c.json({
      success: false,
      error: '주문 생성 중 오류가 발생했습니다'
    }, 500);
  }
});
```

---

## 5. 환경 변수

### 필수 환경 변수 목록

**프로덕션 (Cloudflare Pages Secrets):**
- `TOSS_SECRET_KEY` - Toss Payments 시크릿 키
- `TOSS_CLIENT_KEY` - Toss Payments 클라이언트 키

**로컬 개발 (.dev.vars):**
```bash
TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm
```

### TypeScript 타입 정의 (권장)

```typescript
// src/types/env.ts
interface Env {
  DB: D1Database;
  SESSION_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  TOSS_SECRET_KEY: string;
  TOSS_CLIENT_KEY: string;
}

// 사용
const app = new Hono<{ Bindings: Env }>();
```

### 환경 변수 접근

```typescript
// ✅ CORRECT
const tossSecretKey = c.env.TOSS_SECRET_KEY;

if (!tossSecretKey) {
  throw new Error('TOSS_SECRET_KEY is not configured');
}

// ❌ WRONG
const tossSecretKey = process.env.TOSS_SECRET_KEY;  // Cloudflare Workers에서 작동 안 함
```

---

## 6. TypeScript

### 타입 정의 필수

```typescript
// ✅ CORRECT
interface User {
  id: number;
  email: string;
  name: string;
  user_type: 'user' | 'seller' | 'admin';
}

const user: User = {
  id: 1,
  email: 'test@example.com',
  name: '홍길동',
  user_type: 'user'
};
```

### Any 타입 사용 금지

```typescript
// ❌ WRONG
const data: any = await c.req.json();

// ✅ CORRECT
interface OrderRequest {
  items: Array<{ product_id: number; quantity: number }>;
  shipping_address: string;
}

const data: OrderRequest = await c.req.json();
```

---

## 7. 프론트엔드

### API 호출 표준

```typescript
// ✅ CORRECT - src/utils/api.ts 사용
import api from '@/lib/api';

const response = await api.get('/api/notifications');
const data = await api.post('/api/orders', { items: [...] });
```

### 세션 토큰 관리

```typescript
// ✅ CORRECT
const token = localStorage.getItem('user_session_token');
api.defaults.headers.common['X-Session-Token'] = token;

// ❌ WRONG
api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

### 로그아웃 처리

```typescript
// ✅ CORRECT
const logout = () => {
  localStorage.removeItem('user_session_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_type');
  localStorage.removeItem('user_email');
  // ... 기타 세션 관련 키
  
  navigate('/login');
};
```

---

## 준수 사항 요약

1. **인증**: 항상 `requireAuth` 미들웨어 사용
2. **키 이름**: snake_case 사용 (`user_id`, `user_type`, `expires_at`)
3. **응답 포맷**: `{ success: true/false, data/error, details? }` 표준 사용
4. **에러 처리**: Try-catch + 글로벌 에러 핸들러
5. **환경 변수**: TypeScript 타입 정의 + 런타임 검증
6. **타입 안정성**: Any 타입 금지, 명시적 인터페이스 정의

---

**이 문서를 위반하는 코드는 배포 전 반드시 수정해야 합니다.**
