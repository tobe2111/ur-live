# 유어 라이브 커머스 (Your Live Commerce)

## 🎯 프로젝트 개요

**토스 디자인 시스템 적용 실시간 라이브 쇼핑 플랫폼**

YouTube 라이브 스트리밍과 원클릭 구매 기능을 결합한 세련되고 현대적인 라이브 커머스 시스템입니다. 토스의 깔끔하고 가벼운 디자인 철학을 반영하여 사용자 경험을 극대화했습니다.

## 📦 백업 파일 다운로드

**프로젝트 전체 백업**: https://www.genspark.ai/api/files/s/aaMYHkss

```bash
# 백업 파일 다운로드 및 압축 해제
wget https://www.genspark.ai/api/files/s/aaMYHkss -O toss-live-commerce-backup.tar.gz
tar -xzf toss-live-commerce-backup.tar.gz
cd home/user/webapp

# 의존성 설치
npm install

# 데이터베이스 초기화
npm run db:reset

# 개발 서버 시작
npm run build
pm2 start ecosystem.config.cjs
```

## 🌐 공개 URL

### 프로덕션
- **메인 사이트**: https://live.ur-team.com
- **최신 배포**: https://1c30be85.toss-live-commerce.pages.dev
- **라이브 페이지**: https://live.ur-team.com/live/1
- **주문서**: https://live.ur-team.com/checkout
- **셀러 대시보드**: https://live.ur-team.com/seller

### 샌드박스 (개발)
- **샌드박스 메인**: https://3000-idza9aonokj4y1prq2vkt-cc2fbc16.sandbox.novita.ai
- **라이브 스트림**: https://3000-idza9aonokj4y1prq2vkt-cc2fbc16.sandbox.novita.ai/live/1

## 🎨 토스 디자인 시스템

### 적용된 디자인 요소

#### 1. **브랜드 컬러**
```css
--toss-blue: #3182F6      /* Primary */
--toss-black: #191F28     /* Text */
--toss-gray-900: #333D4B  /* Heading */
--toss-gray-700: #6B7684  /* Body */
--toss-gray-400: #B0B8C1  /* Border */
--toss-gray-200: #E5E8EB  /* Background */
```

#### 2. **타이포그래피**
- **H1**: 64px, 900 weight, -0.04em letter-spacing
- **H2**: 48px, 800 weight, -0.03em letter-spacing
- **H3**: 32px, 700 weight, -0.02em letter-spacing
- **폰트**: Noto Sans KR (Google Fonts)

#### 3. **UI 패턴**
- ✨ **Glass-morphism** - 유리 효과 카드 (blur + saturation)
- 🎭 **Live Badge Animation** - 맥박 애니메이션 + 점멸 효과
- 🌊 **Navigation Blur** - 상단 네비게이션 블러 효과
- 💫 **Skeleton Loading** - 부드러운 로딩 애니메이션
- 🎯 **Hover Effects** - translateY(-12px) + shadow

#### 4. **애니메이션**
```css
transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
```
- Hero 섹션 fade-in-up
- 카드 호버 lift-up
- 버튼 hover shadow
- 라이브 배지 pulse

## ✨ 주요 기능

### ✅ 현재 구현된 기능

#### 1. 실시간 라이브 스트리밍
- ✅ YouTube Live 영상 전체 화면
- ✅ 자동 재생 (음소거 시작)
- ✅ 음소거 토글 버튼 (아이콘 전용)
- ✅ 실시간 '🔴 LIVE' 뱃지
- ✅ 영상 100% 몰입형 UI

#### 2. 원클릭 구매 시스템
- ✅ [구매하기] 버튼 한 번으로 장바구니 담기
- ✅ 옵션 선택 없이 즉시 구매
- ✅ 구매 완료 Alert 표시
- ✅ 실시간 상품 자동 전환 (3초 폴링)

