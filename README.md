# UR Live - 라이브 커머스 플랫폼

UR Team의 실시간 라이브 쇼핑 플랫폼입니다.

## 🚀 최신 업데이트 (2026-02-14)

### 🎯 Phase 3: 모바일 최적화 & 결제 안정화 ✅

#### 🔥 긴급 수정: 모바일 레이아웃 버그 해결 (CRITICAL)
**문제**: GripFrame 도입 후 모바일에서 결제 수단 미표시, 장바구니/구매하기 버튼 오류 발생
- **원인**: GripFrameLayout이 모바일에서도 360px 컨테이너로 감싸면서 TossPayments 위젯 렌더링 실패
- **증상**: 
  - ❌ 결제 페이지: "결제 수단" 영역 비어있음
  - ❌ 상품 상세: "구매하기" 클릭 시 실패
  - ❌ 장바구니: "장바구니 추가" 실패
- **해결**: 
  - ✅ GripFrame을 PC 전용으로 변경 (`lg:block` / `lg:hidden`)
  - ✅ 모바일은 전체 화면 레이아웃 (`min-h-screen`)
  - ✅ overflow 제약 제거로 위젯 렌더링 정상화

#### 1. 라이브 페이지 UI 개선 ✅
- **폰트 크기 축소**: LIVE 배지 11px→9px, 채팅 12px→10px
- **채팅/공유 버튼 위치 하향**: bottom-40→bottom-180px (상품 카드 회피)
- **SNS 버튼 크기 축소**: 9×9→7×7 (w-7 h-7)
- **상품 카드 최적화**: 폰트 및 간격 축소

#### 2. 결제 페이지 디버깅 강화 ✅
- **상세 로깅 추가**: 위젯 생명주기 전체 추적
- **DOM 대기 시간 증가**: 3초→5초 (모바일 환경 고려)
- **위젯 상태 체크**: widgets, ready, isProcessing 모두 검증
- **에러 메시지 개선**: 디버깅을 위한 구체적인 메시지
- **결제 버튼 상태 표시**: 시스템 로딩/UI 준비 중 구분
- **요소 크기 로깅**: payment-method, agreement 크기 확인

### 13. 긴급 버그 수정 (장바구니 500 에러, 이미지 무한 로드) ✅
**문제**:
- **장바구니 API 500 에러**: `priceSnapshot` 파라미터 누락으로 구매하기/장바구니 추가 실패
- **무한 이미지 로드**: `via.placeholder.com` DNS 에러로 `onError` 무한 루프

**해결**:
- **priceSnapshot 추가**: `product.current_price || product.price` 값 전송
- **인라인 SVG 사용**: 외부 placeholder 대신 data URI SVG 사용
- **무한 루프 방지**: `dataset.fallbackApplied` 플래그로 한 번만 실행

**파일**:
- `src/pages/ProductDetailPage.tsx` - 장바구니/구매하기 수정, 이미지 fallback
- `src/pages/LivePage.tsx` - 이미지 fallback

### 12. UX 개선 (뒤로가기, 에러 로깅) ✅
**기능**:
- **상품 상세 뒤로가기**: 로그인/카카오 콜백에서 온 경우 홈으로 이동
- **장바구니 API 에러 로깅**: 500 에러 발생 시 상세 로그 (message, stack)
- **개발 문서 추가**: DEVELOPMENT_LOG.md (전체 기능, API, 트러블슈팅)

**파일**:
- `src/pages/ProductDetailPage.tsx` - 뒤로가기 로직
- `src/index.tsx` - POST /api/cart 에러 로깅
- `DEVELOPMENT_LOG.md` - 신규 개발 문서

---

## 📖 개발 문서

프로젝트의 전체 기능, API 엔드포인트, 데이터베이스 마이그레이션, 트러블슈팅 히스토리는 [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)를 참고하세요.

---

### 🎯 주요 기능 추가 (Phase 1 & 2 Complete)

#### 1. 실시간 채팅 시스템 ✅
- **채팅 메시지 전송/수신**: 3초마다 자동 새로고침
- **욕설 필터링**: 비속어 자동 차단
- **메시지 제한**: 500자 이내
- **셀러/관리자 뱃지**: 메시지 구분 표시
- **메시지 삭제**: 관리자 권한

