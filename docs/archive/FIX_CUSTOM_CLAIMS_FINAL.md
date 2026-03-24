# 🎯 최종 해결책: Custom Claims에서 userId 직접 추출

## 🚨 문제 근본 원인
로그 분석 결과, `/api/auth/firebase/sync`가 **429 Too Many Requests**로 차단되어 `user_id`를 저장하지 못했습니다.

```
/api/auth/firebase/sync: Failed to load resource: the server responded with a status of 429
[AuthContext] ⚠️ Rate Limit (429) - 2분 대기 설정
```

## ✅ 최종 해결책

### Firebase Custom Claims에 이미 userId가 있습니다!
카카오 로그인 시 백엔드가 이미 Custom Claims에 `userId`를 포함시켰습니다:

```typescript
// 백엔드 (src/index.tsx)
const customToken = await admin.auth().createCustomToken(`kakao_${user.kakao_id}`, {
  userId: user.id,        // ⭐ 이미 포함되어 있음!
  userType: 'user',
  email: kakaoEmail,
  kakaoId: user.kakao_id
})
```

### 수정 내용: API 호출 없이 바로 추출
```typescript
// ✅ Custom Claims에서 userId 바로 가져오기 (API 호출 불필요!)
const userIdFromClaims = idTokenResult.claims.userId as number | undefined
const userNameFromFirebase = firebaseUser.displayName

if (userIdFromClaims) {
  localStorage.setItem('user_id', userIdFromClaims.toString())
  console.log('[AuthContext] ✅ user_id를 Custom Claims에서 저장:', userIdFromClaims)
}

if (userNameFromFirebase) {
  localStorage.setItem('user_name', userNameFromFirebase)
  console.log('[AuthContext] ✅ user_name을 Firebase에서 저장:', userNameFromFirebase)
}
```

### 효과
1. **Rate Limit 완전 우회** - API 호출이 필요 없으므로 429 에러 발생 불가
2. **즉시 저장** - Firebase 로그인 성공 즉시 `user_id`와 `user_name` 저장
3. **무한 루프 차단** - 페이지 가드가 `user_id`를 즉시 감지

---

## 🧪 테스트 절차

### Step 1: 기존 Rate Limit 락 제거 (중요!)
브라우저 콘솔에서 실행:
```javascript
// Rate Limit 대기 상태 제거
Object.keys(localStorage)
  .filter(k => k.startsWith('rate_limit_'))
  .forEach(k => localStorage.removeItem(k));

// Sync 타임스탬프 초기화
Object.keys(localStorage)
  .filter(k => k.startsWith('last_sync_'))
  .forEach(k => localStorage.removeItem(k));

// 인증 정보 유지하면서 새로고침
location.reload();
```

### Step 2: 카카오 로그인
1. https://live.ur-team.com/login 접속
2. "카카오 로그인" 클릭
3. 카카오 인증 진행

### Step 3: 예상 콘솔 로그
```
[AuthContext] ✅ URL 파라미터 즉시 제거 (무한 루프 방지)
[AuthContext] 🔥 Firebase Custom Token 로그인 시작
[AuthContext] ✅ Firebase 로그인 성공: kakao_4735311250
[AuthContext] ✅ 사용자 인증됨: { uid: "kakao_4735311250", email: "...", role: "user" }
[AuthContext] ✅ user_id를 Custom Claims에서 저장: 3                    ⭐ 핵심!
[AuthContext] ✅ user_name을 Firebase에서 저장: 정지원                   ⭐ 핵심!
[AuthContext] ✅ 로그인 상태 확정: { uid: "kakao_4735311250", role: "user" }
[UserProfilePage] ✅ 사용자 정보 로드: { userId: 3, userName: "정지원" }
```

### Step 4: localStorage 확인
```javascript
console.log('user_id:', localStorage.getItem('user_id'));        // "3"
console.log('user_name:', localStorage.getItem('user_name'));    // "정지원"
console.log('firebase_token:', localStorage.getItem('firebase_token')); // "eyJhbG..."
```

### Step 5: 페이지 테스트
- **프로필:** https://live.ur-team.com/user/profile
  - ✅ "정지원" 표시 (게스트 아님)
  - ✅ 무한 리다이렉트 없음

- **결제:** https://live.ur-team.com/product/20 → "지금 구매하기"
  - ✅ 결제 페이지 정상 표시

---

## ✅ 성공 기준

### 필수 조건
- [ ] 콘솔에 `✅ user_id를 Custom Claims에서 저장` 로그 표시
- [ ] 콘솔에 `✅ user_name을 Firebase에서 저장` 로그 표시
- [ ] localStorage에 `user_id: "3"` 저장
- [ ] localStorage에 `user_name: "정지원"` 저장
- [ ] 무한 리다이렉트 없음
- [ ] **429 에러 없음** (API 호출 자체가 없으므로)

---

## 🎯 왜 이 방법이 최선인가?

### Before (API 호출 방식)
```
Firebase 로그인 성공
  ↓
POST /api/auth/firebase/sync 호출
  ↓
429 에러 발생 (Rate Limit)
  ↓
user_id 저장 실패
  ↓
무한 리다이렉트 발생
```

### After (Custom Claims 방식)
```
Firebase 로그인 성공
  ↓
Custom Claims에서 userId 추출
  ↓
localStorage에 즉시 저장
  ↓
페이지 정상 렌더링
```

---

## 📊 배포 정보

| 항목 | 값 |
|------|-----|
| **최신 커밋** | `b083230` |
| **커밋 메시지** | Custom Claims에서 userId 직접 추출 - API 호출 불필요, Rate Limit 완전 우회 |
| **빌드 버전** | `aee4c40aaa652f0d` |
| **배포 URL** | https://live.ur-team.com |
| **GitHub Actions** | https://github.com/tobe2111/ur-live/actions |

---

## 🐛 혹시 여전히 문제가 있다면?

### 1. Rate Limit 락이 남아있는 경우
```javascript
// 브라우저 콘솔에서 확인
console.log('Rate Limit 키:', 
  Object.keys(localStorage).filter(k => k.startsWith('rate_limit_'))
);

// 있으면 제거
Object.keys(localStorage)
  .filter(k => k.startsWith('rate_limit_'))
  .forEach(k => localStorage.removeItem(k));
```

### 2. 캐시 문제
```javascript
// 강제 새로고침
location.reload(true);

// 또는 완전 초기화 후 재로그인
localStorage.clear();
sessionStorage.clear();
location.href = '/login';
```

### 3. 디버그 정보 확인
```javascript
// Firebase 토큰 디코딩 (https://jwt.io 에서)
console.log('Firebase Token:', localStorage.getItem('firebase_token'));

// Custom Claims 확인
import { getAuth } from 'firebase/auth';
const auth = getAuth();
const user = auth.currentUser;
if (user) {
  user.getIdTokenResult().then(result => {
    console.log('Custom Claims:', result.claims);
  });
}
```

---

## 🎉 결론

이제 **API 호출 없이** Firebase Custom Claims에서 직접 `userId`를 추출하므로:

1. ✅ **Rate Limit 완전 우회** - 429 에러 발생 불가
2. ✅ **즉시 저장** - 로그인 성공 즉시 데이터 저장
3. ✅ **무한 루프 제거** - 페이지 가드가 즉시 인증 확인
4. ✅ **서버 부하 감소** - 불필요한 API 호출 제거

**배포 완료!** 위 테스트 절차대로 진행하고 결과를 공유해 주세요! 🚀
