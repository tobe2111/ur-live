# 💾 D1 백업 & 복구 리허설 (SSOT)

> **2026-07-05 신설** — 백업은 복구 리허설 전까지 "있다고 믿는 것"에 불과. 이 문서는
> ① 백업 체계 현황 ② 분기 1회 복구 리허설 절차 ③ 장애 시 실제 복구 절차를 고정한다.

## 백업 체계 (자동)

| 층 | 무엇 | 주기 | 보존 | 확인 방법 |
|---|---|---|---|---|
| 1차 | **Cloudflare D1 Time Travel** (point-in-time 복구) | 상시 | 30일 | Dashboard → D1 → ur-live → Time Travel. `wrangler d1 time-travel info ur-live` |
| 2차 | **주간 SQL dump → R2** (`d1-backup` cron, 일 20:00 UTC) | 주 1회 | 30일 (R2 lifecycle) | Discord '✅ D1 백업 완료' 알림 + `ur-live-backups` 버킷 `backups/d1-YYYY-MM-DD.sql` |

- 2026-07-05부터 백업 cron 이 **무결성 자동 검증**: dump 실패 테이블 0 / 테이블 수 ≥30 /
  크기 ≥256KB / R2 head 존재·크기 일치. 위반 시 Discord '⚠️ 무결성 경고' (warn 등급).
- 백업 cron 침묵은 heartbeat dead-man's switch 가 감지 (`d1-backup` 8일 초과 미실행 →
  `/api/_healthcheck/cron` 503 → uptime.yml 이슈).

## 🔁 분기 1회 복구 리허설 (수동, ~15분) — 대표 액션

> 캘린더에 분기 반복 일정 등록 권장 (1/4/7/10월 첫 주).

1. R2 콘솔(또는 `wrangler r2 object get ur-live-backups/backups/d1-<최신날짜>.sql --file=dump.sql`)로 최신 dump 다운로드.
2. 로컬 임시 DB 에 복원:
   ```bash
   npx wrangler d1 create ur-live-restore-test        # 1회만
   npx wrangler d1 execute ur-live-restore-test --local --file=dump.sql
   ```
3. 샘플 검증 쿼리 (핵심 테이블 행 수가 0 이 아닌지):
   ```bash
   npx wrangler d1 execute ur-live-restore-test --local \
     --command "SELECT (SELECT COUNT(*) FROM users) u, (SELECT COUNT(*) FROM orders) o, (SELECT COUNT(*) FROM products) p, (SELECT COUNT(*) FROM ledger_entries) l"
   ```
4. **스키마 객체 검증 — 행 수만 세면 안 된다** (2026-08-03 추가. 이걸 안 봐서 결함이 살아남았다):
   ```bash
   npx wrangler d1 execute ur-live-restore-test --local \
     --command "SELECT type, COUNT(*) n FROM sqlite_master GROUP BY type"
   ```
   프로덕션 기준(2026-08-03 실측) **index 610 · trigger 7 · view 1 · table 316**. 인덱스가
   두 자릿수로 떨어져 있으면 복구본은 **쓰면 안 된다** — UNIQUE 인덱스 46개가 `INSERT OR IGNORE`
   멱등 가드의 실체라, 없으면 같은 주문이 두 번 적립돼도 DB 가 막지 않는다(머니 룰 #3).
   `SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND sql LIKE '%UNIQUE%'` 로 46 근처인지 확인.
5. 결과를 아래 리허설 기록에 1줄 추가 + 커밋.

## 🚨 실제 장애 시 복구 우선순위

1. **30일 이내 시점 복구가 필요하면 Time Travel 이 1순위** (트랜잭션 정확, 데이터 손실 최소):
   `npx wrangler d1 time-travel restore ur-live --timestamp=<UNIX또는ISO>`
   ⚠️ 복구 전 현재 상태 북마크 확보: `npx wrangler d1 time-travel info ur-live`
2. Time Travel 범위 밖(30일+)이거나 부분 테이블만 필요하면 R2 dump 에서 해당 테이블 INSERT 만 추출해 적용.
3. 복구 후 `POST /api/_internal/repair-schema` 1회 (이후 스키마 추가분 보정).

## 리허설 기록

| 날짜 | dump 파일 | 결과 (users/orders/products/ledger) | 확인자 |
|---|---|---|---|
| 2026-08-03 | (실파일 아님 — **축소판 합성 DB**) | 스키마 객체 13→9 소실 → **수정 후 13→13**, 중복적립 차단 복원 | Claude |
| — | — | **실제 dump 리허설은 아직 없음 — 대표 액션 필요** | — |

> ⚠️ 2026-08-03 의 것은 **실제 백업 파일로 한 리허설이 아니다.** R2 객체 조회가 세션 토큰 권한
> 밖이라, 프로덕션과 같은 형태(외부콘텐츠 FTS5 · WITHOUT ROWID · BLOB · UNIQUE 인덱스)를 가진
> 합성 DB 에 **같은 덤프 알고리즘을 이식해** 돌린 축소판이다. 결함을 찾기엔 충분했지만
> (실제로 찾았다), "우리 데이터가 돌아온다"는 증명은 아니다 — 위 4번까지 포함한 실물 리허설이
> 여전히 필요하다.

## 무엇이 고쳐졌나 (2026-08-03)

첫 자동 백업이 성공한 직후 위 축소판 리허설을 돌려 **3건**을 찾았다. 전부 "에러 없이 조용한" 종류다.

| 결함 | 복구했을 때 벌어지는 일 | 수정 |
|---|---|---|
| 덤프가 `type='table'` 만 담음 | **인덱스 610 · 트리거 7 · 뷰 1 소실.** UNIQUE 46개가 없어져 같은 ref 중복 적립이 통과(리허설에서 재현) | 데이터 INSERT 뒤에 인덱스/트리거/뷰 방출 |
| FTS5 그림자 테이블을 그대로 덤프 | BLOB 이 문자열로 뭉개짐 + `WITHOUT ROWID` 라 매주 "dump 실패 3개" 경고 | 그림자 제외 + 복구 후 `rebuild` 로 색인 재생성 |
| BLOB 을 `String(v)` 로 직렬화 | 바이너리 컬럼 조용한 손상 | `X'..'` 16진 리터럴 |

회귀 방지: `src/tests/unit/d1-backup-restorable.test.ts` (옛 동작 3종을 주입해 빨강 확인 완료).
무결성 경고에 `objectCount < 100` 추가 — 인덱스가 안 담기면 다음 주 백업이 스스로 신고한다.
