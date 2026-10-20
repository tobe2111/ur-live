# ✅ 어드민 계정 변경 완료

**날짜**: 2026-03-03  
**커밋**: `1cdf308`  
**빌드**: `7844f471fbec6019`

---

## 🔐 변경된 어드민 계정

### **이전 계정** (삭제됨)
```
이메일: admin@example.com
비밀번호: admin123
```

### **새 계정** (현재 사용)
```
이메일: tobe2111@naver.com
비밀번호: 358533aa!!
역할: super_admin
```

---

## 📋 계정 통합

이제 **셀러**와 **어드민** 계정이 **같은 이메일**을 사용합니다:

| 타입 | URL | 이메일 | 비밀번호 | 역할 |
|------|-----|--------|----------|------|
| **셀러** | `/seller/login` | `tobe2111@naver.com` | `358533aa!!` | seller |
| **어드민** | `/admin/login` | `tobe2111@naver.com` | `358533aa!!` | super_admin |

**중요**: 
- ✅ **같은 이메일/비밀번호**지만 **다른 테이블**에 저장됨
- ✅ **셀러 로그인**: `sellers` 테이블 조회 → JWT 토큰 발급
- ✅ **어드민 로그인**: `admins` 테이블 조회 → JWT 토큰 발급
- ✅ **충돌 없음**: 각각 독립적으로 인증됨

---

## 🔒 보안 정보

### **Bcrypt 해시**
```
비밀번호: 358533aa!!
해시: $2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO
```

**알고리즘**: bcrypt  
**솔트 라운드**: 10  
**해시 길이**: 60자

---

## 📁 수정된 파일

### **1. migrations/0104_update_admin_account.sql** (신규)
```sql
-- 어드민 계정 업데이트 마이그레이션
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
```

### **2. migrations/0103_add_bcrypt_test_accounts.sql** (업데이트)
- 어드민 계정 정보 `admin@example.com` → `tobe2111@naver.com` 변경

### **3. COMPLETE_SELLER_ADMIN_AUTHENTICATION.md** (업데이트)
- 모든 어드민 예제 코드 업데이트
- 테스트 계정 목록 업데이트
- API 예제 업데이트

---

## 🚀 배포 방법

### **1단계: 데이터베이스 마이그레이션 실행**

#### **로컬 테스트**
```bash
npx wrangler d1 execute lister-db --local \
  --file=migrations/0104_update_admin_account.sql
```

#### **프로덕션 배포**
```bash
npx wrangler d1 execute lister-db --remote \
  --file=migrations/0104_update_admin_account.sql
```

### **2단계: 검증**

```sql
-- 어드민 계정 확인
SELECT 
  id,
  username,
  email,
  name,
  role,
  is_active,
  CASE 
    WHEN password_hash LIKE '$2b$10$3WoWNsMd.%' THEN '정상 ✅'
    ELSE '오류 ❌'
  END as password_check
FROM admins
WHERE id = 1;
```

**기대 결과**:
```
id: 1
username: tobe2111
email: tobe2111@naver.com
name: 토비
role: super_admin
is_active: 1
password_check: 정상 ✅
```

### **3단계: 로그인 테스트**

#### **브라우저 테스트**
1. https://live.ur-team.com/admin/login 접속
2. 이메일: `tobe2111@naver.com` 입력
3. 비밀번호: `358533aa!!` 입력
4. "로그인" 클릭
5. ✅ `/admin` 대시보드로 리다이렉트 확인

#### **API 테스트**
```bash
curl -X POST https://live.ur-team.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tobe2111@naver.com",
    "password": "358533aa!!"
  }'
```

**기대 응답**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": 1,
      "username": "tobe2111",
      "email": "tobe2111@naver.com",
      "name": "토비"
    }
  }
}
```

---

## 🧪 전체 테스트 시나리오

### **시나리오 1: 어드민 로그인 → 셀러 승인**

```bash
# 1. 어드민 로그인
curl -X POST https://live.ur-team.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tobe2111@naver.com","password":"358533aa!!"}'

# 응답에서 토큰 복사
ADMIN_TOKEN="eyJhbGc..."

# 2. 대기 중인 셀러 목록 조회
curl -X GET https://live.ur-team.com/api/admin/sellers/pending \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. 셀러 승인 (ID: 4)
curl -X PATCH https://live.ur-team.com/api/admin/sellers/4/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 응답: {"success":true,"message":"판매자 승인이 완료되었습니다"}
```

### **시나리오 2: 셀러 로그인 → 장바구니 접근**

```bash
# 1. 셀러 로그인 (같은 계정)
curl -X POST https://live.ur-team.com/api/seller/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tobe2111@naver.com","password":"358533aa!!"}'

# 응답에서 토큰 복사
SELLER_TOKEN="eyJhbGc..."

