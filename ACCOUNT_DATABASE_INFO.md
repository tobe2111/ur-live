# 🔐 UR-Live 계정 정보 및 데이터베이스 현황

## 📊 데이터베이스 구조

### **D1 Database**
- **Database Name**: `toss-live-commerce-db`
- **Database ID**: `d9530ba6-7a26-4c02-9295-3ce5aef112a3`
- **Location**: Cloudflare D1 (Production)

---

## 👥 사용자 계정 (Users)

### **테이블 구조**: `users`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 사용자 고유 ID |
| toss_user_id | TEXT UNIQUE | Toss 결제 사용자 ID (nullable) |
| name | TEXT NOT NULL | 사용자 이름 |
| email | TEXT | 이메일 주소 |
| phone | TEXT | 전화번호 |
| kakao_id | TEXT UNIQUE | 카카오 로그인 ID |
| profile_image | TEXT | 프로필 이미지 URL |
| created_at | DATETIME | 생성일시 |
| updated_at | DATETIME | 수정일시 |

### **테스트 계정**
현재 프로덕션 DB에 실제 사용자 데이터를 조회하려면 Cloudflare 대시보드에서 직접 확인해야 합니다.

**카카오 로그인 테스트 계정**:
- **카카오 계정**: 실제 카카오 계정으로 로그인 가능
- **로그인 URL**: https://live.ur-team.com/login
- **Kakao OAuth Redirect**: https://live.ur-team.com/auth/kakao/callback

---

## 👨‍💼 관리자 계정 (Admins)

### **테이블 구조**: `admins`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 관리자 고유 ID |
| username | TEXT UNIQUE NOT NULL | 관리자 아이디 |
| email | TEXT UNIQUE NOT NULL | 이메일 주소 |
| password_hash | TEXT NOT NULL | 비밀번호 해시 |
| name | TEXT NOT NULL | 관리자 이름 |
| role | TEXT DEFAULT 'admin' | 권한 (admin, super_admin) |
| created_at | DATETIME | 생성일시 |

### **기본 관리자 계정** (테스트 환경)
```
📧 이메일: admin@ur-team.com
🔑 비밀번호: admin123
👤 이름: 관리자
🎖️ 권한: super_admin
📍 로그인 URL: https://live.ur-team.com/admin/login
```

**⚠️ 주의**: 이 계정은 `create-test-accounts.sql`에 정의되어 있으나, 프로덕션 DB에 실제로 생성되었는지 확인 필요.

---

## 🏪 판매자 계정 (Sellers)

### **테이블 구조**: `sellers`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 판매자 고유 ID |
| username | TEXT UNIQUE NOT NULL | 판매자 아이디 |
| email | TEXT UNIQUE NOT NULL | 이메일 주소 |
| password_hash | TEXT NOT NULL | 비밀번호 해시 |
| name | TEXT NOT NULL | 판매자 이름 |
| business_name | TEXT | 사업자명 |
| business_number | TEXT UNIQUE | 사업자 번호 |
| phone | TEXT | 전화번호 |
| status | TEXT DEFAULT 'pending' | 상태 (pending, approved, rejected, suspended) |
| commission_rate | REAL DEFAULT 10.00 | 수수료율 (%) |
| created_at | DATETIME | 생성일시 |
| updated_at | DATETIME | 수정일시 |

### **기본 판매자 계정** (테스트 환경)
```
📧 이메일: seller@ur-team.com
🔑 비밀번호: seller123
👤 이름: 테스트 셀러
🏪 사업자명: 테스트 상점
📋 사업자 번호: 123-45-67890
📞 전화번호: 010-1234-5678
✅ 상태: approved (승인됨)
💰 수수료율: 10.00%
📍 로그인 URL: https://live.ur-team.com/seller/login
```

**⚠️ 주의**: 이 계정은 `create-test-accounts.sql`에 정의되어 있으나, 프로덕션 DB에 실제로 생성되었는지 확인 필요.

---

## 🔍 계정 데이터 조회 방법

### **방법 1: Cloudflare 대시보드**
1. https://dash.cloudflare.com 로그인
2. **Workers & Pages** → **D1 Database** 선택
3. `toss-live-commerce-db` 클릭
4. **Console** 탭에서 SQL 쿼리 실행

### **방법 2: Wrangler CLI** (Cloudflare API Token 필요)
```bash
# 전체 사용자 조회
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT * FROM users;"

# 전체 관리자 조회
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT * FROM admins;"

# 전체 판매자 조회
npx wrangler d1 execute toss-live-commerce-db --remote --command="SELECT * FROM sellers;"
```

**API Token 설정**:
```bash
export CLOUDFLARE_API_TOKEN="your-api-token-here"
```

API Token 생성: https://dash.cloudflare.com/profile/api-tokens
- Permissions: D1:Read, Account:Read

---

## 🗂️ KV 네임스페이스

### **SESSION_KV** (세션 관리)
- **Binding**: `SESSION_KV`
- **ID**: `3b522e69651f4d4f84a0cdf9430eeb72`
- **용도**: 사용자 세션, JWT 토큰 관리

### **CACHE_KV** (API 캐시)
- **Binding**: `CACHE_KV`
- **ID**: `25ecc9ce2c464dd59edf5eb7d5fd1a10`
- **용도**: API 응답 캐시 (products, orders 등)

### **LIVE_CACHE** (라이브 스트리밍 캐시)
- **Binding**: `LIVE_CACHE`
- **ID**: `e6667599e01d4af8b4687560eb39394c`
- **용도**: 라이브 스트리밍 상태, 채팅 캐시

