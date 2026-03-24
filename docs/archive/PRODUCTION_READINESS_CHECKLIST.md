# 🚀 서비스 운영 시작 최종 체크리스트

**날짜**: 2026-03-12  
**현재 상태**: 인증 시스템 완료 (100% 계정 분리, Refresh Token 구현)  
**최신 커밋**: `ff03023b` (Automatic Token Refresh)  
**도메인**: https://live.ur-team.com

---

## 📊 현재 완료 상태

### ✅ 이미 완료된 항목

#### 1. 코드베이스 & 아키텍처 (100%)
- ✅ Multi-Region 아키텍처 (KR + GLOBAL, Runtime Detection)
- ✅ 인증 시스템 완벽 분리 (User/Seller/Admin)
- ✅ RouteGuards 구현 (중앙 집중식 인증 관리)
- ✅ Refresh Token 자동 갱신 (Seller/Admin JWT)
- ✅ API 클라이언트 토큰 분리 (Firebase vs JWT)
- ✅ 401 에러 자동 처리 (토큰 갱신 & 재시도)
- ✅ localStorage 오염 방지 (clearAuthData)

**보안 점수**: 100/100 (FINAL_AUTH_SECURITY_AUDIT.md 참고)

#### 2. 배포 인프라 (100%)
- ✅ Cloudflare Pages 설정 완료
- ✅ GitHub Actions CI/CD 파이프라인
- ✅ D1 Database (마이그레이션 파일 준비됨)
- ✅ KV Namespaces (SESSION_KV, CACHE_KV)
- ✅ wrangler.toml 설정 완료
- ✅ 자동 배포 워크플로우

#### 3. 결제 시스템 (KR 100%)
- ✅ Toss Payments Widget 통합
- ✅ 테스트 키 설정 (`test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN`)
- ✅ Lazy Loading (결제 페이지에서만 로드)
- ✅ 프로덕션 배포 가능 (실제 키로 교체만 하면 됨)

#### 4. Firebase 인증 (100%)
- ✅ Kakao OAuth 통합
- ✅ Email/Password 로그인
- ✅ Custom Token 발급 API
- ✅ Firebase Admin SDK 설정
- ✅ Multi-Tab 동기화 (useMultiTabSync)

---

## 🎯 서비스 운영 전 필수 작업 (7개)

### 📌 Priority 1: Critical (배포 전 필수)

#### ✅ 1. 환경 변수 프로덕션 전환 (15분)
**현재 상태**: 테스트 키 사용 중  
**목표**: 프로덕션 키로 교체

##### Cloudflare Pages 환경 변수 설정

```bash
# 1. Cloudflare Pages 대시보드 접속
# https://dash.cloudflare.com/ → Pages → ur-live → Settings → Environment variables

# 2. Production 환경 변수 설정 (기존 테스트 키 교체)
```

**설정할 환경 변수**:

| 변수명 | 현재 값 (테스트) | 프로덕션 값 필요 | 우선순위 |
|--------|------------------|-----------------|----------|
| `VITE_TOSS_CLIENT_KEY` | `test_gck_P9BRQmya...` | ✅ **필수** | 🔴 Critical |
| `TOSS_SECRET_KEY` | (테스트 시크릿) | ✅ **필수** | 🔴 Critical |
| `JWT_SECRET` | (현재 설정됨) | ⚠️ 강화 권장 | 🟡 High |
| `VITE_SENTRY_DSN` | (설정됨) | ✅ 유지 | 🟢 Medium |
| `RESEND_API_KEY` | (알림톡용) | ⏳ 선택 | 🟢 Low |

**Toss Payments 프로덕션 키 발급 방법**:
1. https://developers.tosspayments.com/ 로그인
2. **내 개발정보** → **API 키 관리**
3. **운영 키 발급** → 클라이언트 키 & 시크릿 키 복사
4. Cloudflare Pages에 등록:
   ```
   VITE_TOSS_CLIENT_KEY=live_ck_xxxxxxxxx
   TOSS_SECRET_KEY=live_sk_xxxxxxxxx
   ```

**JWT_SECRET 강화 (권장)**:
```bash
# 안전한 랜덤 시크릿 생성 (32자 이상)
openssl rand -base64 48

# Cloudflare Pages에 등록
npx wrangler pages secret put JWT_SECRET --project-name=ur-live
# 위에서 생성한 값 입력
```

---

