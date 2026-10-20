# 🎯 최종 배포 가이드 (완전 정리판)

## 📊 현재 상황 요약

### ✅ 완료된 작업
1. ✅ **환경 변수 수정 완료**
   - `.env.production`에 올바른 Firebase API Key 설정
   - Cloudflare Pages에 22개 환경 변수 등록 (17개 `VITE_*` + 5개 백엔드)
   
2. ✅ **코드 버그 수정 완료**
   - `VITE_FIREBASE__D_A_T_A_B_A_S_E_U_R_L` → `VITE_FIREBASE_DATABASE_URL`
   - Firebase 환경 변수 이름 생성 로직 수정
   
3. ✅ **빌드 검증 완료**
   - 로컬 빌드 성공 (`dist/client/` 폴더에 179개 파일)
   - 올바른 Firebase API Key 포함 확인: `AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s`

4. ✅ **Git 커밋 및 푸시 완료**
   - 최신 커밋: `dbf83f39` - "trigger: Deploy with correct Cloudflare environment variables"
   - GitHub에 푸시 완료

### ❌ 남은 문제
1. ❌ **GitHub Actions 워크플로가 실행되지 않음**
   - API가 404를 반환 → Actions 비활성화 또는 권한 부족
   
2. ❌ **Cloudflare Pages가 여전히 구버전 서빙**
   - 라이브 사이트에서 잘못된 API Key 사용 중: `AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM`

---

## 🚀 즉시 해결 방법 (우선순위 순)

### 방법 1: GitHub Actions 활성화 후 수동 트리거 ⭐ **가장 권장**

#### Step 1: Actions 활성화 확인 (1분)
1. **GitHub Settings 접속**:
   ```
   https://github.com/tobe2111/ur-live/settings/actions
   ```

2. **"Actions permissions" 설정**:
   - ✅ "Allow all actions and reusable workflows" 선택
   - 또는 "Allow tobe2111, and select non-tobe2111, actions and reusable workflows"
   - **저장** 버튼 클릭

#### Step 2: 수동으로 워크플로 실행 (2분)
1. **GitHub Actions 페이지 접속**:
   ```
   https://github.com/tobe2111/ur-live/actions
   ```

2. **워크플로 실행**:
   - 왼쪽에서 **"Deploy to Cloudflare Pages"** 선택
   - 오른쪽 상단 **"Run workflow"** 버튼 클릭
   - Branch: **main** 선택
   - **"Run workflow"** 클릭

3. **배포 진행 확인**:
   - 노란색 원(진행 중) → 초록색 체크(완료) 대기 (약 5-7분)
   - 실패 시 로그 확인

#### Step 3: 배포 완료 후 확인 (2분)
```
1. https://live.ur-team.com 시크릿 모드로 열기
2. 브라우저 콘솔에서 실행:
   console.log(import.meta.env.VITE_FIREBASE_API_KEY);
   // 기대값: "AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"
3. 카카오 로그인 테스트
```

---

### 방법 2: Cloudflare Dashboard에서 직접 배포 (GitHub Actions 실패 시)

#### Option A: Git 연결 배포 (5분)
1. **Cloudflare Dashboard 접속**:
   ```
   https://dash.cloudflare.com/
   ```

2. **프로젝트 선택**:
   - **Workers & Pages** 메뉴
   - **ur-live** 프로젝트 클릭

3. **Git 연결**:
   - **Settings** → **Builds & deployments**
   - **"Add build configuration"** 또는 **"Edit configuration"**
   - Production branch: `main`
   - Build output directory: `dist/client`
   - **저장**

4. **수동 배포 트리거**:
   - **Deployments** 탭
   - **"Create deployment"** 버튼 클릭
   - **Deploy from GitHub**
   - Branch: `main` 선택
   - **"Save and Deploy"**

#### Option B: 직접 업로드 배포 (10분)
서버에서 빌드 파일 준비 후 업로드:

```bash
cd /home/user/webapp
# 이미 빌드된 파일이 있으므로 그대로 사용
cd dist/client
tar -czf ../../ur-live-build.tar.gz .
```

그 다음 Cloudflare Dashboard에서:
1. **Workers & Pages** → **ur-live**
2. **Deployments** 탭
3. **"Create deployment"** → **"Upload assets"**
4. 압축 파일 업로드

---

### 방법 3: Wrangler CLI로 배포 (고급 사용자용)

```bash
# Cloudflare API 토큰 설정
export CLOUDFLARE_API_TOKEN="3i3ZxtKpifhT7BjnH-p2VS9jKyoQs83dl4w1_KXC"
export CLOUDFLARE_ACCOUNT_ID="1a2c006f0fb54894f81283a5ea787b83"

# 배포 실행
cd /home/user/webapp
npx wrangler pages deploy dist/client --project-name=ur-live --branch=main
```

---

## 🔍 배포 후 검증 체크리스트

### 1. 사이트 로딩 확인
```
✅ https://live.ur-team.com 접속
✅ 메인 페이지 정상 로딩
✅ 404 에러 없음
✅ 상품 목록 표시됨
```

### 2. Firebase API Key 확인
브라우저 콘솔:
```javascript
// 실행:
console.log(import.meta.env.VITE_FIREBASE_API_KEY);

// 기대값:
"AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"

// 잘못된 값 (구버전):
"AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM" ❌
```

### 3. 환경 변수 전체 확인
```javascript
// 실행:
console.log(import.meta.env);

// 확인 사항:
✅ VITE_FIREBASE_API_KEY: "AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s"
✅ VITE_FIREBASE_DATABASE_URL: "https://urteam-live-commerce-default-rtdb..."
✅ VITE_FIREBASE_PROJECT_ID: "urteam-live-commerce"
✅ VITE_KAKAO_REST_API_KEY: "5dd74bccb797640b0efd070467f3bafd"
```

