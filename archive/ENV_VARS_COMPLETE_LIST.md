# 🔑 ur-live-working 환경변수 전체 목록 (복사용)

## 📋 전체 환경변수 (총 22개)

### ✅ 바로 추가 가능한 변수 (17개)

---

### 1. VITE_FIREBASE_API_KEY
```
Variable name: VITE_FIREBASE_API_KEY
Value: AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
Type: Plain text
```

---

### 2. VITE_FIREBASE_AUTH_DOMAIN
```
Variable name: VITE_FIREBASE_AUTH_DOMAIN
Value: toss-live-commerce.firebaseapp.com
Type: Plain text
```

---

### 3. VITE_FIREBASE_DATABASE_URL
```
Variable name: VITE_FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Plain text
```

---

### 4. VITE_FIREBASE_PROJECT_ID
```
Variable name: VITE_FIREBASE_PROJECT_ID
Value: toss-live-commerce
Type: Plain text
```

---

### 5. VITE_FIREBASE_STORAGE_BUCKET
```
Variable name: VITE_FIREBASE_STORAGE_BUCKET
Value: toss-live-commerce.firebasestorage.app
Type: Plain text
```

---

### 6. VITE_FIREBASE_MESSAGING_SENDER_ID
```
Variable name: VITE_FIREBASE_MESSAGING_SENDER_ID
Value: 408717649003
Type: Plain text
```

---

### 7. VITE_FIREBASE_APP_ID
```
Variable name: VITE_FIREBASE_APP_ID
Value: 1:408717649003:web:29aa3cb5f92056dd1ec4f4
Type: Plain text
```

---

### 8. VITE_FIREBASE_MEASUREMENT_ID
```
Variable name: VITE_FIREBASE_MEASUREMENT_ID
Value: G-78M73BGT77
Type: Plain text
```

---

### 9. VITE_KAKAO_APP_KEY
```
Variable name: VITE_KAKAO_APP_KEY
Value: 975a2e7f97254b08f15dba4d177a2865
Type: Plain text
```

---

### 10. VITE_KAKAO_JAVASCRIPT_KEY
```
Variable name: VITE_KAKAO_JAVASCRIPT_KEY
Value: 975a2e7f97254b08f15dba4d177a2865
Type: Plain text
```

---

### 11. VITE_KAKAO_REST_API_KEY
```
Variable name: VITE_KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
Type: Plain text
```

---

### 12. VITE_TOSS_CLIENT_KEY
```
Variable name: VITE_TOSS_CLIENT_KEY
Value: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
Type: Plain text
```

---

### 13. VITE_REGION
```
Variable name: VITE_REGION
Value: KR
Type: Plain text
```

---

### 14. VITE_DEFAULT_LANGUAGE
```
Variable name: VITE_DEFAULT_LANGUAGE
Value: ko
Type: Plain text
```

---

### 15. VITE_API_BASE_URL
```
Variable name: VITE_API_BASE_URL
Value: https://live.ur-team.com
Type: Plain text
```

---

### 16. VITE_SENTRY_DSN
```
Variable name: VITE_SENTRY_DSN
Value: https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
Type: Plain text
```

---

### 17. VITE_SENTRY_ENVIRONMENT
```
Variable name: VITE_SENTRY_ENVIRONMENT
Value: production
Type: Plain text
```

---

## 🔴 Firebase Console에서 다운로드 필요 (5개)

### ⚠️ 이 변수들은 Firebase Service Account JSON 파일에서 가져와야 합니다!

---

### Firebase Console에서 Service Account JSON 다운로드하기:

1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택: **toss-live-commerce** 또는 **urteam-live-commerce-5b284**
3. 좌측 상단 ⚙️ 아이콘 클릭 → **Project settings**
4. 상단 탭에서 **Service accounts** 선택
5. 하단 **Generate new private key** 버튼 클릭
6. 확인 → JSON 파일 다운로드됨

---

