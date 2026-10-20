# 🚀 UR-Live 개발자 모집 - Technical Brief

> **"아시아판 Etsy + TikTok Shop + Twitch" 하이브리드 라이브 커머스 플랫폼**

---

## 📌 TL;DR (한 줄 요약)

**실시간 라이브 스트리밍과 멀티셀러 이커머스를 결합한 글로벌 확장 가능 플랫폼** - 현재 한국 시장 중심으로 개발 중이며, 글로벌 진출 준비 완료 (7개 언어, 12개 통화 지원)

---

## 🎯 서비스 개요

### What We're Building

UR-Live는 **소규모 셀러들이 YouTube Live로 라이브 방송하면서 실시간으로 상품을 판매할 수 있는 플랫폼**입니다.

**핵심 차별점**:
- 🎥 **YouTube Live 연동**: 기존 YouTube 채널 활용, 별도 스트리밍 인프라 불필요
- 🛒 **멀티셀러 장바구니**: 여러 셀러의 상품을 한 번에 구매 (판매자별 자동 정산)
- 💳 **완전 자동화된 결제**: Toss Payments 웹훅 완전 구현 (결제 → 주문 확정 → 셀러 정산)
- 🌍 **글로벌 Ready**: 7개 언어, 12개 통화, Stripe/PayPal 연동 준비 완료

---

## 🏗️ 기술 스택 (현재 운영 중)

### Frontend
```yaml
Core: React 18.3 + TypeScript 5.5
Build: Vite 5.4 (HMR, code-splitting)
Styling: Tailwind CSS 3.4 + shadcn/ui (Radix UI)
State: Zustand 5.0 (auth, cart, UI)
Routing: React Router 6.26
Data Fetching: TanStack Query 5.56
Forms: React Hook Form 7.53 + Zod 3.23
Icons: Lucide React (tree-shakeable)
```

### Backend
```yaml
Runtime: Cloudflare Workers (Edge, 300+ 글로벌 PoP)
Framework: Hono 4.5 (Express-like, 초고속)
Database: Cloudflare D1 (SQLite, serverless)
ORM: Custom QueryBuilder + raw SQL
Auth: Firebase Auth + JWT (seller/admin)
File Storage: Cloudflare R2 (S3 호환)
```

### Integrations
```yaml
결제: 
  - Toss Payments (KRW, 한국 주력)
  - Stripe (USD/JPY/EUR, 글로벌 준비)
소셜 로그인:
  - Kakao OAuth 2.0 (한국 사용자)
  - Google (글로벌)
라이브 스트리밍:
  - YouTube Live API (IFrame Player + Data API v3)
  - YouTube Chat API (실시간 채팅 연동)
모니터링:
  - Sentry (에러 추적)
  - Cloudflare Analytics
배포:
  - GitHub Actions (CI/CD, auto-deploy on push)
  - Cloudflare Pages (정적 자산)
  - Cloudflare Workers (API)
```

### Infrastructure
```yaml
Hosting: Cloudflare Pages + Workers (Edge)
CDN: Cloudflare (자동, 글로벌 300+ PoP)
DNS: Cloudflare (DDoS 방어 포함)
Caching: Cloudflare Cache + Service Worker
Database: Cloudflare D1 (자동 백업, 글로벌 복제)
Secrets: Cloudflare Workers Secrets + GitHub Secrets
Domain: live.ur-team.com (production)
```

---

## 📊 코드베이스 현황 (2026-03-19 기준)

### 규모
```yaml
총 파일 수: 352개 (TypeScript/TSX)
총 코드 라인: 72,892줄 (주석 포함)
API 엔드포인트: 185개
DB 마이그레이션: 69개 (누적)
DB 테이블: 23개
  - users, products, orders, order_items, streams
  - cart, wishlists, payments, settlements
  - sellers, admins, notifications, push_subscriptions
  - reviews, addresses, sessions, tax_invoices
  - banners, product_detail_images, seller_profiles
  - currencies, exchange_rates 등
```

