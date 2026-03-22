# Admin 계정 업데이트 가이드

## 🚨 중요: D1 데이터베이스에 Admin 계정을 업데이트해야 합니다!

SQL 파일만 수정했기 때문에, **실제 데이터베이스에는 아직 반영되지 않았습니다**.

---

## 📋 새 Admin 계정 정보

```
이메일: tobe2111@naver.com
비밀번호: 358533aa!!
역할: super_admin
```

---

## 🔧 방법 1: Cloudflare Dashboard (추천)

### 단계:

1. **Cloudflare Dashboard 접속**
   - https://dash.cloudflare.com 로 이동
   
2. **Workers & Pages → D1 Database 선택**
   - `toss-live-commerce-db` 선택
   
3. **Console 탭 클릭**

4. **다음 SQL 실행**:

```sql
-- Delete old admin account
DELETE FROM admins WHERE email = 'admin@ur-team.com';

-- Insert new admin account
INSERT OR REPLACE INTO admins (
  id,
  username,
  email,
  password_hash,
  name,
  role,
  created_at
) VALUES (
  1,
  'admin',
  'tobe2111@naver.com',
  'kab8FgvYmXuY1XHG45TP6w==$mcP6dhIWmFbCRJ620KVEJwu34F+mKAbRVUWOdEHLIP4=',
  '관리자',
  'super_admin',
  datetime('now')
);

-- Verify
SELECT id, username, email, name, role, created_at 
FROM admins 
WHERE email = 'tobe2111@naver.com';
```

5. **확인**: 마지막 SELECT 문에서 새 계정이 보이면 성공!

---

## 🔧 방법 2: Wrangler CLI (대체 방법)

### 사전 준비:
- Cloudflare API Token이 환경 변수로 설정되어 있어야 함
- https://developers.cloudflare.com/fundamentals/api/get-started/create-token/

### 명령어:

```bash
# 1. API Token 설정 (필수)
export CLOUDFLARE_API_TOKEN="your_api_token_here"

# 2. SQL 파일 실행
npx wrangler d1 execute toss-live-commerce-db --remote --file=update-admin-account.sql

# 3. 확인
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT * FROM admins WHERE email = 'tobe2111@naver.com'"
```

---

## ✅ 업데이트 완료 후 테스트

1. **Admin 로그인 페이지 접속**
   - https://live.ur-team.com/admin/login

2. **새 계정으로 로그인**
   - 이메일: `tobe2111@naver.com`
   - 비밀번호: `358533aa!!`

3. **"이메일 기억하기" 체크박스 테스트**
   - ✅ 체크하면 다음 로그인 시 이메일 자동 입력
   - ❌ 체크하지 않으면 이메일 기억 안함

---

## 🔒 보안 정보

### 비밀번호 해시 방식
- **알고리즘**: PBKDF2
- **Iterations**: 100,000
- **Hash**: SHA-256
- **Salt**: 16 bytes (random)
- **Format**: `salt$hash` (Base64 인코딩)

### 생성된 해시
```
kab8FgvYmXuY1XHG45TP6w==$mcP6dhIWmFbCRJ620KVEJwu34F+mKAbRVUWOdEHLIP4=
```

---

## 📝 참고 파일

이미 업데이트된 SQL 파일들:
- `create-test-accounts-secure.sql`
- `QUICK_FIX_LOGIN.sql`
- `create-test-accounts.sql`
- `database-complete-init.sql`
- `update-admin-account.sql` (새로 생성됨)

---

## ❓ 문제 해결

### 문제: "이메일 또는 비밀번호가 올바르지 않습니다"
- → D1 데이터베이스 업데이트를 아직 안했을 가능성 높음
- → 위의 방법 1 또는 2로 데이터베이스 업데이트 필요

### 문제: Wrangler 명령어 실행 시 "CLOUDFLARE_API_TOKEN not configured"
- → API Token 설정 필요
- → https://dash.cloudflare.com → My Profile → API Tokens → Create Token

### 문제: "Resource location: remote" 경고 후 실행 안됨
- → API Token이 설정되지 않았거나 만료됨
- → 새 토큰 발급 후 재시도

---

## 🎯 권장 사항

1. **Cloudflare Dashboard 사용 권장** (가장 간단)
2. 업데이트 후 즉시 로그인 테스트
3. "이메일 기억하기" 기능 활성화하여 편리하게 사용

---

**작성일**: 2026-03-12  
**업데이트**: Admin 계정 변경 및 자동 로그인 기능 추가
