/**
 * 🚨 검사기 자신의 "실패할 수 없는" 구멍 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/guard-mutations-zero-match-2026-09-15.test.ts
 *
 * ⚠️ 주입 대상이 **러너 자신**이다. 동작한다 — 시험이 러너를 `spawnSync` 로 **새 프로세스**에서
 *    부르므로, 그때 디스크에 있는(=주입된) 파일을 읽는다. 지금 돌고 있는 러너는 이미 메모리에
 *    올라와 있어 영향받지 않는다.
 */
const TEST = 'src/tests/unit/guard-mutations-zero-match-2026-09-15.test.ts'
const RUNNER = 'scripts/check-guard-mutations.mjs'

export default [
  {
    name: '[검사기] 0건 매칭 검사를 다시 --map-only 뒤로 (커밋 전 점검이 가짜 초록불)',
    file: RUNNER,
    find: 'if (ONLY && onlyMatched === 0 && mapOk === 0) {',
    replace: 'if (false && ONLY && onlyMatched === 0 && mapOk === 0) {',
    test: TEST,
    why: '이 파일의 존재 이유가 "검사가 실패할 수 없음" 을 막는 것인데 그 구멍이 자기 안에 있었다. 파일명으로 --only 를 부르면 아무것도 안 돌고 초록불이 뜬다.',
  },
  {
    name: '[검사기] 필터가 없을 때도 0건 검사가 발화한다 (pre-commit 이 통째로 멎는다)',
    file: RUNNER,
    find: 'if (ONLY && onlyMatched === 0 && mapOk === 0) {',
    replace: 'if (onlyMatched === 0 && mapOk === 0 || true) {',
    test: TEST,
    why: '반대 방향의 사고 — 너무 넓게 잡으면 정상 사용까지 막아 아무도 이 모드를 안 쓰게 된다.',
  },
]