# 2. 장바구니 접근
curl -X GET https://live.ur-team.com/api/cart \
  -H "Authorization: Bearer $SELLER_TOKEN"

# 응답: {"success":true,"data":[...]}
```

---

## 📊 비교표

### **계정 변경 전후**

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 어드민 이메일 | `admin@example.com` | `tobe2111@naver.com` |
| 어드민 비밀번호 | `admin123` | `358533aa!!` |
| 셀러 이메일 | `tobe2111@naver.com` | `tobe2111@naver.com` (동일) |
| 셀러 비밀번호 | `358533aa!!` | `358533aa!!` (동일) |
| 통합 여부 | ❌ 다른 계정 | ✅ 같은 계정 |

### **로그인 URL**

| 타입 | URL | 계정 |
|------|-----|------|
| 어드민 | https://live.ur-team.com/admin/login | `tobe2111@naver.com` |
| 셀러 | https://live.ur-team.com/seller/login | `tobe2111@naver.com` |

---

## ⚠️ 주의사항

### **1. 같은 이메일, 다른 테이블**

```
tobe2111@naver.com
├── sellers 테이블 (셀러)
│   └── 역할: seller
│   └── 엔드포인트: /api/seller/*
│
└── admins 테이블 (어드민)
    └── 역할: super_admin
    └── 엔드포인트: /api/admin/*
```

**충돌 없는 이유**:
- ✅ 각 로그인 페이지가 다른 테이블 조회
- ✅ JWT 토큰의 `type` 필드로 구분 (`seller` vs `admin`)
- ✅ 미들웨어가 토큰 타입 검증

### **2. 비밀번호 동기화**

⚠️ **주의**: 셀러 또는 어드민 비밀번호를 변경하면 **각각 독립적**으로 변경됩니다.

```sql
-- 셀러 비밀번호만 변경
UPDATE sellers SET password_hash = '<new_hash>' WHERE email = 'tobe2111@naver.com';

-- 어드민 비밀번호만 변경
UPDATE admins SET password_hash = '<new_hash>' WHERE email = 'tobe2111@naver.com';
```

**권장**: 두 계정의 비밀번호를 같게 유지하려면 두 테이블 모두 업데이트

### **3. 마이그레이션 순서**

```bash
# 1. 먼저 테스트 계정 추가 (셀러 포함)
npx wrangler d1 execute lister-db --remote \
  --file=migrations/0103_add_bcrypt_test_accounts.sql

# 2. 그다음 어드민 계정 변경
npx wrangler d1 execute lister-db --remote \
  --file=migrations/0104_update_admin_account.sql
```

---

## ✅ 체크리스트

배포 후 확인 사항:

- [ ] 마이그레이션 0104 실행 완료
- [ ] 데이터베이스 검증 쿼리 실행
- [ ] 어드민 로그인 테스트 (브라우저)
- [ ] 어드민 로그인 테스트 (API)
- [ ] 셀러 로그인 테스트 (같은 계정)
- [ ] 어드민 대시보드 접근 확인
- [ ] 셀러 대시보드 접근 확인
- [ ] 셀러 승인 기능 테스트
- [ ] 장바구니 접근 테스트 (셀러)

---

## 🎯 결과

### **변경 완료**
✅ 어드민 계정 `admin@example.com` → `tobe2111@naver.com` 변경  
✅ 셀러와 어드민이 같은 이메일/비밀번호 사용  
✅ bcrypt 해시 적용 (보안 강화)  
✅ 마이그레이션 스크립트 작성  
✅ 문서 업데이트  
✅ Git 커밋 및 푸시  

### **테스트 계정 (최종)**

#### **셀러 계정**
```
URL: https://live.ur-team.com/seller/login
이메일: tobe2111@naver.com
비밀번호: 358533aa!!
테이블: sellers
역할: seller
상태: approved
```

#### **어드민 계정**
```
URL: https://live.ur-team.com/admin/login
이메일: tobe2111@naver.com
비밀번호: 358533aa!!
테이블: admins
역할: super_admin
```

---

## 📞 다음 단계

### **즉시 실행**
```bash
# 마이그레이션 실행
npx wrangler d1 execute lister-db --remote \
  --file=migrations/0104_update_admin_account.sql
```

### **로그인 테스트**
1. https://live.ur-team.com/admin/login 접속
2. `tobe2111@naver.com` / `358533aa!!` 입력
3. ✅ 로그인 성공 확인

---

**커밋**: `1cdf308`  
**빌드**: `7844f471fbec6019`  
**상태**: ✅ GitHub 푸시 완료  
**배포**: ⏳ 마이그레이션 실행 필요

---

**완료 날짜**: 2026-03-03  
**작업자**: GenSpark AI Developer  
**상태**: ✅ 완료
