# 🚀 Sentry 빠른 설정 가이드 (처음부터 끝까지)

## 📋 현재 상황
- ✅ Sentry 패키지 설치됨 (@sentry/react, @sentry/tracing)
- ✅ src/lib/sentry.ts 파일 존재
- ✅ src/main.tsx에서 initSentry() 호출 중
- ❌ **환경 변수 설정 안 됨** ← 지금 설정 필요!

---

## 🎯 Step 1: Sentry 프로젝트 생성 (5분)

### 1.1 Sentry 계정 만들기
1. **https://sentry.io** 접속
2. **"Get Started"** 또는 **"Sign Up"** 클릭
3. 이메일로 가입 또는 GitHub 연동 가입
4. 무료 플랜 선택 (Developer Plan: 5,000 errors/month)

### 1.2 새 프로젝트 생성
1. 로그인 후 **"Create Project"** 클릭
2. **Platform** 선택: **"React"** 선택
3. **Alert frequency**: "Alert me on every new issue" 선택 (기본값)
4. **Project name**: `ur-live-kr` 입력
5. **Team**: 기본 팀 선택 (또는 새로 만들기)
6. **"Create Project"** 클릭

### 1.3 DSN 복사하기
프로젝트 생성하면 바로 이런 화면 나옵니다:

```javascript
Sentry.init({
  dsn: "https://abc123def456@o123456.ingest.sentry.io/7890123",
  // ...
});
```

**이 DSN 주소를 복사하세요!** 📋
형식: `https://<key>@<org>.ingest.sentry.io/<project-id>`

---

## 🔧 Step 2: 로컬 환경 변수 설정 (1분)

### 2.1 .env.kr 파일 수정

```bash
cd /home/user/webapp
```

`.env.kr` 파일에 아래 2줄 추가:

```bash
# Sentry 설정
VITE_SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/7890123
VITE_SENTRY_ENVIRONMENT=production
```

⚠️ **주의**: 위의 DSN은 예시입니다! **실제 Sentry에서 받은 DSN으로 교체**하세요!

### 2.2 .env.world 파일도 동일하게 수정 (World 리전도 사용 시)

```bash
# Sentry 설정
VITE_SENTRY_DSN=https://abc123def456@o123456.ingest.sentry.io/7890123
VITE_SENTRY_ENVIRONMENT=production
```

---

## 🧪 Step 3: 로컬 테스트 (2분)

### 3.1 개발 서버 시작

```bash
cd /home/user/webapp
npm run dev
```

### 3.2 브라우저 콘솔 확인

1. http://localhost:5173 접속
2. F12 → Console 탭 열기
3. 다음 메시지 확인:

```
[Sentry] Initialized: { environment: 'development', dsn: 'https://...' }
```

또는 DSN 없으면:

```
[Sentry] Mock mode - DSN not configured
```

### 3.3 테스트 에러 발생시키기

브라우저 콘솔에서 실행:

```javascript
// 1. 수동 에러 발생
window.Sentry?.captureException(new Error('Sentry Test Error from Local'))

// 2. 메시지 전송
window.Sentry?.captureMessage('Sentry Test Message', 'info')
```

### 3.4 Sentry Dashboard 확인

1. https://sentry.io 접속
2. ur-live-kr 프로젝트 선택
3. **Issues** 탭 클릭
4. 방금 발생시킨 테스트 에러 확인 (1-2분 소요)

✅ 에러가 보이면 성공!

---

## 🚀 Step 4: 프로덕션 배포 설정 (5분)

### 4.1 Cloudflare Pages 환경 변수 추가

1. **https://dash.cloudflare.com** 접속
2. **Workers & Pages** 클릭
3. **ur-live** 프로젝트 선택
4. **Settings** → **Environment variables** 클릭
5. **Production** 탭 선택
6. **Add variable** 버튼 클릭

#### 추가할 환경 변수 (2개):

| Variable name | Value | Deployment |
|--------------|-------|------------|
| `VITE_SENTRY_DSN` | `https://abc123...@...ingest.sentry.io/...` | Production |
| `VITE_SENTRY_ENVIRONMENT` | `production` | Production |

7. **Save** 버튼 클릭

⚠️ **중요**: 환경 변수 추가 후 **재배포 필수**!

### 4.2 재배포 방법

#### Option A: Git Push로 자동 배포 (권장)

```bash
cd /home/user/webapp

# 더미 커밋 (환경 변수 적용 트리거)
git commit --allow-empty -m "chore: Trigger rebuild for Sentry env vars"
git push origin main

# Cloudflare Pages 자동 빌드 시작 (2-3분 소요)
```

#### Option B: Cloudflare Dashboard에서 수동 재배포

1. Cloudflare Pages → ur-live 프로젝트
2. **Deployments** 탭
3. 최신 배포 우측 **"..."** → **"Retry deployment"**

### 4.3 배포 완료 확인

```bash
# 1. 사이트 접속 가능 확인
curl -I https://live.ur-team.com

# 2. 프로덕션에서 Sentry 초기화 확인
# https://live.ur-team.com 접속 → F12 → Console
# "[Sentry] Initialized: production" 메시지 확인
```

---

## 🧪 Step 5: 프로덕션 테스트 (2분)

### 5.1 프로덕션 에러 발생시키기

https://live.ur-team.com 접속 후 F12 → Console:

```javascript
// 테스트 에러 발생
window.Sentry?.captureException(new Error('Production Test Error'))

// 테스트 메시지
window.Sentry?.captureMessage('Production Test - Sentry Working!', 'info')
```

### 5.2 Sentry Dashboard 확인

1. https://sentry.io 접속
2. ur-live-kr 프로젝트 → **Issues** 탭
3. 방금 발생시킨 에러 확인 (1-2분 소요)
4. Environment: **production** 확인

