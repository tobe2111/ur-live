# ⚡ Cloudflare Pages 환경 변수 설정 - 실행 가이드

## 🎯 목표
Cloudflare Pages에 Sentry 환경 변수를 추가하여 프로덕션에서 에러 추적 활성화

---

## 📋 설정할 환경 변수

```bash
# 변수 1
VITE_SENTRY_DSN=https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488

# 변수 2
VITE_SENTRY_ENVIRONMENT=production
```

---

## 🚀 단계별 실행 (5분)

### Step 1: Cloudflare Dashboard 접속 (30초)
1. 브라우저에서 https://dash.cloudflare.com 열기
2. 계정 로그인
3. 좌측 사이드바에서 **"Pages"** 클릭

### Step 2: 프로젝트 선택 (10초)
1. 프로젝트 목록에서 **"ur-live"** 클릭
   - 만약 프로젝트 이름이 다르면 해당 프로젝트 선택

### Step 3: Settings 페이지로 이동 (10초)
1. 상단 탭에서 **"Settings"** 클릭
2. 좌측 메뉴에서 **"Environment variables"** 클릭

### Step 4: 첫 번째 변수 추가 (1분)
1. **"Add variable"** 버튼 클릭
2. 폼 작성:
   ```
   Variable name: VITE_SENTRY_DSN
   
   Value: https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
   
   Environment:
   ✅ Production (체크)
   ⬜ Preview (선택사항)
   ```
3. **"Save"** 버튼 클릭

### Step 5: 두 번째 변수 추가 (1분)
1. 다시 **"Add variable"** 버튼 클릭
2. 폼 작성:
   ```
   Variable name: VITE_SENTRY_ENVIRONMENT
   
   Value: production
   
   Environment:
   ✅ Production (체크)
   ⬜ Preview (선택사항)
   ```
3. **"Save"** 버튼 클릭

### Step 6: 재배포 트리거 (30초)
**방법 A: Cloudflare에서 직접 (권장)**
1. 상단 탭에서 **"Deployments"** 클릭
2. 최신 배포(맨 위) 우측의 **"..." (점 3개)** 클릭
3. **"Retry deployment"** 클릭
4. 확인 팝업에서 **"Retry"** 클릭

**방법 B: Git 빈 커밋 푸시 (대안)**
```bash
cd /home/user/webapp
git commit --allow-empty -m "chore: Trigger Cloudflare rebuild for Sentry env vars"
git push origin main
```

### Step 7: 배포 완료 대기 (2-3분)
1. **Deployments** 탭에서 상태 확인
2. 상태가 **"Building"** → **"Success"** 로 변경될 때까지 대기
3. 빌드 로그 확인 (선택사항):
   - 배포 항목 클릭 → **"View build logs"**

---

## ✅ 확인 방법 (2분)

### 테스트 1: 브라우저 콘솔 확인
1. https://live.ur-team.com 접속
2. F12 키 (개발자 도구)
3. **Console** 탭 선택
4. **예상 로그** (성공):
   ```
   [Sentry] Initialized: {environment: 'production', dsn: 'https://08caf64e8e79...'}
   ```
5. **이전 로그** (실패 - 나오면 안 됨):
   ```
   [Sentry] Mock mode - DSN not configured
   ```

### 테스트 2: Sentry 테스트 에러 발생
브라우저 콘솔에서 실행:
```javascript
window.Sentry?.captureException(new Error('프로덕션 Sentry 테스트'));
```

### 테스트 3: Sentry Dashboard 확인
1. https://o4510992097935360.sentry.io/issues/ 접속
2. 5-10분 후 "프로덕션 Sentry 테스트" 에러 확인

---

## 🔍 스크린샷 가이드

### 화면 1: Cloudflare Dashboard
```
┌─────────────────────────────────────────┐
│ Cloudflare Dashboard                    │
├─────────────────────────────────────────┤
│ 좌측 메뉴:                               │
│  - Overview                             │
│  - Analytics                            │
│  ▶ Pages  ← 여기 클릭                    │
│  - Workers                              │
│  - R2                                   │
└─────────────────────────────────────────┘
```

### 화면 2: Pages 프로젝트 목록
```
┌─────────────────────────────────────────┐
│ Pages > All projects                    │
├─────────────────────────────────────────┤
│ ┌─────────────────────┐                 │
│ │ ur-live             │ ← 클릭          │
│ │ live.ur-team.com    │                 │
│ └─────────────────────┘                 │
└─────────────────────────────────────────┘
```

