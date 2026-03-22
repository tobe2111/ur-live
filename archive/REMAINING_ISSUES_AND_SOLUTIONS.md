# 🔍 남은 이슈와 해결 방안

> **작성일**: 2026-03-06
> **상태**: 아키텍처 리팩터링 완료 후 평가
> **목적**: 다음 단계 개선 사항 명확화

---

## 📊 이슈 우선순위 요약

| 순위 | 이슈 | 심각도 | 해결 시간 | 효과 |
|------|------|--------|-----------|------|
| **1** | 테스트 자동화 부족 | ★★★★★ | 2-3일 | 유지보수 난이도 -50% |
| **2** | Sentry 미완성 | ★★★★☆ | 4시간 | 숨은 문제 걱정 해소 |
| **3** | 죽은 코드 잔여 | ★★★☆☆ | 1시간 | 코드 가독성 개선 |
| **4** | 온보딩 문서 미완성 | ★★☆☆☆ | 2시간 | 신규 개발자 적응 속도 ↑ |
| **5** | 글로벌 런칭 준비 | ★★☆☆☆ | 30분 | 향후 확장성 |

---

## 1️⃣ 테스트 자동화 부족 ★★★★★

### 현재 상태
```
❌ 단위 테스트 (Unit Tests): 0%
❌ 통합 테스트 (Integration Tests): 0%
❌ E2E 테스트 (End-to-End): 0%
✅ 수동 테스트: 100% (사람이 직접 클릭)
```

### 문제점
- **매번 수동 확인 필요**: 로그인, 프로필, 결제 등
- **실수 위험 높음**: "이거 깨졌나?" 걱정
- **배포 속도 느림**: 매번 전체 플로우 수동 테스트
- **리팩터링 두려움**: 뭐 하나 바꾸면 전체 다시 테스트

### 해결 방안

#### Phase 1: 핵심 로직 단위 테스트 (Vitest) - 4시간
```typescript
// tests/unit/auth/login-flow.test.ts
import { describe, it, expect, vi } from 'vitest';
import { LoginFlowService } from '@/features/auth/login-flow.service';

describe('LoginFlowService', () => {
  describe('loginWithKakaoToken', () => {
    it('should exchange Kakao token for Firebase token', async () => {
      // Mock API response
      const mockApi = vi.spyOn(api, 'post').mockResolvedValue({
        customToken: 'mock-firebase-token',
        user: { id: 1, name: 'Test User' }
      });

      await LoginFlowService.loginWithKakaoToken('kakao-access-token');

      expect(mockApi).toHaveBeenCalledWith('/api/auth/kakao/firebase', {
        accessToken: 'kakao-access-token'
      });
    });

    it('should handle API error gracefully', async () => {
      vi.spyOn(api, 'post').mockRejectedValue(new Error('Network error'));

      await expect(
        LoginFlowService.loginWithKakaoToken('invalid-token')
      ).rejects.toThrow('Network error');
    });
  });

  describe('loginSeller', () => {
    it('should save JWT to localStorage', async () => {
      const mockLocalStorage = vi.spyOn(Storage.prototype, 'setItem');
      
      await LoginFlowService.loginSeller('seller@test.com', 'password123');

      expect(mockLocalStorage).toHaveBeenCalledWith(
        'seller_token',
        expect.any(String)
      );
    });
  });

  describe('getLoginType', () => {
    it('should detect Firebase user login', () => {
      // Mock Firebase auth
      vi.mocked(auth.currentUser).mockReturnValue({ uid: 'test-uid' });

      expect(LoginFlowService.getLoginType()).toBe('user');
    });

    it('should detect seller login from localStorage', () => {
      localStorage.setItem('seller_token', 'mock-jwt');

      expect(LoginFlowService.getLoginType()).toBe('seller');
    });
  });
});
```

**설정 파일**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.config.*',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

```typescript
// tests/setup.ts
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn()
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn()
}));

// Mock window.Kakao
global.window.Kakao = {
  init: vi.fn(),
  isInitialized: vi.fn().mockReturnValue(true),
  Auth: {
    authorize: vi.fn()
  }
};
```

