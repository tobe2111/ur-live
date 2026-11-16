/**
 * 🧬 주입 — 배달될 수 없는 주소 차단 (2026-11-16) · 가드: src/tests/unit/undeliverable-email-2026-11-16.test.ts
 */
const T = 'src/tests/unit/undeliverable-email-2026-11-16.test.ts'
export default [
  {
    name: '📭 sendSystemEmail 이 .invalid 주소로도 보낸다',
    file: 'src/lib/system-email.ts',
    find: '  if (isUndeliverableAddress(to)) return { success: false, skipped: true, undeliverable: true };',
    replace: '',
    test: T,
    why: '카카오 에이전시 자리표시 주소로 메일이 나가고 실패 큐에 쌓인다.',
  },
  {
    name: '📭 재시도 cron 이 배달 불가 행을 안 닫는다',
    file: 'src/worker/cron/retry-notifications.ts',
    find: "SET resolved = 1, error = 'undeliverable: reserved domain'",
    replace: "SET retry_count = retry_count + 1, error = 'undeliverable: reserved domain'",
    test: T,
    why: '배달 불가 행이 30분마다 영원히 재시도된다.',
  },
]
