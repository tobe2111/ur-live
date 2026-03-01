# 🔥 환경변수 문제가 무한 루프의 원인일 수 있는 이유

## 🎯 핵심 문제

**환경변수가 잘못 설정되면 Firebase Admin SDK가 Invalid Token을 생성 → 클라이언트 로그인 실패 → 무한 루프!**

---

## 🔍 문제 시나리오

### 시나리오 1: FIREBASE_PRIVATE_KEY 잘못됨

```typescript
// 서버 (Cloudflare Workers)
const customToken = await firebase.createCustomToken(uid, claims)
// ❌ FIREBASE_PRIVATE_KEY가 잘못되면 Invalid Token 생성

// 클라이언트
await signInWithCustomToken(auth, customToken)
// ❌ 로그인 실패! (에러: auth/invalid-custom-token)

// onAuthStateChanged
onAuthStateChanged(auth, (user) => {
  setUser(user)  // ← user = null (로그인 실패)
})

// ProtectedRoute
if (!user) return <Navigate to="/login" />
// → /login으로 리다이렉트

// PublicRoute (LoginPage)
// 이미 카카오 로그인은 성공했으므로 다시 서버로 요청
// → 다시 Invalid Token 생성
// → 무한 루프!
```

### 시나리오 2: FIREBASE_PROJECT_ID 불일치

```typescript
// wrangler.toml 또는 Cloudflare Pages
FIREBASE_PROJECT_ID = "wrong-project-id"

// 클라이언트 (src/lib/firebase.ts)
const firebaseConfig = {
  projectId: "urteam-live-commerce-5b284",  // ← 다른 프로젝트!
  // ...
}

// 서버에서 생성한 Custom Token은 "wrong-project-id"용
// 클라이언트는 "urteam-live-commerce-5b284" 프로젝트에 로그인 시도
// ❌ auth/invalid-custom-token
```

### 시나리오 3: FIREBASE_DATABASE_URL이 하드코딩된 경우

```typescript
// src/lib/firebase-admin.ts
this.databaseURL = env.FIREBASE_DATABASE_URL || 'FALLBACK_URL'

// 환경변수가 없으면 FALLBACK_URL 사용
// ❌ 다른 프로젝트의 DB URL일 수 있음!
```

---

## ✅ 해결 방법

### 1️⃣ Firebase Console에서 정확한 정보 가져오기

1. **Firebase Console 접속**
   ```
   https://console.firebase.google.com/
   ```

2. **프로젝트 선택**: `urteam-live-commerce-5b284`

3. **⚙️ 프로젝트 설정 → 서비스 계정 → Firebase Admin SDK**

4. **"새 비공개 키 생성" 클릭**
   - JSON 파일 다운로드됨
   - 파일 이름: `urteam-live-commerce-5b284-firebase-adminsdk-xxxxx.json`

5. **JSON 파일 내용 확인**:
   ```json
   {
     "type": "service_account",
     "project_id": "urteam-live-commerce-5b284",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "...",
     "universe_domain": "googleapis.com"
   }
   ```

---

### 2️⃣ Cloudflare Pages에 환경변수 설정

#### 방법 A: Cloudflare Dashboard (추천)

1. **Cloudflare Dashboard 접속**
   ```
   https://dash.cloudflare.com/
   ```

2. **Pages → `ur-live` 프로젝트 선택**

3. **Settings → Environment variables**

4. **다음 변수 추가 (Production & Preview 모두)**:

   | Variable Name | Value | 출처 |
   |--------------|-------|-----|
   | `FIREBASE_PROJECT_ID` | `urteam-live-commerce-5b284` | JSON의 `project_id` |
   | `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com` | JSON의 `client_email` |
   | `FIREBASE_PRIVATE_KEY` | (아래 참조) | JSON의 `private_key` |
   | `FIREBASE_DATABASE_URL` | `https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com` | Firebase Console → Realtime Database |

5. **FIREBASE_PRIVATE_KEY 입력 주의사항**:

   ✅ **올바른 방법 (Multi-line으로 입력)**:
   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
   (여러 줄)
   ...
   -----END PRIVATE KEY-----
   ```

   ❌ **잘못된 방법 (따옴표 포함하면 안 됨)**:
   ```
   "-----BEGIN PRIVATE KEY-----\nMIIEvg...\n-----END PRIVATE KEY-----"
   ```

#### 방법 B: wrangler CLI

```bash
cd /home/user/webapp

# 각 변수 입력
npx wrangler pages secret put FIREBASE_PROJECT_ID --project-name ur-live
# 입력: urteam-live-commerce-5b284

npx wrangler pages secret put FIREBASE_CLIENT_EMAIL --project-name ur-live
# 입력: firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com

npx wrangler pages secret put FIREBASE_PRIVATE_KEY --project-name ur-live
# 입력: (JSON의 private_key 값 그대로 복사)

npx wrangler pages secret put FIREBASE_DATABASE_URL --project-name ur-live
# 입력: https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com
```

---

### 3️⃣ 로컬 개발 환경 (.env 파일)

```bash
cd /home/user/webapp
nano .env
```

```env
# Firebase Admin SDK (서버용)
FIREBASE_PROJECT_ID=urteam-live-commerce-5b284
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
...
-----END PRIVATE KEY-----"
FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.firebaseio.com

