# Worker 환경변수 체크리스트

## ✅ 이미 설정된 환경변수 (VITE_*)
- ✅ VITE_FIREBASE_API_KEY
- ✅ VITE_FIREBASE_AUTH_DOMAIN
- ✅ VITE_FIREBASE_PROJECT_ID
- ✅ VITE_FIREBASE_STORAGE_BUCKET
- ✅ VITE_FIREBASE_MESSAGING_SENDER_ID
- ✅ VITE_FIREBASE_APP_ID
- ✅ VITE_FIREBASE_MEASUREMENT_ID
- ✅ VITE_FIREBASE_DATABASE_URL
- ✅ VITE_KAKAO_REST_API_KEY
- ✅ VITE_KAKAO_JAVASCRIPT_KEY
- ✅ VITE_TOSS_CLIENT_KEY
- ✅ VITE_REGION
- ✅ VITE_DEFAULT_LANGUAGE
- ✅ VITE_API_BASE_URL

## ❌ 누락된 Worker 환경변수 (VITE_ 없음)

### 🔴 Critical (로그인 차단)

#### 1. FIREBASE_PROJECT_ID
```
Variable name: FIREBASE_PROJECT_ID
Value: urteam-live-commerce-5b284
Type: Text (Plain text)
```

#### 2. FIREBASE_PRIVATE_KEY
```
Variable name: FIREBASE_PRIVATE_KEY
Value: [Firebase Console에서 다운로드한 Service Account JSON의 private_key]
Type: Encrypt (⚠️ 중요: Encrypt로 설정)
```

**획득 방법**:
1. https://console.firebase.google.com/ 접속
2. **urteam-live-commerce-5b284** 프로젝트 선택
3. ⚙️ Project settings → **Service accounts** 탭
4. **Generate new private key** 버튼 클릭
5. JSON 파일 다운로드
6. JSON 파일 열기 → `"private_key"` 값 복사

**예시**:
```json
{
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n"
}
```

⚠️ **주의**: 
- `\n`을 실제 개행으로 변환하지 말 것
- 그대로 복사해서 Cloudflare에 붙여넣기
- 또는 Cloudflare Dashboard에서 텍스트 에디터로 직접 입력 시 Enter로 개행

#### 3. FIREBASE_CLIENT_EMAIL
```
Variable name: FIREBASE_CLIENT_EMAIL
Value: [Firebase Service Account JSON의 client_email]
Type: Text (Plain text)
```

**예시**:
```
firebase-adminsdk-xxxxx@urteam-live-commerce-5b284.iam.gserviceaccount.com
```

#### 4. FIREBASE_DATABASE_URL
```
Variable name: FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Text (Plain text)
```

#### 5. KAKAO_REST_API_KEY
```
Variable name: KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
Type: Encrypt (⚠️ 권장: Encrypt로 설정)
```

---

## 📝 Cloudflare Dashboard 설정 단계

1. https://dash.cloudflare.com/ 로그인
2. 좌측 메뉴 → **Workers & Pages**
3. **ur-live** (또는 **ur-live-kr**) 프로젝트 선택
4. 상단 탭 → **Settings**
5. 좌측 메뉴 → **Environment variables**
6. **Production** 탭 선택
7. 각 변수마다 **Add variable** 버튼 클릭하여 추가

---

## 🧪 설정 완료 확인 방법

### 1. Cloudflare Dashboard에서 확인
- Environment variables 탭에서 5개 변수 모두 표시되는지 확인
- FIREBASE_PRIVATE_KEY는 `(encrypted)` 표시 확인

### 2. 재배포
1. **Deployments** 탭으로 이동
2. 최신 deployment 우측 **···** 메뉴
3. **Retry deployment** 클릭
4. 약 3분 대기

### 3. 로그인 테스트
1. https://live.ur-team.com/login 접속
2. **카카오 로그인** 버튼 클릭
3. Kakao OAuth 인증 화면에서 로그인
4. 리다이렉트 후 프로필 페이지로 이동 확인

### 4. 에러 확인
브라우저 콘솔(F12)에서 다음 에러가 **사라졌는지** 확인:
```
❌ Firebase custom token creation failed
❌ Missing FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID
```

---

## ⚠️ 트러블슈팅

### 문제 1: "still getting 500 error"
**해결**: 환경변수 추가 후 반드시 재배포 필요
```bash
# 또는 로컬에서 더미 커밋 push
git commit --allow-empty -m "chore: Trigger redeploy"
git push origin main
```

### 문제 2: "Invalid private key format"
**해결**: Private key에 개행문자(`\n`) 포함 확인
- JSON 파일에서 `private_key` 값을 **그대로** 복사
- 따옴표(`"`) 제외

### 문제 3: "Firebase credentials not configured"
**해결**: 환경변수 이름 정확히 입력
- ✅ `FIREBASE_PROJECT_ID` (O)
- ❌ `VITE_FIREBASE_PROJECT_ID` (X) ← VITE_ 붙이면 안 됨

---

## 📊 완료 후 예상 결과

| 기능 | Before | After |
|-----|--------|-------|
| 로그인 | ❌ 500 error | ✅ 정상 작동 |
| Firebase Custom Token | ❌ 생성 실패 | ✅ 생성 성공 |
| Kakao OAuth | ❌ 차단됨 | ✅ 리다이렉트 성공 |
| 프로필 페이지 | ❌ 접근 불가 | ✅ 접근 가능 |

---

## 🔗 참고 링크

- Firebase Console: https://console.firebase.google.com/
- Cloudflare Dashboard: https://dash.cloudflare.com/
- 상세 가이드: `CLOUDFLARE_WORKER_ENV_SETUP.md`

---

**작성일**: 2026-03-17  
**예상 소요 시간**: 10분 (Firebase JSON 다운로드 5분 + Cloudflare 설정 5분)
