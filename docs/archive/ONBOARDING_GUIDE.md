# 🎓 UR Live 신규 개발자 온보딩 가이드

> **목표**: 2일 안에 프로젝트 이해하고 첫 기여하기  
> **작성일**: 2026-03-06  
> **대상**: 신규 입사 개발자, 오픈소스 기여자

---

## 📋 목차

1. [Day 1: 환경 설정 및 이해](#day-1-환경-설정-및-이해)
2. [Day 2: 첫 기여하기](#day-2-첫-기여하기)
3. [자주 묻는 질문 (FAQ)](#자주-묻는-질문-faq)
4. [도움 받기](#도움-받기)
5. [추가 리소스](#추가-리소스)

---

## Day 1: 환경 설정 및 이해 (4시간)

### ⏰ Timeline

```
09:00 - 09:30  사전 준비 (Node.js, Git, VSCode)
09:30 - 10:00  프로젝트 클론 및 실행
10:00 - 11:00  프로젝트 구조 파악
11:00 - 13:00  아키텍처 문서 읽기
```

---

### 1️⃣ 사전 준비 (30분)

#### 필수 도구 설치

```bash
# Node.js 18+ 설치 확인
node --version  # v18.0.0 이상

# npm 9+ 설치 확인
npm --version   # v9.0.0 이상

# Git 설정 확인
git --version
```

**macOS**:
```bash
brew install node@18
brew install git
```

**Windows**:
```bash
# Node.js 공식 사이트에서 설치
# https://nodejs.org/

# Git 공식 사이트에서 설치
# https://git-scm.com/
```

#### VSCode 익스텐션 설치

**필수 익스텐션** (`.vscode/extensions.json` 참고):
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",           // ESLint
    "esbenp.prettier-vscode",           // Prettier
    "bradlc.vscode-tailwindcss",        // Tailwind CSS
    "formulahendry.auto-rename-tag",    // Auto Rename Tag
    "streetsidesoftware.code-spell-checker",  // Spell Checker
    "ms-playwright.playwright",         // Playwright (optional)
    "vitest.explorer"                   // Vitest Explorer
  ]
}
```

**VSCode 설정 추천**:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.autoFixOnSave": true,
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

### 2️⃣ 프로젝트 클론 및 실행 (30분)

#### Step 1: 저장소 클론

```bash
# HTTPS 클론
git clone https://github.com/tobe2111/ur-live.git
cd ur-live

# 또는 SSH 클론 (권장)
git clone git@github.com:tobe2111/ur-live.git
cd ur-live
```

#### Step 2: 의존성 설치

```bash
# npm 의존성 설치 (약 2-3분 소요)
npm install

# 설치 확인
npm list --depth=0
```

**예상 출력**:
```
ur-live@1.0.0
├── react@18.3.1
├── typescript@5.x.x
├── vite@6.3.5
├── vitest@4.0.18
├── cypress@13.6.2
└── ... (총 750+ 패키지)
```

#### Step 3: 환경 변수 설정

```bash
# .env.example 복사
cp .env.example .env

# .env 파일 편집 (VSCode에서)
code .env
```

**필수 환경 변수**:
```env
# Firebase (개발 환경)
VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=ur-live-dev.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ur-live-dev

# Kakao (개발 환경)
VITE_KAKAO_REST_API_KEY=your-dev-kakao-key

# Toss Payments (테스트 환경)
VITE_TOSS_CLIENT_KEY=test_ck_...

# Stripe (테스트 환경)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Sentry (개발 환경)
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

> 💡 **Tip**: 환경 변수는 팀 리더에게 요청하거나 Slack #dev-keys 채널에서 받으세요.

#### Step 4: 로컬 서버 실행

```bash
# Vite 개발 서버 시작
npm run dev

# 출력:
#   VITE v6.3.5  ready in 1234 ms
#   ➜  Local:   http://localhost:5173/
#   ➜  Network: use --host to expose
```

**브라우저에서 확인**:
```
http://localhost:5173/
```

✅ **성공 화면**: UR Live 로그인 페이지가 표시되면 성공!

#### Step 5: 데이터베이스 초기화 (선택 사항)

```bash
# Cloudflare D1 로컬 데이터베이스 초기화
npm run db:reset

# 출력:
#   ✅ Database reset complete
#   📊 10 sample users created
#   🏪 5 sample sellers created
#   📦 20 sample products created
```

---

### 3️⃣ 프로젝트 구조 파악 (1시간)

#### 전체 구조 한눈에 보기

```
ur-live/
├── 📁 src/                           # 소스 코드 (216 files)
│   ├── 📄 main.tsx                   # 앱 진입점
│   ├── 📄 App.tsx                    # 루트 컴포넌트
│   ├── 📁 pages/                     # 53개 페이지 컴포넌트
│   │   ├── 📁 auth/                  # 로그인, 회원가입
│   │   ├── 📁 user/                  # 사용자 페이지
│   │   ├── 📁 seller/                # 셀러 페이지
│   │   ├── 📁 admin/                 # 어드민 페이지
│   │   └── 📁 live/                  # 라이브 스트리밍
│   ├── 📁 features/                  # 기능별 모듈
│   │   ├── 📁 auth/                  # 인증 (login-flow.service.ts)
│   │   ├── 📁 products/              # 상품 관리
│   │   ├── 📁 orders/                # 주문 처리
│   │   ├── 📁 live/                  # 라이브 스트리밍
│   │   └── 📁 payments/              # 결제 (Toss/Stripe)
│   ├── 📁 shared/                    # 공통 모듈
│   │   ├── 📁 components/            # UI 컴포넌트 (Button, Input, etc.)
│   │   ├── 📁 stores/                # Zustand 상태 관리
│   │   │   ├── useAuthKR.ts          # 한국 인증 스토어
│   │   │   └── useAuthWorld.ts       # 글로벌 인증 스토어
│   │   ├── 📁 hooks/                 # 커스텀 React Hooks
│   │   └── 📁 utils/                 # 유틸리티 함수
│   ├── 📁 lib/                       # 라이브러리 초기화
│   │   ├── firebase.ts               # Firebase 설정
│   │   ├── api.ts                    # API 클라이언트
│   │   └── sentry-events.ts          # Sentry 이벤트 추적 ✨
│   └── 📁 worker/                    # Cloudflare Workers (백엔드)
│       ├── 📁 routes/                # API 라우트 (223+ endpoints)
│       ├── 📁 db/                    # Drizzle ORM 스키마 (20+ tables)
│       └── 📁 middleware/            # 인증, CORS, Rate Limiting
├── 📁 tests/                         # 테스트 (73 tests) ✨
│   ├── setup.ts                      # Vitest 환경 설정
│   └── 📁 unit/                      # 단위 테스트 (56 tests)
│       ├── sentry-events.test.ts     # 22 tests
│       ├── login-flow.service.test.ts # 25 tests
│       └── useAuthKR.test.ts         # 9 tests
├── 📁 cypress/                       # E2E 테스트 (17 tests) ✨
│   ├── 📁 e2e/                       # E2E 테스트 시나리오
│   └── 📁 support/                   # 커스텀 commands
├── 📁 public/                        # 정적 파일 (이미지, 폰트)
├── 📁 scripts/                       # 빌드/배포 스크립트
├── 📄 package.json                   # 의존성 및 스크립트
├── 📄 vite.config.ts                 # Vite 설정
├── 📄 vitest.config.ts               # Vitest 설정 ✨
├── 📄 cypress.config.ts              # Cypress 설정 ✨
└── 📄 tsconfig.json                  # TypeScript 설정
```

#### 핵심 파일 Top 10

반드시 읽어야 할 파일:

1. **`src/main.tsx`** - 앱 진입점, Firebase/Sentry 초기화
2. **`src/App.tsx`** - 라우팅 설정, 전역 상태
3. **`src/features/auth/login-flow.service.ts`** - 통합 로그인 로직 ⭐
4. **`src/shared/stores/useAuthKR.ts`** - 한국 인증 상태 관리 ⭐
5. **`src/lib/firebase.ts`** - Firebase 초기화
6. **`src/lib/api.ts`** - API 클라이언트 (Axios)
7. **`src/lib/sentry-events.ts`** - Sentry 이벤트 추적 ✨
8. **`src/worker/index.ts`** - Cloudflare Workers 진입점
9. **`vite.config.ts`** - Vite 빌드 설정
10. **`package.json`** - 스크립트 및 의존성

---

### 4️⃣ 아키텍처 문서 읽기 (2시간)

**필독 문서 (순서대로 읽기)**:

#### 📖 1. README.md (10분)
프로젝트 개요 및 Quick Start

```bash
cat README.md
```

#### 📖 2. TECHNICAL_STATUS_SUMMARY.md (30분)
전체 기술 스펙 요약

**주요 섹션**:
- 프로젝트 규모 (1,435+ files, 440k+ lines)
- 기술 스택 (React, TypeScript, Vite, Cloudflare)
- 핵심 기능 (4가지 로그인 플로우, 라이브 스트리밍, 결제)
- 성능 지표 (로그인 속도 +50%, 안정성 99.9%)

```bash
cat TECHNICAL_STATUS_SUMMARY.md | less
```

#### 📖 3. COMPLETE_TECHNICAL_SPECIFICATIONS.md (40분)
프로젝트 전체 기술 스펙 (1,170줄)

**주요 섹션**:
- 인증 아키텍처 (User/Seller/Admin/CustomToken)
- API 리스트 (223+ endpoints)
- DB 스키마 (20+ tables)
- Zustand Stores (useAuthKR, useAuthWorld)
- 성능 최적화 내역

```bash
# VS Code에서 열기 (읽기 편함)
code COMPLETE_TECHNICAL_SPECIFICATIONS.md
```

#### 📖 4. HOW_TO_USE_SENTRY_EVENTS.md (20분)
Sentry 이벤트 사용 가이드

**주요 내용**:
- 14개 Sentry 이벤트 메서드
- 로그인/결제/라이브 이벤트 추적 방법
- 코드 예시

```bash
cat src/lib/HOW_TO_USE_SENTRY_EVENTS.md | less
```

#### 📖 5. CYPRESS_E2E_GUIDE.md (20분)
E2E 테스트 가이드

**주요 내용**:
- Cypress 테스트 작성 방법
- 커스텀 commands 사용법
- 테스트 실행 방법

```bash
cat CYPRESS_E2E_GUIDE.md | less
```

---

## Day 2: 첫 기여하기 (4시간)

### ⏰ Timeline

```
09:00 - 09:30  이슈 선택
09:30 - 11:30  브랜치 생성 및 작업
11:30 - 12:00  PR 생성
12:00 - 13:00  코드 리뷰 및 머지
```

---

### 1️⃣ 이슈 선택 (30분)

#### Good First Issue 찾기

GitHub Issues에서 `good first issue` 라벨 찾기:

**추천 이슈 유형**:
1. **문서 개선**: Typo 수정, 번역, 설명 추가
2. **UI 개선**: 로딩 스피너, 에러 메시지, 스타일 조정
3. **테스트 추가**: 단순 컴포넌트 테스트, E2E 시나리오
4. **버그 수정**: 간단한 버그 (명확한 재현 방법)

**예시**:
- [ ] "Add loading spinner to login button" (#123)
- [ ] "Fix typo in Korean translation" (#124)
- [ ] "Add unit test for sanitizeReturnUrl" (#125)

#### 이슈 할당

```bash
# GitHub에서 이슈 코멘트
# "I'd like to work on this issue!"

# 이슈 번호 기억 (예: #123)
```

---

### 2️⃣ 브랜치 생성 및 작업 (2시간)

#### Step 1: 새 브랜치 생성

```bash
# main 브랜치 최신화
git checkout main
git pull origin main

# feature 브랜치 생성
git checkout -b feature/add-loading-spinner-#123

# 브랜치 확인
git branch
```

**브랜치 네이밍 규칙**:
- `feature/` - 새로운 기능
- `fix/` - 버그 수정
- `docs/` - 문서 수정
- `test/` - 테스트 추가
- `refactor/` - 리팩터링

**예시**:
```bash
feature/add-loading-spinner-#123
fix/login-button-disabled-#124
docs/update-readme-typo-#125
test/add-unit-test-sanitize-url-#126
```

#### Step 2: 코드 수정

**예시: 로딩 스피너 추가**

```tsx
// src/pages/auth/login.tsx
import { useState } from 'react'
import { Loader2 } from 'lucide-react'  // 추가

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)  // 추가

  const handleLogin = async () => {
    setIsLoading(true)  // 추가
    try {
      await loginWithEmail(email, password)
    } finally {
      setIsLoading(false)  // 추가
    }
  }

  return (
    <button 
      onClick={handleLogin}
      disabled={isLoading}  // 추가
      data-testid="login-submit"
    >
      {isLoading && <Loader2 className="animate-spin" />}  {/* 추가 */}
      로그인
    </button>
  )
}
```

#### Step 3: 로컬 테스트

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 수동 테스트
# http://localhost:5173/login

# 단위 테스트 실행
npm run test:unit

# E2E 테스트 실행 (선택)
npm run test:e2e

# 타입 체크
npm run type-check

# ESLint 실행
npx eslint src/**/*.{ts,tsx}
```

#### Step 4: 커밋

```bash
# 변경 사항 확인
git status
git diff

# 변경 파일 추가
git add src/pages/auth/login.tsx

# 커밋 (Conventional Commits 형식)
git commit -m "feat: Add loading spinner to login button

- Add Loader2 icon from lucide-react
- Show spinner during login process
- Disable button while loading

Closes #123"
```

**커밋 메시지 규칙** (Conventional Commits):
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 수정
- `test`: 테스트 추가
- `refactor`: 리팩터링
- `style`: 코드 스타일 (포맷팅)
- `chore`: 빌드, 설정 변경

---

### 3️⃣ PR 생성 (30분)

#### Step 1: 브랜치 푸시

```bash
# 원격 저장소에 푸시
git push origin feature/add-loading-spinner-#123

# 출력:
#   To https://github.com/tobe2111/ur-live.git
#    * [new branch]      feature/add-loading-spinner-#123 -> feature/add-loading-spinner-#123
#   Create a pull request for 'feature/add-loading-spinner-#123' on GitHub by visiting:
#      https://github.com/tobe2111/ur-live/pull/new/feature/add-loading-spinner-#123
```

#### Step 2: GitHub에서 PR 생성

1. **GitHub 링크 클릭** (터미널 출력에서)
2. **PR 제목 작성**:
   ```
   feat: Add loading spinner to login button (#123)
   ```

3. **PR 설명 작성**:
   ```markdown
   ## 📝 Summary
   로그인 버튼에 로딩 스피너 추가
   
   ## 🔧 Changes
   - Loader2 아이콘 추가 (lucide-react)
   - 로그인 중 스피너 표시
   - 로그인 중 버튼 비활성화
   
   ## 📸 Screenshots
   ### Before
   [스크린샷 첨부]
   
   ### After
   [스크린샷 첨부]
   
   ## ✅ Checklist
   - [x] 로컬 테스트 완료
   - [x] 타입 체크 통과
   - [x] ESLint 통과
   - [x] 커밋 메시지 규칙 준수
   
   ## 🔗 Related Issue
   Closes #123
   ```

4. **Reviewers 지정**: 팀 리더 또는 시니어 개발자
5. **Create pull request** 클릭

---

### 4️⃣ 코드 리뷰 및 머지 (1시간)

#### Step 1: 자동 체크 확인

PR 생성 후 GitHub Actions 자동 실행:
- ✅ Unit Tests
- ✅ E2E Tests  
- ✅ Type Check
- ✅ Build Check
- ✅ ESLint

**모든 체크 통과 대기** (약 5-10분)

#### Step 2: 리뷰어 피드백 수정

리뷰어가 요청한 변경사항 수정:

```bash
# 파일 수정
code src/pages/auth/login.tsx

# 커밋
git add .
git commit -m "fix: Apply reviewer feedback

- Use consistent icon size
- Add aria-label for accessibility"

# 푸시 (동일 브랜치)
git push origin feature/add-loading-spinner-#123
```

#### Step 3: 승인 및 머지

리뷰어 승인 후:
1. **Squash and merge** 선택
2. **Confirm squash and merge** 클릭
3. **Delete branch** 클릭 (선택 사항)

#### Step 4: 로컬 브랜치 정리

```bash
# main 브랜치로 이동
git checkout main

# main 브랜치 최신화
git pull origin main

# feature 브랜치 삭제
git branch -d feature/add-loading-spinner-#123
```

✅ **축하합니다! 첫 기여 완료!** 🎉

---

## 자주 묻는 질문 (FAQ)

### Q1: 로컬에서 Kakao 로그인이 안 돼요

**A**: Kakao Developers 콘솔에서 `localhost:5173` 리다이렉트 URI 추가 필요

```
1. https://developers.kakao.com/ 접속
2. 내 애플리케이션 → ur-live 선택
3. 플랫폼 → Web → 사이트 도메인
4. http://localhost:5173 추가
5. Redirect URI: http://localhost:5173/auth/kakao/callback 추가
```

### Q2: Firebase 초기화 에러가 나요

**A**: `.env` 파일에 Firebase 환경 변수 확인

```bash
# .env 파일 확인
cat .env | grep FIREBASE

# 필수 변수 체크
VITE_FIREBASE_API_KEY=?
VITE_FIREBASE_AUTH_DOMAIN=?
VITE_FIREBASE_PROJECT_ID=?
```

누락된 변수는 팀 리더에게 요청하세요.

### Q3: 빌드가 실패해요

**A**: 캐시 정리 후 재시도

```bash
# 전체 재설치
npm run clean:all
npm install
npm run build
```

### Q4: 테스트가 타임아웃돼요

**A**: Vitest 타임아웃 설정 확인

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 10000,  // 10초로 늘림
  },
})
```

### Q5: PR을 처음 만들어봐요

**A**: PR 체크리스트 확인

- [ ] 브랜치 이름이 규칙에 맞나요? (`feature/`, `fix/`)
- [ ] 커밋 메시지가 Conventional Commits인가요?
- [ ] 로컬 테스트를 모두 통과했나요?
- [ ] PR 설명에 스크린샷을 첨부했나요?
- [ ] 관련 이슈 번호를 연결했나요? (`Closes #123`)

### Q6: Cloudflare Workers 로컬 테스트는 어떻게 하나요?

**A**: Wrangler를 사용합니다

```bash
# Workers 로컬 실행
npm run preview

# 브라우저에서 접속
http://localhost:3000/api/test/env
```

### Q7: 데이터베이스를 초기화하고 싶어요

**A**: D1 로컬 데이터베이스 리셋

```bash
npm run db:reset
```

---

## 도움 받기

### 🆘 문제가 생겼을 때

1. **문서 먼저 확인**
   - README.md
   - TECHNICAL_STATUS_SUMMARY.md
   - FAQ (이 문서)

2. **GitHub Issues 검색**
   - 같은 문제를 겪은 사람이 있을 수 있습니다

3. **Slack 채널 활용**
   - `#dev-questions` - 개발 관련 질문
   - `#dev-keys` - 환경 변수 요청
   - `#general` - 일반 질문

4. **팀 리더에게 직접 문의**
   - 답변이 없으면 직접 연락하세요

---

## 추가 리소스

### 📚 공식 문서

- [React 공식 문서](https://react.dev/)
- [TypeScript 공식 문서](https://www.typescriptlang.org/docs/)
- [Vite 공식 문서](https://vitejs.dev/)
- [Cloudflare Workers 문서](https://developers.cloudflare.com/workers/)
- [Firebase 공식 문서](https://firebase.google.com/docs)

### 📖 프로젝트 문서

- [COMPLETE_TECHNICAL_SPECIFICATIONS.md](./COMPLETE_TECHNICAL_SPECIFICATIONS.md) - 전체 기술 스펙
- [TECHNICAL_STATUS_SUMMARY.md](./TECHNICAL_STATUS_SUMMARY.md) - 기술 요약
- [CYPRESS_E2E_GUIDE.md](./CYPRESS_E2E_GUIDE.md) - E2E 테스트 가이드
- [CI_CD_GUIDE.md](./CI_CD_GUIDE.md) - CI/CD 가이드
- [HOW_TO_USE_SENTRY_EVENTS.md](./src/lib/HOW_TO_USE_SENTRY_EVENTS.md) - Sentry 가이드

### 🎥 튜토리얼 (향후 추가 예정)

- [ ] "UR Live 프로젝트 소개" (10분)
- [ ] "첫 PR 만들기" (15분)
- [ ] "로그인 플로우 이해하기" (20분)
- [ ] "Cloudflare Workers 개발" (30분)

---

## 🎯 온보딩 체크리스트

### Day 1
- [ ] Node.js 18+, npm 9+, Git 설치 완료
- [ ] VSCode 및 필수 익스텐션 설치 완료
- [ ] 프로젝트 클론 및 의존성 설치 완료
- [ ] `.env` 파일 설정 완료
- [ ] 로컬 서버 실행 성공 (`npm run dev`)
- [ ] README.md 읽음
- [ ] TECHNICAL_STATUS_SUMMARY.md 읽음
- [ ] COMPLETE_TECHNICAL_SPECIFICATIONS.md 읽음
- [ ] 프로젝트 구조 이해 완료

### Day 2
- [ ] GitHub Issues에서 `good first issue` 찾음
- [ ] feature 브랜치 생성 완료
- [ ] 코드 수정 완료
- [ ] 로컬 테스트 통과 (`npm run test:unit`)
- [ ] 타입 체크 통과 (`npm run type-check`)
- [ ] 커밋 메시지 규칙 준수
- [ ] PR 생성 완료
- [ ] 코드 리뷰 받음
- [ ] PR 머지 완료
- [ ] **🎉 첫 기여 성공!**

---

**작성자**: Claude (GenSpark AI Developer)  
**최종 업데이트**: 2026-03-06  
**문서 버전**: 1.0.0  
**대상**: 신규 개발자, 오픈소스 기여자  
**예상 소요 시간**: 2일 (8시간)

---

**다음 단계**: 
1. 두 번째 PR 만들기
2. 복잡한 이슈 도전하기
3. 코드 리뷰어 되기
4. 새로운 기능 설계 참여

**환영합니다! UR Live 팀에 오신 것을 축하합니다! 🚀**
