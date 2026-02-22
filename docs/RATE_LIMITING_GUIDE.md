# Rate Limiting 가이드

## 개요

UR Live 플랫폼의 Rate Limiting 시스템은 DDoS 공격, 무차별 대입 공격, API 남용을 방지하고 서비스 안정성을 보장합니다.

## 주요 기능

### 1. Cloudflare Workers 최적화
- **KV 스토리지 기반**: 분산 환경에서도 정확한 Rate Limiting
- **In-memory Fallback**: KV 장애 시 로컬 메모리 사용
- **지연 시간 최소화**: Edge에서 즉시 처리

### 2. IP 기반 제한
- **CF-Connecting-IP 헤더**: Cloudflare의 실제 클라이언트 IP 사용
- **프록시 보호**: X-Forwarded-For 헤더 대비 위조 방지
- **화이트리스트**: 특정 IP 제외 가능

### 3. 유연한 정책 관리
- **경로별 제한**: 엔드포인트마다 다른 정책 적용
- **인증 사용자 우대**: 인증된 사용자에게 더 높은 제한 적용
- **실시간 조정**: 설정 변경 후 즉시 적용

## 기본 정책

| 정책 | 시간 윈도우 | 최대 요청 | 인증 시 | 적용 경로 | 목적 |
|------|------------|----------|---------|----------|------|
| **auth** | 1분 | 5회 | - | `/api/auth/*` | 무차별 대입 공격 방지 |
| **alimtalk** | 1분 | 10회 | - | `/api/seller/alimtalk/send` | 비용 발생 방지 |
| **order** | 1분 | 10회 | 20회 | `/api/orders` | 주문 남용 방지 |
| **cart** | 1분 | 20회 | 40회 | `/api/cart` | 장바구니 남용 방지 |
| **search** | 1분 | 30회 | - | `/api/search` | 검색 과부하 방지 |
| **upload** | 1분 | 5회 | - | `/api/*/upload` | 파일 업로드 제한 |
| **api** | 1분 | 60회 | 120회 | `/api/*` | 일반 API 보호 |
| **strict** | 1분 | 3회 | - | 커스텀 | 민감한 작업용 |
| **loose** | 1분 | 120회 | 180회 | 커스텀 | 조회 작업용 |

## 사용법

### 기본 사용

```typescript
import { rateLimit, RateLimitPolicies } from './middleware/rateLimit'

// 인증 엔드포인트 보호
app.use(rateLimit(RateLimitPolicies.auth))

// 주문 엔드포인트 보호
app.use(rateLimit(RateLimitPolicies.order))
```

### 커스텀 정책

```typescript
// 커스텀 Rate Limiter
app.use(rateLimit({
  windowMs: 300, // 5분
  maxRequests: 100,
  message: '요청이 너무 많습니다. 5분 후 다시 시도해주세요.',
  pathPattern: /^\/api\/admin/,
  authenticatedMultiplier: 3 // 인증 시 300회
}))
```

### 특정 경로만 제한

```typescript
// 특정 경로에만 적용
app.use(rateLimit({
  windowMs: 60,
  maxRequests: 10,
  pathPattern: /^\/api\/expensive-operation/
}))
```

### 화이트리스트

```typescript
// 특정 IP 제외
app.use(rateLimit({
  windowMs: 60,
  maxRequests: 30,
  skipIps: [
    '127.0.0.1',
    '10.0.0.1', // 내부 IP
    '192.168.1.1' // 관리자 IP
  ]
}))
```

### 여러 정책 조합

```typescript
import { multiRateLimit, rateLimit, RateLimitPolicies } from './middleware/rateLimit'

// 여러 제한을 동시에 적용
app.use(multiRateLimit(
  rateLimit(RateLimitPolicies.auth),
  rateLimit({
    windowMs: 3600, // 1시간
    maxRequests: 1000
  })
))
```

## 응답 헤더

Rate Limiting이 적용되면 다음 헤더가 응답에 포함됩니다:

```http
X-RateLimit-Limit: 60          # 최대 요청 수
X-RateLimit-Remaining: 45      # 남은 요청 수
X-RateLimit-Reset: 2026-02-22T08:00:00.000Z  # 리셋 시간
```

제한 초과 시:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45                # 재시도까지 남은 초
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2026-02-22T08:00:00.000Z

{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "retryAfter": 45,
  "resetTime": "2026-02-22T08:00:00.000Z"
}
```

## KV 네임스페이스 설정

### 1. KV 네임스페이스 생성

```bash
# Production KV
npx wrangler kv namespace create RATE_LIMIT_KV

# Preview KV (로컬 개발용)
npx wrangler kv namespace create RATE_LIMIT_KV --preview
```

### 2. wrangler.jsonc 설정

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "RATE_LIMIT_KV",
      "id": "your-production-id",
      "preview_id": "your-preview-id"
    }
  ]
}
```

### 3. 타입 정의 업데이트

```typescript
// src/types/env.ts
export interface CloudflareBindings {
  RATE_LIMIT_KV: KVNamespace;
  // ... 기타 바인딩
}
```

## 모니터링

### KV 사용량 확인

```bash
# Rate Limiting 키 조회
npx wrangler kv key list --binding RATE_LIMIT_KV

# 특정 키 확인
npx wrangler kv key get "ratelimit:1.2.3.4:/api/auth/login" --binding RATE_LIMIT_KV
```

