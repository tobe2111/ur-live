/**
 * 🧬 주입 — pre-commit 이 **메모리 부족을 "타입 에러" 라 보고**하던 것 (2026-11-01 실측)
 *    가드: src/tests/unit/precommit-tsc-cause-2026-11-01.test.ts
 *
 *    ⚠️ 양방향이다 — 원인 구분을 되돌리면 없는 에러를 쫓게 되고, 힙을 숫자로 박으면 메모리
 *       작은 기계에서 OOM-killer 를 부른다(지금보다 나빠진다).
 */
const T = 'src/tests/unit/precommit-tsc-cause-2026-11-01.test.ts'
const F = 'scripts/install-git-hooks.sh'
export default [
  {
    name: 'pre-commit tsc — 원인 구분을 되돌려 전부 "타입 에러" 라 말한다',
    file: F,
    find: 'echo "❌ Commit blocked — **타입 에러가 아니다**(exit ${TSC_EXIT} · \'error TS\' 0건). tsc 가 끝까지 돌지 못했다."',
    replace: 'echo "❌ Commit blocked. Fix TypeScript errors."',
    test: T,
    why:
      '2026-11-01 실측: 훅이 그 문구를 냈는데 실제 원인은 **OOM** 이었다(출력 꼬리가 `Aborted` + ' +
      '힙 주소, 힙을 올려 돌리니 `error TS` 0건). 되돌리면 세션이 다시 **없는 타입 에러를 찾아 ' +
      '헤맨다** — CLAUDE.md 가 이미 두 번 기록한 클래스다.',
  },
  {
    name: 'pre-commit tsc — 힙을 큰 숫자로 박는다(머신 계산 제거)',
    file: F,
    find: '      export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=$TSC_HEAP_MB"',
    replace: '      export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=16384"',
    test: T,
    why:
      '숫자를 박으면 메모리 큰 기계에선 통하지만 **4GB 기계에서 OOM-killer** 를 부른다(node 가 ' +
      '물리 메모리보다 큰 힙을 쓰려 한다). 머신에서 계산해야 어느 기계에서도 지금보다 나빠지지 않는다.',
  },
  {
    name: 'pre-commit tsc — 사람이 정한 힙을 덮어쓴다',
    file: F,
    find: '  *max-old-space-size*) : ;;',
    replace: '  __no_such_pattern__) : ;;',
    test: T,
    why:
      '이 분기를 없애면(패턴을 안 맞게 만들면) `NODE_OPTIONS` 에 힙 옵션이 **두 번** 실린다. ' +
      'node 는 뒤를 쓰므로 사람이 일부러 낮춘(또는 높인) 값이 조용히 무시된다.',
  },
  {
    name: 'pre-commit tsc — 실패를 테스트 없이 두어 set -e 가 훅을 중단시킨다',
    file: F,
    find: 'npx tsc --noEmit --skipLibCheck > "$TSC_LOG" 2>&1 || TSC_EXIT=$?',
    replace: 'npx tsc --noEmit --skipLibCheck > "$TSC_LOG" 2>&1',
    test: T,
    why:
      '훅은 `set -e` 아래다. `||` 를 떼면 tsc 가 실패한 **그 줄에서 훅이 즉시 끝나** 원인을 가르는 ' +
      '메시지가 아예 안 나온다 — 사람은 왜 막혔는지 모른 채 종료코드만 본다(종전 한 줄이 `||` 를 ' +
      '쓴 이유이기도 하다).',
  },
]
