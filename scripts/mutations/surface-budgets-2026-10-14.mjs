/**
 * 📏 화면별 첫 화면 무게 래칫 (2026-10-14) — 주입 매니페스트.
 * 가드: src/tests/unit/surface-budgets-2026-10-14.test.ts
 * 예산 가드는 "늘 통과" 로 무너지기 쉽다(이 레포의 gzip 예산이 몇 달간 0 을 재며 초록이었다).
 */
const TEST = 'src/tests/unit/surface-budgets-2026-10-14.test.ts'
const G = 'scripts/check-surface-budgets.mjs'

export default [
  {
    name: '[surface-budgets] 늘어난 화면을 통과시킨다',
    file: G,
    find: '    if (m.totalKB > b.totalKB + tolerance) {',
    replace: '    if (false) {',
    test: TEST,
    why: '상세에 30KB 를 붙여도 PR 이 초록이 된다 — 이 가드가 존재하는 이유가 사라진다.',
  },
  {
    name: '[surface-budgets] 줄어든 값을 잠그지 않는다',
    file: G,
    find: '    } else if (m.totalKB < b.totalKB - slack) {',
    replace: '    } else if (false) {',
    test: TEST,
    why: '줄인 여유가 다음 기능에 조용히 다시 먹힌다 — 래칫이 아니라 헐거운 선이 된다.',
  },
  {
    name: '[surface-budgets] 기준에 없는 새 화면을 그냥 통과시킨다',
    file: G,
    find: "    if (!b) { errors.push({ s, kind: 'new',",
    replace: "    if (!b) { continue; errors.push({ s, kind: 'new',",
    test: TEST,
    why: '새 하드로드 화면이 예산 없이 들어온다.',
  },
  {
    name: '[surface-budgets] CSS 를 무게에서 뺀다',
    file: G,
    find: "  const out = { __boot__: [...boot, ...css] }",
    replace: "  const out = { __boot__: [...boot] }",
    test: TEST,
    why: '렌더를 막는 CSS(29KB br) 가 아무리 커져도 안 잡힌다.',
  },
  {
    name: '[surface-budgets] verify 에서 경고로만 돈다',
    file: '.github/workflows/verify.yml',
    // 🔁 2026-10-16 재조준: `run:` 줄에 `ci-run` 래퍼가 붙어(실패를 annotation 으로 내보낸다)
    //   명령 문자열을 앵커로 쓰면 낡는다. 지키는 불변식은 **그 스텝이 strict 라는 것**이므로
    //   `- name:` 줄만 앵커로 두고 `continue-on-error` 를 끼워 넣는다 — 결함은 한 글자도 안 바뀌었다.
    find: '      - name: Per-surface first-screen weight budget (strict)\n',
    replace: '      - name: Per-surface first-screen weight budget (strict)\n        continue-on-error: true\n',
    test: TEST,
    why: '빨간불이 떠도 PR 이 머지된다.',
  },
  {
    name: '[surface-budgets] 손님 화면 폐쇄를 10개에서 자른다',
    file: G,
    find: "    out[`${prefix}${name}`] = [...bootFiles, ...cssFiles, ...js, ...css]",
    replace: "    out[`${prefix}${name}`] = [...bootFiles, ...cssFiles, ...[...js].slice(0, 10), ...css]",
    test: TEST,
    why: '11번째 뒤로 붙은 무게가 다시 예산 밖으로 숨는다(#1912 의 +6.0 착시 · 숨은 cart +33KB).',
  },
  {
    name: '[surface-budgets] main 이 손님 화면을 맵 그대로 잰다',
    file: G,
    find: '  Object.assign(surfaces, routeSurfaces, dashboardSurfacesFrom(',
    replace: '  Object.assign(surfaces, dashboardSurfacesFrom(',
    test: TEST,
    why: '폐쇄를 계산만 하고 안 쓰면 측정은 다시 10개 상한에 묶인다.',
  },
  {
    name: '[surface-budgets] 맵·폐쇄 어긋남을 못 본다',
    file: G,
    find: '    if (miss.length) errors.push(',
    replace: '    if (false) errors.push(',
    test: TEST,
    why: '생성기와 측정기가 다른 진입점을 읽어도 조용히 지나간다.',
  },
]
