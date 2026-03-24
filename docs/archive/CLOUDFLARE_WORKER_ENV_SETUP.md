# 🚨 Cloudflare Worker 환경변수 긴급 설정 가이드

## 문제 상황
```
로그인 실패: Firebase custom token creation failed
❌ Missing FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID
```

## 원인 분석

### 환경변수 2가지 종류
1. **`VITE_` 환경변수** → **프론트엔드 빌드 시**에만 사용
   - 예: `VITE_FIREBASE_API_KEY`
   - Vite가 빌드할 때 코드에 직접 삽입
   - `.env` 파일에 있음

2. **`VITE_` 없는 환경변수** → **Worker 런타임**에서 사용
   - 예: `FIREBASE_PRIVATE_KEY`
   - Worker가 실행될 때 동적으로 읽음
   - **Cloudflare Dashboard에서 설정해야 함** (`.env` 파일 무시됨)

### 현재 상황
```typescript
// Worker에서 사용 (kakao.routes.ts)
const firebaseProjectId = c.env.FIREBASE_PROJECT_ID;    // ❌ 없음
const firebasePrivateKey = c.env.FIREBASE_PRIVATE_KEY;   // ❌ 없음
const firebaseClientEmail = c.env.FIREBASE_CLIENT_EMAIL; // ❌ 없음
```

---

## ✅ 해결 방법 (10분 소요)

### Step 1: Firebase Admin SDK 정보 확인

1. https://console.firebase.google.com/ 접속
2. **toss-live-commerce** 프로젝트 선택
3. 좌측 메뉴 → ⚙️ **Project settings**
4. **Service accounts** 탭 클릭
5. **Generate new private key** 버튼 클릭
6. JSON 파일 다운로드 (예: `toss-live-commerce-firebase-adminsdk.json`)

### Step 2: JSON 파일에서 값 추출

다운로드한 JSON 파일을 열면:
```json
{
  "type": "service_account",
  "project_id": "toss-live-commerce",
  "private_key_id": "abcd1234...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@toss-live-commerce.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://..."
}
```

필요한 값:
- `project_id` → **FIREBASE_PROJECT_ID**
- `private_key` → **FIREBASE_PRIVATE_KEY**
- `client_email` → **FIREBASE_CLIENT_EMAIL**

### Step 3: Cloudflare Dashboard에 환경변수 추가

1. https://dash.cloudflare.com/ 로그인
2. 좌측 메뉴 → **Workers & Pages**
3. **ur-live** 프로젝트 선택
4. 상단 메뉴 → **Settings** 탭
5. 좌측 메뉴 → **Environment variables**
6. **Production** 탭에서 다음 변수들 추가:

#### 1) FIREBASE_PROJECT_ID
```
Variable name: FIREBASE_PROJECT_ID
Value: toss-live-commerce
Type: Text (not encrypted)
```

#### 2) FIREBASE_CLIENT_EMAIL
```
Variable name: FIREBASE_CLIENT_EMAIL
Value: firebase-adminsdk-xxxxx@toss-live-commerce.iam.gserviceaccount.com
Type: Text (not encrypted)
```

#### 3) FIREBASE_PRIVATE_KEY (중요!)
```
Variable name: FIREBASE_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkq...
...
-----END PRIVATE KEY-----

Type: Encrypt (권장)
```

⚠️ **주의**: Private key는 **개행문자(\n)를 포함한 전체 문자열**을 복사해야 함!

#### 4) FIREBASE_DATABASE_URL
```
Variable name: FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Text (not encrypted)
```

#### 5) KAKAO_REST_API_KEY
```
Variable name: KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
Type: Encrypt (권장)
```

### Step 4: 재배포
1. **Save** 버튼 클릭
2. **Deployments** 탭으로 이동
3. 최신 deployment 우측 **···** 메뉴 → **Retry deployment**
4. 또는 `git push` 하면 자동 재배포

### Step 5: 테스트
1. 배포 완료 대기 (약 3분)
2. https://live.ur-team.com/login 접속
3. **카카오 로그인** 버튼 클릭
4. OAuth 인증 후 리다이렉트
5. ✅ 콘솔에 "로그인 성공" 메시지 확인

---

## 📋 필수 환경변수 체크리스트

### Worker 환경변수 (Cloudflare Dashboard)
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_PRIVATE_KEY` (Encrypted 권장)
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_DATABASE_URL`
- [ ] `KAKAO_REST_API_KEY` (Encrypted 권장)

### 프론트엔드 환경변수 (Cloudflare Pages Build settings)
- [ ] `VITE_FIREBASE_DATABASE_URL` (채팅용)
- [ ] `VITE_FIREBASE_API_KEY` (자동 포함됨)
- [ ] `VITE_FIREBASE_AUTH_DOMAIN` (자동 포함됨)

---

## 🧪 검증 방법

### 1. Worker 환경변수 확인
```bash
# Cloudflare Dashboard에서 확인
# Workers & Pages → ur-live → Settings → Environment variables
```

### 2. API 테스트
```bash
# Kakao 로그인 엔드포인트 테스트
curl -X POST https://live.ur-team.com/api/auth/kakao/firebase \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"실제_토큰"}'

# 기대 결과:
# {"success":true,"data":{"customToken":"..."}}
```

### 3. 실제 로그인 테스트
1. https://live.ur-team.com/login 접속
2. 카카오 로그인 클릭
3. OAuth 인증 완료
4. 콘솔에 에러 없이 리다이렉트

---

## 🔍 트러블슈팅

### 문제 1: "FIREBASE_PRIVATE_KEY not found"
**원인**: Private key 복사 시 개행문자가 제거됨

**해결**:
```bash
# JSON 파일에서 직접 복사
cat toss-live-commerce-firebase-adminsdk.json | jq -r '.private_key'

# 출력된 전체 문자열을 Cloudflare Dashboard에 붙여넣기
```

### 문제 2: "Invalid private key format"
**원인**: Private key에 특수문자나 공백 포함

**해결**:
- JSON 파일의 `private_key` 값을 **그대로** 복사
- 앞뒤 따옴표(`"`) 제거 **금지**
- 개행문자(`\n`) 포함해야 함

### 문제 3: "Still getting 500 error"
**원인**: 환경변수 저장 후 재배포 안 함

**해결**:
```bash
# 로컬에서 더미 커밋 후 push
git commit --allow-empty -m "chore: Trigger redeploy for env vars"
git push origin main
```

---

## 📊 완료 후 상태

### Before (현재)
```
❌ Kakao 로그인: 500 error
❌ Firebase custom token: missing credentials
❌ 라이브 채팅: WebSocket blocked
```

### After (완료 후)
```
✅ Kakao 로그인: OAuth flow 정상
✅ Firebase custom token: 생성 성공
✅ 라이브 채팅: WebSocket 연결 (VITE_FIREBASE_DATABASE_URL 추가 후)
```

---

## 🔗 참고 문서

- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
- Cloudflare Pages 환경변수: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Kakao OAuth: https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api

---

**마지막 업데이트**: 2026-03-17 15:00 KST  
**예상 소요 시간**: 10분 (Firebase JSON 다운로드 + Cloudflare 설정)  
**우선순위**: 🔴 Critical (로그인 불가)
