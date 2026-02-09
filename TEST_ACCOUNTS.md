# 테스트 계정 정보

## 🔐 어드민 계정

### 로그인 정보
- **URL**: https://live.ur-team.com/admin/login
- **이메일**: `admin@ur-team.com`
- **비밀번호**: `admin123`
- **권한**: Super Admin

### 기능
- 판매자 승인/거부
- 판매자 수수료율 관리
- 라이브 스트림 삭제
- 정산 대시보드 접근
- 전체 통계 확인

---

## 🏪 셀러 계정

### 로그인 정보
- **URL**: https://live.ur-team.com/seller/login
- **이메일**: `seller@ur-team.com`
- **비밀번호**: `seller123`
- **상태**: Approved (승인됨)
- **사업자명**: 테스트 상점
- **수수료율**: 10%

### 기능
- 상품 등록/수정/삭제
- 라이브 스트림 생성/관리
- 주문 관리
- 정산 내역 확인
- 사업자 정보 관리

---

## 👤 일반 사용자 계정

### 로그인 정보
- **URL**: https://live.ur-team.com/login
- **이메일**: `user@example.com`
- **비밀번호**: `user123`

### 기능
- 상품 구매
- 라이브 시청
- 장바구니 관리
- 주문 내역 확인

---

## 📝 테스트 방법

### 어드민 로그인 테스트
```bash
curl -X POST https://live.ur-team.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ur-team.com","password":"admin123"}'
```

### 셀러 로그인 테스트
```bash
curl -X POST https://live.ur-team.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"seller@ur-team.com","password":"seller123","userType":"seller"}'
```

### 일반 사용자 로그인 테스트
```bash
curl -X POST https://live.ur-team.com/api/auth/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"user123"}'
```

---

## 🔄 계정 생성 SQL

```sql
-- 어드민 계정
INSERT INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('admin', 'admin@ur-team.com', 'placeholder_hash_for_admin123', '관리자', 'super_admin', datetime('now'));

-- 셀러 계정
INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('testseller', 'seller@ur-team.com', 'placeholder_hash_for_seller123', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));
```

---

## ⚠️ 주의사항

1. **프로덕션 환경**: 이 계정들은 테스트용입니다. 실제 서비스 전에 삭제하거나 비밀번호를 변경하세요.
2. **비밀번호 해시**: 현재는 간단한 해시 방식(`placeholder_hash_for_PASSWORD`)을 사용합니다. 실제로는 bcrypt 등을 사용해야 합니다.
3. **권한 관리**: 어드민 계정은 모든 권한을 가지므로 신중하게 관리하세요.

---

생성일: 2026-02-09
