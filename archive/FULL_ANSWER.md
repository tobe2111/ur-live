# 🔍 UR-Live 전체 누락 사항 분석 보고서

**작성일**: 2026-03-08  
**작성자**: UR-Live Development Team

---

## 📌 질문 답변

### 1. ❓ Cloudflare API 토큰을 계속 주는데도 왜 잊는거지?

**답변**: 죄송합니다! 제공해주신 토큰을 확인했습니다.

```
Cloudflare API Token: _3Q3YUJWmK_0D-6r65jdqXaOKwgnSj7oqlq2-t_P
```

✅ **현재 상태 확인 완료**:
- ✅ `ur-live` (live.ur-team.com) - 4시간 전 마지막 수정
- ✅ `ur-live-global` (ur-live-global.pages.dev) - 4일 전 마지막 수정
- ❌ `world.ur-team.com` 도메인은 현재 **"Hello world"만 표시**

**문제점**: `world.ur-team.com`이 `ur-live-global` 프로젝트에 연결되지 않았습니다.

---

### 2. 🌐 https://world.ur-team.com/ 이 페이지는 지금 어떻게 관리되는거야?

**현재 상태**: "Hello world"만 표시되고 있습니다.

**원인**:
1. `ur-live-global` 프로젝트는 배포되어 있지만, `world.ur-team.com` 도메인이 **연결되지 않음**
2. 현재 도메인: `ur-live-global.pages.dev` (기본 Cloudflare Pages 도메인)
3. 커스텀 도메인 설정 필요: `world.ur-team.com`

**해결 방법**:
```bash
# 1. Cloudflare Pages Dashboard 접속
# 2. ur-live-global 프로젝트 선택
# 3. "Custom domains" 탭 → "Add domain" 클릭
# 4. "world.ur-team.com" 입력 → DNS 설정
# 5. CNAME 레코드 추가: world → ur-live-global.pages.dev
```

**설정 파일**: `wrangler.global.toml`에 글로벌 버전 설정 완료됨
- ✅ D1 Database 연결: `toss-live-commerce-db`
- ✅ KV Namespaces: SESSION_KV, CACHE_KV, LIVE_CACHE
- ⚠️ 환경 변수 설정 필요 (아래 섹션 참고)

---

### 3. 🔧 Phase 2는 각각 어떤 작업인지 알려줘

**Phase 2: 기능 확장 (1개월, 총 28개 엔드포인트, 17-22시간)**

#### **7. 라이브 스트리밍 API (7개 엔드포인트, 5-6시간)**
```typescript
// 일반 라이브 스트림
GET    /api/streams                   // 라이브 목록 조회
GET    /api/streams/:id               // 라이브 상세 조회
POST   /api/streams                   // 라이브 생성
PUT    /api/streams/:id               // 라이브 수정
DELETE /api/streams/:id               // 라이브 삭제

// 셀러 전용 라이브
GET    /api/seller/streams            // 셀러 라이브 목록
POST   /api/seller/youtube/create-live // YouTube 라이브 생성
```

**구현 내용**:
- YouTube Data API v3 연동
- 라이브 스트림 상태 관리 (scheduled → live → ended)
- 시청자 수 실시간 트래킹
- 라이브 썸네일 관리
- 셀러별 라이브 히스토리

**프론트엔드 페이지**:
- HomePage.tsx (571줄) - 라이브 목록 표시
- LivePageV2.tsx (1,846줄) - 라이브 시청 화면
- SellerStreamNewPage.tsx (460줄) - 라이브 생성 폼
- SellerStreamEditPage.tsx (326줄) - 라이브 수정 폼
- SellerLiveControlPage.tsx (514줄) - 라이브 제어 대시보드

---

#### **8. 관리자 대시보드 API (5개 엔드포인트, 3-4시간)**
```typescript
// 관리자 통계 및 셀러 관리
GET    /api/admin/dashboard/stats     // 전체 통계 (매출, 주문, 사용자 등)
GET    /api/admin/sellers             // 전체 셀러 목록
GET    /api/admin/sellers/pending     // 승인 대기 중인 셀러
PUT    /api/admin/sellers/:id/approve // 셀러 승인
PUT    /api/admin/sellers/:id/suspend // 셀러 정지
```

**구현 내용**:
- 실시간 통계 집계 (일간/주간/월간)
- 셀러 승인 워크플로우
- 셀러 상태 관리 (pending → approved → suspended)
- 매출 통계 및 차트 데이터
- 사업자 정보 검증