#### ✅ 2. D1 Database 마이그레이션 적용 (10분)
**현재 상태**: 마이그레이션 파일 준비 완료  
**목표**: 프로덕션 DB에 테이블 생성

##### 옵션 A: Wrangler CLI (권장)
```bash
cd /home/user/webapp

# 1. 현재 마이그레이션 상태 확인
npx wrangler d1 migrations list toss-live-commerce-db --remote

# 2. 마이그레이션 적용 (모든 미적용 파일 자동 실행)
npx wrangler d1 migrations apply toss-live-commerce-db --remote

# 3. 성공 확인
npx wrangler d1 execute toss-live-commerce-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' LIMIT 10;"
```

**예상 출력**:
```
✅ Successfully applied 25 migrations
Tables: users, products, orders, streams, cart, sellers, admins, ...
```

##### 옵션 B: Cloudflare 대시보드 (GUI)
1. https://dash.cloudflare.com/ → D1 → `toss-live-commerce-db`
2. **Console** 탭 클릭
3. 각 마이그레이션 파일 내용 복사 & 실행:
   - `migrations/0001_initial_schema.sql`
   - `migrations/0003_add_admin_seller.sql`
   - ... (모든 .sql 파일)

**검증 쿼리**:
```sql
-- 테이블 목록 확인
SELECT name FROM sqlite_master WHERE type='table';

-- 각 테이블 레코드 수 확인
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM sellers;
```

---

#### ✅ 3. 초기 데이터 시딩 (Seller/Admin 계정) (5분)
**현재 상태**: 빈 DB  
**목표**: 테스트 Seller/Admin 계정 생성

##### 실행 방법

**Seller 계정 생성** (예시):
```sql
-- D1 Console 또는 wrangler execute로 실행
INSERT INTO sellers (
  username, email, password, name, 
  business_name, business_number, status, 
  commission_rate, created_at
) VALUES (
  'seller1',
  'seller@ur-team.com',
  '$2a$10$abcdefg...', -- bcrypt 해시 (비밀번호: seller1234)
  '판매자1',
  'UR Live Shop',
  '123-45-67890',
  'active',
  0.10,
  datetime('now')
);
```

**Admin 계정 생성** (예시):
```sql
INSERT INTO admins (
  username, email, password, name, 
  role, status, created_at
) VALUES (
  'admin',
  'admin@ur-team.com',
  '$2a$10$hijklmn...', -- bcrypt 해시 (비밀번호: admin1234)
  '관리자',
  'super_admin',
  'active',
  datetime('now')
);
```

**비밀번호 해시 생성**:
```bash
# Node.js 환경에서 bcrypt 해시 생성
node -e "console.log(require('bcryptjs').hashSync('seller1234', 10))"
node -e "console.log(require('bcryptjs').hashSync('admin1234', 10))"
```

또는 온라인 도구 사용:
- https://bcrypt-generator.com/
- Rounds: 10
- 입력: `seller1234` → 해시 복사

---

#### ⏳ 4. 프로덕션 빌드 & 배포 (5분)
**현재 상태**: 최신 커밋 `ff03023b` 준비 완료  
**목표**: GitHub Actions를 통한 자동 배포

##### GitHub Actions 배포 확인

1. **GitHub Actions 페이지 접속**:
   ```
   https://github.com/tobe2111/ur-live/actions
   ```

2. **최신 워크플로우 확인**:
   - ✅ Workflow: `Deploy to Cloudflare Pages`
   - ✅ 커밋: `ff03023b` (Automatic Token Refresh)
   - ✅ Status: Success (이미 배포됨)

3. **배포 확인**:
   ```bash
   curl -I https://live.ur-team.com
   # 예상: HTTP/2 200
   ```

**배포 성공 기준**:
- [ ] GitHub Actions 워크플로우 성공 (✅ Success)
- [ ] Cloudflare Pages 배포 완료
- [ ] 사이트 접근 가능 (`https://live.ur-team.com` → 200 OK)
- [ ] 빌드 번들 크기 정상 (< 1MB gzip)

---

#### ⏳ 5. YouTube API 설정 (Option A - Prism QR) (10분)
**현재 상태**: YouTube Live 기능 구현 완료  
**목표**: Google Cloud OAuth 설정 (판매자가 YouTube 연동 가능)

**필요 여부**: 판매자가 YouTube Live 스트리밍을 사용할 경우에만 필요

##### Google Cloud Console 설정

1. **프로젝트 생성**:
   - https://console.cloud.google.com/
   - **새 프로젝트**: `UR-Live YouTube Integration`

