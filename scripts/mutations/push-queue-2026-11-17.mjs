/**
 * 📮 푸시 알림 줄 (2026-11-17) — 주입 매니페스트.
 * 가드: src/tests/unit/push-queue-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/push-queue-2026-11-17.test.ts'

export default [
  {
    name: '📮 알림 줄이 limit 을 무시하고 한 번에 다 빼낸다(cron 한 번이 상한을 넘어 뒤쪽이 빠진다)',
    file: 'src/worker/utils/push-queue.ts',
    find: "WHERE id IN (SELECT id FROM push_jobs WHERE status = 'pending' ORDER BY id LIMIT ?) AND status = 'pending'",
    replace: "WHERE id IN (SELECT id FROM push_jobs WHERE status = 'pending' ORDER BY id LIMIT 100000 OFFSET 0*?) AND status = 'pending'",
    test: TEST,
    why: '한 실행이 받는 사람 전부를 보내려 하면 외부 호출 상한에서 잘린다 — 그게 이 줄이 생긴 이유다.',
  },
  {
    name: '📮 같은 tag 중복 방지 색인이 사라진다(재시도마다 같은 알림이 또 간다)',
    file: 'src/worker/utils/push-queue.ts',
    find: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_push_jobs_dedupe',
    replace: 'CREATE INDEX IF NOT EXISTS idx_push_jobs_dedupe',
    test: TEST,
    why: '공구 달성 알림이 요청이 두 번 들어오거나 재시도될 때마다 같은 사람에게 또 간다.',
  },
]
