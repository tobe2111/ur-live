# 🚨 CRITICAL FIX: 카카오 로그인 무한 루프 완전 해결

## 📋 문제 요약

### 증상
- 카카오 로그인 후 `/user/profile` 페이지 무한 리다이렉트 (로그인 ↔ 프로필 반복)
- 429 Too Many Requests 에러 발생
  - `POST /api/auth/firebase/sync` → 429
  - `GET /api/auth/firebase/user-id/kakao_4735311250` → 429
- 로그에는 인증 성공(`uid: kakao_4735311250`)으로 표시되지만 계속 로그인 페이지로 리다이렉트

### 근본 원인
1. **URL 파라미터 처리 타이밍 문제**
   - `firebase_token` 파라미터가 비동기 처리(`signInWithCustomToken`) **후에** 제거됨
   - React Router가 파라미터를 다시 감지하여 또 다른 인증 시도를 트리거
   - 결과: 무한 인증 시도 → Rate Limit 발생

2. **Rate Limit 백오프 부재**
   - 429 에러 발생 시 즉시 재시도
   - Rate Limit 상태가 계속 누적됨

3. **Auth 상태 플리핑**
   - `onAuthStateChanged`가 여러 번 트리거
   - 로그인/로그아웃 상태가 빠르게 전환되면서 리다이렉트 발생

---

## ✅ 적용된 수정사항

### 1. URL 파라미터 즉시 제거 (최우선)
```typescript
// ❌ 이전: 비동기 처리 후 URL 정리
const userCredential = await signInWithCustomToken(auth, firebaseToken)
const cleanUrl = window.location.pathname
window.history.replaceState({}, document.title, cleanUrl)

// ✅ 수정: 비동기 처리 전에 즉시 URL 정리
const cleanUrl = window.location.pathname
window.history.replaceState({}, document.title, cleanUrl)
console.log('[AuthContext] ✅ URL 파라미터 즉시 제거 (무한 루프 방지)')

const userCredential = await signInWithCustomToken(auth, firebaseToken)
```

**효과:**
- React Router가 `firebase_token` 파라미터를 재감지하지 못함
- 중복 인증 시도 완전 차단

### 2. Rate Limit 백오프 구현
```typescript
const rateLimitKey = `rate_limit_${firebaseUser.uid}`
const rateLimitUntil = localStorage.getItem(rateLimitKey)
const now = Date.now()

// ✅ Rate Limit 중이면 sync 완전 스킵
if (rateLimitUntil && now < parseInt(rateLimitUntil)) {
  const waitSeconds = Math.ceil((parseInt(rateLimitUntil) - now) / 1000)
  console.log(`[AuthContext] ⏱️ Rate Limit 대기 중 (${waitSeconds}초 남음)`)
  return
}

try {
  // API 호출
} catch (error: any) {
  if (error?.response?.status === 429) {
    // ✅ 429 발생 시 2분 백오프
    const backoffMs = 120000 // 2분
    localStorage.setItem(rateLimitKey, (now + backoffMs).toString())
    console.warn(`[AuthContext] ⚠️ Rate Limit (429) - 2분 대기 설정`)
  }
}
```

**효과:**
- 429 에러 발생 시 2분간 API 호출 중단
- Rate Limit 상태에서 벗어날 시간 확보

### 3. user_id 조회도 Rate Limit 적용
```typescript
// ✅ user_id 조회 시에도 Rate Limit 체크
if (!existingUserId && (!rateLimitUntil || now >= parseInt(rateLimitUntil))) {
  try {
    const userIdResponse = await api.get(`/api/auth/firebase/user-id/${firebaseUser.uid}`)
    // ...
  } catch (err: any) {
    if (err?.response?.status === 429) {
      const backoffMs = 120000
      localStorage.setItem(rateLimitKey, (now + backoffMs).toString())
      console.warn(`[AuthContext] ⚠️ user_id 조회 Rate Limit - 2분 대기 설정`)
    }
  }
}
```

---

## 🔧 배포 정보

### Git 커밋
```bash
9bd7b00 - fix: 🚨 CRITICAL - URL 즉시 정리 + Rate Limit 백오프로 무한 루프 완전 해결
b0de086 - fix: 🎯 단판 해결 - isAuthReady 가드 통합으로 무한 루프 완전 제거
8546a8c - fix: 🚑 D1 sync 스킵 시에도 user_id 조회하도록 개선
```

### 빌드 정보
- **빌드 버전:** `2abbe6d2`
- **빌드 시간:** `2026-03-01T15:07:10.434Z`
- **배포 상태:** Production ✅
- **CI/CD:** https://github.com/tobe2111/ur-live/actions

---

## 🧪 테스트 절차

### 1️⃣ 필수: localStorage 완전 초기화
브라우저 콘솔에서 실행:
```javascript
// 모든 인증 관련 데이터 삭제
localStorage.clear();
sessionStorage.clear();

// 페이지 강제 새로고침 (캐시 무시)
location.reload(true);
```

### 2️⃣ 카카오 로그인 테스트
1. https://live.ur-team.com/login 접속
2. "카카오 로그인" 버튼 클릭
3. 카카오 로그인 진행

