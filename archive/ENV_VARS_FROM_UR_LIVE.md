# 🔄 ur-live → ur-live-working 환경변수 복사 (실제 목록)

## 📋 ur-live 프로젝트에 설정된 환경변수 목록

총 **19개 변수**가 ur-live에 설정되어 있습니다.

---

## ✅ 복사할 환경변수 (19개)

### 1. ENVIRONMENT
```
Variable name: ENVIRONMENT
Value: production
Type: Plain text
```

---

### 2. FIREBASE_API_KEY (Secret)
```
Variable name: FIREBASE_API_KEY
Value: AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
Type: Encrypt
```

---

### 3. FIREBASE_CLIENT_EMAIL (Secret)
```
Variable name: FIREBASE_CLIENT_EMAIL
Value: [Firebase Console JSON 파일의 "client_email" 값]
Type: Encrypt
```

**획득 방법**:
1. https://console.firebase.google.com/
2. toss-live-commerce 프로젝트
3. ⚙️ Settings → Service accounts → Generate new private key
4. JSON 다운로드 → `"client_email"` 값 복사

---

### 4. FIREBASE_DATABASE_URL (Secret)
```
Variable name: FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Encrypt
```

---

### 5. FIREBASE_PRIVATE_KEY (Secret)
```
Variable name: FIREBASE_PRIVATE_KEY
Value: [Firebase Console JSON 파일의 "private_key" 값 - 전체!]
Type: Encrypt
```

