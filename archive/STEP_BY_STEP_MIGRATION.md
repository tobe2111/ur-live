# 프로젝트 복사 완벽 가이드 (초보자용)

## 🎯 목표
현재 젠스파크 계정의 UR LIVE 프로젝트를 → 다른 젠스파크 계정으로 완벽하게 복사하기

---

## 📋 전체 과정 (3단계)

```
[현재 계정]                    [GitHub]                    [새 계정]
   코드 개발 완료          →    코드 저장          →      코드 다운로드
   (지금 여기!)                (중간 저장소)              (복사할 곳)
```

---

## 🟢 STEP 1: 현재 계정에서 GitHub에 업로드 (5분)

### 1-1. 현재 상태 확인 ✅

```bash
cd /home/user/webapp
git status
```

**현재 상태**:
- ✅ 모든 변경사항 커밋 완료
- ⏳ GitHub에 푸시 대기 중 (8개 커밋)
- ✅ Git 저장소 연결됨: https://github.com/tobe2111/ur-live

---

### 1-2. GitHub에 최종 업로드 🚀

```bash
cd /home/user/webapp
git push origin main
```

**예상 결과**:
```
Enumerating objects: 150, done.
Counting objects: 100% (150/150), done.
Compressing objects: 100% (75/75), done.
Writing objects: 100% (100/100), 50.00 KiB | 2.50 MiB/s, done.
Total 100 (delta 50), reused 0 (delta 0)
To https://github.com/tobe2111/ur-live.git
   abc1234..def5678  main -> main
```

**✅ 성공 표시**: "main -> main" 메시지가 보이면 성공!

---

### 1-3. GitHub에서 코드 확인 🔍

**브라우저로 접속**:
1. https://github.com/tobe2111/ur-live 열기
2. 파일 목록 확인:
   - `src/` 폴더
   - `package.json`
   - `wrangler.toml`
   - `README.md`
   - 등등...

**✅ 모든 파일이 보이면 성공!**

---

## 🟡 STEP 2: 새 젠스파크 계정에서 다운로드 (10분)

### 2-1. 새 AI Developer 프로젝트 생성 🆕

1. **새 젠스파크 계정 로그인**
2. **AI Developer 탭** 클릭
3. **Create New Project** 클릭
4. 프로젝트 이름 입력 (예: `ur-live-copy`)
5. **Create** 클릭

**✅ 새 프로젝트가 생성되고 터미널이 보이면 성공!**

---

### 2-2. GitHub에서 코드 다운로드 📥

**새 프로젝트 터미널에서 실행**:

```bash
# 1. 홈 디렉토리로 이동
cd /home/user

# 2. GitHub에서 프로젝트 다운로드 (clone)
git clone https://github.com/tobe2111/ur-live.git webapp

# 3. 프로젝트 폴더로 이동
cd webapp

# 4. 파일 확인
ls -la
```

**예상 출력**:
```
Cloning into 'webapp'...
remote: Enumerating objects: 5000, done.
remote: Counting objects: 100% (5000/5000), done.
remote: Compressing objects: 100% (3000/3000), done.
remote: Total 5000 (delta 2000), reused 5000 (delta 2000)
Receiving objects: 100% (5000/5000), 50.00 MiB | 10.00 MiB/s, done.
Resolving deltas: 100% (2000/2000), done.
```

**✅ "Resolving deltas" 메시지가 보이면 성공!**

---

### 2-3. 필요한 라이브러리 설치 📦

```bash
# 프로젝트 폴더에 있는지 확인
pwd
# 출력: /home/user/webapp

# npm 라이브러리 설치 (2-3분 소요)
npm install
```

**예상 출력**:
```
added 450 packages, and audited 451 packages in 2m

150 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**✅ "found 0 vulnerabilities" 메시지가 보이면 성공!**

---

### 2-4. 기본 환경 파일 생성 📝

```bash
# .dev.vars 파일 생성 (로컬 개발용)
cat > .dev.vars << 'EOF'
JWT_SECRET=temp-secret-change-later
TOSS_SECRET_KEY=test_sk_
TOSS_CLIENT_KEY=test_ck_
KAKAO_JS_KEY=temp-kakao-key
DISCORD_WEBHOOK_URL=
RESEND_API_KEY=
EOF

