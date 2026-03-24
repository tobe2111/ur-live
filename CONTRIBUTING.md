# 개발 가이드 (Contributing Guide)

## 목차

1. [빠른 시작 (5분)](#빠른-시작-5분)
2. [외부 서비스 설정](#외부-서비스-설정)
3. [로컬 개발 환경](#로컬-개발-환경)
4. [데이터베이스 관리](#데이터베이스-관리)
5. [테스트](#테스트)
6. [배포](#배포)
7. [코드 스타일](#코드-스타일)
8. [아키텍처 결정 배경](#아키텍처-결정-배경)

---

## 빠른 시작 (5분)

### 필수 요구사항
- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm i -g wrangler`)
- Cloudflare 계정

```bash
# 1. 저장소 클론
git clone <repo-url>
cd ur-live

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 편집 — 최소한 Firebase 설정만 입력하면 개발 가능

# 4. 로컬 DB 초기화 (전체 마이그레이션 순차 적용)
npm run db:migrate:all

# 5. 개발 서버 시작
npm run dev
# → 프론트엔드: http://localhost:5173
# → Worker API:  http://localhost:8787
```

> **빠른 테스트**: Firebase 없이 UI만 확인하려면 `npm run dev:client`로 프론트만 실행 가능.

---

## 외부 서비스 설정

### 필수 서비스
| 서비스 | 용도 | 가이드 |
|--------|------|--------|
| Firebase | 사용자 인증 + 실시간 채팅 | `docs/archive/GETTING_API_KEYS.md` |
| Toss Payments | 한국 결제 (KR 리전) | [토스 개발자 센터](https://developers.tosspayments.com/) |

### 선택 서비스 (없어도 개발 가능)
| 서비스 | 용도 | 비활성화 시 동작 |
|--------|------|----------------|
| Stripe | 글로벌 결제 | 결제 버튼 비활성화 |
| Kakao OAuth | 카카오 로그인 | 이메일 로그인만 사용 |
| Alimtalk | SMS 알림 | 알림 전송 스킵 |
| Discord Webhook | 결제 이벤트 알림 | 알림 스킵 |
| Sentry | 에러 모니터링 | 로컬 console.error만 출력 |
| YouTube API | 라이브 스트림 연동 | 스트림 기능 비활성화 |

### 환경 변수 설정 방법

**프론트엔드** (`.env.local` 파일):
```bash
# Firebase (필수)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_APP_ID=...

# Toss Payments 테스트 키 (필수 - 결제 테스트용)
VITE_TOSS_CLIENT_KEY=test_ck_...
```

**Worker 시크릿** (로컬: `.dev.vars` 파일 생성):
```bash
# .dev.vars (git에 커밋하지 말 것!)
JWT_SECRET=local-dev-secret-32chars-minimum
TOSS_SECRET_KEY=test_sk_...
TOSS_WEBHOOK_SECRET=test-webhook-secret
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
```

---

## 로컬 개발 환경

### 주요 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 전체 개발 서버 (Worker + Vite 동시 실행) |
| `npm run dev:client` | 프론트엔드만 실행 (API 없이 UI 개발 시) |
| `npm run dev:worker` | Worker만 실행 |
| `npm run type-check` | 프론트엔드 타입 검사 |
| `npm run type-check:worker` | Worker 타입 검사 |
| `npm run test` | 유닛 테스트 실행 |
| `npm run test:e2e` | E2E 테스트 실행 (Playwright) |

### 디렉터리 구조

```
ur-live/
├── src/
│   ├── pages/          # React 페이지 컴포넌트 (57개)
│   ├── components/     # 공통 UI 컴포넌트
│   ├── features/       # 기능별 모듈 (auth, seller, orders...)
│   ├── worker/         # Cloudflare Worker (API 서버)
│   │   ├── routes/     # API 라우트
│   │   ├── middleware/ # 인증, 에러 핸들링, 레이트리밋
│   │   └── repositories/ # DB 접근 레이어
│   ├── shared/         # 프론트+백엔드 공유 타입/유틸
│   └── lib/            # Firebase, Sentry, API 클라이언트
├── migrations/         # D1 SQL 마이그레이션 (번호 순 적용)
├── docs/
│   ├── guides/         # 개발 가이드 문서
│   └── archive/        # 히스토리 문서 (참고용)
├── .env.example        # 환경 변수 예시 (모든 변수 목록)
├── wrangler.toml       # Cloudflare Worker 설정
└── vite.config.ts      # Vite 빌드 설정
```

### 리전 설정 (한국 vs 글로벌)
- **KR**: `localhost:5173` → Firebase + Toss Payments
- **Global**: `localhost:5174` → Firebase + Stripe

`src/config/region.ts`에서 도메인 기반으로 자동 감지됩니다.

---

## 데이터베이스 관리

### 로컬 DB 초기화 (최초 셋업)

```bash
# 전체 마이그레이션 순차 실행 (첫 설정 시)
npm run db:migrate:all

# 시드 데이터 입력 (테스트 상품/계정)
npm run db:seed
```

### 새 마이그레이션 추가

마이그레이션 파일 번호는 `0111_` 부터 시작합니다.

```bash
# 1. 파일 생성
touch migrations/0111_add_new_feature.sql

# 2. SQL 작성 (반드시 IF NOT EXISTS 패턴 사용)
echo "ALTER TABLE products ADD COLUMN new_field TEXT DEFAULT NULL;" > migrations/0111_add_new_feature.sql

# 3. 로컬 적용
wrangler d1 execute marketplace-db --local --file=migrations/0111_add_new_feature.sql

# 4. 프로덕션 적용 (신중하게!)
# wrangler d1 execute marketplace-db --file=migrations/0111_add_new_feature.sql
```

> ⚠️ **규칙**: 모든 마이그레이션은 멱등성을 보장해야 합니다 (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

### 로컬 DB 초기화 (문제 발생 시)

```bash
# 로컬 D1 DB 삭제 후 재생성
rm -rf .wrangler/state/v3/d1
npm run db:migrate:all
npm run db:seed
```

---

## 테스트

```bash
# 유닛 테스트
npm run test

# 특정 파일만
npx vitest run src/features/orders

# E2E 테스트 (로컬 서버 실행 중이어야 함)
npm run test:e2e

# UI 모드로 E2E 실행
npm run test:e2e:headed
```

### 테스트 계정 (로컬 시드 데이터)
- 일반 사용자: `test@example.com` / `test1234`
- 셀러: `seller@example.com` / `seller1234`
- 어드민: `admin@ur-team.com` / (wrangler secret으로 설정)

---

## 배포

```bash
# 스테이징 배포
npm run deploy

# 프로덕션 시크릿 설정 (최초 한 번)
wrangler secret put JWT_SECRET
wrangler secret put TOSS_SECRET_KEY
wrangler secret put TOSS_WEBHOOK_SECRET
wrangler secret put FIREBASE_PRIVATE_KEY
wrangler secret put SENTRY_DSN          # 선택
wrangler secret put STRIPE_SECRET_KEY   # 글로벌 리전 선택
wrangler secret put DISCORD_WEBHOOK_URL # 알림 선택
```

---

## 코드 스타일

- **TypeScript strict**: `any` 타입 사용 금지 — `unknown` + 타입 가드 사용
- **console.log 금지**: 프로덕션 코드에서 `console.log` 사용 금지, `console.error`/`console.warn`만 허용
- **컴포넌트**: 함수형 컴포넌트 + hooks
- **상태 관리**: Zustand (전역), useState (로컬)
- **스타일**: Tailwind CSS (`rounded-2xl`, `text-[15px]` 등 고정 스케일 사용)
- **API**: `src/lib/api.ts`의 axios 인스턴스 사용 (인터셉터 포함)

---

## 아키텍처 결정 배경

| 결정 | 이유 |
|------|------|
| **Cloudflare Workers** | 글로벌 엣지 배포, 콜드스타트 없음, Pages와 통합 |
| **D1 SQLite** | Workers 네이티브 DB, 별도 서버 불필요 |
| **Hono** | Workers 최적화, Express 대비 번들 크기 10배 작음 |
| **Firebase Auth** | 소셜 로그인 + 실시간 DB 통합, 서버 인증 불필요 |
| **Zustand** | Redux 대비 보일러플레이트 90% 감소 |
| **Toss Payments** | 한국 결제 표준 SDK, 가상계좌/현금영수증 내장 |
