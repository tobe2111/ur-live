# Toss Live Commerce - 프로젝트 요약

## 📌 프로젝트 개요
- **이름**: Toss Live Commerce
- **목적**: 라이브 커머스 플랫폼 (YouTube/TikTok 라이브 방송 중 실시간 상품 판매)
- **기술 스택**: Hono + Cloudflare Pages + D1 Database + Toss Payments
- **배포 URL**: 
  - Production: https://live.ur-team.com
  - Preview: https://b768fefa.toss-live-commerce.pages.dev

---

## 🎯 완료된 핵심 기능

### 1. 인증 시스템 ✅
- **Kakao 소셜 로그인** (일반 사용자)
- **이메일 로그인** (셀러/관리자)
- **중앙화된 인증 시스템** (`src/utils/auth.ts`)
- **로그인 리다이렉트 & 복귀 URL 처리**
- **임시 장바구니 아이템 복원**

**표준 localStorage 키**:
- `session` - 세션 토큰
- `user_id` - 사용자 ID
- `user_name` - 사용자 이름
- `user_email` - 사용자 이메일
- `user_profile_image` - 프로필 이미지

### 2. 결제 시스템 ✅
- **Toss Payments 결제 위젯 통합**
- **CheckoutPage**: 결제 수단 선택, 배송지 관리, 금액 계산
- **PaymentSuccessPage**: 결제 성공 처리, 백엔드 승인 API 호출
- **PaymentFailPage**: 결제 실패 처리, 재시도 옵션
- **백엔드 결제 승인 API**: `POST /api/payments/confirm`

**테스트 키**:
- Client: `test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN`
- Secret: `test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY`

### 3. 라이브 커머스 기능 ✅
- **라이브 스트림 생성/관리** (셀러)
- **실시간 상품 변경** (셀러 라이브 컨트롤)
- **라이브 페이지**: YouTube/TikTok 영상 임베드
- **실시간 장바구니 담기**
- **라이브 중 결제 연동**

### 4. 상품 관리 ✅
- **셀러 상품 CRUD**
- **상품 옵션 관리**
- **재고 관리**
- **상품 이미지 업로드**
- **단건 조회 API** (`GET /api/seller/products/:id`)
- **Cascade 삭제** (product_options, cart_items, order_items 연동)

### 5. 장바구니 시스템 ✅
- **장바구니 추가/수정/삭제**
- **수량 변경 & 재고 확인**
- **총 금액 계산 (상품 + 배송비 3000원)**
- **로그인 전 임시 저장 & 로그인 후 복원**

### 6. 주문 관리 ✅
- **주문 생성**
- **주문 조회** (사용자별, 주문번호별)
- **주문 취소 & 재고 복원**
- **셀러별 주문 조회**

### 7. 배송지 관리 ✅
- **배송지 추가/수정/삭제**
- **기본 배송지 설정**
- **Daum 우편번호 API 연동**

---

## 🏗️ 데이터베이스 구조 (Cloudflare D1)

### 주요 테이블
```sql
-- 사용자
users (id, email, name, kakao_id, profile_image, created_at)

-- 셀러
sellers (id, email, name, business_name, business_number, bank_account, ...)

-- 라이브 스트림
live_streams (id, seller_id, title, description, youtube_video_id, tiktok_username, 
              platform, status, scheduled_at, started_at, ended_at, current_product_id)

-- 상품
products (id, seller_id, name, price, discount_rate, stock, description, image_url, ...)

-- 상품 옵션
product_options (id, product_id, option_name, option_value, additional_price, stock)

-- 장바구니
cart_items (id, user_id, product_id, quantity, price_snapshot, option_id, live_stream_id)

-- 주문
orders (id, order_no, user_id, total_amount, status, shipping_address, created_at)
order_items (id, order_id, product_id, quantity, price_snapshot, option_value)

-- 배송지
shipping_addresses (id, user_id, recipient_name, phone, postal_code, address, 
                    address_detail, is_default)
```

