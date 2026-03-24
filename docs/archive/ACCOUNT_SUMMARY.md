# 🔐 UR-Live 계정 정보 요약

## 📊 **현재 존재하는 계정 (테스트 환경 기준)**

### **1. 👨‍💼 관리자 계정 (Admin)**

#### **테스트 관리자 계정**
```
📧 이메일: admin@ur-team.com
🔑 비밀번호: admin123
👤 이름: 관리자
🎖️ 권한: super_admin
📍 로그인 URL: https://live.ur-team.com/admin/login
```

**기능**:
- ✅ 전체 매출 통계 대시보드
- ✅ 사용자 관리 (조회, 수정, 삭제)
- ✅ 판매자 승인/거부/정지
- ✅ 정산 관리 (판매자 정산 처리)
- ✅ 배너 관리 (홈페이지 배너 등록/수정/삭제)
- ✅ 라이브 스트림 관리
- ✅ 상품 관리 (전체 상품 조회/수정)
- ✅ 주문 관리 (전체 주문 내역 조회)

**⚠️ 주의**: 
- 이 계정은 `create-test-accounts.sql`에 정의되어 있습니다
- **프로덕션 DB에 실제로 생성되었는지 확인 필요**
- 비밀번호는 PBKDF2로 해싱되어 저장됩니다

---

### **2. 🏪 판매자 계정 (Seller)**

#### **테스트 판매자 계정**
```
📧 이메일: seller@ur-team.com
🔑 비밀번호: seller123
👤 이름: 테스트 셀러
🎯 아이디: testseller
🏪 사업자명: 테스트 상점
📋 사업자번호: 123-45-67890
📞 전화번호: 010-1234-5678
✅ 상태: approved (승인됨)
💰 수수료율: 10.00%
📍 로그인 URL: https://live.ur-team.com/seller/login
```

**기능**:
- ✅ 판매자 대시보드 (매출 통계)
- ✅ 상품 관리 (등록, 수정, 삭제, 재고 관리)
- ✅ 주문 관리 (배송 처리, 주문 상태 변경)
- ✅ 라이브 스트리밍 생성 및 컨트롤
- ✅ 정산 내역 조회
- ✅ 세금계산서 관리
- ✅ 사업자 정보 관리
- ✅ 알림톡 발송 (주문 확인, 배송 안내)

**⚠️ 주의**: 
- 이 계정은 `create-test-accounts.sql`에 정의되어 있습니다
- **프로덕션 DB에 실제로 생성되었는지 확인 필요**
- 비밀번호는 PBKDF2로 해싱되어 저장됩니다

---

### **3. 👤 일반 사용자 계정 (User)**

#### **카카오 로그인 사용자**
```
🔐 인증 방식: 카카오 OAuth 2.0
📍 로그인 URL: https://live.ur-team.com/login
🔄 Redirect URL: https://live.ur-team.com/auth/kakao/callback
```

**로그인 방법**:
1. https://live.ur-team.com/login 접속
2. "카카오로 시작하기" 버튼 클릭
3. 카카오 계정으로 로그인
4. 자동으로 회원가입 및 로그인 완료

**기능**:
- ✅ 상품 조회 및 검색
- ✅ 장바구니 관리
- ✅ 주문 및 결제 (Toss Payments)
- ✅ 주문 내역 조회
- ✅ 배송지 관리
- ✅ 찜 목록
- ✅ 프로필 수정 (이름, 이메일, 프로필 사진)
- ✅ 계정 설정
- ✅ 라이브 스트리밍 시청 및 채팅
- ✅ 쇼츠 비디오 시청

**저장되는 정보**:
- `kakao_id`: 카카오 고유 ID
- `name`: 카카오 닉네임
- `email`: 카카오 이메일 (선택)
- `profile_image`: 카카오 프로필 이미지
- `phone`: 전화번호 (주문 시 입력)