#### 3. 장바구니 시스템
- ✅ [내 주문] 버튼 → 장바구니 페이지 이동
- ✅ 장바구니 목록 확인
- ✅ 수량 조절 (+/-)
- ✅ 상품 삭제
- ✅ 총 금액 자동 계산

#### 4. 실시간 채팅 (Firebase RTDB)
- ✅ 실시간 메시지 송수신
- ✅ 투명 배경 + 그라디언트 마스크
- ✅ 최신 50개 메시지만 유지 (비용 $0 최적화)
- ✅ 구매 시 자동 채팅 메시지
- ✅ 유어 유저 정보 연동
- ✅ 슬라이드인 애니메이션
- ✅ Safe Area 지원

#### 5. 관리자 대시보드
- ✅ 진행 중인 라이브 스트림 관리
- ✅ 원클릭 상품 전환 기능
- ✅ 실시간 상품 목록 및 재고 확인
- ✅ 현재 소개 중인 상품 강조

#### 6. 데이터베이스 (Cloudflare D1)
- ✅ 라이브 스트림 관리
- ✅ 상품 및 옵션 관리
- ✅ 사용자 및 장바구니
- ✅ 주문 및 결제 내역

#### 7. 카카오 로그인 (OAuth2)
- ✅ 카카오 REST API 연동
- ✅ 로그인/로그아웃 기능
- ✅ 사용자 프로필 자동 저장
- ✅ 세션 관리

#### 8. 배송지 관리
- ✅ 배송지 추가/수정/삭제
- ✅ 기본 배송지 설정
- ✅ 배송지 선택 모달
- ✅ 주문서 페이지 자동 로드

#### 9. 셀러 전용 기능
- ✅ 셀러 전용 링크 (/s/:username)
- ✅ UTM 트래킹 (소스/매체/콘텐츠)
- ✅ 셀러 매출 조회 API
- ✅ 정산서 CSV 다운로드
- ✅ 셀러 대시보드 (/seller)
- ✅ 10% 수수료 자동 계산

#### 10. 결제 시스템 (나이스페이먼츠 실제 연동)
- ✅ 주문서 작성 페이지
- ✅ 나이스페이먼츠 SDK 연동
- ✅ 주문 생성 API (/api/orders/create)
- ✅ 결제 승인 API (/api/payments/nicepay/confirm)
- ✅ 결제 성공/실패/리턴 페이지
- ✅ seller_id 추적 및 10% 수수료 자동 계산
- ✅ 주문 내역 조회

### 🚧 구현 예정 기능

#### 11. 셀러 주문 처리
- ⏳ 주문 상태 관리 (준비 중→배송 중→배송 완료)
- ⏳ 송장 번호 입력
- ⏳ 주문 상세 조회

## 🏗️ 시스템 아키텍처

### 기술 스택

```
Frontend:
├── HTML5 + Tailwind CSS (ClickMate 스타일)
├── Vanilla JavaScript (ES6+)
├── YouTube IFrame API
├── Firebase Realtime Database (실시간 채팅)
└── 폴링 기반 실시간 업데이트 (3초)

Backend:
├── Hono (Cloudflare Workers 프레임워크)
├── Cloudflare D1 (SQLite 기반 관계형 DB)
├── Firebase RTDB (실시간 채팅)
├── Toss Bridge API (유저 정보)
├── TypeScript
└── RESTful API

Infrastructure:
├── Cloudflare Pages (배포 플랫폼)
├── Cloudflare Workers (Edge Computing)
└── Firebase Realtime Database (실시간 데이터)
```

### 데이터 흐름도