### 주요 모듈 구성
```yaml
Frontend (React):
  - /src/client/pages/*.tsx (20+ 페이지)
  - /src/components/*.tsx (50+ 재사용 컴포넌트)
  - /src/hooks/*.ts (20+ custom hooks)
  - /src/stores/*.ts (Zustand stores: auth, cart, UI)
  - /src/shared/types/*.ts (공통 타입 정의)

Backend (Cloudflare Workers):
  - /src/worker/routes/*.ts (15+ route 파일)
  - /src/features/*/api/*.routes.ts (기능별 API)
  - /src/worker/middleware/*.ts (auth, cors, validation)
  - /src/worker/repositories/*.ts (DB 레이어)
  - /src/worker/utils/*.ts (payment, JWT, validation)

Migrations:
  - /migrations/*.sql (69개, 순차 실행)
```

### Dependencies
```yaml
Production: 33개 주요 라이브러리
  - React 생태계 (react, react-dom, react-router)
  - UI (radix-ui, lucide-react, tailwind)
  - 상태관리 (zustand, tanstack-query)
  - 결제 (tosspayments, stripe)
  - Firebase (firebase, firebase-admin)
  - Cloudflare (hono, @tsndr/cloudflare-worker-jwt)
  - 유틸 (axios, zod, clsx, i18next)

Dev: 20개 개발 도구
  - TypeScript, Vite, Playwright, MSW
  - Testing Library, ESBuild
```

---

## ✨ 주요 기능 (구현 완료)

### 1. 멀티셀러 이커머스 💳
- [x] 셀러별 독립 상품 관리
- [x] 한 장바구니에 여러 셀러 상품 담기
- [x] 판매자별 자동 주문 분리 (하나의 주문번호, 여러 order_items)
- [x] 셀러별 배송비 계산 (base_fee + free_threshold)
- [x] 주문 상태 추적 (pending → paid → confirmed → shipped → delivered)
- [x] 판매자 정산 시스템 (자동 정산 금액 계산)

### 2. 실시간 라이브 스트리밍 📺
- [x] YouTube Live 연동 (IFrame Player API)
- [x] 실시간 라이브 채팅 (YouTube Chat API + Firebase Firestore)
- [x] 방송 중 현재 판매 상품 자동 변경
- [x] 라이브 중 상품 바로 담기/구매
- [x] 스트림 스케줄링 (예약 방송)
- [x] 시청자 카운트 (실시간)

### 3. 결제 & 정산 💰
- [x] Toss Payments 풀 구현
  - [x] 결제 위젯 (클라이언트)
  - [x] 웹훅 핸들러 (서버, 서명 검증)
  - [x] 자동 주문 확정 (paid → confirmed)
  - [x] 결제 실패 시 자동 주문 취소
  - [x] 부분 취소 지원 (환불)
- [x] Stripe 연동 준비 완료 (글로벌 결제)
- [x] 판매자 정산 시스템
  - [x] 자동 정산 금액 계산 (주문 금액 - 수수료)
  - [x] 정산 상태 관리 (pending → completed)
  - [x] 월별 정산 리포트

### 4. 인증 & 권한 🔐
- [x] Firebase Auth (소셜 로그인)
- [x] Kakao OAuth 2.0 (한국 사용자 주력)
- [x] Google OAuth (글로벌)
- [x] JWT 기반 seller/admin 인증
- [x] 역할 기반 접근 제어 (user / seller / admin)
- [x] 토큰 자동 갱신 (401 → refresh → retry)

### 5. 글로벌화 🌍
- [x] i18next 다국어 지원 (7개 언어)
  - 한국어, 영어, 일본어, 중국어(간체/번체), 베트남어, 태국어
- [x] 멀티 통화 지원 (12개 통화)
  - KRW, USD, JPY, EUR, GBP, CNY, THB, VND, SGD, AUD, CAD, HKD
- [x] 실시간 환율 API 연동 (Open Exchange Rates)
- [x] 로케일별 가격 포맷 (Intl.NumberFormat)
- [x] 언어별 URL 라우팅 (/en, /ja, /ko)

