# 🚀 자동 듀얼 배포 시스템 (KR + GLOBAL 동시 배포)

## 📅 2026-03-05

---

## ✅ **핵심 기능**

> **한 번 `git push`하면 KR과 GLOBAL 사이트가 자동으로 동시 배포됩니다!**

---

## 🎯 **워크플로우 개요**

```
git push origin main
         │
         v
┌─────────────────────────────────────────────────────────────┐
│          GitHub Actions (병렬 실행)                          │
└─────────────────────────────────────────────────────────────┘
         │
         ├─── 1. Lint & Type Check
         │
         v
    ┌────┴────┐
    │         │
    v         v
build-kr   build-global
(병렬)      (병렬)
    │         │
    v         v
deploy-kr  deploy-global
(병렬)      (병렬)
    │         │
    └────┬────┘
         │
         v
    Notification
    (Discord/Slack)
```

---

## 📋 **워크플로우 단계**

### 1️⃣ **Lint & Type Check** (공통)
- TypeScript 타입 체크
- ESLint 검사
- Naming conflicts 체크

### 2️⃣ **Build (병렬 실행)**

**KR 빌드**
```bash
npm run build:kr
→ Output: dist/
→ Region: KR
→ Bundle: ~12 MB
```

**GLOBAL 빌드**
```bash
npm run build:global
→ Output: dist-global/
→ Region: GLOBAL
→ Bundle: ~9.7 MB
```

### 3️⃣ **Deploy (병렬 실행)**

**KR 배포**
```bash
wrangler pages deploy dist \
  --project-name=ur-live-kr \
  --branch=main

→ URL: https://live.ur-team.com
```

**GLOBAL 배포**
```bash
wrangler pages deploy dist-global \
  --project-name=ur-live-global \
  --branch=main

→ URL: https://world.ur-team.com
```

### 4️⃣ **Verification (자동 확인)**
- KR 사이트 HTTP 200 체크
- GLOBAL 사이트 HTTP 200 체크
- 배포 상태 리포트 생성

### 5️⃣ **Notification (Discord/Slack)**
- 배포 성공/실패 알림
- 두 사이트 상태 요약
- 커밋 정보 및 작성자

---

## 🔧 **설정 방법**

### 1. GitHub Secrets 설정

필요한 Secrets를 GitHub Repository에 추가하세요:

```
Settings → Secrets and variables → Actions → New repository secret
```

| Secret Name | 설명 | 획득 방법 |
|-------------|------|-----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 토큰 | Cloudflare Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | Cloudflare Dashboard → Workers & Pages → Account ID |
| `DISCORD_WEBHOOK_URL` | Discord Webhook URL (선택) | Discord Server → Integrations → Webhooks |

#### Cloudflare API Token 권한

API Token 생성 시 다음 권한 필요:
- **Account**: `Cloudflare Pages:Edit`
- **Zone**: `Workers Scripts:Edit`

### 2. Cloudflare Pages 프로젝트 생성

두 개의 Cloudflare Pages 프로젝트를 생성하세요:

#### KR 프로젝트
```
Name: ur-live-kr
Build command: (비워두기 - GitHub Actions에서 처리)
Build output: (비워두기)
Production branch: main
Domain: live.ur-team.com
```

#### GLOBAL 프로젝트
```
Name: ur-live-global
Build command: (비워두기 - GitHub Actions에서 처리)
Build output: (비워두기)
Production branch: main
Domain: world.ur-team.com
```

**⚠️ 중요**: Cloudflare Pages에서 **Build command와 Output directory를 비워두세요**. GitHub Actions가 이미 빌드된 파일을 업로드합니다.

### 3. 환경 변수 설정 (각 프로젝트)

Cloudflare Dashboard에서 환경 변수 설정:

#### KR 프로젝트 (ur-live-kr)
```
Settings → Environment variables → Production
```
- Firebase 환경 변수 (8개)
- Kakao 환경 변수 (3개)
- TossPayments 환경 변수 (1개)

#### GLOBAL 프로젝트 (ur-live-global)
```
Settings → Environment variables → Production
```
- Firebase 환경 변수 (8개)
- Google OAuth 환경 변수 (1개)
- Stripe 환경 변수 (1개)

---

## 🚀 **사용 방법**

### 기본 배포 (양쪽 모두 배포)

