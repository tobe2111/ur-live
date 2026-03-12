# 🔐 영구 로그인 (Stay Logged In) 상태 분석

**날짜**: 2026-03-12  
**목적**: 4가지 로그인 방식의 영구 로그인 구현 여부 확인

---

## 📋 현재 상태 요약

| 로그인 방식 | 영구 로그인 | 토큰 수명 | 자동 갱신 | 상태 |
|------------|-----------|----------|----------|------|
| User - Kakao (Firebase) | ✅ 구현됨 | 1시간 | ✅ 자동 | 완벽 |
| User - Google (Firebase) | ✅ 구현됨 | 1시간 | ✅ 자동 | 완벽 |
| Seller - JWT | ⚠️ 부분 구현 | 7일 | ❌ 수동 | 개선 필요 |
| Admin - JWT | ⚠️ 부분 구현 | 7일 | ❌ 수동 | 개선 필요 |

---

## 🔍 상세 분석

### 1. User - Firebase (Kakao/Google)

#### ✅ 현재 구현 상태
```typescript
// Firebase SDK가 자동으로 처리
- ID Token: 1시간 수명
- Refresh Token: 영구 (localStorage에 자동 저장)
- 자동 갱신: user.getIdToken(true)로 자동 refresh
```

**작동 방식**:
1. 로그인 시 Firebase SDK가 자동으로 토큰 저장
2. 브라우저 재시작 후에도 자동 로그인
3. 1시간마다 자동으로 토큰 갱신
4. 사용자가 수동으로 로그아웃하기 전까지 유지

**구현 위치**:
- `src/lib/firebase-auth.ts`: Firebase SDK 초기화
- `src/lib/api.ts`: 자동 토큰 갱신 (401 시)
- `src/App.tsx`: onAuthStateChanged 전역 리스너

**평가**: 🟢 **완벽** - 추가 작업 불필요

---

### 2. Seller - JWT

#### ⚠️ 현재 구현 상태
```typescript
// src/pages/SellerLoginPage.tsx
localStorage.setItem('seller_token', accessToken)  // 7일 수명
localStorage.setItem('seller_refresh_token', refreshToken)  // 30일 수명

// Remember Me: 이메일만 저장
if (rememberMe) {
  localStorage.setItem('seller_remember_email', formData.email)
}
```

**문제점**:
1. ❌ **Refresh Token 사용 안 함**: `seller_refresh_token`을 저장만 하고 사용하지 않음
2. ❌ **자동 갱신 없음**: Access Token 만료 시 자동 갱신 로직 없음
3. ⚠️ **7일 후 재로그인 필요**: Access Token 만료 후 로그아웃

**백엔드 API 확인 필요**:
- `POST /api/seller/refresh`: Refresh Token으로 새 Access Token 발급 API 존재 여부

**현재 동작**:
```
Day 0: 로그인 성공 → seller_token (7일) + seller_refresh_token (30일) 저장
Day 1-6: seller_token 유효 → 정상 작동
Day 7: seller_token 만료 → 401 에러 → /seller/login 리다이렉트 (재로그인 필요)
```

**개선 필요**: 🟡 **Medium Priority**

---

### 3. Admin - JWT

#### ⚠️ 현재 구현 상태
Seller와 동일한 문제:
```typescript
localStorage.setItem('admin_token', accessToken)  // 7일 수명
localStorage.setItem('admin_refresh_token', refreshToken)  // 30일 수명
```

**문제점**: Seller와 동일

**개선 필요**: 🟡 **Medium Priority**

---

## 🛠️ 개선 방안

### Option 1: Refresh Token 자동 갱신 (권장)

#### 구현 방법
```typescript
// src/lib/api.ts - Response Interceptor 개선
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const url = originalRequest.url || '';
      
      // Seller JWT 401 처리
      if (url.includes('/api/seller/')) {
        const refreshToken = localStorage.getItem('seller_refresh_token');
        
        if (refreshToken) {
          try {
            // ✅ Refresh Token으로 새 Access Token 발급
            const response = await axios.post('/api/seller/refresh', {
              refreshToken
            });
            
            const { accessToken } = response.data;
            
            // ✅ 새 토큰 저장
            localStorage.setItem('seller_token', accessToken);
            
            // ✅ 원래 요청 재시도
            originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            return api(originalRequest);
            
          } catch (refreshError) {
            // Refresh Token도 만료 → 로그아웃
            clearAuthData('seller');
            window.location.href = '/seller/login';
          }
        }
      }
      
      // Admin JWT 401 처리 (동일)
      if (url.includes('/api/admin/')) {
        // ... 동일한 로직
      }
    }
    
    return Promise.reject(error);
  }
);
```

**장점**:
- ✅ 30일 동안 자동 로그인
- ✅ 사용자 경험 개선
- ✅ 보안 유지 (Refresh Token 사용)

