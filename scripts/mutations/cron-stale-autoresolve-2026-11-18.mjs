/** 🧬 주입 — 멈춤 경보 자동 종료 (2026-11-18) · 가드: src/tests/unit/cron-stale-autoresolve-2026-11-18.test.ts */
const T = 'src/tests/unit/cron-stale-autoresolve-2026-11-18.test.ts'
const F = 'src/worker/cron/cron-stale-watch.ts'
export default [
  { name: 'staleclose: 지금 멈춘 것까지 닫는다', file: F,
    find: '          AND job_name NOT IN (SELECT value FROM json_each(?))`,', replace: '          AND 1 = 1 AND ? IS NOT NULL`,', test: T,
    why: '아직 멈춰 있는 작업의 경보가 사라져 아무도 모른다.' },
  { name: 'staleclose: 회복해도 안 닫는다', file: F,
    find: "        WHERE resolved = 0 AND (job_name LIKE 'stale:%' OR job_name LIKE 'blocked:%')", replace: "        WHERE resolved = 0 AND 0 AND (job_name LIKE 'stale:%' OR job_name LIKE 'blocked:%')", test: T,
    why: '회복한 옛 경보가 쌓여 진짜 실패가 묻힌다(라이브 281건 중 대부분).' },
]
