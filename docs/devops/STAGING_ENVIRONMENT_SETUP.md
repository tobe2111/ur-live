# 🌐 스테이징 환경 구축 가이드

## 📋 목표
- 프로덕션과 동일한 스테이징 환경 구축
- 배포 전 안전한 테스트 환경 제공
- 자동화된 배포 파이프라인

---

## 🏗️ 아키텍처 개요

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Development    │───▶│   Staging        │───▶│   Production    │
│  localhost:5173 │    │  staging.ur-team │    │  live.ur-team   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
     ↓ Push                  ↓ Auto Deploy         ↓ Manual Deploy
   GitHub                 Cloudflare Pages      Cloudflare Pages
```

---

## 🎯 1. Cloudflare Pages 스테이징 프로젝트 생성

### 옵션 A: 웹 대시보드 (권장)

1. **Cloudflare Dashboard 접속**
   ```
   https://dash.cloudflare.com/
   ```

2. **새 프로젝트 생성**
   - Workers & Pages → Create → Pages → Connect to Git
   - 저장소 선택: `tobe2111/ur-live`
   - 프로젝트 이름: `ur-live-staging`

3. **빌드 설정**
   ```
   Framework preset: None
   Build command: npm run build:kr
   Build output directory: dist
   Root directory: (leave blank)
   ```

4. **브랜치 설정**
   ```
   Production branch: staging
   Preview branches: main, develop
   ```

### 옵션 B: Wrangler CLI

```bash
# 1. 스테이징 프로젝트 생성
npx wrangler pages project create ur-live-staging

# 2. 초기 배포
npm run build:kr
npx wrangler pages deploy dist --project-name=ur-live-staging --branch=staging

# 3. 커스텀 도메인 연결 (optional)
npx wrangler pages deployment create ur-live-staging \
  --custom-domain=staging.ur-team.com
```

---

## ⚙️ 2. 환경변수 설정

### Cloudflare Pages 환경변수 (Staging)

**중요**: 스테이징과 프로덕션은 **별도의 환경변수**를 사용해야 합니다.

#### 스테이징 환경변수 (Preview / Staging)

```bash
# 방법 1: 웹 대시보드
# Cloudflare Dashboard → ur-live-staging → Settings → Environment variables
# → Add variable (for Preview branches)

# 방법 2: Wrangler CLI
npx wrangler pages secret put VITE_FIREBASE_API_KEY --project-name=ur-live-staging
npx wrangler pages secret put VITE_KAKAO_REST_API_KEY --project-name=ur-live-staging
npx wrangler pages secret put VITE_TOSS_CLIENT_KEY --project-name=ur-live-staging
```

#### 필요한 환경변수 목록

```env
# Firebase (스테이징 전용)
VITE_FIREBASE_API_KEY=staging_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=staging-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=staging-project
VITE_FIREBASE_STORAGE_BUCKET=staging-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:staging123456
VITE_FIREBASE_MEASUREMENT_ID=G-STAGING123
VITE_FIREBASE_DATABASE_URL=https://staging-project-default-rtdb.asia-southeast1.firebasedatabase.app

# Kakao (테스트 앱)
VITE_KAKAO_APP_KEY=staging_kakao_app_key
VITE_KAKAO_REST_API_KEY=staging_kakao_rest_api_key
VITE_KAKAO_JAVASCRIPT_KEY=staging_kakao_javascript_key

# Toss Payments (테스트 키)
VITE_TOSS_CLIENT_KEY=test_gck_STAGING_KEY

# 기타
VITE_REGION=KR
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://staging.ur-team.com

# Backend Secrets
KAKAO_REST_API_KEY=staging_kakao_rest_api_key
JWT_SECRET=staging_jwt_secret_min_32_chars
EMAIL_FROM=no-reply@staging.ur-team.com
RESEND_API_KEY=re_staging_key
TOSS_SECRET_KEY=test_sk_STAGING_SECRET_KEY
```

---

## 🔗 3. 커스텀 도메인 설정

### Cloudflare DNS 설정

1. **Cloudflare Dashboard**
   ```
   Websites → ur-team.com → DNS → Records
   ```

2. **CNAME 레코드 추가**
   ```
   Type: CNAME
   Name: staging
   Target: ur-live-staging.pages.dev
   Proxy status: Proxied (orange cloud)
   TTL: Auto
   ```

3. **Pages에 도메인 연결**
   ```
   Cloudflare Pages → ur-live-staging → Custom domains
   → Set up a custom domain → staging.ur-team.com
   ```

4. **SSL 인증서 자동 발급** (10-15분 소요)

---

## 🚀 4. 자동 배포 파이프라인

### GitHub Actions Workflow

```yaml
# .github/workflows/staging-deploy.yml
name: Deploy to Staging

on:
  push:
    branches:
      - staging
      - develop
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Lint
        run: npm run lint
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build:kr
        env:
          VITE_REGION: KR
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ur-live-staging
          directory: dist
          branch: ${{ github.ref_name }}
      
      - name: Run smoke tests
        run: npm run test:smoke
        env:
          BASE_URL: https://staging.ur-team.com
      
      - name: Notify deployment
        if: success()
        run: |
          echo "✅ Deployed to https://staging.ur-team.com"
```

---

## 📊 5. 데이터베이스 분리

### D1 Database (스테이징 전용)

```bash
# 1. 스테이징 데이터베이스 생성
npx wrangler d1 create ur-live-staging-db

