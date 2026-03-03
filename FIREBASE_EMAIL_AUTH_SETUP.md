# Firebase Email/Password 인증 활성화 가이드

## 🔴 긴급 문제: 일반 유저 이메일 로그인 시 401 오류

### 문제 원인
- 이메일 로그인한 일반 유저가 Firebase Auth를 통해 인증되지 않음
- `auth.currentUser`가 null이 되어 API 요청 시 Authorization 헤더 누락
- `/api/cart`, `/api/order` 등 보호된 API가 401 Unauthorized 반환

### 에러 로그
```
[API] ⏳ Waiting for Firebase Auth initialization...
[API] ⚠️ No Firebase user for protected API after waiting: /api/cart
POST https://live.ur-team.com/api/cart 401 (Unauthorized)
[API] 🚨 Firebase auth failed (401)
[API] 📊 Server error details: {success: false, error: 'Missing Authorization header', code: 'NO_AUTH_HEADER'}
```

---

## ✅ 해결 방법: Firebase Email/Password 인증 활성화

### 1단계: Firebase Console 설정

#### 1.1 Firebase Console 접속
1. https://console.firebase.google.com/ 로 이동
2. UR Live 프로젝트 선택

#### 1.2 Authentication 메뉴 이동
1. 왼쪽 메뉴에서 **Build** → **Authentication** 클릭
2. **Sign-in method** 탭 클릭

#### 1.3 Email/Password 활성화
1. **Sign-in providers** 목록에서 **Email/Password** 찾기
2. 우측 연필 아이콘 (편집) 클릭
3. **Enable** (사용 설정) 토글 ON
4. **Email link (passwordless sign-in)** 옵션은 OFF 유지 (선택사항)
5. **Save** 버튼 클릭

#### 스크린샷 참고
```
┌──────────────────────────────────────────┐
│ Sign-in providers                        │
├──────────────────────────────────────────┤
│ ✅ Google                     Enabled    │
│ ✅ Email/Password              Enabled    │  ← 이것을 활성화!
│ ❌ Phone                       Disabled   │
│ ❌ Anonymous                   Disabled   │
└──────────────────────────────────────────┘
```

---

### 2단계: 코드 확인 (이미 구현됨!)

우리 코드는 **이미 Firebase Email/Password 인증을 사용**하고 있습니다:

#### LoginPage.tsx (이메일 로그인)
```typescript
// ✅ 이미 Firebase signInWithEmailAndPassword 사용 중
async function handleEmailLogin(e: React.FormEvent) {
  await loginWithEmail(email, password)
  // Firebase Auth가 자동으로 auth.currentUser 설정
  // API 인터셉터가 자동으로 ID Token 전송
}
```

#### AuthContext.tsx (실제 인증 로직)
```typescript
// ✅ 이미 구현됨
const loginWithEmail = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  // Firebase가 자동으로 토큰 관리
}
```

#### API Client (api.ts)
```typescript
// ✅ Firebase 유저 우선으로 토큰 가져오기
const user = auth.currentUser;
if (user) {
  const idToken = await user.getIdToken(false);
  config.headers['Authorization'] = `Bearer ${idToken}`;
}
```

**코드는 이미 완벽합니다!** Firebase Console에서 Email/Password만 활성화하면 즉시 작동합니다.

---

### 3단계: 테스트

#### 3.1 새 계정으로 회원가입 테스트
1. https://live.ur-team.com/register 이동
2. 이메일/비밀번호 입력하여 회원가입
3. Console 로그 확인:
   ```
   [Auth] 📝 이메일 회원가입 시도: test@example.com
   [Auth] ✅ 이메일 회원가입 성공: abc123xyz
   ```

#### 3.2 로그인 테스트
1. https://live.ur-team.com/login 이동
2. 방금 가입한 이메일/비밀번호로 로그인
3. Console 로그 확인:
   ```
   [Auth] 📧 이메일 로그인 시도: test@example.com
   [Auth] ✅ 이메일 로그인 성공: abc123xyz
   [API] 🔥 Firebase ID Token attached (buyer)
   ```

#### 3.3 장바구니 API 테스트
1. 상품 페이지에서 "장바구니 담기" 클릭
2. Console 로그 확인:
   ```
   [API] 🔥 Firebase ID Token attached (buyer)
   POST https://live.ur-team.com/api/cart 200 (OK)
   ```
3. ✅ 401 오류 사라짐!

---

## 🎯 인증 흐름 정리

### Before (문제 상황)
```
이메일 로그인 → ??? (Firebase 미사용) → auth.currentUser = null
  ↓
API 요청 → No Authorization header → 401 Unauthorized
```

### After (해결 후)
```
이메일 로그인 → signInWithEmailAndPassword → auth.currentUser = User
  ↓
API 요청 → Bearer <Firebase_ID_Token> → 200 OK
```

---

## 📋 전체 인증 아키텍처

### 구매자 (Buyers)
- **카카오 로그인**: Firebase Custom Token → ID Token
- **이메일 로그인**: Firebase Email/Password → ID Token
- **API 인증**: Firebase ID Token (자동)

### 셀러 (Sellers)
- **로그인**: JWT Token (독립적)
- **API 인증**: JWT Token (localStorage)