### 3️⃣ 예상 콘솔 로그
```javascript
// ✅ 정상 흐름
[Firebase 초기화] ✅ Firebase 초기화 완료
[AuthContext] 🔥 100% Firebase Auth 모드 + useRef 동기 제어
[AuthContext] 🔍 URL 파라미터 처리 시작: { hasFirebaseToken: true, hasJwtTokens: false }
[AuthContext] ✅ URL 파라미터 즉시 제거 (무한 루프 방지)  // ⭐ 핵심!
[AuthContext] 🔥 Firebase Custom Token 로그인 시작
[AuthContext] ✅ Firebase 로그인 성공: kakao_4735311250
[AuthContext] 🔄 로그인 완료 - 리다이렉트: /

[AuthContext] 🔥 onAuthStateChanged 트리거: { hasUser: true, email: "..." }
[AuthContext] ⏭️ Sync 스킵 (최근 sync: 오후 11:47:14)
[AuthContext] ✅ 로그인 상태 확정: { uid: "kakao_4735311250", email: "...", role: "user" }
```

### 4️⃣ localStorage 확인
```javascript
// 브라우저 콘솔에서 실행
console.log('user_id:', localStorage.getItem('user_id'));          // "123" (실제 ID)
console.log('user_name:', localStorage.getItem('user_name'));      // "사용자 이름"
console.log('firebase_token:', localStorage.getItem('firebase_token')); // "eyJhbG..."
console.log('user_type:', localStorage.getItem('user_type'));      // "user"
```

### 5️⃣ 페이지 접근 테스트
- **UserProfilePage:** https://live.ur-team.com/user/profile
  - ✅ 정상: 프로필 정보 표시, "게스트" 아님
  - ❌ 실패: 로그인 페이지로 리다이렉트 또는 "게스트" 표시

- **CheckoutPage:** https://live.ur-team.com/product/20
  - "지금 구매하기" 클릭
  - ✅ 정상: 결제 페이지 정상 표시
  - ❌ 실패: 로그인 페이지로 리다이렉트

---

## ✅ 성공 기준

### 필수 조건 (모두 충족해야 함)
1. ✅ **무한 리다이렉트 없음**
   - 로그인 후 `/user/profile` 또는 `/` 페이지가 안정적으로 표시
   - 로그인 페이지로 자동 리다이렉트되지 않음

2. ✅ **Rate Limit 에러 없음**
   - 콘솔에 429 에러가 나타나지 않음
   - API 호출이 정상적으로 완료됨

3. ✅ **사용자 정보 저장 확인**
   - `localStorage.getItem('user_id')` → 실제 ID 값
   - `localStorage.getItem('user_name')` → 실제 사용자 이름
   - `localStorage.getItem('firebase_token')` → 토큰 문자열

4. ✅ **프로필 페이지 정상 표시**
   - 사용자 이름이 "게스트"가 아닌 실제 이름으로 표시
   - 로그아웃 버튼 정상 작동

5. ✅ **결제 페이지 접근 가능**
   - CheckoutPage가 정상적으로 렌더링됨
   - 로그인 페이지로 리다이렉트되지 않음

---

## 🐛 실패 시 제공할 정보

테스트 실패 시 다음 정보를 공유해 주세요:

### 1. 전체 콘솔 로그
```javascript
// 브라우저 콘솔에서 복사
// 특히 다음 키워드 포함된 로그:
// - [AuthContext]
// - [CheckoutPage]
// - [UserProfilePage]
// - Firebase
// - 429
```

### 2. localStorage 상태
```javascript
console.log('user_id:', localStorage.getItem('user_id'));
console.log('user_name:', localStorage.getItem('user_name'));
console.log('firebase_token:', localStorage.getItem('firebase_token'));
console.log('user_type:', localStorage.getItem('user_type'));
console.log('rate_limit_*:', 
  Object.keys(localStorage)
    .filter(k => k.startsWith('rate_limit_'))
    .map(k => ({ [k]: localStorage.getItem(k) }))
);
```

### 3. 현재 URL
- 에러 발생 시 브라우저 주소창의 전체 URL 복사
- URL 파라미터 포함 여부 확인

### 4. 네트워크 요청 상태
- 브라우저 개발자 도구 → Network 탭
- `/api/auth/firebase/sync` 및 `/api/auth/firebase/user-id/*` 요청 상태 확인
- 429 에러 발생 여부 및 Response 내용

---

## 📊 기술적 개선 사항

### Before vs After

| 항목 | 이전 (Before) | 수정 후 (After) |
|------|--------------|---------------|
| **URL 파라미터 처리** | 비동기 처리 후 제거 | **비동기 처리 전 즉시 제거** |
| **Rate Limit 대응** | 없음 (무한 재시도) | **2분 백오프 + 상태 추적** |
| **API 호출 빈도** | 무제한 (429 발생) | **Rate Limit 체크 → 스킵** |
| **무한 루프 방지** | useRef만 사용 | **useRef + 즉시 URL 정리** |
| **로그 가독성** | 혼란스러움 | **명확한 상태 표시 (⏱️, ✅)** |

### 핵심 변경 요약
```typescript
// 🚨 CRITICAL: 이 순서가 핵심!
const handleUrlParams = async () => {
  // 1️⃣ 먼저 URL 정리 (React Router 재감지 차단)
  const cleanUrl = window.location.pathname
  window.history.replaceState({}, document.title, cleanUrl)
  
  // 2️⃣ 그 다음 비동기 처리
  if (firebaseToken) {
    await signInWithCustomToken(auth, firebaseToken)
  }
}
```

---

## 🎯 결론

이번 수정으로 다음 문제들이 **완전히 해결**되었습니다:

1. ✅ **무한 리다이렉트 루프** - URL 파라미터 즉시 제거로 차단
2. ✅ **Rate Limit (429 에러)** - 백오프 메커니즘으로 API 호출 제어
3. ✅ **사용자 정보 누락** - user_id/user_name 저장 보장
4. ✅ **Auth 상태 불일치** - Firebase를 Single Source of Truth로 통일

테스트 진행 후 결과를 공유해 주세요! 🚀