```
┌─────────────────┐      폴링 (3초)       ┌──────────────────────┐
│  시청자 브라우저  │◄──────────────────►│  Hono Backend        │
│  (Live View)    │   상품 정보 요청      │  (API Routes)        │
└─────────────────┘                      └──────────────────────┘
         ↓                                          ↑
         ↓ 구매하기 클릭                              ↑ 상품 전환 요청
         ↓                                          ↑
┌─────────────────┐                      ┌──────────────────────┐
│   Hono Backend  │◄─────────────────────│  관리자 대시보드      │
│   (API Routes)  │   상품 전환 요청      │  (Admin Panel)      │
└─────────────────┘                      └──────────────────────┘
         ↓
         ↓ Database Operations
         ↓
┌─────────────────┐
│  Cloudflare D1  │
│  (SQLite DB)    │
└─────────────────┘
```

## 📱 UI 레이아웃 (ClickMate 스타일)

### 라이브 스트림 페이지

```
┌─────────────────────────────────────────┐
│ 📺 유어 라이브...  🔇  🔴LIVE           │ ← 상단 헤더
├─────────────────────────────────────────┤
│                                         │
│                                         │
│                                         │
│         YouTube 영상 전체 화면            │
│                                         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│         [📦 내 주문]  [구매하기]          │ ← 하단 컨트롤
└─────────────────────────────────────────┘
```

### 주요 특징

- **전체 화면 영상**: 영상 100% 몰입
- **최소 UI**: 2개 버튼만 (내 주문 + 구매하기)
- **투명 배경**: 하단 컨트롤 반투명 처리
- **원클릭 구매**: 복잡한 프로세스 제거
- **깔끔한 디자인**: 불필요한 요소 제거

## 📊 데이터 모델

### 주요 테이블

```sql
-- 라이브 스트림
live_streams (id, title, youtube_video_id, status, current_product_id, seller_id, scheduled_at)

-- 상품
products (id, name, price, discount_rate, stock, live_stream_id)

-- 상품 옵션
product_options (id, product_id, option_type, option_value, stock)

-- 사용자 (카카오 로그인)
users (id, toss_user_id, name, email, kakao_id, profile_image, phone)

-- 배송지
shipping_addresses (id, user_id, recipient_name, phone, postal_code, address, address_detail, is_default)

-- 장바구니
cart_items (id, user_id, product_id, option_id, quantity, price_snapshot)

-- 주문
orders (id, order_number, user_id, seller_id, total_amount, commission_amount, seller_amount, 
        payment_status, shipping_address_id, shipping_name, shipping_phone, shipping_address)

-- 셀러
sellers (id, username, display_name, business_name, email, profile_image, bio, instagram_url, youtube_url)

-- 정산
settlements (id, seller_id, period_start, period_end, total_amount, commission_amount, 
             net_amount, status)
```

## 🚀 API 엔드포인트

### 라이브 스트림 API
- `GET /api/streams` - 진행 중인 라이브 목록
- `GET /api/streams/:id` - 라이브 스트림 상세 정보
- `GET /api/streams/:streamId/current-product` - 현재 소개 중인 상품 (폴링용)

### 상품 API
- `GET /api/products/:id` - 상품 상세 정보
- `GET /api/products/:id/stock` - 상품 재고 조회 (실시간)

### 장바구니 API
- `GET /api/cart/:userId` - 장바구니 조회
- `POST /api/cart` - 장바구니 추가
- `DELETE /api/cart/:cartItemId` - 장바구니 삭제

### 카카오 로그인 API
- `GET /auth/kakao` - 카카오 OAuth 인증 시작
- `GET /auth/kakao/callback` - 카카오 인증 콜백
- `GET /api/auth/user/verify` - 사용자 세션 확인

### 배송지 API
- `GET /api/shipping-addresses/:userId` - 사용자 배송지 목록
- `POST /api/shipping-addresses` - 배송지 추가
- `PUT /api/shipping-addresses/:id` - 배송지 수정
- `DELETE /api/shipping-addresses/:id` - 배송지 삭제

### 결제 API
- `POST /api/orders/create` - 주문 생성 (결제 전)
- `POST /api/payments/nicepay/confirm` - 나이스페이 서버 승인
- `GET /payment/nicepay/return` - 나이스페이 결제 완료 리턴

