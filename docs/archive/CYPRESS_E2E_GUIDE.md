# 🧪 Cypress E2E Testing Guide

> **UR Live E2E 테스트 가이드**  
> **작성일**: 2026-03-06  
> **테스트 프레임워크**: Cypress 13.6.2

---

## 📋 목차

1. [개요](#개요)
2. [설치 및 설정](#설치-및-설정)
3. [테스트 실행](#테스트-실행)
4. [테스트 구조](#테스트-구조)
5. [커스텀 Commands](#커스텀-commands)
6. [테스트 작성 가이드](#테스트-작성-가이드)
7. [CI/CD 통합](#cicd-통합)

---

## 개요

### 테스트 범위
- ✅ **일반 사용자 로그인 플로우** (7 tests)
  - 이메일/비밀번호 로그인
  - Kakao OAuth 로그인
  - 로그인 실패 시나리오
  - 로그아웃
  
- ✅ **셀러 로그인 플로우** (5 tests)
  - 이메일/비밀번호 로그인 (JWT)
  - 셀러 대시보드 접근
  - 로그아웃
  
- ✅ **어드민 로그인 플로우** (5 tests)
  - 이메일/비밀번호 로그인 (JWT)
  - 어드민 패널 접근
  - 권한 검증
  - 로그아웃

---

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install -D cypress @testing-library/cypress start-server-and-test
```

### 2. Cypress 구성 파일

**`cypress.config.ts`**:
```typescript
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    viewportWidth: 1280,
    viewportHeight: 720,
  },
})
```

### 3. 환경 변수 설정

`.env` 파일에 테스트 환경 변수 추가:

```env
# Test User Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
TEST_SELLER_EMAIL=seller@test.com
TEST_SELLER_PASSWORD=sellerpass123
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=adminpass123
```

---

## 테스트 실행

### 로컬 개발 환경

#### 1. Cypress UI 모드 (추천)
```bash
npm run test:e2e
```

**장점**:
- 브라우저에서 테스트 실행 과정 실시간 확인
- 디버깅 용이
- 각 테스트 단계별 스크린샷
- Time-travel debugging

#### 2. Headless 모드 (CI/CD용)
```bash
npm run test:e2e:headless
```

**장점**:
- 빠른 실행 속도
- CI/CD 파이프라인에 적합
- 백그라운드 실행

#### 3. 서버 자동 시작 + 테스트 실행
```bash
npm run test:e2e:ci
```

**동작**:
1. `npm run dev` 실행 (localhost:5173)
2. 서버 준비 대기
3. `npm run test:e2e:headless` 실행
4. 테스트 완료 후 서버 종료

---

## 테스트 구조

### 디렉토리 구조

```
cypress/
├── e2e/                        # E2E 테스트 파일
│   ├── user-login.cy.ts       # 일반 사용자 로그인 (7 tests)
│   ├── seller-login.cy.ts     # 셀러 로그인 (5 tests)
│   └── admin-login.cy.ts      # 어드민 로그인 (5 tests)
├── support/
│   ├── e2e.ts                 # E2E 설정 및 글로벌 훅
│   ├── commands.ts            # 커스텀 Cypress commands
│   └── component.ts           # 컴포넌트 테스트 설정 (향후)
├── fixtures/                   # Mock 데이터 (향후)
└── downloads/                  # 다운로드 파일 (자동 생성)
```

### 테스트 파일 예시

**`cypress/e2e/user-login.cy.ts`**:

```typescript
describe('일반 사용자 로그인 플로우', () => {
  beforeEach(() => {
    cy.clearAuth()
    cy.visit('/login')
  })

  it('✅ 이메일/비밀번호 로그인 성공', () => {
    cy.mockApiResponse('/api/auth/email/login', 'POST', {
      success: true,
      user: { id: 1, email: 'test@example.com' },
    })

    cy.get('[data-testid="email-input"]').type('test@example.com')
    cy.get('[data-testid="password-input"]').type('testpassword123')
    cy.get('[data-testid="login-submit"]').click()

    cy.url().should('include', '/user', { timeout: 10000 })
  })
})
```

---

## 커스텀 Commands

### 인증 관련 Commands

#### `cy.loginAsUser(email?, password?)`
일반 사용자로 로그인

```typescript
cy.loginAsUser() // 기본 테스트 계정 사용
cy.loginAsUser('custom@email.com', 'password123')
```

#### `cy.loginAsSeller(email?, password?)`
셀러로 로그인

```typescript
cy.loginAsSeller() // 기본 셀러 계정 사용
```

#### `cy.loginAsAdmin(email?, password?)`
어드민으로 로그인

```typescript
cy.loginAsAdmin() // 기본 어드민 계정 사용
```

#### `cy.logout()`
로그아웃

```typescript
cy.logout()
```

#### `cy.clearAuth()`
모든 인증 상태 초기화 (localStorage, cookies, sessionStorage)

```typescript
cy.clearAuth()
```

---

### API Mock Commands

#### `cy.mockApiResponse(url, method, response, statusCode?)`
API 응답 Mock

```typescript
cy.mockApiResponse('/api/users/me', 'GET', {
  id: 1,
  name: 'Test User',
}, 200)
```

#### `cy.waitForApi(url, alias?)`
API 호출 대기

```typescript
cy.waitForApi('/api/users/me')
cy.waitForApi('/api/products', 'productsApi')
```

---

### 유틸리티 Commands

#### `cy.waitForReact(timeout?)`
React 렌더링 완료 대기

```typescript
cy.waitForReact(2000)
```

#### `cy.elementExists(selector)`
요소 존재 여부 확인 (실패하지 않음)

```typescript
cy.elementExists('[data-testid="optional-button"]').then((exists) => {
  if (exists) {
    cy.get('[data-testid="optional-button"]').click()
  }
})
```

#### `cy.typeSlowly(text, delay?)`
천천히 타이핑 (사람처럼)

```typescript
cy.get('input').typeSlowly('test@example.com', 100)
```

---

### Viewport Commands

#### `cy.setMobileViewport()`
모바일 뷰포트 (iPhone X)

```typescript
cy.setMobileViewport()
```

#### `cy.setTabletViewport()`
태블릿 뷰포트 (iPad 2)

```typescript
cy.setTabletViewport()
```

#### `cy.setDesktopViewport()`
데스크톱 뷰포트 (1280x720)

```typescript
cy.setDesktopViewport()
```

---

## 테스트 작성 가이드

### 1. data-testid 사용

**컴포넌트에 data-testid 추가**:

```tsx
// src/pages/login.tsx
<input 
  type="email" 
  data-testid="email-input"  // ✅ 추가
  placeholder="이메일"
/>

<button 
  type="submit" 
  data-testid="login-submit"  // ✅ 추가
>
  로그인
</button>
```

**테스트에서 사용**:

```typescript
cy.get('[data-testid="email-input"]').type('test@example.com')
cy.get('[data-testid="login-submit"]').click()
```

### 2. 비동기 처리

#### ❌ 나쁜 예 (고정 wait)
```typescript
cy.wait(5000) // ❌ 비효율적
cy.get('[data-testid="result"]').should('be.visible')
```

#### ✅ 좋은 예 (조건부 wait)
```typescript
cy.get('[data-testid="result"]', { timeout: 10000 }).should('be.visible')
```

### 3. API Mock 사용

#### ✅ 권장: API Mock 사용
```typescript
cy.mockApiResponse('/api/auth/login', 'POST', {
  success: true,
  user: { id: 1, name: 'Test' },
})

cy.get('[data-testid="login-submit"]').click()
cy.url().should('include', '/dashboard')
```

**장점**:
- 빠른 실행 속도
- 안정적인 테스트
- 네트워크 의존성 제거

### 4. 에러 시나리오 테스트

```typescript
it('❌ 잘못된 비밀번호로 로그인 실패', () => {
  cy.mockApiResponse('/api/auth/login', 'POST', {
    error: 'Invalid credentials',
  }, 401)

  cy.get('[data-testid="email-input"]').type('test@example.com')
  cy.get('[data-testid="password-input"]').type('wrongpassword')
  cy.get('[data-testid="login-submit"]').click()

  cy.contains('Invalid credentials').should('be.visible')
  cy.url().should('include', '/login')
})
```

---

## CI/CD 통합

### GitHub Actions 워크플로우

**`.github/workflows/e2e-tests.yml`**:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run E2E tests
        run: npm run test:e2e:ci
      
      - name: Upload screenshots (on failure)
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: cypress-screenshots
          path: cypress/screenshots
      
      - name: Upload videos (on failure)
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: cypress-videos
          path: cypress/videos
```

---

## 테스트 현황

### 현재 커버리지

| 테스트 파일 | 테스트 수 | 커버 영역 |
|-------------|-----------|-----------|
| `user-login.cy.ts` | 7 | 일반 사용자 로그인/로그아웃 |
| `seller-login.cy.ts` | 5 | 셀러 로그인/대시보드 |
| `admin-login.cy.ts` | 5 | 어드민 로그인/패널 |
| **Total** | **17** | **핵심 인증 플로우** |

### 향후 추가 예정

- [ ] 회원가입 플로우
- [ ] 프로필 수정
- [ ] 상품 목록/상세
- [ ] 장바구니
- [ ] 결제 플로우 (Toss/Stripe)
- [ ] 라이브 스트리밍

---

## 트러블슈팅

### Q1: Cypress 테스트가 타임아웃됨

**해결**:
```typescript
// cypress.config.ts
defaultCommandTimeout: 10000,  // 10초로 늘림
requestTimeout: 10000,
```

### Q2: Firebase 초기화 에러

**해결**:
```typescript
// cypress/support/e2e.ts
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Firebase')) {
    return false // 에러 무시
  }
})
```

### Q3: 로컬 서버가 자동으로 시작되지 않음

**해결**:
```bash
# 수동으로 서버 시작
npm run dev

# 다른 터미널에서 테스트 실행
npm run test:e2e
```

---

## 참고 문서

- [Cypress 공식 문서](https://docs.cypress.io)
- [Testing Library Cypress](https://testing-library.com/docs/cypress-testing-library/intro/)
- [COMPLETE_TECHNICAL_SPECIFICATIONS.md](./COMPLETE_TECHNICAL_SPECIFICATIONS.md)
- [PROGRESS_REPORT_2026-03-06.md](./PROGRESS_REPORT_2026-03-06.md)

---

**작성자**: Claude (GenSpark AI Developer)  
**최종 업데이트**: 2026-03-06  
**문서 버전**: 1.0.0
