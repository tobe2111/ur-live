# UR Live 개발 기록

## Phase 1: 핵심 기능 구현 (2026-02-14)

### 1. 실시간 채팅 시스템 ✅
- **기능**: 3초 폴링, 욕설 필터, 메시지 삭제
- **API**: 
  - `POST /api/live-streams/:streamId/messages` - 채팅 전송
  - `GET /api/live-streams/:streamId/messages` - 채팅 조회
  - `DELETE /api/chat-messages/:messageId` - 메시지 삭제
- **DB**: `chat_messages` 테이블 (`migrations/0039_add_chat_messages.sql`)
- **특징**: 셀러/관리자 뱃지, 500자 제한

### 2. 알림 시스템 (Notifications) ✅
- **기능**: 주문/라이브/재고/시스템/채팅 알림
- **API**: 
  - `GET /api/notifications/:userId` - 알림 조회
  - `POST /api/notifications` - 알림 생성
  - `PATCH /api/notifications/:notificationId/read` - 읽음 처리
- **DB**: `notifications` 테이블 (`migrations/0040_add_notifications.sql`)
- **타입**: order, live, inventory, system, chat

### 3. 시청자 수 관리 ✅
- **기능**: 실시간 표시, 어드민/셀러 조정
- **API**:
  - `POST /api/admin/streams/:streamId/viewer-count` - 시청자 수 설정
  - `POST /api/live-streams/:streamId/increment-viewer` - 시청자 +1
- **DB**: `live_streams.viewer_count` 컬럼 추가 (`migrations/0043_add_viewer_count.sql`)
- **UI**: 라이브 페이지 헤더 표시

### 4. 셀러 카카오톡 문의 ✅
- **기능**: 카카오톡 오픈채팅 링크, 외부 거래 경고
- **API**: 
  - `GET /api/sellers/:sellerId` - 셀러 정보 (kakao_chat_link 포함)
  - `PATCH /api/seller/profile` - 카카오톡 링크 수정
- **DB**: `sellers.kakao_chat_link` 컬럼 추가 (`migrations/0041_add_seller_kakao_chat.sql`)
- **UI**: 셀러 프로필 수정 페이지

### 5. 약관 페이지 ✅
- **페이지**: 
  - `/terms` - 이용약관
  - `/privacy` - 개인정보처리방침
  - `/refund` - 환불정책
  - `/faq` - FAQ
- **컴포넌트**: 
  - `TermsOfServicePage.tsx`
  - `PrivacyPolicyPage.tsx`
  - `RefundPolicyPage.tsx`
  - `FAQPage.tsx`

---

## Phase 2: 향상 기능 구현 (2026-02-14)

### 6. 배송 추적 시스템 ✅
- **기능**: 택배사 정보, 송장번호, 조회 링크
- **API**: 
  - `PATCH /api/seller/orders/:orderId/shipping` - 배송 정보 업데이트
- **DB**: `orders.carrier`, `orders.tracking_number` 컬럼 추가 (`migrations/0042_add_shipping_tracking.sql`)
- **UI**: 주문 상세 페이지 배송 추적 정보 표시
- **택배사**: CJ대한통운, 우체국택배, 한진택배, 롯데택배, 로젠택배

### 7. 검색 강화 ✅
- **기능**: 자동완성, 정렬, 가격 필터
- **정렬**: 관련도순, 낮은 가격순, 높은 가격순, 최신순
- **필터**: 최소/최대 가격 범위
- **API**: `GET /api/search?q=검색어&sort=price_asc&min_price=10000&max_price=50000`
- **UI**: SearchPage 개선

### 8. 소셜 공유 ✅
- **기능**: Web Share API, 카카오톡 공유, 링크 복사
- **메타태그**: Open Graph 메타태그 추가 (`index.html`)
- **API**: Kakao SDK 통합 (`window.Kakao.Share.sendDefault`)
- **UI**: 상품 상세 페이지 공유 버튼

---

## Phase 3: 모바일 최적화 & 버그 수정 (2026-02-14)

### 9. 라이브 페이지 UI 개선 ✅
- **폰트 축소**: LIVE 배지 11px→9px, 채팅 12px→10px
- **버튼 위치**: 채팅/공유 버튼 bottom-40→bottom-180px
- **SNS 버튼**: 9×9→7×7 (w-7 h-7)
- **상품 카드**: 폰트 및 간격 최적화