### 데이터 관계
- `live_streams.current_product_id` → `products.id`
- `products.id` ← `product_options.product_id`
- `products.id` ← `cart_items.product_id`
- `products.id` ← `order_items.product_id`

---

## 📂 주요 파일 구조

```
webapp/
├── src/
│   ├── index.tsx                    # 백엔드 API (Hono)
│   ├── App.tsx                      # 프론트엔드 라우팅
│   ├── utils/
│   │   └── auth.ts                  # 🔐 중앙 인증 시스템
│   └── pages/
│       ├── HomePage.tsx             # 메인 페이지
│       ├── LoginPage.tsx            # 로그인 페이지
│       ├── KakaoCallbackPage.tsx    # Kakao 로그인 콜백
│       ├── LivePage.tsx             # 라이브 방송 페이지
│       ├── CartPage.tsx             # 장바구니 페이지
│       ├── CheckoutPage.tsx         # 💳 결제 페이지
│       ├── PaymentSuccessPage.tsx   # 결제 성공 페이지
│       ├── PaymentFailPage.tsx      # 결제 실패 페이지
│       ├── MyOrdersPage.tsx         # 내 주문 내역
│       ├── SellerPage.tsx           # 셀러 대시보드
│       ├── SellerProductsPage.tsx   # 셀러 상품 관리
│       ├── SellerProductEditPage.tsx # 셀러 상품 수정
│       ├── SellerLiveControlPage.tsx # 셀러 라이브 컨트롤
│       └── ...
├── migrations/                      # D1 마이그레이션
│   ├── 0001_initial_schema.sql
│   └── ...
├── public/                          # 정적 파일
├── wrangler.jsonc                   # Cloudflare 설정
├── package.json
└── ecosystem.config.cjs             # PM2 설정 (개발용)
```

---

## 🔧 주요 API 엔드포인트

### 인증 API
- `POST /api/auth/kakao/callback` - Kakao 로그인 콜백
- `POST /api/seller/login` - 셀러 로그인
- `POST /api/admin/login` - 관리자 로그인

### 장바구니 API
- `GET /api/cart/:userId` - 장바구니 조회
- `POST /api/cart` - 장바구니 추가
- `PUT /api/cart/:cartItemId` - 수량 변경
- `DELETE /api/cart/:cartItemId` - 아이템 삭제

### 결제 API
- `POST /api/payments/confirm` - 결제 승인

### 주문 API
- `POST /api/orders` - 주문 생성
- `GET /api/orders/user/:userId` - 사용자 주문 조회
- `GET /api/orders/:orderNo` - 주문번호로 조회
- `POST /api/orders/:orderId/cancel` - 주문 취소

### 상품 API
- `GET /api/seller/products/:id` - 셀러 상품 단건 조회
- `DELETE /api/seller/products/:id` - 셀러 상품 삭제

### 배송지 API
- `GET /api/shipping-addresses/:userId` - 배송지 목록
- `POST /api/shipping-addresses` - 배송지 추가
- `PUT /api/shipping-addresses/:id` - 배송지 수정
- `DELETE /api/shipping-addresses/:id` - 배송지 삭제

---

## 🚨 핵심 해결 이슈

### 1. localStorage 키 불일치 문제 ✅
**증상**: 라이브 페이지에서 결제 버튼 클릭 시 "로그인이 필요합니다" 팝업

**원인**:
- CheckoutPage: `userId` 사용 ❌
- CartPage: `user_id` 사용 ✅
- LivePage: `user_id` 사용 ✅

**해결**: 모든 페이지에서 `user_id` 사용으로 통일

### 2. CheckoutPage 결제 위젯 오류 ✅
**증상**: "결제 정보를 불러올 수 없습니다" 에러

**원인**:
1. `totalAmount`가 `useEffect`보다 늦게 정의됨
2. `clientKey` 검증 누락
3. 에러 처리 미흡

**해결**:
- `subtotal`과 `totalAmount`를 컴포넌트 상단에서 계산
- `clientKey` 검증 로직 추가
- 사용자 친화적 에러 메시지 추가

