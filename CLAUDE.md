# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## 테마 규칙 (필수)

페이지를 생성하거나 수정할 때 **반드시** 해당 페이지의 테마에 맞는 색상을 사용합니다.

### 다크 테마 페이지 (유저 대면 메인)
- **해당**: 홈(`/`), 라이브(`/live/*`), 쇼츠(`/shorts`), 마이페이지(`/user/profile`), 알림(`/notifications`), 셀러 공개(`/profile/*`, `/s/*`)
- **배경**: `bg-[#020202]` (메인), `bg-[#121212]` (카드), `bg-[#1A1A1A]` (서브)
- **텍스트**: `text-white` (제목), `text-gray-300` (본문), `text-gray-400`~`text-gray-500` (보조)
- **보더**: `border-[#1A1A1A]`, `border-[#2A2A2A]`
- ❌ 절대 금지: `text-gray-900`, `text-gray-800`, `text-gray-700`, `bg-white`, `border-gray-200`

### 화이트 테마 페이지 (쇼핑/결제)
- **해당**: 쇼핑(`/browse`), 장바구니(`/cart`), 결제(`/checkout`), 상품상세(`/products/*`), 주문내역(`/my-orders`), 검색(`/search`), 위시리스트(`/wishlist`), 배송지(`/mypage/addresses`), 계정설정(`/account/*`), 공동구매(`/referral/*`), 맛집지도(`/restaurant-map`), 딜충전(`/points/charge`)
- **배경**: `bg-white` (메인), `bg-gray-50` (서브)
- **텍스트**: `text-gray-900` (제목), `text-gray-600` (본문), `text-gray-500` (보조)
- **보더**: `border-gray-100`, `border-gray-200`
- ❌ 절대 금지: `text-white` (컬러 버튼 위 제외), `text-gray-100`, `bg-[#020202]`, `bg-[#121212]`, `border-[#333]`, `hover:bg-[#333]`

### 라이트 테마 (셀러/어드민 대시보드)
- **해당**: 셀러(`/seller/*`), 어드민(`/admin/*`)
- **배경**: SellerLayout/AdminLayout이 처리 (`#F4F5F7`)
- **텍스트**: `text-gray-900` (제목), `text-gray-700` (본문)
- ❌ 절대 금지: `text-white` (컬러 버튼 위 제외)

### 공통 규칙
- `text-white`는 **컬러 배경 버튼** 위에서만 사용 (bg-pink-500, bg-red-500, bg-blue-600 등)
- 새 페이지 생성 시 위 목록에서 해당 테마 확인 → 해당 테마의 색상만 사용
- CSS 변수(`text-foreground`, `bg-muted`) 대신 **명시적 색상 클래스** 사용 (다크 변수 간섭 방지)

## i18n (다국어) 필수 규칙

셀러 대시보드(`src/pages/Seller*.tsx`, `src/components/Seller*.tsx`)를 수정할 때:

1. **모든 UI 텍스트**는 `t()` 함수를 사용해야 합니다. 하드코딩 한국어 금지.
2. 새로운 텍스트 추가 시 `public/locales/{ko,en,ja,zh,es,fr}/translation.json`의 **6개 언어** 모두에 키를 추가합니다.
3. 키 네이밍: `common.*` (공통 버튼/상태), `seller.*` (셀러 전용)
4. 예시:
   ```tsx
   // ❌ 하드코딩
   <button>저장</button>
   
   // ✅ i18n
   <button>{t('common.save')}</button>
   ```

## 다크 테마 (요약)

- 유저 대면 메인: 다크 (`#020202` 배경) — 위 테마 규칙 참조
- 쇼핑/결제: 화이트 (`bg-white`)
- 셀러/어드민: 라이트 (`#F4F5F7`)

## 인증

- Bearer 토큰 우선, 세션 쿠키 차선 (순서 중요)
- 셀러/어드민: localStorage JWT 즉시 체크 (Firebase 대기 안 함)
- 유저: Firebase Auth + optimistic rendering (캐시 있으면 스피너 없이 렌더)

## DB 스키마

- 프로덕션 DB 컬럼명은 `src/shared/db/production-schema.ts` 참조
- `stock` (not `stock_quantity`), `is_active` (not `status`), `credit_amount` (not `seller_amount`)

## 딜 포인트 시스템

- 충전: 1원 = 1딜 (수수료 없음)
- 후원/상품 결제: 딜 즉시 차감
- 셀러 정산: 15% 플랫폼 수수료 적용
- 최소 후원: 500딜
