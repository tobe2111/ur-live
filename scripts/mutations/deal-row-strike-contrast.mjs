/**
 * 🔧 2026-09-28 주입 — 공용 줄(DealRow)의 **취소선 정가 대비**.
 *
 * 지키는 것: 색 이름이 아니라 **계산된 대비**(라이트 3.65:1 · 다크 3.10:1, 하한 3.0).
 * 아래 결함을 심으면 `deal-row-strike-contrast-2026-09-28.test.ts` 가 빨간불이어야 한다.
 */
export default [
  {
    name: 'DealRow 취소선 — 종전(안 읽히던) 회색으로 되돌린다',
    file: 'src/components/deal/DealRow.tsx',
    find: 'line-through text-gray-400 dark:text-gray-500',
    replace: 'line-through text-gray-300 dark:text-gray-600',
    test: 'src/tests/unit/deal-row-strike-contrast-2026-09-28.test.ts',
    why:
      '라이브 실측으로 다크 2.14:1 · 라이트 1.50:1 이던 바로 그 값이다. 되돌아가면 유어샵에서 ' +
      '정가가 다시 안 읽힌다 — 그리고 `check-dark-contrast` 는 목록 화면에서 빈 껍데기를 재느라 ' +
      '이걸 못 본다. 이 시험이 그 사각지대를 대신 지킨다.',
  },
  {
    name: 'DealRow 취소선 — 라이트만 흐리게(한쪽만 새는 경우)',
    file: 'src/components/deal/DealRow.tsx',
    find: 'line-through text-gray-400 dark:text-gray-500',
    replace: 'line-through text-gray-300 dark:text-gray-500',
    test: 'src/tests/unit/deal-row-strike-contrast-2026-09-28.test.ts',
    why: '다크만 보고 고치면 라이트가 1.50:1 로 남는다. 두 모드를 따로 재는지 확인한다.',
  },
  {
    name: 'DealRow 취소선 — 판매가만큼 진하게(위계 붕괴)',
    file: 'src/components/deal/DealRow.tsx',
    find: 'line-through text-gray-400 dark:text-gray-500',
    replace: 'line-through text-gray-900 dark:text-gray-500',
    test: 'src/tests/unit/deal-row-strike-contrast-2026-09-28.test.ts',
    why:
      '대비만 요구하면 "진하게 하면 통과" 가 되어 정가가 판매가와 같은 무게가 된다. ' +
      '위계 단언(③)이 실제로 일하는지 본다.',
  },
]