---

## 📝 SQL 파일 목록

### **초기화 및 마이그레이션**
- `migrations/0001_initial_schema.sql` - 초기 스키마
- `migrations/0003_add_admin_seller.sql` - 관리자/판매자 테이블 추가
- `migrations/0005_add_kakao_login_and_shipping.sql` - 카카오 로그인 추가
- `migrations/0006_add_seller_profile.sql` - 판매자 프로필 추가
- `fix_production_db.sql` - 프로덕션 DB 수정

### **테스트 데이터 생성**
- `create-test-accounts.sql` - 테스트 계정 생성
- `dummy-live-streams.sql` - 더미 라이브 스트림 생성

### **데이터 정리**
- `clear-all-data.sql` - 전체 데이터 삭제
- `clear-data-simple.sql` - 간단한 데이터 삭제

---

## 🚀 테스트 계정 생성 방법

### **1. Cloudflare 대시보드에서 생성**
```sql
-- 관리자 계정 생성
INSERT INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('admin', 'admin@ur-team.com', 'admin123_hash', '관리자', 'super_admin', datetime('now'));

-- 판매자 계정 생성
INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('testseller', 'seller@ur-team.com', 'seller123_hash', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));
```

### **2. Wrangler CLI로 생성**
```bash
cd /home/user/webapp
npx wrangler d1 execute toss-live-commerce-db --remote --file=create-test-accounts.sql
```

---

## 🔐 비밀번호 해싱 정보

현재 `create-test-accounts.sql`에 정의된 비밀번호는 **단순 문자열 해시**입니다:
- `admin123_hash`
- `seller123_hash`

**⚠️ 프로덕션 환경에서는 반드시 bcrypt 등의 안전한 해싱 알고리즘 사용 필요!**

실제 비밀번호 해싱은 백엔드 API에서 처리:
- 파일: `src/worker/routes/auth.ts` (추정)
- 알고리즘: bcrypt 또는 Argon2 권장

---

## 📊 대시보드 URL

### **관리자 대시보드**
- **URL**: https://live.ur-team.com/admin
- **로그인**: https://live.ur-team.com/admin/login
- **기능**:
  - 전체 매출 통계
  - 사용자 관리
  - 판매자 승인/거부
  - 정산 관리
  - 배너 관리

### **판매자 대시보드**
- **URL**: https://live.ur-team.com/seller
- **로그인**: https://live.ur-team.com/seller/login
- **기능**:
  - 매출 통계
  - 상품 관리
  - 주문 관리
  - 라이브 스트리밍 컨트롤
  - 정산 내역

### **사용자 마이페이지**
- **URL**: https://live.ur-team.com/mypage
- **로그인**: https://live.ur-team.com/login (카카오 로그인)
- **기능**:
  - 주문 내역
  - 배송지 관리
  - 찜 목록
  - 프로필 수정
  - 계정 설정

---

## 🔧 환경 변수 (Cloudflare Pages Secrets)

다음 환경 변수가 설정되어 있어야 합니다:

```bash
# 필수 환경 변수
RESEND_API_KEY=re_xxxxx               # Resend 이메일 API 키
JWT_SECRET=your-jwt-secret-key        # JWT 서명 키
TOSS_SECRET_KEY=test_sk_xxxxx        # Toss Payments 시크릿 키
EMAIL_FROM=noreply@ur-team.com       # 발신 이메일 주소

# Firebase 설정 (Sentry 로깅용)
VITE_SENTRY_DSN=https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
VITE_SENTRY_ENVIRONMENT=production
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN

# Firebase (선택)
FIREBASE_PROJECT_ID=ur-live-demo
FIREBASE_DATABASE_URL=https://ur-live-demo.firebaseio.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@ur-live-demo.iam.gserviceaccount.com
```

---

## 📈 현재 데이터 현황 (추정)

실제 데이터는 Cloudflare 대시보드에서 확인해야 하지만, 예상 현황:

| 테이블 | 예상 레코드 수 | 비고 |
|--------|---------------|------|
| users | 0~10 | 테스트 사용자 또는 실제 카카오 로그인 사용자 |
| admins | 0~1 | 관리자 계정 (생성 여부 미확인) |
| sellers | 0~3 | 판매자 계정 (생성 여부 미확인) |
| products | 50+ | 더미 상품 데이터 존재 |
| orders | 0~5 | 테스트 주문 또는 실제 주문 |
| live_streams | 3 | 더미 라이브 스트림 (최근 복구됨) |

---

## ✅ 다음 단계

### **즉시 실행 필요**
1. **Cloudflare 대시보드에서 실제 데이터 확인**:
   - https://dash.cloudflare.com
   - Workers & Pages → D1 Database → `toss-live-commerce-db`
   - Console에서 `SELECT * FROM admins;` 실행
   - Console에서 `SELECT * FROM sellers;` 실행
   - Console에서 `SELECT * FROM users;` 실행

2. **테스트 계정 생성 (필요 시)**:
   - `create-test-accounts.sql` 실행
   - 또는 대시보드에서 직접 INSERT 쿼리 실행

3. **비밀번호 해싱 확인**:
   - 백엔드 API 코드에서 bcrypt 사용 여부 확인
   - `src/worker/routes/auth.ts` 또는 유사 파일 검토

---

## 📞 문의

- **Email**: tobe2111@naver.com
- **GitHub**: https://github.com/tobe2111/ur-live
- **Production URL**: https://live.ur-team.com

---

**마지막 업데이트**: 2026-03-08
**작성자**: GenSpark AI Developer
