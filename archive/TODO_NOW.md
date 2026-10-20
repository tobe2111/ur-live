# 🚀 지금 바로 해야 할 일 (TODO NOW)

**작성일**: 2026-03-05 14:40 KST  
**대상**: UR Live 프로덕션 배포  
**현재 상태**: ✅ 코드 완료, ⏳ 환경 변수 설정 대기

---

## 📋 전체 현황 한눈에 보기

| 항목 | 상태 | 비고 |
|------|------|------|
| **코드 작업** | ✅ 100% | Zustand 마이그레이션, Sentry 통합, Region 런타임 분기 완료 |
| **빌드** | ✅ 완료 | `npm run build` 성공 (24.14s, 0 errors) |
| **Git 커밋** | ✅ 완료 | 최신 커밋 푸시 완료 |
| **Cloudflare 배포** | 🔄 진행 중 | GitHub → Cloudflare 자동 배포 (2-3분 대기) |
| **환경 변수 설정** | ❌ 미완료 | **← 지금 바로 해야 할 작업** |
| **Sentry 활성화** | ❌ 미완료 | 환경 변수 설정 후 자동 활성화 |
| **프로덕션 테스트** | ⏳ 대기 중 | 8개 시나리오 (≈30분) |

---

## 🎯 지금 바로 해야 할 일 (≈10분)

### 1️⃣ Cloudflare Pages 환경 변수 설정 (≈5분)

**⚠️ 중요**: 환경 변수를 설정해야 Sentry가 작동합니다!

#### 단계별 가이드

1. **Cloudflare Dashboard 접속**
   - URL: https://dash.cloudflare.com
   - 로그인 (계정: tobe2111@naver.com)

2. **프로젝트 선택**
   - 좌측 메뉴: **Pages** 클릭
   - 프로젝트 목록에서 **ur-live** 선택

3. **환경 변수 페이지 이동**
   - 상단 탭: **Settings** 클릭
   - 좌측 사이드바: **Environment variables** 클릭
   - 상단 탭: **Production** 선택 (중요!)

4. **첫 번째 환경 변수 추가**
   ```
   Variable name: VITE_SENTRY_DSN
   Value: https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
   Environment: Production (체크)
   ```
   - **Add** 버튼 클릭

5. **두 번째 환경 변수 추가**
   ```
   Variable name: VITE_SENTRY_ENVIRONMENT
   Value: production
   Environment: Production (체크)
   ```
   - **Add** 버튼 클릭

6. **추가 환경 변수 확인 (선택사항)**
   - 이미 설정되어 있다면 스킵
   ```
   VITE_KAKAO_REST_API_KEY: 5dd74bccb797640b0efd070467f3bafd
   VITE_TOSS_CLIENT_KEY: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
   ```

---

### 2️⃣ 재배포 (≈3분)

1. **Deployments 탭 이동**
   - 상단 탭: **Deployments** 클릭

2. **최신 배포 찾기**
   - 목록 맨 위의 배포 (가장 최근)
   - 상태가 **Success** 또는 **Building**인 것

3. **재배포 실행**
   - 우측 **"..."** (3점 메뉴) 클릭
   - **"Retry deployment"** 선택
   - 확인 팝업 → **"Retry deployment"** 클릭

4. **빌드 완료 대기**
   - 상태: Building → Success (약 2-3분)
   - 실패 시 → **View build log** 클릭하여 에러 확인

---

### 3️⃣ 배포 확인 (≈2분)

#### 3-1. 사이트 접근 확인
```bash
# 터미널에서 실행 (선택사항)
curl -I https://live.ur-team.com

# 예상 결과:
# HTTP/2 200
# content-type: text/html
```

#### 3-2. 브라우저 확인
1. **시크릿 모드** 열기 (Ctrl+Shift+N)
2. https://live.ur-team.com 접속
3. **F12** → **Console** 탭

#### 3-3. Sentry 초기화 확인
콘솔에서 아래 메시지 확인:
```javascript
[Sentry] Initialized successfully
[Sentry] Environment: production
[Sentry] DSN: https://08caf64e8e79...
```

