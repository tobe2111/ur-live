# 프로젝트 이전 가이드 (다른 젠스파크 계정으로 복사)

## 📊 프로젝트 규모
- **전체 크기**: 508MB
- **소스 코드**: 58MB (node_modules 제외)
- **Git 히스토리**: 33MB
- **파일 수**: 965개 (node_modules 제외)
- **node_modules**: 450MB (재설치 가능)
- **.wrangler**: 4.8MB (빌드 캐시, 제외 가능)

---

## ✅ 방법 1: GitHub를 통한 이전 (추천 ⭐)

### 장점
- ✅ Git 히스토리 보존 (1,076 커밋)
- ✅ 가장 안전하고 신뢰성 높음
- ✅ 협업 가능
- ✅ 버전 관리 유지
- ✅ 용량 제한 없음

### 단계

#### 1️⃣ 현재 프로젝트를 GitHub에 푸시 (이미 완료)
```bash
# 현재 상태 확인
cd /home/user/webapp
git status
git log --oneline | head -10

# GitHub 저장소: https://github.com/tobe2111/ur-live
# 이미 푸시 완료되어 있음
```

#### 2️⃣ 새 젠스파크 계정에서 clone
```bash
# 새 젠스파크 AI Developer 프로젝트에서 실행
cd /home/user
git clone https://github.com/tobe2111/ur-live.git webapp-copy

# 또는 새 이름으로
git clone https://github.com/tobe2111/ur-live.git my-new-project

cd webapp-copy
```

#### 3️⃣ 의존성 설치
```bash
npm install
# 약 2-3분 소요 (450MB 다운로드)
```

#### 4️⃣ 환경 설정
```bash
# .dev.vars 파일 생성 (로컬 개발용)
cat > .dev.vars << 'EOF'
JWT_SECRET=your-jwt-secret-here
TOSS_SECRET_KEY=your-toss-secret
TOSS_CLIENT_KEY=your-toss-client-key
RESEND_API_KEY=your-resend-key
KAKAO_JS_KEY=your-kakao-key
DISCORD_WEBHOOK_URL=your-discord-webhook
EOF

# Cloudflare 환경변수는 배포 시 별도 설정
```

#### 5️⃣ 데이터베이스 마이그레이션
```bash
# D1 데이터베이스 생성
npx wrangler d1 create webapp-production

# wrangler.toml에서 database_id 수정
# 마이그레이션 실행
npx wrangler d1 migrations apply webapp-production --local
```

#### 6️⃣ 빌드 및 실행
```bash
npm run build
pm2 start ecosystem.config.cjs
```

---

## 방법 2: ProjectBackup 도구 사용

### 장점
- ✅ 원클릭 백업
- ✅ tar.gz 압축 (약 30-50MB)
- ✅ AI Drive 저장
- ✅ Git 히스토리 포함

### 단계

#### 1️⃣ 백업 생성
```bash
# ProjectBackup 도구 실행 (젠스파크 내장)
# 자동으로 /home/user/webapp을 백업하고 AI Drive에 업로드
```

ProjectBackup 도구는 다음을 수행합니다:
- `/home/user/webapp` 전체를 tar.gz로 압축
- `.git` 디렉토리 포함 (Git 히스토리 보존)
- `node_modules`, `.wrangler` 제외 (재설치 가능)
- AI Drive (`/mnt/aidrive`)에 업로드
- 다운로드 URL 제공

#### 2️⃣ 새 계정에서 다운로드 & 복원
```bash
# 새 젠스파크 계정에서
cd /home/user

# tar.gz 다운로드 (URL은 백업 시 제공)
curl -o webapp-backup.tar.gz "https://download-url-here"

# 압축 해제
tar -xzf webapp-backup.tar.gz

# 의존성 설치
cd webapp
npm install
```

---

## 방법 3: 수동 파일 복사 (비추천 ⚠️)

### 주의사항
- ⚠️ 파일이 많아서 복사/붙여넣기 어려움
- ⚠️ Git 히스토리 손실 가능
- ⚠️ 권한 문제 발생 가능
- ⚠️ node_modules 복사 시 시간 오래 걸림

### 만약 수동으로 하려면
```bash
# 압축 생성 (node_modules 제외)
cd /home/user
tar -czf webapp-source.tar.gz \
  --exclude='webapp/node_modules' \
  --exclude='webapp/.wrangler' \
  --exclude='webapp/.git' \
  webapp/

# 크기: 약 10-20MB

# 새 계정으로 파일 전송 (방법은 상황에 따라 다름)
# - AI Drive 사용
# - GitHub Gist
# - 외부 저장소
```

---

## 🎯 추천 방법: GitHub (방법 1)

**이유**:
1. ✅ **이미 GitHub에 푸시됨**: https://github.com/tobe2111/ur-live
2. ✅ **Git 히스토리 보존**: 1,076 커밋 모두 유지
3. ✅ **협업 가능**: 여러 젠스파크 계정에서 동시 작업
4. ✅ **안전성**: GitHub이 백업 관리
5. ✅ **속도**: clone + npm install만 하면 끝

---

## 📋 새 계정에서 설정해야 할 것

### 1️⃣ Cloudflare 설정
```bash
# Cloudflare API 인증
npx wrangler login

# 또는 API 토큰 사용
npx wrangler whoami
```

### 2️⃣ D1 데이터베이스
```bash
# 새 D1 데이터베이스 생성
npx wrangler d1 create webapp-production

# 출력된 database_id를 wrangler.toml에 복사
# 마이그레이션 실행
npx wrangler d1 migrations apply webapp-production --remote
```

