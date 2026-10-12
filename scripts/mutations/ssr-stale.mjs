/**
 * ♻️ SSR 직전 사본 (2026-10-12, 대표 승인 "허가 — 진행") — 주입 매니페스트.
 * 가드: src/tests/unit/ssr-stale-while-revalidate-2026-10-12.test.ts
 */
const TEST = 'src/tests/unit/ssr-stale-while-revalidate-2026-10-12.test.ts'
const MOD = 'src/worker/utils/ssr-payload.ts'
export default [
  {
    name: '♻️ 사본을 쓰면서 새로고침을 안 돌린다(1시간 내내 같은 사본)',
    file: MOD,
    find: "          waitUntil!(selfFetch(target, origin).then((r) => writeStale(origin, target.path, r.text, r.status)));\n",
    replace: '',
    test: TEST,
    why: '첫 화면이 사본 만료(1시간)까지 갱신되지 않는다 — 가격·재고가 그만큼 늦게 반영된다.',
  },
  {
    name: '♻️ 내려간 상품(404)의 사본을 안 지운다',
    file: MOD,
    find: "    } else if (status === 'self-fetch-404') {\n      await cache.delete(staleKey(origin, path));\n    }",
    replace: '    }',
    test: TEST,
    why: '삭제된 상품이 1시간 동안 200 + 색인 가능으로 서빙된다(soft-404 판정을 우회).',
  },
  {
    name: '♻️ waitUntil 없이도 사본을 쓴다',
    file: MOD,
    find: 'const staleable = !!waitUntil && !isKvWarmedPath(target.path);',
    replace: 'const staleable = !isKvWarmedPath(target.path);',
    test: TEST,
    why: '새로 채울 수 없는 사본이 계속 서빙된다.',
  },
  {
    name: '♻️ 사본이 엣지 적중보다 먼저 읽힌다',
    file: MOD,
    find: '  if (!payload && staleable) {',
    replace: '  if (staleable) {',
    test: TEST,
    why: '멀쩡한 엣지 적중을 덮어쓰고 매 요청 새로고침을 돌린다.',
  },
  {
    name: '♻️ 워커가 waitUntil 을 안 넘긴다(처방 전체가 조용히 꺼짐)',
    file: 'src/worker/index.ts',
    find: 'fetchSsrPayload(ssrTarget, origin0, c.env, ssrWaitUntil(c))',
    replace: 'fetchSsrPayload(ssrTarget, origin0, c.env)',
    test: TEST,
    why: '에러 없이 종전 동작으로 돌아간다 — 첫 방문이 다시 콜드 D1 을 기다린다.',
  },
]
