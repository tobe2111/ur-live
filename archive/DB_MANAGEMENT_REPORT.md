# 📊 UR-Live 데이터베이스 관리 상태 분석 보고서

생성일: 2026-03-10
작성자: AI Assistant

## 🎯 요약

**현재 상태**: ⚠️ **부분적으로 관리되고 있으나 개선 필요**

유저 및 셀러 DB 관리는 기본적으로 작동하고 있으나, 몇 가지 중요한 개선사항이 필요합니다.

---

## ✅ 잘 관리되고 있는 부분

### 1. **기본 CRUD 작업**
- ✅ 유저 생성/조회/수정 (30개 쿼리)
- ✅ 셀러 생성/조회/수정 (24개 쿼리)
- ✅ Firebase UID 연동
- ✅ 이메일/username 중복 체크

### 2. **인증 및 권한 관리**
```typescript
// ✅ 구현됨
- Firebase Auth (일반 유저)
- JWT Auth (셀러/어드민)
- requireAuth 미들웨어
- requireSeller, requireAdmin 미들웨어
```

### 3. **상태 관리**
```sql
-- ✅ 구현됨
- is_active (활성화 상태)
- status (승인/대기/정지/거부)
- last_login_at (최근 로그인)
```

### 4. **타임스탬프 관리**
```sql
-- ✅ 모든 테이블에 구현됨
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 5. **인덱스 최적화**
```sql
-- ✅ 성능 최적화 인덱스
- idx_users_email
- idx_users_firebase_uid
- idx_sellers_email
- idx_sellers_status
- idx_products_seller_id
-- 총 20+ 인덱스 생성됨
```

### 6. **계정 삭제 (신규 구현)**
```typescript
// ✅ 오늘 구현 완료 (commit: ea03afc3)
DELETE /api/account/delete
- 모든 연관 데이터 순차 삭제
- 사용자 계정 완전 삭제
- 세션 KV 삭제
```

---

## ⚠️ 개선이 필요한 부분

### 1. **❌ CRITICAL: Foreign Key Cascade 미설정**

**문제**:
```sql
-- ❌ 현재 (database-schema.sql)
FOREIGN KEY (user_id) REFERENCES users(id)
FOREIGN KEY (seller_id) REFERENCES sellers(id)

-- 🚨 ON DELETE CASCADE 없음!
```

**영향**:
- 유저 삭제 시 연관 데이터 자동 삭제 안됨
- 고아 레코드(orphan records) 발생 가능
- 데이터 정합성 문제
- 수동 삭제 로직에 의존 (휴먼 에러 가능성)

**해결책**:
```sql
-- ✅ 개선됨 (database-schema-improved.sql)
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
```

**CASCADE 규칙**:
- `ON DELETE CASCADE`: 부모 삭제 시 자식도 삭제
- `ON DELETE RESTRICT`: 자식이 있으면 부모 삭제 방지
- `ON DELETE SET NULL`: 부모 삭제 시 자식의 FK를 NULL로 설정

---

### 2. **⚠️ updated_at 자동 업데이트 미구현**

**문제**:
```typescript
// ❌ 현재: 수동으로 updated_at 설정
await DB.prepare(`
  UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).bind(name, userId).run();
```

**영향**:
- 개발자가 매번 `updated_at = CURRENT_TIMESTAMP` 추가 필요
- 빠뜨리면 타임스탬프 갱신 안됨

**해결책**:
```sql
-- ✅ 트리거 사용 (database-schema-improved.sql)
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

**장점**:
- 자동으로 updated_at 갱신
- 개발자가 신경 쓸 필요 없음
- 일관성 보장

---

### 3. **⚠️ 소프트 삭제(Soft Delete) 미구현**

**문제**:
```sql
-- ❌ 현재: 하드 삭제만 가능
DELETE FROM users WHERE id = ?

-- 복구 불가능!
```

**제안**:
```sql
-- ✅ 소프트 삭제 구현
ALTER TABLE users ADD COLUMN deleted_at DATETIME;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- 삭제 대신 플래그 설정
UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?;

-- 조회 시 삭제된 유저 제외
SELECT * FROM users WHERE deleted_at IS NULL;
```

**장점**:
- 데이터 복구 가능
- 법적 요구사항 대응 (로그 보관)
- 실수로 삭제해도 복구 가능

**단점**:
- 저장 공간 증가
- 쿼리 복잡도 증가

**권장**: 최소 30일간 소프트 삭제 유지 후 하드 삭제

---

### 4. **⚠️ 데이터 검증 부족**

**문제**:
```typescript
// ❌ 현재: 최소한의 검증만
if (!email || !password) {
  return c.json({ error: 'Required fields missing' }, 400);
}
```

**개선**:
```typescript
// ✅ 포괄적인 검증
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^010-\d{4}-\d{4}$/),
  // ...
});