### 로그 분석

```bash
# 429 응답 필터링
wrangler tail --format json | grep '"status":429'

# Rate Limit 초과 IP 추출
wrangler tail --format json | jq 'select(.outcome == "ok" and .status == 429) | .request.headers["CF-Connecting-IP"]'
```

## 성능 최적화

### KV 읽기/쓰기 최소화

Rate Limiting 미들웨어는 다음 최적화를 적용합니다:

1. **TTL 설정**: KV 키는 자동으로 만료되어 수동 삭제 불필요
2. **배치 처리**: 가능한 경우 여러 요청을 한 번에 처리
3. **Fallback 메커니즘**: KV 실패 시 in-memory 사용

### 비용 최적화

```typescript
// 무료 티어 고려 (월 10만 읽기, 1만 쓰기)
// 읽기/쓰기 비율: 1:1 (각 요청마다 1번 읽고 1번 쓰기)
// 예상 월간 요청: 5만 회 (무료 티어 내)
```

## 문제 해결

### Rate Limit이 작동하지 않음

```bash
# 1. KV 바인딩 확인
npx wrangler pages deployment list --project-name ur-live

# 2. 환경 변수 확인
curl https://live.ur-team.com/api/test/env | jq '.env.RATE_LIMIT_KV'

# 3. 로그 확인
npx wrangler tail ur-live --format pretty
```

### 너무 많은 429 오류

```typescript
// 정책 완화
app.use(rateLimit({
  windowMs: 60,
  maxRequests: 100, // 기존 60에서 증가
  authenticatedMultiplier: 3 // 인증 시 300회
}))
```

### 특정 사용자 화이트리스트

```typescript
// IP 기반 화이트리스트
app.use(rateLimit({
  windowMs: 60,
  maxRequests: 30,
  skipIps: ['1.2.3.4'] // 관리자 IP
}))

// 또는 인증 기반 제외
app.use(async (c, next) => {
  const user = c.get('user')
  if (user?.role === 'admin') {
    return next() // Rate Limit 건너뛰기
  }
  return rateLimit(RateLimitPolicies.api)(c, next)
})
```

## 보안 고려사항

### 1. IP 위조 방지

Cloudflare Workers는 `CF-Connecting-IP` 헤더를 사용하여 실제 클라이언트 IP를 보장합니다. 이 헤더는 Cloudflare에서만 설정할 수 있어 위조 불가능합니다.

### 2. 분산 공격 대응

여러 IP에서 오는 공격은 IP별 Rate Limiting으로 제한되지만, 대규모 봇넷 공격의 경우 Cloudflare의 추가 보안 기능을 활용하세요:

```bash
# Cloudflare Dashboard에서 설정:
# 1. Security > WAF > Rate Limiting Rules
# 2. Bot Fight Mode 활성화
# 3. Challenge Passage 설정
```

### 3. 계정 기반 제한

IP 외에도 인증된 사용자 계정 기반 제한을 추가할 수 있습니다:

```typescript
function getUserKey(c: Context): string {
  const user = c.get('user')
  if (user) {
    return `user:${user.id}`
  }
  return `ip:${getClientIp(c)}`
}
```

## 테스트

### 로컬 테스트

```bash
# 1. 로컬 서버 시작
npm run dev

# 2. 요청 스크립트 실행
for i in {1..65}; do
  curl -s http://localhost:3000/api/test \
    -H "CF-Connecting-IP: 1.2.3.4" \
    | jq -r '.success, .error'
done

# 60회 이후 429 응답 확인
```

### 부하 테스트

```bash
# Apache Bench로 테스트
ab -n 1000 -c 10 \
  -H "CF-Connecting-IP: 1.2.3.4" \
  https://live.ur-team.com/api/test

# 예상 결과:
# - 60개 요청: 200 OK
# - 940개 요청: 429 Too Many Requests
```

## 모범 사례

### 1. 점진적 제한

```typescript
// 처음에는 느슨하게, 문제 발생 시 강화
const initialPolicy = {
  windowMs: 60,
  maxRequests: 120 // 느슨한 제한
}

// 문제 발생 후
const strictPolicy = {
  windowMs: 60,
  maxRequests: 30 // 엄격한 제한
}
```

### 2. 경로별 맞춤 설정

```typescript
// 조회 작업: 느슨한 제한
app.get('/api/products', rateLimit(RateLimitPolicies.loose))

// 변경 작업: 엄격한 제한
app.post('/api/orders', rateLimit(RateLimitPolicies.strict))
```

### 3. 사용자 피드백

```typescript
// 명확한 에러 메시지
app.use(rateLimit({
  windowMs: 60,
  maxRequests: 10,
  message: '주문 요청이 너무 빈번합니다. 1분에 10회까지 가능합니다.'
}))
```

## 관련 문서

- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Service Completeness Analysis](./SERVICE_COMPLETENESS_ANALYSIS.md)

## 변경 이력

- **2026-02-22**: Rate Limiting 시스템 초기 구현
  - KV 기반 분산 Rate Limiting
  - 9가지 사전 정의된 정책
  - IP 화이트리스트 지원
  - 인증 사용자 우대 정책