# 파일 확인
cat .dev.vars
```

**✅ 파일 내용이 출력되면 성공!**

---

## 🔵 STEP 3: Cloudflare 설정 (15분)

### 3-1. Cloudflare 로그인 🔐

```bash
# Cloudflare 로그인
npx wrangler login
```

**브라우저 팝업**:
1. Cloudflare 로그인 페이지 열림
2. 계정 로그인
3. **Allow** 버튼 클릭

**터미널 확인**:
```bash
# 로그인 확인
npx wrangler whoami
```

**예상 출력**:
```
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email 'your-email@example.com'!
```

**✅ 이메일이 보이면 성공!**

---

### 3-2. D1 데이터베이스 생성 🗄️

```bash
# 새 데이터베이스 생성
npx wrangler d1 create ur-live-db
```

**예상 출력**:
```
✅ Successfully created DB 'ur-live-db'!

[[d1_databases]]
binding = "DB"
database_name = "ur-live-db"
database_id = "abc123-def456-ghi789"
                    ↑↑↑ 이 ID를 복사하세요!
```

**✅ database_id가 출력되면 성공! (메모장에 복사)**

---

### 3-3. wrangler.toml 파일 수정 ✏️

```bash
# wrangler.toml 파일 열기
nano wrangler.toml
```

**수정할 부분 찾기** (Ctrl+W로 검색: `d1_databases`):

**변경 전**:
```toml
[[d1_databases]]
binding = "DB"
database_name = "toss-live-commerce-db"
database_id = "d9530ba6-7a26-4c02-9295-3ce5aef112a3"  ← 이 줄 수정
```

**변경 후**:
```toml
[[d1_databases]]
binding = "DB"
database_name = "ur-live-db"
database_id = "abc123-def456-ghi789"  ← 방금 복사한 ID 붙여넣기
```

**저장 방법**:
- Ctrl+O (저장)
- Enter (확인)
- Ctrl+X (종료)

**✅ "Wrote 50 lines" 메시지가 보이면 성공!**

---

### 3-4. 데이터베이스 테이블 생성 🏗️

```bash
# 로컬 데이터베이스에 테이블 생성
npx wrangler d1 migrations apply ur-live-db --local
```

**예상 출력**:
```
🌀 Executing on local database ur-live-db (abc123-def456-ghi789) from .wrangler/state/v3/d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.

┌─────────────────────────────────┬─────────┐
│ Name                            │ Status  │
├─────────────────────────────────┼─────────┤
│ 0001_create_users.sql           │ Success │
│ 0002_create_products.sql        │ Success │
│ 0003_create_orders.sql          │ Success │
│ ... (총 20개 마이그레이션)         │         │
└─────────────────────────────────┴─────────┘
```

**✅ 모두 "Success"면 성공!**

---

### 3-5. KV 네임스페이스 생성 🗂️

```bash
# SESSION_KV 생성
npx wrangler kv:namespace create SESSION_KV
```

**예상 출력**:
```
✨ Success!
Add the following to your wrangler.toml:
[[kv_namespaces]]
binding = "SESSION_KV"
id = "xyz789abc123"
      ↑↑↑ 이 ID를 복사하세요!
```

**메모장에 복사**: `SESSION_KV = xyz789abc123`

```bash
# CACHE_KV 생성
npx wrangler kv:namespace create CACHE_KV
```

**예상 출력**:
```
✨ Success!
Add the following to your wrangler.toml:
[[kv_namespaces]]
binding = "CACHE_KV"
id = "def456ghi789"
      ↑↑↑ 이 ID를 복사하세요!
```

**메모장에 복사**: `CACHE_KV = def456ghi789`

---

### 3-6. wrangler.toml에 KV ID 추가 ✏️

```bash
nano wrangler.toml
```

**수정할 부분 찾기** (Ctrl+W로 검색: `kv_namespaces`):

**변경 전**:
```toml
[[kv_namespaces]]
binding = "SESSION_KV"
id = "3b522e69651f4d4f84a0cdf9430eeb72"  ← 이 줄 수정

[[kv_namespaces]]
binding = "CACHE_KV"
id = "25ecc9ce2c464dd59edf5eb7d5fd1a10"  ← 이 줄 수정
```

**변경 후**:
```toml
[[kv_namespaces]]
binding = "SESSION_KV"
id = "xyz789abc123"  ← 방금 복사한 SESSION_KV ID

