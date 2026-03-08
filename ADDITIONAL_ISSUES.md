# 🚨 추가 발견된 잠재적 문제들

## 📋 기존 수정 사항 (이미 완료됨)
1. ✅ Custom Token이 localStorage에 저장됨
2. ✅ auth.currentUser가 null (타이밍 문제)
3. ✅ URL 파라미터 미제거
4. ✅ JWKS 캐시 stale 상태
5. ✅ Firebase Project ID 불일치
6. ✅ 서버 로그가 클라이언트에 전달되지 않음

---

## 🔴 추가로 발견된 7가지 잠재적 문제

### Problem 7: 🚨 CRITICAL - firebase_uid가 NULL인 기존 사용자
**증상**:
- 카카오 로그인 성공, ID Token 정상 발급
- 서버가 `SELECT ... FROM users WHERE firebase_uid = ?` 실행
- **firebase_uid가 NULL인 기존 사용자는 조회 실패** → 401 Unauthorized

**원인**:
```sql
-- src/index.tsx 라인 547-549
SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?

-- 문제: firebase_uid가 NULL인 기존 사용자
-- kakao_id는 있지만 firebase_uid가 아직 설정되지 않은 경우
```

**상황**:
```typescript
// 카카오 로그인 플로우
1. 사용자가 카카오로 로그인
2. 서버가 kakao_id로 사용자 찾음 → users 테이블에 존재
3. firebase_uid = kakao_4735311250 설정 시도
4. UPDATE users SET firebase_uid = ? WHERE id = ? 실행
5. 그러나 타이밍 이슈로 INSERT와 UPDATE 사이 시간차 발생
6. 클라이언트가 ID Token으로 API 호출
7. 서버가 firebase_uid로 조회 → NULL이면 찾지 못함 ❌
```

**해결 방안**:
```typescript
// Option 1: firebase_uid 또는 kakao_id로 조회 (Fallback)
const user = await c.env.DB.prepare(`
  SELECT id, email, name, user_type, firebase_uid 
  FROM users 
  WHERE firebase_uid = ? OR (kakao_id = ? AND firebase_uid IS NULL)
`).bind(firebasePayload.uid, firebasePayload.uid.replace('kakao_', '')).first()

// Option 2: Custom Claims에서 userId 직접 사용
const userId = firebasePayload.userId  // Custom Claims에 이미 포함됨
if (userId) {
  const user = await c.env.DB.prepare(`
    SELECT id, email, name, user_type FROM users WHERE id = ?
  `).bind(userId).first()
}
```

**우선순위**: 🔴 **CRITICAL** - 기존 사용자가 로그인 불가

---

### Problem 8: 🟡 Custom Claims 미동기화
**증상**:
- Custom Token 생성 시 `userId`, `userName`, `role` 포함
- ID Token에도 Custom Claims 포함되어야 함
- 그러나 Firebase Admin SDK의 `setCustomUserClaims()` 호출 누락 가능성

**원인**:
```typescript
// src/index.tsx 라인 2228-2235
const customToken = await firebase.createCustomToken(firebaseUID, {
  role: 'user',
  userId: userId,
  userName: nickname,
  email: email || undefined,
  kakaoId: kakaoId
});

// 문제: Custom Token에만 Claims가 있고, 
// 실제 Firebase 사용자 프로필에는 Claims가 설정되지 않음
// → ID Token에 Claims가 누락될 수 있음
```

**Firebase Custom Claims 동작 방식**:
1. `createCustomToken(uid, claims)`: Custom Token에만 Claims 포함 (일시적)
2. `signInWithCustomToken()`: Custom Token → ID Token 교환
3. **첫 ID Token**: Custom Token의 Claims가 포함됨 ✅
4. **토큰 갱신 후**: Claims가 사라짐 ❌ (setCustomUserClaims() 호출 필요)

