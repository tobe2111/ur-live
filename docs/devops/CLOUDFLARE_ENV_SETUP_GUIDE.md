# Cloudflare Pages 환경변수 설정 가이드

## 📅 작성일: 2026-03-17

---

## 🎯 **목적**

프로덕션 환경(https://live.ur-team.com)에서 Firebase Realtime Database가 정상 작동하도록 Cloudflare Pages 환경변수를 설정합니다.

---

## ⚠️ **현재 상태**

### **문제:**
```
❌ Missing Firebase environment variables: VITE_FIREBASE__D_A_T_A_B_A_S_E_U_R_L
⚠️ Firebase will not work properly without these variables
```

### **원인:**
- `.env` 파일은 Git에 커밋되지 않음 (보안상 올바름) ✅
- Cloudflare Pages는 `.env` 파일을 읽을 수 없음
- 환경변수가 빌드 시 포함되지 않음

### **영향:**
- Firebase Realtime Database 연결 실패
- 라이브 채팅 기능 동작 안 함
- 실시간 알림 기능 동작 안 함

---

## 🔧 **해결 방법: Cloudflare Pages 환경변수 추가**

### **Step 1: Cloudflare Dashboard 접속**

1. 브라우저에서 [https://dash.cloudflare.com/](https://dash.cloudflare.com/) 접속
2. 로그인

### **Step 2: 프로젝트 선택**

1. 왼쪽 메뉴에서 **Workers & Pages** 클릭
2. **ur-live** 프로젝트 클릭

### **Step 3: Environment Variables 메뉴 진입**

1. 상단 탭에서 **Settings** 클릭
2. 왼쪽 사이드바에서 **Environment Variables** 클릭

### **Step 4: Production 환경변수 추가**

1. **Production** 탭 선택
2. **Add variable** 버튼 클릭
3. 다음 정보 입력:

**Variable Name:**
```
VITE_FIREBASE_DATABASE_URL
```

**Variable Value:**
```
https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app
```

4. **Save** 버튼 클릭

### **Step 5: 재배포**

환경변수 추가 후 **자동으로 재배포**되지 않으므로, 수동으로 재배포해야 합니다:

**방법 1: Git Push (권장)**
```bash
# 아무 변경이나 커밋하고 푸시
git commit --allow-empty -m "chore: Trigger deployment after env var setup"
git push origin main
```

**방법 2: Cloudflare Dashboard**
1. **Deployments** 탭 클릭
2. 최신 배포 찾기
3. **Retry deployment** 버튼 클릭

---

## 🧪 **테스트 방법**

### **1. 배포 완료 대기**

Cloudflare Dashboard → Deployments 탭에서:
- **Status: Success** 확인
- 약 1~2분 소요

### **2. 브라우저 테스트**

#### **홈페이지 테스트:**
1. https://live.ur-team.com/ 접속
2. **F12** (개발자 도구) 열기
3. **Console** 탭 확인

**Before (환경변수 없음):**
```
❌ Missing Firebase environment variables: VITE_FIREBASE__D_A_T_A_B_A_S_E_U_R_L
⚠️ Firebase will not work properly without these variables
```

**After (환경변수 설정됨):**
```
✅ Firebase App initialized
✅ Firebase Database connected
```

#### **라이브 페이지 테스트:**
1. https://live.ur-team.com/live/20 접속
2. **콘솔 확인** (F12 → Console)
3. **채팅 입력 테스트**

**Expected Result:**
- ✅ Firebase Database 연결 성공
- ✅ 채팅 입력창 활성화
- ✅ 채팅 메시지 전송 가능

---

## 📊 **추가 환경변수 (선택사항)**

필요한 경우 다음 환경변수도 Cloudflare Pages에 추가할 수 있습니다:

### **Firebase 관련:**
```bash
VITE_FIREBASE_API_KEY=AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
VITE_FIREBASE_AUTH_DOMAIN=toss-live-commerce.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=toss-live-commerce
VITE_FIREBASE_STORAGE_BUCKET=toss-live-commerce.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=408717649003
VITE_FIREBASE_APP_ID=1:408717649003:web:29aa3cb5f92056dd1ec4f4
VITE_FIREBASE_MEASUREMENT_ID=G-78M73BGT77
```

### **Kakao 관련:**
```bash
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_JAVASCRIPT_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
```

### **Toss Payments:**
```bash
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

### **Sentry:**
```bash
VITE_SENTRY_DSN=https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
VITE_SENTRY_ENVIRONMENT=production
```

**참고:**
- 이미 `.env` 파일에 정의되어 있어 Vite 빌드 시 자동으로 포함됨
- Cloudflare Pages에 추가하면 `.env` 파일 없이도 빌드 가능 (더 안전함)

---

## 🔒 **보안 권장사항**

### **1. API Key Rotation Schedule**

| API | 현재 키 | 주기 | 다음 갱신일 |
|-----|---------|------|------------|
| Firebase | `AIzaSy...` | 180일 | 2026-09-13 |
| Kakao REST API | `5dd74bc...` | 90일 | 2026-06-15 |
| Toss (LIVE) | `sk_live_Rk5x...` | 즉시 | **⚠️ 지금** |

### **2. Firebase API Key 제한 설정**

**Google Cloud Console 설정:**
1. [https://console.cloud.google.com/](https://console.cloud.google.com/) 접속
2. **toss-live-commerce** 프로젝트 선택
3. **APIs & Services** → **Credentials**
4. Firebase API Key 클릭
5. **Application restrictions:**
   - **HTTP referrers** 선택
   - 허용 도메인:
     ```
     https://live.ur-team.com/*
     http://localhost:5174/*
     ```
6. **API restrictions:**
   - **Restrict key** 선택
   - 허용 API:
     - Firebase Realtime Database API
     - Firebase Authentication API
     - Identity Toolkit API
7. **Save** 클릭

### **3. Kakao API Key Domain 제한**

**Kakao Developers 설정:**
1. [https://developers.kakao.com/](https://developers.kakao.com/) 접속
2. 내 애플리케이션 선택
3. **플랫폼** 탭:
   - **Web 플랫폼** 추가
   - 사이트 도메인: `https://live.ur-team.com`
4. **Redirect URI**:
   ```
   https://live.ur-team.com/login
   https://live.ur-team.com/auth/kakao/callback
   ```
5. **저장**

### **4. Toss Payments LIVE Secret Key 즉시 갱신 필요 🚨**

**현재 상태:**
```
sk_live_Rk5xZE4K8zRk5nJ5aG2z
```
⚠️ **GitHub에 노출됨** - 즉시 갱신 필요!

**갱신 절차:**
1. [Toss Payments 개발자센터](https://developers.tosspayments.com/) 접속
2. **현재 키 폐기 (Revoke)**
3. **새 LIVE Secret Key 발급**
4. **Cloudflare Pages에 저장:**
   ```bash
   # Wrangler CLI 사용
   cd /home/user/webapp
   npx wrangler secret put TOSS_SECRET_KEY
   # → 새 키 입력 후 Enter
   ```
5. **재배포**

---

## 🎯 **체크리스트**

### **필수 작업 (Immediate):**
- [ ] Cloudflare Pages에 `VITE_FIREBASE_DATABASE_URL` 추가
- [ ] 재배포 후 https://live.ur-team.com/ 테스트
- [ ] Firebase Database 연결 확인
- [ ] 🚨 Toss Payments LIVE Secret Key 갱신

### **권장 작업 (1주일 이내):**
- [ ] Firebase API Key HTTP referrer 제한 설정
- [ ] Kakao API Key Domain 제한 설정
- [ ] 라이브 채팅 기능 테스트 (https://live.ur-team.com/live/20)
- [ ] 전체 결제 플로우 테스트:
  - [ ] 상품 상세페이지 (https://live.ur-team.com/products/1)
  - [ ] 장바구니 추가
  - [ ] 결제 페이지 (https://live.ur-team.com/checkout)
  - [ ] Toss 결제 완료

### **장기 작업 (Optional):**
- [ ] Git history에서 `.env*` 파일 완전 제거 (`git filter-branch`)
- [ ] API Key Rotation 일정 캘린더 등록
- [ ] Google Cloud Billing Alerts 설정

---

## 📋 **문제 해결 (Troubleshooting)**

### **문제 1: 환경변수 추가 후에도 에러 발생**

**원인:** 캐시된 빌드가 사용됨

**해결:**
1. Cloudflare Dashboard → Deployments
2. **Retry deployment** 클릭 (완전 재빌드)
3. 브라우저 캐시 지우기 (Ctrl + Shift + R)

### **문제 2: Firebase Database 연결 안 됨**

**확인사항:**
1. 환경변수 이름 정확히 확인:
   ```
   VITE_FIREBASE_DATABASE_URL (올바름)
   VITE_FIREBASE__D_A_T_A_B_A_S_E_U_R_L (틀림)
   ```
2. Firebase Database URL 형식 확인:
   ```
   https://PROJECT_ID-default-rtdb.REGION.firebasedatabase.app
   ```
3. Firebase Console에서 Realtime Database 활성화 확인

### **문제 3: Cloudflare Pages 환경변수가 보이지 않음**

**원인:** 권한 부족

**해결:**
- Cloudflare 계정 Owner 또는 Admin 권한 필요
- 팀원에게 권한 요청

---

## 🔗 **참고 링크**

- **Cloudflare Dashboard:** https://dash.cloudflare.com/
- **Firebase Console:** https://console.firebase.google.com/
- **Google Cloud Console:** https://console.cloud.google.com/
- **Kakao Developers:** https://developers.kakao.com/
- **Toss Payments:** https://developers.tosspayments.com/
- **GitHub Repository:** https://github.com/tobe2111/ur-live

---

## 📝 **작업 이력**

| 날짜 | 작업 | 상태 |
|------|------|------|
| 2026-03-17 | Firebase Database URL 환경변수 누락 발견 | ✅ |
| 2026-03-17 | `.env` 파일에 `VITE_FIREBASE_DATABASE_URL` 추가 (로컬) | ✅ |
| 2026-03-17 | `public/_headers` CSP에 YouTube 도메인 추가 | ✅ |
| 2026-03-17 | Cloudflare Pages 환경변수 설정 가이드 작성 | ✅ |
| 2026-03-17 | Cloudflare Pages에 환경변수 추가 (수동 필요) | ⏳ |

---

## 🎉 **예상 결과**

환경변수 설정 후:

**홈페이지 (https://live.ur-team.com/):**
```
✅ Firebase App initialized
✅ Firebase Database connected
✅ Firebase Auth 초기화 완료
```

**라이브 페이지 (https://live.ur-team.com/live/20):**
```
✅ Firebase Database 연결 성공
✅ 라이브 채팅 활성화
✅ 실시간 메시지 동기화
```

**상품 상세페이지 (https://live.ur-team.com/products/1):**
```
✅ 상품 정보 정상 표시
✅ 장바구니 추가 가능
✅ 결제 플로우 정상 동작
```

---

**작성자:** AI Assistant  
**작성일:** 2026-03-17  
**소요 시간:** 약 30분  
**Commit:** `6df3adf7` (fix: Add Firebase Database URL and YouTube to CSP)