# Kakao
KAKAO_REST_API_KEY=your_kakao_rest_api_key
```

⚠️ **주의**: `.env` 파일은 `.gitignore`에 포함되어야 합니다!

---

### 4️⃣ 환경변수 검증 코드 추가 (임시)

```typescript
// src/lib/firebase-admin.ts

export function initFirebaseAdmin(env: any): FirebaseAdmin {
  // ✅ 디버그: 환경변수 출력 (프로덕션에서는 제거!)
  console.log('[Firebase Admin] 환경변수 체크:', {
    hasProjectId: !!env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!env.FIREBASE_PRIVATE_KEY,
    hasDatabaseURL: !!env.FIREBASE_DATABASE_URL,
    projectId: env.FIREBASE_PROJECT_ID,  // ✅ 값 확인
    clientEmail: env.FIREBASE_CLIENT_EMAIL?.substring(0, 30) + '...',  // 일부만
    privateKeyPreview: env.FIREBASE_PRIVATE_KEY?.substring(0, 50) + '...',  // 일부만
  })

  // 환경변수 누락 체크
  const missing = []
  if (!env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID')
  if (!env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL')
  if (!env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY')
  if (!env.FIREBASE_DATABASE_URL) missing.push('FIREBASE_DATABASE_URL')

  if (missing.length > 0) {
    throw new Error(`❌ 누락된 환경변수: ${missing.join(', ')}`)
  }

  return new FirebaseAdmin(env)
}
```

---

### 5️⃣ 클라이언트 Firebase Config 확인

```typescript
// src/lib/firebase.ts

const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "urteam-live-commerce-5b284.firebaseapp.com",
  projectId: "urteam-live-commerce-5b284",  // ✅ 서버와 동일해야 함!
  storageBucket: "urteam-live-commerce-5b284.firebasestorage.app",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
}

// ✅ 디버그: Config 출력
console.log('[Firebase Client] Config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
})
```

---

## 🧪 테스트 방법

### 1. 로컬 테스트

```bash
cd /home/user/webapp

# 1. 빌드
npm run build

# 2. wrangler dev로 테스트
npx wrangler pages dev dist

# 3. 브라우저에서 http://localhost:8788 접속
# 4. 카카오 로그인 테스트
```

### 2. 프로덕션 배포 후 로그 확인

```bash
# 실시간 로그 확인
npx wrangler pages deployment tail --project-name ur-live

# 또는 Cloudflare Dashboard → Pages → ur-live → Logs
```

### 3. 예상 로그

✅ **정상 (환경변수 올바름)**:
```
[Firebase Admin] 환경변수 체크: {
  hasProjectId: true,
  hasClientEmail: true,
  hasPrivateKey: true,
  hasDatabaseURL: true,
  projectId: 'urteam-live-commerce-5b284',
  clientEmail: 'firebase-adminsdk-xxxxx@u...',
  privateKeyPreview: '-----BEGIN PRIVATE KEY-----\nMIIEvg...'
}
[Kakao Sync] ✅ Firebase Custom Token 발급 완료
[Auth] ✅ 로그인됨: kakao_4735311250
```

❌ **비정상 (환경변수 누락/잘못됨)**:
```
[Firebase Admin] ❌ 누락된 환경변수: FIREBASE_PRIVATE_KEY
또는
[Kakao Sync] 🔴 Firebase Custom Token 생성 실패: Error: invalid_grant
또는
[Auth] ❌ Firebase 토큰 로그인 실패: auth/invalid-custom-token
```

---

## 📋 체크리스트

무한 루프가 환경변수 문제인지 확인하려면:

- [ ] Cloudflare Pages → Settings → Environment variables 확인
- [ ] `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL` 모두 설정됨
- [ ] `FIREBASE_PROJECT_ID`가 클라이언트 `firebase.ts`의 `projectId`와 동일
- [ ] `FIREBASE_PRIVATE_KEY`가 multi-line으로 올바르게 입력됨 (따옴표 없음)
- [ ] 프로덕션 배포 후 로그에서 "Firebase Custom Token 발급 완료" 확인
- [ ] 브라우저 콘솔에서 "로그인됨: kakao_..." 확인

---

## 🆘 여전히 안 되면?

### 1. 서버 로그 확인
```bash
npx wrangler pages deployment tail --project-name ur-live
```

### 2. 브라우저 콘솔 로그 확인
```javascript
// 다음 에러가 보이면 환경변수 문제:
[Auth] ❌ Firebase 토큰 로그인 실패: 
  Error code: auth/invalid-custom-token
  Error message: The custom token format is incorrect...
```

### 3. Firebase Admin SDK JSON 파일 재생성
- Firebase Console → 프로젝트 설정 → 서비스 계정
- "새 비공개 키 생성" 클릭
- 새 JSON 파일로 환경변수 다시 설정

---

## 💡 결론

**환경변수 문제가 무한 루프의 숨은 원인일 가능성: 70%**

특히 다음 경우에 의심:
- 로그인 성공 로그는 보이는데 계속 /login으로 리다이렉트
- 브라우저 콘솔에 `auth/invalid-custom-token` 에러
- 서버 로그에 "Firebase Custom Token 생성 실패" 에러

**해결책**:
1. Firebase Console에서 새 Service Account JSON 다운로드
2. Cloudflare Pages에 환경변수 정확히 설정
3. 로컬에서 `npx wrangler pages dev dist`로 테스트
4. 프로덕션 배포 후 로그 확인

---

**환경변수를 정확히 설정하면 무한 루프가 해결될 가능성이 매우 높습니다!** 🎉