**해결 방안**:
```typescript
// src/index.tsx - Firebase Admin SDK로 영구 Claims 설정
const firebase = initFirebaseAdmin(c.env);
const firebaseUID = `kakao_${kakaoId}`;

// 1. Custom Token 생성
const customToken = await firebase.createCustomToken(firebaseUID, {
  role: 'user',
  userId: userId,
  userName: nickname,
  email: email || undefined,
  kakaoId: kakaoId
});

// 2. ✅ 영구 Custom Claims 설정 (토큰 갱신 후에도 유지)
await firebase.setCustomUserClaims(firebaseUID, {
  role: 'user',
  userId: userId,
  userName: nickname,
  email: email || undefined,
  kakaoId: kakaoId
});

console.log('[Kakao Sync] ✅ Custom Claims set permanently');
```

**우선순위**: 🟡 **MEDIUM** - 토큰 갱신 후 Claims 누락 가능

---

### Problem 9: 🟠 Race Condition - firebase_uid UPDATE vs API 호출
**증상**:
- 카카오 로그인 리다이렉트 후 firebase_uid UPDATE가 완료되기 전에 API 호출
- 서버가 아직 firebase_uid가 NULL인 상태에서 조회 → 401

**타이밍 분석**:
```
t=0ms:   카카오 콜백 → Custom Token 발급 → 리다이렉트 (firebase_token 포함)
t=50ms:  클라이언트 페이지 로드 → signInWithCustomToken() 시작
t=100ms: ID Token 교환 완료 → localStorage 저장
t=150ms: 컴포넌트 마운트 → API 호출 (/api/cart GET)
t=200ms: 서버 firebase_uid UPDATE 완료 (비동기) ⚠️ 늦음!
```

**원인**:
```typescript
// src/index.tsx 라인 2237-2244
// D1에 firebase_uid 저장 (없으면) - 컬럼 없을 경우 무시
try {
  await DB.prepare(`
    UPDATE users SET firebase_uid = ? WHERE id = ?
  `).bind(firebaseUID, userId).run();
} catch (colErr) {
  console.warn('[Kakao Sync] firebase_uid column not found, skipping update:', colErr);
}

// 문제: 리다이렉트 전에 firebase_uid UPDATE가 완료되어야 함
```

**해결 방안**:
```typescript
// src/index.tsx - firebase_uid UPDATE 완료 후 리다이렉트
try {
  // 1. firebase_uid 저장 (AWAIT 필수!)
  await DB.prepare(`
    UPDATE users SET firebase_uid = ? WHERE id = ?
  `).bind(firebaseUID, userId).run();
  
  console.log('[Kakao Sync] ✅ firebase_uid updated:', firebaseUID);
  
  // 2. firebase_uid가 제대로 저장되었는지 검증
  const verifyUser = await DB.prepare(`
    SELECT id, firebase_uid FROM users WHERE id = ?
  `).bind(userId).first();
  
  if (verifyUser?.firebase_uid !== firebaseUID) {
    console.error('[Kakao Sync] ❌ firebase_uid verification failed!');
    throw new Error('firebase_uid update failed');
  }
  
  console.log('[Kakao Sync] ✅ firebase_uid verified:', verifyUser.firebase_uid);
  
} catch (updateError) {
  console.error('[Kakao Sync] ❌ firebase_uid update error:', updateError);
  // fallback: 에러 페이지로 리다이렉트
  return c.redirect('/error?message=database_update_failed');
}

// 3. firebase_uid UPDATE 완료 후에만 리다이렉트
const redirectUrl = stateUrl.pathname + stateUrl.search;
return c.redirect(redirectUrl);
```

**우선순위**: 🟠 **HIGH** - Race condition으로 간헐적 401 발생 가능

---

### Problem 10: 🟡 Token Refresh 시 API 호출 중단
**증상**:
- Firebase가 ID Token을 자동 갱신 중
- 갱신 중에 API 호출 시 토큰 없음 → 401

**Firebase Token Refresh 동작**:
```typescript
// Firebase SDK 내부 동작
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 토큰 만료 5분 전 자동 갱신 시작
    const idToken = await user.getIdToken(true)  // force refresh
    // 갱신 중: auth.currentUser.getIdToken() 호출 시 대기 또는 null 반환 가능
  }
})
```