**단점**:
- ⚠️ 백엔드 API 필요: `POST /api/seller/refresh`, `POST /api/admin/refresh`

---

### Option 2: Access Token 수명 연장 (비권장)

#### 구현 방법
```typescript
// 백엔드에서 Access Token 수명을 7일 → 30일로 연장
```

**장점**:
- ✅ 프론트엔드 수정 최소

**단점**:
- ❌ 보안 위험: Access Token이 탈취되면 30일 동안 악용 가능
- ❌ Best Practice 위반: JWT Access Token은 짧게 유지

---

### Option 3: Remember Me 완전 구현 (선택사항)

#### 구현 방법
```typescript
// Remember Me 체크 시 Refresh Token 사용
// 체크 안 하면 세션 종료 시 로그아웃
if (rememberMe) {
  // Refresh Token 저장 (현재와 동일)
} else {
  // Refresh Token 삭제
  // 브라우저 닫으면 로그아웃
}
```

**장점**:
- ✅ 사용자 선택권 제공
- ✅ 공용 PC 보안 개선

**단점**:
- ⚠️ 복잡도 증가

---

## 🔍 백엔드 API 확인 필요

### 필요한 API

#### 1. Seller Refresh Token
```http
POST /api/seller/refresh
Content-Type: application/json

{
  "refreshToken": "seller_refresh_token"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token" (optional)
  }
}
```

#### 2. Admin Refresh Token
```http
POST /api/admin/refresh
Content-Type: application/json

{
  "refreshToken": "admin_refresh_token"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token" (optional)
  }
}
```

---

## 📊 영구 로그인 비교

### 현재 구현

| 상황 | User (Firebase) | Seller (JWT) | Admin (JWT) |
|------|----------------|--------------|-------------|
| 브라우저 재시작 | ✅ 자동 로그인 | ❌ 7일 후 재로그인 | ❌ 7일 후 재로그인 |
| 1시간 후 | ✅ 자동 갱신 | ✅ 작동 | ✅ 작동 |
| 7일 후 | ✅ 자동 갱신 | ❌ 재로그인 필요 | ❌ 재로그인 필요 |
| 30일 후 | ✅ 자동 갱신 | ❌ 재로그인 필요 | ❌ 재로그인 필요 |

### 개선 후 (Refresh Token 사용)

| 상황 | User (Firebase) | Seller (JWT) | Admin (JWT) |
|------|----------------|--------------|-------------|
| 브라우저 재시작 | ✅ 자동 로그인 | ✅ 자동 로그인 | ✅ 자동 로그인 |
| 1시간 후 | ✅ 자동 갱신 | ✅ 작동 | ✅ 작동 |
| 7일 후 | ✅ 자동 갱신 | ✅ 자동 갱신 | ✅ 자동 갱신 |
| 30일 후 | ✅ 자동 갱신 | ❌ 재로그인 필요 | ❌ 재로그인 필요 |

---

## 🎯 권장 사항

### 우선순위 1: Refresh Token 자동 갱신 구현

**작업 범위**:
1. 백엔드 API 확인: `/api/seller/refresh`, `/api/admin/refresh` 존재 여부
2. `src/lib/api.ts`: Response Interceptor에 Refresh Token 로직 추가
3. 테스트: 7일 후 자동 갱신 확인

**예상 소요 시간**: 2-3시간

**효과**:
- ✅ Seller/Admin 30일 동안 자동 로그인
- ✅ 사용자 경험 대폭 개선
- ✅ User와 동일한 수준의 편의성

---

### 우선순위 2: Remember Me 완전 구현 (선택사항)

**작업 범위**:
1. Remember Me 체크 박스에 따라 Refresh Token 저장/삭제
2. 세션 스토리지 vs 로컬 스토리지 분기

**예상 소요 시간**: 1-2시간

**효과**:
- ✅ 공용 PC 보안 개선
- ✅ 사용자 선택권 제공

---

## 📝 결론

### 질문: "영구적으로 로그인 문제는 각 4가지 방식에서 해결이 된거야?"

**답변**: 
- ✅ **User (Firebase)**: 완벽하게 해결됨 (자동 갱신)
- ⚠️ **Seller (JWT)**: 부분적 해결 (7일 후 재로그인 필요)
- ⚠️ **Admin (JWT)**: 부분적 해결 (7일 후 재로그인 필요)

**현재 상태**:
- User는 영구적으로 로그인 유지 ✅
- Seller/Admin은 7일마다 재로그인 필요 ⚠️

**개선 필요**:
- Refresh Token 자동 갱신 구현 → 30일 로그인 유지
- 백엔드 API 확인 및 구현

**긴급도**: 🟡 Medium (기능적으로 작동하지만 UX 개선 필요)