const validation = userSchema.safeParse(data);
if (!validation.success) {
  return c.json({ 
    error: 'Validation failed', 
    details: validation.error.errors 
  }, 400);
}
```

---

### 5. **⚠️ 트랜잭션 미사용**

**문제**:
```typescript
// ❌ 현재: 순차 실행 (원자성 없음)
await DB.prepare('DELETE FROM cart WHERE user_id = ?').run();
await DB.prepare('DELETE FROM orders WHERE user_id = ?').run();
await DB.prepare('DELETE FROM users WHERE id = ?').run();
// 중간에 실패하면? 일부만 삭제됨!
```

**해결책**:
```typescript
// ✅ 트랜잭션 사용
await DB.batch([
  DB.prepare('DELETE FROM cart WHERE user_id = ?').bind(userId),
  DB.prepare('DELETE FROM orders WHERE user_id = ?').bind(userId),
  DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
]);
// 모두 성공 또는 모두 실패 (원자성 보장)
```

**Cloudflare D1 제약**:
- D1은 전통적인 트랜잭션 미지원
- `batch()` API로 원자성 보장

---

### 6. **⚠️ 로깅 및 감사 로그 부족**

**문제**:
- 누가, 언제, 무엇을 변경했는지 추적 어려움
- 보안 감사 불가능
- 디버깅 어려움

**제안**:
```sql
-- ✅ 감사 로그 테이블
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data TEXT, -- JSON
  new_data TEXT, -- JSON
  user_id INTEGER,
  user_type TEXT, -- user, seller, admin
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 7. **⚠️ 데이터 백업 전략 불명확**

**현재 상태**:
- Cloudflare D1의 자동 백업에 의존
- 수동 백업 프로세스 없음

**권장**:
```bash
# ✅ 정기 백업 스크립트
wrangler d1 export ur-live-db --output backup-$(date +%Y%m%d).sql

# cron job
0 2 * * * /usr/local/bin/backup-d1.sh
```

---

## 📊 테이블별 관리 상태

| 테이블 | CRUD | 인덱스 | FK Cascade | Trigger | 상태 |
|--------|------|--------|------------|---------|------|
| users | ✅ | ✅ | ❌ | ❌ | ⚠️ 개선 필요 |
| sellers | ✅ | ✅ | ❌ | ❌ | ⚠️ 개선 필요 |
| admins | ✅ | ✅ | N/A | ❌ | ⚠️ 개선 필요 |
| products | ✅ | ✅ | ❌ | ❌ | ⚠️ 개선 필요 |
| orders | ✅ | ✅ | ❌ | ❌ | ⚠️ 개선 필요 |
| cart | ✅ | ✅ | ❌ | ❌ | ⚠️ 개선 필요 |
| wishlists | ✅ | ✅ | ❌ | N/A | ⚠️ 개선 필요 |
| shipping_addresses | ✅ | ✅ | ❌ | ❌ | ⚠️ 개선 필요 |
| live_streams | ✅ | ✅ | ❌ | ❌ | ⚠️ 개선 필요 |

---

## 🎯 우선순위별 개선 과제

### 🔴 높음 (즉시 적용 권장)

1. **Foreign Key CASCADE 추가**
   - 파일: `database-schema-improved.sql` (이미 작성됨)
   - 적용 방법: 마이그레이션 스크립트 작성
   - 영향도: 높음 (데이터 정합성)

2. **트랜잭션 적용**
   - 위치: `/api/account/delete`
   - 변경: `DB.batch()` 사용
   - 영향도: 높음 (원자성)

