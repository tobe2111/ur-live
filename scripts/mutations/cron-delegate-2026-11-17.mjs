/**
 * 🧬 주입 — cron 위임 (2026-11-17) · 가드: src/tests/unit/cron-delegate-2026-11-17.test.ts
 */
const T = 'src/tests/unit/cron-delegate-2026-11-17.test.ts'
export default [
  {
    name: '🔁 위임 엔드포인트가 토큰 없이도 열린다',
    file: 'src/worker/routes/cron-delegate.routes.ts',
    find: "  if (!secretEquals(expected, c.req.header('X-Internal-Token'))) return c.json({ success: false, error: 'Unauthorized' }, 401)",
    replace: '',
    test: T,
    why: '누구나 내부 cron 작업을 돌릴 수 있다.',
  },
  {
    name: '🔁 지오코딩이 위임 없이 다시 조용히 skip 된다',
    file: 'src/worker/scheduled.ts',
    find: "      if (cd.needsDelegation(env, 'restaurant-geocode')) return cd.delegateToPages(env, 'restaurant-geocode')",
    replace: '',
    test: T,
    why: '워커에 카카오 키가 없어 새 가게 좌표가 영영 안 잡힌다.',
  },
]
