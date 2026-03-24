# Cloudflare D1 Database Setup

## 🚨 중요: 데이터베이스에 계정이 없어서 401 에러 발생 중

### 1️⃣ Cloudflare Dashboard에서 SQL 실행

**URL**: https://dash.cloudflare.com

#### 단계:
1. 로그인 후 Workers & Pages 선택
2. D1 메뉴 선택
3. `lister-db` 데이터베이스 선택
4. Console 탭 클릭
5. 아래 SQL 복사 후 실행

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

-- 🛍️ 셀러 계정 추가 (선택사항)
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

-- 검증 쿼리
SELECT 'ADMIN' AS type, email, name, role, is_active FROM admins WHERE email='tobe2111@naver.com';
SELECT 'SELLER' AS type, email, name, status, is_active FROM sellers WHERE email='tobe2111@naver.com';
```

### 2️⃣ 로그인 정보

**이메일**: tobe2111@naver.com
**비밀번호**: 358533aa!!

#### 로그인 URL:
- 관리자: https://live.ur-team.com/admin/login
- 셀러: https://live.ur-team.com/seller/login

### 3️⃣ 검증

SQL 실행 후 다음 결과가 나와야 합니다:

```
ADMIN | tobe2111@naver.com | 토비 | super_admin | 1
SELLER | tobe2111@naver.com | 토비 | approved | 1
```

### 4️⃣ 로그인 테스트

브라우저에서:
1. https://live.ur-team.com/admin/login 접속
2. 이메일: tobe2111@naver.com
3. 비밀번호: 358533aa!!
4. 로그인 버튼 클릭

성공 시 `/admin` 대시보드로 이동합니다.

---

## 🔧 Wrangler CLI (선택사항)

터미널에서 실행:

```bash
# SQL 파일 실행
npx wrangler d1 execute lister-db --remote --file=QUICK_FIX_LOGIN.sql

# 직접 쿼리
npx wrangler d1 execute lister-db --remote --command="SELECT * FROM admins WHERE email='tobe2111@naver.com';"
```

---

## 📊 디버그 API

배포 후 계정 상태 확인:

```bash
curl https://live.ur-team.com/api/debug/accounts
```

예상 출력:
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

---

## ⚠️ 주의사항

1. **비밀번호 해시**: 절대 직접 수정하지 마세요. bcrypt 해시 그대로 사용해야 합니다.
2. **is_active**: 반드시 `1`이어야 로그인 가능합니다.
3. **status** (셀러만): `'approved'`여야 로그인 가능합니다.
4. **SQL 실행 확인**: 검증 쿼리로 결과 확인 필수.

---

## 🎯 다음 단계

1. ✅ SQL 실행 (Cloudflare Dashboard)
2. ✅ 검증 쿼리 결과 확인
3. ✅ 로그인 테스트 (브라우저)
4. ✅ 디버그 API 확인 (curl)

**예상 소요 시간**: 2-3분
