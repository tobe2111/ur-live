/**
 * 🔵 선택 상태는 브랜드 하나 (2026-09-29 — 대표 *"Ui 부분에서 더 개선할 수 있는건?"* → 전부 승인)
 * 가드: src/tests/unit/consumer-chip-selection-2026-09-29.test.ts
 *
 * 되돌리려는 사고는 **한 화면씩 선택 색이 새는 것**이다. 칩 하나를 검정으로 적어도 빌드도 화면도
 * 안 깨지고, 그 화면에서만 선택이 검정이다. 그렇게 네 문법(검정·회색·테두리·링)까지 갈렸고
 * *"전체"* 칩이 주문내역에선 검정, 지도에선 파랑이었다.
 */
const TEST = 'src/tests/unit/consumer-chip-selection-2026-09-29.test.ts'

export default [
  {
    name: '🔵 필터 칩 하나가 다시 검정 면으로 돌아간다',
    file: 'src/pages/region/RegionPage.tsx',
    find: "? 'bg-brand text-white border-brand'",
    replace: "? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900'",
    test: TEST,
    why: '한 화면만 검정이면 에러가 없다 — 같은 역할의 칩이 화면마다 다른 색이 되는 것이 정확히 이 사고다.',
  },
  {
    name: '🔵 시트 선택 행이 회색으로 죽는다 (무엇이 골라졌는지 흐려진다)',
    file: 'src/pages/restaurant-map/SortSheet.tsx',
    find: "? 'bg-brand text-white font-bold'",
    replace: "? 'bg-gray-100 dark:bg-white/[0.08] font-bold'",
    test: TEST,
    why: '시트는 하나 고르는 자리다 — 선택이 회색이면 안 고른 것과 구별이 약해진다.',
  },
  {
    name: '🔵 예외 목록이 **이유 없이** 늘어난다 (면제가 된다)',
    file: 'src/tests/unit/consumer-chip-selection-2026-09-29.test.ts',
    find: "  'src/pages/wishlist/WishlistParts.tsx':\n    '분기가 색이 아니라 **표시 여부**(`hidden lg:inline-flex`)다.',",
    replace: "  'src/pages/wishlist/WishlistParts.tsx': '',",
    test: TEST,
    why: '예외에 이유를 안 적으면 다음 세션이 거기에 아무거나 넣는다 — 그 순간 가드가 아니라 허가 목록이 된다.',
  },
  {
    // 🩸 2026-09-29: 첫 판은 *단언 자체를 약화*시켰는데 **그건 구조적으로 통하지 않는다** —
    //   약한 단언은 통과하니 빨간불이 안 난다. 대신 **훑는 신호를 깨뜨려** 하한이 실제로 잡는지 본다.
    name: '🔵 선택 요소를 못 찾게 된다 (하한이 없으면 영원히 통과한다)',
    file: 'src/tests/unit/consumer-chip-selection-2026-09-29.test.ts',
    find: "      if (!/aria-(pressed|current|selected)=/.test(l)) return",
    replace: "      if (!/aria-zzz-없는속성=/.test(l)) return",
    test: TEST,
    why: '경로·정규식이 낡아 대상이 0개가 되면 위 검사는 영원히 통과한다 — 이 레포가 반복해 당한 "헛도는 가드".',
  },
  {
    name: '🚫 빈 화면 안내가 다시 중단된 기능을 가리킨다',
    file: 'public/locales/ko/translation.json',
    find: '"emptyDesc": "마음에 드는 이용권이나 상품을 찾아보세요"',
    replace: '"emptyDesc": "라이브에서 마음에 드는 상품을 구매해보세요"',
    test: TEST,
    why: '빈 화면은 다음 행동을 알려주는 자리다 — 없는 기능을 가리키면 그냥 막다른 길이 된다.',
  },
  {
    name: '🩸 눌림 판정 창이 다시 3줄로 좁아진다 (검정 칩이 통째로 샌다)',
    file: 'scripts/check-primary-button-color.mjs',
    find: '    const window = lines.slice(Math.max(0, i - 8), i + 1).join(\'\\n\')',
    replace: '    const window = lines.slice(Math.max(0, i - 3), i + 1).join(\'\\n\')',
    test: 'src/tests/unit/primary-button-color-2026-09-28.test.ts',
    why: '칩은 `<button` 이 6~7줄 위에 있다 — 3줄 창에서는 검정 칩 다섯 개가 실제로 새고 있었다(2026-09-29 실측).',
  },
]
