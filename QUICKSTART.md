# 🚀 ur-live 프로젝트 Quick Start 가이드

**설정 완료일**: 2026-03-01  
**빌드 시간**: 2.04s (최적화 완료!)  
**상태**: 로컬 개발 환경 완료 ✅

---

## 📋 현재 상태

### ✅ 완료된 설정
- [x] 환경 변수 분리 (.env + .dev.vars)
- [x] JWT Secret 생성
- [x] TypeScript 설정 최적화
- [x] D1 로컬 데이터베이스 초기화 (55 migrations)
- [x] PM2 로컬 서버 설정
- [x] 빌드 검증 통과

### ⚠️ 프로덕션 배포 필요
- [ ] Wrangler 로그인
- [ ] Cloudflare Secrets 설정
- [ ] GitHub Secrets 설정
- [ ] 프로덕션 배포

---

## 🎯 로컬 개발 시작 (3분)

### Step 1: 설정 검증 (10초)

```bash
cd /home/user/webapp
./scripts/verify-setup.sh
```

**예상 결과**: ✅ 모든 필수 검증 통과

### Step 2: 개발 서버 시작 (30초)

**Option A: Wrangler Dev Server (권장)**
```bash
npm run dev:wrangler
```

**Option B: PM2 Process Manager**
```bash
pm2 start ecosystem.config.cjs
pm2 logs ur-live --nostream
```

**Option C: Vite Dev Server (프론트엔드만)**
```bash
npm run dev
```

### Step 3: 브라우저 접속

```
http://localhost:3000
```

---

## 🏗️ 빌드 & 테스트 (2분)

### 빌드 실행

```bash
npm run build
```

**예상 결과**:
- ✅ 빌드 시간: ~2초
- ✅ 출력: dist/_worker.js (357 KB)

### 빌드 미리보기

```bash
npm run preview
```

---

## 🚀 프로덕션 배포 (10분)

### Step 1: Wrangler 로그인 (1분)

```bash
npx wrangler login
```

브라우저에서 Cloudflare 계정으로 인증합니다.

### Step 2: Cloudflare Secrets 설정 (5분)

**자동 설정 스크립트**:

```bash
# 모든 Secret을 한 번에 설정 (대화형)
cat SETUP_CLOUDFLARE_SECRETS.md
```

**수동 설정** (각 명령어 실행 후 값 입력):

```bash
# 필수 Secret (12개)
npx wrangler pages secret put FIREBASE_DATABASE_URL --project-name ur-live
npx wrangler pages secret put FIREBASE_API_KEY --project-name ur-live
npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live
npx wrangler pages secret put FIREBASE_AUTH_DOMAIN --project-name ur-live
npx wrangler pages secret put FIREBASE_STORAGE_BUCKET --project-name ur-live
npx wrangler pages secret put FIREBASE_MESSAGING_SENDER_ID --project-name ur-live
npx wrangler pages secret put FIREBASE_APP_ID --project-name ur-live
npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live
npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live
npx wrangler pages secret put JWT_SECRET --project-name ur-live
npx wrangler pages secret put REFRESH_TOKEN_SECRET --project-name ur-live
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
```

**값은 `.dev.vars` 파일에서 복사하세요.**

### Step 3: Secret 확인 (30초)

```bash
npx wrangler pages secret list --project-name ur-live
```

**예상 결과**: 최소 12개 Secret 등록 완료

### Step 4: 프로덕션 배포 (2분)

```bash
# 빌드
npm run build

# 배포
npx wrangler pages deploy dist --project-name ur-live --branch main --commit-dirty=true
```

### Step 5: 배포 확인 (1분)

```bash
# Health Check
curl https://live.ur-team.com/api/health

# 또는 브라우저에서
# https://live.ur-team.com
```

**예상 결과**: 
```json
{
  "status": "ok",
  "version": "445ec5aa",
  "timestamp": "2026-03-01T05:00:00.000Z"
}
```

---

## 📚 주요 명령어

### 개발

```bash
# 로컬 서버 시작
npm run dev:wrangler          # Wrangler dev server (권장)
npm run dev                   # Vite dev server

# PM2로 시작
pm2 start ecosystem.config.cjs
pm2 stop ur-live
pm2 restart ur-live
pm2 logs ur-live --nostream
```

### 빌드

