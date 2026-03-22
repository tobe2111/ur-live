# 🔥 Firebase 완전 새로 세팅 가이드

## 목표
Firebase를 처음 설정하는 것처럼 깔끔하게 프로젝트 설정

---

## Phase 1: Firebase Console 설정 (15분)

### Step 1-1: Firebase Console 접속 및 프로젝트 선택
👉 https://console.firebase.google.com/

1. **urteam-live-commerce** 프로젝트 클릭
2. 좌측 사이드바 확인:
   - ✅ Authentication
   - ✅ Realtime Database
   - ✅ Storage
   - ✅ Hosting (필요시)

---

### Step 1-2: Authentication 활성화

1. **Authentication** 클릭
2. **Sign-in method** 탭
3. **Custom** 활성화 (Kakao 로그인용)
   - Enable 클릭
   - Save

4. **Settings** 탭에서 승인된 도메인 확인:
   - `live.ur-team.com` 추가되어 있는지 확인
   - 없으면 **Add domain** 클릭하여 추가

---

### Step 1-3: Realtime Database 설정

1. **Realtime Database** 클릭
2. Database URL 확인:
   ```
   https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app
   ```
3. **Rules** 탭에서 규칙 확인 (필요시 수정)

---

### Step 1-4: Web App 설정 확인

1. ⚙️ **프로젝트 설정** (좌측 하단 톱니바퀴)
2. **일반** 탭 → **내 앱** 섹션
3. 웹 앱 확인 또는 생성:
   - 있으면: 기존 웹 앱 클릭
   - 없으면: **앱 추가** → **</> (웹)** 클릭
     - 앱 닉네임: `ur-live` (원하는 이름)
     - Firebase Hosting 사용: 체크 해제
     - **앱 등록** 클릭

4. **SDK 설정 및 구성** 코드 복사:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s",
  authDomain: "urteam-live-commerce.firebaseapp.com",
  databaseURL: "https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "urteam-live-commerce",
  storageBucket: "urteam-live-commerce.firebasestorage.app",
  messagingSenderId: "1098157020294",
  appId: "1:1098157020294:web:5f527d8e3e9f941cedad07",
  measurementId: "G-B1ST2L37CM"
};
```

✅ 이 값들이 위에서 이미 받은 값과 동일한지 확인!

---

### Step 1-5: Service Account 생성 (백엔드용)

1. ⚙️ **프로젝트 설정** → **서비스 계정** 탭
2. **새 비공개 키 생성** 버튼 클릭
3. **키 생성** 확인 → JSON 파일 다운로드
4. 다운로드된 파일 열기 → 내용 확인:
   ```json
   {
     "type": "service_account",
     "project_id": "urteam-live-commerce",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@urteam-live-commerce.iam.gserviceaccount.com",
     "client_id": "...",
     ...
   }
   ```

⚠️ **이 파일은 절대 Git에 커밋하지 마세요!**

---

## Phase 2: 로컬 프로젝트 설정 (5분)

### Step 2-1: .env 파일 업데이트

```bash
# 🔥 Firebase 설정 (Frontend용)
VITE_FIREBASE_API_KEY=AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s
VITE_FIREBASE_AUTH_DOMAIN=urteam-live-commerce.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=urteam-live-commerce
VITE_FIREBASE_STORAGE_BUCKET=urteam-live-commerce.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1098157020294
VITE_FIREBASE_APP_ID=1:1098157020294:web:5f527d8e3e9f941cedad07
VITE_FIREBASE_MEASUREMENT_ID=G-B1ST2L37CM
```

✅ 이미 완료됨!

---

### Step 2-2: Firebase 코드 검증

현재 프로젝트의 Firebase 초기화 코드가 올바른지 확인:
- `src/lib/firebase-config.ts` - Frontend 설정
- `src/lib/firebase-admin.ts` - Backend (Worker) 설정

---

## Phase 3: Cloudflare 환경변수 설정 (20분)

### Step 3-1: Frontend 환경변수 (17개)

👉 https://dash.cloudflare.com/
- Workers & Pages → **ur-live** → Settings → Environment variables → **Production (Current)**

**Add variable** 클릭하여 하나씩 추가:

#### Firebase (8개) - Type: **Plaintext**
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

#### Kakao (4개) - Type: **Plaintext**
```
VITE_KAKAO_APP_KEY = 975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_JAVASCRIPT_KEY = 975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY = 5dd74bccb797640b0efd070467f3bafd
VITE_KAKAO_AUTH_URL = https://kauth.kakao.com/oauth/authorize
```

#### Toss (1개) - Type: **Plaintext**
```
VITE_TOSS_CLIENT_KEY = test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

#### 기타 (4개) - Type: **Plaintext**
```
VITE_REGION = KR
VITE_DEFAULT_LANGUAGE = ko
VITE_API_BASE_URL = https://live.ur-team.com
VITE_SENTRY_DSN = https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
VITE_SENTRY_ENVIRONMENT = production
```

---

### Step 3-2: Backend 환경변수 (14개)

#### Firebase Admin (3개) - Type: **Secret**
```
FIREBASE_API_KEY = AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s
FIREBASE_PROJECT_ID = urteam-live-commerce
FIREBASE_DATABASE_URL = https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app
```

#### Service Account (3개) - Type: **Secret**
⚠️ **Step 1-5에서 다운로드한 JSON 파일에서 복사**:

```
FIREBASE_PRIVATE_KEY = (JSON의 private_key 값 그대로 복사 - 개행 포함)
FIREBASE_CLIENT_EMAIL = (JSON의 client_email 값)
FIREBASE_SERVICE_ACCOUNT_KEY = (JSON 전체를 한 줄로)
```

