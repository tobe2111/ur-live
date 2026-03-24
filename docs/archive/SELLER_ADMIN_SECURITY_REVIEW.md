# 셀러 & 어드민 대시보드 보안 검토 보고서
**Date**: 2026-02-15  
**Status**: 🔴 **심각한 보안 문제 발견**  

---

## 🚨 발견된 보안 문제

### 1️⃣ **셀러 로그인 - 세션 토큰 저장소 불일치**

**파일**: `SellerLoginPage.tsx` (Line 36)

```typescript
// ❌ 잘못된 저장소 사용
localStorage.setItem('session_token', response.data.data.sessionToken)
```

**문제점**:
- 일반 사용자는 `user_session_token` 사용
- 셀러는 `session_token` 사용
- **저장소 키가 달라서 인증이 제대로 작동하지 않음**

**영향**:
- 셀러가 로그인해도 세션 인증 실패
- API 호출 시 401 Unauthorized 오류 발생
- 데이터 조회 불가

---

### 2️⃣ **어드민 로그인 - 동일한 세션 토큰 저장소 문제**

**파일**: `AdminLoginPage.tsx` (Line 25)

```typescript
// ❌ 잘못된 저장소 사용
localStorage.setItem('session_token', response.data.data.sessionToken)
```

**문제점**:
- 일반 사용자, 셀러, 어드민 모두 다른 키를 사용해야 하는데
- 셀러와 어드민이 같은 `session_token` 키를 사용
- **세션 충돌 가능**

---

### 3️⃣ **셀러 대시보드 - 로그아웃 기능 없음**

**파일**: `SellerPage.tsx`

**문제점**:
- ✅ 로그인 체크는 있음 (Line 78-84)
- ❌ **로그아웃 버튼이 없음**
- ❌ **로그아웃 함수가 없음**

**현재 상태**:
```typescript
// 헤더에 Settings 버튼만 있음 (Line 190-196)
<button 
  onClick={() => navigate('/seller/profile')}
  className="text-[#1d1d1f] hover:opacity-60 transition-opacity"
  title="프로필 편집"
>
  <Settings className="h-5 w-5" />
</button>
```

**해결 방법**:
- 헤더에 로그아웃 버튼 추가
- `logout()` 함수 구현 필요

---

### 4️⃣ **어드민 대시보드 - 로그아웃 기능 존재 (정상)**

**파일**: `AdminPage.tsx` (Line 150-155)

```typescript
// ✅ 올바른 로그아웃 구현
function logout() {
  localStorage.removeItem('session_token')
  localStorage.removeItem('user_type')
  localStorage.removeItem('admin_id')
  navigate('/admin/login')
}
```

**상태**: ✅ 정상 동작

---

### 5️⃣ **API 헤더 불일치 문제**

**셀러 대시보드** (Line 104, 133):
```typescript
// ❌ X-Session-Token 헤더 사용
headers: { 'X-Session-Token': sessionToken }
```

**문제점**:
- 백엔드 `requireAuth` 미들웨어는 **`Authorization` 헤더 또는 쿠키**를 기대
- `X-Session-Token`은 인식하지 않음
- **API 호출 시 401 오류 발생**

**올바른 방법**:
```typescript
// ✅ Authorization Bearer 토큰 사용
headers: { 'Authorization': `Bearer ${sessionToken}` }
```

---

## 📊 보안 문제 요약

| 문제 | 파일 | 심각도 | 영향 |
|------|------|--------|------|
| 세션 토큰 저장소 불일치 | SellerLoginPage.tsx | 🔴 높음 | 로그인 후 API 호출 실패 |
| 세션 토큰 저장소 불일치 | AdminLoginPage.tsx | 🔴 높음 | 로그인 후 API 호출 실패 |
| 로그아웃 기능 없음 | SellerPage.tsx | 🟠 중간 | 로그아웃 불가능 |
| API 헤더 불일치 | SellerPage.tsx | 🔴 높음 | 데이터 조회 불가 |
| API 헤더 불일치 | AdminPage.tsx | 🔴 높음 | 데이터 조회 불가 |

