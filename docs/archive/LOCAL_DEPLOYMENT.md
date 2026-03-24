# 🚀 로컬 터미널에서 배포하는 방법

## 📋 목차
- [사전 준비](#사전-준비)
- [1단계: 빌드](#1단계-빌드)
- [2단계: Cloudflare 로그인](#2단계-cloudflare-로그인)
- [3단계: 배포](#3단계-배포)
- [4단계: 배포 확인](#4단계-배포-확인)
- [트러블슈팅](#트러블슈팅)

---

## 사전 준비

### 필수 도구 설치

```bash
# Node.js 18+ 확인
node --version

# npm 확인
npm --version

# wrangler CLI 설치 (전역)
npm install -g wrangler

# wrangler 버전 확인
wrangler --version
```

### 프로젝트 클론 및 의존성 설치

```bash
# 1. 프로젝트 클론
git clone https://github.com/tobe2111/ur-live.git
cd ur-live

# 2. 의존성 설치
npm install

# 3. 브랜치 확인
git branch -a
git checkout main
```

---

## 1단계: 빌드

### KR 빌드 (한국 버전 - Kakao + Toss)

```bash
# KR 버전 빌드
npm run build:kr

# 빌드 결과 확인
ls -lh dist/
```

**예상 출력:**
```
dist/
├── _headers          # HTTP 헤더 설정
├── _redirects        # 리다이렉트 규칙
├── _routes.json      # Cloudflare 라우팅
├── _worker.js        # Cloudflare Worker (82 KB)
├── index.html        # 메인 HTML
├── assets/           # JS/CSS 번들 (~1.8 MB)
└── static/           # 정적 파일
```

### GLOBAL 빌드 (글로벌 버전 - Google + Stripe)

```bash
# GLOBAL 버전 빌드
npm run build:global

# 빌드 결과 확인
ls -lh dist-global/
```

---

## 2단계: Cloudflare 로그인

### 처음 배포하는 경우

```bash
# Cloudflare 계정 로그인 (브라우저 자동 열림)
wrangler login

# 로그인 성공 확인
wrangler whoami
```

**예상 출력:**
```
 ⛅️ wrangler 3.x.x
-------------------
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email 'your-email@example.com'!
┌──────────────────────┬──────────────────────────────────┐
│ Account Name         │ Account ID                        │
├──────────────────────┼──────────────────────────────────┤
│ Your Account         │ abc123def456...                   │
└──────────────────────┴──────────────────────────────────┘
```

### 이미 로그인되어 있는 경우

```bash
# 현재 로그인 상태 확인
wrangler whoami

# 재로그인이 필요한 경우
wrangler logout
wrangler login
```

---

## 3단계: 배포

### KR 배포 (live.ur-team.com)

```bash
# dist 폴더를 ur-live 프로젝트로 배포
wrangler pages deploy dist \
  --project-name=ur-live \
  --branch=main

# 또는 간단하게
npx wrangler pages deploy dist --project-name=ur-live
```

### GLOBAL 배포 (global.ur-team.com)

```bash
# dist-global 폴더를 ur-live-global 프로젝트로 배포
wrangler pages deploy dist-global \
  --project-name=ur-live-global \
  --branch=main
```

**예상 출력:**
```
🌍  Uploading... (10/50)
🌍  Uploading... (30/50)
🌍  Uploading... (50/50)

✨ Success! Uploaded 50 files (3.45 sec)

✨ Compiled Worker successfully
✨ Uploading Worker bundle...
✨ Deployment complete! Take a peek over at https://abc123.ur-live.pages.dev

To change your site domain, go to:
 > https://dash.cloudflare.com/[account_id]/pages/view/ur-live/domains
```

---

## 4단계: 배포 확인

### 배포 상태 확인

```bash
# Cloudflare Pages 대시보드에서 확인
open https://dash.cloudflare.com/[your-account-id]/pages/view/ur-live/deployments

# 또는 CLI로 확인
wrangler pages deployment list --project-name=ur-live
```

### 프로덕션 사이트 테스트

```bash
# KR 사이트 접속
curl -I https://live.ur-team.com/

# GLOBAL 사이트 접속
curl -I https://global.ur-team.com/

# 특정 경로 테스트
curl https://live.ur-team.com/user/profile
```

**예상 응답:**
```
HTTP/2 200 
date: Thu, 05 Mar 2026 03:00:00 GMT
content-type: text/html; charset=utf-8
cache-control: no-cache, no-store, must-revalidate
cf-ray: abc123-ICN
```

### 기능 테스트 체크리스트

- [ ] 메인 페이지 로딩 (`/`)
- [ ] 사용자 프로필 페이지 (`/user/profile`)
- [ ] 장바구니 페이지 (`/cart`)
- [ ] 결제 페이지 (`/checkout`)
- [ ] Kakao 로그인 (KR) / Google 로그인 (GLOBAL)
- [ ] API 엔드포인트 (`/api/products`, `/api/orders`)
- [ ] Worker 헬스체크 (`/health`)

---

## 트러블슈팅

### 문제 1: `wrangler: command not found`

```bash
# wrangler 재설치
npm install -g wrangler

# 또는 npx 사용
npx wrangler pages deploy dist --project-name=ur-live
```

### 문제 2: 빌드 실패 (`npm run build:kr` 오류)

```bash
# 캐시 삭제 후 재빌드
rm -rf node_modules dist dist-global .vite
npm install
npm run build:kr
```

### 문제 3: 배포 권한 오류

```bash
# 재로그인
wrangler logout
wrangler login

# API 토큰 확인
wrangler whoami
```

### 문제 4: 404 에러 (SPA 라우팅 실패)

```bash
# _redirects 파일 확인
cat dist/_redirects

# 예상 내용:
# /* /index.html 200

# 없으면 수동 생성
echo "/* /index.html 200" > dist/_redirects

# 재배포
wrangler pages deploy dist --project-name=ur-live
```

### 문제 5: Worker 번들 크기 초과

```bash
# Worker 번들 크기 확인
ls -lh dist/_worker.js

# 82 KB 이하여야 함 (현재 ~44 KB)
# 100 MB 초과 시 최적화 필요
```

### 문제 6: 환경 변수 누락

```bash
# Cloudflare Pages에서 환경 변수 확인
wrangler pages project list

# 환경 변수 설정 (대시보드)
open https://dash.cloudflare.com/[account]/pages/view/ur-live/settings/environment-variables

# 필수 환경 변수:
# - KAKAO_REST_API_KEY
# - FIREBASE_PROJECT_ID
# - FIREBASE_PRIVATE_KEY
# - FIREBASE_CLIENT_EMAIL
# - TOSS_SECRET_KEY
```

---

## 🎯 빠른 배포 명령어 요약

```bash
# 1. KR 버전 빌드 + 배포
npm run build:kr && \
wrangler pages deploy dist --project-name=ur-live --branch=main

# 2. GLOBAL 버전 빌드 + 배포
npm run build:global && \
wrangler pages deploy dist-global --project-name=ur-live-global --branch=main

# 3. 배포 확인
curl -I https://live.ur-team.com/ && \
echo "✅ KR 배포 성공"

# 4. Worker 헬스체크
curl https://live.ur-team.com/health | jq
```

---

## 📊 배포 시간

| 단계 | 예상 시간 |
|------|----------|
| 빌드 (npm run build:kr) | 20-30초 |
| 배포 (wrangler pages deploy) | 30-60초 |
| CDN 전파 | 1-2분 |
| **총 배포 시간** | **2-4분** |

---

## 🔗 유용한 링크

- **GitHub 저장소**: https://github.com/tobe2111/ur-live
- **Cloudflare 대시보드**: https://dash.cloudflare.com
- **KR 프로덕션**: https://live.ur-team.com
- **GLOBAL 프로덕션**: https://global.ur-team.com
- **Wrangler 문서**: https://developers.cloudflare.com/workers/wrangler/

---

## 📝 다음 단계

1. ✅ 로컬 터미널에서 배포 완료
2. GitHub Actions 자동 배포 설정 (`.github/workflows/deploy.yml`)
3. 배포 알림 설정 (Discord/Slack)
4. 롤백 전략 수립 (`wrangler pages deployment list`)

---

**작성일**: 2026-03-05  
**작성자**: UR Live Team  
**버전**: 2.1.0
