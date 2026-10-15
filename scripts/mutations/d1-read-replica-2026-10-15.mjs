/**
 * 🌏 D1 읽기 복제본 (2026-10-15) — 주입 매니페스트.
 * 가드: src/tests/unit/d1-read-replica-2026-10-15.test.ts
 *
 * 이 결함들은 **에러를 안 낸다** — 읽기가 조용히 미국 동부 원본으로 돌아가거나(느려질 뿐), 로그인한 주인이
 * 방금 고친 것을 1초 늦게 보거나, 요청마다 DDL 이 원본으로 간다.
 */
const TEST = 'src/tests/unit/d1-read-replica-2026-10-15.test.ts'
const MW = 'src/worker/middleware/edge-cache.ts'
const MOD = 'src/worker/utils/d1-read-replica.ts'

export default [
  {
    name: '🌏 캐시 미스 경로가 복제본을 안 쓴다(전부 원본으로)',
    file: MW,
    find: '    c.env = withReadReplicaEnv(c.env);\n    await next();',
    replace: '    await next();',
    test: TEST,
    why: '읽기가 전부 미국 동부 원본으로 간다 — 한국 손님의 캐시 미스마다 홍콩↔미국 왕복이 되살아난다(에러 0).',
  },
  {
    name: '🌏 로그인 요청(캐시 우회)까지 복제본으로 보낸다',
    file: MW,
    find: '    // GET/HEAD 만 캐싱 (쓰기 요청은 우회)\n',
    replace: '    c.env = withReadReplicaEnv(c.env);\n    // GET/HEAD 만 캐싱 (쓰기 요청은 우회)\n',
    test: TEST,
    why: '주인이 방금 고친 유어샵·쓰기 직후 읽기가 복제 지연만큼 옛 값을 본다 — 화면이 조용히 되돌아간다.',
  },
  {
    name: '🌏 요청마다 새 래퍼를 만든다(WeakSet 기억이 빗나간다)',
    file: MOD,
    find: '  const hit = replicas.get(db)\n  if (hit) return hit\n',
    replace: '',
    test: TEST,
    why: '`ensureXxx(DB)` 의 기억이 매번 빗나가 요청마다 CREATE TABLE 이 원본으로 간다 — 빨라지려다 더 느려진다.',
  },
  {
    name: '🌏 래퍼의 읽기가 세션을 안 거친다',
    file: MOD,
    find: "if (prop === 'prepare') return (sql: string) => sess().prepare(sql)",
    replace: "if (prop === 'prepare') return (sql: string) => db.prepare(sql)",
    test: TEST,
    why: '래퍼는 있는데 읽기가 원본으로 간다 — 배선이 다 초록인데 효과가 0이다.',
  },
  {
    name: '🌏 세션이 늘 원본에서 시작한다',
    file: MOD,
    find: "session = db.withSession('first-unconstrained')",
    replace: "session = db.withSession('first-primary')",
    test: TEST,
    why: '첫 쿼리가 늘 원본(미국 동부)으로 간다 — 쿼리 하나짜리 응답은 이득이 0이 된다.',
  },
]