**❌ 만약 "Mock mode"라고 나온다면**:
- 환경 변수 설정 실패
- Cloudflare → Settings → Environment variables 재확인
- Production 탭 선택 확인
- 재배포 실행

---

### 4️⃣ Sentry 테스트 (≈2분)

#### 4-1. 테스트 에러 발생
브라우저 콘솔에서 실행:
```javascript
window.Sentry?.captureException(new Error('프로덕션 Sentry 테스트 - 2026-03-05'))
```

#### 4-2. Sentry Dashboard 확인
1. URL: https://o4510992097935360.sentry.io/issues/
2. 로그인 (Sentry 계정)
3. 5-10분 후 **Issues** 탭 확인
4. 방금 발생시킨 에러 확인:
   - 제목: "프로덕션 Sentry 테스트 - 2026-03-05"
   - Environment: production
   - URL: https://live.ur-team.com

#### 4-3. 테스트 성공 확인
- [ ] 에러가 Sentry Dashboard에 표시됨
- [ ] Environment가 "production"임
- [ ] URL이 "live.ur-team.com"임
- [ ] Stack trace가 표시됨

---

## 🧪 다음 단계: 프로덕션 테스트 (≈30분)

환경 변수 설정이 완료되면 **프로덕션 테스트** 진행:

### 테스트 시나리오 (8개)

| # | 시나리오 | 시간 | 우선순위 |
|---|----------|------|----------|
| 1 | Kakao 로그인 E2E | 5분 | 🔴 Critical |
| 2 | Email 회원가입 & 로그인 | 5분 | 🔴 Critical |
| 3 | Checkout 인증 가드 | 3분 | 🟡 High |
| 4 | Seller JWT 인증 | 3분 | 🟡 High |
| 5 | Admin 인증 | 3분 | 🟡 High |
| 6 | Route Guards (6개 케이스) | 5분 | 🟡 High |
| 7 | TopNav 상태 업데이트 | 2분 | 🟢 Medium |
| 8 | Product Detail 조건부 인증 | 3분 | 🟢 Medium |

**상세 가이드**: `PRODUCTION_TEST_CHECKLIST.md` 참고

---

## 📊 예상 타임라인 (총 ≈40분)

| 단계 | 예상 시간 | 상태 |
|------|----------|------|
| 1. 환경 변수 설정 | 5분 | ⏳ 대기 중 |
| 2. 재배포 & 빌드 | 3분 | ⏳ 대기 중 |
| 3. 배포 확인 | 2분 | ⏳ 대기 중 |
| 4. Sentry 테스트 | 2분 | ⏳ 대기 중 |
| 5. 프로덕션 테스트 (8개) | 30분 | ⏳ 대기 중 |
| **합계** | **42분** | |

---

## ⚠️ 문제 발생 시 대응

### Case 1: 환경 변수 설정 후에도 Mock mode
**증상**: 콘솔에 `[Sentry] Mock mode - DSN not configured`

**해결**:
1. Cloudflare → Settings → Environment variables 재확인
2. **Production** 탭이 선택되었는지 확인 (Preview 아님!)
3. 변수명 철자 확인:
   - `VITE_SENTRY_DSN` (VITE_ 접두사 필수!)
   - `VITE_SENTRY_ENVIRONMENT`
4. 재배포 실행 (Deployments → Retry deployment)
5. 캐시 삭제 후 재확인 (Ctrl+Shift+R)

---

### Case 2: 빌드 실패 (Build Failed)
**증상**: Deployments 상태가 "Failed"

**해결**:
1. **View build log** 클릭
2. 에러 메시지 확인:
   - `Module not found` → 패키지 설치 실패 (재배포)
   - `Type error` → TypeScript 에러 (로컬에서 `npm run build` 확인)
   - `Out of memory` → 빌드 타임아웃 (Cloudflare 지원 문의)
3. GitHub에서 최신 커밋 확인
4. 재배포 실행

---

### Case 3: Kakao 로그인 무한 루프
**증상**: `/login` ↔ `/auth/kakao/sync/callback` 반복

