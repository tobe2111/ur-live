# Firebase Authorized Domains 설정 가이드

## 🎯 문제 증상

```
auth/unauthorized-domain: This domain (5174-inh6ye2hzktmo586gwg9c-c07dda5e.sandbox.novita.ai) 
is not authorized to run this operation. 
Add it to the OAuth redirect domains list in the Firebase console.
```

---

## ✅ 해결 방법

### **Step 1: Firebase Console 접속**
1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택 (UR-Live)

### **Step 2: Authentication 설정**
1. 좌측 메뉴에서 **Authentication** 클릭
2. 상단 탭에서 **Settings** 클릭
3. **Authorized domains** 섹션 찾기

### **Step 3: 도메인 추가**

#### **프로덕션 도메인 (필수)**
```
live.ur-team.com
world.ur-team.com
global.ur-team.com
```

#### **개발 환경 (선택)**
```
localhost
127.0.0.1
```

#### **Sandbox 도메인 (임시, 개발 중에만)**
```
5173-inh6ye2hzktmo586gwg9c-c07dda5e.sandbox.novita.ai
5174-inh6ye2hzktmo586gwg9c-c07dda5e.sandbox.novita.ai
*.sandbox.novita.ai  (와일드카드 지원되지 않음 - 개별 추가 필요)
```

> ⚠️ **주의**: Sandbox 도메인은 세션마다 변경될 수 있으므로, 개발 완료 후 제거 권장

---

## 🔒 OAuth Provider 설정 (Kakao + Google)

### **Kakao 로그인 설정**
1. Firebase Console → Authentication → Sign-in method
2. Kakao 활성화
3. **Redirect URI** 등록:
   - `https://live.ur-team.com/auth/kakao/sync/callback`
   - `https://world.ur-team.com/auth/kakao/sync/callback`

### **Google 로그인 설정**
1. Firebase Console → Authentication → Sign-in method
2. Google 활성화
3. **Authorized domains**에 자동 추가됨

---

## 🧪 테스트 방법

### **1. 로컬 환경 (localhost)**
```bash
npm run dev:kr
# 브라우저: http://localhost:5173
# 카카오 로그인 시도 → 성공
```

### **2. Sandbox 환경**
```bash
# Authorized domains에 다음 추가:
# 5173-inh6ye2hzktmo586gwg9c-c07dda5e.sandbox.novita.ai

# 브라우저: https://5173-inh6ye2hzktmo586gwg9c-c07dda5e.sandbox.novita.ai
# 카카오 로그인 시도 → 성공
```

### **3. 프로덕션 환경**
```bash
npm run build:kr
npm run deploy

# 브라우저: https://live.ur-team.com
# 카카오 로그인 시도 → 성공
```

---

## 📋 권장 도메인 목록 (최종)

```
localhost
live.ur-team.com
world.ur-team.com
global.ur-team.com
```

개발 중 sandbox 도메인은 필요 시 임시 추가 후, 배포 전 제거

---

## 🔧 Kakao Developers 설정 (추가 작업)

Kakao 로그인도 동일하게 **Redirect URI**를 등록해야 합니다.

### **Kakao Developers Console 접속**
1. https://developers.kakao.com/ 접속
2. 내 애플리케이션 → UR-Live 선택

### **Redirect URI 추가**
1. 좌측 메뉴 → **카카오 로그인** → **Redirect URI**
2. 다음 URI 추가:
   ```
   https://live.ur-team.com/auth/kakao/sync/callback
   https://world.ur-team.com/auth/kakao/sync/callback
   http://localhost:5173/auth/kakao/sync/callback  (개발용)
   ```

3. **Web 플랫폼 도메인** 추가:
   ```
   https://live.ur-team.com
   https://world.ur-team.com
   http://localhost:5173  (개발용)
   ```

---

## ✅ 완료 체크리스트

- [ ] Firebase Authorized domains에 `live.ur-team.com` 추가
- [ ] Firebase Authorized domains에 `world.ur-team.com` 추가
- [ ] Firebase Authorized domains에 `localhost` 추가 (개발용)
- [ ] Firebase Authentication에서 Kakao Provider 활성화
- [ ] Firebase Authentication에서 Google Provider 활성화
- [ ] Kakao Developers에 Redirect URI 등록
- [ ] Kakao Developers에 Web 플랫폼 도메인 등록
- [ ] 로컬 환경에서 로그인 테스트
- [ ] 프로덕션 환경에서 로그인 테스트

---

## 🚀 배포 후 확인사항

1. **KR 버전 (live.ur-team.com)**
   - Kakao 로그인 정상 작동
   - TossPayments 위젯 로드 정상

2. **GLOBAL 버전 (world.ur-team.com)**
   - Google 로그인 정상 작동
   - Stripe Checkout 정상

3. **Dev Server**
   - localhost:5173 (KR 모드)
   - localhost:5174 (GLOBAL 모드)
   - Invalid hook call 에러 없음 ✅

---

## 📞 문제 해결

### **Q1: "auth/unauthorized-domain" 에러가 계속 발생해요**
→ Firebase Console에서 Authorized domains에 정확한 도메인을 추가했는지 확인
→ 도메인 앞에 `http://` 또는 `https://` 제거 (도메인만 입력)
→ Firebase Console에서 변경 사항 저장 후 5분 대기

### **Q2: Sandbox 도메인이 자주 바뀌는데 매번 추가해야 하나요?**
→ 개발 중에는 `localhost`로 테스트 권장
→ Sandbox는 최종 확인용으로만 사용
→ 프로덕션 배포 전 sandbox 도메인 제거

### **Q3: Kakao 로그인은 되는데 Google 로그인이 안 돼요**
→ Firebase Authentication에서 Google Provider가 활성화되어 있는지 확인
→ Google OAuth Client ID가 올바른지 확인
→ `.env.global` 파일에 `VITE_GOOGLE_CLIENT_ID` 설정 확인

---

**작성일**: 2026-03-05
**작성자**: Claude (12년차 React + Firebase 전문가)