---

## ✅ 수정 방안

### 1️⃣ **세션 토큰 저장소 통일**

**SellerLoginPage.tsx 수정**:
```typescript
// Before (Line 36)
localStorage.setItem('session_token', response.data.data.sessionToken)

// After
localStorage.setItem('seller_session_token', response.data.data.sessionToken)
localStorage.setItem('user_type', 'seller')
localStorage.setItem('seller_id', response.data.data.user.id)
```

**AdminLoginPage.tsx 수정**:
```typescript
// Before (Line 25)
localStorage.setItem('session_token', response.data.data.sessionToken)

// After
localStorage.setItem('admin_session_token', response.data.data.sessionToken)
localStorage.setItem('user_type', 'admin')
localStorage.setItem('admin_id', response.data.data.user.id)
```

---

### 2️⃣ **셀러 대시보드 로그아웃 기능 추가**

**SellerPage.tsx 수정**:

```typescript
// 로그아웃 함수 추가
function logout() {
  localStorage.removeItem('seller_session_token')
  localStorage.removeItem('user_type')
  localStorage.removeItem('seller_id')
  navigate('/seller/login')
}

// 헤더에 로그아웃 버튼 추가 (Line 190-196 수정)
<div className="flex items-center gap-3">
  <button 
    onClick={() => navigate('/seller/profile')}
    className="text-[#1d1d1f] hover:opacity-60 transition-opacity"
    title="프로필 편집"
  >
    <Settings className="h-5 w-5" />
  </button>
  <button 
    onClick={logout}
    className="text-[#ff3b30] hover:opacity-60 transition-opacity font-medium text-[14px]"
  >
    로그아웃
  </button>
</div>
```

---

### 3️⃣ **API 헤더 수정**

**SellerPage.tsx 수정** (Line 104, 133):
```typescript
// Before
headers: { 'X-Session-Token': sessionToken }

// After
headers: { 'Authorization': `Bearer ${sessionToken}` }
```

**AdminPage.tsx 수정** (Line 64, 99, 115, 137):
```typescript
// Before
headers: { 'X-Session-Token': token }

// After
headers: { 'Authorization': `Bearer ${token}` }
```

---

### 4️⃣ **인증 체크 로직 수정**

**SellerPage.tsx 수정** (Line 78, 92):
```typescript
// Before
const sessionToken = localStorage.getItem('session_token')

// After
const sessionToken = localStorage.getItem('seller_session_token')
```

**AdminPage.tsx 수정** (Line 48, 60):
```typescript
// Before
const token = localStorage.getItem('session_token')

// After
const token = localStorage.getItem('admin_session_token')
```

**AdminPage.tsx logout 함수 수정** (Line 150-155):
```typescript
// Before
localStorage.removeItem('session_token')

// After
localStorage.removeItem('admin_session_token')
```

---

## 🎯 우선순위

### 🔴 긴급 (즉시 수정):
1. 세션 토큰 저장소 키 통일
2. API 헤더 수정 (`X-Session-Token` → `Authorization: Bearer`)
3. 인증 체크 로직 수정

### 🟠 높음 (24시간 내):
1. 셀러 대시보드 로그아웃 기능 추가
2. 모든 API 호출 헤더 검증

### 🟡 중간 (1주일 내):
1. 세션 관리 유틸 함수 작성 (중복 코드 제거)
2. 세션 만료 처리 로직 추가
3. E2E 테스트 추가

---

## 🔗 관련 문서

- [API_SECURITY_IMPROVEMENTS.md](./API_SECURITY_IMPROVEMENTS.md) - API 보안 강화
- [FRONTEND_API_FIX.md](./FRONTEND_API_FIX.md) - 프론트엔드 API 수정
- [SERVICE_HEALTH_CHECK.md](./SERVICE_HEALTH_CHECK.md) - 서비스 헬스 체크

---

**작성자**: AI Developer  
**검토 필요**: 셀러 및 어드민 페이지 전체  
**긴급도**: 🔴 높음  
