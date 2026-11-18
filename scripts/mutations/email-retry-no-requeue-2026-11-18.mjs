/** 🧬 주입 — 메일 재시도가 실패 행을 불리지 않는다 (2026-11-18) · 가드: src/tests/unit/email-retry-no-requeue-2026-11-18.test.ts */
const T = 'src/tests/unit/email-retry-no-requeue-2026-11-18.test.ts'
export default [
  { name: 'emailretry: noQueue 를 무시하고 큐에 넣는다', file: 'src/lib/system-email.ts',
    find: '    if (!result.success && e?.DB && !opts.noQueue) {', replace: '    if (!result.success && e?.DB) {', test: T,
    why: '재시도가 실패할 때마다 새 실패 행이 생겨 메일 1통이 수백 행으로 불어난다.' },
  { name: 'emailretry: 재시도 cron 이 noQueue 를 안 넘긴다', file: 'src/worker/cron/retry-notifications.ts',
    find: '        }, { noQueue: true })', replace: '        })', test: T,
    why: '같은 결과 — 재시도 실패가 새 행을 만든다.' },
  { name: 'emailretry: 진행 중 행까지 닫는다', file: 'src/worker/cron/scheduled-cleanup-daily.ts',
    find: '        WHERE resolved = 0 AND retry_count >= max_retries\n', replace: '        WHERE resolved = 0\n', test: T,
    why: '아직 재시도가 남은 실패 메일이 닫혀 다시 안 보내진다.' },
  { name: 'emailretry: 최근 1건도 닫는다', file: 'src/worker/cron/scheduled-cleanup-daily.ts',
    find: '          AND id NOT IN (SELECT MAX(id) FROM email_failures WHERE resolved = 0 GROUP BY recipient, subject)`,', replace: '          AND 1 = 1`,', test: T,
    why: '실패한 메일이 어드민 화면에서 통째로 사라진다.' },
]