### 화면 3: Settings 메뉴
```
┌─────────────────────────────────────────┐
│ ur-live                                 │
├─────────────────────────────────────────┤
│ 상단 탭:                                 │
│  - Deployments                          │
│  - Analytics                            │
│  ▶ Settings  ← 여기 클릭                │
├─────────────────────────────────────────┤
│ 좌측 메뉴:                               │
│  - General                              │
│  - Builds & deployments                 │
│  ▶ Environment variables  ← 여기 클릭   │
│  - Functions                            │
└─────────────────────────────────────────┘
```

### 화면 4: Environment variables
```
┌─────────────────────────────────────────┐
│ Environment variables                   │
├─────────────────────────────────────────┤
│ Production  Preview                     │
│                                         │
│ [Add variable] ← 여기 클릭               │
│                                         │
│ 기존 변수들:                             │
│  - VITE_KAKAO_APP_KEY                   │
│  - VITE_TOSS_CLIENT_KEY                 │
│  ...                                    │
└─────────────────────────────────────────┘
```

### 화면 5: Add variable 폼
```
┌─────────────────────────────────────────┐
│ Add environment variable                │
├─────────────────────────────────────────┤
│ Variable name                           │
│ ┌─────────────────────────────────────┐ │
│ │ VITE_SENTRY_DSN                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Value                                   │
│ ┌─────────────────────────────────────┐ │
│ │ https://08caf64e8e7955f09acc...    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Select environments                     │
│ ☑ Production                            │
│ ☐ Preview                               │
│                                         │
│         [Cancel]  [Save]  ← 클릭        │
└─────────────────────────────────────────┘
```

---

## 🚨 문제 해결

### 문제 1: "ur-live" 프로젝트가 안 보여요
**해결**:
- Cloudflare 계정이 여러 개인 경우 → 올바른 계정 선택
- 프로젝트 이름이 다를 수 있음 → live.ur-team.com 도메인 확인

### 문제 2: "Add variable" 버튼이 비활성화됨
**해결**:
- 권한 확인 (Owner 또는 Admin 권한 필요)
- 페이지 새로고침

### 문제 3: 배포 후에도 Mock 모드 로그가 나옴
**해결**:
1. Cloudflare Dashboard → Environment variables 재확인
2. 변수 이름 정확히 확인 (대소문자, 언더스코어)
3. Production 환경 체크 확인
4. 브라우저 캐시 삭제 (Ctrl+Shift+Delete)
5. 시크릿 모드로 재접속

### 문제 4: Sentry Dashboard에 에러가 안 보여요
**해결**:
- 5-10분 대기 (전송 지연)
- 콘솔에서 `[Sentry] Initialized` 로그 확인
- DSN 정확성 재확인

---

## 📊 완료 체크리스트

- [ ] Cloudflare Dashboard 로그인
- [ ] Pages → ur-live 프로젝트 선택
- [ ] Settings → Environment variables 페이지 이동
- [ ] `VITE_SENTRY_DSN` 변수 추가
- [ ] `VITE_SENTRY_ENVIRONMENT` 변수 추가
- [ ] Retry deployment 실행
- [ ] 배포 완료 확인 (Status: Success)
- [ ] https://live.ur-team.com 접속
- [ ] F12 → Console → `[Sentry] Initialized` 로그 확인
- [ ] 테스트 에러 발생 (`window.Sentry?.captureException(...)`)
- [ ] Sentry Dashboard에서 에러 확인

---

## 🎯 예상 결과

### Before (환경 변수 설정 전)
```javascript
// 브라우저 콘솔
[Sentry] Mock mode - DSN not configured
```

### After (환경 변수 설정 후)
```javascript
// 브라우저 콘솔
[Sentry] Initialized: {
  environment: 'production',
  dsn: 'https://08caf64e8e79...'
}

// Sentry가 자동으로 추적하는 항목:
✅ CheckoutPage 에러
✅ API 401/403/500 에러
✅ 로그인 성공/실패 이벤트
✅ 결제 성공/실패 이벤트
✅ 페이지 로드 시간
✅ 런타임 예외
✅ 세션 재생 (에러 발생 시)
```

---

## 📞 지원

문제가 계속되면:
1. `.env.kr` 파일 확인: `cat .env.kr | grep SENTRY`
2. 빌드 로그 확인: Cloudflare Dashboard → Deployments → View build logs
3. 브라우저 Network 탭: Sentry 전송 요청 확인

---

**예상 소요 시간**: 5분 (설정) + 3분 (배포) + 2분 (확인) = 총 10분

**작성일**: 2026-03-05  
**작성자**: UR Live Development Team
