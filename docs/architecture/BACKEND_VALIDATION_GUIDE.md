# Backend Input Validation Guide

## 개요

프론트엔드 검증을 우회하는 악의적 요청을 차단하기 위한 백엔드 입력 검증 시스템입니다.

## 주요 기능

### 1. 타입 검증
- **기본 타입**: string, number, boolean
- **특수 타입**: email, url, phone, date
- **컬렉션**: array, object

### 2. 길이/범위 검증
- **문자열**: 최소/최대 길이 제한
- **숫자**: 최소/최대 값 제한
- **배열**: 최소/최대 항목 수 제한

### 3. 보안 검증
- **SQL Injection 방지**: SQL 키워드 및 패턴 검사
- **XSS 방지**: 스크립트 태그 및 이벤트 핸들러 검사
- **정규식 패턴**: 커스텀 패턴 매칭

## 사용법

### 기본 사용

```typescript
import { validate, UserRegistrationRules } from './lib/validation'

// 미들웨어로 사용
app.post('/api/auth/user/register', validate(UserRegistrationRules), async (c) => {
  // 검증된 데이터는 c.get('validatedData')에서 가져오기
  const { email, password, name } = c.get('validatedData')
  
  // 비즈니스 로직 수행
  // ...
})
```

### 커스텀 규칙 정의

```typescript
import { ValidationRule, validate } from './lib/validation'

const CustomRules: ValidationRule[] = [
  {
    field: 'username',
    required: true,
    type: 'string',
    min: 3,
    max: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    message: '사용자명은 3-20자의 영문자, 숫자, 밑줄만 사용 가능합니다.'
  },
  {
    field: 'age',
    required: true,
    type: 'number',
    min: 18,
    max: 120,
    message: '나이는 18-120세 사이여야 합니다.'
  },
  {
    field: 'bio',
    required: false,
    type: 'string',
    max: 500,
    custom: (value) => {
      // XSS 방지
      if (containsXss(value)) {
        return false
      }
      return true
    },
    message: '자기소개에 허용되지 않은 내용이 포함되어 있습니다.'
  }
]

app.post('/api/profile', validate(CustomRules), async (c) => {
  const validatedData = c.get('validatedData')
  // ...
})
```

### 단일 값 검증

```typescript
import { validateValue, ValidationError } from './lib/validation'

try {
  validateValue(email, {
    field: 'email',
    required: true,
    type: 'email',
    max: 255
  })
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`검증 실패: ${error.field} - ${error.message}`)
  }
}
```

### 객체 검증

```typescript
import { validateObject } from './lib/validation'

const userData = {
  email: 'user@example.com',
  password: 'SecurePass123',
  name: 'John Doe'
}

validateObject(userData, UserRegistrationRules)
// 검증 실패 시 ValidationError 발생
```

## 사전 정의된 검증 규칙

### 1. UserRegistrationRules

사용자 회원가입 검증

```typescript
[
  { field: 'email', required: true, type: 'email', max: 255 },
  { field: 'password', required: true, type: 'string', min: 8, max: 100, 
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/ }, // 대소문자 + 숫자 필수
  { field: 'name', required: true, type: 'string', min: 2, max: 50 },
  { field: 'phone', required: false, type: 'phone' }
]
```

**적용 엔드포인트**:
- `POST /api/auth/user/register`
- `POST /api/auth/seller/register`

### 2. ProductCreationRules

상품 생성 검증

```typescript
[
  { field: 'name', required: true, type: 'string', min: 1, max: 200 },
  { field: 'description', required: false, type: 'string', max: 5000 },
  { field: 'price', required: true, type: 'number', min: 0, max: 100000000 },
  { field: 'stock', required: true, type: 'number', min: 0, max: 999999 },
  { field: 'category', required: true, type: 'string',
    enum: ['패션', '뷰티', '식품', '전자제품', '생활용품', '기타'] }
]
```

**적용 엔드포인트**:
- `POST /api/products`
- `PUT /api/products/:id`

### 3. OrderCreationRules

주문 생성 검증