### 6. 셀러 관리 🏪
- [x] 셀러 등록 및 승인 플로우
- [x] 셀러 대시보드 (매출, 주문, 상품 관리)
- [x] 상품 등록/수정/삭제 (이미지 업로드 포함)
- [x] 재고 관리 (자동 차감)
- [x] 라이브 스트림 생성 및 관리
- [x] 주문 처리 (확인 → 발송 → 배송 완료)
- [x] 정산 내역 조회

### 7. 관리자 기능 👨‍💼
- [x] 전체 대시보드 (매출, 사용자, 셀러 통계)
- [x] 셀러 승인/거부 (KYC)
- [x] 주문 모니터링 (전체 주문 조회)
- [x] 배너 관리 (홈 화면 배너)
- [x] 사용자 관리 (조회, 검색)

### 8. 기타 기능
- [x] 위시리스트 (찜하기)
- [x] 장바구니 (멀티셀러 지원)
- [x] 주문 내역 조회
- [x] 배송지 관리 (여러 주소 저장)
- [x] 알림 시스템 (주문 상태 변경 시)
- [x] 푸시 알림 (Web Push API, VAPID)
- [x] 상품 검색 및 필터링
- [x] 카테고리별 브라우징

---

## 📈 완성도 & 상태

### 현재 진행 상황: **86%** 완료

```yaml
✅ 완료 (Production Ready):
  - 멀티셀러 이커머스 코어 (100%)
  - Toss Payments 웹훅 (100%)
  - YouTube Live 연동 (100%)
  - Firebase Auth + Kakao Login (100%)
  - 글로벌 i18n 7개 언어 (100%)
  - 멀티 통화 12개 (100%)
  - 셀러 대시보드 (95%)
  - 관리자 대시보드 (90%)
  - 장바구니 + 체크아웃 (100%)
  - 주문 처리 플로우 (100%)

🚧 진행 중 (80-95%):
  - 정산 자동화 (85%)
  - 푸시 알림 안정화 (80%)
  - 상품 리뷰 시스템 (70%)
  - AR/3D 상품 보기 (기획 단계)

⏳ 예정 (Phase 2-3):
  - Stripe/PayPal 글로벌 결제
  - AI 상품 추천
  - 셀러 KYC 강화
  - 모바일 앱 (React Native)
```

### 기술 부채 정리 상황

**최근 2주간 집중 해결** (2026-03-05 ~ 2026-03-19):
- ✅ Cart 401 에러 해결 (token refresh 로직 개선)
- ✅ 빌드 안정화 (GitHub Actions 100% 성공률)
- ✅ 자동 배포 구축 (push → build → deploy, 5-10분)
- ✅ 18개 에러 패턴 자동 스캔 및 수정
- ✅ 인증 플로우 완전 재구성 (useAuthStore 통합)
- ✅ API 응답 포맷 표준화
- ✅ 로깅 시스템 강화 (Sentry + Console)

**현재 알려진 이슈**:
```yaml
⚠️ 기술 부채 (우선순위별):
  1. any 타입 333건 잔여 → 타입 안정성 개선 필요
     (주로 API 응답, 이벤트 핸들러, 써드파티 라이브러리)
  
  2. CSP unsafe-inline 4곳 → 보안 강화 예정
     (Toss/Stripe 위젯 때문에 일부 허용, 실제 보안 위험 낮음)
  
  3. 401 토큰 문제 간헐적 발생 → 90% 해결 완료
     (token refresh 로직 개선, 로깅 강화, 재현 가능 시나리오 문서화)
  
  4. API 응답 null check 4개 파일 → 방어 코드 추가 예정
  
  5. Firebase init 중복 호출 → 싱글톤 패턴 적용 예정
```

**테스트 커버리지**:
- E2E 테스트: Playwright 설정 완료 (주요 플로우 테스트 예정)
- Unit 테스트: Vitest 설정 완료 (커버리지 30% → 70% 목표)
- Integration 테스트: MSW 설정 완료 (API mocking)

---

## 💪 우리의 강점