2. **YouTube Data API v3 활성화**:
   - API 및 서비스 → 라이브러리
   - 검색: `YouTube Data API v3` → **사용 설정**

3. **OAuth 2.0 클라이언트 ID 생성**:
   - API 및 서비스 → 사용자 인증 정보
   - **+ 사용자 인증 정보 만들기** → OAuth 클라이언트 ID
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 리디렉션 URI:
     - `https://live.ur-team.com/seller/youtube/callback`
     - `http://localhost:5173/seller/youtube/callback` (개발용)

4. **Cloudflare Pages 시크릿 등록**:
   ```bash
   npx wrangler pages secret put YOUTUBE_CLIENT_ID --project-name=ur-live
   # → 클라이언트 ID 입력

   npx wrangler pages secret put YOUTUBE_CLIENT_SECRET --project-name=ur-live
   # → 클라이언트 보안 비밀번호 입력

   npx wrangler pages secret put YOUTUBE_REDIRECT_URI --project-name=ur-live
   # → https://live.ur-team.com/seller/youtube/callback
   ```

**검증**:
```bash
npx wrangler pages secret list --project-name=ur-live
# 예상: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI 표시
```

---

### 📌 Priority 2: High (운영 시작 전 권장)

#### ⏳ 6. 프로덕션 테스트 (30분)
**목표**: 8개 핵심 시나리오 검증

**테스트 체크리스트** (PRODUCTION_TEST_CHECKLIST.md 참고):

1. ✅ **Kakao 로그인 E2E** (5분)
   - `/login` → Kakao 인증 → Firebase 로그인 → `/user/profile`
   - 성공 기준: 무한 루프 없음, 로그인 완료 후 리다이렉트

2. ✅ **Email 회원가입 & 로그인** (5분)
   - `/register` → 회원가입 → `/login` → 로그인
   - 성공 기준: Firebase User 생성, localStorage 저장

3. ✅ **Checkout 인증 가드** (3분)
   - 로그아웃 → `/checkout` 직접 접근 → `/login` 리다이렉트
   - 로그인 후 `/checkout` 복귀 확인

4. ✅ **Seller JWT 인증** (3분)
   - `/seller/login` → Seller 로그인 → Dashboard 데이터 로드
   - 성공 기준: JWT 저장, API 호출 성공

5. ✅ **Admin 인증** (3분)
   - `/admin/login` → Admin 로그인 → 관리자 페이지 접근
   - 일반 User로 `/admin` 접근 시 리다이렉트 확인

6. ✅ **Route Guards** (5분)
   - 6개 테스트 케이스 (로그아웃/로그인 상태별 리다이렉트)
   - 성공 기준: 모든 케이스 예상대로 동작

7. ✅ **TopNav 상태 업데이트** (2분)
   - 로그인/로그아웃 시 TopNav 즉시 업데이트 (≤500ms)
   - 성공 기준: 새로고침 없이 즉시 반영

8. ✅ **Product Detail 조건부 인증** (3분)
   - 로그아웃 → `/product/1` → 장바구니 추가 → 로그인 요구
   - 성공 기준: 로그인 후 상품 페이지 복귀

**테스트 도구**:
- Chrome DevTools (F12)
- 시크릿 모드 (Ctrl+Shift+N)
- Console 로그 확인
- Network 탭 모니터링

---

#### ⏳ 7. Sentry 에러 모니터링 설정 (5분)
**현재 상태**: `VITE_SENTRY_DSN` 설정됨  
**목표**: 프로덕션 환경에서 실시간 에러 추적

##### Sentry 대시보드 확인

1. **Sentry 접속**:
   ```
   https://o4510992097935360.sentry.io/
   ```

2. **프로젝트 확인**:
   - 프로젝트명: `ur-live` (또는 기존 설정된 프로젝트)
   - 환경: `production`

3. **환경 변수 확인** (Cloudflare Pages):
   ```
   VITE_SENTRY_DSN=https://xxxxxxx@o4510992097935360.sentry.io/xxxxxxx
   VITE_SENTRY_ENVIRONMENT=production
   ```

4. **테스트 에러 발생** (선택):
   ```javascript
   // 브라우저 콘솔에서 실행
   window.Sentry?.captureException(new Error('프로덕션 테스트 에러'))
   ```

5. **Sentry 대시보드에서 에러 확인**:
   - Issues → 방금 발생한 에러 표시 확인

---

### 📌 Priority 3: Medium (운영 중 개선)

