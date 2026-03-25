# UR Live — 기술 명세서 (Technical Specifications)

> 버전: 1.0 | 최종 업데이트: 2026-03-25

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [기술 스택](#2-기술-스택)
3. [아키텍처](#3-아키텍처)
4. [API 명세](#4-api-명세)
5. [데이터베이스 스키마](#5-데이터베이스-스키마)
6. [인증 및 보안](#6-인증-및-보안)
7. [결제 시스템](#7-결제-시스템)
8. [라이브 스트리밍](#8-라이브-스트리밍)
9. [다중 리전 지원](#9-다중-리전-지원)
10. [환경 변수](#10-환경-변수)
11. [빌드 및 배포](#11-빌드-및-배포)
12. [테스트](#12-테스트)
13. [성능 및 제한](#13-성능-및-제한)

---

## 1. 시스템 개요

UR Live는 실시간 라이브 스트리밍 기반 멀티셀러 커머스 플랫폼입니다.

| 항목 | 내용 |
|------|------|
| 플랫폼 유형 | 라이브 커머스 (B2C + 멀티셀러) |
| KR 도메인 | `live.ur-team.com` |
| 글로벌 도메인 | `world.ur-team.com` |
| 주요 기능 | 라이브 방송 중 상품 판매, 실시간 채팅, 다중 결제 수단 |

---

## 2. 기술 스택

### 2.1 프론트엔드

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| React | 18.3.1 | UI 프레임워크 |
| TypeScript | 5.5.4 | 타입 시스템 |
| Vite | 5.4.3 | 빌드 도구 |
| Zustand | 5.0.0 | 전역 상태 관리 |
| React Query (TanStack) | 5.56.2 | 서버 상태 캐싱 |
| React Router DOM | 6.26.2 | 클라이언트 라우팅 |
| Tailwind CSS | 3.4.11 | 유틸리티 CSS |
| Radix UI | — | 접근성 기반 UI 컴포넌트 |
| React Hook Form | 7.53.0 | 폼 관리 |
| Recharts | 3.8.0 | 차트 시각화 |
| Sentry | 10.43.0 | 에러 모니터링 |

### 2.2 백엔드 (Cloudflare Worker)

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Hono | 4.5.0 | HTTP 프레임워크 |
| Drizzle ORM | 0.45.1 | D1 SQLite ORM |
| jose | 6.2.1 | JWT 서명/검증 |
| Firebase Admin SDK | 13.7.0 | ID Token 검증 |

### 2.3 인프라 및 외부 서비스

| 서비스 | 용도 |
|--------|------|
| Cloudflare Pages | 정적 파일 서빙 (React SPA) |
| Cloudflare Workers | API 서버 (Edge 런타임) |
| Cloudflare D1 | SQLite 호환 데이터베이스 |
| Cloudflare KV | 레이트 리미터 상태 저장 |
| Firebase Auth | 사용자 인증 (이메일, 카카오, 구글) |
| Firebase RTDB | 실시간 라이브 채팅 |
| Toss Payments | 국내 결제 (KR 리전) |
| Stripe | 글로벌 결제 |
| YouTube Data API v3 | 라이브 스트림 연동 |
| Kakao OAuth | 카카오 소셜 로그인 |
| Alimtalk (Aligo) | 카카오 알림톡 SMS |
| Sentry | 프론트엔드 에러 추적 |
| Discord Webhook | 결제/운영 이벤트 알림 |

---

## 3. 아키텍처

### 3.1 전체 구조

```
브라우저 (React SPA)
    │
    ├── Cloudflare Pages ──── 정적 파일 (dist/client/)
    │
    └── Cloudflare Worker ─── API 서버 (dist/client/_worker.js)
            │
            ├── Hono 라우터
            ├── 인증 미들웨어 (JWT + Firebase)
            ├── 레이트 리미터 (Cloudflare KV)
            ├── D1 SQLite ─── 구조화 데이터 (주문/상품/사용자)
            └── Firebase RTDB ── 실시간 채팅
```

### 3.2 빌드 산출물 구조

```
dist/
└── client/
    ├── index.html          # React SPA 진입점
    ├── assets/             # JS/CSS 번들 (코드 스플리팅)
    ├── _worker.js          # Cloudflare Worker API
    └── _routes.json        # Pages ↔ Worker 라우팅 규칙
```

### 3.3 코드 구조 (src/)

```
src/
├── pages/          # 57개 페이지 컴포넌트
├── components/     # 공유 UI 컴포넌트 (17개 카테고리)
├── features/       # 17개 기능 모듈 (자기완결형)
│   ├── auth/
│   ├── orders/
│   ├── payments/
│   ├── products/
│   ├── cart/
│   ├── seller/
│   ├── admin/
│   └── ...
├── shared/
│   ├── stores/     # Zustand 전역 스토어
│   └── hooks/      # 공용 커스텀 훅
├── lib/
│   └── api.ts      # Axios 인스턴스 (인터셉터 포함)
├── config/
│   └── region.ts   # 리전 감지 로직
└── worker/
    ├── index.ts    # Worker 진입점
    ├── routes/     # API 라우트 핸들러
    ├── middleware/ # 인증/에러/레이트리미터
    └── repositories/ # DB 접근 레이어
```

### 3.4 아키텍처 패턴

- **Repository 패턴**: DB 접근을 `src/worker/repositories/`로 분리
- **미들웨어 체인**: 인증 → 레이트 리미터 → 라우트 핸들러
- **Feature-based 구조**: 각 기능 모듈이 API, 컴포넌트, 타입 자기완결
- **Zustand + React Query**: 전역 상태(인증) + 서버 상태(데이터 캐싱) 분리

---

## 4. API 명세

### 4.1 공통 규약

- **Base URL**: `https://live.ur-team.com/api`
- **인증**: `Authorization: Bearer <Firebase ID Token>`
- **응답 형식**:

```json
// 성공
{ "success": true, "data": { ... } }

// 실패
{ "success": false, "error": "에러 메시지" }
```

### 4.2 인증 API (`/api/auth`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/auth/register` | 불필요 | 이메일/비밀번호 회원가입 |
| POST | `/api/auth/login` | 불필요 | 이메일/비밀번호 로그인 |
| POST | `/api/auth/logout` | 필요 | 세션 종료 |
| POST | `/api/auth/refresh` | 불필요 | JWT 갱신 |
| GET | `/api/auth/me` | 필요 | 현재 사용자 정보 |

### 4.3 상품 API (`/api/products`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/products` | 불필요 | 상품 목록 (페이지네이션) |
| GET | `/api/products/:id` | 불필요 | 상품 상세 |
| POST | `/api/seller/products` | SELLER | 상품 등록 |
| PUT | `/api/seller/products/:id` | SELLER | 상품 수정 |
| DELETE | `/api/seller/products/:id` | SELLER | 상품 삭제 |

### 4.4 주문 API (`/api/orders`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/orders` | BUYER | 주문 생성 |
| GET | `/api/orders` | BUYER | 내 주문 목록 |
| GET | `/api/orders/:id` | BUYER | 주문 상세 |
| POST | `/api/orders/:id/cancel` | BUYER | 주문 취소 |
| GET | `/api/seller/orders` | SELLER | 셀러 수신 주문 목록 |

### 4.5 결제 API (`/api/payments`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/payments/confirm` | BUYER | Toss 결제 최종 승인 |
| POST | `/api/payments/webhook` | 없음 (HMAC) | Toss 웹훅 수신 |
| POST | `/api/stripe/payment-intent` | BUYER | Stripe 결제 인텐트 생성 |
| POST | `/api/stripe/webhook` | 없음 (서명) | Stripe 웹훅 수신 |

### 4.6 라이브 스트림 API (`/api/streams`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/streams` | 불필요 | 진행 중/예정 스트림 목록 |
| GET | `/api/streams/:id` | 불필요 | 스트림 상세 + 연결 상품 |
| POST | `/api/seller/streams` | SELLER | 스트림 등록 |
| PUT | `/api/seller/streams/:id` | SELLER | 스트림 정보 수정 |
| POST | `/api/seller/streams/:id/products` | SELLER | 방송 중 상품 연결 |

### 4.7 셀러 API (`/api/seller`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/seller/register` | BUYER | 셀러 가입 신청 |
| GET | `/api/seller/profile` | SELLER | 셀러 프로필 |
| PUT | `/api/seller/profile` | SELLER | 셀러 정보 수정 |
| GET | `/api/seller/settlements` | SELLER | 정산 내역 |

### 4.8 관리자 API (`/api/admin`)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/admin/sellers` | ADMIN | 셀러 목록 |
| PUT | `/api/admin/sellers/:id/status` | ADMIN | 셀러 상태 변경 |
| GET | `/api/admin/orders` | ADMIN | 전체 주문 조회 |
| GET | `/api/admin/settlements` | ADMIN | 정산 관리 |
| POST | `/api/admin/banners` | ADMIN | 배너 등록 |

---

## 5. 데이터베이스 스키마

> DB 엔진: Cloudflare D1 (SQLite 호환)
> DB 이름: `toss-live-commerce-db`
> DB ID: `d9530ba6-7a26-4c02-9295-3ce5aef112a3`
> 마이그레이션 파일 수: 114개 (`migrations/`)

### 5.1 핵심 테이블

#### `users`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | Firebase UID |
| email | TEXT UNIQUE | 이메일 |
| name | TEXT | 표시 이름 |
| role | TEXT | BUYER / SELLER / ADMIN |
| created_at | TEXT | ISO8601 |

#### `sellers`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | 자동 증가 |
| user_id | TEXT FK | users.id |
| shop_name | TEXT | 상점명 |
| status | TEXT | PENDING / ACTIVE / SUSPENDED / CLOSED |
| youtube_email | TEXT | 유튜브 라이브 구글 계정 이메일 |
| commission_rate | REAL | 수수료율 (기본값: 0.05) |

#### `products`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| seller_id | INTEGER FK | sellers.id |
| name | TEXT | 상품명 |
| price | INTEGER | 원화 가격 |
| stock | INTEGER | 재고 |
| status | TEXT | ACTIVE / INACTIVE / SOLD_OUT |
| images | TEXT | JSON 배열 (URL 목록) |
| product_type | TEXT | NORMAL / LIVE_SPECIAL / FEATURED |

#### `orders`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| user_id | TEXT FK | |
| order_number | TEXT UNIQUE | 공유 주문번호 (멀티셀러) |
| seller_id | INTEGER FK | |
| total_amount | INTEGER | 결제 금액 |
| status | TEXT | PENDING / PAID / SHIPPING / DELIVERED / CANCELLED |
| payment_method | TEXT | toss / stripe / virtual_account |

#### `order_items`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| order_id | INTEGER FK | |
| product_id | INTEGER FK | |
| quantity | INTEGER | |
| price_snapshot | INTEGER | 주문 시점 가격 (변경 불가) |

### 5.2 라이브 스트리밍 테이블

#### `live_streams`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| seller_id | INTEGER FK | |
| youtube_video_id | TEXT | YouTube 영상 ID |
| title | TEXT | 방송 제목 |
| status | TEXT | SCHEDULED / LIVE / ENDED |
| scheduled_at | TEXT | 방송 예정 시간 |

#### `live_stream_products`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| stream_id | INTEGER FK | |
| product_id | INTEGER FK | |
| display_order | INTEGER | 상품 노출 순서 |
| is_current | INTEGER | 현재 방송 중 상품 여부 |

### 5.3 정산 테이블

#### `settlements`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| seller_id | INTEGER FK | |
| amount | INTEGER | 정산 금액 |
| status | TEXT | PENDING / PROCESSING / COMPLETED |
| period_start | TEXT | 정산 기간 시작 |
| period_end | TEXT | 정산 기간 종료 |

### 5.4 알림 테이블

| 테이블 | 설명 |
|--------|------|
| `notifications` | 인앱 알림 |
| `push_subscriptions` | 웹 푸시 구독 정보 |
| `alimtalk_messages` | 카카오 알림톡 발송 이력 |
| `alimtalk_templates` | 알림톡 메시지 템플릿 |

---

## 6. 인증 및 보안

### 6.1 인증 플로우

```
사용자 로그인
    │
    ├── 이메일/비밀번호 ─→ Firebase Auth ─→ ID Token (1시간 유효)
    ├── 카카오 OAuth  ─→ Firebase Custom Token ─→ ID Token
    └── 구글 OAuth   ─→ Firebase Auth ─→ ID Token

ID Token ─→ Authorization: Bearer <token>
    │
    └── Worker auth 미들웨어
            ├── Firebase 공개 JWK 다운로드 (캐시)
            ├── RS256 서명 검증
            └── userId 추출 → c.set('userId', uid)
```

### 6.2 역할 기반 접근 제어 (RBAC)

| 역할 | 권한 |
|------|------|
| BUYER | 상품 조회, 주문 생성/취소, 장바구니 |
| SELLER | BUYER 권한 + 상품/스트림 관리, 주문 조회, 정산 |
| ADMIN | 전체 권한 (셀러 심사, 배너, 정산 관리) |

### 6.3 보안 조치

| 항목 | 구현 |
|------|------|
| JWT 검증 | Firebase Admin SDK + jose (RS256) |
| 레이트 리미팅 | Cloudflare KV 기반, 분당 요청 수 제한 |
| 결제 웹훅 검증 | Toss HMAC-SHA256, Stripe 서명 검증 |
| 비밀번호 해싱 | PBKDF2 (refresh token 저장 시) |
| SQL 인젝션 방지 | D1 prepare().bind() 파라미터 바인딩 |
| XSS 방지 | React DOM 자동 이스케이프 |

---

## 7. 결제 시스템

### 7.1 Toss Payments (KR 리전)

```
CheckoutPage
    │
    ├── TossPaymentWidget (SDK) ─→ 결제창 UI
    │
    ├── 사용자 결제 완료
    │       └── POST /api/payments/confirm
    │               ├── Toss API 승인 요청 (server-side)
    │               ├── 재고 차감
    │               └── 주문 상태: PENDING → PAID
    │
    └── Toss Webhook (비동기)
            └── POST /api/payments/webhook
                    ├── HMAC-SHA256 서명 검증
                    └── 이벤트별 처리:
                        ├── payment.confirmed → DONE
                        ├── payment.cancelled → CANCELLED
                        └── payment.virtual_account_deposited → PAID
```

**지원 결제 수단**: 신용카드, 계좌이체, 가상계좌, 휴대폰 결제, 카카오페이, 네이버페이

### 7.2 Stripe (글로벌 리전)

```
CheckoutPage
    └── POST /api/stripe/payment-intent
            └── Stripe PaymentIntent 생성 → client_secret 반환
                    └── Stripe Elements UI → 카드 정보 입력
                            └── POST /api/stripe/webhook
                                    ├── Stripe 서명 검증
                                    └── payment_intent.succeeded → 주문 PAID
```

### 7.3 멀티셀러 주문 구조

하나의 결제에 여러 셀러 상품 포함 시:

```
order_number: "ORD-20260325-XXXX" (공유)
    ├── orders 레코드 (seller_A)
    │       └── order_items [...상품A]
    └── orders 레코드 (seller_B)
            └── order_items [...상품B]
```

---

## 8. 라이브 스트리밍

### 8.1 스트림 라이프사이클

```
SCHEDULED → LIVE → ENDED
```

- **SCHEDULED**: 방송 예정 (캘린더 노출)
- **LIVE**: 실시간 방송 중 (라이브 배지, YouTube 플레이어)
- **ENDED**: 방송 종료 (VOD 전환 또는 숨김)

### 8.2 실시간 채팅

- **기술**: Firebase Realtime Database 직접 연결 (Worker 미경유)
- **경로**: `chats/{streamId}/messages`
- **규칙**: 인증된 사용자만 쓰기, 모든 사용자 읽기 가능
- **캐싱**: `live_chat_cache` 테이블 (Firebase 장애 대비 폴백)

### 8.3 YouTube 연동

- 셀러 계정에 YouTube OAuth 연결 (`seller_youtube_oauth` 테이블)
- YouTube Data API v3로 스트림 상태 동기화
- OBS 오버레이: `/api/seller/streams/:id/overlay` (커스텀 가능)

---

## 9. 다중 리전 지원

| 항목 | KR 리전 | 글로벌 리전 |
|------|---------|------------|
| 도메인 | `live.ur-team.com` | `world.ur-team.com` |
| 결제 | Toss Payments | Stripe |
| 소셜 로그인 | 카카오 OAuth | 구글 OAuth |
| 통화 | KRW (원화) | USD (달러) |

**리전 감지 로직** (`src/config/region.ts`):
- 호스트명 패턴 매칭으로 런타임 분기
- 동일 코드베이스, 환경 변수로 분리

---

## 10. 환경 변수

### 10.1 Worker 시크릿 (Cloudflare)

```bash
# 인증 (필수)
JWT_SECRET                  # 32자 이상 랜덤 문자열

# Firebase Admin (필수)
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY        # "-----BEGIN PRIVATE KEY-----\n..." 형식
FIREBASE_CLIENT_EMAIL

# Toss Payments (KR 결제, 필수)
TOSS_SECRET_KEY             # sk_live_... 또는 test_sk_...
TOSS_WEBHOOK_SECRET         # Toss 콘솔에서 발급

# Kakao OAuth
KAKAO_REST_API_KEY

# 선택
SENTRY_DSN                  # 에러 모니터링
DISCORD_WEBHOOK_URL         # 결제 이벤트 알림
STRIPE_SECRET_KEY           # sk_live_... (글로벌 결제)
STRIPE_WEBHOOK_SECRET       # Stripe 웹훅 검증
YOUTUBE_API_KEY             # YouTube Live 연동
```

### 10.2 프론트엔드 환경 변수 (`.env.local`)

```bash
# Firebase (필수)
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID

# Toss Payments (필수)
VITE_TOSS_CLIENT_KEY        # test_ck_... 또는 live_ck_...

# 선택
VITE_STRIPE_PUBLISHABLE_KEY # pk_live_... (글로벌)
VITE_SENTRY_DSN
VITE_KAKAO_JS_KEY
```

---

## 11. 빌드 및 배포

### 11.1 개발 환경 실행

```bash
npm install
cp .env.example .env.local    # 환경 변수 설정
npm run db:migrate:all        # D1 로컬 초기화
npm run db:seed               # 테스트 데이터 삽입
npm run dev                   # 프론트(5173) + Worker(8787) 동시 실행
```

### 11.2 빌드

```bash
npm run build
# 결과물: dist/client/ (Pages + Worker 통합)
```

**Vite 코드 스플리팅 청크**:
- `react-vendor` — React 코어
- `firebase-vendor` — Firebase SDK
- `payment-vendor` — Toss/Stripe SDK
- `ui-vendor` — Radix UI + Lucide

### 11.3 배포

```bash
npm run deploy
# = npm run build + wrangler pages deploy dist/client --project-name=ur-live-working
```

### 11.4 데이터베이스 마이그레이션

```bash
# 전체 마이그레이션 (프로덕션)
npm run db:migrate:all:prod

# 특정 파일만
wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0114_*.sql
```

### 11.5 롤백

```bash
wrangler pages deployment list --project-name=ur-live-working
wrangler pages deployment rollback <deployment-id> --project-name=ur-live-working
```

---

## 12. 테스트

### 12.1 단위 테스트 (Vitest)

```bash
npm run test
```

- 설정 파일: `vitest.config.ts`
- 테스트 디렉터리: `tests/`

### 12.2 E2E 테스트 (Playwright)

```bash
npm run test:e2e          # 헤드리스
npm run test:e2e:headed   # 브라우저 표시
```

- 설정 파일: `playwright.config.ts`
- 테스트 디렉터리: `cypress/` (Cypress 설정 포함)

### 12.3 타입 검사

```bash
npm run type-check         # 프론트엔드
npm run type-check:worker  # Worker
```

---

## 13. 성능 및 제한

### 13.1 Cloudflare Workers 제한

| 항목 | 무료 플랜 | Workers Paid |
|------|-----------|-------------|
| 요청/일 | 100,000 | 무제한 |
| CPU 시간/요청 | 10ms | 50ms (최대 30s) |
| 번들 크기 | 1MB | 10MB |
| D1 읽기/일 | 5M rows | 25B rows |
| D1 쓰기/일 | 100K rows | 50M rows |

### 13.2 레이트 리미팅

- KV 기반 슬라이딩 윈도우 구현
- 인증 API: 분당 10회
- 일반 API: 분당 100회
- 결제 API: 분당 20회

### 13.3 번들 크기 기준

- Vite 청크 경고 임계값: 600KB
- 목표: 첫 로딩 번들 < 300KB (gzip 기준)

### 13.4 D1 쿼리 최적화

주요 인덱스:
```sql
CREATE INDEX idx_products_seller ON products(seller_id, status);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_streams_status ON live_streams(status, scheduled_at);
```

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [ARCHITECTURE.md](./guides/ARCHITECTURE.md) | 상세 아키텍처 및 코드 패턴 |
| [DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 배포 절차 및 시크릿 관리 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 개발 환경 구성 전체 가이드 |
| [openapi.json](../openapi.json) | OpenAPI 3.0 API 명세 (자동 생성) |
