# 2026-10-15 — 딜 사용 기록 제약 제거(0단계) · 라이브 인덱스 때문에 실패할 뻔한 도구 수리

대표 승인: *"딜 사용 내역 이거 승인해줄테니 너가 해줘"* (VERIFICATION_DAY 0단계).

## 무엇을 발견했나
- 라이브 `point_transactions` 는 아직 `CHECK (type IN ('charge','donate','refund'))` (D1 sqlite_master 실측).
- 그리고 **`idx_point_tx_user_type ON point_transactions(user_id, type)`** 인덱스가 있다.
- 2026-08-31 에 만든 제거 도구(`POST /api/admin/tools/point-ledger-unlock`)는 `DROP COLUMN type` 을 하는데,
  SQLite 는 인덱스가 걸린 컬럼을 DROP 못 한다 → **라이브에서 3번째 문장에 멈추고 `_type_bak` 만 남겼을 것**.
  node:sqlite 로 재현 확인(`error in index idx_point_tx_user_type after drop column`).
- 시험의 `LIVE_SCHEMA` 가 그 인덱스를 빠뜨려 아무도 몰랐다.

## 고친 것
- 도구가 `type` 을 쓰는 인덱스를 찾아 떼고 → 컬럼 교체 → 원래 SQL 로 다시 단다. `verified` 에 "인덱스 복귀" 포함.
- 상태 기반 재개: `_type_bak` 이 이미 있으면 이어서 끝낸다.
- 시험 3건(라이브 인덱스 그대로 · 중간 멈춤 재개 · 무관 인덱스 불변) + 주입 2건(빨간불 확인).

## 다음 세션의 첫 액션
- 머지·배포 뒤 dry-run → apply 를 어드민 API 로 실행하고 sqlite_master 로 판정(CHECK 사라짐 · 행수·타입 분포 동일 · 인덱스 존재).
  결과는 이 파일 아래에 기록한다.