### JSON 파일 예시:
```json
{
  "type": "service_account",
  "project_id": "toss-live-commerce",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@toss-live-commerce.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

---

### 18. FIREBASE_PROJECT_ID
```
Variable name: FIREBASE_PROJECT_ID
Value: [JSON 파일의 "project_id" 값]
예: toss-live-commerce
Type: Plain text
```

**JSON 파일에서 찾기**:
```json
"project_id": "이 값을 복사"
```

---

### 19. FIREBASE_PRIVATE_KEY ⚠️ 중요!
```
Variable name: FIREBASE_PRIVATE_KEY
Value: [JSON 파일의 "private_key" 값 - 전체 복사!]
Type: Encrypt (권장)
```

**JSON 파일에서 찾기**:
```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n"
```

**⚠️ 주의사항**:
- `-----BEGIN PRIVATE KEY-----` 부터 시작
- `-----END PRIVATE KEY-----` 까지 **전체 복사**
- `\n` (개행문자) **포함**해서 복사
- 따옴표(`"`) **제외**

**올바른 형식**:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
(여러 줄)
...
-----END PRIVATE KEY-----
```

---

### 20. FIREBASE_CLIENT_EMAIL
```
Variable name: FIREBASE_CLIENT_EMAIL
Value: [JSON 파일의 "client_email" 값]
예: firebase-adminsdk-xxxxx@toss-live-commerce.iam.gserviceaccount.com
Type: Plain text
```

**JSON 파일에서 찾기**:
```json
"client_email": "이 값을 복사"
```

---

### 21. FIREBASE_DATABASE_URL
```
Variable name: FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
Type: Plain text
```

⚠️ **주의**: 이 값은 JSON 파일에 **없을 수 있습니다**!
위 값을 그대로 사용하세요.

---

### 22. KAKAO_REST_API_KEY
```
Variable name: KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
Type: Encrypt (권장)
```

---

## 📝 Cloudflare Dashboard 추가 작업 순서

### 1. Cloudflare Dashboard 접속
```
https://dash.cloudflare.com/
→ Workers & Pages
→ ur-live-working 선택
→ Settings 탭
→ Environment variables
→ Production 탭
```

---

### 2. 변수 추가 (22번 반복)

**1-17번 변수**: 위 목록에서 복사-붙여넣기

**18-22번 변수**: Firebase JSON 파일에서 값 복사

각 변수마다:
```
1. "Add variable" 버튼 클릭
2. Variable name 입력
3. Value 붙여넣기
4. Type 선택 (Plain text 또는 Encrypt)
5. "Add variable" 클릭
```

---

### 3. 재배포
```
Deployments 탭
→ 최신 deployment 우측 ···
→ "Retry deployment" 클릭
→ 3분 대기
```

---

### 4. 테스트
```
https://live.ur-team.com/login
→ 카카오 로그인 클릭
→ 정상 작동 확인
```

---

## 🔍 트러블슈팅

### FIREBASE_PRIVATE_KEY 형식 에러
```
❌ 잘못된 형식:
"-----BEGIN PRIVATE KEY-----\nMIIE..."  (따옴표 포함)

✅ 올바른 형식:
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkq...
-----END PRIVATE KEY-----
```

### 개행문자 처리
- JSON 파일의 `\n`을 실제 엔터로 변환할 필요 **없음**
- 그대로 복사해서 붙여넣으면 Cloudflare가 자동 처리

---

## 📊 체크리스트

### ur-live-working Environment variables (22개)

**Frontend (17개)**:
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
- [ ] VITE_TOSS_CLIENT_KEY
- [ ] VITE_REGION
- [ ] VITE_DEFAULT_LANGUAGE
- [ ] VITE_API_BASE_URL
- [ ] VITE_SENTRY_DSN
- [ ] VITE_SENTRY_ENVIRONMENT

**Backend (5개)** - Firebase JSON 필요:
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_PRIVATE_KEY (Encrypt)
- [ ] FIREBASE_CLIENT_EMAIL
- [ ] FIREBASE_DATABASE_URL
- [ ] KAKAO_REST_API_KEY (Encrypt)

---

## 🎯 요약

| 카테고리 | 개수 | 상태 |
|---------|------|------|
| 바로 추가 가능 | 17 | ✅ 위 목록 복사 |
| Firebase JSON 필요 | 5 | 🔴 다운로드 필요 |
| **합계** | **22** | |

---

**Firebase Console**: https://console.firebase.google.com/  
**Cloudflare Dashboard**: https://dash.cloudflare.com/  
**예상 시간**: 20분 (Firebase 다운로드 5분 + 변수 추가 15분)
