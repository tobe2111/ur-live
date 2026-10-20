# 기술 아키텍처

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 18 + TypeScript + Vite |
| 백엔드 | Cloudflare Workers (Hono) |
| 데이터베이스 | Cloudflare D1 (SQLite) |
| 인증 | Firebase Auth (카카오 OAuth) + JWT (셀러/어드민) |
| 결제 | 토스페이먼츠 SDK v2 (KR) / Stripe (Global) |
| 실시간 | Durable Objects (WebSocket) + SSE fallback |
| 모니터링 | Sentry + Cloudflare Analytics |
| 배포 | Cloudflare Pages + GitHub Actions |

---

## 프로젝트 구조

```
src/
├── pages/              # 페이지 컴포넌트 (라우팅 단위)
│   ├── HomePage.tsx, LivePageV2.tsx, CheckoutPage.tsx ...
│   ├── Seller*.tsx     # 셀러 대시보드 페이지들
│   ├── Admin*.tsx      # 어드민 대시보드 페이지들
│   └── admin/          # 어드민 서브 페이지
│
├── components/         # 공용 UI 컴포넌트
├── layouts/            # 레이아웃 시스템
│   └── AppLayout.tsx   # MobileLayout, FullScreenLayout, isFullScreenPath
│
├── features/           # 도메인별 기능 모듈 (API + UI)
│   ├── auth/           # 인증 (카카오, 구글, 셀러, 어드민)
│   ├── orders/         # 주문
│   ├── payments/       # 결제
│   ├── products/       # 상품
│   ├── cart/           # 장바구니
│   ├── points/         # 딜 포인트
│   ├── donations/      # 후원
│   ├── reviews/        # 리뷰
│   ├── returns/        # 반품/환불
│   ├── inventory/      # 바코드 재고 관리
│   ├── sections/       # 홈페이지 섹션
│   ├── bulk-upload/    # 상품 대량 등록
│   ├── banners/        # 배너
│   ├── seller/         # 셀러 관리
│   ├── admin/          # 어드민 관리
│   ├── streaming/      # 라이브 스트리밍
│   ├── youtube/        # YouTube 연동
│   ├── alimtalk/       # 브랜드메시지/알림톡
│   ├── shipping/       # 배송 주소
│   ├── wishlists/      # 위시리스트
│   ├── notifications/  # 알림
│   ├── push/           # 웹 푸시
│   ├── supply/         # 공급가
│   ├── seller-tiers/   # 셀러 등급
│   ├── cafe24/         # Cafe24 연동
│   └── account/        # 계정 관리
│
├── worker/             # Cloudflare Worker (백엔드)
│   ├── index.ts        # 메인 엔트리포인트 (Hono 앱, 라우트 등록)
│   ├── middleware/      # 인증, 에러, i18n, 레이트리밋 미들웨어
│   ├── routes/          # Worker-native 라우트 (auth, order, payment 등)
│   ├── repositories/    # DB 접근 레이어
│   ├── services/        # 비즈니스 로직
│   ├── utils/           # 유틸리티 (session, response 등)
│   └── types/           # 타입 정의 (Env 등)
│
├── hooks/              # React 커스텀 훅
├── lib/                # 외부 라이브러리 설정 (Firebase, Toss 등)
├── shared/             # 프론트/백엔드 공유
│   ├── db/production-schema.ts  # DB 스키마 정의 (Single Source of Truth)
│   └── constants.ts             # 공용 상수
│
├── services/           # 프론트엔드 API 서비스
├── styles/             # 스타일
├── types/              # 타입 정의
├── utils/              # 유틸리티
├── i18n.ts             # 다국어 지원
├── sentry.ts           # Sentry 설정
└── durable-object.ts   # LiveStreamDurableObject (WebSocket)
```

---

## 인증 시스템

### 사용자별 인증 방식

| 사용자 | 인증 방식 | 저장 위치 |
|--------|-----------|-----------|
| 유저 (구매자) | 카카오 OAuth → httpOnly 세션 쿠키 (`ur_session`) | 쿠키 |
| 셀러 | ID/PW 로그인 → JWT Bearer 토큰 | localStorage (`seller_token`) |
| 어드민 | ID/PW 로그인 → JWT Bearer 토큰 | localStorage (`admin_token`) |

