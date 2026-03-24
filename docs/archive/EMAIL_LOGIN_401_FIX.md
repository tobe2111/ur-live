# 🚨 긴급 해결: 이메일 로그인 401 오류

## 📝 요약
**문제**: 이메일 로그인한 일반 유저가 장바구니 등 API 사용 시 401 Unauthorized 오류  
**원인**: Firebase Email/Password 인증이 Firebase Console에서 비활성화되어 있음  
**해결**: Firebase Console에서 Email/Password 인증 활성화 (2분 소요)

---

## ⚡ 즉시 해결 방법

### 1단계: Firebase Console 접속
```
https://console.firebase.google.com/
→ UR Live 프로젝트 선택
→ Authentication
→ Sign-in method 탭
```

### 2단계: Email/Password 활성화
```
Sign-in providers 목록에서
→ Email/Password 찾기
→ 우측 연필 아이콘 클릭
→ Enable 토글 ON
→ Save
```

### 3단계: 테스트
```
1. https://live.ur-team.com/register 에서 회원가입
2. https://live.ur-team.com/login 에서 로그인
3. 상품 페이지에서 "장바구니 담기" 테스트
4. ✅ 401 오류 사라짐!
```

---

## 🔍 코드는 이미 정상!

우리 코드는 **이미 Firebase Email/Password 인증을 사용**하고 있습니다:

### LoginPage (이메일 로그인)
```typescript
// ✅ 이미 구현됨
await loginWithEmail(email, password)
// → signInWithEmailAndPassword(auth, email, password)
// → auth.currentUser 자동 설정
// → API 요청 시 Firebase ID Token 자동 전송
```

### AuthContext
```typescript
// ✅ 이미 구현됨
const loginWithEmail = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  // Firebase가 자동으로 토큰 관리
}
```

### API Client
```typescript
// ✅ Firebase 우선 토큰 가져오기
const user = auth.currentUser;
if (user) {
  const idToken = await user.getIdToken();
  config.headers['Authorization'] = `Bearer ${idToken}`;
}
```

**코드 변경 불필요!** Firebase Console 설정만 변경하면 끝!

---

## 📊 인증 흐름

### Before (401 오류)
```
이메일 로그인 → Firebase 비활성화 → auth.currentUser = null
  ↓
API 요청 → No Authorization → 401 Unauthorized
```

### After (정상)
```
이메일 로그인 → Firebase 활성화 → auth.currentUser = User
  ↓
API 요청 → Bearer <Token> → 200 OK
```

---

## ✅ 전체 인증 상태

| 사용자 타입 | 로그인 방식 | 상태 |
|-----------|------------|-----|
| 구매자 (카카오) | Firebase Custom Token | ✅ 정상 |
| 구매자 (이메일) | Firebase Email/Password | ⏳ Console 설정 필요 |
| 셀러 | JWT Token | ✅ 정상 |
| 어드민 | JWT Token | ✅ 정상 |

---

## 🎯 해결 예상 시간
- **Firebase 활성화**: 2분
- **테스트**: 3분
- **총 소요 시간**: 5분

---

## 📚 상세 문서
자세한 내용은 `FIREBASE_EMAIL_AUTH_SETUP.md` 참고

---

**Date**: 2026-03-03  
**Priority**: 🔴 긴급  
**Status**: ⏳ Firebase Console 설정 대기 중
