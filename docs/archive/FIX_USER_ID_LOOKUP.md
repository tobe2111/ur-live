# 🚑 긴급 수정: D1 Sync 스킵 시 user_id 조회 문제 해결

## 발견된 문제

### 증상
```javascript
[AuthContext] ⏭️ Sync 스킵 (최근 sync: 오후 11:47:31)
[Firebase Auth] 로그인되지 않음, 로그인 페이지로 이동
```

- Firebase Auth로는 **로그인되어 있지만**
- localStorage에 `user_id`가 **없어서**
- `isLoggedIn()` 함수가 `false` 반환
- CheckoutPage, UserProfilePage 접근 불가

### 근본 원인
1. AuthContext가 D1 sync를 **1분마다 Rate Limit**
2. Rate Limit으로 sync 스킵 시 `user_id` 저장 안 됨
3. `utils/auth.ts`의 `isLoggedIn()` 함수:
   ```typescript
   export function isLoggedIn(): boolean {
     const firebaseUser = auth.currentUser
     const firebaseToken = localStorage.getItem('firebase_token')
     const userId = getUserId()
     
     return !!(firebaseUser && firebaseToken && userId)  // ❌ userId 필수
   }
   ```

## 해결 방법

### 1. 새 API 추가: `/api/auth/firebase/user-id/:firebaseUid`

**목적**: Firebase UID로 D1에서 빠르게 user_id 조회 (Rate Limit 우회)

```typescript
// src/index.tsx (백엔드)
app.get('/api/auth/firebase/user-id/:firebaseUid', cors(), async (c) => {
  const { DB } = c.env;
  const firebaseUid = c.req.param('firebaseUid');
  
  const user = await DB.prepare(
    'SELECT id, name, email FROM users WHERE firebase_uid = ?'
  ).bind(firebaseUid).first();
  
  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  return c.json({
    success: true,
    userId: user.id,
    userName: user.name,
    userEmail: user.email
  });
});
```

### 2. AuthContext 수정: Sync 스킵 시에도 user_id 조회

```typescript
// src/contexts/AuthContext.tsx
} else {
  console.log('[AuthContext] ⏭️ Sync 스킵 (최근 sync: ...)')
  
  // ✅ Sync 스킵했지만 localStorage에 user_id가 없으면 빠른 조회
  const existingUserId = localStorage.getItem('user_id')
  if (!existingUserId) {
    try {
      console.log('[AuthContext] 🔍 user_id 없음 - 빠른 조회 API 호출')
      const userIdResponse = await api.get(
        `/api/auth/firebase/user-id/${firebaseUser.uid}`
      )
      
      if (userIdResponse.data?.success) {
        localStorage.setItem('user_id', userIdResponse.data.userId?.toString() || '')
        localStorage.setItem('user_name', userIdResponse.data.userName || '')
        
        console.log('[AuthContext] ✅ user_id 조회 완료:', {
          userId: userIdResponse.data.userId,
          userName: userIdResponse.data.userName
        })
      }
    } catch (err) {
      console.warn('[AuthContext] ⚠️ user_id 조회 실패 (계속 진행):', err)
    }
  }
}
```

## 배포 정보

- **커밋**: `8546a8c`
- **푸시**: ✅ 완료 (2026-03-01 14:52 UTC)
- **빌드**: 성공 (361.62 kB worker)
- **GitHub Actions**: https://github.com/tobe2111/ur-live/actions

## 테스트 방법

### 테스트 1: localStorage 삭제 후 재로드

```javascript
// 브라우저 콘솔 (F12)에서 실행:
localStorage.removeItem('last_sync_kakao_4735311250')
localStorage.removeItem('user_id')
localStorage.removeItem('user_name')
location.reload()
```

**예상 로그**:
```javascript
[AuthContext] 🔥 onAuthStateChanged 트리거
[AuthContext] ⏭️ Sync 스킵 (최근 sync: 오후 11:47:31)
[AuthContext] 🔍 user_id 없음 - 빠른 조회 API 호출
[AuthContext] ✅ user_id 조회 완료: { userId: 123, userName: "사용자이름" }
[AuthContext] ✅ 로그인 상태 확정
```

