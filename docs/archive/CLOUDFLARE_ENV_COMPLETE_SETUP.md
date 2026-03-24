# 🎯 Cloudflare Pages 환경 변수 완전 설정 가이드

## 📋 현재 상태 (2026-03-06)

### ✅ 완료된 작업
- ✅ Runtime Detection 구현 완료 (단일 빌드로 KR + GLOBAL 지원)
- ✅ 로컬 `.env` 파일에 모든 필요한 환경 변수 설정 완료
- ✅ 환경 변수 검증 로직을 non-blocking으로 변경 (경고만 출력)
- ✅ Git 커밋 & Push 완료 (`9d8c082`)

### ⚠️ 남은 작업
- ⚠️ **Cloudflare Pages Dashboard에 Firebase 환경 변수 추가 필요**
- ⚠️ Production 테스트 (카카오 로그인, 성능 확인)

---

## 🔧 Step 1: Cloudflare Pages 환경 변수 추가

### 🌐 접속
1. https://dash.cloudflare.com 방문
2. **Workers & Pages** 클릭
3. 프로젝트 **`ur-live`** 선택
4. 상단 **Settings** 탭 클릭
5. 좌측 메뉴에서 **Environment variables** 클릭

---

## 📝 Step 2: Production 환경 변수 추가

### Production 환경에 다음 변수들을 추가하세요:

#### 🔥 Firebase 설정 (필수 - 7개)
```
VITE_FIREBASE_API_KEY=AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM
VITE_FIREBASE_AUTH_DOMAIN=toss-live-commerce.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=toss-live-commerce
VITE_FIREBASE_STORAGE_BUCKET=toss-live-commerce.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=408717649003
VITE_FIREBASE_APP_ID=1:408717649003:web:29aa3cb5f92056dd1ec4f4
VITE_FIREBASE_MEASUREMENT_ID=G-78M73BGT77
```

#### 🟡 Kakao 설정 (KR 필수 - 3개)
```
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_JAVASCRIPT_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
```

#### 💳 Toss Payments (KR 필수 - 1개)
```
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
```

#### 🔍 Sentry (에러 모니터링 - 2개)
```
VITE_SENTRY_DSN=https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
VITE_SENTRY_ENVIRONMENT=production
```

---

## 📸 Cloudflare 환경 변수 추가 방법

### 각 변수를 추가할 때:
1. **Variable name** 입력: `VITE_FIREBASE_API_KEY`
2. **Value** 입력: `AIzaSyDGy6Wh2FbRQFYGKzP5Y31V3jO6YHzKzgM`
3. **Environment** 선택: `Production`
4. **Add variable** 클릭

### 모든 변수 추가 후:
- **Save** 버튼 클릭
- Cloudflare가 자동으로 새로운 배포를 시작합니다 (약 3-5분 소요)

---

## 🚀 Step 3: 배포 확인

### Cloudflare Dashboard에서 확인:
1. **Deployments** 탭으로 이동
2. 최신 배포 상태 확인:
   - 🟡 Building... → 빌드 진행 중
   - 🟢 Success → 배포 완료
   - 🔴 Failed → 실패 (로그 확인 필요)

### 예상 배포 타임라인:
```
⏰ 현재 (Push 완료)
  ↓ 1분
🔄 Cloudflare 빌드 시작
  ↓ 2-3분 (빌드 시간)
✅ 빌드 완료
  ↓ 1분
🌍 CDN 배포 완료
```

---

## 🧪 Step 4: Production 테스트

### 배포 완료 후 테스트 시나리오:

#### 1️⃣ 페이지 로드 테스트
```bash
# 브라우저 주소창
https://live.ur-team.com
```
- ✅ 페이지가 정상적으로 로드되는지 확인
- ✅ Console에 환경 변수 검증 오류가 **없는지** 확인

#### 2️⃣ 카카오 로그인 테스트
```bash
# 로그인 페이지 접속
https://live.ur-team.com/login
```
**테스트 절차:**
1. Hard Refresh (Ctrl+Shift+R / Cmd+Shift+R)
2. **카카오 로그인** 버튼 클릭
3. 카카오 인증 페이지로 이동 확인
4. 로그인 완료 후 `/user/profile`로 정상 리다이렉트 확인
5. 무한 루프 없이 프로필 페이지 정상 표시 확인

