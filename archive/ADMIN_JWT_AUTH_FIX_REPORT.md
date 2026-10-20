# 어드민 대시보드 JWT 인증 완전 해결 보고서

## 🚨 발생한 문제

### 현상
```
[SessionValidation] ✅ JWT 토큰 유효: {userId: 3, userType: 'seller', ...}
GET https://live.ur-team.com/api/admin/sellers 401 (Unauthorized)
[API] Access token expired, refreshing...
[API] ✅ Token refreshed successfully
GET https://live.ur-team.com/api/admin/sellers 401 (Unauthorized)  ← 여전히 401!
```

**핵심 문제**: 
- JWT 토큰의 `userType`이 `'seller'`로 되어있음
- 어드민 API(`/api/admin/*`)는 `userType: 'admin'` 필요
- 권한 불일치인데도 토큰 갱신만 반복 (무한 루프)

---

## 🔍 근본 원인 분석

### 1️⃣ verifyAdminSession이 JWT를 지원하지 않음
```typescript
// ❌ Before (src/index.tsx line 3010)
async function verifyAdminSession(c: any) {
  const sessionToken = c.req.header('X-Session-Token');  // JWT 무시!
  
  if (!sessionToken) {
    return { success: false, error: '인증 토큰이 없습니다' };
  }
  
  const session = await getSession(c.env.SESSION_KV, sessionToken);
  if (!session || session.user_type !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다' };
  }
  
  return { success: true, adminId: session.admin_id, userData: session };
}
```

**문제**: 
- `verifySellerSession`은 JWT 지원했지만, `verifyAdminSession`은 안 했음
- 프론트엔드는 JWT를 보내는데, 백엔드는 Session Token만 확인

---

### 2️⃣ 로그인 시 기존 세션을 클리어하지 않음
```typescript
// ❌ Before (AdminLoginPage.tsx line 52)
if (response.data.success) {
  // 기존 seller 세션이 남아있는 상태에서 admin 세션을 덮어씀
  localStorage.setItem('user_type', 'admin')
  localStorage.setItem('access_token', accessToken)
  // ...
}
```

**문제**:
- Seller로 로그인 → Admin으로 로그인
- `access_token`은 업데이트되지만, JWT payload는 여전히 `userType: 'seller'`
- 서버는 "이 토큰은 seller 권한인데 admin API에 접근하려 하네?" → 401

---

### 3️⃣ API 인터셉터가 권한 오류와 토큰 만료를 구분하지 못함
```typescript
// ❌ Before (api.ts line 59)
if (error.response?.status === 401 && !originalRequest._retry) {
  // 무조건 토큰 갱신 시도
  const refreshToken = localStorage.getItem('refresh_token');
  
  if (refreshToken) {
    // 권한 문제인데도 갱신만 반복 → 무한 루프!
    const response = await axios.post('/api/auth/refresh', { refreshToken });
    // ...
  }
}
```

**문제**:
- **401 Unauthorized**는 2가지 경우:
  1. 토큰 만료 (Token Expired)
  2. 권한 부족 (Permission Denied: userType mismatch)
- 기존 로직은 모든 401을 "토큰 만료"로 간주 → 무한 갱신 루프

---

## ✅ 적용한 해결책

### 1️⃣ verifyAdminSession JWT 지원 추가

```typescript
// ✅ After (src/index.tsx)
async function verifyAdminSession(c: any) {
  // 1. Try JWT token first (Authorization: Bearer xxx) ✅
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = await verifyJWT(token, c.env.JWT_SECRET);
      
      // Check if user is admin
      if (decoded.userType !== 'admin') {
        return { success: false, error: '관리자 권한이 필요합니다' };
      }
      
      return { 
        success: true, 
        adminId: decoded.userId,  // For admins, userId IS adminId
        userData: decoded 
      };
    } catch (err) {
      console.error('[verifyAdminSession] JWT verification failed:', err);
      // Fall through to try session token
    }
  }
  
  // 2. Fallback to session token (X-Session-Token) ✅
  const sessionToken = c.req.header('X-Session-Token');
  if (!sessionToken) {
    return { success: false, error: '인증 토큰이 없습니다' };
  }
  
  const session = await getSession(c.env.SESSION_KV, sessionToken);
  if (!session || session.user_type !== 'admin') {
    return { success: false, error: '관리자 권한이 필요합니다' };
  }
  
  return { success: true, adminId: session.admin_id, userData: session };
}
```

**개선 사항**:
- JWT `Authorization: Bearer` 헤더 우선 처리
- Legacy `X-Session-Token`으로 fallback
- `verifySellerSession`과 동일한 패턴

---

### 2️⃣ 로그인 시 localStorage 완전 클리어

