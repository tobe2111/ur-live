/**
 * 🗺️ 요청 제한 — 민감하지 않은 GET 은 메모리, 민감·변경은 DB (2026-11-17) — 주입 매니페스트.
 * 가드: src/tests/unit/rate-limit-memory-get-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/rate-limit-memory-get-2026-11-17.test.ts'

export default [
  {
    name: '🗺️ 로그인류 GET 까지 메모리로 센다(분산 시도로 비밀번호 대입이 쉬워진다)',
    file: 'src/worker/middleware/rate-limit.ts',
    find: "    if (!authSensitive && (method === 'GET' || method === 'HEAD')) {",
    replace: "    if ((method === 'GET' || method === 'HEAD')) {",
    test: TEST,
    why: '로그인·인증류는 isolate 를 가로질러 정확히 세고 DB 장애 시 막아야 한다(fail-closed).',
  },
  {
    name: '🗺️ 메모리 창이 한도를 안 본다(조회 요청 제한이 사라진다)',
    file: 'src/worker/middleware/rate-limit.ts',
    find: '      if (count > opts.max) {\n        c.header(\'Retry-After\', String(windowStart + opts.windowSec - now));',
    replace: '      if (count > opts.max * 1000) {\n        c.header(\'Retry-After\', String(windowStart + opts.windowSec - now));',
    test: TEST,
    why: '지도 장소 검색 등 외부 API 요금이 걸린 프록시가 무제한이 된다.',
  },
]
