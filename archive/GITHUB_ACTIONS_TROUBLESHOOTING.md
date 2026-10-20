# GitHub Actions 빌드 실패 해결 가이드

**날짜**: 2026-03-01  
**프로젝트**: UR Live

---

## 🚨 빌드 실패 확인 방법

### 1️⃣ GitHub에서 실패 로그 확인

1. **GitHub 저장소 방문**:
   ```
   https://github.com/tobe2111/ur-live/actions
   ```

2. **실패한 워크플로우 클릭**:
   - 빨간색 X 표시가 있는 최신 실행 클릭
   - "Deploy to Cloudflare Pages" 워크플로우 확인

3. **실패한 단계 확인**:
   - 각 단계(Checkout, Install, Build, Deploy)를 클릭하여 로그 확인
   - 에러 메시지 찾기 (보통 `❌ ERROR:` 또는 `Error:` 로 시작)

---

## 🔍 일반적인 실패 원인

### 1. Cloudflare Secrets 미설정 ⚠️

**증상**:
```
Error: Missing required secret: CLOUDFLARE_API_TOKEN
```

**해결 방법**:

1. **Cloudflare Account ID 확인**:
   - Cloudflare Dashboard: https://dash.cloudflare.com
   - 오른쪽 사이드바에서 Account ID 복사 (16자리 hex)

2. **GitHub Secrets 설정**:
   ```
   https://github.com/tobe2111/ur-live/settings/secrets/actions
   ```

3. **New repository secret 클릭 후 추가**:
   - **Name**: `CLOUDFLARE_API_TOKEN`
   - **Secret**: `rgtHU2eZ-5APAkGCk-p9w4soYfWZoTiC4ysx3YUC`
   
   - **Name**: `CLOUDFLARE_ACCOUNT_ID`
   - **Secret**: `your-16-digit-account-id`

4. **Secrets 확인 워크플로우 실행**:
   ```
   https://github.com/tobe2111/ur-live/actions/workflows/check-secrets.yml
   ```
   - "Run workflow" 버튼 클릭 → 실행
   - 모든 체크가 ✅ 이면 성공

---

### 2. 빌드 타임아웃 (15분 초과)

**증상**:
```
Error: The operation was canceled.
Timeout after 15 minutes
```

**해결 방법**:

**옵션 A**: 타임아웃 증가 (`.github/workflows/deploy.yml`)
```yaml
- name: Build
  run: npm run build
  timeout-minutes: 20  # 15 → 20으로 변경
```

**옵션 B**: 빌드 최적화
```bash
# package.json의 build 스크립트 단순화
"build": "vite build && vite build --config vite.worker.config.ts"
# fix-routes.js와 force-update.js는 postbuild로 이동
```

---

### 3. 메모리 부족 (OOM - Out of Memory)

**증상**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**해결 방법**:

**방법 1**: 워크플로우에서 메모리 증가 (이미 설정됨)
```yaml
env:
  NODE_OPTIONS: --max-old-space-size=4096  # 4GB
```

**방법 2**: Vite 설정 최적화 (`vite.config.ts`)
```typescript
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'react-router': ['react-router-dom']
        }
      }
    }
  }
})
```

---

### 4. React 버전 충돌

**증상**:
```
❌ ERROR: Expected React 18.3.1, found 18.2.0
```

**해결 방법**:

1. **package.json 확인**:
   ```bash
   cd /home/user/webapp
   cat package.json | grep react
   ```

2. **React 버전 고정**:
   ```json
   {
     "dependencies": {
       "react": "18.3.1",
       "react-dom": "18.3.1"
     },
     "overrides": {
       "react": "18.3.1",
       "react-dom": "18.3.1"
     }
   }
   ```

3. **재설치**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   git add package-lock.json
   git commit -m "fix: Lock React to 18.3.1"
   git push
   ```

---

### 5. TypeScript/Vite 빌드 에러

**증상**:
```
src/index.tsx(2442,5): error TS1005: ';' expected.
```

**해결 방법**:

1. **로컬에서 타입 체크**:
   ```bash
   cd /home/user/webapp
   npm run type-check
   ```

2. **에러 위치 확인**:
   ```bash
   # 에러 라인 확인
   sed -n '2440,2445p' src/index.tsx
   ```

3. **수정 후 커밋**:
   ```bash
   git add src/index.tsx
   git commit -m "fix: Fix TypeScript error at line 2442"
   git push
   ```

---

### 6. Wrangler 배포 실패

**증상**:
```
Error: Failed to publish your Function. Got error: Authentication error
```

**해결 방법**:

1. **API Token 권한 확인**:
   - Cloudflare Dashboard → My Profile → API Tokens
   - Token에 다음 권한 있는지 확인:
     - `Account | Cloudflare Pages | Edit`
     - `Zone | Cloudflare Pages | Edit` (선택 사항)

2. **Token 재생성**:
   - 기존 Token 삭제
   - "Edit Cloudflare Workers" 템플릿 사용
   - 새 Token 복사
   - GitHub Secrets에서 `CLOUDFLARE_API_TOKEN` 업데이트

3. **재배포**:
   ```bash
   git commit --allow-empty -m "chore: Trigger redeploy"
   git push
   ```

---

## 🛠️ 디버그 도구

### 1. Secrets 검증 워크플로우 실행

```
https://github.com/tobe2111/ur-live/actions/workflows/check-secrets.yml
```
- "Run workflow" 클릭 → "Run workflow"
- 모든 체크가 ✅ 이면 Secrets 정상

### 2. 디버그 빌드 워크플로우 실행

```
https://github.com/tobe2111/ur-live/actions/workflows/debug-build.yml
```
- "Run workflow" 클릭 → "Run workflow"
- 실패한 단계의 로그 확인

### 3. 로컬에서 CI 환경 재현

```bash
cd /home/user/webapp

# Clean install (CI와 동일)
rm -rf node_modules package-lock.json
npm ci

# Run all build steps
npm run prebuild
NODE_OPTIONS='--max-old-space-size=4096' npm run build
npm run postbuild

# Check output
ls -lah dist/
```

---

## ✅ 해결 후 확인 사항

1. **빌드 성공 확인**:
   ```
   https://github.com/tobe2111/ur-live/actions
   ```
   - 녹색 체크 표시 ✅

2. **배포 URL 확인**:
   - 워크플로우 로그에서 배포 URL 찾기
   - 예: `https://abc123.ur-live.pages.dev`

3. **프로덕션 배포 확인**:
   ```
   https://live.ur-team.com
   ```
   - 최신 커밋이 반영되었는지 확인

---

## 📞 추가 도움이 필요하면

1. **GitHub Actions 로그 전체 복사**:
   - 실패한 워크플로우 → "..." 메뉴 → "View raw logs"
   - 전체 로그 복사

2. **다음 정보와 함께 공유**:
   - 에러 메시지
   - 실패한 단계 이름
   - 로그 전체 (또는 마지막 50줄)

---

**작성일**: 2026-03-01  
**문서 위치**: `/home/user/webapp/GITHUB_ACTIONS_TROUBLESHOOTING.md`
