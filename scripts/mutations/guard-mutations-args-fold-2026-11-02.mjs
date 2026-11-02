/**
 * 🧬 주입 — 러너가 조용히 다른 일을 하지 않게 (2026-11-02)
 *    가드: src/tests/unit/guard-mutations-args-fold-2026-11-02.test.ts
 */
const T = 'src/tests/unit/guard-mutations-args-fold-2026-11-02.test.ts'
export default [
  {
    name: '🚫 모르는 인자를 다시 조용히 무시한다 (전수로 떨어져 소스를 망가뜨림)',
    file: 'scripts/guard-mutations-args.mjs',
    find: '    out.push(a)\n  }\n  return out',
    replace: '  }\n  return out',
    test: T,
    why: '2026-08-31 · 2026-11-02 두 번 — 모르는 인자가 필터 없는 전수를 돌렸다.',
  },
  {
    name: '🚫 값 없는 --only 를 다시 받아들인다',
    file: 'scripts/guard-mutations-args.mjs',
    find: "      if (v == null || v.startsWith('-')) out.push(`${a}(값이 없다)`)\n      else i++",
    replace: '      i++',
    test: T,
    why: '`--only` 뒤가 비면 필터가 null 이 되어 전수가 돈다.',
  },
  {
    name: '🪞 내용이 다른 같은 이름 주입도 접어 버린다 (--only 가 엉뚱한 것을 돌림)',
    file: 'scripts/guard-mutations-manifest-diff.mjs',
    find: '    if (IDENTITY.every((k) => prev[k] === m[k])) identical.add(m.name)\n    else conflicts.add(m.name)',
    replace: '    identical.add(m.name)',
    test: T,
    why: '이름은 같고 겨누는 곳이 다르면 어느 쪽이 검증됐는지 알 수 없다 — 그때만은 멈춰야 한다.',
  },
]