### 3. LivePage current_product_id NULL 문제 ✅
**증상**: 라이브 페이지에서 상품 카드/결제 버튼 미표시

**원인**: `live_streams.current_product_id`가 NULL

**해결**:
- 프로덕션 DB에서 `current_product_id` 설정
- 폴백 UI 추가 (상품 준비 중...)

### 4. 셀러 상품 관리 개선 ✅
- 단건 조회 API 추가
- Cascade 삭제 구현
- SellerProductEditPage 구성

---

## 📋 개발 가이드라인

### ✅ 필수 규칙

#### 1. 인증 시스템
```typescript
// ❌ 절대 금지
const userId = localStorage.getItem('user_id')

// ✅ 필수 사용
import { getUserId, isLoggedIn, requireLogin } from '@/utils/auth'
const userId = getUserId()
```

#### 2. 로그인 체크
```typescript
useEffect(() => {
  if (!isLoggedIn()) {
    requireLogin(navigate, '로그인이 필요합니다.')
    return
  }
  loadData()
}, [navigate])
```

#### 3. 에러 처리
```typescript
try {
  const response = await axios.get('/api/endpoint')
  // 성공 처리
} catch (error) {
  console.error('Error:', error)
  const message = error.response?.data?.error || '오류가 발생했습니다.'
  alert(message)
}
```

---

## 🧪 배포 전 테스트 체크리스트

### 인증 플로우
- [ ] 로그아웃 상태 → 보호된 페이지 접근 → 로그인 리다이렉트
- [ ] Kakao 로그인 → 메인 페이지
- [ ] 로그인 후 원래 페이지 복귀
- [ ] 로그아웃 → localStorage 정리

### 장바구니 플로우
- [ ] 라이브 → 장바구니 담기 → /cart
- [ ] 로그아웃 상태 장바구니 담기 → 로그인 → 자동 담기
- [ ] 수량 변경/삭제

### 결제 플로우
- [ ] 장바구니 → /checkout
- [ ] 배송지 선택/추가
- [ ] 결제 진행 → /payment/success
- [ ] 결제 승인 API
- [ ] 장바구니 비우기
- [ ] 결제 실패 → /payment/fail

---

## 📚 주요 문서

1. **DEVELOPMENT_GUIDELINES.md** - 📖 개발 가이드라인 (필수 참고)
2. **AUTH_SYSTEM_CENTRALIZATION_COMPLETE.md** - 인증 시스템 중앙화
3. **TOSSPAYMENTS_IMPLEMENTATION_COMPLETE.md** - 결제 시스템 구현
4. **LOCALSTORAGE_KEY_FIX.md** - localStorage 키 표준화
5. **CHECKOUT_ERROR_FIX.md** - CheckoutPage 오류 수정
6. **SELLER_PRODUCT_MANAGEMENT_FIX.md** - 셀러 상품 관리 개선
7. **LIVE_PAGE_PRODUCT_FIX.md** - 라이브 페이지 상품 연결

---

## 🎯 향후 개선 계획

### Phase 1: 결제 시스템 강화
- [ ] DB 연동 (payments, orders 테이블)
- [ ] 재고 차감 로직
- [ ] 웹훅 처리 (입금 알림)
- [ ] 실제 운영 키 적용

### Phase 2: 라이브 커머스 고도화
- [ ] 실시간 채팅
- [ ] 실시간 구매 알림
- [ ] 라이브 시청자 수 표시
- [ ] 라이브 하이라이트 클립

### Phase 3: 관리자 기능
- [ ] 정산 관리
- [ ] 통계/대시보드
- [ ] 사용자/셀러 관리
- [ ] 세금계산서 발행

---

## 🔗 주요 링크

- **Production**: https://live.ur-team.com
- **Preview**: https://b768fefa.toss-live-commerce.pages.dev
- **Toss Payments Docs**: https://docs.tosspayments.com
- **Cloudflare D1 Docs**: https://developers.cloudflare.com/d1

---

**마지막 업데이트**: 2026-02-11  
**버전**: 1.0.0  
**상태**: ✅ 핵심 기능 완료, 배포 완료
