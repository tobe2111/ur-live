# Cloudflare Pages 환경 변수 복사용 (Dashboard UI)

## KR 프로젝트 (ur-live-kr)

> Cloudflare Dashboard → Workers & Pages → ur-live-kr → Settings → Environment variables → Production
> 
> 아래 각 변수를 하나씩 **Add variable** 버튼으로 추가하세요.

---

### 변수 1
```
Variable name: VITE_FIREBASE_API_KEY
Value: AIzaSyCxmgG3NEXsWtHKbE425dvq5EWs3WHXOh8
```

### 변수 2
```
Variable name: VITE_FIREBASE_AUTH_DOMAIN
Value: urteam-live-commerce-5b284.firebaseapp.com
```

### 변수 3
```
Variable name: VITE_FIREBASE_PROJECT_ID
Value: urteam-live-commerce-5b284
```

### 변수 4
```
Variable name: VITE_FIREBASE_STORAGE_BUCKET
Value: urteam-live-commerce-5b284.firebasestorage.app
```

### 변수 5
```
Variable name: VITE_FIREBASE_MESSAGING_SENDER_ID
Value: 352937066044
```

### 변수 6
```
Variable name: VITE_FIREBASE_APP_ID
Value: 1:352937066044:web:e5bfd5e1d8f61688e30d39
```

### 변수 7
```
Variable name: VITE_FIREBASE_MEASUREMENT_ID
Value: G-TEST123456
```

### 변수 8
```
Variable name: VITE_FIREBASE_DATABASE_URL
Value: https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```

---

### 변수 9
```
Variable name: VITE_KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
```

### 변수 10
```
Variable name: VITE_KAKAO_JAVASCRIPT_KEY
Value: 975a2e7f97254b08f15dba4d177a2865
```

### 변수 11
```
Variable name: VITE_KAKAO_AUTH_URL
Value: https://kauth.kakao.com
```

---

### 변수 12
```
Variable name: VITE_TOSS_CLIENT_KEY
Value: test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

---

### 변수 13
```
Variable name: VITE_REGION
Value: KR
```

### 변수 14
```
Variable name: VITE_DEFAULT_LANGUAGE
Value: ko
```

### 변수 15
```
Variable name: VITE_API_BASE_URL
Value: https://live.ur-team.com
```

---

## Backend Secrets (Cloudflare Workers 전용)

> 추가로 필요한 Backend 환경 변수 (총 5개)

### Backend 변수 1
```
Variable name: KAKAO_REST_API_KEY
Value: 5dd74bccb797640b0efd070467f3bafd
```

### Backend 변수 2
```
Variable name: JWT_SECRET
Value: [안전한 랜덤 문자열 생성]
```
생성 방법:
```bash
openssl rand -base64 32
```

### Backend 변수 3
```
Variable name: EMAIL_FROM
Value: UR Live <noreply@ur-team.com>
```

### Backend 변수 4
```
Variable name: RESEND_API_KEY
Value: [Resend에서 발급받은 API Key]
```
발급: https://resend.com/api-keys

### Backend 변수 5
```
Variable name: TOSS_SECRET_KEY
Value: [TossPayments에서 발급받은 Secret Key]
```
발급: https://dashboard.tosspayments.com/

---

## ✅ 설정 완료 후

1. **Deployments** 탭으로 이동
2. 최신 deployment의 **...** 메뉴 → **Retry deployment**
3. 3~5분 대기
4. https://live.ur-team.com 접속하여 확인

---

## 📊 환경 변수 요약

| 카테고리 | 개수 | 상태 |
|---------|------|------|
| Firebase | 8 | ✅ 실제 키 |
| Kakao | 3 | ✅ 실제 키 |
| Toss | 1 | ⚠️ 테스트 키 |
| 기타 | 3 | ✅ 설정 완료 |
| Backend | 5 | ⚠️ 일부 설정 필요 |
| **합계** | **20** | |

---

## 🔗 빠른 링크

- Cloudflare Dashboard: https://dash.cloudflare.com/
- Firebase Console: https://console.firebase.google.com/
- Kakao Developers: https://developers.kakao.com/
- TossPayments Dashboard: https://dashboard.tosspayments.com/
- Resend API Keys: https://resend.com/api-keys

---

**작성일**: 2026-03-05  
**목적**: Cloudflare Pages Dashboard UI에서 복사-붙여넣기로 빠르게 환경 변수 설정