[[kv_namespaces]]
binding = "CACHE_KV"
id = "def456ghi789"  ← 방금 복사한 CACHE_KV ID
```

**저장**: Ctrl+O, Enter, Ctrl+X

---

### 3-7. R2 버킷 생성 (이미지 저장소) 🖼️

```bash
# R2 버킷 생성
npx wrangler r2 bucket create ur-live-images
```

**예상 출력**:
```
Created bucket 'ur-live-images' with default storage class set to Standard.
```

**✅ "Created bucket" 메시지가 보이면 성공!**

---

## 🟢 STEP 4: 빌드 & 실행 테스트 (5분)

### 4-1. 프로젝트 빌드 🔨

```bash
cd /home/user/webapp
npm run build
```

**예상 출력** (약 30초-1분):
```
> ur-live@1.0.0 build
> vite build

vite v5.0.0 building for production...
✓ 150 modules transformed.
dist/index.html                  2.5 kB
dist/assets/index-abc123.js    500.0 kB
dist/assets/index-abc123.css    50.0 kB

✓ built in 15s
```

**✅ "built in" 메시지가 보이면 성공!**

---

### 4-2. 개발 서버 실행 🚀

```bash
# PM2로 서버 시작
pm2 start ecosystem.config.cjs
```

**예상 출력**:
```
[PM2] Starting /home/user/webapp/ecosystem.config.cjs in fork_mode
[PM2] Done.
┌────┬────────┬─────────┬──────┬─────┬──────────┐
│ id │ name   │ mode    │ ↺    │ status │ cpu │ memory │
├────┼────────┼─────────┼──────┼─────┼──────────┤
│ 0  │ webapp │ fork    │ 0    │ online │ 0%  │ 50mb   │
└────┴────────┴─────────┴──────┴─────┴──────────┘
```

**✅ status가 "online"이면 성공!**

---

### 4-3. 서버 테스트 ✅

```bash
# 서버 응답 확인
curl http://localhost:3000
```

**예상 출력**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>UR LIVE</title>
    ...
```

**✅ HTML 코드가 출력되면 성공!**

---

### 4-4. 공개 URL 확인 🌐

```bash
# 공개 URL 생성 (젠스파크 도구)
# 자동으로 실행됨, 또는:
```

**브라우저에서 접속**:
- 젠스파크 AI Developer 페이지에서 **Preview** 버튼 클릭
- 또는 제공된 URL로 접속 (예: `https://3000-xxxxxxxx.e2b.dev`)

**✅ 웹사이트가 로드되면 성공!**

---

## 🎉 완료! 축하합니다!

### ✅ 체크리스트

- [x] **STEP 1**: GitHub에 코드 업로드 완료
- [x] **STEP 2**: 새 계정에서 코드 다운로드 완료
- [x] **STEP 3**: Cloudflare 설정 완료
- [x] **STEP 4**: 빌드 & 실행 성공

---

## 🔄 다음 단계 (선택사항)

### 프로덕션 배포 (Cloudflare Pages)

```bash
# 1. Cloudflare Pages 프로젝트 생성
npx wrangler pages project create ur-live-new

# 2. 배포
npm run deploy:prod
```

---

## ⚠️ 문제 해결

### Q1: git clone이 실패해요
```bash
# 오류 메시지: "fatal: could not read Username"
# 해결: HTTPS URL 사용
git clone https://github.com/tobe2111/ur-live.git webapp
```

### Q2: npm install이 느려요
```bash
# 정상입니다. 2-3분 정도 기다리세요.
# 450개 패키지를 다운로드하는 중...
```

### Q3: wrangler login이 안 돼요
```bash
# 브라우저가 안 열리면 수동 로그인:
npx wrangler login --browser=false
# URL이 출력되면 복사해서 브라우저에 붙여넣기
```

### Q4: PM2 실행이 안 돼요
```bash
# PM2가 없으면 설치:
npm install -g pm2

# 또는 직접 실행 (테스트용):
npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

---

## 📞 도움이 필요하면

**에러 메시지를 복사해서 보여주세요!**

예:
- "git clone할 때 이런 에러가 났어요: ..."
- "npm install 중에 멈췄어요"
- "wrangler.toml을 어떻게 수정하나요?"

---

**이제 시작할 준비가 되셨나요?** 🚀

다음 중 선택하세요:
1. **"STEP 1부터 시작해줘"** → 현재 계정에서 GitHub 푸시
2. **"설명만 보고 직접 할게요"** → 이 가이드 참고
3. **"특정 단계가 궁금해요"** → 원하는 부분 질문