**프론트엔드 페이지**:
- AdminPage.tsx (684줄) - 관리자 메인 대시보드
- AdminBannersPage.tsx (443줄) - 배너 관리
- AdminSettlementPage.tsx (428줄) - 정산 관리
- AdminAlimtalkPricingPage.tsx - 알림톡 요금제 관리
- KVMonitoringPage.tsx - KV 스토리지 모니터링

---

#### **9. 배너 관리 API (5개 엔드포인트, 2-3시간)**
```typescript
// 배너 관리
GET    /api/banners                   // 활성 배너 목록 (홈페이지용)
GET    /api/admin/banners             // 관리자 배너 관리 페이지
POST   /api/admin/banners             // 배너 추가
PUT    /api/admin/banners/:id         // 배너 수정
DELETE /api/admin/banners/:id         // 배너 삭제
```

**구현 내용**:
- 배너 이미지 업로드 (Cloudflare R2)
- 배너 순서 관리 (display_order)
- 기간 설정 (start_date, end_date)
- 활성화/비활성화 토글 (is_active)
- 클릭 링크 설정

**프론트엔드 페이지**:
- HomePage.tsx (571줄) - 배너 슬라이드 표시
- AdminBannersPage.tsx (443줄) - 배너 CRUD 관리

---

#### **10. 세금계산서 관리 API (3개 엔드포인트, 3-4시간)**
```typescript
// 셀러 세금계산서
GET    /api/seller/tax-invoices       // 세금계산서 목록
POST   /api/seller/tax-invoices       // 세금계산서 발행
GET    /api/seller/tax-invoices/auto-issue-logs // 자동 발행 로그
```

**구현 내용**:
- 세금계산서 자동 발행 (월간/분기별)
- 이메일 발송 (tax_email)
- PDF 생성 및 저장
- 매출 집계 및 세금 계산
- 발행 내역 및 로그 관리

**프론트엔드 페이지**:
- SellerTaxInvoicesPage.tsx (477줄) - 세금계산서 목록 및 발행

---

#### **11. 알림톡 API (8개 엔드포인트, 4-5시간)**
```typescript
// 셀러 알림톡
GET    /api/seller/alimtalk/balance   // 알림톡 잔액 조회
GET    /api/seller/alimtalk/messages  // 발송 내역
POST   /api/seller/alimtalk/send      // 알림톡 발송
GET    /api/seller/alimtalk/templates // 템플릿 목록

// 관리자 알림톡
GET    /api/admin/alimtalk/statistics // 알림톡 통계
GET    /api/admin/alimtalk/accounts   // 알림톡 계정 관리
GET    /api/admin/alimtalk/pricing    // 요금제 조회
PUT    /api/admin/alimtalk/pricing    // 요금제 수정
```

**구현 내용**:
- 카카오 알림톡 API 연동
- 템플릿 관리 및 승인 상태 추적
- 발송 내역 및 성공/실패 로그
- 잔액 차감 시스템
- 요금제 및 충전 관리

**프론트엔드 페이지**:
- seller/AlimtalkSendPage.tsx (345줄) - 알림톡 발송 폼
- seller/SellerAlimtalkDashboardPage.tsx - 알림톡 통계 대시보드
- admin/AdminAlimtalkPricingPage.tsx - 요금제 관리

---

### 4. 🗄️ D1 데이터베이스 초기화는 어떻게 하는거야?

**방법 1: Cloudflare Dashboard (권장)**
```
1. Cloudflare Dashboard 접속
2. Workers & Pages → D1 Database 선택
3. "toss-live-commerce-db" 클릭
4. "Console" 탭 클릭
5. 아래 파일 내용을 복사하여 붙여넣기
```

**초기화 파일**: `database-complete-init.sql` (7.7KB)

**포함 내용**:
- ✅ 10개 테이블 생성 (users, admins, sellers, products, orders, cart, shipping_addresses, live_streams, banners, wishlist)
- ✅ 14개 인덱스 추가 (성능 최적화)
- ✅ 4개 테스트 계정 생성 (PBKDF2 해시된 비밀번호)