#### 2. 알림 시스템 (Notifications) ✅
- **주문 알림**: 주문 생성/상태 변경
- **라이브 알림**: 방송 시작
- **재고 알림**: 재고 부족
- **시스템 알림**: 중요 공지
- **채팅 알림**: 문의 메시지

#### 3. 시청자 수 관리 ✅
- **실시간 시청자 수**: 라이브 페이지 상단 표시
- **어드민/셀러 조정**: 대시보드에서 수동 조정 가능
- **자동 증가**: 사용자 입장 시 +1

#### 4. 셀러 카카오톡 문의 ✅
- **카카오톡 오픈채팅 링크**: 셀러 프로필에 설정
- **외부 거래 경고**: 플랫폼 외부 거래 금지 안내
- **고객센터 연결**: 0507-0177-0432

#### 5. 약관 페이지 ✅
- **이용약관** (`/terms`)
- **개인정보처리방침** (`/privacy`)
- **환불정책** (`/refund`)
- **FAQ** (`/faq`)

#### 6. 배송 추적 시스템 ✅
- **택배사 정보**: CJ대한통운, 우체국택배, 한진택배 등
- **송장번호 표시**: 주문 상세 페이지
- **배송조회 링크**: 각 택배사 직접 연결
- **실시간 업데이트**: 배송 상태 자동 동기화

#### 7. 검색 강화 ✅
- **자동완성**: 2글자 이상 입력 시 제안
- **정렬 기능**: 관련도순, 낮은/높은 가격순, 최신순
- **가격 필터**: 최소/최대 가격 범위 설정
- **결과 카운트**: 총 상품 개수 표시

#### 8. 소셜 공유 ✅
- **Web Share API**: 네이티브 공유 기능
- **카카오톡 커머스**: 상품 정보 리치 프리뷰
- **링크 복사**: Clipboard API fallback
- **Open Graph**: Facebook, Twitter 카드 지원

### 📦 데이터베이스 마이그레이션
- `0039_add_chat_messages.sql`: 채팅 메시지 및 차단 테이블
- `0040_add_notifications.sql`: 알림 시스템
- `0041_add_seller_kakao_chat.sql`: 셀러 카카오톡 링크
- `0042_add_shipping_tracking.sql`: 배송 추적 정보
- `0043_add_viewer_count.sql`: 시청자 수 컬럼

## 🌐 배포 정보

- **Production**: https://live.ur-team.com
- **Latest Preview**: https://a8708df2.toss-live-commerce.pages.dev
- **GitHub**: https://github.com/tobe2111/ur-live
- **Build Hash**: `620a6e9a` (2026-02-14 CRITICAL FIX)

## 🛠️ 기술 스택

### Frontend
- **React** 18.x
- **TypeScript** 5.x
- **Vite** 6.x
- **TailwindCSS** 3.x
- **Cosmic Space Theme** (우주 테마 디자인) ⭐ **NEW**
- **Grip-Style Frame** (모바일 프레임 레이아웃)

### Backend
- **Hono** 4.x (Edge Runtime)
- **Cloudflare Workers**
- **Cloudflare D1** (SQLite Database)
- **Cloudflare KV** (Session Storage)

### Payment
- **TossPayments** Payment Widget v2
- 테스트 결제 지원
- localStorage 백업을 통한 안정적인 결제 플로우

## 📦 설치 및 실행

### 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 시작 (Cloudflare Pages 로컬)
npm run dev:sandbox

# D1 데이터베이스와 함께 개발
npm run dev:d1
```

### 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview
```

### 배포

```bash
# Cloudflare Pages에 배포
npm run deploy

# 특정 프로젝트에 배포
npm run deploy:prod
```

## 🗄️ 데이터베이스

### D1 마이그레이션

```bash
# 로컬 DB 마이그레이션
npm run db:migrate:local

# 프로덕션 DB 마이그레이션
npm run db:migrate:prod

# 테스트 데이터 삽입
npm run db:seed

# DB 초기화
npm run db:reset
```