#### Phase 2: E2E 테스트 (Cypress/Playwright) - 1일
```typescript
// cypress/e2e/auth/login-flow.cy.ts
describe('사용자 로그인 플로우', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('Kakao 로그인 버튼 클릭 → OAuth 리다이렉트', () => {
    cy.get('[data-testid="kakao-login-btn"]').click();
    cy.url().should('include', 'kauth.kakao.com');
  });

  it('이메일 로그인 → 프로필 페이지 이동', () => {
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-submit"]').click();

    cy.url().should('include', '/user/profile');
    cy.contains('Welcome').should('be.visible');
  });

  it('잘못된 비밀번호 → 에러 메시지 표시', () => {
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-submit"]').click();

    cy.contains('Invalid credentials').should('be.visible');
  });
});

describe('셀러 로그인 플로우', () => {
  it('셀러 로그인 → 대시보드 이동', () => {
    cy.visit('/seller/login');
    cy.get('[data-testid="email-input"]').type('seller@test.com');
    cy.get('[data-testid="password-input"]').type('seller123');
    cy.get('[data-testid="login-submit"]').click();

    cy.url().should('include', '/seller/dashboard');
    cy.get('[data-testid="seller-name"]').should('be.visible');
  });
});
```

**Cypress 설정**:
```typescript
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_KAKAO_REST_API_KEY: 'test-kakao-key'
    }
  }
});
```

#### Phase 3: CI/CD 통합 - 2시간
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

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
      
      - name: Build app
        run: npm run build
      
      - name: Run E2E tests
        run: npm run test:e2e:ci
      
      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: cypress-screenshots
          path: cypress/screenshots
```

#### package.json 스크립트 추가
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:e2e": "cypress open",
    "test:e2e:ci": "cypress run",
    "test:all": "npm run test:unit && npm run test:e2e:ci"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "vitest": "^1.0.4",
    "@vitest/ui": "^1.0.4",
    "cypress": "^13.6.2",
    "jsdom": "^23.0.1"
  }
}
```

### 예상 효과
- ✅ **배포 신뢰도 ↑**: PR 머지 전 자동 테스트
- ✅ **유지보수 시간 -50%**: 수동 테스트 불필요
- ✅ **리팩터링 자신감 ↑**: 테스트가 안전망 역할
- ✅ **버그 발견 속도 ↑**: CI에서 즉시 감지

---

## 2️⃣ Sentry 미완성 ★★★★☆

### 현재 상태
```typescript
// src/main.tsx
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1
});
```

**문제점**:
- ✅ Sentry 초기화됨
- ❌ 커스텀 이벤트 추적 없음
- ❌ 알림 설정 안 됨
- ❌ 핵심 지표(로그인 성공률, 결제 실패율) 추적 안 됨

### 해결 방안

#### Step 1: 핵심 이벤트 추적 추가 - 1시간
```typescript
// src/lib/sentry-events.ts
import * as Sentry from '@sentry/react';

export const SentryEvents = {
  // 로그인 이벤트
  loginAttempt(type: 'kakao' | 'google' | 'email' | 'seller' | 'admin') {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: `Login attempt: ${type}`,
      level: 'info'
    });
  },

  loginSuccess(type: string, userId: string) {
    Sentry.captureMessage(`Login success: ${type}`, {
      level: 'info',
      tags: { login_type: type, user_id: userId }
    });
  },

  loginFailure(type: string, error: Error) {
    Sentry.captureException(error, {
      tags: { login_type: type },
      contexts: {
        login: {
          type,
          timestamp: new Date().toISOString()
        }
      }
    });
  },

  // 결제 이벤트
  paymentAttempt(method: 'toss' | 'stripe', amount: number) {
    Sentry.addBreadcrumb({
      category: 'payment',
      message: `Payment attempt: ${method}`,
      level: 'info',
      data: { amount }
    });
  },

  paymentSuccess(method: string, orderId: string, amount: number) {
    Sentry.captureMessage('Payment success', {
      level: 'info',
      tags: { payment_method: method, order_id: orderId },
      contexts: {
        payment: { amount, currency: method === 'toss' ? 'KRW' : 'USD' }
      }
    });
  },

  paymentFailure(method: string, error: Error, amount: number) {
    Sentry.captureException(error, {
      tags: { payment_method: method },
      contexts: {
        payment: {
          amount,
          timestamp: new Date().toISOString()
        }
      }
    });
  },

  // 라이브 스트리밍 이벤트
  liveStreamStart(streamId: string, sellerId: string) {
    Sentry.captureMessage('Live stream started', {
      level: 'info',
      tags: { stream_id: streamId, seller_id: sellerId }
    });
  },

  liveStreamError(streamId: string, error: Error) {
    Sentry.captureException(error, {
      tags: { stream_id: streamId },
      contexts: {
        stream: {
          id: streamId,
          timestamp: new Date().toISOString()
        }
      }
    });
  },

  // 페이지 성능
  pageLoad(pageName: string, loadTime: number) {
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `Page loaded: ${pageName}`,
      level: 'info',
      data: { load_time_ms: loadTime }
    });

    if (loadTime > 3000) {
      Sentry.captureMessage(`Slow page load: ${pageName}`, {
        level: 'warning',
        tags: { page: pageName },
        contexts: {
          performance: { load_time_ms: loadTime }
        }
      });
    }
  }
};
```