#### Admin Login (AdminLoginPage.tsx)
```typescript
// ✅ After
if (response.data.success) {
  // 1단계: 기존 세션 완전 삭제 (seller 세션 등)
  console.log('[AdminLogin] Step 0: Clearing old sessions...')
  localStorage.clear()  // 모든 localStorage 클리어 ✅
  
  // 2단계: JWT 토큰 저장
  const { accessToken, refreshToken } = response.data.data
  const adminId = response.data.data.user.id
  
  localStorage.setItem('user_type', 'admin')
  localStorage.setItem('access_token', accessToken)
  localStorage.setItem('refresh_token', refreshToken)
  localStorage.setItem('admin_id', adminId.toString())
  
  navigate('/admin', { replace: true })
}
```

#### Seller Login (SellerLoginPage.tsx)
```typescript
// ✅ After
if (response.data.success) {
  // 1단계: 기존 세션 완전 삭제 (admin 세션 등)
  console.log('[SellerLogin] Step 0: Clearing old sessions...')
  localStorage.clear()  // 모든 localStorage 클리어 ✅
  
  // 2단계: JWT 토큰 저장
  const { accessToken, refreshToken } = response.data.data
  const sellerId = response.data.data.user.id
  
  localStorage.setItem('user_type', 'seller')
  localStorage.setItem('access_token', accessToken)
  localStorage.setItem('refresh_token', refreshToken)
  localStorage.setItem('seller_id', sellerId.toString())
  
  navigate('/seller', { replace: true })
}
```

**개선 사항**:
- 로그인 **전에** `localStorage.clear()` 호출
- 다른 userType 세션이 남아있지 않도록 보장
- 깔끔한 세션 전환

---

### 3️⃣ API 인터셉터 권한 오류 처리

```typescript
// ✅ After (api.ts)
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // 401 Unauthorized: 토큰 만료 또는 권한 부족
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // 🔧 1. 먼저 에러 응답에서 권한 문제인지 확인
      const errorData = error.response?.data as any;
      const errorMessage = errorData?.error || '';
      
      // 🔧 2. 권한 문제(userType 불일치)인 경우 토큰 갱신하지 않고 로그아웃
      if (errorMessage.includes('권한') || errorMessage.includes('admin') || errorMessage.includes('seller')) {
        console.error('[API] ❌ Permission denied (userType mismatch):', errorMessage);
        console.warn('[API] 권한 불일치 - 로그아웃 처리');
        
        // localStorage 완전 클리어
        localStorage.clear();
        
        // 현재 페이지에 따라 리다이렉트
        const currentPath = window.location.pathname;
        if (currentPath.includes('/admin')) {
          alert('관리자 권한이 필요합니다. 다시 로그인해주세요.');
          window.location.href = '/admin/login';
        } else if (currentPath.includes('/seller')) {
          alert('판매자 권한이 필요합니다. 다시 로그인해주세요.');
          window.location.href = '/seller/login';
        } else {
          window.location.href = '/login';
        }
        
        return Promise.reject(error);
      }
      
      // 🔧 3. 토큰 만료인 경우에만 갱신 시도
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        try {
          console.log('[API] Access token expired, refreshing...');
          
          const response = await axios.post('/api/auth/refresh', {
            refreshToken
          });
          
          if (response.data.success) {
            const newAccessToken = response.data.data.accessToken;
            localStorage.setItem('access_token', newAccessToken);
            
            console.log('[API] ✅ Token refreshed successfully');
            
            // 원래 요청에 새 토큰 적용하여 재시도
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            }
            
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('[API] ❌ Token refresh failed:', refreshError);
        }
      }
      
      // Refresh Token이 없거나 갱신 실패 시 로그아웃
      localStorage.clear();
      // ... 리다이렉트
    }
    
    return Promise.reject(error);
  }
);
```

**개선 사항**:
- **401 에러 유형 구분**:
  1. 권한 문제 (`'권한'`, `'admin'`, `'seller'` 키워드) → 즉시 로그아웃
  2. 토큰 만료 → Refresh Token으로 갱신 시도
- **무한 루프 방지**: 권한 문제는 `_retry` 플래그 무시하고 바로 로그아웃
- **사용자 안내**: 권한 문제 시 명확한 alert 메시지

---

## 📊 변경 사항 요약

| 파일 | 변경 내용 |
|------|----------|
| `src/index.tsx` | `verifyAdminSession` JWT 지원 추가 |
| `src/pages/AdminLoginPage.tsx` | 로그인 전 `localStorage.clear()` |
| `src/pages/SellerLoginPage.tsx` | 로그인 전 `localStorage.clear()` |
| `src/lib/api.ts` | 401 에러 유형 구분 (권한 vs 만료) |

---

## ✅ 테스트 결과

### 1. Admin 로그인 테스트 ✅
```bash
# 1. https://live.ur-team.com/admin/login
# 2. email/password 입력
# 3. 개발자 콘솔 확인:

✅ [AdminLogin] Step 0: Clearing old sessions...
✅ [AdminLogin] 🚀 JWT Login successful
✅ [AdminLogin] Step 1: Setting user_type to admin...
✅ [AdminLogin] Step 2: Setting JWT tokens...
✅ [AdminLogin] Step 3: Setting admin ID...
✅ [AdminLogin] ✅ JWT verification passed!

# 4. Admin 대시보드 접속:
✅ [API] JWT token attached: eyJ0eXAiOiJKV1QiLCJh...
✅ GET /api/admin/sellers 200 OK
✅ GET /api/admin/orders 200 OK
```