**API 인터셉터 동작**:
```typescript
// src/lib/api.ts 라인 84-93
if (!auth.currentUser) {
  await new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
    setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, 3000);
  });
}

// 문제: auth.currentUser가 존재하지만 getIdToken()이 갱신 중일 수 있음
const idToken = await auth.currentUser.getIdToken();  // ⚠️ 갱신 중 대기
```

**해결 방안**:
```typescript
// src/lib/api.ts - Retry 로직 추가
try {
  if (auth.currentUser) {
    // force=false: 캐시된 토큰 사용 (만료 시 자동 갱신)
    const idToken = await auth.currentUser.getIdToken(false);
    config.headers['Authorization'] = `Bearer ${idToken}`;
  } else {
    // 사용자 없으면 대기
    await waitForAuth();
    if (auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken(false);
      config.headers['Authorization'] = `Bearer ${idToken}`;
    }
  }
} catch (tokenError) {
  console.error('[API] ❌ Failed to get token:', tokenError);
  // Retry once
  try {
    const idToken = await auth.currentUser?.getIdToken(true);  // force refresh
    if (idToken) {
      config.headers['Authorization'] = `Bearer ${idToken}`;
    }
  } catch (retryError) {
    console.error('[API] ❌ Token retry failed:', retryError);
  }
}
```

**우선순위**: 🟡 **MEDIUM** - 간헐적 401 가능 (드물지만 발생 가능)

---

### Problem 11: 🟢 CORS Preflight 실패
**증상**:
- OPTIONS 요청 실패 → CORS 에러
- 실제 POST/GET 요청이 전송되지 않음

**확인 방법**:
```javascript
// Network 탭에서 확인
OPTIONS /api/cart
Status: (failed) net::ERR_FAILED
```

**원인**:
```typescript
// src/index.tsx - CORS 설정 누락 또는 잘못됨
app.get('/api/cart', requireAuth, async (c) => {
  // cors() 미들웨어 누락 시 OPTIONS 요청 실패
})
```

**해결 방안**:
```typescript
// src/index.tsx - 모든 보호된 엔드포인트에 cors() 추가
app.get('/api/cart', cors(), requireAuth, async (c) => {
  // ...
})

app.post('/api/cart', cors(), requireAuth, async (c) => {
  // ...
})
```

**현재 상태 확인**:
```bash
cd /home/user/webapp && grep -n "app.get('/api/cart'" src/index.tsx
cd /home/user/webapp && grep -n "app.post('/api/cart'" src/index.tsx
```

**우선순위**: 🟢 **LOW** - 가능성 낮음 (이미 cors() 설정되어 있을 것)

---

### Problem 12: 🟡 Cloudflare D1 Connection Timeout
**증상**:
- API 호출 시 D1 쿼리 시간 초과
- 서버 응답 지연 → 클라이언트 타임아웃 → 401로 오인

**원인**:
```typescript
// D1 쿼리 시간 초과
const user = await c.env.DB.prepare(`
  SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?
`).bind(firebasePayload.uid).first()  // ⚠️ 응답 없음 → 타임아웃
```

**Cloudflare D1 제한사항**:
- 쿼리 실행 시간: 최대 30초
- 연결 타임아웃: 10초
- 동시 연결: Worker당 50개

**해결 방안**:
```typescript
// src/index.tsx - 타임아웃 처리 추가
try {
  const queryPromise = c.env.DB.prepare(`
    SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?
  `).bind(firebasePayload.uid).first();
  
  // 5초 타임아웃
  const user = await Promise.race([
    queryPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('D1 query timeout')), 5000)
    )
  ]);
  
  if (!user) {
    console.warn('[Firebase Auth] User not found for UID:', firebasePayload.uid);
    return {
      userId: 0,
      userType: '',
      errorDetails: {
        code: 'USER_NOT_FOUND',
        message: 'User not found in database',
        tokenInfo: { uid: firebasePayload.uid }
      }
    } as any;
  }
  
} catch (dbError) {
  console.error('[Firebase Auth] D1 query error:', dbError);
  return {
    userId: 0,
    userType: '',
    errorDetails: {
      code: 'DATABASE_ERROR',
      message: 'Database query failed',
      tokenInfo: { error: dbError.message }
    }
  } as any;
}
```

