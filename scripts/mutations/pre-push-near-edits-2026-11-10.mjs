/**
 * 🧬 주입 — 올리기 전 고친 줄 근처 주입 사전 검증 (2026-11-10) · 가드: src/tests/unit/pre-push-near-edits-2026-11-10.test.ts
 */
const T = 'src/tests/unit/pre-push-near-edits-2026-11-10.test.ts'
const F = 'scripts/guard-mutations-near-edits.mjs'
export default [
  {
    name: '🎯 바뀐 줄 바로 위의 앵커만 본다 (15줄 떨어진 지도 시드 실패를 놓친다)',
    file: F,
    find: '    if (ranges.some(([a, b]) => a - near <= last && b + near >= first)) picked.add(m.name)',
    replace: '    if (ranges.some(([a, b]) => a <= last && b >= first)) picked.add(m.name)',
    test: T,
    why: '11/9 지도 시드 실패는 앵커가 바뀐 줄에서 15줄 떨어져 있었다 — 창이 없으면 푸시 전엔 초록, CI 11분 뒤 빨강.',
  },
  {
    name: '🎯 시험 파일을 바꿔도 그 주입을 안 고른다',
    file: F,
    find: '    if (files.has(m.test)) { picked.add(m.name); continue }',
    replace: '',
    test: T,
    why: '시험을 고치면 그 시험을 쓰는 주입이 헛돌기 쉽다 — 실패 6건 중 여럿이 시험 파일 쪽 변경과 함께 왔다.',
  },
  {
    name: '🎯 앵커가 사라진 주입을 안 고른다 (낡은 지도를 CI 에서야 안다)',
    file: F,
    find: '    if (at < 0) { picked.add(m.name); continue }',
    replace: '    if (at < 0) continue',
    test: T,
    why: '고친 파일에서 앵커가 사라진 것은 돌려 보면 수 ms 에 잡힌다 — 안 고르면 CI 가 11분 뒤 알려 준다.',
  },
  {
    name: '🎯 푸시 게이트가 시간 초과·git 오류에도 푸시를 막는다',
    file: 'scripts/pre-push-gate.mjs',
    find: "      if (err && err.status === 1) {\n        console.error('   ↑ CI 가 이 커밋을",
    replace: "      if (err) {\n        console.error('   ↑ CI 가 이 커밋을",
    test: T,
    why: '안내 검사가 이 환경 탓에 실패하는 날 모든 푸시가 막힌다 — 마지막 방어선은 CI 다.',
  },
]