### 1. 모듈화 & 확장성
```typescript
// 깔끔한 구조 예시
src/
├── features/          // 기능별 독립 모듈
│   ├── cart/
│   │   ├── api/cart.routes.ts
│   │   ├── hooks/useCart.ts
│   │   └── types/cart.types.ts
│   ├── auth/
│   ├── products/
│   └── payments/
├── shared/            // 공통 유틸/타입
├── worker/            // Backend (Cloudflare Workers)
└── client/            // Frontend (React)
```
- 기능별 독립 모듈 → 새 기능 추가 시 충돌 최소화
- TypeScript 타입 시스템 100% 활용 (일부 any 제외)
- Custom hooks로 비즈니스 로직 재사용

### 2. Production-Grade 결제 시스템
```typescript
// Toss Payments 웹훅 풀 구현
- 서명 검증 (HMAC-SHA256)
- 멱등성 키 (idempotency key)
- 자동 재시도 (실패 시 exponential backoff)
- 주문 상태 자동 업데이트
- Sentry 에러 추적
```

### 3. 글로벌 확장 준비 완료
- 7개 언어 번역 파일 준비 완료 (`/public/locales`)
- 12개 통화 환율 API 연동 (`Open Exchange Rates`)
- Stripe/PayPal 연동 코드 작성 완료 (테스트만 남음)
- 로케일별 URL 라우팅 (`/en`, `/ja`, `/ko`)

### 4. 현대적인 개발 경험
- ⚡ Vite HMR → 코드 변경 즉시 반영 (1초 이내)
- 🔥 TypeScript → 타입 에러 사전 차단
- 🎨 Tailwind CSS → 빠른 UI 개발
- 🧪 Vitest + Playwright → 테스트 환경 구축 완료
- 🚀 GitHub Actions → push 즉시 자동 배포

### 5. Edge Computing 활용
- Cloudflare Workers → 전 세계 300+ PoP에서 실행
- 레이턴시 50ms 이하 (대부분의 요청)
- Auto-scaling (트래픽 급증 시 자동 확장)
- DDoS 방어 기본 탑재

---

## 🚨 솔직한 약점 (현실적으로)

### 1. 기술 부채
- **any 타입 333건**: 주로 API 응답, 이벤트 핸들러
  - 영향: 런타임 에러 가능성, IDE 자동완성 제한
  - 계획: Phase 2에서 타입 강화 (Zod 스키마 적용)

### 2. 테스트 커버리지
- **E2E 테스트 0%**: Playwright 설정만 완료, 테스트 작성 필요
- **Unit 테스트 30%**: 핵심 유틸만 테스트, 컴포넌트 테스트 부족
- 영향: 리팩토링 시 회귀 버그 위험
- 계획: 주요 플로우부터 테스트 추가 (cart, checkout, payment)

### 3. 401 토큰 이슈 (간헐적)
- **현재 상태**: 90% 해결 완료 (최근 2주간 집중 수정)
- **남은 문제**: 극히 드물게 token refresh 실패
- **영향**: 사용자 로그인 상태 해제 (재로그인 필요)
- **계획**: 로깅 강화로 재현 시나리오 완전 파악 후 근본 해결

### 4. 성능 최적화 여지
- **번들 사이즈**: index.js 640KB (gzipped)
  - 원인: Toss/Stripe SDK, Firebase SDK 포함
  - 계획: Dynamic import로 code-splitting

### 5. 모바일 최적화
- **현재**: 반응형 UI (모바일 브라우저 지원)
- **부족**: 네이티브 앱 없음, PWA 기능 부분 구현
- **계획**: Phase 3에서 React Native 앱 개발

---

## 🎯 비전 & 로드맵

### Phase 1: 한국 시장 집중 (현재 ~ 2026 Q2)
**목표**: 셀러 100명 + DAU 1,000명

```yaml
Sprint 1 (현재 ~ 4월):
  - [ ] 베타 테스트 (셀러 10명)
  - [ ] 401 토큰 이슈 완전 해결
  - [ ] E2E 테스트 주요 플로우 작성
  - [ ] 상품 리뷰 시스템 완성
  - [ ] 푸시 알림 안정화

Sprint 2 (4월 ~ 6월):
  - [ ] 공식 오픈 (셀러 50명)
  - [ ] 라이브 스트리밍 안정성 개선
  - [ ] 정산 자동화 (월 1회 → 주 1회)
  - [ ] 마케팅 대시보드 (셀러용)
  - [ ] 모바일 PWA 개선

KPI:
  - 셀러 100명 모집
  - GMV 월 1억원
  - 라이브 시청자 평균 100명/방송
```