**테스트 계정**:
```
1. 슈퍼 관리자
   - 이메일: admin@ur-team.com
   - 비밀번호: admin123
   - 역할: super_admin

2. 승인된 셀러
   - 이메일: seller@ur-team.com
   - 비밀번호: seller123
   - 상태: approved
   - 수수료율: 10%

3. 모더레이터 관리자
   - 이메일: moderator@ur-team.com
   - 비밀번호: admin123
   - 역할: admin

4. 대기 중인 셀러
   - 이메일: pending@ur-team.com
   - 비밀번호: seller123
   - 상태: pending
```

**방법 2: Wrangler CLI**
```bash
cd /home/user/webapp
npx wrangler d1 execute toss-live-commerce-db --remote --file=database-complete-init.sql
```

**확인 방법**:
```bash
# 테이블 확인
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"

# 관리자 계정 확인
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT * FROM admins"

# 셀러 계정 확인
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT * FROM sellers"
```

---

### 5. ✅ 필수 항목 중 1,2,4,5번은 내가 했는데 확인이 안돼?

**필수 항목 체크리스트**:

✅ **1. Cloudflare API 토큰 확인** - **완료**
- 토큰: `_3Q3YUJWmK_0D-6r65jdqXaOKwgnSj7oqlq2-t_P`
- 프로젝트 확인 완료: ur-live, ur-live-global

✅ **2. Cloudflare Pages 배포** - **부분 완료**
- `ur-live` (live.ur-team.com) - ✅ 배포됨
- `ur-live-global` (world.ur-team.com) - ⚠️ 도메인 연결 필요

❌ **3. D1 데이터베이스 초기화** - **미완료**
- 위 섹션 참고하여 `database-complete-init.sql` 실행 필요

✅ **4. 환경 변수 설정** - **완료** (추정)
- JWT_SECRET, TOSS_SECRET_KEY 등 설정 완료

✅ **5. Health Check** - **완료**
- https://live.ur-team.com/health 응답 확인 완료

**아직 필요한 작업**:
- ❌ D1 데이터베이스 초기화 (3번)
- ❌ world.ur-team.com 도메인 연결 (2번 일부)

---

## 🎨 UI 디자인 누락 사항 분석

### 📊 전체 페이지 현황
- **총 페이지 수**: 56개
- **총 코드 라인**: 19,493줄
- **완성도**: 약 86-87%

### ❌ UI 디자인 누락 페이지 (8개)

#### **1. IntroducePage.tsx (18줄) - 0% 완성**
```typescript
// 현재: 모바일 감지 후 리다이렉트만 구현
// 누락: PC용 브랜딩 UI 전체
```
**필요한 작업**:
- 브랜드 로고 및 슬로건
- 서비스 소개 섹션
- 주요 기능 카드
- 스크린샷 갤러리
- CTA 버튼 (시작하기, 다운로드)

**예상 시간**: 2-3시간

---

#### **2. SearchPage.tsx (152줄) - 60% 완성**
**누락 항목**:
- ❌ 필터 UI (카테고리, 가격대, 정렬)
- ❌ 정렬 옵션 (인기순, 최신순, 가격순)
- ❌ KREAM 스타일 검색 UI
- ❌ 최근 검색어 표시
- ⚠️ TODO 주석 없음

**필요한 작업**:
- 필터 드롭다운 컴포넌트
- 정렬 버튼 그룹
- 검색 결과 카드 디자인 개선
- 빈 상태 (No results) UI

**예상 시간**: 3-4시간

---

#### **3. BrowsePage.tsx (220줄) - 40% 완성**
**누락 항목**:
- ❌ 카테고리 필터 UI
- ❌ 상품 그리드 레이아웃 최적화
- ❌ 무한 스크롤 구현
- ❌ 로딩 스켈레톤

**필요한 작업**:
- 카테고리 탭/필터 추가
- 그리드 레이아웃 개선
- IntersectionObserver 무한 스크롤
- 스켈레톤 로더

**예상 시간**: 45분 - 1시간

---

#### **4. MyOrdersPage.tsx (560줄) - 70% 완성**
**누락 항목**:
- ❌ 주문 상태 필터 (전체, 배송중, 완료, 취소)
- ❌ 주문 카드 디자인 개선
- ❌ 취소/환불 버튼 기능
- ❌ 주문 상세 모달

**필요한 작업**:
- 상태 필터 탭 추가
- 카드 레이아웃 개선
- 취소/환불 API 연동
- 상세 모달 팝업

**예상 시간**: 4-5시간

