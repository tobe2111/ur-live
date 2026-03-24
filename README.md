# UR Live — 라이브 커머스 플랫폼

> 실시간 라이브 스트리밍 기반 멀티셀러 커머스 플랫폼
> Cloudflare Workers + React 18 + D1 SQLite + Firebase + Toss Payments

---

## ⚡ 빠른 시작

```bash
git clone <repo-url> && cd ur-live
npm install
cp .env.example .env.local   # Firebase 키 입력
npm run db:migrate:all        # DB 초기화 (70개 마이그레이션 순차 적용)
npm run db:seed               # 테스트 데이터 입력
npm run dev                   # 개발 서버 시작
```

- 프론트엔드: http://localhost:5173
- Worker API: http://localhost:8787

> 자세한 설정 → **[CONTRIBUTING.md](./CONTRIBUTING.md)**

---

## 📐 아키텍처

```
브라우저 (React SPA + Zustand)
    │
    ├── Cloudflare Pages — 정적 파일
    └── Cloudflare Worker (Hono) — API + 비즈니스 로직
            ├── D1 SQLite — 주문/상품/사용자 데이터
            └── Firebase RTDB — 실시간 라이브 채팅
```

| 리전 | 도메인 | 결제 |
|------|--------|------|
| 한국 | live.ur-team.com | Toss Payments |
| 글로벌 | world.ur-team.com | Stripe |

자세한 아키텍처 → **[docs/guides/ARCHITECTURE.md](./docs/guides/ARCHITECTURE.md)**

---

## 🛠 주요 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 전체 개발 서버 (Worker + Vite) |
| `npm run dev:client` | 프론트엔드만 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run deploy` | 빌드 + Cloudflare 배포 |
| `npm run db:migrate:all` | 전체 마이그레이션 로컬 적용 |
| `npm run db:migrate:all:prod` | 전체 마이그레이션 프로덕션 적용 |
| `npm run db:reset` | 로컬 DB 초기화 (삭제 후 재생성) |
| `npm run test` | 유닛 테스트 (Vitest) |
| `npm run test:e2e` | E2E 테스트 (Playwright) |
| `npm run type-check` | 프론트엔드 타입 검사 |

---

## 📦 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18, TypeScript, Vite, Tailwind CSS |
| 상태 관리 | Zustand, React Query |
| 백엔드 | Cloudflare Workers, Hono |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 인증 | Firebase Auth, Kakao OAuth |
| 결제 | Toss Payments, Stripe |
| 실시간 | Firebase Realtime Database |
| 에러 추적 | Sentry |
| 배포 | Cloudflare Pages |

---

## 📚 문서

| 문서 | 내용 |
|------|------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 개발 환경 설정, 코드 스타일, DB 관리 |
| [docs/guides/ARCHITECTURE.md](./docs/guides/ARCHITECTURE.md) | 아키텍처, 인증 플로우, 데이터 흐름 |
| [docs/guides/DEPLOYMENT.md](./docs/guides/DEPLOYMENT.md) | 배포, 시크릿 설정, 웹훅 설정 |
| [.env.example](./.env.example) | 모든 환경 변수 목록 및 설명 |

---

## 🗂 디렉터리 구조

```
src/
├── pages/          # 57개 페이지 컴포넌트
├── components/     # 공통 UI 컴포넌트
├── features/       # 기능 모듈 (auth, seller, orders, payments...)
├── worker/         # Cloudflare Worker API 서버
│   ├── routes/     # API 라우트 핸들러
│   ├── middleware/ # 인증, 에러, 레이트리밋
│   └── repositories/ # D1 DB 접근 레이어
├── shared/         # 프론트+백 공유 타입/유틸
└── lib/            # Firebase, Sentry, API 클라이언트

migrations/         # D1 SQL 마이그레이션 (0001 ~ 0110, 총 70개)
docs/
├── guides/         # 개발/배포 가이드
└── archive/        # 히스토리 문서 (참고용)
```

---

## 🔑 필수 환경 변수

`.env.local` (프론트엔드):
```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_APP_ID=
VITE_TOSS_CLIENT_KEY=test_ck_...
```

`.dev.vars` (Worker 로컬):
```bash
JWT_SECRET=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
TOSS_SECRET_KEY=test_sk_...
TOSS_WEBHOOK_SECRET=
```

전체 목록 → [.env.example](./.env.example)

---

## 📊 코드 현황 (2026-03-24)

| 지표 | 수치 |
|------|------|
| 소스 파일 | 359개 (.ts/.tsx) |
| 테스트 파일 | 354개 |
| 마이그레이션 | 70개 |
| TODO/FIXME | 0개 |
| 빌드 | ✅ 정상 |
