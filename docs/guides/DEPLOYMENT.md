# 배포 가이드

## 사전 준비

```bash
# Wrangler 로그인
wrangler login

# 프로젝트 확인
wrangler pages list
```

## 환경 변수 / 시크릿 설정

### 필수 시크릿 (최초 1회)
```bash
# 인증
wrangler secret put JWT_SECRET              # 32자 이상 랜덤 문자열

# Firebase Admin
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put FIREBASE_PRIVATE_KEY   # "-----BEGIN PRIVATE KEY-----\n..." 형식
wrangler secret put FIREBASE_CLIENT_EMAIL

# Toss Payments
wrangler secret put TOSS_SECRET_KEY        # sk_live_... 또는 test_sk_...
wrangler secret put TOSS_WEBHOOK_SECRET    # Toss 콘솔에서 발급

# Kakao OAuth
wrangler secret put KAKAO_REST_API_KEY
```

### 선택 시크릿
```bash
wrangler secret put SENTRY_DSN             # 에러 모니터링
wrangler secret put DISCORD_WEBHOOK_URL    # 결제 이벤트 알림
wrangler secret put STRIPE_SECRET_KEY      # 글로벌 결제 (sk_live_...)
wrangler secret put STRIPE_WEBHOOK_SECRET  # Stripe 웹훅 검증
wrangler secret put YOUTUBE_API_KEY        # YouTube Live 연동
```

### 프론트엔드 환경 변수
Cloudflare Pages 대시보드 → 프로젝트 → Settings → Environment variables:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_APP_ID
VITE_TOSS_CLIENT_KEY
VITE_STRIPE_PUBLISHABLE_KEY   (글로벌 선택)
VITE_SENTRY_DSN               (선택)
```

## 배포 명령

```bash
# 빌드 + 배포 (한 번에)
npm run deploy

# 단계별 실행
npm run build           # 클라이언트 + Worker 빌드
wrangler pages deploy dist/client --project-name=ur-live-working
```

## 데이터베이스 마이그레이션

```bash
# 프로덕션 전체 마이그레이션 (주의!)
npm run db:migrate:all:prod

# 특정 마이그레이션만
wrangler d1 execute marketplace-db --file=migrations/0111_new_feature.sql
```

## Toss Payments 웹훅 설정

1. [Toss 개발자센터](https://developers.tosspayments.com/) 로그인
2. 내 프로젝트 → 웹훅 설정
3. URL: `https://live.ur-team.com/api/payments/webhook`
4. 이벤트: `payment.confirmed`, `payment.cancelled`, `payment.failed`, `payment.virtual_account_issued`, `payment.virtual_account_deposited`
5. 웹훅 시크릿 발급 → `wrangler secret put TOSS_WEBHOOK_SECRET`

## 배포 후 확인

```bash
# Worker 상태
curl https://live.ur-team.com/api/health

# 결제 웹훅 테스트
curl -X POST https://live.ur-team.com/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"eventType":"test"}'
```

## 롤백

```bash
# 이전 배포로 롤백 (Cloudflare Pages 콘솔에서도 가능)
wrangler pages deployment list --project-name=ur-live-working
wrangler pages deployment rollback <deployment-id> --project-name=ur-live-working
```