**사용 예시**:
```typescript
// src/features/auth/login-flow.service.ts
import { SentryEvents } from '@/lib/sentry-events';

export const LoginFlowService = {
  async loginWithKakaoToken(accessToken: string): Promise<void> {
    SentryEvents.loginAttempt('kakao');
    
    try {
      const { customToken, user } = await api.post('/api/auth/kakao/firebase', { accessToken });
      await signInWithCustomToken(auth, customToken);
      
      SentryEvents.loginSuccess('kakao', user.id);
    } catch (error) {
      SentryEvents.loginFailure('kakao', error as Error);
      throw error;
    }
  }
};
```

#### Step 2: 알림 설정 (Sentry Dashboard) - 30분

**Alert Rule 1: 로그인 실패율 높음**
```
조건:
- Event Type: error
- Tag: login_type = *
- Threshold: 10건/5분

알림:
- Slack: #alerts-production
- Email: team@ur-team.com
```

**Alert Rule 2: 결제 실패**
```
조건:
- Event Type: error
- Tag: payment_method = *
- Threshold: 1건 (즉시 알림)

알림:
- Slack: #alerts-critical
- PagerDuty: On-call engineer
```

**Alert Rule 3: 느린 페이지 로드**
```
조건:
- Message: "Slow page load"
- Level: warning
- Threshold: 5건/10분

알림:
- Slack: #performance
```

#### Step 3: Sentry 대시보드 구성 - 30분

**대시보드 위젯**:
1. **로그인 성공률**
   - Query: `count() WHERE message:"Login success"` / `count() WHERE category:"auth"`
   - Chart: Line (7일간)

2. **결제 성공률**
   - Query: `count() WHERE message:"Payment success"` / `count() WHERE category:"payment"`
   - Chart: Bar (24시간)

3. **평균 페이지 로드 시간**
   - Query: `avg(load_time_ms) WHERE category:"performance"`
   - Chart: Area (7일간)

4. **에러 발생 추이**
   - Query: `count() WHERE level:error`
   - Chart: Heatmap (시간대별)

### 예상 효과
- ✅ **실시간 모니터링**: 문제 발생 즉시 알림
- ✅ **데이터 기반 의사결정**: 로그인/결제 성공률 지표
- ✅ **프로덕션 안심**: 숨은 문제 걱정 해소
- ✅ **성능 최적화**: 느린 페이지 자동 감지

---

## 3️⃣ 죽은 코드 잔여 ★★★☆☆

### 현재 상태
- ✅ AuthContext 백업 파일 삭제됨
- ❌ 일부 미사용 파일 존재 가능

### 해결 방안 - 1시간

#### Step 1: 미사용 파일 찾기
```bash
# 설치
npm install -g depcheck unimported

# 미사용 의존성 찾기
depcheck

# 미사용 파일 찾기
unimported
```

#### Step 2: ESLint 설정으로 자동 감지
```typescript
// .eslintrc.cjs
module.exports = {
  plugins: ['unused-imports'],
  rules: {
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_'
      }
    ]
  }
};
```

#### Step 3: 청소 스크립트 추가
```bash
# scripts/clean-dead-code.sh
#!/bin/bash

echo "🧹 Dead Code Cleanup..."

# 1. 미사용 imports 제거
npx eslint --fix src/**/*.{ts,tsx}

# 2. 미사용 파일 찾기
echo "📊 Checking for unused files..."
npx unimported

# 3. 빈 폴더 삭제
find src -type d -empty -delete

echo "✅ Cleanup complete!"
```

**package.json**:
```json
{
  "scripts": {
    "clean:dead-code": "bash scripts/clean-dead-code.sh",
    "clean:build": "rm -rf dist .wrangler",
    "clean:all": "npm run clean:dead-code && npm run clean:build"
  }
}
```

