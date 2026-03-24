# 🔐 Cloudflare Secrets 설정 가이드

**프로젝트**: ur-live  
**최종 업데이트**: 2026-03-01  
**설정 완료일**: 로컬 개발 완료, 프로덕션 설정 필요

---

## 📋 목차

1. [사전 준비](#1-사전-준비)
2. [Cloudflare 인증](#2-cloudflare-인증)
3. [Secret 설정](#3-secret-설정)
4. [설정 확인](#4-설정-확인)
5. [프로덕션 배포](#5-프로덕션-배포)

---

## 1. 사전 준비

### 필요한 정보 확인

현재 `.dev.vars` 파일에 있는 모든 정보를 Cloudflare Secrets로 복사해야 합니다.

```bash
# .dev.vars 파일 내용 확인
cat .dev.vars
```

### 현재 설정된 Secret 값

`.dev.vars`에서 다음 값들을 복사하세요:

```bash
# Firebase (9개)
FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_API_KEY=AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8
FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
FIREBASE_AUTH_DOMAIN=urteam-live-commerce-5b284.firebaseapp.com
FIREBASE_STORAGE_BUCKET=urteam-live-commerce-5b284.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=352937066044
FIREBASE_APP_ID=1:352937066044:web:e5bfd5e1d8f61688e30d39
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com"

# JWT (2개)
JWT_SECRET=Nt1RPgjjhYEWqZ8j7rc8z8KazbJs4MjYRHqOT9POFYI=
REFRESH_TOKEN_SECRET=9xqG4JnS0qT33VM9QvpDgAF+hUKslumNkaB0C0o31Qo=

# Toss Payments (1개) - 프로덕션 키로 교체 필요!
TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6

# 선택사항 (2개)
RESEND_API_KEY=
EMAIL_FROM=noreply@ur-team.com
```

---

## 2. Cloudflare 인증

### Step 1: Wrangler 로그인

```bash
# 브라우저 인증 (권장)
npx wrangler login

# 또는 API 토큰 사용
export CLOUDFLARE_API_TOKEN=your_token_here
```

### Step 2: 인증 확인

```bash
# 현재 로그인 상태 확인
npx wrangler whoami

# 프로젝트 목록 확인
npx wrangler pages project list
```

**예상 출력:**
```
 ⛅️ wrangler 4.67.0
Getting User settings...
👋 You are logged in as your-email@example.com
├ Account ID: abc123def456
└ Account Name: Your Account
```

---

## 3. Secret 설정

### 🔥 빠른 설정 스크립트

**Option A: 대화형 방식 (권장)**

각 Secret을 하나씩 설정합니다. 각 명령어 실행 시 값을 입력하라는 프롬프트가 나타납니다.

```bash
# Firebase 설정 (9개)
npx wrangler pages secret put FIREBASE_DATABASE_URL --project-name ur-live
npx wrangler pages secret put FIREBASE_API_KEY --project-name ur-live
npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live
npx wrangler pages secret put FIREBASE_AUTH_DOMAIN --project-name ur-live
npx wrangler pages secret put FIREBASE_STORAGE_BUCKET --project-name ur-live
npx wrangler pages secret put FIREBASE_MESSAGING_SENDER_ID --project-name ur-live
npx wrangler pages secret put FIREBASE_APP_ID --project-name ur-live
npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live
npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live

# JWT 설정 (2개)
npx wrangler pages secret put JWT_SECRET --project-name ur-live
npx wrangler pages secret put REFRESH_TOKEN_SECRET --project-name ur-live

# Toss Payments (1개) - ⚠️ 프로덕션 키로 교체!
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
# 개발: test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
# 프로덕션: live_gsk_... (Toss에서 발급받은 실제 키)

# 선택사항 - Kakao OAuth
npx wrangler pages secret put KAKAO_REST_API_KEY --project-name ur-live

# 선택사항 - Email (Resend)
npx wrangler pages secret put RESEND_API_KEY --project-name ur-live
npx wrangler pages secret put EMAIL_FROM --project-name ur-live
```

**Option B: 파이프라인 방식 (자동화)**

값을 직접 파이프로 전달합니다.

```bash
# 예시: JWT_SECRET 설정
echo "Nt1RPgjjhYEWqZ8j7rc8z8KazbJs4MjYRHqOT9POFYI=" | \
  npx wrangler pages secret put JWT_SECRET --project-name ur-live

# 예시: FIREBASE_API_KEY 설정
echo "AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8" | \
  npx wrangler pages secret put FIREBASE_API_KEY --project-name ur-live
```

### ⚠️ FIREBASE_PRIVATE_KEY 주의사항

**Private Key는 줄바꿈을 포함한 전체 문자열을 입력해야 합니다:**

```bash
# .dev.vars에서 값 복사 (따옴표 포함)
# "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"

npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live
# 프롬프트에서 위 값을 전체 붙여넣기 (줄바꿈 포함)
```

---

## 4. 설정 확인

### Secret 목록 확인

```bash
# 등록된 모든 Secret 확인
npx wrangler pages secret list --project-name ur-live
```

**예상 출력:**
```
┌──────────────────────────────┬──────────────────────────┐
│ Secret                       │ Created                  │
├──────────────────────────────┼──────────────────────────┤
│ FIREBASE_DATABASE_URL        │ 2026-03-01T05:00:00.000Z │
│ FIREBASE_API_KEY             │ 2026-03-01T05:01:00.000Z │
│ FIREBASE_PROJECT_ID          │ 2026-03-01T05:02:00.000Z │
│ JWT_SECRET                   │ 2026-03-01T05:10:00.000Z │
│ REFRESH_TOKEN_SECRET         │ 2026-03-01T05:11:00.000Z │
│ TOSS_SECRET_KEY              │ 2026-03-01T05:12:00.000Z │
└──────────────────────────────┴──────────────────────────┘
```

### 필수 Secret 체크리스트

다음 Secret이 모두 등록되었는지 확인하세요:

- [ ] FIREBASE_DATABASE_URL
- [ ] FIREBASE_API_KEY
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_AUTH_DOMAIN
- [ ] FIREBASE_STORAGE_BUCKET
- [ ] FIREBASE_MESSAGING_SENDER_ID
- [ ] FIREBASE_APP_ID
- [ ] FIREBASE_PRIVATE_KEY
- [ ] FIREBASE_CLIENT_EMAIL
- [ ] JWT_SECRET
- [ ] REFRESH_TOKEN_SECRET
- [ ] TOSS_SECRET_KEY

---

## 5. 프로덕션 배포

### ⚠️ 중요: Secret 설정 후 반드시 재배포!

**Cloudflare는 Secret 변경 시 자동으로 Worker를 재시작하지 않습니다.**  
따라서 Secret 설정 후 **반드시 재배포**해야 변경사항이 적용됩니다.

### Step 1: 빌드

```bash
npm run build
```

### Step 2: 배포

```bash
npx wrangler pages deploy dist --project-name ur-live --branch main --commit-dirty=true
```

### Step 3: 배포 확인

```bash
# 배포 완료 후 URL 확인
# Production: https://live.ur-team.com
# Preview: https://[deployment-id].ur-live.pages.dev

# Health Check
curl https://live.ur-team.com/api/health

# 환경 변수 테스트 (개발용 엔드포인트)
curl https://live.ur-team.com/api/test/env
```

---

## 6. GitHub Actions 설정 (선택사항)

자동 배포를 위한 GitHub Secrets 설정:

### GitHub Repository → Settings → Secrets and variables → Actions

```
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

### CLOUDFLARE_API_TOKEN 발급

1. Cloudflare Dashboard → My Profile → API Tokens
2. "Create Token" 클릭
3. "Edit Cloudflare Pages" 템플릿 선택
4. Permissions:
   - Account > Cloudflare Pages > Edit
5. "Continue to summary" → "Create Token"
6. 생성된 토큰 복사 → GitHub Secrets에 추가

### CLOUDFLARE_ACCOUNT_ID 확인

1. Cloudflare Dashboard
2. 우측 사이드바에서 "Account ID" 복사
3. GitHub Secrets에 추가

---

## 7. 문제 해결

### Secret이 적용되지 않을 때

```bash
# 1. Secret 재설정
npx wrangler pages secret delete SECRET_NAME --project-name ur-live
npx wrangler pages secret put SECRET_NAME --project-name ur-live

# 2. 캐시 클리어 후 재빌드
rm -rf dist .vite node_modules/.vite
npm run build

# 3. 강제 재배포
npx wrangler pages deploy dist --project-name ur-live --branch main --commit-dirty=true
```

### "You are not authenticated" 에러

```bash
# 재인증
npx wrangler logout
npx wrangler login
```

### "Project not found" 에러

```bash
# 프로젝트 목록 확인
npx wrangler pages project list

# 프로젝트명이 다른 경우 수정
npx wrangler pages secret put SECRET_NAME --project-name <실제-프로젝트명>
```

---

## 8. 보안 체크리스트

배포 전 확인사항:

- [ ] `.dev.vars` 파일이 `.gitignore`에 포함되어 있음
- [ ] `.dev.vars` 파일이 Git에 커밋되지 않음
- [ ] 프로덕션 환경에는 테스트 키 사용 안함 (Toss, Kakao 등)
- [ ] JWT Secret은 강력한 랜덤 키 사용 (32자 이상)
- [ ] FIREBASE_PRIVATE_KEY는 절대 공개 저장소에 푸시 안함
- [ ] 모든 Secret이 Cloudflare Pages에만 존재

---

## 9. 빠른 참조

### 자주 사용하는 명령어

```bash
# Secret 목록
npx wrangler pages secret list --project-name ur-live

# Secret 추가/수정
npx wrangler pages secret put SECRET_NAME --project-name ur-live

# Secret 삭제
npx wrangler pages secret delete SECRET_NAME --project-name ur-live

# 배포
npm run build && npx wrangler pages deploy dist --project-name ur-live

# 배포 목록
npx wrangler pages deployment list --project-name ur-live
```

---

## ✅ 완료 확인

모든 단계가 완료되면:

1. ✅ Wrangler 인증 완료
2. ✅ 모든 Secret 등록 완료 (최소 12개)
3. ✅ 빌드 성공
4. ✅ 프로덕션 배포 완료
5. ✅ Health Check API 정상 응답

**축하합니다! 프로덕션 배포가 완료되었습니다! 🎉**

---

**문제가 발생하면:**
- [Cloudflare Pages 문서](https://developers.cloudflare.com/pages/)
- [Wrangler CLI 문서](https://developers.cloudflare.com/workers/wrangler/)
- 프로젝트 저장소 Issues 참고

**작성일**: 2026-03-01  
**작성자**: UR Team Setup Assistant