### 4. 카카오 로그인 테스트
```
1. 카카오 로그인 버튼 클릭
2. 카카오 로그인 페이지로 리다이렉트
3. 로그인 후 콜백 처리
4. 프로필 페이지로 이동
5. ❌ "auth/api-key-not-valid" 에러 없어야 함
```

### 5. 네트워크 탭 확인
```
1. 개발자 도구 → Network 탭
2. 페이지 새로고침
3. index-*.js 파일 클릭
4. Response 탭에서 "VITE_FIREBASE_API_KEY" 검색
5. 올바른 키가 포함되어 있는지 확인
```

---

## 🐛 문제 해결 가이드

### 문제 1: 여전히 404 에러
**원인**: 배포가 완료되지 않았거나 잘못된 폴더 배포  
**해결**:
```
1. Cloudflare Dashboard → Deployments 확인
2. 최신 배포의 상태가 "Success"인지 확인
3. 브라우저 캐시 삭제 (Ctrl+Shift+Delete)
4. 시크릿 모드로 재접속
```

### 문제 2: 여전히 잘못된 API Key
**원인**: 이전 배포가 여전히 서빙되고 있음  
**해결**:
```
1. Cloudflare Dashboard → Deployments
2. 최신 배포 ID 확인
3. URL로 직접 접속: https://[deployment-id].ur-live.pages.dev
4. 해당 배포에서 올바른 API Key 확인
5. Production 별칭이 올바른 배포를 가리키는지 확인
```

### 문제 3: GitHub Actions 여전히 실행 안 됨
**원인**: 권한 또는 설정 문제  
**해결**:
```
1. https://github.com/tobe2111/ur-live/settings/actions
2. Actions permissions 확인
3. Workflow permissions 확인:
   - "Read and write permissions" 선택
   - "Allow GitHub Actions to create and approve pull requests" 체크
4. 저장 후 재푸시:
   git commit --allow-empty -m "trigger: Test Actions"
   git push origin main
```

### 문제 4: Cloudflare 환경 변수 미반영
**원인**: 배포 시 환경 변수가 적용되지 않음  
**해결**:
```
1. Cloudflare Dashboard → ur-live → Settings → Environment variables
2. Production 환경에 변수가 등록되어 있는지 확인
3. 변수 추가/수정 후 반드시 "Retry deployment" 실행
4. 또는 GitHub Actions로 새 배포 트리거
```

---

## 📝 환경 변수 전체 목록

### Frontend Variables (17개)
```bash
VITE_API_BASE_URL=https://live.ur-team.com
VITE_REGION=KR
VITE_DEFAULT_LANGUAGE=ko

# Firebase
VITE_FIREBASE_API_KEY=AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s
VITE_FIREBASE_AUTH_DOMAIN=urteam-live-commerce.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce
VITE_FIREBASE_STORAGE_BUCKET=urteam-live-commerce.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1098157020294
VITE_FIREBASE_APP_ID=1:1098157020294:web:5f527d8e3e9f941cedad07
VITE_FIREBASE_MEASUREMENT_ID=G-B1ST2L37CM

# Kakao
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_JAVASCRIPT_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd

# Toss
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN

# Sentry
VITE_SENTRY_DSN=https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
VITE_SENTRY_ENVIRONMENT=production
```

### Backend Secrets (5개 - Encrypted)
```bash
FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
FIREBASE_PRIVATE_KEY=(서비스 계정 private key)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com
JWT_SECRET=(32자 랜덤 문자열)
REFRESH_TOKEN_SECRET=(32자 랜덤 문자열)
```

---

## 🎯 요약

### 현재 상태
- ✅ 로컬 빌드 완료 (올바른 API Key 포함)
- ✅ 환경 변수 Cloudflare에 등록 완료
- ✅ 코드 버그 수정 완료
- ✅ Git 푸시 완료
- ❌ **GitHub Actions 실행 안 됨** → 수동 트리거 필요
- ❌ **라이브 사이트 구버전** → 재배포 필요

### 즉시 해야 할 일
1. **GitHub Actions 활성화 및 수동 트리거** (5분)
   - https://github.com/tobe2111/ur-live/actions
   
2. **또는 Cloudflare Dashboard에서 직접 배포** (10분)
   - https://dash.cloudflare.com/

3. **배포 완료 후 검증** (5분)
   - 사이트 접속, API Key 확인, 로그인 테스트

### 예상 소요 시간
- **GitHub Actions 사용**: 5-7분
- **Cloudflare 직접 배포**: 10-15분

### 우선순위
🔴 **CRITICAL** - 즉시 처리 필요

---

## 🔗 중요 링크 모음

### GitHub
- **리포지토리**: https://github.com/tobe2111/ur-live
- **Actions 페이지**: https://github.com/tobe2111/ur-live/actions
- **Actions 설정**: https://github.com/tobe2111/ur-live/settings/actions

### Cloudflare
- **Dashboard**: https://dash.cloudflare.com/
- **ur-live 프로젝트**: https://dash.cloudflare.com/[account-id]/pages/view/ur-live

### Firebase
- **Console**: https://console.firebase.google.com/project/urteam-live-commerce

### 라이브 사이트
- **Production**: https://live.ur-team.com

---

**작성일시**: 2026-03-18 14:45 KST  
**최종 업데이트**: 환경 변수 22개 설정 완료, GitHub Actions 수동 트리거 대기 중
