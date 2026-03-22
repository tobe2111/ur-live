# 🔍 GitHub Actions 배포 상태 확인 및 해결 가이드

## 📋 Secret 키 확인 방법

### 1️⃣ GitHub 웹사이트에서 확인
```
1. https://github.com/tobe2111/ur-live 접속
2. Settings 탭 클릭
3. 좌측 메뉴 → Secrets and variables → Actions 클릭
4. Repository secrets 섹션 확인:
   - CLOUDFLARE_API_TOKEN ✅ (있어야 함)
   - CLOUDFLARE_ACCOUNT_ID ✅ (있어야 함)
```

### 2️⃣ Secret 값 확인 (만료 여부)
```
Secret이 존재하는지만 확인 가능하고, 실제 값은 보이지 않습니다.
만약 배포가 계속 실패한다면 Secret을 업데이트해야 합니다.
```

---

## 🚀 GitHub Actions 수동 트리거

### 방법 1: GitHub 웹 UI (가장 간단)
```
1. https://github.com/tobe2111/ur-live/actions 접속
2. 좌측 메뉴에서 "Deploy to Cloudflare Pages" 워크플로우 클릭
3. 우측 상단 "Run workflow" 버튼 클릭
4. Branch: main 선택
5. "Run workflow" 초록색 버튼 클릭
6. ⏳ 배포 시작 (약 3-5분 소요)
```

### 방법 2: 빈 커밋으로 트리거
```bash
git commit --allow-empty -m "chore: Trigger GitHub Actions deployment"
git push origin main
```

---

## 🔍 GitHub Actions 실행 로그 확인

### 1️⃣ 웹 UI에서 확인
```
1. https://github.com/tobe2111/ur-live/actions 접속
2. 최신 워크플로우 실행 클릭
3. "deploy" job 클릭
4. 각 단계별 로그 확인:
   ✅ Checkout code
   ✅ Setup Node.js
   ✅ Install dependencies
   ✅ Build project
   ❌ Deploy to Cloudflare Pages (여기서 실패 가능)
```

### 2️⃣ 일반적인 에러 메시지

#### 에러 1: API Token 인증 실패
```
Error: Authentication error [code: 10000]
```
**해결**: CLOUDFLARE_API_TOKEN 재생성 필요

#### 에러 2: Account ID 오류
```
Error: Unknown account
```
**해결**: CLOUDFLARE_ACCOUNT_ID 확인 필요

#### 에러 3: 빌드 실패
```
Error: Build failed
npm ERR! errno 137
```
**해결**: 메모리 부족 (NODE_OPTIONS 추가 필요)

#### 에러 4: Project not found
```
Error: Project 'ur-live' not found
```
**해결**: Cloudflare Pages 프로젝트 이름 확인

---

## 🔐 CLOUDFLARE_API_TOKEN 재생성 방법

### 1️⃣ Cloudflare에서 새 토큰 생성
```
1. https://dash.cloudflare.com 접속
2. 우측 상단 프로필 아이콘 클릭
3. "API Tokens" 클릭
4. "Create Token" 버튼 클릭
5. "Edit Cloudflare Workers" 템플릿 선택
6. 또는 "Custom token" 선택 후 아래 권한 설정:

   Permissions:
   - Account > Cloudflare Pages > Edit
   - Account > Account Settings > Read
   - User > User Details > Read

7. Account Resources:
   - Include > [Your Account Name] 선택

8. "Continue to summary" → "Create Token"
9. ⚠️ 토큰 복사 (한 번만 표시됨!)
```

### 2️⃣ CLOUDFLARE_ACCOUNT_ID 확인
```
1. https://dash.cloudflare.com 접속
2. 우측 사이드바에서 Account ID 확인
3. 또는 Workers & Pages → ur-live → 우측 사이드바
4. 형식: 32자 hex 문자열
   예: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
```