3. **updated_at 트리거 추가**
   - 파일: `database-schema-improved.sql` (이미 작성됨)
   - 적용 방법: 마이그레이션
   - 영향도: 중간 (일관성)

### 🟡 중간 (1-2주 내 적용)

4. **소프트 삭제 구현**
   - 컬럼 추가: `deleted_at`
   - API 수정: 조회 쿼리에 `WHERE deleted_at IS NULL` 추가
   - 크론잡: 30일 후 자동 하드 삭제

5. **데이터 검증 강화**
   - Zod 스키마 정의
   - 모든 API에 검증 미들웨어 적용

6. **감사 로그 구현**
   - audit_logs 테이블 생성
   - 트리거로 자동 로깅

### 🟢 낮음 (선택적)

7. **데이터 백업 자동화**
   - GitHub Actions 워크플로우
   - S3/R2 백업 스토리지

8. **성능 모니터링**
   - 느린 쿼리 로깅
   - 인덱스 최적화

---

## 📝 마이그레이션 계획

### Phase 1: Cascading Foreign Keys (즉시)

```sql
-- 1. 기존 FK 제약 제거 (SQLite 제약으로 인해 테이블 재생성 필요)
-- 2. 새 스키마 적용 (database-schema-improved.sql)
-- 3. 데이터 마이그레이션
-- 4. 검증
```

**위험도**: 높음 (프로덕션 DB 변경)
**권장 방법**: 
1. 스테이징 환경에서 먼저 테스트
2. 백업 후 적용
3. 롤백 플랜 준비

### Phase 2: Triggers & Soft Delete (1주 후)

```sql
-- 1. Triggers 추가
-- 2. deleted_at 컬럼 추가
-- 3. API 로직 업데이트
```

### Phase 3: Audit Logs (2주 후)

```sql
-- 1. audit_logs 테이블 생성
-- 2. 트리거 설정
-- 3. 대시보드 구현
```

---

## 🔍 검증 방법

### 1. Foreign Key 작동 확인

```sql
-- 유저 삭제 시 연관 데이터 자동 삭제 확인
INSERT INTO users (firebase_uid, email, name) VALUES ('test-uid', 'test@test.com', 'Test');
INSERT INTO cart (user_id, product_id, quantity) VALUES (1, 1, 1);

DELETE FROM users WHERE email = 'test@test.com';

-- cart 레코드도 삭제되었는지 확인
SELECT * FROM cart WHERE user_id = 1; -- 결과: 0 rows
```

### 2. Trigger 작동 확인

```sql
-- updated_at 자동 갱신 확인
UPDATE users SET name = 'New Name' WHERE id = 1;
SELECT name, updated_at FROM users WHERE id = 1;
-- updated_at이 최신 시간으로 변경되었는지 확인
```

### 3. 트랜잭션 원자성 확인

```typescript
// 중간에 에러 발생 시 롤백 확인
try {
  await DB.batch([
    DB.prepare('DELETE FROM cart WHERE user_id = ?').bind(999),
    DB.prepare('INVALID SQL'), // 에러 발생
    DB.prepare('DELETE FROM users WHERE id = ?').bind(999),
  ]);
} catch (e) {
  // cart 삭제도 롤백되었는지 확인
}
```

---

## 💡 결론 및 권장사항

### 현재 상태 평가: ⭐⭐⭐☆☆ (3/5)

**강점**:
- ✅ 기본 CRUD 작동
- ✅ 인증/권한 관리
- ✅ 인덱스 최적화
- ✅ 계정 삭제 구현

**약점**:
- ❌ Foreign Key CASCADE 미설정
- ❌ Trigger 미구현
- ❌ 트랜잭션 미사용
- ❌ 소프트 삭제 없음

### 즉시 조치 사항

1. **database-schema-improved.sql 검토 및 적용**
2. **계정 삭제 API에 DB.batch() 적용**
3. **프로덕션 배포 전 스테이징 테스트**

### 장기 목표

- 완전한 데이터 정합성 보장
- 감사 로그 구현
- 자동 백업 시스템
- 성능 모니터링

---

**작성 완료**: 2026-03-10
**다음 리뷰**: 1주일 후 (개선사항 적용 후)