### Phase 2: 글로벌 확장 (2026 Q3 ~ Q4)
**목표**: 일본/동남아 진출

```yaml
Q3 (7월 ~ 9월):
  - [ ] Stripe 글로벌 결제 활성화
  - [ ] PayPal 연동 완료
  - [ ] 일본어/영어 UI 완성도 100%
  - [ ] 현지 셀러 10명 파일럿 (일본)
  - [ ] 글로벌 배송 파트너 연동

Q4 (10월 ~ 12월):
  - [ ] 동남아 5개국 진출 (태국, 베트남, 싱가포르, 인도네시아, 필리핀)
  - [ ] 글로벌 셀러 200명
  - [ ] AI 상품 추천 시스템 (v1)
  - [ ] 모바일 앱 베타 (React Native)

KPI:
  - 글로벌 셀러 300명
  - GMV 월 5억원 (글로벌 합산)
  - 지원 언어 10개
```

### Phase 3: 플랫폼 고도화 (2027 ~)
**목표**: "아시아판 Etsy + TikTok Shop + Twitch"

```yaml
2027 H1:
  - [ ] AR/3D 상품 보기 (WebXR)
  - [ ] AI 상품 추천 v2 (개인화)
  - [ ] 셀러 KYC 강화 (신원 확인)
  - [ ] 자동 정산 시스템 (일 1회)
  - [ ] 라이브 클립 기능 (하이라이트)

2027 H2:
  - [ ] 크리에이터 수익화 (후원, 구독)
  - [ ] NFT 굿즈 판매
  - [ ] 메타버스 쇼룸 (VR)
  - [ ] B2B 도매 플랫폼
  - [ ] 자체 물류 네트워크 구축

장기 비전:
  "아시아 소상공인이 글로벌 시장에 진출하는 가장 쉬운 방법"
  - 라이브 커머스 + 소셜 커머스 + 크리에이터 이코노미
  - 누구나 10분만에 글로벌 스토어 오픈
  - AI가 번역, 배송, 정산 모두 자동화
```

---

## 👥 우리가 찾는 사람

### 채용 포지션 (우선순위별)

#### 1. **Full-Stack Engineer** (1-2명)
**필수 역량**:
- React + TypeScript 실무 경험 1년 이상
- REST API 설계 및 구현 경험
- Git/GitHub 협업 경험

**우대 사항**:
- Cloudflare Workers / Edge Computing 경험
- Hono / Express 등 Node.js 프레임워크 경험
- D1 / SQLite / PostgreSQL 경험
- Toss Payments / Stripe 연동 경험
- 이커머스 플랫폼 개발 경험

**업무**:
- 신규 기능 개발 (API + UI)
- 기존 코드 리팩토링 및 성능 개선
- 테스트 작성 (E2E + Unit)
- 배포 및 모니터링

---

#### 2. **Frontend Engineer** (1명)
**필수 역량**:
- React 18+ 실무 경험 2년 이상
- TypeScript 중급 이상
- 상태관리 (Zustand / Redux / Recoil)
- 반응형 UI 개발 (Tailwind / CSS-in-JS)

**우대 사항**:
- 라이브 스트리밍 UI 경험
- WebRTC / Socket.io 경험
- 모바일 웹 최적화 경험
- i18n 다국어 처리 경험
- Vite / Webpack 최적화 경험

**업무**:
- 라이브 페이지 UX 개선
- 장바구니/체크아웃 플로우 최적화
- 성능 최적화 (번들 사이즈, 렌더링)
- 컴포넌트 라이브러리 구축

---

#### 3. **Backend Engineer** (1명)
**필수 역량**:
- Node.js / TypeScript 실무 경험 2년 이상
- RESTful API 설계 및 구현
- 관계형 DB (MySQL / PostgreSQL / SQLite)
- 인증/인가 시스템 구현 경험

**우대 사항**:
- Cloudflare Workers 경험
- Edge Computing / Serverless 경험
- 결제 시스템 (Toss / Stripe) 연동 경험
- 멀티테넌시 아키텍처 경험
- 대용량 트래픽 처리 경험