### 3️⃣ KV Namespaces
```bash
# SESSION_KV
npx wrangler kv:namespace create SESSION_KV
npx wrangler kv:namespace create SESSION_KV --preview

# CACHE_KV
npx wrangler kv:namespace create CACHE_KV
npx wrangler kv:namespace create CACHE_KV --preview

# wrangler.toml에 ID 복사
```

### 4️⃣ R2 Bucket
```bash
# 이미지 저장소
npx wrangler r2 bucket create ur-live-images
```

### 5️⃣ 환경변수 (Cloudflare Pages Secrets)
```bash
# 필수 환경변수 14개 설정
npx wrangler pages secret put JWT_SECRET --project-name ur-live
npx wrangler pages secret put TOSS_SECRET_KEY --project-name ur-live
npx wrangler pages secret put TOSS_CLIENT_KEY --project-name ur-live
npx wrangler pages secret put KAKAO_JS_KEY --project-name ur-live
npx wrangler pages secret put DISCORD_WEBHOOK_URL --project-name ur-live
# ... 등
```

### 6️⃣ GitHub 설정 (선택)
```bash
# 새 저장소로 푸시하려면
git remote set-url origin https://github.com/new-account/new-repo.git
git push -u origin main
```

---

## 🔄 전체 이전 프로세스 (GitHub 방식)

### 현재 계정 (tobe2111)
```bash
# 1. 최종 커밋 & 푸시 (이미 완료)
cd /home/user/webapp
git add -A
git commit -m "Final backup before migration"
git push origin main

# 2. GitHub 저장소 확인
# https://github.com/tobe2111/ur-live
```

### 새 젠스파크 계정
```bash
# 1. 프로젝트 clone
cd /home/user
git clone https://github.com/tobe2111/ur-live.git webapp
cd webapp

# 2. 의존성 설치
npm install

# 3. Cloudflare 설정
npx wrangler login
npx wrangler d1 create webapp-production

# 4. 환경변수 설정
# wrangler.toml 수정 (database_id, KV namespaces)
# .dev.vars 생성 (로컬 개발용)

# 5. 마이그레이션
npx wrangler d1 migrations apply webapp-production --local
npx wrangler d1 migrations apply webapp-production --remote

# 6. 빌드 & 실행
npm run build
pm2 start ecosystem.config.cjs

# 7. 테스트
curl http://localhost:3000
```

---

## ⚠️ 주의사항

### 1. 민감 정보 처리
- ❌ `.dev.vars`는 Git에 포함 안 됨 (.gitignore)
- ❌ API 키, 시크릿은 수동으로 재설정 필요
- ✅ `wrangler.toml`은 포함됨 (database_id는 변경 필요)

### 2. 데이터베이스
- ❌ D1 데이터는 자동으로 이전 안 됨
- ✅ 마이그레이션 스크립트는 포함됨
- ✅ 새 계정에서 마이그레이션 재실행 필요

### 3. KV 데이터
- ❌ KV 데이터는 자동 이전 안 됨
- ✅ 세션은 새로 생성됨 (사용자 재로그인 필요)

### 4. R2 이미지
- ❌ R2 이미지는 자동 이전 안 됨
- ✅ 필요 시 수동으로 복사
```bash
# R2 복사 (wrangler CLI)
npx wrangler r2 object get IMAGES/path/to/file.jpg --remote
npx wrangler r2 object put IMAGES/path/to/file.jpg --file=file.jpg --remote
```

---

## 💡 베스트 프랙티스

### 1. GitHub 저장소 사용 (추천)
- 모든 계정에서 동일한 저장소 clone
- 브랜치로 환경 분리 (main, dev, staging)
- 협업 가능

### 2. 환경별 설정 분리
```bash
# wrangler.toml
[env.production]
name = "ur-live-prod"
d1_databases = [
  { binding = "DB", database_name = "prod-db", database_id = "xxx" }
]

[env.staging]
name = "ur-live-staging"
d1_databases = [
  { binding = "DB", database_name = "staging-db", database_id = "yyy" }
]
```

### 3. 문서화
- `README.md`에 설정 방법 명시
- 환경변수 목록 문서화
- 마이그레이션 순서 기록

---

## 🚀 빠른 시작 (새 계정)

```bash
# 1분 만에 시작하기
git clone https://github.com/tobe2111/ur-live.git webapp
cd webapp
npm install
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000
```

**배포는 별도로**:
```bash
# Cloudflare 설정 후
npm run deploy:prod
```

---

## 📞 문제 해결

### Q1: Git clone이 느려요
```bash
# shallow clone (히스토리 제외)
git clone --depth 1 https://github.com/tobe2111/ur-live.git webapp
```

### Q2: npm install이 실패해요
```bash
# 캐시 삭제 후 재시도
rm -rf node_modules package-lock.json
npm install
```

### Q3: Cloudflare 인증 오류
```bash
# API 토큰 확인
npx wrangler whoami

# 재로그인
npx wrangler logout
npx wrangler login
```

---

## ✅ 결론

**가장 좋은 방법**: 
1. ✅ **GitHub에서 clone** (이미 푸시되어 있음)
2. ✅ **npm install로 의존성 설치**
3. ✅ **Cloudflare 리소스 재생성**
4. ✅ **환경변수 재설정**

**소요 시간**: 약 10-15분

**GitHub 저장소**: https://github.com/tobe2111/ur-live

---

**질문이 있으시면 말씀해주세요!** 🚀
