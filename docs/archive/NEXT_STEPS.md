# 🎯 ur-live 프로젝트 - 다음 단계 가이드

**마지막 업데이트**: 2026-03-01  
**현재 상태**: 로컬 개발 환경 완료 ✅  
**다음 단계**: 프로덕션 배포 준비

---

## 📊 현재 완료 상태

### ✅ 완료된 작업 (100%)
- [x] 환경 변수 분리 (.env + .dev.vars)
- [x] JWT Secret 생성 및 설정
- [x] TypeScript 설정 최적화
- [x] D1 로컬 데이터베이스 초기화 (55 migrations)
- [x] PM2 로컬 서버 설정
- [x] 빌드 테스트 통과 (2.04s)
- [x] 설정 검증 스크립트 작성
- [x] 완전한 문서화 (3개 가이드)
- [x] Git 커밋 완료 (2개)

### ⚠️ 남은 작업 (프로덕션 배포)
- [ ] Git Push to GitHub
- [ ] Wrangler 로그인
- [ ] Cloudflare Secrets 설정 (12개)
- [ ] GitHub Secrets 설정 (선택사항)
- [ ] 프로덕션 배포
- [ ] Health Check 확인

---

## 🚀 즉시 해야 할 작업 (우선순위 순)

### 1️⃣ Git Push (필수!) - 1분 ⭐⭐⭐

**현재 상태**: 
- 로컬에 2개 커밋 완료
- 원격 저장소에 아직 Push 안됨

**작업**:
```bash
cd /home/user/webapp

# 1. 원격 저장소 확인
git remote -v
# 예상 결과: origin https://github.com/tobe2111/ur-live.git

# 2. 현재 브랜치 확인
git branch
# main

# 3. Push
git push origin main

# 또는 강제 Push (충돌 시)
git push origin main -f
```

**커밋 내용**:
```
cbdbc9a - docs: Add complete setup and deployment guides
3e1627d - config: Complete project setup and configuration
```

**Push 후 확인**:
- GitHub에서 커밋 확인: https://github.com/tobe2111/ur-live/commits/main
- Actions 탭에서 자동 배포 시작 확인 (GitHub Actions 설정 시)

---

### 2️⃣ Wrangler 로그인 - 2분 ⭐⭐⭐

**목적**: Cloudflare Pages에 Secret 설정 및 배포

**작업**:
```bash
cd /home/user/webapp

# Wrangler 로그인 (브라우저 인증)
npx wrangler login
```

**브라우저에서**:
1. Cloudflare 계정으로 로그인
2. "Allow Wrangler" 클릭
3. "Success" 메시지 확인

**로그인 확인**:
```bash
# 인증 상태 확인
npx wrangler whoami

# 예상 결과:
# 👋 You are logged in as your-email@example.com
# ├ Account ID: abc123def456
# └ Account Name: Your Account
```

**프로젝트 확인**:
```bash
# ur-live 프로젝트 존재 확인
npx wrangler pages project list | grep ur-live
```

---

### 3️⃣ Cloudflare Secrets 설정 - 10분 ⭐⭐⭐

**Option A: 자동 스크립트 (권장) 🔥**

```bash
cd /home/user/webapp

# Secret 설정 스크립트 실행
./scripts/setup-secrets.sh
```

**스크립트가 하는 일**:
1. .dev.vars 파일 내용 출력
2. 각 Secret을 순서대로 설정 (12개)
3. 설정 완료 후 목록 출력

**각 Secret 입력 시**:
- 스크립트에서 .dev.vars 값을 보여줌
- 해당 값을 복사해서 붙여넣기
- Enter 키 입력

**Option B: 수동 설정**