### 예상 효과
- ✅ **코드 가독성 ↑**: 불필요한 파일 제거
- ✅ **빌드 속도 ↑**: 번들 크기 감소
- ✅ **유지보수 용이**: "이 파일 뭐지?" 걱정 제거

---

## 4️⃣ 온보딩 문서 미완성 ★★☆☆☆

### 현재 상태
- ✅ DEVELOPMENT_GUIDELINES.md 존재
- ✅ create-feature.js 스크립트 존재
- ❌ "2일 안에 프로젝트 이해" 수준은 아님

### 해결 방안 - 2시간

#### 신규 개발자 온보딩 가이드
```markdown
# 📚 UR Live 신규 개발자 온보딩 가이드

> **목표**: 2일 안에 프로젝트 이해하고 첫 기여하기

---

## Day 1: 환경 설정 & 이해 (4시간)

### 1. 사전 준비 (30분)
- [ ] Node.js 18+ 설치
- [ ] npm 9+ 설치
- [ ] Git 설정
- [ ] VSCode + 추천 익스텐션 설치

**추천 VSCode 익스텐션**:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### 2. 프로젝트 클론 & 실행 (30분)
```bash
# 1. 저장소 클론
git clone https://github.com/tobe2111/ur-live.git
cd ur-live

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일 편집 (Slack에서 키 받기)

# 4. 로컬 실행
npm run dev
# → http://localhost:5173 열림

# 5. 데이터베이스 초기화 (선택)
npm run db:reset
```

### 3. 프로젝트 구조 파악 (1시간)
```
src/
├── pages/           # 53개 페이지 (로그인, 프로필, 라이브 등)
├── features/        # 기능별 모듈 (auth, products, orders, live, payments)
├── shared/          # 공통 컴포넌트, 스토어, 유틸
├── lib/             # 라이브러리 초기화 (Firebase, API)
└── worker/          # Cloudflare Workers (백엔드)
```

**핵심 파일**:
- `src/features/auth/login-flow.service.ts` → 통합 로그인 로직
- `src/shared/stores/useAuthKR.ts` → KR 인증 상태 관리
- `src/lib/firebase.ts` → Firebase 초기화

### 4. 아키텍처 문서 읽기 (2시간)
**필독 문서** (순서대로):
1. `README.md` → 프로젝트 개요
2. `COMPLETE_TECHNICAL_SPECIFICATIONS.md` → 전체 기술 스펙
3. `ARCHITECTURE_REFACTORING_BEFORE_AFTER.md` → 아키텍처 진화
4. `USER_LOGIN_IMPLEMENTATION_DEEP_DIVE.md` → 로그인 구현 상세

---

## Day 2: 첫 기여하기 (4시간)

### 1. 이슈 선택 (30분)
GitHub Issues에서 `good first issue` 라벨 찾기:
- 예: "Add loading spinner to login button"
- 예: "Fix typo in Korean translation"

### 2. 브랜치 생성 & 작업 (2시간)
```bash
# 1. 새 브랜치 생성
git checkout -b feature/my-first-contribution

# 2. 코드 수정
# ...

# 3. 테스트
npm run test:unit
npm run dev  # 수동 테스트

# 4. 린트 & 타입 체크
npm run lint
npm run type-check
```

### 3. PR 생성 (30분)
```bash
# 1. 커밋
git add .
git commit -m "feat: Add loading spinner to login button"

# 2. 푸시
git push origin feature/my-first-contribution

# 3. GitHub에서 PR 생성
# - 제목: feat: Add loading spinner to login button
# - 설명: Before/After 스크린샷 첨부
```

### 4. 코드 리뷰 & 머지 (1시간)
- 리뷰어 피드백 수정
- CI 통과 확인
- Squash & Merge

---

## 자주 묻는 질문 (FAQ)

### Q1: 로컬에서 Kakao 로그인 테스트하려면?
**A**: Kakao Developers에서 localhost:5173 리다이렉트 URI 추가 필요

### Q2: Firebase 초기화 에러가 나요
**A**: .env 파일에 VITE_FIREBASE_* 변수들이 모두 있는지 확인

### Q3: 빌드가 실패해요
**A**: `npm run clean:all && npm install && npm run build` 시도

### Q4: Cloudflare Workers 로컬 테스트는?
**A**: `npm run preview` (wrangler pages dev 실행)

---

## 도움 받기
- **Slack**: #dev-questions
- **GitHub**: Issues/Discussions
- **문서**: `/docs` 폴더

---

**작성**: 2026-03-06
**버전**: 1.0.0
```

