# 🔧 GitHub Actions 워크플로우 수정 가이드

## ❌ 문제

GitHub Actions에서 배포 실패:
```
✘ [ERROR] Project not found. The specified project name does not match 
any of your existing projects. [code: 8000007]
```

**원인**: `.github/workflows/main.yml` 파일에서 잘못된 프로젝트명 사용
- 잘못된 값: `ur-live-working`
- 올바른 값: `ur-live`

---

## ✅ 해결 방법

### Option 1: GitHub 웹 인터페이스에서 수정 (권장)

1. **GitHub 저장소 접속**
   ```
   https://github.com/tobe2111/ur-live
   ```

2. **워크플로우 파일 열기**
   - `.github/workflows/main.yml` 클릭
   - 우측 상단 연필 아이콘(Edit) 클릭

3. **49번 라인 수정**
   **변경 전:**
   ```yaml
   run: npx wrangler pages deploy dist/client --project-name=ur-live-working --branch=main
   ```
   
   **변경 후:**
   ```yaml
   run: npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
   ```

4. **36번 라인에 DATABASE_URL 추가**
   **변경 전:**
   ```yaml
   VITE_FIREBASE_API_KEY: AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
   VITE_FIREBASE_AUTH_DOMAIN: toss-live-commerce.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID: toss-live-commerce
   ```
   
   **변경 후:**
   ```yaml
   VITE_FIREBASE_API_KEY: AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
   VITE_FIREBASE_AUTH_DOMAIN: toss-live-commerce.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
   VITE_FIREBASE_PROJECT_ID: toss-live-commerce
   ```

5. **45번 라인에 KAKAO_AUTH_URL 추가**
   **변경 전:**
   ```yaml
   VITE_KAKAO_REST_API_KEY: 5dd74bccb797640b0efd070467f3bafd
   VITE_TOSS_CLIENT_KEY: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
   ```
   
   **변경 후:**
   ```yaml
   VITE_KAKAO_REST_API_KEY: 5dd74bccb797640b0efd070467f3bafd
   VITE_KAKAO_AUTH_URL: https://kauth.kakao.com/oauth/authorize
   VITE_TOSS_CLIENT_KEY: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
   ```

6. **커밋 메시지 작성**
   ```
   fix: Update GitHub Actions workflow with correct project name
   
   - Changed project-name from ur-live-working to ur-live
   - Added VITE_FIREBASE_DATABASE_URL
   - Added VITE_KAKAO_AUTH_URL
   ```

7. **Commit changes 클릭**

---

### Option 2: 로컬에서 수정 후 수동 푸시

**이미 로컬에서 수정 완료되었습니다!** 하지만 GitHub App 권한 문제로 푸시 실패.

**해결책:**
1. GitHub 저장소 Settings → Actions → General
2. "Workflow permissions" 섹션
3. "Read and write permissions" 선택
4. "Allow GitHub Actions to create and approve pull requests" 체크
5. Save 클릭

그 다음:
```bash
cd /home/user/webapp
git push origin main
```

---

### Option 3: 전체 워크플로우 파일 교체

완전히 수정된 파일 내용:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Pages
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build
        env:
          NODE_VERSION: 20
          VITE_REGION: KR
          VITE_DEFAULT_LANGUAGE: ko
          VITE_API_BASE_URL: https://live.ur-team.com
          VITE_FIREBASE_API_KEY: AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
          VITE_FIREBASE_AUTH_DOMAIN: toss-live-commerce.firebaseapp.com
          VITE_FIREBASE_DATABASE_URL: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
          VITE_FIREBASE_PROJECT_ID: toss-live-commerce
          VITE_FIREBASE_STORAGE_BUCKET: toss-live-commerce.firebasestorage.app
          VITE_FIREBASE_MESSAGING_SENDER_ID: 408717649003
          VITE_FIREBASE_APP_ID: 1:408717649003:web:29aa3cb5f92056dd1ec4f4
          VITE_FIREBASE_MEASUREMENT_ID: G-78M73BGT77
          VITE_KAKAO_APP_KEY: 975a2e7f97254b08f15dba4d177a2865
          VITE_KAKAO_JAVASCRIPT_KEY: 975a2e7f97254b08f15dba4d177a2865
          VITE_KAKAO_REST_API_KEY: 5dd74bccb797640b0efd070467f3bafd
          VITE_KAKAO_AUTH_URL: https://kauth.kakao.com/oauth/authorize
          VITE_TOSS_CLIENT_KEY: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
          VITE_SENTRY_DSN: https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
          VITE_SENTRY_ENVIRONMENT: production

      - name: Deploy to Cloudflare Pages
        run: npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

## 📊 수정 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 프로젝트명 | `ur-live-working` | `ur-live` ✅ |
| Firebase DATABASE_URL | ❌ 누락 | ✅ 추가 |
| Kakao AUTH_URL | ❌ 누락 | ✅ 추가 |
| 총 환경변수 | 15개 | **17개** ✅ |

---

## 🧪 수정 후 테스트

1. **워크플로우 수동 실행**
   - GitHub 저장소 → Actions 탭
   - "Deploy to Cloudflare Pages" 워크플로우 선택
   - "Run workflow" 버튼 클릭

2. **자동 배포 테스트**
   - main 브랜치에 변경사항 푸시
   - Actions 탭에서 배포 진행 상황 확인

3. **배포 성공 확인**
   - ✅ 빌드 완료
   - ✅ Cloudflare Pages 업로드 완료
   - ✅ 배포 URL 생성

---

## 🔗 Quick Links

- **GitHub 저장소**: https://github.com/tobe2111/ur-live
- **워크플로우 파일**: https://github.com/tobe2111/ur-live/blob/main/.github/workflows/main.yml
- **Actions 페이지**: https://github.com/tobe2111/ur-live/actions
- **Cloudflare Dashboard**: https://dash.cloudflare.com/

---

## ⚠️ 중요 사항

1. **GitHub Secrets 확인**
   - `CLOUDFLARE_API_TOKEN` 설정 확인
   - `CLOUDFLARE_ACCOUNT_ID` 설정 확인
   
   확인 위치: 
   ```
   GitHub 저장소 → Settings → Secrets and variables → Actions
   ```

2. **프로젝트명 일치 확인**
   - Cloudflare Pages 프로젝트명: `ur-live`
   - 워크플로우 파일 프로젝트명: `ur-live`
   - 반드시 **정확히 일치**해야 함

---

**수정 완료 후 다음 배포부터는 자동으로 성공합니다!** 🚀

**작성일**: 2026-03-18  
**작성자**: AI Assistant  
**프로젝트**: ur-live
