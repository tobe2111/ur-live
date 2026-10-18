# 2026-10-18 — 쌓인 cron 실패 알림 일괄 정리 도구

## 무엇
- `POST /api/admin/cron-failures/bulk-resolve` (super_admin) — `{job_prefix, before, severity?, dry_run?}`.
  접두·시각 둘 다 필수, 기본은 세기만(dry_run). 계획은 `src/worker/utils/cron-failure-bulk.ts`.
- 가드: `src/tests/unit/cron-failure-bulk-resolve-2026-10-18.test.ts` (실제 SQLite) + 주입 3건.

## 라이브 실측(배포 전, 2026-10-18)
미해결 critical 11 · error 621 · warning 707.
- warning: `blocked:*` 는 10-14 가 마지막(10-15 수리 확인) → 거짓 경보. `stale:*` 는 진행 중(결재 2026-10-15-ads-alarm-stall-alert) — **남긴다**.
- error: 최신 100건 전부 `ads:enrich-company` CPU 초과, 10-07 이후 0건.
- critical: `deploy` 10건(10-13 이전) + `channel-watchdog`(Resend 키 부재 — 메일은 SENS 로 전환돼 정상) 1건.

## 다음 세션 첫 액션
배포 후 dry_run 으로 세고 대표 지시 범위만 반영:
1. `{job_prefix:'blocked:', before:'2026-10-15'}`
2. `{job_prefix:'ads:enrich-company', before:'2026-10-08', severity:'error'}`
3. `{job_prefix:'deploy', before:'2026-10-14', severity:'critical'}`
`stale:*` 는 건드리지 않는다.