### 예상 효과
- ✅ **신규 개발자 적응 속도 ↑**: 2일 → 첫 기여 가능
- ✅ **질문 감소**: FAQ로 반복 질문 제거
- ✅ **팀 확장 용이**: 온보딩 자동화

---

## 5️⃣ 글로벌 런칭 준비 ★★☆☆☆

### 현재 상태
- ✅ 단일 빌드 + Runtime Detection
- ❌ 완전 자동(0분)은 아님 (5-15분 작업 필요)

### 해결 방안 - 30분

#### 글로벌 런칭 체크리스트
```markdown
# 🌎 글로벌 런칭 체크리스트

## Before Launch (15분)

### 1. 도메인 설정
- [ ] Cloudflare Pages: live-global.ur-team.com 추가
- [ ] DNS 레코드: CNAME → ur-live.pages.dev

### 2. 환경 변수 설정 (Cloudflare Dashboard)
- [ ] `STRIPE_SECRET_KEY` 추가 (프로덕션)
- [ ] `FIREBASE_PROJECT_ID` (글로벌 프로젝트)
- [ ] `FIREBASE_DATABASE_URL` (글로벌 DB)

### 3. Firebase Console
- [ ] 새 프로젝트 생성: `ur-live-global`
- [ ] Google OAuth 활성화
- [ ] 도메인: live-global.ur-team.com 추가

### 4. Stripe Dashboard
- [ ] Webhook 엔드포인트: https://live-global.ur-team.com/api/payments/stripe/webhook
- [ ] 이벤트: payment_intent.succeeded, payment_intent.failed

### 5. 배포
```bash
npm run build
wrangler pages deploy dist --project-name ur-live-global
```

### 6. 테스트
- [ ] Google 로그인 확인
- [ ] Stripe 결제 테스트 (테스트 카드)
- [ ] 영어 번역 확인
- [ ] SEO 메타 태그 확인

## After Launch (모니터링)
- [ ] Sentry: 에러 모니터링
- [ ] Google Analytics: 트래픽 추적
- [ ] Stripe Dashboard: 실제 결제 확인
```

#### 자동화 스크립트
```bash
# scripts/deploy-global.sh
#!/bin/bash

echo "🌎 Global Deployment Starting..."

# 1. 빌드
echo "📦 Building..."
npm run build

# 2. 환경 변수 체크
echo "🔐 Checking environment variables..."
if [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "❌ STRIPE_SECRET_KEY not set"
  exit 1
fi

# 3. 배포
echo "🚀 Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name ur-live-global

# 4. 헬스 체크
echo "🏥 Health check..."
curl https://live-global.ur-team.com/api/health

echo "✅ Global deployment complete!"
```

**package.json**:
```json
{
  "scripts": {
    "deploy:global": "bash scripts/deploy-global.sh"
  }
}
```

### 예상 효과
- ✅ **런칭 시간 단축**: 15분 → 5분 (자동화)
- ✅ **실수 방지**: 체크리스트로 누락 제거
- ✅ **확장 준비**: 다른 국가 추가 용이

---

## 📅 실행 계획

### Week 1 (우선순위 높음)
- **Day 1-2**: 테스트 자동화 (Vitest 단위 테스트)
- **Day 3**: Sentry 완성 (이벤트 추적 + 알림)
- **Day 4**: 죽은 코드 청소

### Week 2 (우선순위 중간)
- **Day 1-2**: E2E 테스트 (Cypress)
- **Day 3**: 온보딩 문서 완성
- **Day 4-5**: CI/CD 테스트 통합

### Week 3 (향후)
- 글로벌 런칭 준비
- 성능 최적화
- 추가 기능 개발

---

## 📊 예상 효과 총합

| 개선 항목 | 현재 | 목표 | 개선율 |
|-----------|------|------|--------|
| **테스트 커버리지** | 0% | 70%+ | **+∞** |
| **배포 신뢰도** | 중간 | 높음 | **+50%** |
| **유지보수 시간** | 많음 | 적음 | **-50%** |
| **온보딩 시간** | 1주일 | 2일 | **-71%** |
| **프로덕션 안심도** | 중간 | 높음 | **+50%** |

---

**작성자**: Claude (GenSpark AI Developer)
**최종 업데이트**: 2026-03-06
**문서 버전**: 1.0.0
