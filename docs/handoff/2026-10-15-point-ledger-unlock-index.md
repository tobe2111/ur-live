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

## ✅ 실행 결과 (2026-10-15 10:05 KST)
- #1835 머지(`81fe2527b`) → Pages 배포 success 확인 후 실행.
- dry-run: `had_check:true · 26행(charge 9/donate 10/refund 7)`.
- apply: `verified:true · rows 26→26 · types 동일 · recreated_indexes:["idx_point_tx_user_type"]`.
- D1 sqlite_master 독립 확인: CHECK 문자열 0 · `type TEXT NOT NULL DEFAULT 'charge'`(끝으로 이동) · 인덱스 3개(`idx_point_tx_user_type`·`idx_point_tx_user`·`idx_point_tx_type`).
- ⚠️ 과거 미기록분(주문 89·90 의 딜 사용 7,400 등)은 소급되지 않는다. 대표 잔액(111,500) ↔ 원장 합 불일치는 카드 ② 잔액 정비 판단 전에 세션이 검사 결과를 먼저 읽고 보고할 것.
- 다음: VERIFICATION_DAY 1회차 결제 — 이제 '딜 사용 기록 1행' 판정이 가능하다.

## 2단계 — 잔액 정비 + 버킷 재분류 (대표 "둘 다 해줘")
- **잔액 정비(기록 보정) 실행 10:30 KST**: 3·32·33·24번에 `legacy_reconcile` 1행씩(80,200 / 3,000 / 3,000 / 100). 재검사 불일치 **0**. 잔액·무상잔액 불변 확인(D1).
- **원인 규명 — 32·24번 유상 잔액**: 무상 버킷(`free_balance`)은 **2026-07-05** 에 생겼다. 32번(06-30 가입)의 가입 보너스 3,000 은 그 전이라 기본값 0 → **유상**, 같은 보너스를 07-09 에 받은 33번은 무상. 24번 150 도 광고 리워드 등 충전 0. 전 계정 스캔 결과 유상 잔액이 있는 계정은 **이 둘뿐**이고 둘 다 충전 기록 0. 대기 중인 환급 신청 없음.
- **도구 추가(코드 경로)**: `points-reconcile.ts` `reclassifyUnpaidToFree` + `POST /api/admin/tools/points-reconcile {mode:'reclass'}`. 기본 dry-run · CAS(UPDATE 에 조건 재확인) · 잔액 불변 · 원장 `bucket_reclass`(금액 0, free_delta=+옮긴 양). 'both' 에 안 들어간다.
- 함께: 보정행 설명의 날짜가 `2026-08-31` 고정이었다 → 오늘(KST). 10-15 에 쓴 4행은 설명에 08-31 이 박혀 있다(created_at 은 정확).
- ✅ **E4 — 버킷 재분류 라이브 적용 11:27 KST** (PR #1839 머지 `4438922`, 배포는 #1840 런에 포함 — #1839 자체 Pages 런은 뒤 푸시에 밀려 cancelled).
  - dry-run: 정확히 **32번 3,000 · 24번 150** 두 계정만 잡혔다(예측과 일치).
  - apply 후 D1: 32번 `balance 3000 / free_balance 3000` · 24번 `150 / 150` — **잔액 불변, 유상 0**. 원장 `bucket_reclass` 2행(amount 0, free_delta 3000·150).
  - 재-dry-run `found: []`(멱등) · 잔액 정비 재검사 불일치 **0**.
  - 🩸 #1839 머지 직후 그 커밋의 Pages 배포가 **cancelled** 였다 — 실패가 아니라 다음 main 푸시(#1840)가 같은 동시성 그룹을 대체한 것. 판정은 '내 커밋이 지금 배포 런의 조상인가'(`git merge-base --is-ancestor`)로 했다.
- 남은 것: VERIFICATION_DAY 1회차 결제 — '딜 사용 기록 1행' 판정.