### D1 콘솔

```bash
# 로컬 DB 쿼리
npm run db:console:local

# 프로덕션 DB 쿼리
npm run db:console:prod
```

## 🔑 환경 변수

### 개발 환경 (`.dev.vars`)

```bash
TOSS_SECRET_KEY=test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
```

### 프로덕션 환경 (Cloudflare Pages)

```bash
# ⚠️ 중요: Secret 변경 후 반드시 재배포 필요!
echo "test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY" | \
  npx wrangler pages secret put TOSS_SECRET_KEY --project-name toss-live-commerce

# 빌드 및 재배포 (필수!)
npm run build
npx wrangler pages deploy dist --project-name toss-live-commerce
```

**📋 자세한 배포 가이드:** [Cloudflare 배포 프로토콜](./CLOUDFLARE_DEPLOYMENT_PROTOCOL.md)

## 📋 주요 기능

### 🎬 숏폼 커머스 (NEW!)
- ✅ 요고(yo-go) 스타일 세로 영상 레이아웃
- ✅ Snap Scrolling & Auto Play
- ✅ 좋아요, 공유, 장바구니 인터랙션
- ✅ Slide-up 결제 Drawer
- ✅ 모바일 최적화 (9:16 비율)

### 사용자 기능
- ✅ 카카오 로그인
- ✅ 라이브 스트리밍 시청
- ✅ 실시간 채팅
- ✅ 상품 상세 페이지 (이미지 갤러리) ⭐ **NEW**
- ✅ 장바구니
- ✅ 주문/결제 (TossPayments)
- ✅ 주문 내역 조회
- ✅ 배송지 관리

### 판매자 기능
- ✅ 상품 관리 (CRUD)
- ✅ 상품 상세 이미지 관리 (URL 업로드) ⭐ **NEW**
- ✅ 라이브 방송 관리
- ✅ 주문 관리
- ✅ 통계 대시보드

### 관리자 기능
- ✅ 사용자 관리
- ✅ 판매자 승인
- ✅ 전체 통계

## 🔧 개발 가이드

### 브랜치 전략

```
main        - 프로덕션 배포 브랜치
develop     - 개발 브랜치
feature/*   - 기능 개발
fix/*       - 버그 수정
```

### 커밋 컨벤션

```
feat: 새로운 기능
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 코드
chore: 빌드/설정 변경
```

## 🧪 테스트

### TossPayments 테스트 카드

```
카드번호: 4000 0000 0000 0010
유효기간: 12/25
CVC: 123
생년월일: 000000
비밀번호: 00
```

### 테스트 계정

```
카카오 로그인으로 테스트 계정 생성
```

## 📚 문서

- [🖥️ 그립 프레임 가이드](./GRIP_FRAME_GUIDE.md) ⭐ **NEW**
- [🎬 숏폼 커머스 가이드](./SHORTFORM_COMMERCE_GUIDE.md) ⭐ **NEW**
- [🚀 Cloudflare 배포 프로토콜](./CLOUDFLARE_DEPLOYMENT_PROTOCOL.md) ⭐ **필수**
- [결제 내역 분석 보고서](./PAYMENT_HISTORY_ANALYSIS.md)
- [결제 테스트 가이드](./PAYMENT_TEST_GUIDE.md)
- [결제 이슈 해결 가이드](./PAYMENT_ISSUE_FIXED.md)
- [장바구니 백업 수정](./PAYMENT_CART_BACKUP_FIX.md)
- [웹훅 설정 가이드](./WEBHOOK_SETUP_GUIDE.md)

## 🐛 알려진 이슈

### 해결됨
- ✅ 장바구니 비어있을 때 결제 실패 → localStorage 백업으로 해결
- ✅ 모바일 Intent URL 에러 → 자동 폴백 처리
- ✅ 상품 이미지 썸네일 → CheckoutPage에서 제거

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

Private - UR Team

## 📞 문의

- **고객센터**: 0507-0177-0432
- **운영시간**: 평일 09:00 - 18:00
- **이메일**: dev@ur-team.com

---

**Powered by Cloudflare Pages & Hono Framework**