**우선순위**: 🟡 **MEDIUM** - D1 성능 문제 시 발생 가능

---

### Problem 13: 🟢 Browser Extension 간섭
**증상**:
- Ad Blocker, Privacy Badger 등이 Authorization 헤더 제거
- 클라이언트는 헤더를 보냈지만 서버는 받지 못함

**확인 방법**:
```javascript
// 개발자 도구 Console
const xhr = new XMLHttpRequest();
xhr.open('GET', '/api/cart');
xhr.setRequestHeader('Authorization', 'Bearer test-token');
xhr.send();

// Network 탭에서 Request Headers 확인
// Authorization: Bearer ... 가 있는지 확인
```

**해결 방안**:
1. **사용자 안내**: 확장 프로그램 비활성화 요청
2. **대체 헤더**: `X-Firebase-Token` 등 커스텀 헤더 사용
3. **쿠키 기반 인증**: Authorization 헤더 대신 쿠키 사용

**우선순위**: 🟢 **LOW** - 사용자 환경 문제 (해결 불가능)

---

## 🎯 우선순위별 수정 계획

### 🔴 Immediate (지금 바로)
1. **Problem 7**: firebase_uid NULL인 기존 사용자 처리
   - Fallback 쿼리 추가: `firebase_uid = ? OR (kakao_id = ? AND firebase_uid IS NULL)`
   - 또는 Custom Claims의 userId 직접 사용

### 🟠 High Priority (다음 배포)
2. **Problem 9**: firebase_uid UPDATE Race Condition
   - firebase_uid UPDATE 완료 후 리다이렉트
   - UPDATE 검증 로직 추가

### 🟡 Medium Priority (여유 있을 때)
3. **Problem 8**: Custom Claims 영구 설정
   - `setCustomUserClaims()` 호출 추가
4. **Problem 10**: Token Refresh 시 Retry 로직
   - API 인터셉터에 재시도 로직 추가
5. **Problem 12**: D1 쿼리 타임아웃 처리
   - Promise.race()로 타임아웃 강제

### 🟢 Low Priority (Optional)
6. **Problem 11**: CORS 설정 확인
7. **Problem 13**: 브라우저 확장 프로그램 간섭 (사용자 문제)

---

## 🔧 즉시 적용할 수정 (Problem 7 해결)

### 수정 1: getFirebaseAuth에 Fallback 로직 추가

```typescript
// src/index.tsx 라인 546-554
// Firebase UID로 D1에서 사용자 조회
let user = await c.env.DB.prepare(`
  SELECT id, email, name, user_type, firebase_uid FROM users WHERE firebase_uid = ?
`).bind(firebasePayload.uid).first()

// 🚨 CRITICAL FIX: firebase_uid가 NULL인 기존 사용자 처리
if (!user && firebasePayload.uid.startsWith('kakao_')) {
  const kakaoId = firebasePayload.uid.replace('kakao_', '')
  console.warn('[Firebase Auth] firebase_uid not found, trying kakao_id:', kakaoId)
  
  user = await c.env.DB.prepare(`
    SELECT id, email, name, user_type, firebase_uid FROM users 
    WHERE kakao_id = ? AND firebase_uid IS NULL
  `).bind(kakaoId).first()
  
  if (user) {
    // firebase_uid 즉시 업데이트
    try {
      await c.env.DB.prepare(`
        UPDATE users SET firebase_uid = ? WHERE id = ?
      `).bind(firebasePayload.uid, user.id).run()
      console.log('[Firebase Auth] ✅ firebase_uid updated for existing user:', user.id)
    } catch (updateErr) {
      console.error('[Firebase Auth] ❌ firebase_uid update failed:', updateErr)
    }
  }
}

if (!user) {
  console.warn('[Firebase Auth] User not found for UID:', firebasePayload.uid)
  return {
    userId: 0,
    userType: '',
    errorDetails: {
      code: 'USER_NOT_FOUND',
      message: 'User not found in database',
      tokenInfo: { uid: firebasePayload.uid }
    }
  } as any
}
```