**형식**:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkq...
(여러 줄)
...
-----END PRIVATE KEY-----
```

---

### 6. FIREBASE_PROJECT_ID (Secret)
```
Variable name: FIREBASE_PROJECT_ID
Value: toss-live-commerce
Type: Encrypt
```

---

### 7. FIREBASE_SERVICE_ACCOUNT_KEY (Secret)
```
Variable name: FIREBASE_SERVICE_ACCOUNT_KEY
Value: [Firebase Console JSON 파일 전체를 문자열로]
Type: Encrypt
```

**형식**: JSON 파일 전체 내용을 **한 줄로**
```json
{"type":"service_account","project_id":"toss-live-commerce","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

⚠️ **주의**: 
- 개행 없이 한 줄로
- 또는 JSON 파일 전체 복사-붙여넣기

---

### 8. FRONTEND_URL
```
Variable name: FRONTEND_URL
Value: https://live.ur-team.com
Type: Plain text
```

---

### 9. GOOGLE_CLIENT_SECRET (Secret)
```
Variable name: GOOGLE_CLIENT_SECRET
Value: [Google Cloud Console에서 확인 필요]
Type: Encrypt
```

⚠️ **선택사항**: Google 로그인을 사용하지 않으면 생략 가능

**획득 방법**:
1. https://console.cloud.google.com/
2. APIs & Services → Credentials
3. OAuth 2.0 Client IDs에서 클라이언트 선택
4. Client secret 복사

---

### 10. JWT_SECRET (Secret)
```
Variable name: JWT_SECRET
Value: [랜덤 생성 필요]
Type: Encrypt
```

**생성 방법**:
```bash
openssl rand -base64 32
```

**예시**:
```
kJ8vN2xR5mL9qT3wP7bH1nA6eD4fC0sY8uI2oV5gK3m=
```

---

### 11. KAKAO_CLIENT_SECRET (Secret)
```
Variable name: KAKAO_CLIENT_SECRET
Value: [Kakao Developers에서 확인 필요]
Type: Encrypt
```

**획득 방법**:
1. https://developers.kakao.com/
2. 내 애플리케이션 → 앱 선택
3. 제품 설정 → 카카오 로그인
4. 보안 탭 → Client Secret 코드 복사

⚠️ **참고**: Kakao Client Secret이 설정되어 있지 않으면 생략 가능

---

### 12. KAKAO_REST_API_KEY (Secret)
```
Variable name: KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
Type: Encrypt
```

---

### 13. REFRESH_TOKEN_SECRET (Secret)
```
Variable name: REFRESH_TOKEN_SECRET
Value: [랜덤 생성 필요]
Type: Encrypt
```

**생성 방법**:
```bash
openssl rand -base64 32
```

**예시**:
```
mN7pQ3xL8jK2vT9wR5bG1nC6eF4hD0sZ8uI2oV5gK3a=
```

---

### 14. REGION
```
Variable name: REGION
Value: KR
Type: Plain text
```

---

### 15. TOSS_SECRET_KEY (Secret)
```
Variable name: TOSS_SECRET_KEY
Value: [Toss Payments Dashboard에서 확인]
Type: Encrypt
```

**획득 방법**:
1. https://dashboard.tosspayments.com/
2. 로그인
3. 개발자센터 → API 키 관리
4. **Secret Key (Live)** 또는 **Secret Key (Test)** 복사

⚠️ **주의**: 
- 테스트: `test_sk_...`로 시작
- 라이브: `live_sk_...`로 시작

---

### 16. VITE_FIREBASE_DATABASE_URL (Secret)
```
Variable name: VITE_FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Encrypt (또는 Plain text)
```

---

### 17. YOUTUBE_CLIENT_ID (Secret)
```
Variable name: YOUTUBE_CLIENT_ID
Value: [Google Cloud Console에서 확인]
Type: Encrypt
```

⚠️ **선택사항**: YouTube 연동을 사용하지 않으면 생략 가능

**획득 방법**:
1. https://console.cloud.google.com/
2. APIs & Services → Credentials
3. OAuth 2.0 Client ID 선택
4. Client ID 복사

---

### 18. YOUTUBE_CLIENT_SECRET (Secret)
```
Variable name: YOUTUBE_CLIENT_SECRET
Value: [Google Cloud Console에서 확인]
Type: Encrypt
```

---

### 19. YOUTUBE_REDIRECT_URI (Secret)
```
Variable name: YOUTUBE_REDIRECT_URI
Value: https://live.ur-team.com/api/auth/youtube/callback
Type: Encrypt (또는 Plain text)
```

---

## 🎯 우선순위별 추가 순서

### 🔴 필수 (로그인/결제) - 12개

**바로 추가 가능 (값 있음)**:
1. ✅ ENVIRONMENT = `production`
2. ✅ FIREBASE_API_KEY = `AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM`
3. ✅ FIREBASE_DATABASE_URL = `https://urteam-live-commerce-5b284-default-rtdb...`
4. ✅ FIREBASE_PROJECT_ID = `toss-live-commerce`
5. ✅ FRONTEND_URL = `https://live.ur-team.com`
6. ✅ KAKAO_REST_API_KEY = `5dd74bccb797640b0efd070467f3bafd`
7. ✅ REGION = `KR`
8. ✅ VITE_FIREBASE_DATABASE_URL = `https://urteam-live-commerce-5b284-default-rtdb...`

**Firebase Console 필요 (JSON 다운로드)**:
9. 🔴 FIREBASE_CLIENT_EMAIL
10. 🔴 FIREBASE_PRIVATE_KEY
11. 🔴 FIREBASE_SERVICE_ACCOUNT_KEY (JSON 전체)

**생성 필요**:
12. 🟡 JWT_SECRET (openssl rand -base64 32)

---

### 🟡 중요 (결제, 토큰 갱신) - 2개

13. 🟠 TOSS_SECRET_KEY (Toss Dashboard)
14. 🟡 REFRESH_TOKEN_SECRET (openssl rand -base64 32)

---

### 🟢 선택사항 (Google/YouTube 연동) - 5개

15. ⚪ GOOGLE_CLIENT_SECRET
16. ⚪ KAKAO_CLIENT_SECRET
17. ⚪ YOUTUBE_CLIENT_ID
18. ⚪ YOUTUBE_CLIENT_SECRET
19. ⚪ YOUTUBE_REDIRECT_URI

---

## 📝 단계별 작업 가이드

### Step 1: Firebase Service Account JSON 다운로드 (5분)

```
1. https://console.firebase.google.com/
2. 프로젝트: toss-live-commerce
3. ⚙️ Project settings → Service accounts
4. "Generate new private key" 버튼
5. JSON 파일 다운로드
```

JSON 파일 예시:
```json
{
  "type": "service_account",
  "project_id": "toss-live-commerce",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@toss-live-commerce.iam.gserviceaccount.com",
  ...
}
```

---

### Step 2: JWT Secret 생성 (1분)

로컬 터미널 또는 온라인 도구:
```bash
# JWT_SECRET
openssl rand -base64 32

# REFRESH_TOKEN_SECRET (다른 값으로)
openssl rand -base64 32
```

---

### Step 3: Cloudflare에 환경변수 추가 (10분)

```
https://dash.cloudflare.com/
→ Workers & Pages
→ ur-live-working
→ Settings → Environment variables → Production
```

**추가 순서**:

**1-8번**: 위 값 복사-붙여넣기 (바로 추가 가능)

**9-11번**: Firebase JSON 파일에서 복사
- FIREBASE_CLIENT_EMAIL = JSON의 `client_email`
- FIREBASE_PRIVATE_KEY = JSON의 `private_key` (전체)
- FIREBASE_SERVICE_ACCOUNT_KEY = JSON 파일 전체를 한 줄로

**12번**: JWT_SECRET = 생성한 값

**선택사항**:
- TOSS_SECRET_KEY = Toss Dashboard에서
- REFRESH_TOKEN_SECRET = 생성한 값
- Google/YouTube 관련 = 사용하면 추가

---

### Step 4: 재배포 및 테스트 (5분)

```
Deployments 탭 → Retry deployment → 3분 대기
→ https://live.ur-team.com/login → 로그인 테스트
```

---

## 🔍 트러블슈팅

### FIREBASE_SERVICE_ACCOUNT_KEY 형식

**옵션 A**: JSON을 한 줄로 압축
```bash
# 로컬에서 jq 사용
cat firebase-key.json | jq -c
```

**옵션 B**: 그냥 JSON 파일 전체 복사-붙여넣기
- Cloudflare가 자동으로 처리

---

## 📊 체크리스트

### 필수 변수 (12개)
- [ ] ENVIRONMENT
- [ ] FIREBASE_API_KEY
- [ ] FIREBASE_CLIENT_EMAIL (Firebase JSON)
- [ ] FIREBASE_DATABASE_URL
- [ ] FIREBASE_PRIVATE_KEY (Firebase JSON)
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_SERVICE_ACCOUNT_KEY (Firebase JSON)
- [ ] FRONTEND_URL
- [ ] JWT_SECRET (생성)
- [ ] KAKAO_REST_API_KEY
- [ ] REGION
- [ ] VITE_FIREBASE_DATABASE_URL

### 중요 변수 (2개)
- [ ] TOSS_SECRET_KEY (Toss Dashboard)
- [ ] REFRESH_TOKEN_SECRET (생성)

### 선택 변수 (5개)
- [ ] GOOGLE_CLIENT_SECRET
- [ ] KAKAO_CLIENT_SECRET
- [ ] YOUTUBE_CLIENT_ID
- [ ] YOUTUBE_CLIENT_SECRET
- [ ] YOUTUBE_REDIRECT_URI

---

## 🎯 요약

| 카테고리 | 개수 | 획득 방법 |
|---------|------|----------|
| 바로 추가 가능 | 8 | 위 목록 복사 |
| Firebase JSON 필요 | 3 | Firebase Console |
| 생성 필요 | 2 | openssl rand |
| 외부 서비스 | 1 | Toss Dashboard |
| 선택사항 | 5 | 필요 시 추가 |
| **합계** | **19** | |

---

**예상 소요 시간**: 
- 최소 (필수만): 15분
- 전체: 25분

**Firebase Console**: https://console.firebase.google.com/  
**Cloudflare Dashboard**: https://dash.cloudflare.com/  
**Toss Dashboard**: https://dashboard.tosspayments.com/