### requireAuth() 인증 순서

```
1. Bearer 토큰 확인 (Authorization 헤더)
   ├─ JWT 검증 시도 (seller/admin)
   └─ Firebase 토큰 검증 시도 (user - legacy fallback)
2. httpOnly 세션 쿠키 확인 (ur_session) → user
3. 모두 실패 → 401 Unauthorized
```

> **중요**: Bearer 토큰이 세션 쿠키보다 **먼저** 체크됩니다. 이는 어드민/셀러가 Bearer 토큰으로 인증할 때 세션 쿠키로 인해 `user` 타입으로 잘못 인식되는 것을 방지합니다.

### 인증 미들웨어 종류

| 미들웨어 | 용도 |
|----------|------|
| `requireAuth()` | 모든 인증된 사용자 |
| `requireUser()` | 구매자 전용 |
| `requireSeller()` | 셀러 전용 |
| `requireAdmin()` | 어드민 전용 |
| `requireSellerOrAdmin()` | 셀러 또는 어드민 |
| `optionalAuth()` | 인증 선택적 (비로그인 허용) |

---

## DB 스키마 (production-schema.ts)

> **Single Source of Truth**: `src/shared/db/production-schema.ts`

### 주요 테이블

| 테이블 | 설명 |
|--------|------|
| `orders` | 주문 |
| `order_items` | 주문 상품 |
| `products` | 상품 |
| `sellers` | 셀러 |
| `live_streams` | 라이브 스트림 |
| `donations` | 후원 |

### 주의사항 (자주 발생하는 실수)

| 올바른 컬럼명 | 잘못된 컬럼명 | 테이블 |
|---------------|--------------|--------|
| `stock` | ~~stock_quantity~~ | products |
| `is_active` | ~~status~~ | products |
| `live_stream_id` | ~~stream_id~~ | donations |
| `credit_amount` | ~~seller_amount~~ | donations |
| `payment_status` | ~~status~~ | donations |

### order_items 주의사항

- `created_at`, `updated_at` 컬럼이 **없음**
- `price` 컬럼은 **필수** (NOT NULL)

---

## API 라우트 맵

### 인증 (Auth)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 내 정보 |
| POST | `/api/auth/kakao/*` | 카카오 OAuth |
| POST | `/api/auth/google/*` | Google/Firebase 인증 |
| POST | `/api/seller/login` | 셀러 로그인 |
| POST | `/api/seller/register` | 셀러 회원가입 |
| POST | `/api/admin/login` | 어드민 로그인 |

### 주문 (Orders)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/orders` | 주문 생성 |
| GET | `/api/orders` | 주문 목록 |
| GET | `/api/orders/:id` | 주문 상세 |
| POST | `/api/orders/:id/cancel` | 주문 취소 |
| GET | `/api/orders/:id/tracking` | 배송 추적 |
| POST | `/api/orders/:id/confirm` | 구매 확정 |

### 결제 (Payments)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/payments/confirm` | 결제 승인 (서버사이드) |
| POST | `/api/payments/rollback` | 결제 롤백 |
| POST | `/api/payment/stripe/create-intent` | Stripe 결제 (Global) |

### 상품 (Products)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/products` | 상품 목록 |
| GET | `/api/products/:id` | 상품 상세 |
| POST | `/api/products` | 상품 등록 |
| PUT | `/api/products/:id` | 상품 수정 |
| DELETE | `/api/products/:id` | 상품 삭제 |

### 포인트 (Points)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/points/balance` | 포인트 잔액 |
| POST | `/api/points/charge` | 포인트 충전 |

### 리뷰 (Reviews)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/reviews` | 리뷰 목록 |
| POST | `/api/reviews` | 리뷰 작성 |

### 반품/환불 (Returns)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/returns` | 반품 신청 |
| GET | `/api/returns` | 반품 목록 |

### 재고 (Inventory)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/inventory` | 재고 목록 |
| POST | `/api/inventory` | 입출고 등록 |

### 섹션 (Sections)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/sections` | 홈페이지 섹션 목록 |
| POST | `/api/sections` | 섹션 생성/수정 |

### 대량 등록 (Bulk Upload)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/bulk-upload` | CSV 대량 상품 등록 |