### 수정 2: Custom Claims에서 userId 직접 사용 (Alternative)

```typescript
// src/index.tsx - getFirebaseAuth 시작 부분
// Option 2: Custom Claims에 userId가 있으면 직접 사용
if (firebasePayload.userId) {
  console.log('[Firebase Auth] 🎯 Using userId from Custom Claims:', firebasePayload.userId)
  
  const user = await c.env.DB.prepare(`
    SELECT id, email, name, user_type FROM users WHERE id = ?
  `).bind(firebasePayload.userId).first()
  
  if (user) {
    const role = firebasePayload.role || user.user_type || 'user'
    return {
      userId: user.id,
      userType: role,
      email: user.email,
      firebaseUID: firebasePayload.uid
    }
  }
}

// Fallback: firebase_uid로 조회
const user = await c.env.DB.prepare(`
  SELECT id, email, name, user_type FROM users WHERE firebase_uid = ?
`).bind(firebasePayload.uid).first()
```

---

## 📊 테스트 시나리오

### 시나리오 A: 신규 사용자 (firebase_uid 정상)
1. 카카오 로그인 → firebase_uid 즉시 설정
2. API 호출 → firebase_uid로 조회 성공 ✅

### 시나리오 B: 기존 사용자 (firebase_uid NULL)
1. 과거에 kakao_id만 있는 상태로 가입
2. 카카오 로그인 → firebase_uid 설정 시도
3. Race condition으로 API 호출 먼저 발생
4. **수정 전**: firebase_uid로 조회 실패 → 401 ❌
5. **수정 후**: kakao_id로 fallback 조회 성공 → 200 ✅

### 시나리오 C: Custom Claims 사용
1. ID Token에 userId, role 포함
2. API 호출 → Custom Claims의 userId로 직접 조회
3. firebase_uid 없이도 인증 성공 ✅

---

## 🚀 다음 배포 계획

### Commit Message
```
fix: 🚨 CRITICAL - Handle firebase_uid NULL for existing users

Problem:
- Existing users with kakao_id but firebase_uid=NULL cannot authenticate
- Server queries "WHERE firebase_uid = ?" returns no results → 401 Unauthorized
- Race condition: firebase_uid UPDATE completes after API calls start

Solution:
- Add fallback query: Try kakao_id when firebase_uid not found
- Auto-update firebase_uid when found via kakao_id fallback
- Alternative: Use Custom Claims userId directly (faster, no DB query race)
- Add USER_NOT_FOUND error code for better debugging

Expected outcome:
- Existing users can login successfully
- firebase_uid gets updated automatically on first login
- No more 401 errors due to NULL firebase_uid
- Graceful handling of migration period (kakao_id → firebase_uid)

Build: <next-version>, Worker size: ~363 kB, Build time: <timestamp>
```

---

## 📝 결론

**총 13가지 잠재적 문제를 모두 분석했습니다:**

✅ **이미 수정됨** (6가지):
1. Custom Token localStorage 저장
2. auth.currentUser null 대기
3. URL 파라미터 미제거
4. JWKS 캐시 stale
5. Project ID 불일치
6. 서버 로그 미전달

🚨 **즉시 수정 필요** (1가지):
7. **firebase_uid NULL 기존 사용자** ← 가장 가능성 높음!

🟠 **곧 수정 필요** (1가지):
9. firebase_uid UPDATE Race Condition

🟡 **여유 있을 때** (3가지):
8. Custom Claims 영구 설정
10. Token Refresh Retry
12. D1 타임아웃 처리

🟢 **선택적** (2가지):
11. CORS 확인
13. 브라우저 확장 프로그램 간섭

**다음 단계:**
1. **Problem 7 즉시 수정** (firebase_uid Fallback)
2. 빌드 & 배포
3. 테스트 결과 확인
4. 401 여전히 발생 시 Problem 9-12 순차 수정

---

**작성**: 2026-03-01 19:40 UTC  
**버전**: 1.1  
**상태**: Problem 7 수정 대기 중