### 10. 결제 페이지 디버깅 강화 ✅
- **로깅**: 위젯 생명주기 전체 추적
- **DOM 대기**: 3초→5초 (모바일 고려)
- **상태 체크**: widgets, ready, isProcessing 검증
- **에러 메시지**: 구체적인 디버깅 정보

### 🔥 11. 긴급 수정: 모바일 레이아웃 버그 해결 ✅
**문제**: 
- GripFrameLayout이 모바일에서도 360px 컨테이너로 감싸면서 TossPayments 위젯 렌더링 실패
- 상품 상세 페이지: "구매하기" 버튼 500 에러
- 장바구니: "장바구니 추가" 500 에러

**원인**:
- GripFrameLayout의 overflow 제약이 모바일에도 적용됨
- 360px 고정 너비 컨테이너가 위젯 렌더링 방해
- z-index 충돌로 인한 이벤트 전파 차단

**해결**:
- GripFrame을 PC 전용으로 변경 (`lg:block` / `lg:hidden`)
- 모바일은 전체 화면 레이아웃 (`min-h-screen`)
- overflow 제약 제거로 위젯 렌더링 정상화

**파일**: `src/components/GripFrameLayout.tsx`

**커밋**: 
- `2d191c8` - Critical mobile layout fix
- `b694f5d` - README update with fix details

### 12. 상품 상세 페이지 뒤로가기 수정 ✅
**문제**: 
- 뒤로가기 시 로그인 페이지로 이동
- 로그인 redirect 후 history가 로그인 페이지를 가리킴

**해결**:
- referrer 체크하여 로그인/카카오 콜백이면 홈으로 이동
- history 없으면 홈으로 이동
- 일반 페이지는 정상 뒤로가기

**파일**: `src/pages/ProductDetailPage.tsx`

### 13. 장바구니 API 에러 로깅 추가 ✅
**기능**: 
- 500 에러 발생 시 상세 로그 출력
- 에러 메시지 및 스택 추적
- 디버깅 용이성 향상

**API**: `POST /api/cart`

**파일**: `src/index.tsx`

---

## 현재 구현된 주요 기능 요약

### ✅ 사용자 기능
1. **카카오 로그인**: OAuth 2.0 연동, 자동 회원가입
2. **상품 검색**: 자동완성, 정렬, 가격 필터
3. **장바구니**: 추가/수정/삭제, 옵션 지원
4. **주문/결제**: TossPayments 연동, 배송지 관리
5. **배송 추적**: 택배사 연동, 실시간 조회
6. **소셜 공유**: 카카오톡, 링크 복사

### ✅ 라이브 기능
1. **실시간 채팅**: 3초 폴링, 욕설 필터
2. **시청자 수**: 실시간 표시, 조정 기능
3. **상품 연동**: 라이브 중 상품 판매
4. **YouTube/TikTok**: 영상 임베드

### ✅ 셀러 기능
1. **상품 관리**: 등록/수정/삭제, 옵션 관리
2. **주문 관리**: 주문 조회, 배송 처리
3. **라이브 관리**: 방송 생성, 상품 연결
4. **카카오톡 문의**: 오픈채팅 링크 연결

### ✅ 어드민 기능
1. **시청자 수 조정**: 수동 설정
2. **알림 관리**: 시스템 알림 발송
3. **정산 관리**: 셀러별 정산 처리

---

## 기술 스택

### Frontend
- React 18 + TypeScript 5
- React Router v6
- TailwindCSS 3
- Vite 6
- Axios (API 통신)
- Lucide React (아이콘)

### Backend
- Hono 4 (Edge Runtime)
- Cloudflare Workers
- Cloudflare D1 (SQLite)
- TossPayments Widget v1

### 외부 연동
- Kakao Login API
- TossPayments
- YouTube/TikTok 임베드
- Web Share API

---

## 배포 환경

### Production
- URL: https://live.ur-team.com
- Platform: Cloudflare Pages
- Database: Cloudflare D1 (Production)

### Development
- Local: `npm run dev:sandbox`
- Database: Cloudflare D1 (--local)
- Port: 3000

### Build Hash
- Latest: `2d668d9f` (2026-02-14)
- Previous: `57b699f1`, `415e1979`

---

## 데이터베이스 마이그레이션

### Phase 1 & 2
- `0039_add_chat_messages.sql` - 채팅 메시지
- `0040_add_notifications.sql` - 알림 시스템
- `0041_add_seller_kakao_chat.sql` - 셀러 카카오톡
- `0042_add_shipping_tracking.sql` - 배송 추적
- `0043_add_viewer_count.sql` - 시청자 수