```typescript
[
  { field: 'items', required: true, type: 'array', min: 1, max: 50 },
  { field: 'shippingAddress', required: true, type: 'string', min: 5, max: 200 },
  { field: 'recipientName', required: true, type: 'string', min: 2, max: 50 },
  { field: 'recipientPhone', required: true, type: 'phone' }
]
```

**적용 엔드포인트**:
- `POST /api/orders`

### 4. PaymentConfirmRules

결제 확인 검증

```typescript
[
  { field: 'paymentKey', required: true, type: 'string', min: 1, max: 200 },
  { field: 'orderId', required: true, type: 'string', min: 1, max: 100 },
  { field: 'amount', required: true, type: 'number', min: 100, max: 100000000 }
]
```

**적용 엔드포인트**:
- `POST /api/payments/confirm`

### 5. AlimtalkSendRules

알림톡 발송 검증

```typescript
[
  { field: 'templateCode', required: true, type: 'string', min: 1, max: 50 },
  { field: 'to', required: true, type: 'phone' },
  { field: 'message', required: true, type: 'string', min: 1, max: 1000 }
]
```

**적용 엔드포인트**:
- `POST /api/seller/alimtalk/send`

### 6. SearchQueryRules

검색 쿼리 검증

```typescript
[
  { field: 'q', required: true, type: 'string', min: 1, max: 100,
    custom: (value) => !containsSqlInjection(value) },
  { field: 'page', required: false, type: 'number', min: 1, max: 1000 },
  { field: 'limit', required: false, type: 'number', min: 1, max: 100 }
]
```

**적용 엔드포인트**:
- `GET /api/search`
- `GET /api/products` (검색 파라미터 포함)

## 검증 에러 처리

### 에러 응답 형식

```json
{
  "success": false,
  "error": "이메일은 유효한 이메일 주소여야 합니다.",
  "field": "email",
  "code": "INVALID_EMAIL"
}
```

### 에러 코드

| 코드 | 설명 |
|------|------|
| `REQUIRED` | 필수 필드 누락 |
| `INVALID_TYPE` | 잘못된 타입 |
| `INVALID_EMAIL` | 잘못된 이메일 형식 |
| `INVALID_URL` | 잘못된 URL 형식 |
| `INVALID_PHONE` | 잘못된 전화번호 형식 |
| `INVALID_DATE` | 잘못된 날짜 형식 |
| `TOO_SHORT` | 문자열이 너무 짧음 |
| `TOO_LONG` | 문자열이 너무 김 |
| `TOO_SMALL` | 숫자가 너무 작음 |
| `TOO_LARGE` | 숫자가 너무 큼 |
| `TOO_FEW` | 배열 항목 수 부족 |
| `TOO_MANY` | 배열 항목 수 초과 |
| `INVALID_FORMAT` | 패턴 불일치 |
| `INVALID_ENUM` | 허용되지 않은 값 |
| `INVALID_INPUT` | 보안 위협 감지 (SQL Injection, XSS 등) |
| `CUSTOM_VALIDATION_FAILED` | 커스텀 검증 실패 |

### 프론트엔드 에러 처리

```typescript
try {
  const response = await fetch('/api/auth/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  })

  const data = await response.json()

  if (!data.success) {
    // 검증 에러 처리
    if (data.field) {
      // 특정 필드 에러 하이라이트
      highlightFieldError(data.field, data.error)
    } else {
      // 일반 에러 메시지 표시
      showErrorMessage(data.error)
    }
  }
} catch (error) {
  console.error('Request failed:', error)
}
```

## 보안 기능

### SQL Injection 방지

```typescript
import { containsSqlInjection } from './lib/validation'

const searchQuery = userInput

if (containsSqlInjection(searchQuery)) {
  // 악의적 쿼리 차단
  return c.json({ success: false, error: '허용되지 않은 문자가 포함되어 있습니다.' }, 400)
}

// 안전한 검색 수행
const results = await DB.prepare('SELECT * FROM products WHERE name LIKE ?')
  .bind(`%${searchQuery}%`)
  .all()
```

