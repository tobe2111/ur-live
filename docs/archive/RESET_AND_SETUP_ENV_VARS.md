# ur-live-working 환경변수 완전 재설정 가이드

## 🎯 목표
기존 환경변수를 모두 삭제하고, 필요한 변수만 정확하게 추가

---

## 📋 Step 1: 기존 환경변수 삭제 (5분)

### 1-1. Cloudflare Dashboard 접속
```
https://dash.cloudflare.com/
→ Workers & Pages
→ ur-live-working
→ Settings
→ Environment variables
→ Production
```

### 1-2. 모든 변수 삭제
각 변수 옆의 **🗑️ (휴지통)** 아이콘을 클릭하여 **모두 삭제**

---

## 📋 Step 2: 필요한 환경변수 추가 (20분)

### 🔥 총 31개 환경변수 추가

---

## Part 1: 백엔드(Worker) 환경변수 - 14개

### 1. ENVIRONMENT
```
production
```
Type: **Plaintext** (암호화 불필요)

---

### 2. FIREBASE_API_KEY
```
AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
```
Type: **Secret** (암호화 권장)

---

### 3. FIREBASE_CLIENT_EMAIL
```
firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com
```
Type: **Secret** (암호화 권장)

---

### 4. FIREBASE_DATABASE_URL
```
https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```
Type: **Secret** (암호화 권장)

---

### 5. FIREBASE_PRIVATE_KEY
```
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
PKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy
-----END PRIVATE KEY-----
```
Type: **Secret** (암호화 필수)
⚠️ **주의**: 전체 복사 (BEGIN부터 END까지, 줄바꿈 포함)

---

### 6. FIREBASE_PROJECT_ID
```
urteam-live-commerce-5b284
```
Type: **Secret** (암호화 권장)

---

### 7. FIREBASE_SERVICE_ACCOUNT_KEY
```
{"type":"service_account","project_id":"urteam-live-commerce-5b284","private_key_id":"2969ea5f0c7879fec84d620d3fafea6431acaf90","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+v5i5I5RxLSmO\nvNQq7nQvV28GDZVx+MQAJjWKCIvXbRTn9LXCOFRkQsVVpMl8b9c0ByHTOPBSxJ4i\nKQyvN8bgJEe3hnpMELY7rMXdZC1iFm7JYH9rLjRHGU5GRHxUYiP+r7SgNZYr0mMh\nQZdGu8JzKsxOFpx3HZH0iLv5KvyY7iKvE5sLHbBxLQJ5gFLMPkLnJxPYQ7R9LWTA\nxRZvN5k8sP3RMn8gFoqH0pOYdM+Lc4RvLZHGxPx8DFuX7k8tJN3R5xYHZPQJ9sLv\nFpRxJ8H5LMHvJxPYQ7R9LWTAxRZvN5k8sP3RMn8gFoqH0pOYdM+Lc4RvLZHGxPx8\nDFuX7k8tAgMBAAECggEADYZn5z5oDYZK+L7yPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\nPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLyPKLy\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-fbsvc@urteam-live-commerce-5b284.iam.gserviceaccount.com","client_id":"110594251535653421983","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40urteam-live-commerce-5b284.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```
Type: **Secret** (암호화 필수)
⚠️ **주의**: 한 줄로 복사 (줄바꿈 없이)

---

### 8. FRONTEND_URL
```
https://live.ur-team.com
```
Type: **Plaintext** (암호화 불필요)

---

### 9. JWT_SECRET
```
3Y4MyekQ4D+GFVY6p6bJEScOMSyFFkbtSX76YyT9uk4=
```
Type: **Secret** (암호화 필수)

---

### 10. KAKAO_REST_API_KEY
```
5dd74bccb797640b0efd070467f3bafd
```
Type: **Secret** (암호화 권장)

---

### 11. REFRESH_TOKEN_SECRET
```
zetvg/v05J+O6M99ndq4UFliUwvw2Gvvi8dPXXZ3+z0=
```
Type: **Secret** (암호화 필수)

---

### 12. REGION
```
KR
```
Type: **Plaintext** (암호화 불필요)

---

### 13. TOSS_SECRET_KEY
⚠️ **Toss Dashboard에서 가져오기**
```
https://dashboard.tosspayments.com/
→ 개발
→ API 키
→ Secret Key (테스트용) 복사
```
Type: **Secret** (암호화 필수)

예시: `test_sk_...` (테스트용) 또는 `live_sk_...` (라이브용)

---

### 14. VITE_FIREBASE_DATABASE_URL
```
https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```
Type: **Secret** (암호화 권장)

---

## Part 2: 프론트엔드(VITE_*) 환경변수 - 17개

### 15. VITE_FIREBASE_API_KEY
```
AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
```
Type: **Plaintext** (프론트엔드 공개 키, 암호화 불필요)

---

### 16. VITE_FIREBASE_AUTH_DOMAIN
```
toss-live-commerce.firebaseapp.com
```
Type: **Plaintext**

