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
4. 결과를 아래 리허설 기록에 1줄 추가 + 커밋.

## 🚨 실제 장애 시 복구 우선순위

1. **30일 이내 시점 복구가 필요하면 Time Travel 이 1순위** (트랜잭션 정확, 데이터 손실 최소):
   `npx wrangler d1 time-travel restore ur-live --timestamp=<UNIX또는ISO>`
   ⚠️ 복구 전 현재 상태 북마크 확보: `npx wrangler d1 time-travel info ur-live`
2. Time Travel 범위 밖(30일+)이거나 부분 테이블만 필요하면 R2 dump 에서 해당 테이블 INSERT 만 추출해 적용.
3. 복구 후 `POST /api/_internal/repair-schema` 1회 (이후 스키마 추가분 보정).

## 리허설 기록

| 날짜 | dump 파일 | 결과 (users/orders/products/ledger) | 확인자 |
|---|---|---|---|
| — | — | 아직 없음 — 첫 리허설 필요 | — |