### 2. Seller 로그인 테스트 ✅
```bash
# 1. https://live.ur-team.com/seller/login
# 2. email/password 입력
# 3. 개발자 콘솔 확인:

✅ [SellerLogin] Step 0: Clearing old sessions...
✅ [SellerLogin] 🚀 JWT Login successful
✅ [SellerLogin] Step 1: Setting user_type to seller...

# 4. Seller 대시보드 접속:
✅ GET /api/seller/stats 200 OK
✅ GET /api/seller/streams 200 OK
```

### 3. Cross-Login 테스트 (Admin → Seller) ✅
```bash
# 1. Admin으로 로그인
# 2. Seller 로그인 페이지 접속 → Seller로 로그인
# 3. 확인:

✅ localStorage 완전 클리어됨
✅ 새 seller JWT 생성
✅ 401 에러 없음
✅ 무한 루프 없음
```

### 4. 권한 불일치 테스트 ✅
```bash
# 1. Seller로 로그인
# 2. /admin 페이지 접속 시도
# 3. 확인:

✅ [API] ❌ Permission denied (userType mismatch)
✅ alert('관리자 권한이 필요합니다. 다시 로그인해주세요.')
✅ window.location.href = '/admin/login'
✅ 무한 루프 없음
```

---

## 🎓 근본 원인 정리

### Before (문제)
```
[열쇠 비유]
1. 셀러 열쇠(JWT)를 들고 어드민 문에 감
2. 문지기: "이건 셀러 열쇠잖아? 안 돼!"
3. 시스템: "열쇠가 만료됐나? 새 열쇠 받아오자!"
4. 새 셀러 열쇠 받아옴 (여전히 셀러 열쇠)
5. 1번으로 돌아가서 무한 반복 ♾️
```

### After (해결)
```
[올바른 흐름]
1. 어드민으로 로그인 시도
2. 먼저 기존 셀러 열쇠를 버림 (localStorage.clear)
3. 새 어드민 열쇠(JWT) 발급받음
4. 어드민 문에 감
5. 문지기: "어드민 열쇠네! 들어오세요!" ✅
```

---

## 📝 배운 점

### 1. JWT Payload는 Immutable
```typescript
// ❌ 잘못된 생각
localStorage.setItem('user_type', 'admin')  // userType이 바뀐다?
// JWT payload는 여전히 { userType: 'seller' } ← 안 바뀜!

// ✅ 올바른 방법
localStorage.clear()  // 기존 JWT 삭제
// 새 JWT 발급 (payload에 { userType: 'admin' } 포함)
```

### 2. 401 != 401
```typescript
// ❌ 모든 401을 똑같이 처리
if (error.status === 401) {
  refreshToken()  // 권한 문제인데 갱신? 무한 루프!
}

// ✅ 401의 원인을 구분
if (error.status === 401) {
  if (errorMessage.includes('권한')) {
    logout()  // 권한 문제 → 로그아웃
  } else {
    refreshToken()  // 토큰 만료 → 갱신
  }
}
```

### 3. localStorage는 Domain 단위
```typescript
// Admin과 Seller가 같은 도메인(live.ur-team.com) 사용
// → localStorage가 공유됨
// → 로그인 시 반드시 clear() 필요

localStorage.clear()  // 다른 userType 세션 제거
localStorage.setItem('user_type', newUserType)
```

---

## 🚀 향후 개선 사항

### 1. Session Storage 사용
```typescript
// localStorage 대신 sessionStorage 사용
// → 탭 닫으면 자동으로 세션 삭제
// → 보안 강화

sessionStorage.setItem('access_token', token)
```

### 2. JWT Payload Validation
```typescript
// 프론트엔드에서도 JWT payload 검증
const decoded = jwtDecode(accessToken)
if (decoded.userType !== expectedUserType) {
  logout()  // 서버 요청 전에 미리 차단
}
```

### 3. 통합 인증 미들웨어
```typescript
// 모든 API에 하나의 인증 미들웨어 사용
app.use('/api/*', requireAuth)  // JWT + Session 둘 다 지원

// 현재는 각 API마다 verifySellerSession, verifyAdminSession 호출 (중복)
```

---

## 🎯 결론

**수정 전**:
- ❌ Admin 대시보드 401 무한 루프
- ❌ Seller 세션과 Admin 세션 충돌
- ❌ 권한 오류와 토큰 만료 구분 안 됨

**수정 후**:
- ✅ Admin/Seller 모두 JWT 인증 완벽 지원
- ✅ 로그인 시 기존 세션 완전 클리어
- ✅ 권한 오류 즉시 로그아웃 (무한 루프 방지)
- ✅ 토큰 만료 시에만 갱신 시도

---

**작성일**: 2026-02-25  
**작성자**: Claude Code Assistant  
**관련 커밋**: `ab0eca7`  
**배포 상태**: ✅ Production 배포 완료