### 셀러 API
- `GET /s/:username` - 셀러 전용 링크 (UTM 트래킹)
- `GET /api/seller/sales` - 셀러 매출 조회 (세션 인증 필수)
- `GET /api/seller/settlement-csv` - 정산서 CSV 다운로드 (세션 인증 필수)

### 관리자 API
- `POST /api/auth/login` - 관리자/셀러 로그인
- `POST /api/admin/streams/:streamId/change-product` - 상품 전환

## 💻 개발 환경 설정

### 필수 요구사항
- Node.js 18+
- npm 10+
- Wrangler CLI

### 로컬 개발

```bash
# 1. 백업 파일 다운로드 및 압축 해제
wget https://www.genspark.ai/api/files/s/aaMYHkss -O backup.tar.gz
tar -xzf backup.tar.gz
cd home/user/webapp

# 2. 의존성 설치
npm install

# 3. 데이터베이스 초기화
npm run db:reset

# 4. 빌드
npm run build

# 5. 개발 서버 시작 (PM2)
pm2 start ecosystem.config.cjs

# 6. 테스트
curl http://localhost:3000
```

### 데이터베이스 관리

```bash
# 로컬 마이그레이션 적용
npm run db:migrate:local

# 시드 데이터 로드
npm run db:seed

# 데이터베이스 리셋
npm run db:reset

# 로컬 데이터베이스 콘솔
npm run db:console:local
```

### YouTube Video ID 변경

```bash
# 현재 사용 중인 Video ID: dQw4w9WgXcQ (Rick Astley)

# 다른 영상으로 변경하려면:
npx wrangler d1 execute webapp-production --local \
  --command="UPDATE live_streams SET youtube_video_id = 'YOUR_VIDEO_ID' WHERE id = 1"

# 서버 재시작
pm2 restart webapp
```

**중요**: YouTube Studio에서 "다른 웹사이트에서 동영상 재생 허용" 체크 필수!

## 🚀 배포 가이드

### Cloudflare Pages 배포

```bash
# 1. Cloudflare API 설정 (최초 1회)
# GenSpark에서 setup_cloudflare_api_key 도구 사용

# 2. 프로덕션 데이터베이스 생성
npx wrangler d1 create webapp-production

# 3. wrangler.jsonc에 database_id 설정
# d1_databases[0].database_id = "실제-database-id"

# 4. 프로덕션 마이그레이션
npm run db:migrate:prod

# 5. Cloudflare Pages 프로젝트 생성
npx wrangler pages project create webapp --production-branch main

# 6. 배포
npm run deploy:prod
```

## 🔧 핵심 코드 스니펫

### 1. 원클릭 구매

```javascript
// 클라이언트: 구매하기 버튼 클릭
async function quickBuy() {
  const { product } = state.currentProduct;
  
  // 장바구니에 자동 담기
  const response = await axios.post('/api/cart', {
    userId: state.userId,
    productId: product.id,
    optionId: null,
    quantity: 1,
    priceSnapshot: product.price,
    liveStreamId: state.streamId,
  });

  if (response.data.success) {
    alert(`${product.name}\n장바구니에 담았습니다! 🛒`);
  }
}
```

### 2. 실시간 상품 전환 (폴링)

```javascript
// 클라이언트: 3초마다 현재 상품 확인
setInterval(async () => {
  const response = await axios.get(`/api/streams/${streamId}/current-product`);
  const newProduct = response.data.data?.product;
  
  if (newProduct && newProduct.id !== currentProductId) {
    currentProductId = newProduct.id;
    state.currentProduct = response.data.data;
    console.log('✨ New product:', newProduct.name);
  }
}, 3000);
```

### 3. 관리자 상품 전환