예시:
```
FIREBASE_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQ...
...여러 줄...
-----END PRIVATE KEY-----

FIREBASE_CLIENT_EMAIL = firebase-adminsdk-xxxxx@urteam-live-commerce.iam.gserviceaccount.com

FIREBASE_SERVICE_ACCOUNT_KEY = {"type":"service_account","project_id":"urteam-live-commerce",...전체...}
```

#### JWT (2개) - Type: **Secret**
```
JWT_SECRET = 3Y4MyekQ4D+GFVY6p6bJEScOMSyFFkbtSX76YyT9uk4=
REFRESH_TOKEN_SECRET = zetvg/v05J+O6M99ndq4UFliUwvw2Gvvi8dPXXZ3+z0=
```

#### 기타 (6개) - Type: **Secret**
```
ENVIRONMENT = production
FRONTEND_URL = https://live.ur-team.com
REGION = KR
KAKAO_REST_API_KEY = 5dd74bccb797640b0efd070467f3bafd
TOSS_SECRET_KEY = test_gsk_yL0qZ4G1VOlbD7DDxWDnroWb2MQY
```

---

### Step 3-3: 저장 및 배포

1. 모든 변수 추가 완료 후 **Save** 버튼 클릭 (우측 상단)
2. **Deployments** 탭으로 이동
3. 최신 배포의 ⋮ (점 3개) → **Retry deployment** 클릭
4. 배포 진행 상황 확인 (약 3-5분 소요)
5. Status가 **Success**가 될 때까지 대기

---

## Phase 4: 테스트 및 검증 (5분)

### Step 4-1: 브라우저 캐시 클리어

**방법 1: 하드 리프레시**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**방법 2: 시크릿 모드**
- Windows/Linux: `Ctrl + Shift + N`
- Mac: `Cmd + Shift + N`

**방법 3: Cloudflare 캐시 삭제**
- Cloudflare Dashboard → Websites → ur-team.com
- Caching → Configuration → **Purge Everything**

---

### Step 4-2: 로그인 테스트

1. 👉 https://live.ur-team.com/login 접속
2. F12 → Console 탭 열기
3. **Kakao로 로그인** 버튼 클릭
4. 콘솔 로그 확인:

**✅ 성공 시 로그:**
```
✅ [Env Validator] KR 환경 변수 검증 성공
✅ Sentry 초기화 완료
✅ React 렌더링 완료
🔥 Lazy loading Firebase App...
✅ Firebase App initialized
✅ Firebase Auth initialized
[KakaoCallback] ✅ Custom Token 수신
[Firebase Auth] ✅ Sign in successful
```

**❌ 실패 시 로그:**
```
❌ Missing Firebase environment variables: ...
❌ auth/api-key-not-valid
```

---

### Step 4-3: Firebase Console에서 사용자 확인

1. Firebase Console → Authentication → Users 탭
2. 로그인한 사용자가 표시되는지 확인
3. UID, Email, Sign-in provider 확인

---

### Step 4-4: Realtime Database 연결 확인

1. Firebase Console → Realtime Database → Data 탭
2. 실시간으로 데이터가 들어오는지 확인
3. 브라우저 콘솔에서:
   ```javascript
   // Database 연결 테스트
   console.log('Testing database connection...')
   ```

---

## 🚨 문제 해결

### 문제 1: "Missing Firebase environment variables"
**원인**: Cloudflare 환경변수 미설정 또는 배포 미완료
**해결**:
1. Cloudflare Dashboard에서 환경변수 확인
2. Deployments → Retry deployment
3. 배포 완료 후 캐시 클리어

---

### 문제 2: "auth/api-key-not-valid"
**원인**: 잘못된 API 키
**해결**:
1. Firebase Console에서 API 키 재확인
2. `VITE_FIREBASE_API_KEY` 값 수정
3. Cloudflare에서 동일하게 수정
4. Retry deployment

---

### 문제 3: "Custom token creation failed"
**원인**: Service Account 설정 누락
**해결**:
1. Firebase Console → 서비스 계정 → 새 비공개 키 생성
2. `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_SERVICE_ACCOUNT_KEY` 설정
3. Retry deployment

---

### 문제 4: 여전히 같은 에러
**원인**: 브라우저 캐시
**해결**:
1. 시크릿 모드로 테스트
2. Cloudflare 캐시 완전 삭제
3. 5-10분 대기 후 재시도

---

## 📊 체크리스트

### Firebase Console
- [ ] Authentication 활성화
- [ ] Custom 로그인 활성화
- [ ] Realtime Database 생성
- [ ] 웹 앱 등록
- [ ] Service Account 생성 (JSON 다운로드)

### 로컬 프로젝트
- [ ] .env 파일 업데이트 (8개 Firebase 변수)
- [ ] Git 커밋 (선택사항)

### Cloudflare
- [ ] Frontend 변수 17개 추가 (Plaintext)
- [ ] Backend 변수 14개 추가 (Secret)
- [ ] Save 클릭
- [ ] Retry deployment
- [ ] 배포 완료 대기 (Success)

### 테스트
- [ ] 캐시 클리어
- [ ] 로그인 페이지 접속
- [ ] Kakao 로그인 시도
- [ ] 콘솔 에러 확인
- [ ] Firebase Console에서 사용자 확인

---

## 🎯 완료 기준

✅ **모든 것이 정상 작동할 때**:
1. Kakao 로그인 성공
2. 프로필 페이지로 리다이렉트
3. Firebase Console에 사용자 표시
4. 브라우저 콘솔에 에러 없음
5. Realtime Database 연결 확인

---

**작성일**: 2026-03-18
**상태**: 준비 완료 - Cloudflare 환경변수 설정 필요
