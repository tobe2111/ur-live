/**
 * 🧬 주입 — 옛 소개서 자동 참조를 커밋마다 재생성하지 않는다 (2026-11-02)
 *    가드: src/tests/unit/proposal-refs-not-in-hook-2026-11-02.test.ts
 *
 * 막는 사고: 라우트를 더한 모든 브랜치가 같은 자동 블록을 고쳐 머지마다 충돌한다.
 */
const T = 'src/tests/unit/proposal-refs-not-in-hook-2026-11-02.test.ts'
export default [
  {
    name: '소개서 자동참조 — pre-commit 이 다시 생성·stage 한다',
    file: 'scripts/install-git-hooks.sh',
    find: 'node scripts/check-audit-registry-sync.mjs --fix > /dev/null 2>&1 || true\n',
    replace:
      'node scripts/generate-proposal-refs.mjs > /dev/null 2>&1 || true\ngit add docs/proposals/*.md 2>/dev/null || true\nnode scripts/check-audit-registry-sync.mjs --fix > /dev/null 2>&1 || true\n',
    test: T,
    why: '휘발성 생성물을 다시 추적하면 브랜치마다 같은 블록을 다툰다.',
  },
]
