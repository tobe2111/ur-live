# 🧪 통합 테스트 프레임워크 설정 가이드

## 📋 목표
- 모든 API 엔드포인트 자동 테스트
- 배포 전/후 자동 검증
- CI/CD 파이프라인 통합

## 🛠️ 기술 스택

### 선택된 도구
- **Vitest**: 빠른 유닛 테스트 (Vite 네이티브)
- **Playwright**: E2E 및 API 테스트
- **GitHub Actions**: CI/CD 자동화

### 이유
```
Vitest      → 빠름 (Vite 기반), TypeScript 네이티브
Playwright  → 크로스 브라우저, API 테스트 지원
GitHub Actions → 무료 (public repo), 설정 간단
```

---

## 📦 1. 설치

```bash
# 1. Vitest (유닛 테스트)
npm install -D vitest @vitest/ui

# 2. Playwright (E2E + API 테스트)
npm install -D @playwright/test
npx playwright install  # 브라우저 설치

# 3. 테스트 유틸리티
npm install -D @testing-library/react @testing-library/user-event
npm install -D jsdom  # DOM 환경
```

---

## 📁 2. 디렉토리 구조

```
tests/
├── unit/                    # 유닛 테스트
│   ├── components/
│   ├── hooks/
│   └── utils/
├── integration/             # 통합 테스트
│   ├── api/
│   │   ├── auth.test.ts
│   │   ├── products.test.ts
│   │   ├── streams.test.ts
│   │   ├── orders.test.ts
│   │   └── endpoints.test.ts  # 모든 엔드포인트
│   └── features/
└── e2e/                     # End-to-End 테스트
    ├── user-flow.spec.ts
    ├── checkout.spec.ts
    └── seller.spec.ts
```

---

## ⚙️ 3. 설정 파일

### `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### `playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:kr',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

---

## 🧪 4. 테스트 예제

### API 엔드포인트 테스트
```typescript
// tests/integration/api/endpoints.test.ts
import { describe, it, expect } from 'vitest'

const BASE_URL = 'https://live.ur-team.com'

// 모든 주요 엔드포인트 테스트
const CRITICAL_ENDPOINTS = [
  { method: 'GET', path: '/', expectedStatus: 200 },
  { method: 'GET', path: '/live/1', expectedStatus: 200 },
  { method: 'GET', path: '/product/1', expectedStatus: 200 },
  { method: 'GET', path: '/api/streams?status=live', expectedStatus: 200 },
  { method: 'GET', path: '/api/products?limit=6', expectedStatus: 200 },
  { method: 'GET', path: '/api/products/popular', expectedStatus: 200 },
  { method: 'GET', path: '/api/live-streams', expectedStatus: 200 },
  { method: 'GET', path: '/health', expectedStatus: 200 },
]

describe('Critical API Endpoints', () => {
  CRITICAL_ENDPOINTS.forEach(({ method, path, expectedStatus }) => {
    it(`${method} ${path} should return ${expectedStatus}`, async () => {
      const res = await fetch(`${BASE_URL}${path}`)
      expect(res.status).toBe(expectedStatus)
    })
  })
})

describe('API Response Structure', () => {
  it('/api/streams should return valid JSON', async () => {
    const res = await fetch(`${BASE_URL}/api/streams?status=live`)
    const data = await res.json()
    
    expect(data).toHaveProperty('success')
    expect(Array.isArray(data.data)).toBe(true)
  })
  
  it('/api/products should return paginated data', async () => {
    const res = await fetch(`${BASE_URL}/api/products?limit=6`)
    const data = await res.json()
    
    expect(data).toHaveProperty('success')
    expect(data).toHaveProperty('data')
    expect(Array.isArray(data.data)).toBe(true)
  })
})
```