**⚠️ 주의**: 
- 실제 카카오 계정으로 로그인해야 합니다
- 테스트 환경에서는 개발자 본인의 카카오 계정 사용 권장

---

## 🗄️ **데이터베이스 테이블 구조**

### **users 테이블**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  toss_user_id TEXT UNIQUE,           -- Toss 결제 사용자 ID (nullable)
  name TEXT NOT NULL,                 -- 사용자 이름
  email TEXT,                         -- 이메일 주소
  phone TEXT,                         -- 전화번호
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  kakao_id TEXT UNIQUE,               -- 카카오 로그인 ID
  profile_image TEXT                  -- 프로필 이미지 URL
);
```

### **admins 테이블**
```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,      -- 관리자 아이디
  email TEXT UNIQUE NOT NULL,         -- 이메일 주소
  password_hash TEXT NOT NULL,        -- 비밀번호 해시 (PBKDF2)
  name TEXT NOT NULL,                 -- 관리자 이름
  role TEXT DEFAULT 'admin',          -- 권한 (admin, super_admin)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **sellers 테이블**
```sql
CREATE TABLE sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,      -- 판매자 아이디
  email TEXT UNIQUE NOT NULL,         -- 이메일 주소
  password_hash TEXT NOT NULL,        -- 비밀번호 해시 (PBKDF2)
  name TEXT NOT NULL,                 -- 판매자 이름
  business_name TEXT,                 -- 사업자명
  business_number TEXT UNIQUE,        -- 사업자 번호
  phone TEXT,                         -- 전화번호
  status TEXT DEFAULT 'pending',      -- 상태 (pending, approved, rejected, suspended)
  commission_rate REAL DEFAULT 10.00, -- 수수료율 (%)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 **비밀번호 해싱 (PBKDF2)**

### **알고리즘**: PBKDF2 with SHA-256
- **Iterations**: 100,000 (OWASP 권장)
- **Salt**: 16 bytes (128 bits)
- **Hash**: 32 bytes (256 bits)
- **Format**: `salt$hash` (Base64 인코딩)

### **구현 파일**: `src/lib/password.ts`

```typescript
// 비밀번호 해싱
const hashedPassword = await hashPassword('admin123')
// 결과 예시: "Xr7kP2q9W4v5Z8c="$"aB3dF5gH7jK9lM2nP4qR6sT8uV0wX3yZ5="

// 비밀번호 검증
const isValid = await verifyPassword('admin123', storedHash)
// true or false
```

### **보안 특징**:
- ✅ 랜덤 Salt 사용 (Rainbow Table 방어)
- ✅ 100,000 iterations (Brute Force 방어)
- ✅ Constant-time 비교 (Timing Attack 방어)
- ✅ Cloudflare Workers 호환 (Web Crypto API)

---

## 🔑 **인증 시스템 (Multi-Auth)**

### **1. Firebase 인증 (구매자)**
- **방식**: Firebase Auth + 카카오 OAuth 2.0
- **토큰**: Firebase ID Token (1시간, 자동 갱신)
- **저장**: localStorage (`firebase_token`)
- **파일**: `src/lib/firebase-auth.ts`, `src/utils/auth.ts`

### **2. JWT 인증 (판매자/관리자)**
- **방식**: JWT (JSON Web Token)
- **토큰**: 
  - 판매자: `seller_token`
  - 관리자: `admin_token`
- **저장**: localStorage
- **파일**: `src/lib/seller-auth.ts`, `src/utils/auth.ts`

### **3. 통합 인증 체크** (`src/utils/auth.ts`)
```typescript
// 로그인 상태 확인 (JWT 우선, Firebase 차선)
export function isLoggedIn(): boolean {
  // 1️⃣ JWT 토큰 확인 (판매자/관리자)
  if (userType === 'seller' && localStorage.getItem('seller_token')) return true
  if (userType === 'admin' && localStorage.getItem('admin_token')) return true
  
  // 2️⃣ Firebase 인증 확인 (구매자)
  if (auth.currentUser) return true
  
  return false
}
```

---

## 🌐 **대시보드 및 로그인 URL**

| 계정 타입 | 로그인 URL | 대시보드 URL |
|-----------|-----------|--------------|
| 👤 일반 사용자 | https://live.ur-team.com/login | https://live.ur-team.com/mypage |
| 🏪 판매자 | https://live.ur-team.com/seller/login | https://live.ur-team.com/seller |
| 👨‍💼 관리자 | https://live.ur-team.com/admin/login | https://live.ur-team.com/admin |

---

## 📈 **예상 데이터 현황**

| 테이블 | 예상 레코드 수 | 비고 |
|--------|---------------|------|
| users | 0~10 | 테스트 사용자 또는 실제 카카오 로그인 사용자 |
| admins | 0~1 | 관리자 계정 (생성 여부 미확인) |
| sellers | 0~3 | 판매자 계정 (생성 여부 미확인) |
| products | 50+ | 더미 상품 데이터 존재 |
| orders | 0~5 | 테스트 주문 또는 실제 주문 |
| live_streams | 3 | 더미 라이브 스트림 (최근 복구됨) |

---

## ✅ **테스트 계정 생성 방법**

### **방법 1: Cloudflare 대시보드에서 생성**

1. https://dash.cloudflare.com 로그인
2. **Workers & Pages** → **D1 Database** 선택
3. `toss-live-commerce-db` 클릭
4. **Console** 탭에서 다음 쿼리 실행:

```sql
-- 관리자 계정 생성
INSERT INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('admin', 'admin@ur-team.com', 'admin123_hash', '관리자', 'super_admin', datetime('now'));