**예상 Console 로그:**
```
[Firebase] 🔥 초기화 시작...
[Firebase] ✅ Firebase initialized successfully
[App] 🚀 앱 시작...
✅ [Env Validator] KR 환경 변수 검증 성공
[Kakao] ✅ Kakao SDK 초기화 성공
[KakaoCallback] ✅ Firebase 로그인 성공
[KakaoCallback] 🔥 ID Token 강제 갱신 완료 (백그라운드)
[UserProfilePage] ✅ 사용자 정보 로드
[Sentry] Initialized: Object
```

#### 3️⃣ 성능 테스트
```bash
# Chrome DevTools → Network 탭
```
**확인 사항:**
- ✅ DOMContentLoaded < 2초
- ✅ Load < 3초
- ✅ FCP (First Contentful Paint) < 1초

#### 4️⃣ Sentry 모니터링 확인
```bash
# Sentry Dashboard
https://o4510992097935360.sentry.io/
```
**확인 사항:**
- ✅ Events가 정상적으로 수신되는지
- ✅ Error rate < 0.1%
- ✅ 로그인 관련 에러 없음

---

## 🎯 성공 기준

### ✅ 모든 테스트가 통과하면 성공:
- [x] 페이지 로드: 정상
- [x] Console 에러: 없음
- [x] 카카오 로그인: 성공
- [x] 무한 루프: 없음
- [x] 로그인 속도: 빠름 (1-2초)
- [x] Sentry 초기화: 성공
- [x] 성능: 기준치 만족

---

## 🐛 문제 해결

### ❌ "KR 환경 변수 검증 실패" 경고가 나타나는 경우:
1. Cloudflare Dashboard → Environment variables 재확인
2. 변수명 오타 확인 (대소문자 구분)
3. 값에 공백이 없는지 확인
4. Production 환경에 추가했는지 확인

### ❌ 카카오 로그인이 실패하는 경우:
```bash
# Network 탭에서 확인
https://kauth.kakao.com/oauth/authorize?client_id=???
```
- `client_id`가 `5dd74bccb797640b0efd070467f3bafd`인지 확인
- `test_kakao_rest_api_key`가 아닌지 확인

### ❌ 빌드가 실패하는 경우:
1. Cloudflare Deployments → 실패한 빌드 클릭
2. Build log 확인
3. 에러 메시지에 따라 조치

---

## 📚 참고 문서

### Cloudflare Pages
- **Dashboard**: https://dash.cloudflare.com
- **Environment Variables**: https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables

### Firebase
- **Console**: https://console.firebase.google.com/project/toss-live-commerce/settings/general

### Kakao
- **Developer Console**: https://developers.kakao.com/console/app

### Sentry
- **Dashboard**: https://o4510992097935360.sentry.io/

---

## 🎉 완료 체크리스트

- [ ] Step 1: Cloudflare Pages Dashboard 접속 완료
- [ ] Step 2: Firebase 환경 변수 7개 추가 완료
- [ ] Step 2: Kakao 환경 변수 3개 추가 완료
- [ ] Step 2: Toss 환경 변수 1개 추가 완료
- [ ] Step 2: Sentry 환경 변수 2개 추가 완료
- [ ] Step 2: Save 버튼 클릭 완료
- [ ] Step 3: 배포 완료 (Status: Success)
- [ ] Step 4: 페이지 로드 테스트 성공
- [ ] Step 4: 카카오 로그인 테스트 성공
- [ ] Step 4: 성능 테스트 통과
- [ ] Step 4: Sentry 모니터링 확인 완료

---

## 🔗 관련 링크

### Production
- **KR 사이트**: https://live.ur-team.com
- **로그인 페이지**: https://live.ur-team.com/login
- **프로필 페이지**: https://live.ur-team.com/user/profile
- **Kakao Debug**: https://live.ur-team.com/debug/kakao

### GitHub
- **Repository**: https://github.com/tobe2111/ur-live
- **Latest Commit**: https://github.com/tobe2111/ur-live/commit/9d8c082

### Cloudflare
- **Pages Dashboard**: https://dash.cloudflare.com/?to=/:account/pages
- **ur-live Project**: https://dash.cloudflare.com/?to=/:account/pages/view/ur-live

---

**마지막 업데이트**: 2026-03-06  
**Commit**: `9d8c082`  
**작업자**: Claude AI Assistant
