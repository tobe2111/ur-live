# 🌍 UR Live 글로벌 런칭 체크리스트

> **목표**: 프로덕션 환경 글로벌 배포 완벽 준비  
> **작성일**: 2026-03-06  
> **예상 소요 시간**: 30분  
> **대상**: DevOps, 백엔드 개발자

---

## 📋 목차

1. [런칭 전 체크리스트](#런칭-전-체크리스트)
2. [도메인 및 DNS 설정](#도메인-및-dns-설정)
3. [환경 변수 설정](#환경-변수-설정)
4. [Firebase 설정](#firebase-설정)
5. [Stripe 설정](#stripe-설정)
6. [배포 스크립트](#배포-스크립트)
7. [헬스 체크](#헬스-체크)
8. [런칭 후 모니터링](#런칭-후-모니터링)
9. [롤백 계획](#롤백-계획)

---

## 런칭 전 체크리스트

### ✅ 코드 품질

- [ ] **단위 테스트 통과**: `npm run test:unit` → 73.18% 커버리지 이상
- [ ] **E2E 테스트 통과**: `npm run test:e2e` → 17 tests 모두 통과
- [ ] **타입 체크 통과**: `npm run type-check` → 0 errors
- [ ] **ESLint 통과**: `npx eslint src/**/*.{ts,tsx}` → 0 errors
- [ ] **빌드 성공**: `npm run build` → dist/ 폴더 생성
- [ ] **프로덕션 빌드 확인**: `npm run preview` → 로컬에서 정상 작동

### ✅ 보안

- [ ] **환경 변수 암호화**: `.env.production` 파일 Git에 커밋 금지
- [ ] **API 키 보안**: Firebase, Stripe, Kakao API 키 Cloudflare Secrets에 저장
- [ ] **CORS 설정**: `src/worker/middleware/cors.ts` 프로덕션 도메인 추가
- [ ] **Rate Limiting**: `src/worker/middleware/rateLimit.ts` 활성화
- [ ] **JWT 시크릿**: 프로덕션 환경 전용 JWT 시크릿 생성 (32자 이상)

### ✅ 성능

- [ ] **번들 크기 확인**: `npm run build` → dist/ 폴더 < 5MB
- [ ] **코드 스플리팅**: React Router lazy loading 적용
- [ ] **이미지 최적화**: public/ 폴더 이미지 WebP 변환
- [ ] **CDN 캐싱**: Cloudflare Pages CDN 설정 확인
- [ ] **Lighthouse 점수**: Performance 90+ / Accessibility 95+

### ✅ 데이터베이스

- [ ] **D1 프로덕션 마이그레이션**: `npm run db:migrate:prod` 실행
- [ ] **백업 설정**: Cloudflare D1 자동 백업 활성화
- [ ] **인덱스 확인**: `src/worker/db/schema.ts` 인덱스 최적화

### ✅ 모니터링

- [ ] **Sentry 설정**: 프로덕션 DSN 환경 변수 추가
- [ ] **Sentry Alerts**: 에러율 알림 설정 (5% 이상)
- [ ] **Cloudflare Analytics**: 활성화 및 대시보드 확인
- [ ] **헬스 체크 엔드포인트**: `/api/health` 정상 응답 확인

---

## 도메인 및 DNS 설정

### 1️⃣ 도메인 구매 (완료)

- **한국 도메인**: `live.ur-team.com` (기존 사용 중)
- **글로벌 도메인**: `live-global.ur-team.com` (신규)

### 2️⃣ Cloudflare Pages 프로젝트 생성

```bash
# Cloudflare Pages 프로젝트 생성 (수동)
# 1. Cloudflare 대시보드 접속: https://dash.cloudflare.com/
# 2. Pages → Create a project
# 3. Connect to Git → GitHub 연결
# 4. 프로젝트 선택: tobe2111/ur-live
# 5. 프로젝트 이름: ur-live-global
# 6. Build settings:
#    - Build command: npm run build
#    - Build output directory: dist
# 7. Environment variables 추가 (아래 섹션 참고)
```

### 3️⃣ DNS 설정

**Cloudflare DNS 레코드 추가**:

| Type  | Name                 | Content                  | Proxy Status | TTL  |
|-------|----------------------|--------------------------|--------------|------|
| CNAME | live-global          | ur-live-global.pages.dev | Proxied      | Auto |
| CNAME | www.live-global      | ur-live-global.pages.dev | Proxied      | Auto |

**TTL**: Auto (Cloudflare 권장)  
**Proxy Status**: Proxied (CDN 활성화)

### 4️⃣ 커스텀 도메인 연결

```bash
# Cloudflare Pages에서 커스텀 도메인 추가
# 1. Cloudflare 대시보드 → Pages → ur-live-global
# 2. Custom domains → Set up a custom domain
# 3. 도메인 입력: live-global.ur-team.com
# 4. DNS 레코드 자동 생성 확인
# 5. SSL/TLS 인증서 자동 발급 대기 (1-5분)
```

### 5️⃣ SSL/TLS 설정

```bash
# Cloudflare SSL/TLS 설정 확인
# 1. Cloudflare 대시보드 → SSL/TLS
# 2. SSL/TLS encryption mode: Full (strict) 선택
# 3. Edge Certificates → Always Use HTTPS: On
# 4. Minimum TLS Version: TLS 1.2
```

---

## 환경 변수 설정

### 1️⃣ Cloudflare Pages 환경 변수 추가

**Cloudflare 대시보드**:
1. Pages → ur-live-global → Settings → Environment variables
2. Production 탭 선택
3. 아래 변수 추가:

```env
# Firebase (프로덕션)
VITE_FIREBASE_API_KEY=AIzaSyC...production-key
VITE_FIREBASE_AUTH_DOMAIN=ur-live-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ur-live-prod
VITE_FIREBASE_STORAGE_BUCKET=ur-live-prod.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Kakao (프로덕션)
VITE_KAKAO_REST_API_KEY=prod-kakao-key
VITE_KAKAO_JAVASCRIPT_KEY=prod-kakao-js-key
VITE_KAKAO_AUTH_URL=https://kauth.kakao.com/oauth/authorize

# Google OAuth (프로덕션)
VITE_GOOGLE_CLIENT_ID=prod-google-client-id.apps.googleusercontent.com

# Stripe (프로덕션)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...production-key

# Toss Payments (프로덕션)
VITE_TOSS_CLIENT_KEY=live_ck_...production-key

# Sentry (프로덕션)
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_RELEASE=1.0.0

# API URLs
VITE_API_URL=https://live-global.ur-team.com/api
VITE_WORKER_URL=https://live-global.ur-team.com

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_SENTRY=true
VITE_ENABLE_DEBUG=false

# Region
VITE_REGION=global
```

### 2️⃣ Cloudflare Workers 환경 변수 (Secrets)

```bash
# Wrangler를 사용한 시크릿 추가
wrangler secret put JWT_SECRET --env production
# 프롬프트: 32자 이상 랜덤 문자열 입력

wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY --env production
# 프롬프트: Firebase Admin SDK JSON 전체 내용 입력

wrangler secret put STRIPE_SECRET_KEY --env production
# 프롬프트: Stripe Secret Key 입력 (sk_live_...)

wrangler secret put TOSS_SECRET_KEY --env production
# 프롬프트: Toss Secret Key 입력
```

---

## Firebase 설정

### 1️⃣ Firebase 프로젝트 생성

```bash
# Firebase Console: https://console.firebase.google.com/
# 1. Add project → ur-live-prod
# 2. Google Analytics 활성화
# 3. 프로젝트 생성 완료
```

### 2️⃣ Firebase Authentication 설정

```bash
# Firebase Console → ur-live-prod → Authentication
# 1. Sign-in method 탭
# 2. Email/Password 활성화
# 3. Google 활성화
#    - OAuth client ID: prod-google-client-id
#    - OAuth client secret: [시크릿]
# 4. 승인된 도메인 추가:
#    - live-global.ur-team.com
#    - ur-live-global.pages.dev
```

### 3️⃣ Firebase Realtime Database 설정

```bash
# Firebase Console → ur-live-prod → Realtime Database
# 1. Create Database → us-central1 (또는 가까운 리전)
# 2. Security Rules:
{
  "rules": {
    "live": {
      "$liveId": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == data.child('hostId').val()"
      }
    },
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

### 4️⃣ Firebase Admin SDK 설정

```bash
# Firebase Console → ur-live-prod → Project settings
# 1. Service accounts 탭
# 2. Generate new private key
# 3. JSON 파일 다운로드
# 4. Wrangler Secret으로 추가:
wrangler secret put FIREBASE_SERVICE_ACCOUNT_KEY --env production
# JSON 파일 전체 내용 붙여넣기
```

---

## Stripe 설정

### 1️⃣ Stripe 계정 활성화

```bash
# Stripe Dashboard: https://dashboard.stripe.com/
# 1. Account settings → Activate account
# 2. 회사 정보, 은행 정보 입력
# 3. 신원 확인 완료
# 4. 계정 활성화 완료 (1-2일 소요)
```

### 2️⃣ Stripe API 키 확인

```bash
# Stripe Dashboard → Developers → API keys
# 1. Publishable key (pk_live_...) 복사
#    → VITE_STRIPE_PUBLISHABLE_KEY 환경 변수
# 2. Secret key (sk_live_...) 복사
#    → Wrangler Secret: STRIPE_SECRET_KEY
```

### 3️⃣ Stripe Webhook 설정

```bash
# Stripe Dashboard → Developers → Webhooks
# 1. Add endpoint
# 2. Endpoint URL: https://live-global.ur-team.com/api/webhooks/stripe
# 3. Events to listen:
#    - payment_intent.succeeded
#    - payment_intent.payment_failed
#    - checkout.session.completed
#    - customer.subscription.created
#    - customer.subscription.updated
#    - customer.subscription.deleted
# 4. Webhook signing secret 복사 (whsec_...)
#    → Wrangler Secret: STRIPE_WEBHOOK_SECRET
```

### 4️⃣ Stripe 상품 생성

```bash
# Stripe Dashboard → Products → Add product
# 1. 상품명: UR Live Stream
# 2. 가격: $9.99 / month (또는 원하는 가격)
# 3. Recurring: Monthly
# 4. Product ID 복사 (price_...)
#    → 코드에 하드코딩 또는 환경 변수
```

---

## 배포 스크립트

### 1️⃣ 자동 배포 스크립트 생성

**`scripts/deploy-global.sh`**:

```bash
#!/bin/bash

set -e  # 에러 발생 시 즉시 중단

echo "🚀 Starting global deployment..."

# Step 1: 환경 확인
echo "📋 Step 1/7: Checking environment..."
if [ ! -f ".env.production" ]; then
  echo "❌ Error: .env.production file not found"
  exit 1
fi

node --version
npm --version
echo "✅ Environment OK"

# Step 2: 의존성 설치
echo "📦 Step 2/7: Installing dependencies..."
npm ci
echo "✅ Dependencies installed"

# Step 3: 타입 체크
echo "🔍 Step 3/7: Running type check..."
npm run type-check
echo "✅ Type check passed"

# Step 4: 단위 테스트
echo "🧪 Step 4/7: Running unit tests..."
npm run test:unit
echo "✅ Unit tests passed"

# Step 5: 빌드
echo "🏗️  Step 5/7: Building production bundle..."
NODE_ENV=production npm run build
echo "✅ Build completed"

# Step 6: 배포
echo "🌍 Step 6/7: Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name ur-live-global
echo "✅ Deployment completed"

# Step 7: 헬스 체크
echo "💚 Step 7/7: Running health check..."
sleep 10  # 배포 완료 대기
HEALTH_URL="https://live-global.ur-team.com/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$RESPONSE" -eq 200 ]; then
  echo "✅ Health check passed: $HEALTH_URL"
else
  echo "❌ Health check failed: HTTP $RESPONSE"
  exit 1
fi

echo "🎉 Global deployment completed successfully!"
echo "🌐 URL: https://live-global.ur-team.com"
```

### 2️⃣ 스크립트 실행 권한 추가

```bash
chmod +x scripts/deploy-global.sh
```

### 3️⃣ 배포 실행

```bash
# 프로덕션 배포
./scripts/deploy-global.sh

# 예상 출력:
# 🚀 Starting global deployment...
# ✅ Environment OK
# ✅ Dependencies installed
# ✅ Type check passed
# ✅ Unit tests passed
# ✅ Build completed
# ✅ Deployment completed
# ✅ Health check passed
# 🎉 Global deployment completed successfully!
# 🌐 URL: https://live-global.ur-team.com
```

### 4️⃣ package.json 스크립트 추가

```json
{
  "scripts": {
    "deploy:global": "./scripts/deploy-global.sh",
    "deploy:global:quick": "npm run build && wrangler pages deploy dist --project-name ur-live-global"
  }
}
```

---

## 헬스 체크

### 1️⃣ 헬스 체크 엔드포인트 구현

**`src/worker/routes/health.ts`** (이미 존재하는 경우 확인):

```typescript
import { Hono } from 'hono'

const health = new Hono()

health.get('/', async (c) => {
  const startTime = Date.now()

  // Database check
  let dbStatus = 'healthy'
  try {
    await c.env.DB.prepare('SELECT 1').first()
  } catch (error) {
    dbStatus = 'unhealthy'
    console.error('Database health check failed:', error)
  }

  // KV check
  let kvStatus = 'healthy'
  try {
    await c.env.KV.get('health-check')
  } catch (error) {
    kvStatus = 'unhealthy'
    console.error('KV health check failed:', error)
  }

  const responseTime = Date.now() - startTime

  const healthData = {
    status: dbStatus === 'healthy' && kvStatus === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      database: dbStatus,
      kv: kvStatus,
    },
    responseTime: `${responseTime}ms`,
  }

  const statusCode = healthData.status === 'healthy' ? 200 : 503

  return c.json(healthData, statusCode)
})

export default health
```

### 2️⃣ 헬스 체크 테스트

```bash
# 로컬 테스트
curl -i http://localhost:3000/api/health

# 프로덕션 테스트
curl -i https://live-global.ur-team.com/api/health

# 예상 응답:
# HTTP/2 200
# {
#   "status": "healthy",
#   "timestamp": "2026-03-06T12:00:00.000Z",
#   "version": "1.0.0",
#   "checks": {
#     "database": "healthy",
#     "kv": "healthy"
#   },
#   "responseTime": "15ms"
# }
```

### 3️⃣ 헬스 체크 모니터링 (Uptime Robot)

```bash
# Uptime Robot 설정: https://uptimerobot.com/
# 1. Add New Monitor
# 2. Monitor Type: HTTP(s)
# 3. Friendly Name: UR Live Global Health
# 4. URL: https://live-global.ur-team.com/api/health
# 5. Monitoring Interval: 5 minutes
# 6. Alert Contacts: 이메일/Slack 추가
```

---

## 런칭 후 모니터링

### 1️⃣ Sentry 대시보드 확인

```bash
# Sentry: https://sentry.io/
# 1. Projects → ur-live-prod
# 2. Issues 탭 → 에러 발생 여부 확인
# 3. Performance 탭 → 평균 응답 시간 확인
# 4. Releases 탭 → 배포 버전 확인
```

**주요 지표**:
- Error Rate: < 1%
- Response Time: < 500ms (p95)
- User Satisfaction (Apdex): > 0.9

### 2️⃣ Cloudflare Analytics

```bash
# Cloudflare 대시보드: https://dash.cloudflare.com/
# 1. Pages → ur-live-global → Analytics
# 2. 주요 지표:
#    - Total Requests
#    - Cache Hit Rate (목표: > 90%)
#    - Bandwidth Usage
#    - Error Rate (목표: < 0.1%)
```

### 3️⃣ 실시간 로그 모니터링

```bash
# Cloudflare Workers 로그
wrangler tail --env production

# 실시간 로그 출력:
# 2026-03-06T12:00:00.000Z GET /api/users/me 200 15ms
# 2026-03-06T12:00:05.000Z POST /api/auth/login 200 120ms
# 2026-03-06T12:00:10.000Z GET /api/health 200 10ms
```

### 4️⃣ 사용자 피드백 수집

```bash
# Google Analytics (GA4) 설정
# 1. Google Analytics: https://analytics.google.com/
# 2. Admin → Data Streams → Add stream
# 3. Web → URL: https://live-global.ur-team.com
# 4. Measurement ID 복사 (G-XXXXXXXXXX)
#    → VITE_FIREBASE_MEASUREMENT_ID 환경 변수
```

---

## 롤백 계획

### 1️⃣ Cloudflare Pages 롤백

```bash
# Cloudflare 대시보드에서 롤백
# 1. Pages → ur-live-global → Deployments
# 2. 이전 배포 선택
# 3. "Rollback to this deployment" 클릭
# 4. 확인 → 즉시 롤백 완료 (< 1분)
```

### 2️⃣ 환경 변수 롤백

```bash
# 환경 변수 백업 (배포 전)
wrangler pages deployment list --project-name ur-live-global > deployments-backup.txt

# 롤백 시 이전 환경 변수 수동 복원
# Cloudflare 대시보드 → Pages → Settings → Environment variables
```

### 3️⃣ 데이터베이스 롤백

```bash
# D1 백업 복원
wrangler d1 execute ur-live-prod --file=./backups/backup-2026-03-06.sql

# 백업 파일 확인
ls -lh ./backups/
```

### 4️⃣ 긴급 다운타임 공지

**다운타임 발생 시**:

1. **상태 페이지 업데이트**: https://status.ur-team.com
2. **소셜 미디어 공지**: Twitter, Facebook
3. **이메일 알림**: 사용자 대상
4. **Slack #incidents 채널**: 팀 내부 공유

**공지 템플릿**:
```
🚨 [긴급] UR Live 서비스 일시 중단

안녕하세요, UR Live 팀입니다.

현재 글로벌 서비스에 기술적 문제가 발생하여 일시적으로 서비스를 중단했습니다.

• 문제: [간단한 설명]
• 영향: 글로벌 사용자 (live-global.ur-team.com)
• 예상 복구 시간: [XX:XX UTC]

한국 서비스(live.ur-team.com)는 정상 작동 중입니다.

불편을 드려 죄송합니다.
```

---

## 📊 런칭 후 KPI 목표

| 지표                     | 목표             | 측정 방법                  |
|--------------------------|------------------|----------------------------|
| Uptime                   | 99.9%            | Uptime Robot               |
| Error Rate               | < 0.1%           | Sentry                     |
| Response Time (p95)      | < 500ms          | Sentry Performance         |
| Cache Hit Rate           | > 90%            | Cloudflare Analytics       |
| Lighthouse Performance   | > 90             | Manual test                |
| Daily Active Users (DAU) | 1,000+ (1주차)   | Google Analytics           |
| Sign-up Conversion Rate  | > 5%             | Custom analytics           |

---

## 🎯 최종 체크리스트 (배포 전)

- [ ] **코드 품질**: 단위 테스트 73.18%+, E2E 17 tests 통과
- [ ] **보안**: 환경 변수 암호화, API 키 Secrets 저장
- [ ] **성능**: 번들 < 5MB, Lighthouse 90+
- [ ] **도메인**: live-global.ur-team.com DNS 연결, SSL 인증서 발급
- [ ] **환경 변수**: Cloudflare Pages 프로덕션 환경 변수 30+ 추가
- [ ] **Firebase**: Authentication, Realtime Database, Admin SDK 설정
- [ ] **Stripe**: 계정 활성화, Webhook 설정, 상품 생성
- [ ] **배포 스크립트**: `./scripts/deploy-global.sh` 실행 권한, 테스트 완료
- [ ] **헬스 체크**: `/api/health` 엔드포인트 정상 응답
- [ ] **모니터링**: Sentry, Cloudflare Analytics, Uptime Robot 설정
- [ ] **롤백 계획**: 백업 파일 확보, 롤백 절차 숙지
- [ ] **팀 공유**: 배포 시간 공지, 온콜 담당자 지정

---

**작성자**: Claude (GenSpark AI Developer)  
**최종 업데이트**: 2026-03-06  
**문서 버전**: 1.0.0  
**대상**: DevOps, 백엔드 개발자  
**예상 소요 시간**: 30분 (준비 완료 시)

---

**다음 단계**:
1. 체크리스트 완료 후 `./scripts/deploy-global.sh` 실행
2. 헬스 체크 통과 확인
3. 사용자 피드백 수집
4. 지속적 모니터링 및 개선

**성공적인 글로벌 런칭을 기원합니다! 🚀🌍**
