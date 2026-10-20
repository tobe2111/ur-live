/**
 * 🔓 npm audit 게이트 — 잔존 우회 차단 (2026-10-06) — 주입 매니페스트.
 *
 * 보안 게이트가 **꺼진 걸 아무도 모르는 것**이 이 조가 막는 전부다. 실제로 두 번 났다
 * (2026-09-30 대표에게 틀린 보고 · 2026-10-06 같은 덫 재현).
 *
 * 가드: src/tests/unit/audit-gate-no-stale-bypass-2026-10-06.test.ts
 */
const TEST = 'src/tests/unit/audit-gate-no-stale-bypass-2026-10-06.test.ts'
const GATE = 'scripts/check-npm-audit.sh'

export default [
  {
    name: '🔓 커밋 메시지 우회가 되살아난다 (한 번 쓰면 이후 모든 실행이 조용히 통과)',
    file: GATE,
    find: 'if [ "${SKIP_NPM_AUDIT:-0}" = "1" ]; then',
    replace: 'if grep -q "SKIP_AUDIT" .git/COMMIT_EDITMSG 2>/dev/null; then\n  exit 0\nfi\nif [ "${SKIP_NPM_AUDIT:-0}" = "1" ]; then',
    test: TEST,
    why: 'git 은 pre-commit 을 메시지 준비 **전에** 돌리므로 이 경로는 지금 커밋을 못 보고 **지난 커밋의 메시지만** 본다 — 한 번 우회하면 그 뒤 전부 조용히 통과한다. 2026-09-30 에 이것 때문에 대표에게 틀린 보고가 나갔다.',
  },
  {
    name: '🔓 게이트가 조건 없이 조기 통과한다 (exit 0 이 하나 더 생긴다)',
    file: GATE,
    find: 'echo "==> 의존성 취약점 검사 중..."',
    replace: 'echo "==> 의존성 취약점 검사 중..."\nexit 0',
    test: TEST,
    why: '조용한 통과는 실패보다 나쁘다 — 게이트가 도는 것처럼 보이면서 아무것도 안 막는다. 허용된 `exit 0` 은 명시 우회와 "차단 대상 없음" 둘뿐이다.',
  },
  {
    name: '🔓 훅 설치 안내가 안 먹는 우회를 다시 광고한다',
    file: 'scripts/install-git-hooks.sh',
    find: '  echo "   긴급 우회: SKIP_NPM_AUDIT=1 git commit"',
    replace: '  echo "   긴급 우회: 커밋 메시지에 [SKIP_AUDIT] 포함"',
    test: TEST,
    why: '안 먹는 우회를 안내하면 사람이 그걸 적고 막힌 뒤 왜 막혔는지 모른다 — 2026-09-30 세션이 정확히 그 길로 시간을 버렸다.',
  },
  {
    name: '🔓 허용목록이 승인자 없이 통과한다 (내가 임의로 면제할 수 있게 된다)',
    file: '.audit-allowlist.json',
    find: '"accepted_by": "대표(urteam.corp) 승인 — 2026-10-06 \\"승인\\"',
    replace: '"accepted_by": "TODO — 2026-10-06 \\"승인\\"',
    test: TEST,
    why: '이 파일의 `accepted_by` 는 "대표가 그 위험을 받기로 했다" 는 **기록**이다. 비어 있거나 TODO 면 세션이 스스로 보안 예외를 만들 수 있게 되고, 그 기록은 거짓이 된다.',
  },
]
