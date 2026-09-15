/**
 * 🩸 주입 — 테마 가드 사각지대 3종 (2026-09-15)
 *
 * 이 가드는 **실패하지 못한 게 아니라 보지도 않았다.** 소비자 핵심 화면 143개가 면제였다.
 * 되돌리면 전부 **조용히** 돌아간다 — 검사는 초록이고 화면만 안 보인다.
 */
const TEST = 'src/tests/unit/theme-guard-blindspots-2026-09-15.test.ts'
const GUARD = 'scripts/check-theme-consistency.mjs'

export default [
  {
    name: '[테마가드] 🔴 순수-다크 판정이 dark: 접두사를 다시 놓친다',
    file: GUARD,
    find: '(?<!dark:)bg-\\[#11141C\\]|data-mobile-only',
    replace: 'bg-\\[#11141C\\]|data-mobile-only',
    test: TEST,
    why:
      '`dark:bg-[#11141C]`(올바른 다크 대응)를 순수 다크 페이지로 오인해 파일을 통째로 건너뛴다. ' +
      '실측 150중 143이 그렇게 면제됐다 — /vouchers · /checkout · /search · 상품상세 · 하단 네비.',
  },
  {
    name: '[테마가드] 🔴 늘 밝은 표면(light-island) 면제가 사라진다',
    file: GUARD,
    find: "line.includes('light-fixed') || line.includes('light-island')",
    replace: "line.includes('light-fixed')",
    test: TEST,
    why:
      '토스 결제 위젯·지도 딜 카드는 테마와 무관하게 흰 표면이다(클래스가 런타임에 실제로 동작한다). ' +
      '면제가 없으면 정상 코드에 빨간불이 나고, 그러면 결국 가드를 끄게 된다.',
  },
  {
    name: '[테마가드] 🔴 여러 줄 주석 추적이 사라진다',
    file: GUARD,
    find: '    if (inBlockComment[i]) return',
    replace: '',
    test: TEST,
    why:
      '주석 판정이 줄 단위로 돌아가면 여러 줄 JSX 주석의 **가운데 줄**에 적힌 색 이름이 ' +
      '위반으로 잡힌다(실측 오탐 4건). 이 레포가 반복해 당한 클래스다.',
  },
]