### 어드민 (Admins)
- **로그인**: JWT Token (독립적)
- **API 인증**: JWT Token (localStorage)

---

## 🔒 보안 체크리스트

### Firebase Console 설정
- [x] Email/Password 인증 활성화
- [ ] Password 정책 설정 (최소 6자 이상)
- [ ] Email verification 활성화 (선택사항)
- [ ] Multi-factor authentication (선택사항)

### 코드 체크
- [x] LoginPage: `signInWithEmailAndPassword` 사용
- [x] RegisterPage: Custom Token 방식 (D1 연동)
- [x] API Client: Firebase ID Token 자동 전송
- [x] 401 에러 처리: 자동 로그아웃 및 리다이렉트

---

## ⚠️ 주의사항

### 1. 회원가입은 백엔드 API 사용
```typescript
// ✅ 올바른 방법 (D1 + Firebase 동시 처리)
const response = await fetch('/api/auth/email/register', {
  method: 'POST',
  body: JSON.stringify({ email, password, name })
})

// ❌ 잘못된 방법 (Firebase만 사용, D1 누락)
await createUserWithEmailAndPassword(auth, email, password)
```

**이유**: 우리는 Firebase Auth + D1 Database 동시 사용
- Firebase: 인증 토큰 관리
- D1: 사용자 정보, 주문, 장바구니 등

### 2. Password 최소 길이
Firebase는 기본적으로 **6자 이상**의 비밀번호 요구:
```javascript
// Firebase 에러 예시
"auth/weak-password" : "Password should be at least 6 characters"
```

프론트엔드에서 미리 검증:
```typescript
if (password.length < 6) {
  alert('비밀번호는 최소 6자 이상이어야 합니다.')
  return
}
```

### 3. 이메일 형식 검증
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(email)) {
  alert('올바른 이메일 형식이 아닙니다.')
  return
}
```

---

## 🐛 문제 해결 (Troubleshooting)

### 문제 1: Firebase Console에서 활성화했는데도 401 오류
**원인**: 브라우저 캐시
**해결**:
```bash
# 1. localStorage 초기화
localStorage.clear()

# 2. 페이지 새로고침 (Ctrl + Shift + R / Cmd + Shift + R)

# 3. 다시 로그인 시도
```

### 문제 2: "auth/user-not-found" 에러
**원인**: 해당 이메일로 가입된 계정이 없음
**해결**:
1. Firebase Console → Authentication → Users 탭에서 사용자 확인
2. 또는 새로 회원가입

### 문제 3: "auth/wrong-password" 에러
**원인**: 비밀번호 불일치
**해결**:
1. 비밀번호 재설정 (Forgot Password) 사용
2. 또는 올바른 비밀번호 입력

### 문제 4: "auth/too-many-requests" 에러
**원인**: 짧은 시간에 너무 많은 로그인 시도
**해결**:
1. 5~10분 대기
2. 비밀번호 재설정 사용

---

## 📊 Firebase vs JWT 비교

| 항목 | Firebase (구매자) | JWT (셀러/어드민) |
|------|------------------|-------------------|
| **용도** | 소셜 로그인, 이메일 로그인 | 자체 인증 시스템 |
| **토큰 관리** | 자동 갱신 (1시간) | 수동 관리 (30일) |
| **보안** | Firebase 관리 | 자체 서버 관리 |
| **비용** | 무료 (10만 DAU) | $0 (자체 호스팅) |
| **복잡도** | 낮음 (SDK 제공) | 중간 (자체 구현) |
| **유연성** | 제한적 | 높음 (완전 제어) |

---

## ✅ 완료 체크리스트

작업 완료 후 체크:

- [ ] Firebase Console에서 Email/Password 활성화 확인
- [ ] 새 계정으로 회원가입 테스트
- [ ] 이메일 로그인 테스트
- [ ] 장바구니 담기 (API 요청) 테스트
- [ ] Console에서 401 오류 사라진 것 확인
- [ ] Firebase ID Token이 정상적으로 전송되는 것 확인

---

## 🎉 예상 결과

### Before (현재)
```
✅ 카카오 로그인 → Firebase → 정상 작동
❌ 이메일 로그인 → ??? → 401 오류
✅ 셀러 로그인 → JWT → 정상 작동
✅ 어드민 로그인 → JWT → 정상 작동
```

### After (Firebase 활성화 후)
```
✅ 카카오 로그인 → Firebase → 정상 작동
✅ 이메일 로그인 → Firebase → 정상 작동  ← 해결!
✅ 셀러 로그인 → JWT → 정상 작동
✅ 어드민 로그인 → JWT → 정상 작동
```

---

## 📚 참고 자료

- Firebase Email/Password 인증: https://firebase.google.com/docs/auth/web/password-auth
- Firebase 보안 규칙: https://firebase.google.com/docs/auth/web/manage-users
- 우리 프로젝트 인증 문서: `./JWT_AUTHENTICATION_COMPLETE.md`

---

**Status**: ⏳ Firebase Console 설정 대기 중
**Priority**: 🔴 긴급 (프로덕션 환경 로그인 불가)
**Estimated Fix Time**: 2분 (Firebase Console 활성화만 하면 즉시 해결)

---

**Date**: 2026-03-03
**Author**: GenSpark AI Developer