**업무**:
- API 성능 최적화 (응답 속도, 쿼리 최적화)
- 결제/정산 시스템 고도화
- 인증 시스템 안정화 (401 이슈 완전 해결)
- DB 마이그레이션 및 스키마 설계

---

#### 4. **DevOps / Platform Engineer** (0.5명, 파트타임 가능)
**필수 역량**:
- CI/CD 파이프라인 구축 경험
- GitHub Actions / GitLab CI 경험
- 모니터링 툴 (Sentry / Datadog / Cloudflare Analytics)

**우대 사항**:
- Cloudflare Pages/Workers 배포 경험
- Docker / Kubernetes 경험
- IaC (Terraform / Pulumi)
- 로그 분석 및 알림 시스템 구축

**업무**:
- 배포 자동화 개선
- 모니터링 및 알림 시스템 구축
- 성능 프로파일링 및 최적화
- 인프라 비용 최적화

---

### 💰 보상 및 혜택

#### 개발자 포지션 공통
```yaml
급여:
  - Junior (1-3년): 연봉 4,000만원 ~ 5,500만원
  - Mid-level (3-5년): 연봉 5,500만원 ~ 7,500만원
  - Senior (5년+): 연봉 7,500만원 ~ 1억원 + 스톡옵션

스톡옵션:
  - 초기 멤버 (1-3명): 0.5% ~ 2.0% (vesting 4년)
  - 이후 합류: 0.1% ~ 0.5%
  - IPO / Exit 시 행사 가능

근무 형태:
  - 주 5일 (월~금), 유연 근무제
  - 재택 근무 80% 이상 가능
  - 코어 타임 11:00 ~ 16:00 (중복 필수)
  - 주 1-2회 오프라인 미팅 권장 (강남/판교)

복지:
  - MacBook Pro / 모니터 2대 지급
  - 개발 서적 / 강의 무제한 지원
  - 컨퍼런스 참가비 지원 (연 100만원)
  - 점심 식대 지원 (월 20만원)
  - 건강검진 연 1회
  - 연차 15일 (입사 즉시 사용 가능)

성장 기회:
  - 글로벌 플랫폼 초기 멤버 (0 → 1 경험)
  - 최신 기술 스택 (React 18, Cloudflare, Edge)
  - 빠른 의사결정 (CEO 직보고)
  - 기술 블로그 작성 장려 (회사 이름으로)
```

---

## 🌟 우리와 함께 할 이유

### 1. **초기 멤버의 특권**
```
현재 팀 구성: CEO 1명 + CTO 1명 (계약직)
→ 당신이 Employee #3 (정직원 #1)

✨ 초기 멤버만 가능한 것:
- 회사 핵심 의사결정 참여
- 제품 방향성 공동 설정
- 스톡옵션 높은 비율 (0.5%~2.0%)
- IPO / Exit 시 큰 수익 기대
- 이력서에 "초기 멤버 (Employee #3)" 기재
```

### 2. **글로벌 시장을 다루는 경험**
```
한국 → 일본 → 동남아 → 미주/유럽
7개 언어, 12개 통화, 3개 결제 시스템

다른 곳에서는 5년 걸릴 글로벌 경험을
여기서는 1년 안에 쌓을 수 있습니다.
```

### 3. **최신 기술 스택**
```
Edge Computing (Cloudflare Workers)
→ AWS Lambda보다 빠르고, 저렴하고, 쉬움

TypeScript + React 18 + Vite
→ 2026년 업계 표준 기술

Hono + D1
→ Express보다 10배 빠른 새로운 생태계
```

### 4. **성장 가능성**
```yaml
시장 규모:
  - 라이브 커머스 시장: 2025년 $32B → 2030년 $100B (예상)
  - 한국 이커머스: 2025년 $120B
  - 아시아 전체: 2025년 $2.5T

경쟁사 대비:
  - Grip (한국): Series B $50M (2023)
  - TikTok Shop (글로벌): GMV $20B (2023)
  - 우리: Pre-Seed, Blue Ocean (멀티셀러 + YouTube)
```