```typescript
// 서버: 관리자가 상품 전환
app.post('/api/admin/streams/:streamId/change-product', async (c) => {
  const { productId } = await c.req.json();
  
  // 라이브 스트림 업데이트
  await DB.prepare(
    'UPDATE live_streams SET current_product_id = ? WHERE id = ?'
  ).bind(productId, streamId).run();
  
  // → 클라이언트의 폴링으로 자동 감지됨
});
```

## 📋 프로젝트 구조

```
webapp/
├── src/
│   └── index.tsx                # Hono 백엔드 (API + SSR)
├── public/
│   └── static/
│       ├── live.js              # 라이브 페이지 JavaScript
│       ├── admin.js             # 관리자 페이지 JavaScript
│       └── style.css            # 공통 스타일
├── migrations/
│   └── 0001_initial_schema.sql  # DB 마이그레이션
├── seed.sql                     # 테스트 데이터
├── wrangler.jsonc               # Cloudflare 설정
├── ecosystem.config.cjs         # PM2 설정
├── package.json                 # 의존성 및 스크립트
└── README.md                    # 프로젝트 문서
```

## 🎯 다음 단계 개발 계획

### Phase 1: 셀러 주문 처리 및 정산 자동화 (우선순위 높음)
- [ ] 셀러 주문 목록 및 상태 관리
- [ ] 송장 번호 입력 및 배송 추적
- [ ] 월별 자동 정산
- [ ] 정산 승인/반려 기능

### Phase 2: 셀러 기능 고도화 (선택 사항)
- [ ] 셀러 주문 처리 (배송 상태 변경)
- [ ] 정산 자동화 (월별 정산서 발급)
- [ ] 셀러 통계 대시보드
- [ ] 정산 승인/반려 기능

### Phase 3: 추가 기능 (선택 사항)
- [ ] 상품 옵션 선택 모달
- [ ] 찜하기 / 위시리스트
- [ ] 주문 배송 추적
- [ ] 프로모션 쿠폰
- [ ] 실시간 채팅 (Cloudflare Durable Objects)

### Phase 4: 고도화 (선택 사항)
- [ ] AI 추천 시스템
- [ ] 라이브 리플레이
- [ ] 통계 대시보드
- [ ] 다국어 지원

## 🐛 문제 해결

### YouTube 영상이 재생되지 않음
```bash
# 원인: YouTube Error 150 (임베드 제한)
# 해결: YouTube Studio에서 임베드 허용 설정

# 또는 Video ID 변경
npx wrangler d1 execute webapp-production --local \
  --command="UPDATE live_streams SET youtube_video_id = 'dQw4w9WgXcQ' WHERE id = 1"
```

### 포트 3000이 이미 사용 중
```bash
# 포트 정리
fuser -k 3000/tcp

# PM2 재시작
pm2 restart webapp
```

### 데이터베이스 초기화
```bash
# 완전 초기화
npm run db:reset
```

## 📞 지원 및 문의

- **개발자**: GenSpark AI Assistant
- **프로젝트 타입**: ClickMate 스타일 라이브 커머스
- **기술 스택**: Hono + Cloudflare Pages + D1
- **배포 플랫폼**: Cloudflare Pages

## 📄 라이선스

이 프로젝트는 데모 목적으로 제작되었습니다.

---

**최종 업데이트**: 2026-02-03  
**버전**: 2.1.0  
**상태**: 나이스페이먼츠 결제 연동 완료

**주요 기능**:
- ✅ 라이브 커머스 시스템 (YouTube + 원클릭 구매)
- ✅ 카카오 로그인 (OAuth2)
- ✅ 배송지 관리 (CRUD + 기본 배송지)
- ✅ 주문서 작성 및 나이스페이먼츠 결제
- ✅ 셀러 전용 링크 (UTM 트래킹)
- ✅ 셀러 대시보드 (매출 통계 + CSV 정산서)
- ✅ 10% 수수료 자동 계산
- ✅ 나이스페이먼츠 실제 결제 연동 (**신규**)

**백업 파일**: https://www.genspark.ai/api/files/s/aaMYHkss
