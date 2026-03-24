# ✅ Cloudflare 환경변수 설정 가이드 (올바른 Firebase 설정)

## 🎯 목표
`ur-live` 프로젝트에 **올바른 Firebase 설정**을 적용하여 로그인 문제 해결

---

## 📍 Cloudflare Dashboard 접속
👉 https://dash.cloudflare.com/
- Workers & Pages → **ur-live** → Settings → Environment variables → **Production (Current)** 탭

---

## 🔥 설정해야 할 환경변수 (총 31개)

### 1️⃣ Frontend 환경변수 (17개 - 모두 Plaintext)

#### Firebase 설정 (8개)
```
VITE_FIREBASE_API_KEY = AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s
VITE_FIREBASE_AUTH_DOMAIN = urteam-live-commerce.firebaseapp.com
VITE_FIREBASE_DATABASE_URL = https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID = urteam-live-commerce
VITE_FIREBASE_STORAGE_BUCKET = urteam-live-commerce.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 1098157020294
VITE_FIREBASE_APP_ID = 1:1098157020294:web:5f527d8e3e9f941cedad07
VITE_FIREBASE_MEASUREMENT_ID = G-B1ST2L37CM
```

#### Kakao 설정 (4개)
```
VITE_KAKAO_APP_KEY = 975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_JAVASCRIPT_KEY = 975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY = 5dd74bccb797640b0efd070467f3bafd
VITE_KAKAO_AUTH_URL = https://kauth.kakao.com/oauth/authorize
```

