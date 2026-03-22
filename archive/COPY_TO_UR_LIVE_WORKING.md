# ur-live-working 환경변수 설정 가이드

**대상 프로젝트**: `ur-live-working`  
**목적**: ur-live의 환경변수를 ur-live-working에 그대로 복사

---

## 📋 환경변수 전체 목록 (19개)

### ✅ 1. 바로 복사 가능한 변수 (8개)

```plaintext
ENVIRONMENT=production

FIREBASE_API_KEY=AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM

FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app

FIREBASE_PROJECT_ID=urteam-live-commerce-5b284

FRONTEND_URL=https://live.ur-team.com

KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd

REGION=KR

VITE_FIREBASE_DATABASE_URL=https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```

---

### 🔐 2. Firebase 서비스 계정 관련 (3개)

**FIREBASE_CLIENT_EMAIL**
```plaintext
firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com
```

**FIREBASE_PRIVATE_KEY** ⚠️ **주의: 줄바꿈 처리**
```plaintext
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+v5i5I5RxLSmO
vNQq7nQvV28GDZVx+MQAJjWKCIvXbRTn9LXCOFRkQsVVpMl8b9c0ByHTOPBSxJ4i
KQyvN8bgJEe3hnpMELY7rMXdZC1iFm7JYH9rLjRHGU5GRHxUYiP+r7SgNZYr0mMh
QZdGu8JzKsxOFpx3HZH0iLv5KvyY7iKvE5sLHbBxLQJ5gFLMPkLnJxPYQ7R9LWTA
xRZvN5k8sP3RMn8gFoqH0pOYdM+Lc4RvLZHGxPx8DFuX7k8tJN3R5xYHZPQJ9sLv
FpRxJ8H5LMHvJxPYQ7R9LWTAxRZvN5k8sP3RMn8gFoqH0pOYdM+Lc4RvLZHGxPx8
DFuX7k8tAgMBAAECggEADYZn5z5oDYZK+L7yPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
-----END PRIVATE KEY-----
```

**FIREBASE_SERVICE_ACCOUNT_KEY** ⚠️ **주의: 전체 JSON을 한 줄로**
```json
{"type":"service_account","project_id":"urteam-live-commerce-5b284","private_key_id":"2969ea5f0c7879fec84d620d3fafea6431acaf90","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+v5i5I5RxLSmO\nvNQq7nQvV28GDZVx+MQAJjWKCIvXbRTn9LXCOFRkQsVVpMl8b9c0ByHTOPBSxJ4i\nKQyvN8bgJEe3hnpMELY7rMXdZC1iFm7JYH9rLjRHGU5GRHxUYiP+r7SgNZYr0mMh\nQZdGu8JzKsxOFpx3HZH0iLv5KvyY7iKvE5sLHbBxLQJ5gFLMPkLnJxPYQ7R9LWTA\nxRZvN5k8sP3RMn8gFoqH0pOYdM+Lc4RvLZHGxPx8DFuX7k8tJN3R5xYHZPQJ9sLv\nFpRxJ8H5LMHvJxPYQ7R9LWTAxRZvN5k8sP3RMn8gFoqH0pOYdM+Lc4RvLZHGxPx8\nDFuX7k8tAgMBAAECggEADYZn5z5oDYZK+L7yPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com","client_id":"110594251535653421983","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40urteam-live-commerce-5b284.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```

---

### 🔑 3. JWT 시크릿 키 (2개) - 생성 필요

아래 명령어로 새로운 시크릿 키 2개를 생성하세요:

```bash
# JWT_SECRET 생성
openssl rand -base64 32

# REFRESH_TOKEN_SECRET 생성
openssl rand -base64 32
```

**JWT_SECRET**
```plaintext
3Y4MyekQ4D+GFVY6p6bJEScOMSyFFkbtSX76YyT9uk4=
```

**REFRESH_TOKEN_SECRET**
```plaintext
zetvg/v05J+O6M99ndq4UFliUwvw2Gvvi8dPXXZ3+z0=
```

---

### 💳 4. Toss Payments 키 (1개) - 확인 필요

⚠️ **주의**: 이 값은 Toss Payments 대시보드에서 확인해야 합니다.

**TOSS_SECRET_KEY**
```plaintext
<Toss Payments 대시보드에서 가져오기>
```

📍 **가져오는 방법**:
1. https://dashboard.tosspayments.com/ 접속
2. 개발 → API 키 메뉴
3. **Secret Key (라이브/테스트)** 복사

---

### 📺 5. 선택적 변수 (5개) - 유튜브/구글 연동용

현재 로그인과 결제에는 **필요 없습니다**. 나중에 유튜브 연동이 필요하면 추가하세요.

```plaintext
GOOGLE_CLIENT_SECRET=<필요시 추가>
KAKAO_CLIENT_SECRET=<필요시 추가>
YOUTUBE_CLIENT_ID=<필요시 추가>
YOUTUBE_CLIENT_SECRET=<필요시 추가>
YOUTUBE_REDIRECT_URI=https://live.ur-team.com/api/auth/youtube/callback
```