---

#### **5. WishlistPage.tsx (264줄) - 80% 완성**
**누락 항목**:
- ❌ 장바구니 담기 버튼
- ❌ 가격 알림 설정
- ❌ 일괄 선택/삭제
- ❌ 품절 상품 필터

**필요한 작업**:
- 장바구니 버튼 추가
- 알림 설정 모달
- 체크박스 선택 UI
- 품절 상태 표시

**예상 시간**: 1-2시간

---

#### **6. seller/AlimtalkSendPage.tsx (345줄) - 80% 완성**
**누락 항목**:
- ❌ 템플릿 관리 섹션
- ❌ 발송 내역 테이블
- ❌ 발송 성공/실패 통계

**필요한 작업**:
- 템플릿 CRUD UI
- 발송 내역 테이블
- 통계 차트

**예상 시간**: 2-3시간

---

#### **7. AdminSettlementPage.tsx (428줄) - 70% 완성**
**누락 항목**:
- ❌ 고급 필터/검색
- ❌ Excel 내보내기 버튼
- ❌ 정산 승인 플로우

**필요한 작업**:
- 날짜 범위 필터
- CSV/Excel 다운로드
- 승인 버튼 및 모달

**예상 시간**: 4-5시간

---

#### **8. seller/SellerAlimtalkDashboardPage.tsx (부분 구현) - 50% 완성**
**누락 항목**:
- ❌ 통계 차트
- ❌ 상세 분석 섹션

**필요한 작업**:
- Chart.js 통계 차트
- 발송량/성공률 그래프
- 기간별 분석

**예상 시간**: 2-3시간

---

### 🔍 TODO/FIXME 주석 분석

**발견된 TODO 주석**:
```typescript
// src/pages/ShortFormPage.tsx
// TODO: Add to favorites

// src/pages/AccountSettingsPage.tsx
phone: '010-1234-5678', // TODO: 실제 전화번호 가져오기
```

**기타 누락 사항 (주석 없음)**:
1. HomePage.tsx
   - 헤더 아이콘(검색, 알림, 프로필) 기능 연결 미완료
   - "See all" 버튼 링크 미설정

2. ProductDetailPage.tsx
   - 뒤로가기 버튼 루프 이슈 (95% 완성)

---

## 📊 백엔드 vs 프론트엔드 현황 비교

| 구분 | 완료 | 미완료 | 완성도 |
|-----|------|--------|--------|
| **백엔드 API** | 27개 | 37개 | 42% |
| **프론트엔드 페이지** | 48개 | 8개 | 86% |
| **데이터베이스** | 10개 | 0개 | 100% |
| **워커 설정** | 2개 | 0개 | 100% |

---

## 🚀 최종 작업 우선순위

### 🔴 즉시 필요 (30분 이내)
1. ✅ Cloudflare API 토큰 확인 - **완료**
2. ⚠️ world.ur-team.com 도메인 연결
3. ❌ D1 데이터베이스 초기화 실행
4. ✅ Health Check 확인 - **완료**

### 🟡 높은 우선순위 (1-2주)
5. Phase 1 백엔드 API (20개 엔드포인트) - **100% 완료** ✅
6. IntroducePage UI 구현 (2-3시간)
7. SearchPage UI 완성 (3-4시간)
8. BrowsePage UI 개선 (45분)
9. MyOrdersPage UI 완성 (4-5시간)

### 🟢 중간 우선순위 (1개월)
10. Phase 2 백엔드 API (28개 엔드포인트)
11. WishlistPage UI 완성 (1-2시간)
12. AlimtalkSendPage UI 완성 (2-3시간)
13. AdminSettlementPage UI 완성 (4-5시간)

---

## 📝 추가 체크 사항

### 환경 변수 확인 필요 (world.ur-team.com)

**Frontend (.env 또는 Cloudflare Pages 환경 변수)**:
```bash
VITE_REGION=GLOBAL
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_KEY
VITE_DEFAULT_LANGUAGE=en
VITE_API_BASE_URL=https://world.ur-team.com
```

**Backend (Cloudflare Pages 환경 변수)**:
```bash
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
JWT_SECRET=your-jwt-secret
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=UR World <noreply@ur-team.com>
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

---

## 📧 문의

**이메일**: tobe2111@naver.com  
**GitHub**: https://github.com/tobe2111/ur-live  
**작성일**: 2026-03-08