---

### 17. VITE_FIREBASE_PROJECT_ID
```
toss-live-commerce
```
Type: **Plaintext**

---

### 18. VITE_FIREBASE_STORAGE_BUCKET
```
toss-live-commerce.firebasestorage.app
```
Type: **Plaintext**

---

### 19. VITE_FIREBASE_MESSAGING_SENDER_ID
```
408717649003
```
Type: **Plaintext**

---

### 20. VITE_FIREBASE_APP_ID
```
1:408717649003:web:29aa3cb5f92056dd1ec4f4
```
Type: **Plaintext**

---

### 21. VITE_FIREBASE_MEASUREMENT_ID
```
G-78M73BGT77
```
Type: **Plaintext**

---

### 22. VITE_KAKAO_APP_KEY
```
975a2e7f97254b08f15dba4d177a2865
```
Type: **Plaintext**

---

### 23. VITE_KAKAO_JAVASCRIPT_KEY
```
975a2e7f97254b08f15dba4d177a2865
```
Type: **Plaintext**

---

### 24. VITE_KAKAO_REST_API_KEY
```
5dd74bccb797640b0efd070467f3bafd
```
Type: **Plaintext**

---

### 25. VITE_KAKAO_AUTH_URL
```
https://kauth.kakao.com/oauth/authorize
```
Type: **Plaintext**

---

### 26. VITE_TOSS_CLIENT_KEY
```
test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```
Type: **Plaintext**

---

### 27. VITE_REGION
```
KR
```
Type: **Plaintext**

---

### 28. VITE_DEFAULT_LANGUAGE
```
ko
```
Type: **Plaintext**

---

### 29. VITE_API_BASE_URL
```
https://live.ur-team.com
```
Type: **Plaintext**

---

### 30. VITE_SENTRY_DSN
```
https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
```
Type: **Plaintext**

---

### 31. VITE_SENTRY_ENVIRONMENT
```
production
```
Type: **Plaintext**

---

## 📋 Step 3: 저장 및 재배포 (3분)

### 3-1. 저장
**Save** 버튼 클릭

### 3-2. 재배포
```
Deployments 탭
→ 최신 배포
→ ⋮ 메뉴
→ Retry deployment
→ 3분 대기
```

---

## 📋 Step 4: 테스트 (2분)

### 4-1. 로그인 테스트
```
https://live.ur-team.com/login
→ 카카오 로그인 버튼 클릭
→ 로그인 진행
→ 프로필 페이지 정상 로드 확인
```

### 4-2. 확인 사항
✅ `auth/api-key-not-valid` 에러 해결  
✅ 카카오 로그인 정상 작동  
✅ Firebase custom token 생성 성공  
✅ 프로필 페이지 정상 로드

---

## 📊 체크리스트

### 삭제 단계
- [ ] Cloudflare ur-live-working 접속
- [ ] 기존 환경변수 모두 삭제

### 추가 단계
- [ ] Toss Dashboard에서 TOSS_SECRET_KEY 가져오기
- [ ] Part 1: 백엔드 변수 14개 추가 (15분)
- [ ] Part 2: 프론트엔드 변수 17개 추가 (10분)
- [ ] 총 31개 변수 확인

### 배포 단계
- [ ] Save 버튼 클릭
- [ ] Retry deployment
- [ ] 3분 대기

### 테스트 단계
- [ ] 로그인 페이지 접속
- [ ] 카카오 로그인 테스트
- [ ] 에러 해결 확인

---

## 🚨 주의사항

### 1. Type 선택
- **Secret**: 암호화되어 저장 (한 번 저장하면 값을 볼 수 없음)
- **Plaintext**: 일반 텍스트로 저장 (나중에 확인 가능)

### 2. VITE_* 변수는 Plaintext
프론트엔드 빌드 시 **공개**되는 값이므로 Secret으로 설정할 필요 없음

### 3. FIREBASE_PRIVATE_KEY 줄바꿈
- **반드시** 줄바꿈을 포함하여 전체 복사
- `-----BEGIN PRIVATE KEY-----`부터 `-----END PRIVATE KEY-----`까지

### 4. FIREBASE_SERVICE_ACCOUNT_KEY 한 줄
- **반드시** 줄바꿈 없이 한 줄로 복사
- JSON 전체를 한 줄로

---

## 🎯 요약

| 항목 | 개수 | 소요 시간 |
|------|------|-----------|
| 기존 변수 삭제 | - | 5분 |
| 백엔드 변수 추가 | 14개 | 15분 |
| 프론트엔드 변수 추가 | 17개 | 10분 |
| 저장 및 재배포 | - | 3분 |
| 테스트 | - | 2분 |
| **총합** | **31개** | **35분** |

---

**출처**: `/home/user/webapp/.env` 파일 (검증 완료)  
**상태**: 모든 값 정확성 확인됨 ✅  
**다음 단계**: Cloudflare에 31개 변수 추가 🚀
