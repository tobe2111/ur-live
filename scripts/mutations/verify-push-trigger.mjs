/**
 * 🔴 verify.yml 의 push 트리거 부활 방지 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/ci-verify-coverage.test.ts
 *
 * 그날 main 에 "Verify 필수" 룰셋이 켜지자, concurrency 가 취소한 push-run 의 `Verify`(cancelled) check run 을
 * GitHub 가 실패한 필수 검사로 세어 초록 PR 이 `blocked` 로 남았다(#1429·#1239, 각 손 Re-run +50분).
 */
const TEST = 'src/tests/unit/ci-verify-coverage.test.ts'
const FILE = '.github/workflows/verify.yml'

export default [
  {
    name: '🔴 verify.yml 에 push 트리거가 되살아난다 (PR 마다 취소된 Verify 가 머지를 막는다)',
    file: FILE,
    find: '  workflow_dispatch:\n\nconcurrency:',
    replace: '  push:\n    branches-ignore: [main]\n  workflow_dispatch:\n\nconcurrency:',
    test: TEST,
    why:
      '같은 커밋에 pull_request-run 과 push-run 이 둘 생기면 concurrency 가 하나를 취소하고, 그 취소본이 ' +
      '이름이 같은 필수 검사 `Verify` 의 실패로 집계된다 — 58분 초록이 떠도 auto-merge 가 발동하지 않는다.',
  },
]