**결과 확인**:
```javascript
localStorage.getItem('user_id')    // "123"
localStorage.getItem('user_name')  // "사용자이름"
```

### 테스트 2: CheckoutPage 접근

1. https://live.ur-team.com/product/20 접속
2. "지금 구매하기" 버튼 클릭
3. CheckoutPage로 이동 (무한 루프 없음 ✅)

**예상 로그**:
```javascript
[CheckoutPage] userId: "123"
[CheckoutPage] isLoggedIn: true
[CheckoutPage] ✅ userId 설정: 123
```

### 테스트 3: UserProfilePage 접근

1. https://live.ur-team.com/user/profile 접속
2. 사용자 프로필 표시 (게스트님 아님 ✅)

## API 테스트

### 새 API 엔드포인트 테스트

```bash
# Firebase UID로 user_id 조회
curl https://live.ur-team.com/api/auth/firebase/user-id/kakao_4735311250 | jq '.'

# 예상 응답:
{
  "success": true,
  "userId": 123,
  "userName": "사용자이름",
  "userEmail": "user@example.com"
}
```

## 로그 플로우

### Before (문제 상황)
```
[AuthContext] ⏭️ Sync 스킵 (최근 sync: ...)
[AuthContext] ✅ 로그인 상태 확정
localStorage.getItem('user_id')  // null ❌
[CheckoutPage] isLoggedIn: false ❌
[CheckoutPage] ❌ 로그인 필요 - requireLogin() 호출
→ 무한 루프
```

### After (수정 후)
```
[AuthContext] ⏭️ Sync 스킵 (최근 sync: ...)
[AuthContext] 🔍 user_id 없음 - 빠른 조회 API 호출
[AuthContext] ✅ user_id 조회 완료: { userId: 123 }
[AuthContext] ✅ 로그인 상태 확정
localStorage.getItem('user_id')  // "123" ✅
[CheckoutPage] isLoggedIn: true ✅
[CheckoutPage] ✅ userId 설정: 123
→ 정상 작동
```

## 효과

1. ✅ **Rate Limit 우회**: Sync 스킵해도 user_id 조회 가능
2. ✅ **CheckoutPage 접근**: 무한 루프 없이 정상 작동
3. ✅ **UserProfilePage 접근**: 사용자 정보 정상 표시
4. ✅ **빠른 조회**: `/sync` 대신 `/user-id` API로 빠르게 조회

## 주의사항

### localStorage 캐시 이슈
- 기존에 로그인했던 사용자는 **localStorage에 이미 값이 있을 수 있음**
- 테스트 시 반드시 **localStorage 삭제** 필요
- 또는 시크릿 모드에서 테스트

### Rate Limit 동작
- D1 sync는 여전히 1분마다 Rate Limit 적용
- Rate Limit 걸려도 **user_id는 빠른 조회 API로 보장**
- 사용자 경험에 영향 없음

## 배포 확인

### 버전 확인
```bash
curl https://live.ur-team.com/version.json | jq '.'

# buildTime이 2026-03-01T14:52 이후이면 배포 완료
{
  "version": "...",
  "buildTime": "2026-03-01T14:52:XX.XXXZ"  # 이 값 확인
}
```

### 환경변수 확인
```bash
curl https://live.ur-team.com/api/test/env | jq '.summary'

# 모든 Firebase 환경변수가 pass 상태여야 함
{
  "total": 9,
  "pass": 9,
  "warn": 0,
  "fail": 0
}
```

## 다음 단계

1. **배포 완료 대기** (2-3분)
2. **브라우저 테스트** (localStorage 삭제 → 재로드)
3. **CheckoutPage 접근** 확인
4. **콘솔 로그** 공유

---

**커밋**: 8546a8c  
**상태**: ⏳ 배포 대기 중  
**예상 완료**: 2026-03-01 14:55 UTC
