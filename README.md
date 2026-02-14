# UR Live - 라이브 커머스 플랫폼

UR Team의 실시간 라이브 쇼핑 플랫폼입니다.

## 🚀 최신 업데이트 (2026-02-14)

### 💎 메인페이지 "유어 특가" 섹션 개편
- **"인기 상품" → "유어 특가"**: 브랜드 정체성에 맞게 섹션명 변경
- **2열 그리드**: 1줄에 2개씩 상품 배치로 모바일 최적화
- **더보기 기능**: 초기 8개 표시 후 "더보기" 버튼으로 8개씩 추가 로딩
- **승인된 셀러 상품**: 관리자 승인된 셀러의 상품만 자동 표시

### 🖼️ 상품 상세 이미지 기능 추가
- **상세 이미지 표시**: 상품 상세 페이지에서 여러 이미지 갤러리 형태로 표시
- **셀러 이미지 관리**: 셀러 페이지에서 상품 상세 이미지 추가/삭제 가능
- **더미 데이터**: 21개 상품에 각 3개의 상세 이미지 추가 (Unsplash)
- **DB 구조**: `detail_images` 컬럼 (JSON array) 추가

### 📱 모바일 반응형 완료
- **360px 프레임 최적화**: 모든 페이지가 360px 모바일 프레임에 완벽히 맞춤
- **수정된 페이지들**:
  - ProductDetailPage: 하단 버튼 전체 너비
  - MyPage: 전체 너비 적용
  - MyOrdersPage: 전체 섹션 너비 조정
  - SearchPage: 검색 결과 반응형
  - CheckoutPage: 결제 페이지 최적화
  - CartPage: Sticky 푸터 개선

### ✨ 우주 테마 디자인 적용
- **PC 배경**: 우주 테마 (별 애니메이션 + 다크 그라데이션)
- **브랜딩 영역**: 좌측에 UR Live 브랜딩, 회사 정보, 푸터 통합
- **모바일 프레임**: 우측 중앙 배치 (360px), 입체감 있는 디자인

### 🎨 레이아웃 개선
- **인기 상품 우선**: 인기 상품 그리드가 먼저 표시
- **라이브 섹션**: 인기 상품 아래로 이동
- **캐주얼 탭바**: 하단 네비게이션 디자인 개선 (호버 효과, 그라데이션 배경)

### 📞 제휴 및 입점 문의
- **이메일**: jiwon@ur-team.com
- **회사소개서**: 다운로드 버튼 제공 (좌측 브랜딩 영역)

## 🌐 배포 정보

- **Production**: https://live.ur-team.com
- **Latest Preview**: https://850cfc3c.toss-live-commerce.pages.dev
- **GitHub**: https://github.com/tobe2111/ur-live
- **Build Hash**: `0ebde574` (2026-02-14)

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