```bash
# 1. 코드 수정
git add .
git commit -m "feat: Add new feature"

# 2. Push to main (자동 배포 시작!)
git push origin main

# 3. GitHub Actions 확인
# https://github.com/tobe2111/ur-live/actions

# 결과:
# ✅ KR 사이트 배포 (live.ur-team.com)
# ✅ GLOBAL 사이트 배포 (world.ur-team.com)
```

**예상 시간:**
```
Lint & Type Check: ~1분
Build (병렬):      ~2분
Deploy (병렬):     ~3분
─────────────────────
Total:             ~6분
```

### Pull Request 배포 (빌드만 실행)

```bash
# PR 생성 시 자동으로 빌드 테스트
git checkout -b feature/new-feature
git push origin feature/new-feature

# PR 생성 → GitHub Actions 실행
# - Lint & Type Check ✅
# - Build KR ✅
# - Build GLOBAL ✅
# - Deploy ❌ (main 브랜치가 아니므로 스킵)
```

---

## 📊 **배포 상태 확인**

### 1. GitHub Actions UI

```
Repository → Actions → Dual-Site Deployment
```

각 Job별 상태 확인:
- ✅ Lint & Type Check
- ✅ Build KR
- ✅ Build GLOBAL
- ✅ Deploy KR
- ✅ Deploy GLOBAL
- ✅ Notify

### 2. Deployment Summary

GitHub Actions 실행 후 Summary 탭에서 확인:

```markdown
## 🚀 Dual-Site Deployment Summary

### 📊 Deployment Status

| Site | Status | URL |
|------|--------|-----|
| 🇰🇷 KR Site | success | https://live.ur-team.com |
| 🌍 GLOBAL Site | success | https://world.ur-team.com |

### 📝 Commit Information
- **Message**: feat: Add new feature
- **Author**: tobe2111
- **SHA**: `a1b2c3d4`

### ⏱️ Deployment Time
- **Started**: 2026-03-05T10:30:00Z
```

### 3. Discord 알림 (설정한 경우)

```
🚀 Dual Deployment Successful
Both KR and GLOBAL sites deployed successfully

🇰🇷 KR Site
Status: success
URL: https://live.ur-team.com

🌍 GLOBAL Site
Status: success
URL: https://world.ur-team.com

📝 Commit: feat: Add new feature
👤 Author: tobe2111
🔗 Job URL: [링크]
```

---

## ⚠️ **에러 처리**

### Case 1: KR 배포 실패, GLOBAL 성공

```
⚠️ Partial Deployment
One site deployed, one failed

🇰🇷 KR Site: failure
🌍 GLOBAL Site: success

→ KR 사이트만 수동으로 재배포 필요
```

**대응:**
```bash
# KR만 재배포
cd /home/user/webapp
npm run build:kr
npx wrangler pages deploy dist --project-name=ur-live-kr
```

### Case 2: 양쪽 모두 실패

```
🚨 Dual Deployment Failed
Both deployments failed

→ 빌드 로그 확인 필요
→ 환경 변수 확인
→ Cloudflare API 토큰 확인
```

**대응:**
1. GitHub Actions 로그 확인
2. 로컬에서 빌드 테스트
   ```bash
   npm run build:kr
   npm run build:global
   ```
3. Cloudflare Dashboard에서 프로젝트 상태 확인

### Case 3: 자동 Rollback (실패 시)

워크플로우에 자동 rollback이 포함되어 있습니다:

```yaml
rollback:
  if: failure()
  steps:
    - Rollback KR if failed
    - Rollback GLOBAL if failed
```

**동작:**
- 배포 실패 감지
- 이전 배포 버전으로 자동 롤백
- Discord 알림 전송

---

## 🔄 **배포 워크플로우 비교**

### Before (수동 배포)

```bash
# KR 배포
npm run build:kr
npx wrangler pages deploy dist --project-name=ur-live

# GLOBAL 배포
npm run build:global
npx wrangler pages deploy dist-global --project-name=ur-live-global

# 총 소요 시간: ~10분 (수동 작업 포함)
# 실수 가능성: 높음
```

### After (자동 배포) ✅

```bash
git push origin main

# 총 소요 시간: ~6분 (자동)
# 실수 가능성: 없음
# 병렬 실행: KR + GLOBAL 동시
# 자동 검증: HTTP 200 체크
# 알림: Discord/Slack
```

---

## 📈 **성능 최적화**

### 병렬 실행 최적화