**탐지 패턴**:
- SQL 키워드: SELECT, INSERT, UPDATE, DELETE, DROP, etc.
- UNION 공격: UNION ALL, UNION SELECT
- 주석 패턴: `--`, `/*`, `*/`
- Boolean 기반 공격: `OR 1=1`, `AND 1=1`

### XSS 방지

```typescript
import { containsXss, sanitizeHtml } from './lib/validation'

const userComment = userInput

// XSS 패턴 감지
if (containsXss(userComment)) {
  return c.json({ success: false, error: '허용되지 않은 내용이 포함되어 있습니다.' }, 400)
}

// 또는 HTML 태그 제거
const sanitized = sanitizeHtml(userComment)
```

**탐지 패턴**:
- 스크립트 태그: `<script>`, `</script>`
- 이벤트 핸들러: onclick, onerror, onload, etc.
- JavaScript 프로토콜: `javascript:`
- 위험한 태그: `<iframe>`, `<object>`, `<embed>`

### HTML 정제 (Sanitization)

```typescript
import { sanitizeHtml } from './lib/validation'

const userInput = '<script>alert("XSS")</script>Hello <b>World</b>'
const sanitized = sanitizeHtml(userInput)
// 결과: "Hello World" (모든 HTML 태그 제거)
```

## 타입 검증 상세

### Email 검증

```typescript
{
  field: 'email',
  type: 'email',
  // 검증 로직:
  // - @와 . 포함
  // - 최대 255자
  // - RFC 5322 기본 형식 준수
}
```

**유효한 이메일**:
- `user@example.com` ✅
- `john.doe@company.co.kr` ✅
- `test+tag@domain.com` ✅

**유효하지 않은 이메일**:
- `user@` ❌
- `@example.com` ❌
- `user@.com` ❌
- `user@domain` ❌

### Phone 검증 (한국 전화번호)

```typescript
{
  field: 'phone',
  type: 'phone',
  // 검증 로직:
  // - 010, 011, 016, 017, 018, 019로 시작
  // - 하이픈 포함/미포함 모두 허용
}
```

**유효한 전화번호**:
- `010-1234-5678` ✅
- `01012345678` ✅
- `011-123-4567` ✅
- `01912345678` ✅

**유효하지 않은 전화번호**:
- `010-12-34` ❌ (자릿수 부족)
- `02-1234-5678` ❌ (010으로 시작 안 함)
- `010-abcd-1234` ❌ (숫자 아님)

### URL 검증

```typescript
{
  field: 'website',
  type: 'url',
  // 검증 로직:
  // - http:// 또는 https:// 시작
  // - 유효한 도메인 형식
}
```

**유효한 URL**:
- `https://example.com` ✅
- `http://www.example.com/path` ✅
- `https://example.com:8080/api` ✅

**유효하지 않은 URL**:
- `example.com` ❌ (프로토콜 없음)
- `ftp://example.com` ❌ (http/https만 허용)
- `javascript:alert('xss')` ❌ (보안 위험)

### Date 검증

```typescript
{
  field: 'birthdate',
  type: 'date',
  // 검증 로직:
  // - ISO 8601 형식 (YYYY-MM-DD)
  // - Date 객체로 파싱 가능
}
```

**유효한 날짜**:
- `2026-02-22` ✅
- `2026-02-22T10:30:00Z` ✅
- `new Date()` ✅

**유효하지 않은 날짜**:
- `02/22/2026` ❌
- `2026-13-01` ❌ (잘못된 월)
- `invalid` ❌

## 적용 가이드

### 1. 기존 엔드포인트에 적용

```typescript
// Before (검증 없음)
app.post('/api/products', async (c) => {
  const { name, price } = await c.req.json()
  // 검증 없이 바로 사용 (위험!)
})

// After (검증 추가)
app.post('/api/products', validate(ProductCreationRules), async (c) => {
  const { name, price } = c.get('validatedData')
  // 검증된 데이터 사용 (안전!)
})
```

### 2. 단계별 마이그레이션