-- 판매자 계정 생성
INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('testseller', 'seller@ur-team.com', 'seller123_hash', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));
```

**⚠️ 주의**: `admin123_hash`, `seller123_hash`는 실제 PBKDF2 해시로 교체해야 합니다!

### **방법 2: Wrangler CLI로 생성**

```bash
cd /home/user/webapp
npx wrangler d1 execute toss-live-commerce-db --remote --file=create-test-accounts.sql
```

**전제 조건**: `CLOUDFLARE_API_TOKEN` 환경 변수 설정 필요

---

## 🔍 **실제 데이터 조회 방법**

### **Cloudflare 대시보드에서 조회**

```sql
-- 전체 사용자 조회
SELECT * FROM users ORDER BY created_at DESC;

-- 전체 관리자 조회
SELECT * FROM admins ORDER BY created_at DESC;

-- 전체 판매자 조회
SELECT * FROM sellers ORDER BY created_at DESC;
```

---

## 🚨 **다음 단계 (즉시 실행 필요)**

### **1. 실제 계정 데이터 확인 (5분)**
- Cloudflare 대시보드 접속
- D1 Database 콘솔에서 `SELECT * FROM admins;` 실행
- D1 Database 콘솔에서 `SELECT * FROM sellers;` 실행
- 테스트 계정이 없으면 생성

### **2. 비밀번호 해싱 테스트 (10분)**
```typescript
// Node.js 환경에서 테스트
import { hashPassword } from './src/lib/password'

const adminHash = await hashPassword('admin123')
const sellerHash = await hashPassword('seller123')

console.log('Admin password hash:', adminHash)
console.log('Seller password hash:', sellerHash)
```

### **3. 테스트 로그인 (15분)**
- 관리자 로그인: https://live.ur-team.com/admin/login
  - admin@ur-team.com / admin123
- 판매자 로그인: https://live.ur-team.com/seller/login
  - seller@ur-team.com / seller123
- 카카오 로그인: https://live.ur-team.com/login
  - 본인의 카카오 계정

---

## 📞 **문의**

- **Email**: tobe2111@naver.com
- **GitHub**: https://github.com/tobe2111/ur-live
- **Production URL**: https://live.ur-team.com

---

**마지막 업데이트**: 2026-03-08  
**작성자**: GenSpark AI Developer