### 5. **일하는 방식**
```yaml
문화:
  - 수평적 소통 (직급 호칭 없음, 영어 이름 사용)
  - 데이터 기반 의사결정 (감이 아닌 지표)
  - 빠른 실험 (Fail Fast, Learn Fast)
  - 코드 리뷰 필수 (서로 배우기)

개발 프로세스:
  - GitHub Flow (main + feature branches)
  - PR 필수 (최소 1명 approve)
  - CI/CD 자동 배포 (push → 5분 내 production)
  - 주 1회 스프린트 리뷰 (금요일 오후)
```

---

## 📞 지원 방법

### 1. 이력서 제출
**이메일**: dev-jobs@ur-team.com  
**제목**: `[포지션명] 이름 - GitHub 프로필`

**첨부 파일**:
- 이력서 (PDF, 자유 양식)
- 포트폴리오 (GitHub / 개인 블로그 / 사이드 프로젝트)

### 2. 코딩 과제 (선택)
**과제**: UR-Live의 실제 이슈 해결하기

GitHub Issues에서 `good-first-issue` 태그를 찾아서:
1. 이슈 선택 (예: "401 토큰 문제 재현 테스트 추가")
2. PR 제출
3. 코드 리뷰 진행
4. Merge 되면 면접 자동 합격!

**리포지토리**: https://github.com/tobe2111/ur-live

### 3. 면접 프로세스
```yaml
1차 전화 면접 (30분):
  - 경력 및 관심사 확인
  - 기술 스택 매칭
  - 처우 협의 (급여, 근무 형태)

2차 기술 면접 (1시간):
  - 코드 리뷰 (우리 코드베이스)
  - 시스템 설계 문제 (화이트보드)
  - Q&A (서로 질문)

3차 최종 면접 (30분):
  - CEO 면접 (비전 및 컬처핏)
  - 스톡옵션 논의
  - 입사 일정 조율

최종 결정: 3일 이내
```

---

## 🔗 더 알아보기

- **Production URL**: https://live.ur-team.com
- **GitHub Repo**: https://github.com/tobe2111/ur-live (Private, 초대 가능)
- **Tech Blog**: Coming soon (당신이 첫 글을 쓸 수 있습니다!)
- **Notion Docs**: 초대 시 제공

---

## 📌 FAQ

**Q: 스타트업 경험이 없는데 괜찮나요?**  
A: 괜찮습니다! 초기 멤버는 빠르게 배우고 실행하는 능력이 더 중요합니다. 대신 self-driven하고, 애매함을 견디는 능력이 필요합니다.

**Q: 재택 근무 100% 가능한가요?**  
A: 가능합니다. 다만 주 1-2회 오프라인 미팅을 권장합니다 (팀 빌딩 + 빠른 의사결정). 지방 거주자도 환영합니다.

**Q: 얼마나 빠르게 성장할 수 있나요?**  
A: 6개월 안에 Senior로 승진한 사례도 있습니다 (이전 직장). 성과 기반 승진/보상이며, 매 분기 리뷰합니다.

**Q: 회사가 망하면 어떡하죠?**  
A: 솔직히 말하면, 스타트업은 위험합니다. 하지만 실패하더라도 당신은 "글로벌 플랫폼 초기 멤버" 경력을 가지게 됩니다. 이것만으로도 시장가치가 올라갑니다.

**Q: 기술 스택을 배우는 시간이 필요한가요?**  
A: 온보딩 2주 제공합니다. Cloudflare Workers / Hono가 처음이어도 괜찮습니다. 기본 React + TypeScript만 할 줄 알면 충분합니다.

---

## 🚀 마지막으로

**우리는 "아시아판 Etsy + TikTok Shop + Twitch"를 만들고 있습니다.**

지금은 코드 72,892줄짜리 한국 중심 플랫폼이지만,  
1년 후에는 10개 언어, 50개국에서 사용되는 글로벌 플랫폼이 될 것입니다.

**초기 멤버로 함께 성장할 분을 찾습니다.**

---

**Generated**: 2026-03-19  
**Author**: UR-Live Tech Team  
**Contact**: dev-jobs@ur-team.com