### 적용 방법
```bash
# Local
npm run db:migrate:local

# Production
npm run db:migrate:prod
```

---

## 주요 API 엔드포인트

### 인증
- `POST /api/auth/kakao/callback` - 카카오 로그인 콜백

### 상품
- `GET /api/products` - 상품 목록
- `GET /api/products/:id` - 상품 상세
- `GET /api/search` - 상품 검색

### 장바구니
- `GET /api/cart/:userId` - 장바구니 조회
- `POST /api/cart` - 장바구니 추가
- `PUT /api/cart/:cartItemId` - 수량 수정
- `DELETE /api/cart/:cartItemId` - 삭제

### 라이브
- `GET /api/live-streams` - 라이브 목록
- `GET /api/live-streams/:streamId` - 라이브 상세
- `POST /api/live-streams/:streamId/messages` - 채팅 전송
- `GET /api/live-streams/:streamId/messages` - 채팅 조회
- `POST /api/live-streams/:streamId/increment-viewer` - 시청자 +1

### 알림
- `GET /api/notifications/:userId` - 알림 조회
- `POST /api/notifications` - 알림 생성
- `PATCH /api/notifications/:notificationId/read` - 읽음 처리

### 셀러
- `GET /api/sellers/:sellerId` - 셀러 정보
- `PATCH /api/seller/profile` - 프로필 수정
- `PATCH /api/seller/orders/:orderId/shipping` - 배송 정보 업데이트

### 어드민
- `POST /api/admin/streams/:streamId/viewer-count` - 시청자 수 설정

---

## 남은 작업 (Optional)

### 재고 관리 강화
- 알림 UI 구현
- 품절 임박 배지
- 자동 품절 처리

### 주문 관리 강화
- 엑셀 다운로드
- 일괄 처리
- 반품/교환 처리

### 장바구니 디자인 개선
- 세련된 UI
- 카드 스타일
- 그림자 효과

---

## 트러블슈팅 히스토리

### 1. TossPayments 위젯 렌더링 실패 (2026-02-14)
**증상**: 모바일에서 결제 수단 미표시
**원인**: GripFrameLayout의 360px 고정 컨테이너
**해결**: PC 전용 GripFrame, 모바일 전체 화면

### 2. 장바구니/구매하기 500 에러 (2026-02-14)
**증상**: API 요청 실패
**원인**: GripFrameLayout의 overflow 제약
**해결**: 모바일 레이아웃 분리

### 3. 뒤로가기 시 로그인 페이지 이동 (2026-02-14)
**증상**: 상품 상세에서 뒤로가기 시 로그인 페이지
**원인**: 로그인 redirect 후 history 문제
**해결**: referrer 체크하여 홈으로 이동

---

## 성능 최적화

### Frontend
- Lazy loading (React.lazy)
- Code splitting (Vite)
- Image optimization (LazyImage 컴포넌트)
- CSS 번들 최소화

### Backend
- Edge runtime (Cloudflare Workers)
- D1 인덱스 최적화
- API 캐싱 전략

### Database
- 인덱스: products(seller_id), cart_items(user_id), orders(user_id), notifications(user_id)
- 쿼리 최적화: JOIN 최소화

---

## 보안

### 인증
- Kakao OAuth 2.0
- 세션 토큰 기반
- localStorage 암호화 (예정)

### API
- CORS 설정
- Rate limiting (예정)
- SQL Injection 방지 (Prepared Statements)

### 결제
- TossPayments 공식 SDK
- HTTPS 강제
- 서버사이드 검증

---

## 테스트

### 수동 테스트 완료
- [x] 카카오 로그인
- [x] 상품 검색
- [x] 장바구니 추가
- [x] 결제 플로우
- [x] 배송 추적
- [x] 라이브 채팅
- [x] 소셜 공유

### 모바일 테스트 완료
- [x] 360px ~ 428px 반응형
- [x] 터치 이벤트
- [x] 스크롤 최적화
- [x] 뒤로가기 네비게이션

---

## 참고 문서

### 외부 API
- [Kakao Login API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [TossPayments](https://docs.tosspayments.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)

### 내부 문서
- README.md - 프로젝트 개요
- DEVELOPMENT_LOG.md - 이 문서

---

**최종 업데이트**: 2026-02-14
**작성자**: Claude (AI Assistant)
**버전**: Phase 3 Complete
