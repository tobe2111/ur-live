/** 🧬 주입 — HSTS preload 조건이 깨지면 빨간불인가. 가드: src/tests/unit/hsts-preload-2026-11-09.test.ts */
const T = 'src/tests/unit/hsts-preload-2026-11-09.test.ts'
export default [
  {
    name: 'HSTS유지 — 워커 헤더에서 preload 를 뺀다',
    file: 'src/worker/index.ts',
    find: "c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');",
    replace: "c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');",
    test: T,
    why: '조건이 깨지면 HSTS preload 목록에서 빠진다.',
  },
  {
    name: 'HSTS유지 — _headers 의 max-age 를 줄인다',
    file: 'public/_headers',
    find: 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    replace: 'Strict-Transport-Security: max-age=86400; includeSubDomains; preload',
    test: T,
    why: 'max-age 가 1년 미만이면 preload 자격을 잃는다.',
  },
]