**해결**:
```javascript
// 브라우저 콘솔에서 실행
localStorage.clear()
sessionStorage.clear()
window.location.reload()
```
- 시크릿 모드에서 재시도
- `PRODUCTION_TEST_CHECKLIST.md` → Issue 1 참고

---

## 📚 참고 문서

| 문서 | 파일명 | 용도 |
|------|--------|------|
| **지금 해야 할 일** | `TODO_NOW.md` | 👈 현재 문서 |
| **프로덕션 테스트** | `PRODUCTION_TEST_CHECKLIST.md` | 8개 시나리오 상세 가이드 |
| **Cloudflare 환경 설정** | `CLOUDFLARE_ENV_MANUAL_SETUP.md` | 환경 변수 설정 (스크린샷 포함) |
| **48시간 모니터링** | `48H_MONITORING_GUIDE.md` | 배포 후 모니터링 체크리스트 |
| **에러 대응 플로우** | `ERROR_RESPONSE_FLOW.md` | 에러 분류 & 대응 방법 |
| **전체 프로젝트 현황** | `COMPLETE_PROJECT_STATUS_AND_ROADMAP.md` | 현재 상태 & 로드맵 |

---

## 🔗 중요 링크

| 항목 | URL |
|------|-----|
| **Production Site** | https://live.ur-team.com |
| **Cloudflare Dashboard** | https://dash.cloudflare.com |
| **Sentry Dashboard** | https://o4510992097935360.sentry.io/ |
| **GitHub Repo** | https://github.com/tobe2111/ur-live |
| **Firebase Console** | https://console.firebase.google.com/ |

---

## ✅ 체크리스트 (완료 시 체크)

### 환경 변수 설정
- [ ] Cloudflare Dashboard 로그인
- [ ] ur-live 프로젝트 선택
- [ ] Settings → Environment variables
- [ ] `VITE_SENTRY_DSN` 추가
- [ ] `VITE_SENTRY_ENVIRONMENT` 추가
- [ ] Production 탭 확인

### 재배포
- [ ] Deployments 탭 이동
- [ ] Retry deployment 클릭
- [ ] 빌드 완료 대기 (2-3분)
- [ ] 상태: Success 확인

### 배포 확인
- [ ] https://live.ur-team.com 접속
- [ ] F12 → Console
- [ ] `[Sentry] Initialized` 메시지 확인
- [ ] 테스트 에러 발생
- [ ] Sentry Dashboard에서 에러 확인

### 프로덕션 테스트
- [ ] Scenario 1: Kakao 로그인 (5분)
- [ ] Scenario 2: Email 로그인 (5분)
- [ ] Scenario 3: Checkout 가드 (3분)
- [ ] Scenario 4: Seller JWT (3분)
- [ ] Scenario 5: Admin 인증 (3분)
- [ ] Scenario 6: Route Guards (5분)
- [ ] Scenario 7: TopNav 업데이트 (2분)
- [ ] Scenario 8: Product Detail (3분)

---

## 🎯 최종 목표

### Critical (필수)
- [ ] 환경 변수 설정 완료
- [ ] 재배포 성공
- [ ] Sentry 정상 작동
- [ ] Kakao 로그인 성공률 ≥95%

### High (중요)
- [ ] 8개 시나리오 모두 ✅ Pass
- [ ] 런타임 에러 <5건/일
- [ ] 페이지 로드 <3초

### Medium (권장)
- [ ] 48시간 모니터링 시작
- [ ] 에러 대응 프로세스 확립
- [ ] 성능 메트릭 수집

---

## 📞 문제 발생 시 연락처

- **GitHub Issues**: https://github.com/tobe2111/ur-live/issues
- **Email**: tobe2111@naver.com
- **Sentry Support**: https://sentry.io/support/
- **Cloudflare Support**: https://dash.cloudflare.com/?to=/:account/support

---

**작성일**: 2026-03-05 14:40 KST  
**작성자**: UR Live Development Team  
**최종 수정**: 2026-03-05 14:40 KST

**현재 상태**: ✅ 코드 완료, ⏳ 환경 변수 설정 대기  
**다음 작업**: Cloudflare Pages 환경 변수 설정 (≈5분)