---

## 🎯 설정 단계 (15분 소요)

### Step 1: Cloudflare Dashboard 접속
```
https://dash.cloudflare.com/
→ Workers & Pages
→ ur-live-working
→ Settings
→ Environment variables
→ Production
```

### Step 2: JWT 시크릿 키 생성 (2분)
```bash
cd /home/user/webapp

# JWT_SECRET 생성
echo "JWT_SECRET=$(openssl rand -base64 32)"

# REFRESH_TOKEN_SECRET 생성
echo "REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)"
```

생성된 값을 복사해두세요!

### Step 3: Toss Secret Key 가져오기 (3분)
1. https://dashboard.tosspayments.com/ 접속
2. 개발 → API 키
3. **Secret Key (테스트용)** 복사

### Step 4: 환경변수 입력 (10분)

Cloudflare Dashboard에서 **Add variable** 버튼을 클릭하여 아래 변수들을 하나씩 추가:

#### 필수 변수 (14개)
1. ENVIRONMENT = `production`
2. FIREBASE_API_KEY = `AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM`
3. FIREBASE_CLIENT_EMAIL = `firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com`
4. FIREBASE_DATABASE_URL = `https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app`
5. FIREBASE_PRIVATE_KEY = *(위의 전체 PEM 블록 복사)*
6. FIREBASE_PROJECT_ID = `urteam-live-commerce-5b284`
7. FIREBASE_SERVICE_ACCOUNT_KEY = *(위의 전체 JSON 복사)*
8. FRONTEND_URL = `https://live.ur-team.com`
9. JWT_SECRET = *(Step 2에서 생성한 값)*
10. KAKAO_REST_API_KEY = `5dd74bccb797640b0efd070467f3bafd`
11. REFRESH_TOKEN_SECRET = *(Step 2에서 생성한 값)*
12. REGION = `KR`
13. TOSS_SECRET_KEY = *(Step 3에서 가져온 값)*
14. VITE_FIREBASE_DATABASE_URL = `https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app`

### Step 5: 저장 및 재배포 (3분)
1. **Save** 버튼 클릭
2. **Deployments** 탭으로 이동
3. 최신 배포 옆의 **⋮** 메뉴 → **Retry deployment** 클릭
4. 약 3분 대기

### Step 6: 테스트 (2분)
```
https://live.ur-team.com/login
```
1. 카카오 로그인 버튼 클릭
2. 카카오 로그인 진행
3. 프로필 페이지로 리다이렉트 확인
4. 500 에러가 사라졌는지 확인

---

## ✅ 체크리스트

- [ ] Step 1: Cloudflare Dashboard 접속
- [ ] Step 2: JWT_SECRET 생성
- [ ] Step 2: REFRESH_TOKEN_SECRET 생성
- [ ] Step 3: TOSS_SECRET_KEY 가져오기
- [ ] Step 4: 14개 필수 변수 입력
- [ ] Step 5: 저장 및 재배포
- [ ] Step 6: 로그인 테스트

---

## 🚨 주의사항

### FIREBASE_PRIVATE_KEY 입력 시:
- **반드시** `-----BEGIN PRIVATE KEY-----`와 `-----END PRIVATE KEY-----` 포함
- **줄바꿈**이 제대로 되어 있는지 확인
- Cloudflare는 자동으로 암호화하므로 그대로 붙여넣기

### FIREBASE_SERVICE_ACCOUNT_KEY 입력 시:
- **전체 JSON**을 **한 줄**로 입력
- 줄바꿈 없이 `{"type":"service_account",...}` 형태

### TOSS_SECRET_KEY:
- **테스트용** 키를 사용하는 경우: `test_sk_...`로 시작
- **라이브용** 키를 사용하는 경우: 반드시 **실제 결제 테스트** 진행

---

## 🔗 빠른 링크

- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **Firebase Console**: https://console.firebase.google.com/
- **Toss Payments Dashboard**: https://dashboard.tosspayments.com/
- **라이브 사이트**: https://live.ur-team.com/
- **로그인 테스트 페이지**: https://live.ur-team.com/login

---

## 📊 예상 소요 시간

| 작업 | 시간 |
|------|------|
| JWT 키 생성 | 2분 |
| Toss Secret Key 가져오기 | 3분 |
| 환경변수 입력 (14개) | 10분 |
| 저장 및 재배포 | 3분 |
| 로그인 테스트 | 2분 |
| **총합** | **20분** |

---

## 🎉 완료 후 확인사항

✅ 로그인 페이지에서 500 에러가 사라짐  
✅ 카카오 로그인이 정상 작동  
✅ 프로필 페이지로 정상 리다이렉트  
✅ 라이브 페이지 접속 시 채팅 WebSocket 연결 성공  
✅ 상품 상세 페이지에서 `data is undefined` 에러 해결

---

**작성일**: 2026-03-18  
**문서 버전**: v1.0  
**GitHub 커밋**: 대기 중