### E2E 사용자 플로우 테스트
```typescript
// tests/e2e/user-flow.spec.ts
import { test, expect } from '@playwright/test'

test('사용자 전체 플로우', async ({ page }) => {
  // 1. 홈페이지 방문
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('UR LIVE')
  
  // 2. 상품 검색
  await page.click('[aria-label="Search"]')
  await page.fill('input[type="search"]', '테스트')
  await page.keyboard.press('Enter')
  
  // 3. 상품 상세 페이지
  await page.click('.product-card:first-child')
  await expect(page).toHaveURL(/\/product\/\d+/)
  
  // 4. 장바구니 추가
  await page.click('button:has-text("장바구니")')
  await expect(page.locator('.toast')).toContainText('장바구니에 추가')
  
  // 5. 장바구니 페이지
  await page.goto('/cart')
  await expect(page.locator('.cart-item')).toHaveCount(1)
})

test('라이브 방송 시청', async ({ page }) => {
  await page.goto('/live/1')
  
  // 라이브 플레이어 로드 확인
  await expect(page.locator('video')).toBeVisible()
  
  // 채팅 기능 확인
  await expect(page.locator('.chat-container')).toBeVisible()
})
```

---

## 🚀 5. package.json 스크립트

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:ci": "npm run test:coverage && npm run test:e2e",
    "test:smoke": "node tests/smoke-test.js"
  }
}
```

---

## 🔄 6. CI/CD 통합 (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

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
      
      - name: Run unit tests
        run: npm run test:coverage
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: https://staging.ur-team.com
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## 📊 7. Smoke Test (빠른 배포 후 검증)

```javascript
// tests/smoke-test.js
const endpoints = [
  { url: 'https://live.ur-team.com/', expectedStatus: 200 },
  { url: 'https://live.ur-team.com/api/streams?status=live', expectedStatus: 200 },
  { url: 'https://live.ur-team.com/api/products?limit=6', expectedStatus: 200 },
]

async function smokeTest() {
  console.log('🔥 Smoke Test 시작...\n')
  
  let failed = 0
  for (const { url, expectedStatus } of endpoints) {
    try {
      const res = await fetch(url)
      const status = res.status
      
      if (status === expectedStatus) {
        console.log(`✅ ${url} → ${status}`)
      } else {
        console.log(`❌ ${url} → ${status} (expected: ${expectedStatus})`)
        failed++
      }
    } catch (err) {
      console.log(`❌ ${url} → ERROR: ${err.message}`)
      failed++
    }
  }
  
  console.log(`\n📊 결과: ${endpoints.length - failed}/${endpoints.length} passed`)
  
  if (failed > 0) {
    process.exit(1)
  }
}

smokeTest()
```

---

## ✅ 8. 실행 가이드

### 로컬 개발
```bash
# 유닛 테스트 (watch mode)
npm run test

# E2E 테스트
npm run test:e2e

# 커버리지 리포트
npm run test:coverage
```

### CI/CD
```bash
# 전체 테스트 스위트
npm run test:ci

# 배포 후 Smoke Test
npm run test:smoke
```

---

## 🎯 9. 테스트 커버리지 목표

| 카테고리 | 목표 | 현재 |
|---------|------|------|
| 유닛 테스트 | 80% | 0% |
| API 엔드포인트 | 100% | 0% |
| E2E 사용자 플로우 | 주요 3개 | 0 |
| Smoke Test | 전체 | ✅ |

---

## 📋 10. 우선순위별 구현

### Phase 1 (즉시 - 오늘)
- [x] Smoke Test 스크립트 (완료)
- [ ] API 엔드포인트 테스트 설정
- [ ] GitHub Actions 기본 설정

### Phase 2 (1주일)
- [ ] 주요 E2E 테스트 3개
- [ ] CI/CD 파이프라인 완성
- [ ] 커버리지 리포트

### Phase 3 (1개월)
- [ ] 유닛 테스트 80% 커버리지
- [ ] 모든 API 엔드포인트 테스트
- [ ] 자동화된 성능 테스트

---

**다음 문서**: `STAGING_ENVIRONMENT_SETUP.md`