```bash
# 필수 Secret 12개를 하나씩 설정
npx wrangler pages secret put FIREBASE_DATABASE_URL --project-name ur-live
# 값 입력: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app

npx wrangler pages secret put FIREBASE_API_KEY --project-name ur-live
# 값 입력: AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8

npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live
# 값 입력: urteam-live-commerce-5b284

npx wrangler pages secret put FIREBASE_AUTH_DOMAIN --project-name ur-live
# 값 입력: urteam-live-commerce-5b284.firebaseapp.com

npx wrangler pages secret put FIREBASE_STORAGE_BUCKET --project-name ur-live
# 값 입력: urteam-live-commerce-5b284.firebasestorage.app

npx wrangler pages secret put FIREBASE_MESSAGING_SENDER_ID --project-name ur-live
# 값 입력: 352937066044

npx wrangler pages secret put FIREBASE_APP_ID --project-name ur-live
# 값 입력: 1:352937066044:web:e5bfd5e1d8f61688e30d39

npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live
# 값 입력: .dev.vars에서 전체 Private Key 복사 (줄바꿈 포함)

npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live
# 값 입력: firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com

npx wrangler pages secret put JWT_SECRET --project-name ur-live
# 값 입력: Nt1RPgjjhYEWqZ8j7rc8z8KazbJs4MjYRHqOT9POFYI=

npx wrangler pages secret put REFRESH_TOKEN_SECRET --project-name ur-live
# 값 입력: 9xqG4JnS0qT33VM9QvpDgAF+hUKslumNkaB0C0o31Qo=

npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
# 값 입력: test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
# ⚠️ 프로덕션: live_gsk_... 로 교체 필요!
```

**설정 확인**:
```bash
# 등록된 Secret 목록 확인
npx wrangler pages secret list --project-name ur-live

# 예상 결과: 12개 Secret 표시
```

---

### 4️⃣ 프로덕션 배포 - 3분 ⭐⭐⭐

**⚠️ 중요**: Secret 설정 후 **반드시 배포**해야 적용됩니다!

```bash
cd /home/user/webapp

# 1. 빌드
npm run build

# 예상 결과:
# ✓ built in 2.04s
# dist/_worker.js  357.86 kB

# 2. 배포
npx wrangler pages deploy dist --project-name ur-live --branch main --commit-dirty=true

# 예상 결과:
# ✨ Success! Uploaded 1 files (2.03 sec)
# ✨ Deployment complete! Take a peek over at https://...
```

**배포 URL 확인**:
- Production: https://live.ur-team.com
- Preview: https://[deployment-id].ur-live.pages.dev

---

### 5️⃣ Health Check 확인 - 1분 ⭐⭐

**배포 완료 후 API 테스트**:

```bash
# Health Check API
curl https://live.ur-team.com/api/health

# 예상 결과:
# {
#   "status": "ok",
#   "version": "445ec5aa",
#   "timestamp": "2026-03-01T05:00:00.000Z"
# }
```

**브라우저에서 확인**:
1. https://live.ur-team.com 접속
2. 홈페이지 정상 로드 확인
3. 로그인 페이지 접속 확인

---

## 🎯 선택적 작업 (권장)

### 6️⃣ GitHub Actions 자동 배포 설정 - 5분 ⭐⭐

**목적**: Git Push 시 자동으로 배포

**GitHub Secrets 설정**:
1. GitHub 저장소 → Settings
2. Secrets and variables → Actions
3. New repository secret 클릭

**필요한 Secret (2개)**:

```
Name: CLOUDFLARE_API_TOKEN
Value: [Cloudflare에서 발급받은 API Token]

Name: CLOUDFLARE_ACCOUNT_ID
Value: [Cloudflare Account ID]
```

**CLOUDFLARE_API_TOKEN 발급**:
1. Cloudflare Dashboard → My Profile → API Tokens
2. "Create Token" 클릭
3. "Edit Cloudflare Pages" 템플릿 선택
4. "Create Token" → 토큰 복사
5. GitHub Secrets에 추가

**CLOUDFLARE_ACCOUNT_ID 확인**:
1. Cloudflare Dashboard
2. 우측 사이드바에서 "Account ID" 복사
3. GitHub Secrets에 추가

**설정 확인**:
- `.github/workflows/deploy.yml` 파일 존재 확인
- GitHub Actions 탭에서 워크플로우 확인

---

### 7️⃣ D1 프로덕션 마이그레이션 - 2분 ⭐

**프로덕션 데이터베이스 초기화**:

