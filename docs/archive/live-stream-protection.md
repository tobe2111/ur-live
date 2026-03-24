# 라이브 스트림 자동 삭제 원인 및 방지책

## 조사 결과

### DELETE 쿼리 위치
1. `DELETE /api/seller/live-streams/:id` (라인 5036) - 판매자가 직접 삭제
2. `DELETE /api/admin/streams/:id` (라인 5565) - 관리자가 직접 삭제

### 자동 삭제 코드 없음
- 백엔드 코드에서 **자동 삭제 로직이 없음** 확인
- 스케줄러나 크론 작업 없음
- Cascade Delete 설정도 없음

### 가능한 원인
1. **DB 마이그레이션 중 데이터 손실**
2. **외부에서 직접 DB 접근** (wrangler CLI, Cloudflare Dashboard)
3. **테스트 중 실수로 삭제**
4. **Foreign Key 제약 조건으로 인한 Cascade Delete** (비활성화 상태)

## 방지책

### 1. Soft Delete 구현
```sql
ALTER TABLE live_streams ADD COLUMN deleted_at DATETIME DEFAULT NULL;
```

백엔드 수정:
```ts
// 삭제 대신 soft delete
await DB.prepare('UPDATE live_streams SET deleted_at = ? WHERE id = ?')
  .bind(new Date().toISOString(), streamId)
  .run();

// 조회 시 deleted_at이 NULL인 것만
WHERE deleted_at IS NULL
```

### 2. 삭제 로그 기록
```sql
CREATE TABLE IF NOT EXISTS deletion_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  deleted_by TEXT NOT NULL,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reason TEXT
);
```

### 3. 관리자 권한 제한
- 판매자는 자신의 라이브만 삭제 가능 (현재 구현됨)
- 관리자 삭제는 별도 승인 필요

### 4. DB 백업 자동화
- 매일 자동 백업
- 중요 테이블 (live_streams, products, users) 우선

### 5. 감사 로그 (Audit Log)
- 모든 DELETE 쿼리에 로그 기록
- 누가, 언제, 무엇을 삭제했는지 추적

## 즉시 적용 가능한 방법

### 운영 DB에 삭제 방지 트리거 추가
```sql
-- 라이브 스트림 삭제 방지 (중요 레코드)
CREATE TRIGGER IF NOT EXISTS prevent_live_stream_delete
BEFORE DELETE ON live_streams
WHEN OLD.id IN (1, 2, 3)  -- 중요 라이브 스트림 ID
BEGIN
  SELECT RAISE(ABORT, 'Cannot delete protected live stream');
END;
```

## 권장사항
1. **Soft Delete 구현** (우선순위: 높음)
2. **삭제 로그 기록** (우선순위: 중간)
3. **DB 백업 자동화** (우선순위: 높음)