#### ⏳ 8. 48시간 모니터링 계획 (Day 1-2)
**목표**: 초기 배포 후 안정성 확인

**모니터링 항목**:
- [ ] Sentry 에러율 (< 0.1%, ≤5건/일)
- [ ] Cloudflare Analytics (방문자, 응답 시간)
- [ ] 로그인 성공률 (≥95%)
- [ ] 결제 위젯 초기화율 (≥98%)
- [ ] API 응답 시간 (< 1초)

**모니터링 주기**:
- 첫 24시간: 매 4시간마다 확인
- 24-48시간: 매 8시간마다 확인
- 48시간 이후: 1일 1회 확인

---

#### ⏳ 9. 알림톡 (Alimtalk) 설정 (선택)
**현재 상태**: 코드 구현 완료, API 키 미설정  
**목표**: 주문 확정 시 구매자에게 자동 알림

**필요 여부**: 운영 시작 후 1-2주 내 설정 권장

##### Aligo 알림톡 설정 (나중에)

1. **Aligo 가입**:
   - https://smartsms.aligo.in/
   - 회원가입 → 사업자 인증

2. **API 키 발급**:
   - 마이페이지 → API 설정 → API Key 복사

3. **Cloudflare Pages 시크릿 등록**:
   ```bash
   npx wrangler pages secret put ALIGO_API_KEY --project-name=ur-live
   # → API Key 입력

   npx wrangler pages secret put ALIGO_USER_ID --project-name=ur-live
   # → 사용자 ID 입력
   ```

4. **템플릿 등록** (Aligo 대시보드):
   - 알림톡 → 템플릿 관리
   - 주문 확정 템플릿, 배송 시작 템플릿 등록

**참고 문서**: `docs/ALIGO_ALIMTALK_SIMPLE_GUIDE.md`

---

#### ⏳ 10. 상품 데이터 입력 (선택)
**현재 상태**: 빈 DB  
**목표**: 초기 상품 데이터 추가

**실행 방법**:
- Seller 로그인 → `/seller/products/new` → 상품 등록
- 또는 D1 Console에서 직접 SQL INSERT

**권장 초기 상품 수**: 10-20개 (테스트용)

---

## 📋 최종 체크리스트 요약

### 🔴 Critical (배포 전 필수)
- [ ] **1. 환경 변수 프로덕션 전환** (Toss Payments, JWT Secret)
- [ ] **2. D1 Database 마이그레이션 적용** (테이블 생성)
- [ ] **3. 초기 데이터 시딩** (Seller/Admin 계정)
- [ ] **4. 프로덕션 빌드 & 배포** (GitHub Actions 확인)

### 🟡 High (운영 시작 전 권장)
- [ ] **5. YouTube API 설정** (판매자가 YouTube 사용할 경우)
- [ ] **6. 프로덕션 테스트** (8개 시나리오 검증)
- [ ] **7. Sentry 에러 모니터링 설정** (실시간 추적)

### 🟢 Medium (운영 중 개선)
- [ ] **8. 48시간 모니터링 계획** (안정성 확인)
- [ ] **9. 알림톡 설정** (주문 알림, 선택)
- [ ] **10. 상품 데이터 입력** (초기 재고)

---

## 🎯 서비스 오픈 타임라인

### Day 0 (오늘)
**목표**: Critical 항목 완료 (1-4번)

- [ ] 09:00 - 10:00: 환경 변수 프로덕션 전환
- [ ] 10:00 - 10:30: D1 마이그레이션 적용
- [ ] 10:30 - 11:00: 초기 데이터 시딩
- [ ] 11:00 - 11:30: 배포 확인 & 검증
- [ ] 11:30 - 12:00: High 항목 시작 (YouTube, 테스트)

### Day 1 (내일)
**목표**: High 항목 완료 (5-7번) + 모니터링 시작

- [ ] 09:00 - 10:00: 프로덕션 테스트 (8개 시나리오)
- [ ] 10:00 - 11:00: 발견된 이슈 수정
- [ ] 11:00 - 17:00: 모니터링 (4시간마다 확인)
- [ ] 17:00 - 18:00: 일일 리포트 작성

### Day 2-3 (모레)
**목표**: 안정화 & Medium 항목

- [ ] 48시간 모니터링 지속
- [ ] 에러율 확인 (< 0.1%)
- [ ] 알림톡 설정 (선택)
- [ ] 추가 상품 등록

### Week 2+
**목표**: 운영 안정화 & 기능 개선

