# 🎯 최종 설정 가이드

## 현재 상황

### ✅ 완료된 작업
1. **Multi-auth 시스템 구현** (Firebase + JWT)
   - Buyer: Firebase Auth
   - Seller/Admin: JWT 토큰 (localStorage)
2. **AuthContext 리팩토링**
   - 경로 기반 인증 분기 (`/seller`, `/admin` → JWT)
   - 강제 3초 타임아웃 제거 (JWT 경로)
3. **bcrypt 비밀번호 해싱**
4. **401 에러 원인 파악**: 데이터베이스에 계정이 없음

### 🚨 현재 문제
- Cloudflare D1 데이터베이스에 admin/seller 계정이 없어서 **401 Unauthorized** 발생

---

## 📋 해결 방법 (5분)

### 1️⃣ Cloudflare Dashboard 접속

**URL**: https://dash.cloudflare.com

1. 로그인
2. **Workers & Pages** 메뉴 선택
3. **D1** 선택
4. **lister-db** 데이터베이스 클릭
5. **Console** 탭 클릭

### 2️⃣ SQL 실행

아래 SQL을 **전체 복사**하여 Console에 붙여넣기 → **Execute** 버튼 클릭

```sql
-- 🔐 관리자 계정 추가
INSERT OR REPLACE INTO admins (
  id,
  username,
  email,
  password_hash,
  name,
  is_active,
  role,
  created_at,
  updated_at
) VALUES (
  1,
  'tobe2111',
  'tobe2111@naver.com',
  '$2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO',
  '토비',
  1,
  'super_admin',
  datetime('now'),
  datetime('now')
);

-- 🛍️ 셀러 계정 추가
INSERT OR REPLACE INTO sellers (
  id,
  username,
  email,
  password_hash,
  name,
  phone,
  business_number,
  company_name,
  status,
  is_active,
  commission_rate,
  created_at,
  updated_at
) VALUES (
  1,
  'tobe2111',
  'tobe2111@naver.com',
  '$2b$10$ECEIHTgi3Ge1p3g0qre6a.iGbYDPLytQOlrqjBaHB.Qu.GEECEYZi',
  '토비',
  '010-1234-5678',
  '123-45-67890',
  '리스터코퍼레이션',
  'approved',
  1,
  10.0,
  datetime('now'),
  datetime('now')
);

-- 검증 쿼리 (결과 확인)
SELECT 'ADMIN' AS type, email, name, role, is_active FROM admins WHERE email='tobe2111@naver.com';
SELECT 'SELLER' AS type, email, name, status, is_active FROM sellers WHERE email='tobe2111@naver.com';
```

### 3️⃣ 실행 결과 확인

Console 하단에 다음과 같은 결과가 표시되어야 합니다:

```
Row 1: ADMIN | tobe2111@naver.com | 토비 | super_admin | 1
Row 2: SELLER | tobe2111@naver.com | 토비 | approved | 1
```

✅ 이 결과가 보이면 **성공**입니다!

---

## 🧪 로그인 테스트

### 관리자 로그인

1. 브라우저에서 https://live.ur-team.com/admin/login 접속
2. 다음 정보 입력:
   - **이메일**: `tobe2111@naver.com`
   - **비밀번호**: `358533aa!!`
3. **로그인** 버튼 클릭
4. ✅ **성공 시**: `/admin` 대시보드로 이동

### 셀러 로그인

1. 브라우저에서 https://live.ur-team.com/seller/login 접속
2. 동일한 계정 정보 입력
3. ✅ **성공 시**: `/seller/dashboard`로 이동

---

## 🔍 트러블슈팅

### 여전히 401 에러가 발생하면?

#### 방법 1: 디버그 API 확인

터미널 또는 브라우저에서:

```bash
curl https://live.ur-team.com/api/debug/accounts
```

**예상 출력**:
```json
{
  "sellers": [{
    "id": 1,
    "email": "tobe2111@naver.com",
    "name": "토비",
    "status": "approved",
    "is_active": 1,
    "hash_preview": "$2b$10$ECEIHTgi3Ge1",
    "hash_length": 60
  }],
  "admins": [{
    "id": 1,
    "email": "tobe2111@naver.com",
    "name": "토비",
    "role": "super_admin",
    "is_active": 1,
    "hash_preview": "$2b$10$3WoWNsMd./fG2m",
    "hash_length": 60
  }]
}
```

- **빈 배열 `[]`** → SQL이 실행되지 않음. 다시 실행하세요.
- **해시가 다름** → bcrypt 해시가 잘못됨. 위 SQL을 정확히 복사하세요.

#### 방법 2: Cloudflare Logs 확인

1. Cloudflare Dashboard → Workers & Pages → ur-live
2. **Logs** 탭 클릭
3. 로그인 시도 후 로그 확인:
   - `[Admin Login] ✅ Admin found` → 계정 발견
   - `[Admin Login] 🔐 Password verification...` → 비밀번호 검증 중
   - `[Admin Login] ✅ bcrypt: true` → 비밀번호 일치
   - `[Admin Login] ❌ Admin not found` → SQL 재실행 필요

#### 방법 3: SQL 재실행

Cloudflare Console에서:

```sql
-- 계정 삭제 후 재생성
DELETE FROM admins WHERE email='tobe2111@naver.com';
DELETE FROM sellers WHERE email='tobe2111@naver.com';

-- 위 INSERT SQL 다시 실행
```

---

## 📊 시스템 아키텍처

### 인증 흐름

```
┌─────────────┐
│   Buyer     │ → Firebase Auth (onAuthStateChanged)
└─────────────┘

┌─────────────┐
│   Seller    │ → JWT (localStorage: seller_token, seller_id)
└─────────────┘

┌─────────────┐
│   Admin     │ → JWT (localStorage: admin_token, admin_id)
└─────────────┘
```

### AuthContext 로직

```typescript
useEffect(() => {
  const pathname = window.location.pathname
  
  // JWT 경로
  if (pathname.startsWith('/seller') || pathname.startsWith('/admin')) {
    const token = localStorage.getItem('seller_token') || localStorage.getItem('admin_token')
    if (token) {
      setUserRole('seller' | 'admin')
      setLoading(false)  // ✅ 즉시 로딩 해제
      return
    }
  }
  
  // Firebase 경로 (buyer)
  auth.onAuthStateChanged(user => {
    setUser(user)
    setLoading(false)
  })
}, [])
```

---

## ✅ 체크리스트

- [ ] Cloudflare Dashboard 접속
- [ ] D1 → lister-db → Console 이동
- [ ] SQL 전체 복사 & 실행
- [ ] 검증 쿼리 결과 확인 (2개 행)
- [ ] 관리자 로그인 테스트 (https://live.ur-team.com/admin/login)
- [ ] 셀러 로그인 테스트 (https://live.ur-team.com/seller/login)
- [ ] 디버그 API 확인 (curl)

---

## 🎉 완료 후

- **관리자 대시보드**: 셀러 승인, 주문 관리, 통계 확인
- **셀러 대시보드**: 상품 등록, 라이브 방송, 매출 확인
- **자동 회원가입**: 새 셀러가 `/seller/register`에서 가입 → 관리자 승인 → 로그인 가능

---

## 📞 지원

- **Git Commit**: `2279a6b` (feat: Multi-auth support)
- **Build ID**: `e4e2250e44112b40`
- **배포 URL**: https://live.ur-team.com
- **GitHub**: https://github.com/tobe2111/ur-live

**예상 소요 시간**: 5분