```yaml
build-kr:
  needs: [lint-and-typecheck]  # lint 후 즉시 시작

build-global:
  needs: [lint-and-typecheck]  # lint 후 즉시 시작
  # build-kr과 동시 실행 (병렬)

deploy-kr:
  needs: [build-kr]  # KR 빌드 완료 후 즉시 배포

deploy-global:
  needs: [build-global]  # GLOBAL 빌드 완료 후 즉시 배포
  # deploy-kr과 동시 실행 (병렬)
```

**효과:**
- 순차 실행: ~12분
- 병렬 실행: ~6분
- **시간 절감: 50%**

### Artifact 캐싱

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: dist-kr
    path: dist/
    retention-days: 7  # 7일간 보관

- uses: actions/download-artifact@v4
  with:
    name: dist-kr
    path: dist/
```

**효과:**
- 빌드와 배포 Job 분리
- 빌드 결과 재사용 가능
- 배포 실패 시 재배포 빠름

---

## 🎯 **추가 기능 (선택 사항)**

### 1. Lighthouse Performance 체크

```yaml
# .github/workflows/dual-deploy.yml에 추가
performance-check:
  runs-on: ubuntu-latest
  needs: [deploy-kr, deploy-global]
  steps:
    - name: Run Lighthouse for KR
      run: |
        npm install -g @lhci/cli
        lhci autorun --collect.url=https://live.ur-team.com
    
    - name: Run Lighthouse for GLOBAL
      run: |
        lhci autorun --collect.url=https://world.ur-team.com
```

### 2. Slack 알림

```yaml
- name: Send Slack notification
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "🚀 Deployment successful",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*KR Site*: https://live.ur-team.com\n*GLOBAL Site*: https://world.ur-team.com"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 3. E2E 테스트 (Playwright)

```yaml
e2e-test:
  runs-on: ubuntu-latest
  needs: [deploy-kr, deploy-global]
  steps:
    - name: Install Playwright
      run: npm install -g @playwright/test
    
    - name: Run E2E tests (KR)
      run: npx playwright test --base-url=https://live.ur-team.com
    
    - name: Run E2E tests (GLOBAL)
      run: npx playwright test --base-url=https://world.ur-team.com
```

---

## 🔒 **보안 고려사항**

### 1. API Token 보호
- ✅ GitHub Secrets 사용
- ✅ Repository 접근 제한
- ✅ Token 권한 최소화

### 2. 환경 변수 보호
- ✅ Cloudflare에서만 관리
- ✅ GitHub Actions에서는 빌드만 수행
- ✅ 민감 정보 노출 방지

### 3. Deployment 보호
- ✅ main 브랜치만 배포
- ✅ PR은 빌드만 실행
- ✅ 자동 rollback 지원

---

## 📝 **체크리스트**

배포 전 확인사항:

- [ ] GitHub Secrets 설정 완료
  - [ ] `CLOUDFLARE_API_TOKEN`
  - [ ] `CLOUDFLARE_ACCOUNT_ID`
  - [ ] `DISCORD_WEBHOOK_URL` (선택)
  
- [ ] Cloudflare Pages 프로젝트 생성
  - [ ] `ur-live-kr` 프로젝트
  - [ ] `ur-live-global` 프로젝트
  
- [ ] 환경 변수 설정
  - [ ] KR 프로젝트 (12개)
  - [ ] GLOBAL 프로젝트 (10개)
  
- [ ] 도메인 연결
  - [ ] `live.ur-team.com` → ur-live-kr
  - [ ] `world.ur-team.com` → ur-live-global
  
- [ ] 워크플로우 파일 커밋
  - [ ] `.github/workflows/dual-deploy.yml`

---

## 🎉 **완료!**

이제 한 번 `git push`하면 두 사이트가 자동으로 배포됩니다!

```bash
git push origin main

# 6분 후...
# ✅ live.ur-team.com (KR) 배포 완료
# ✅ world.ur-team.com (GLOBAL) 배포 완료
```

---

## 📚 **관련 문서**

- `CURRENT_ARCHITECTURE_ANALYSIS.md` - 아키텍처 분석
- `REGIONAL_DIFFERENCES_SUMMARY.md` - Region 관리 요약
- `REGIONAL_DIFFERENCES_DIAGRAM.md` - 시스템 다이어그램
- `CLOUDFLARE_DUAL_SITE_SETUP.md` - Cloudflare 설정 가이드
- `DUAL_SITE_EXECUTION_GUIDE.md` - 실행 가이드

---

**📍 워크플로우 파일**: `.github/workflows/dual-deploy.yml`