**Phase 1: Critical 엔드포인트 (우선순위 높음)**
- ✅ 회원가입: `/api/auth/user/register`
- ⏳ 로그인: `/api/auth/user/login`
- ⏳ 결제 확인: `/api/payments/confirm`
- ⏳ 주문 생성: `/api/orders`

**Phase 2: High 엔드포인트**
- ⏳ 상품 생성/수정: `/api/products`
- ⏳ 알림톡 발송: `/api/seller/alimtalk/send`
- ⏳ 파일 업로드: `/api/*/upload`

**Phase 3: Medium 엔드포인트**
- ⏳ 검색: `/api/search`
- ⏳ 리뷰 작성: `/api/reviews`
- ⏳ 댓글 작성: `/api/comments`

### 3. 테스트 가이드

```bash
# 유효한 요청 테스트
curl -X POST http://localhost:3000/api/auth/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "name": "Test User"
  }'

# 검증 실패 테스트 (짧은 비밀번호)
curl -X POST http://localhost:3000/api/auth/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "123",
    "name": "Test User"
  }'

# 예상 응답:
# {
#   "success": false,
#   "error": "비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다.",
#   "field": "password",
#   "code": "TOO_SHORT"
# }
```

## 성능 고려사항

### 1. 검증 순서 최적화

검증은 다음 순서로 수행됩니다 (실패 시 즉시 중단):

1. **필수 필드 체크** (가장 빠름)
2. **타입 체크** (빠름)
3. **길이/범위 체크** (빠름)
4. **패턴 매칭** (중간)
5. **커스텀 검증** (느림)

### 2. 정규식 최적화

```typescript
// 비효율적 (매번 컴파일)
pattern: new RegExp('^[a-z]+$')

// 효율적 (사전 컴파일)
pattern: /^[a-z]+$/

// 매우 복잡한 정규식은 피하기
// ❌ pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/
// ✅ 간단한 검증 + 커스텀 함수 조합
```

### 3. 캐싱 전략

반복적인 검증은 결과를 캐싱:

```typescript
const validationCache = new Map<string, boolean>()

function isCachedValid(key: string, value: any, rule: ValidationRule): boolean {
  const cacheKey = `${key}:${JSON.stringify(value)}`
  
  if (validationCache.has(cacheKey)) {
    return validationCache.get(cacheKey)!
  }
  
  try {
    validateValue(value, rule)
    validationCache.set(cacheKey, true)
    return true
  } catch {
    validationCache.set(cacheKey, false)
    return false
  }
}
```

## 모범 사례

### 1. 명확한 에러 메시지

```typescript
// ❌ 모호한 메시지
{ field: 'password', message: '잘못된 비밀번호입니다.' }

// ✅ 구체적인 메시지
{ field: 'password', message: '비밀번호는 최소 8자 이상, 대소문자와 숫자를 포함해야 합니다.' }
```

### 2. 일관된 검증 규칙

동일한 필드에 대해서는 항상 같은 규칙 사용:

```typescript
// ✅ 재사용 가능한 규칙 정의
const EmailRule: ValidationRule = {
  field: 'email',
  required: true,
  type: 'email',
  max: 255
}

// 모든 엔드포인트에서 동일하게 사용
const UserRegistrationRules = [EmailRule, ...]
const UserLoginRules = [EmailRule, ...]
const PasswordResetRules = [EmailRule, ...]
```

### 3. 보안과 사용성 균형

```typescript
// ❌ 너무 엄격 (사용자 불편)
{ field: 'password', min: 20, pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/ }

// ✅ 적절한 균형
{ field: 'password', min: 8, pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/ }
```

## 관련 문서

- [Rate Limiting Guide](./RATE_LIMITING_GUIDE.md)
- [Service Completeness Analysis](./SERVICE_COMPLETENESS_ANALYSIS.md)

## 변경 이력

- **2026-02-22**: 백엔드 입력 검증 시스템 초기 구현
  - 6가지 사전 정의된 검증 규칙
  - SQL Injection 및 XSS 방어
  - 유연한 검증 미들웨어
  - 한국어 지원 (전화번호, 에러 메시지)
