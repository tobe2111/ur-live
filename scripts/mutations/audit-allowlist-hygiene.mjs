/**
 * 🧹 npm audit 면제 위생 가드의 되돌려-검증 (2026-09-30).
 *
 * 그날 CI 를 막고 있던 것은 dev 취약점이 아니라 **런타임 axios 5건**이었고, 면제 목록 9건 중
 * 6건은 이미 해소된 채 남아 있었다(= 같은 취약점이 다시 들어와도 조용히 통과). 그 정리가
 * 되돌아가는 길을 하나씩 심는다.
 */
const AL = '.audit-allowlist.json'
const GATE = 'scripts/check-npm-audit.sh'
const TEST = 'src/tests/unit/audit-allowlist-hygiene-2026-09-30.test.ts'

export default [
  {
    name: '🧹 면제 항목에서 판단 근거(reason)가 빠진다',
    file: AL,
    find: '"reason": "vite dev server',
    replace: '"reason": "",\n      "_reason": "vite dev server',
    test: TEST,
    why: '근거 없는 면제는 다음 세션이 왜 면제인지 몰라 판단할 수 없다 — 영구 면제가 된다.',
  },
  {
    name: '🧹 게이트가 낡은 면제 판정을 계산만 하고 버린다(분기 소실)',
    file: GATE,
    find: 'if [ -n "$STALE" ]; then',
    replace: 'if [ -n "$STALE_DISABLED" ]; then',
    test: TEST,
    why: '값만 만들고 안 쓰면 경고가 한 번도 안 뜬다 — 파일에 코드는 있는데 아무것도 안 지키는 상태.',
  },
  {
    name: '🧹 게이트의 낡은-면제 판정이 통째로 사라진다',
    file: GATE,
    find: 'STALE=$(echo "$AUDIT_JSON"',
    replace: 'STALE_REMOVED=$(echo "$AUDIT_JSON"',
    test: TEST,
    why: '낡은 면제를 아무도 안 보면 목록이 계속 쌓인다 — 실측 9건 중 6건이 그 상태였다.',
  },
  {
    name: '🧹 audit 이 비었을 때도 낡음으로 판정한다(전부 오탐)',
    file: GATE,
    find: 'if not present:\n    sys.exit(0)',
    replace: 'if False:\n    sys.exit(0)',
    test: TEST,
    why: '레지스트리 실패로 audit 이 비면 멀쩡한 면제 전부가 "낡음" 으로 떠 경고가 소음이 된다.',
  },
  {
    name: '🧹 낡은 면제가 경고가 아니라 차단이 된다',
    file: GATE,
    find: '  echo "    (남겨 두면 같은 취약점이 다시 들어와도 게이트가 조용히 통과시킨다)"',
    replace: '  echo "    (남겨 두면 같은 취약점이 다시 들어와도 게이트가 조용히 통과시킨다)"\n  exit 1',
    test: TEST,
    why: 'audit 은 네트워크에 의존한다 — 낡음으로 차단하면 레지스트리가 흔들릴 때 멀쩡한 PR 이 막힌다.',
  },
  {
    name: '🧹 런타임 axios 를 면제로 덮는다(상향 대신)',
    file: AL,
    find: '      "ghsa": "GHSA-fx2h-pf6j-xcff",\n      "pkg": "vite",',
    replace: '      "ghsa": "GHSA-x97p-jq2g-jp4f",\n      "pkg": "axios",',
    test: TEST,
    why: 'axios 는 브라우저에서 쓰는 런타임 의존성이다(toFormData 프로토타입 오염이 닿는다) — 면제가 아니라 버전 상향이 답이다.',
  },
]