### 3️⃣ GitHub Secrets 업데이트
```
1. https://github.com/tobe2111/ur-live/settings/secrets/actions
2. CLOUDFLARE_API_TOKEN:
   - 우측 "Update" 버튼 클릭
   - 새 토큰 값 붙여넣기
   - "Update secret" 클릭

3. CLOUDFLARE_ACCOUNT_ID:
   - 우측 "Update" 버튼 클릭
   - Account ID 붙여넣기
   - "Update secret" 클릭
```

---

## ✅ 배포 성공 확인

### 1️⃣ GitHub Actions 로그
```
✅ Checkout code
✅ Setup Node.js
✅ Install dependencies
✅ Build project (2-3분)
✅ Deploy to Cloudflare Pages (1-2분)

마지막 출력:
✨ Success! Uploaded X files (Y.ZZ sec)
✨ Deployment complete! Take a peek over at https://xxxxx.ur-live.pages.dev
```

### 2️⃣ Cloudflare Pages 대시보드
```
1. https://dash.cloudflare.com → Workers & Pages → ur-live
2. Deployments 탭
3. 최신 배포 상태: 🟢 Success
4. Source: Branch: main (xxxxx)
```

### 3️⃣ 실제 사이트 확인
```bash
# 버전 확인
curl https://live.ur-team.com/version.json

# 캐시 무시하고 확인
curl -H "Cache-Control: no-cache" https://live.ur-team.com/version.json

# 브라우저에서 확인
# 1. Ctrl + Shift + R (캐시 무시 새로고침)
# 2. F12 → Console
# 3. fetch('/version.json').then(r => r.json()).then(console.log)
```

---

## 🔧 워크플로우 개선 (선택사항)

현재 워크플로우에 메모리 제한과 재시도 로직을 추가하려면 웹 UI에서 직접 수정해야 합니다:

### GitHub 웹 UI에서 수정
```
1. https://github.com/tobe2111/ur-live 접속
2. .github/workflows/main.yml 파일 열기
3. 우측 상단 연필 아이콘 (Edit) 클릭
4. 아래 내용으로 수정:
```

```yaml
      - name: Install dependencies
        run: npm ci
        env:
          NODE_OPTIONS: "--max-old-space-size=4096"

      - name: Build project
        run: npm run build
        env:
          NODE_VERSION: 20
          NODE_OPTIONS: "--max-old-space-size=4096"
          # ... (기존 환경변수들)

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=ur-live --branch=main
```

```
5. 하단 "Commit changes" 클릭
6. "Commit directly to the main branch" 선택
7. "Commit changes" 확인
```

---

## 📊 현재 배포 상태

| 방법 | 상태 | 설명 |
|------|------|------|
| **Cloudflare Git 통합** | ✅ 진행 중 | 커밋 da577596 배포 중 |
| **GitHub Actions** | ⏸️ 확인 필요 | Secret 확인 후 수동 트리거 |

---

## 🎯 권장 순서

### 즉시 실행:
1. ✅ Cloudflare Pages 대시보드에서 현재 배포 상태 확인
2. ✅ GitHub Actions → Run workflow 수동 트리거
3. ✅ 배포 로그 확인하여 실패 원인 파악

### Secret 문제 시:
1. 🔐 Cloudflare API Token 재생성
2. 🔐 GitHub Secrets 업데이트
3. 🔄 워크플로우 다시 실행

### 성공 후:
1. ✅ live.ur-team.com 업데이트 확인
2. ✅ 어드민 상품 관리 기능 테스트
3. ✅ 배포 자동화 정상 작동 확인

---

## 🔗 바로가기 링크

- **GitHub Actions**: https://github.com/tobe2111/ur-live/actions
- **GitHub Secrets**: https://github.com/tobe2111/ur-live/settings/secrets/actions
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Cloudflare API Tokens**: https://dash.cloudflare.com/profile/api-tokens
- **Production Site**: https://live.ur-team.com

---

**다음 단계**: 
1. GitHub Actions 페이지에서 "Run workflow" 수동 실행
2. 배포 로그 모니터링
3. 실패 시 에러 메시지 확인 및 Secret 업데이트
