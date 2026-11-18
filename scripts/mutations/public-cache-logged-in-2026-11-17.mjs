/**
 * 🗺️ 공용 캐시 핸들러는 신원을 읽지 않는다 (2026-11-17) — 주입 매니페스트.
 * 가드: src/tests/unit/public-cache-logged-in-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/public-cache-logged-in-2026-11-17.test.ts'

export default [
  {
    name: '🗺️ 공용 캐시 숏폼 핸들러가 로그인 사용자를 읽는다(한 사람 응답이 캐시돼 남에게 나간다)',
    file: 'src/features/urshorts/api/urshorts.routes.ts',
    find: "    const all = c.req.query('all') === '1'\n",
    replace: "    const all = c.req.query('all') === '1' || !!c.req.header('Authorization')\n",
    test: TEST,
    why: 'publicCache 는 로그인 여부와 상관없이 같은 칸에 저장한다 — 신원에 따라 응답이 바뀌면 개인 응답이 공유된다.',
  },
  {
    name: '🗺️ 유어샵(주인 응답이 다름)까지 공용 캐시로 옮긴다',
    file: 'src/worker/index.ts',
    find: "app.use('/api/curator/:handle', edgeCache(300));",
    replace: "app.use('/api/curator/:handle', publicCache(300));",
    test: TEST,
    why: '주인에게 주는 편집용 응답이 캐시돼 방문자에게 보인다.',
  },
]