#### Toss Payments (1개)
```
VITE_TOSS_CLIENT_KEY = test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

#### 기타 설정 (4개)
```
VITE_REGION = KR
VITE_DEFAULT_LANGUAGE = ko
VITE_API_BASE_URL = https://live.ur-team.com
VITE_SENTRY_DSN = https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
VITE_SENTRY_ENVIRONMENT = production
```

---

### 2️⃣ Backend 환경변수 (14개 - 모두 Secret)

#### Firebase Admin SDK (7개)
```
FIREBASE_API_KEY = AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s
FIREBASE_PROJECT_ID = urteam-live-commerce
FIREBASE_DATABASE_URL = https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app
```

⚠️ **다음 3개 변수는 Service Account 생성 후 설정 필요**:
```
FIREBASE_PRIVATE_KEY = -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-xxxxx@urteam-live-commerce.iam.gserviceaccount.com
FIREBASE_SERVICE_ACCOUNT_KEY = {"type":"service_account",...}
```

#### JWT 설정 (2개)
```
JWT_SECRET = 3Y4MyekQ4D+GFVY6p6bJEScOMSyFFkbtSX76YyT9uk4=
REFRESH_TOKEN_SECRET = zetvg/v05J+O6M99ndq4UFliUwvw2Gvvi8dPXXZ3+z0=
```

#### 기타 Backend 설정 (5개)
```
ENVIRONMENT = production
FRONTEND_URL = https://live.ur-team.com
REGION = KR
KAKAO_REST_API_KEY = 5dd74bccb797640b0efd070467f3bafd
TOSS_SECRET_KEY = test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
```

---

## 🔑 Firebase Service Account 생성 (중요!)

### Step 1: Firebase Console 접속
👉 https://console.firebase.google.com/

### Step 2: Service Account 생성
1. **urteam-live-commerce** 프로젝트 선택
2. ⚙️ **프로젝트 설정** 클릭
3. **서비스 계정** 탭 클릭
4. **새 비공개 키 생성** 버튼 클릭
5. JSON 파일 다운로드

### Step 3: JSON 파일에서 값 추출
다운로드한 JSON 파일을 열어서:
```json
{
  "type": "service_account",
  "project_id": "urteam-live-commerce",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@urteam-live-commerce.iam.gserviceaccount.com",
  ...
}
```

이 JSON에서:
- `private_key` → `FIREBASE_PRIVATE_KEY` (개행문자 \n 유지)
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- **전체 JSON** → `FIREBASE_SERVICE_ACCOUNT_KEY` (한 줄로)

---

## 📝 Cloudflare 설정 방법

### 1. 기존 변수 삭제 (선택사항)
- 잘못된 값이 있다면 먼저 삭제

### 2. 새 변수 추가
1. **Add variable** 버튼 클릭
2. Variable name 입력 (예: `VITE_FIREBASE_API_KEY`)
3. Value 입력
4. Type 선택:
   - Frontend (VITE_*) → **Plaintext**
   - Backend → **Secret**
5. **Save** 클릭

### 3. 모든 변수 추가 후
- **Save** 버튼 클릭 (우측 상단)
- **Deployments** 탭으로 이동
- 최신 배포의 ⋮ (점 3개) → **Retry deployment** 클릭
- 약 3-5분 대기

---

## ✅ 설정 검증

### 1. 배포 완료 확인
- Deployments → 최신 배포 Status가 **Success**

### 2. 캐시 클리어
- 브라우저에서 `Ctrl + Shift + R` (Windows/Linux)
- 또는 `Cmd + Shift + R` (Mac)

### 3. 로그인 테스트
👉 https://live.ur-team.com/login
- Kakao 로그인 버튼 클릭
- 정상 로그인 되는지 확인

### 4. 콘솔 확인
- F12 → Console 탭
- ❌ `Missing Firebase environment variables` 에러 없어야 함
- ❌ `auth/api-key-not-valid` 에러 없어야 함
- ✅ `Firebase App initialized` 메시지 확인

---

## 🚨 문제 해결

### 여전히 같은 에러가 나는 경우
1. **캐시 문제**
   - 시크릿 모드로 테스트: `Ctrl + Shift + N`
   - Cloudflare 캐시 삭제:
     - Websites → ur-team.com → Caching → Configuration → **Purge Everything**

2. **배포 미완료**
   - Deployments 페이지에서 Status 확인
   - 빌드 로그 확인

3. **환경변수 오타**
   - 변수 이름 철자 확인
   - 값에 공백이 없는지 확인

---

## 📊 체크리스트

### Frontend 변수 (17개)
- [ ] VITE_FIREBASE_API_KEY
- [ ] VITE_FIREBASE_AUTH_DOMAIN
- [ ] VITE_FIREBASE_DATABASE_URL
- [ ] VITE_FIREBASE_PROJECT_ID
- [ ] VITE_FIREBASE_STORAGE_BUCKET
- [ ] VITE_FIREBASE_MESSAGING_SENDER_ID
- [ ] VITE_FIREBASE_APP_ID
- [ ] VITE_FIREBASE_MEASUREMENT_ID
- [ ] VITE_KAKAO_APP_KEY
- [ ] VITE_KAKAO_JAVASCRIPT_KEY
- [ ] VITE_KAKAO_REST_API_KEY
- [ ] VITE_KAKAO_AUTH_URL
- [ ] VITE_TOSS_CLIENT_KEY
- [ ] VITE_REGION
- [ ] VITE_DEFAULT_LANGUAGE
- [ ] VITE_API_BASE_URL
- [ ] VITE_SENTRY_DSN
- [ ] VITE_SENTRY_ENVIRONMENT

### Backend 변수 (14개)
- [ ] FIREBASE_API_KEY
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_DATABASE_URL
- [ ] FIREBASE_PRIVATE_KEY (Service Account 필요)
- [ ] FIREBASE_CLIENT_EMAIL (Service Account 필요)
- [ ] FIREBASE_SERVICE_ACCOUNT_KEY (Service Account 필요)
- [ ] JWT_SECRET
- [ ] REFRESH_TOKEN_SECRET
- [ ] ENVIRONMENT
- [ ] FRONTEND_URL
- [ ] REGION
- [ ] KAKAO_REST_API_KEY
- [ ] TOSS_SECRET_KEY

### 배포 및 테스트
- [ ] 모든 변수 Save
- [ ] Retry deployment
- [ ] 배포 완료 대기 (3-5분)
- [ ] 브라우저 캐시 클리어
- [ ] 로그인 테스트

---

## 🎯 예상 결과

✅ **성공 시**:
- Kakao 로그인 정상 작동
- Firebase 인증 성공
- 콘솔에 에러 없음
- 프로필 페이지 정상 표시

❌ **실패 시**:
- Console에 에러 메시지 확인
- 위 "문제 해결" 섹션 참고

---

**작성일**: 2026-03-18
**업데이트**: Firebase Console에서 가져온 정확한 설정값 반영