```bash
# 일반 빌드
npm run build

# 전체 빌드 (캐시 클리어)
npm run build:full

# 빌드 + 미리보기
npm run preview
```

### 데이터베이스

```bash
# 로컬 마이그레이션
npm run db:migrate:local

# 프로덕션 마이그레이션
npm run db:migrate:prod

# 로컬 DB 콘솔
npm run db:console:local

# DB 초기화 (주의!)
npm run db:reset
```

### 배포

```bash
# 빠른 배포
npm run deploy

# 프로덕션 배포
npm run deploy:prod

# 안전 배포 (프리뷰)
npm run deploy:safe

# 안전 배포 (프로덕션)
npm run deploy:safe:prod
```

### Git

```bash
# 상태 확인
npm run git:status

# 커밋
npm run git:commit "feat: 새로운 기능"

# 로그 확인
npm run git:log
```

---

## 🔧 개발 팁

### 1. 환경 변수 확인

```bash
# .dev.vars 내용 확인
cat .dev.vars

# .env 내용 확인
cat .env
```

### 2. 포트 충돌 해결

```bash
# 3000 포트 사용 중 프로세스 종료
npm run clean-port
```

### 3. 타입 체크

```bash
# TypeScript 타입 검증
npm run type-check
```

### 4. 설정 검증

```bash
# 전체 설정 확인
./scripts/verify-setup.sh
```

---

## 🐛 문제 해결

### 빌드 실패

```bash
# 캐시 클리어 후 재빌드
rm -rf dist .vite node_modules/.vite
npm run build
```

### D1 마이그레이션 실패

```bash
# 로컬 DB 초기화
npm run db:reset

# 마이그레이션 재실행
npm run db:migrate:local
```

### PM2 서버 멈춤

```bash
# PM2 재시작
pm2 restart ur-live

# PM2 프로세스 전체 재시작
pm2 restart all
```

### Secret 적용 안됨

```bash
# Secret 재설정 후 반드시 재배포!
npx wrangler pages secret put SECRET_NAME --project-name ur-live
npm run build
npx wrangler pages deploy dist --project-name ur-live
```

---

## 📖 추가 문서

### 설정 가이드
- [SETUP_CLOUDFLARE_SECRETS.md](./SETUP_CLOUDFLARE_SECRETS.md) - Cloudflare Secrets 설정
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - 배포 체크리스트
- [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md) - 환경 변수 가이드

### 개발 문서
- [README.md](./README.md) - 프로젝트 개요
- [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md) - 개발 로그
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처

### 배포 프로토콜
- [CLOUDFLARE_DEPLOYMENT_PROTOCOL.md](./CLOUDFLARE_DEPLOYMENT_PROTOCOL.md) - **필수!** Secret 변경 시 읽기

---

## 🎯 빠른 체크리스트

### 로컬 개발 ✅
- [x] npm install 완료
- [x] .dev.vars 설정 완료
- [x] D1 마이그레이션 완료
- [x] 빌드 테스트 통과
- [x] 로컬 서버 실행 가능

### 프로덕션 배포 ⚠️
- [ ] Wrangler 로그인
- [ ] Cloudflare Secrets 설정 (12개)
- [ ] GitHub Secrets 설정 (2개)
- [ ] 프로덕션 배포
- [ ] Health Check 확인

---

## 💡 다음 단계

### 즉시 가능
1. 로컬 서버 시작: `npm run dev:wrangler`
2. 코드 수정 후 Hot Reload 확인
3. 새로운 기능 개발

### 배포 전 필요
1. Wrangler 로그인
2. Cloudflare Secrets 설정
3. 프로덕션 테스트 키 교체 (Toss, Kakao)

### 배포 후
1. Health Check API 테스트
2. 로그인/회원가입 테스트
3. 결제 플로우 테스트
4. 모니터링 설정 (Sentry)

---

## 🎉 완료!

**로컬 개발 환경이 완전히 설정되었습니다!**

이제 다음 명령어로 개발을 시작하세요:

```bash
npm run dev:wrangler
```

프로덕션 배포가 필요하면 [SETUP_CLOUDFLARE_SECRETS.md](./SETUP_CLOUDFLARE_SECRETS.md)를 참고하세요.

---

**문의사항**: GitHub Issues 또는 dev@ur-team.com  
**마지막 업데이트**: 2026-03-01  
**설정 버전**: 445ec5aa