✅ 프로덕션 에러가 보이면 완전 성공!

---

## 🎯 Step 6: 실전 에러 추적 확인 (자동)

이제 실제 사용자 에러가 자동으로 Sentry에 기록됩니다:

### 자동 추적되는 에러들:

1. **CheckoutPage 에러**
   - userId 없음
   - API 로드 실패
   - 배송지 저장 실패

2. **API 인증 에러**
   - Auth 토큰 누락 (warning)
   - 토큰 갱신 실패
   - 권한 거부 (403)
   - Firebase 인증 실패 (401)

3. **JavaScript Runtime 에러**
   - Unhandled exceptions
   - Promise rejections
   - React component errors

### Sentry Dashboard에서 확인할 것들:

- **Issues**: 발생한 에러 목록
- **Performance**: 페이지 로드 시간 (10% 샘플링)
- **Replays**: 에러 발생 시 세션 녹화 (10% 샘플링)
- **Alerts**: 이메일 알림 설정 가능

---

## 🔍 Step 7: Sentry 제대로 작동하는지 확인하는 법

### 로컬 개발 환경

```bash
# 1. 개발 서버 시작
npm run dev

# 2. 브라우저 콘솔 확인
# "[Sentry] Mock mode - DSN not configured" 또는
# "[Sentry] Initialized: development"

# 3. DSN 설정 안 됐으면
# .env.kr 파일에 VITE_SENTRY_DSN 추가
```

### 프로덕션 환경

```bash
# 1. 사이트 접속
open https://live.ur-team.com

# 2. F12 → Console
# "[Sentry] Initialized: { environment: 'production', dsn: '...' }" 확인

# 3. 테스트 에러 발생
window.Sentry?.captureException(new Error('Test'))

# 4. Sentry Dashboard 확인 (1분 후)
```

---

## 🚨 문제 해결 (Troubleshooting)

### ❌ "[Sentry] Mock mode - DSN not configured"

**원인**: 환경 변수 설정 안 됨

**해결**:
1. `.env.kr` 파일에 `VITE_SENTRY_DSN` 추가
2. 개발 서버 재시작 (`npm run dev` 다시 실행)

---

### ❌ "Sentry is not defined"

**원인**: Sentry 패키지 설치 안 됨

**해결**:
```bash
cd /home/user/webapp
npm install @sentry/react @sentry/tracing
```

---

### ❌ 프로덕션에서 "[Sentry] Mock mode"

**원인**: Cloudflare Pages 환경 변수 설정 안 됨

**해결**:
1. Cloudflare Dashboard → Settings → Environment variables
2. `VITE_SENTRY_DSN` 추가
3. 재배포 (git push 또는 Retry deployment)

---

### ❌ Sentry Dashboard에 에러 안 보임

**원인 1**: 개발 환경에서 테스트 중
- 개발 환경에서는 Sentry 전송 차단됨 (beforeSend 로직)
- 프로덕션 빌드로 테스트: `npm run build:kr && npm run preview`

**원인 2**: DSN이 잘못됨
- Sentry 프로젝트 → Settings → Client Keys (DSN)에서 확인

**원인 3**: 네트워크 차단
- 회사 방화벽이 Sentry 도메인 차단하는지 확인
- `curl https://sentry.io` 테스트

---

## 📊 Sentry 대시보드 주요 메뉴

### 1. **Issues** (가장 중요)
- 발생한 모든 에러 목록
- 에러 발생 횟수, 영향받은 사용자 수
- 스택 트레이스, 브레드크럼 (에러 발생 과정)

### 2. **Performance**
- 페이지 로드 시간
- API 응답 속도
- 느린 트랜잭션 식별

### 3. **Replays**
- 에러 발생 시 사용자 세션 녹화
- 마우스 움직임, 클릭, 스크롤 재생
- 디버깅에 매우 유용!

### 4. **Alerts**
- 새 에러 발생 시 이메일 알림
- Slack/Discord 웹훅 연동 가능
- 에러 급증 시 알림

---

## ✅ 완료 체크리스트

- [ ] Sentry 계정 생성
- [ ] ur-live-kr 프로젝트 생성
- [ ] DSN 복사
- [ ] .env.kr 파일에 VITE_SENTRY_DSN 추가
- [ ] 로컬에서 테스트 (npm run dev)
- [ ] 브라우저 콘솔에서 "[Sentry] Initialized" 확인
- [ ] 테스트 에러 발생 (window.Sentry.captureException)
- [ ] Sentry Dashboard에서 테스트 에러 확인
- [ ] Cloudflare Pages 환경 변수 추가
- [ ] 재배포 (git push 또는 수동)
- [ ] 프로덕션에서 Sentry 동작 확인
- [ ] 프로덕션 테스트 에러 Sentry Dashboard 확인

---

## 🎉 성공 기준

### ✅ 로컬 환경
```
[Sentry] Initialized: { environment: 'development', dsn: 'https://...' }
```

### ✅ 프로덕션 환경
```
[Sentry] Initialized: { environment: 'production', dsn: 'https://...' }
```

### ✅ Sentry Dashboard
- Issues 탭에 테스트 에러 보임
- Environment: production
- User 정보, 브라우저 정보 표시됨

---

## 📞 추가 도움

### Sentry 공식 문서
- React 가이드: https://docs.sentry.io/platforms/javascript/guides/react/
- Configuration: https://docs.sentry.io/platforms/javascript/configuration/

### UR Live 관련 문서
- CLOUDFLARE_ENV_SETUP.md (이미 있음)
- SENTRY_SETUP_GUIDE.md (이미 있음)

---

**작성일**: 2026-03-05  
**작성자**: UR Live Development Team  
**소요 시간**: 총 ~15분 (Sentry 가입 5분 + 설정 10분)