- [ ] 사용자 피드백 수집
- [ ] 성능 최적화
- [ ] 추가 기능 개발 (글로벌 버전 준비)

---

## 🚨 긴급 대응 계획

### Critical 에러 발생 시
1. **즉시 롤백**:
   ```bash
   # 이전 커밋으로 배포
   git revert HEAD
   git push origin main
   # GitHub Actions 자동 재배포
   ```

2. **Sentry에서 에러 확인**:
   - Issues → 최근 에러 분석
   - Breadcrumbs 확인
   - Stack Trace 확인

3. **핫픽스 배포**:
   - 로컬에서 수정
   - 긴급 커밋 & 푸시
   - GitHub Actions 자동 배포 (≈5분)

### 로그인 장애 시
1. **Kakao API 상태 확인**: https://devtalk.kakao.com/
2. **Firebase 상태 확인**: https://status.firebase.google.com/
3. **Cloudflare 상태 확인**: https://www.cloudflarestatus.com/

### 결제 장애 시
1. **Toss Payments 상태 확인**: https://status.tosspayments.com/
2. **API 키 확인**: Cloudflare Pages → Environment Variables
3. **Toss 고객센터 연락**: 1544-7772

---

## 📚 참고 문서

| 문서 | 용도 | 우선순위 |
|------|------|----------|
| `PRODUCTION_TEST_CHECKLIST.md` | 8개 시나리오 테스트 가이드 | 🔴 Critical |
| `MINIMAL_DEPLOYMENT_CHECKLIST.md` | YouTube Live 배포 (Option A) | 🟡 High |
| `FINAL_AUTH_SECURITY_AUDIT.md` | 인증 보안 감사 리포트 | 🟢 Reference |
| `COMPLETE_AUTH_ARCHITECTURE_ANALYSIS.md` | 인증 아키텍처 전체 분석 | 🟢 Reference |
| `STAY_LOGGED_IN_ANALYSIS.md` | 로그인 유지 분석 | 🟢 Reference |
| `docs/ALIGO_ALIMTALK_SIMPLE_GUIDE.md` | 알림톡 설정 가이드 | 🟢 Medium |

---

## 🎉 성공 기준

### 최소 성공 기준 (MVP)
- [x] ✅ 코드 빌드 성공 (0 errors)
- [x] ✅ 인증 시스템 완료 (User/Seller/Admin 분리)
- [ ] ⏳ 프로덕션 환경 변수 설정
- [ ] ⏳ D1 Database 마이그레이션 완료
- [ ] ⏳ Kakao 로그인 성공률 ≥95%
- [ ] ⏳ 결제 위젯 정상 작동

### 권장 성공 기준
- [ ] ⏳ 8개 테스트 시나리오 모두 통과
- [ ] ⏳ Sentry 에러율 < 0.1%
- [ ] ⏳ API 응답 시간 < 1초
- [ ] ⏳ 페이지 로드 시간 < 3초

### 장기 목표 (1-3개월)
- [ ] 글로벌 버전 출시 (world.ur-team.com)
- [ ] YouTube Live 브라우저 스트리밍 (Option B)
- [ ] 알림톡 자동화
- [ ] 성능 최적화 (번들 사이즈 < 500KB)

---

## 💡 다음 단계 (Next Steps)

### 오늘 해야 할 일 (우선순위 순)
1. ✅ **Toss Payments 프로덕션 키 발급** (15분)
2. ✅ **Cloudflare Pages 환경 변수 업데이트** (10분)
3. ✅ **D1 Database 마이그레이션 실행** (10분)
4. ✅ **Seller/Admin 계정 생성** (5분)
5. ✅ **GitHub Actions 배포 확인** (5분)
6. ✅ **8개 시나리오 프로덕션 테스트** (30분)

**총 예상 소요 시간**: **75분 (약 1시간 15분)**

### 이번 주 목표
- [ ] 48시간 모니터링 완료
- [ ] 에러 0건 달성
- [ ] 초기 사용자 피드백 수집

### 이번 달 목표
- [ ] 일일 방문자 100명 달성
- [ ] 안정적인 서비스 운영 (가동률 ≥99.9%)
- [ ] 글로벌 버전 개발 시작

---

**작성일**: 2026-03-12  
**작성자**: AI Development Assistant  
**최종 수정**: 2026-03-12 04:40 UTC

**🚀 준비 완료! 위 체크리스트를 순서대로 진행하면 서비스 오픈 가능합니다!**