```bash
cd /home/user/webapp

# 프로덕션 D1 마이그레이션
npm run db:migrate:prod

# 예상 결과:
# 🌀 Executing on remote database...
# 🚣 55 migrations applied successfully
```

**확인**:
```bash
# 프로덕션 DB 쿼리 테스트
npx wrangler d1 execute toss-live-commerce-db --command="SELECT COUNT(*) as count FROM users"
```

---

### 8️⃣ 프로덕션 키 교체 (중요!) - 5분 ⭐⭐

**현재 테스트 키를 프로덕션 키로 교체**:

#### Toss Payments
```bash
# 현재: test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
# 변경: live_gsk_... (Toss에서 발급받은 실제 프로덕션 키)

npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
# 프로덕션 키 입력

# ⚠️ 재배포 필수!
npm run build
npx wrangler pages deploy dist --project-name ur-live
```

#### Kakao OAuth (필요시)
```bash
# Kakao 프로덕션 앱 등록 후
npx wrangler pages secret put KAKAO_REST_API_KEY --project-name ur-live
# Kakao 프로덕션 REST API Key 입력
```

---

## 📋 전체 체크리스트

### 즉시 필요 ⭐⭐⭐
- [ ] **Git Push** (1분)
- [ ] **Wrangler 로그인** (2분)
- [ ] **Cloudflare Secrets 설정** (10분)
- [ ] **프로덕션 배포** (3분)
- [ ] **Health Check 확인** (1분)

### 권장 작업 ⭐⭐
- [ ] GitHub Actions 자동 배포 설정 (5분)
- [ ] D1 프로덕션 마이그레이션 (2분)
- [ ] 프로덕션 키 교체 (5분)

### 선택 사항 ⭐
- [ ] Sentry 에러 모니터링 설정
- [ ] Resend 이메일 알림 설정
- [ ] Discord Webhook 알림 설정

---

## 🚀 빠른 실행 가이드

### 전체 과정 (20분)

```bash
# 1. Git Push (1분)
git push origin main

# 2. Wrangler 로그인 (2분)
npx wrangler login

# 3. Secrets 자동 설정 (10분)
./scripts/setup-secrets.sh

# 4. 배포 (3분)
npm run build
npx wrangler pages deploy dist --project-name ur-live --branch main

# 5. 확인 (1분)
curl https://live.ur-team.com/api/health

# 6. D1 마이그레이션 (2분)
npm run db:migrate:prod

# 완료! 🎉
```

---

## 💡 문제 해결

### "You are not authenticated" 에러
```bash
npx wrangler logout
npx wrangler login
```

### Secret 설정이 적용 안됨
```bash
# Secret 재설정 후 반드시 재배포!
npx wrangler pages secret put SECRET_NAME --project-name ur-live
npm run build
npx wrangler pages deploy dist --project-name ur-live
```

### 배포 실패
```bash
# 캐시 클리어 후 재빌드
rm -rf dist .vite node_modules/.vite
npm run build
npx wrangler pages deploy dist --project-name ur-live
```

---

## 📚 참고 문서

### 설정 가이드
- **SETUP_CLOUDFLARE_SECRETS.md**: 상세 Secret 설정 가이드
- **QUICKSTART.md**: 빠른 시작 가이드
- **scripts/setup-secrets.sh**: 자동 Secret 설정 스크립트

### 배포 프로토콜
- **CLOUDFLARE_DEPLOYMENT_PROTOCOL.md**: Secret 변경 필수 프로토콜

---

## 🎯 완료 후 상태

### ✅ 모든 작업 완료 시
- [x] 로컬 개발 환경 완료
- [x] Git 저장소 동기화
- [x] Cloudflare Secrets 설정
- [x] 프로덕션 배포 완료
- [x] D1 프로덕션 DB 초기화
- [x] Health Check 통과

**축하합니다! 프로덕션 배포 완료! 🎉**

### 🌐 접속 URL
- Production: https://live.ur-team.com
- Admin: https://live.ur-team.com/admin
- Seller: https://live.ur-team.com/seller

---

**다음 단계**: 실제 사용자 테스트 및 모니터링 설정

**문의**: dev@ur-team.com  
**마지막 업데이트**: 2026-03-01