### 스트림 (Streams)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/streams` | 공개 스트림 목록 |
| GET | `/api/live/*` | 라이브 SSE |
| GET | `/api/chat/*` | 채팅 |

### 셀러 (Seller)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/seller/orders` | 셀러 주문 목록 |
| GET | `/api/seller/streams` | 셀러 스트림 관리 |
| * | `/api/seller/alimtalk/*` | 브랜드메시지 |
| * | `/api/seller/youtube/*` | YouTube 연동 |
| * | `/api/seller/donations/*` | 셀러 후원 관리 |

### 어드민 (Admin)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| * | `/api/admin/*` | 어드민 관리 (IP 화이트리스트 + 감사 로그) |
| * | `/api/admin/banners/*` | 배너 관리 |
| * | `/api/admin/cafe24/*` | Cafe24 연동 |

### 기타
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/cart` | 장바구니 |
| GET | `/api/wishlists` | 위시리스트 |
| GET | `/api/banners` | 배너 (공개) |
| GET | `/api/side-banners` | 사이드 배너 (공개) |
| * | `/api/donations/*` | 후원 |
| * | `/api/supply/*` | 공급가 |
| * | `/api/seller-tiers/*` | 셀러 등급 |
| * | `/api/push/*` | 웹 푸시 |
| * | `/api/notifications/*` | 알림 |
| * | `/api/shipping-addresses/*` | 배송 주소 |
| * | `/api/account/*` | 계정 관리 |
| GET | `/health`, `/api/health` | 헬스 체크 |
| GET | `/api/openapi.json`, `/docs` | API 문서 (Swagger UI) |

---

## 레이아웃 시스템

`src/layouts/AppLayout.tsx`에서 관리합니다.

### MobileLayout (일반 페이지)
- `max-w-screen-sm` (640px), 중앙 정렬
- 흰 배경, BottomNav 공간 (`pb-14`) 포함
- 사용: 홈, 검색, 장바구니, 상품 상세, 프로필 등

### FullScreenLayout (전체화면 페이지)
- 너비 제한 없음, BottomNav 없음
- 사용: 라이브, 체크아웃, 로그인, 결제, 셀러/어드민 대시보드

### fullScreenPrefixes
```typescript
const fullScreenPrefixes = [
  '/live/', '/checkout', '/payment/', '/points/',
  '/seller/', '/admin/',
  '/login', '/register', '/auth/', '/embed/',
  '/introduce',
]
```

### fixed 요소 (BottomNav, FloatingActionBar)
- `max-w-screen-sm` (640px) + `left-1/2 -translate-x-1/2`
- `BOTTOM_NAV_MAX_WIDTH` 상수로 관리

---

## 결제 시스템

### 토스페이먼츠 (KR)
- **SDK**: 토스페이먼츠 SDK v2, 위젯 방식
- **흐름**: 프론트 위젯 렌더링 → 결제 요청 → 서버 `/api/payments/confirm` 에서 승인
- **클라이언트 키**: `VITE_TOSS_CLIENT_KEY` (프론트), `TOSS_SECRET_KEY` (백엔드 시크릿)

### Stripe (Global)
- `/api/payment/stripe/create-intent`로 PaymentIntent 생성
- Global 리전 (`world.ur-team.com`)에서 사용

---

## 후원 시스템

### 딜 포인트
- 유저가 포인트 충전 (15% 수수료 포함)
- 충전된 포인트로 라이브 방송 중 셀러에게 즉시 후원
- `donations` 테이블에 기록
- 수수료율: `commission_rate` (기본 10%), 셀러 수취액: `credit_amount`

---

## 실시간 통신

### Durable Objects
- `LiveStreamDurableObject`: 라이브 스트림당 1개 인스턴스
- WebSocket 채팅 + 상품/시청자 수 브로드캐스트

### SSE Fallback
- `/api/live/*`: Server-Sent Events
- WebSocket을 지원하지 않는 환경에서 사용

---

## 어드민 보안

어드민 라우트(`/api/admin/*`)는 별도의 Hono 서브앱으로 분리되어 있으며, 다음 미들웨어가 순차 적용됩니다:

1. CORS
2. IP 화이트리스트 (`ADMIN_IP_WHITELIST`)
3. `requireAdmin()` 인증
4. 감사 로깅 (Audit Log)