# 2. wrangler.staging.toml 생성
cat > wrangler.staging.toml << 'EOF'
name = "ur-live-staging"
compatibility_date = "2026-02-01"
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "ur-live-staging-db"
database_id = "your-staging-database-id"

[[kv_namespaces]]
binding = "SESSION_KV"
id = "your-staging-session-kv-id"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-staging-cache-kv-id"
EOF

# 3. 테스트 데이터 삽입
npx wrangler d1 execute ur-live-staging-db --file=./scripts/seed-staging.sql
```

---

## 🧪 6. 테스트 전략

### 스테이징에서 테스트할 항목

```bash
# 1. API 엔드포인트
curl https://staging.ur-team.com/api/streams?status=live
curl https://staging.ur-team.com/api/products?limit=6

# 2. 인증 플로우
# - Kakao 로그인 (테스트 계정)
# - Firebase 인증

# 3. 결제 플로우 (Toss 테스트 키)
# - 장바구니 → 결제 → 주문 완료

# 4. 라이브 스트리밍
# - 라이브 방송 생성
# - 채팅 기능

# 5. 판매자 기능
# - 상품 등록/수정
# - 주문 관리
```

### 자동화된 E2E 테스트

```typescript
// tests/e2e/staging.spec.ts
import { test, expect } from '@playwright/test'

test.use({ baseURL: 'https://staging.ur-team.com' })

test('전체 사용자 플로우 (staging)', async ({ page }) => {
  // 1. 홈페이지
  await page.goto('/')
  await expect(page).toHaveTitle(/UR LIVE/)
  
  // 2. 상품 검색 & 구매
  await page.click('text=Shop')
  await page.click('.product-card:first-child')
  await page.click('button:has-text("장바구니")')
  
  // 3. 결제 (테스트 모드)
  await page.goto('/cart')
  await page.click('button:has-text("결제하기")')
  
  // Toss 테스트 결제
  await page.fill('[name="cardNumber"]', '1111-1111-1111-1111')
  await page.fill('[name="expiry"]', '12/26')
  await page.fill('[name="cvc"]', '123')
  await page.click('button:has-text("결제")')
  
  // 주문 완료 확인
  await expect(page).toHaveURL(/\/order-complete/)
})
```

---

## 🔐 7. 보안 & 접근 제한

### IP 화이트리스트 (Optional)

```typescript
// Cloudflare Workers (staging)
export default {
  async fetch(request, env) {
    const ip = request.headers.get('CF-Connecting-IP')
    const allowedIPs = [
      '203.0.113.0',  // Office IP
      '198.51.100.0', // VPN IP
    ]
    
    if (!allowedIPs.includes(ip)) {
      return new Response('Forbidden', { status: 403 })
    }
    
    return env.ASSETS.fetch(request)
  }
}
```

### Basic Auth (간단한 방법)

```typescript
// Add to worker
const BASIC_AUTH_USER = 'staging'
const BASIC_AUTH_PASS = 'your-secure-password'

async function handleAuth(request) {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader) {
    return new Response('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Staging"'
      }
    })
  }
  
  const [scheme, encoded] = authHeader.split(' ')
  const decoded = atob(encoded)
  const [user, pass] = decoded.split(':')
  
  if (user !== BASIC_AUTH_USER || pass !== BASIC_AUTH_PASS) {
    return new Response('Invalid credentials', { status: 401 })
  }
  
  return null // 인증 성공
}
```

---

## ✅ 8. 체크리스트

### 초기 설정
- [ ] Cloudflare Pages 스테이징 프로젝트 생성
- [ ] 커스텀 도메인 연결 (staging.ur-team.com)
- [ ] 환경변수 20개 설정
- [ ] D1 Database 생성 & 바인딩
- [ ] KV Namespaces 생성 & 바인딩

### CI/CD
- [ ] GitHub Actions workflow 설정
- [ ] Cloudflare API Token 추가 (Secrets)
- [ ] 자동 테스트 통합
- [ ] Smoke test 설정

### 테스트
- [ ] API 엔드포인트 전체 테스트
- [ ] E2E 사용자 플로우 테스트
- [ ] 결제 플로우 테스트 (테스트 키)
- [ ] 라이브 스트리밍 테스트

### 모니터링
- [ ] Sentry 설정 (staging 환경)
- [ ] 로그 수집 설정
- [ ] 알림 설정 (Discord/Slack)

---

## 🎯 9. 사용 가이드

### 개발자 워크플로우

```bash
# 1. Feature 개발
git checkout -b feature/new-feature
# ... 코드 작성 ...

# 2. 로컬 테스트
npm run dev:kr
npm run test

# 3. Staging 배포
git push origin feature/new-feature
# → GitHub Actions 자동 배포 → staging.ur-team.com

# 4. Staging 테스트
open https://staging.ur-team.com
npm run test:e2e -- --base-url=https://staging.ur-team.com

# 5. PR 생성 & 리뷰
gh pr create --base main --head feature/new-feature

# 6. 승인 후 Production 배포
git checkout main
git merge feature/new-feature
git push origin main
# → 수동 배포 → live.ur-team.com
```

---

## 📊 10. 비용 예상

| 리소스 | 무료 티어 | 예상 비용 |
|--------|-----------|-----------|
| Cloudflare Pages | 500 builds/month | $0 |
| D1 Database | 100K reads/day | $0 |
| KV Storage | 100K reads/day | $0 |
| Workers | 100K requests/day | $0 |
| **총계** | | **$0/month** |

---

**다음 단계**: CI/CD 파이프라인 구현  
**참고 문서**: `CI_CD_PIPELINE_GUIDE.md`
