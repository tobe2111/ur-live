/**
 * 🔠📐 마이 타입 스케일 + 4px 격자 (2026-09-28, 대표 *"디자인, ui 모두 별로야. 대기업수준이 필요해"*)
 * 가드: src/tests/unit/my-type-scale-2026-09-28.test.ts
 *
 * 되돌리려는 사고는 **조용히 새는 단계**다. 크기 하나를 반쪽 값으로 적어도 빌드는 초록이고 화면도
 * 안 깨진다 — 그게 17단계까지 자란 방법이다. 격자도 같다(`py-3.5` 하나가 그 줄만 2px 어긋난다).
 * 그래서 사람 눈이 아니라 시험이 세야 한다.
 */
const TEST = 'src/tests/unit/my-type-scale-2026-09-28.test.ts'

export default [
  {
    name: '🔠 스케일 밖 크기가 하나 새어 들어온다 (12.5px)',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: "        <span className=\"block text-[15px] font-bold text-gray-900 dark:text-white\">{label}</span>",
    replace: "        <span className=\"block text-[12.5px] font-bold text-gray-900 dark:text-white\">{label}</span>",
    test: TEST,
    why: '반쪽 크기 하나면 그 줄만 이웃과 미세하게 다르다 — 빌드도 화면도 안 깨져서 17단계까지 이렇게 자랐다.',
  },
  {
    name: '🔠 tailwind 기본 단계를 섞는다 (text-sm)',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: "  return <div className=\"mt-6 mb-2 px-1 text-[12px] font-bold text-gray-400\">{children}</div>",
    replace: "  return <div className=\"mt-6 mb-2 px-1 text-sm font-bold text-gray-400\">{children}</div>",
    test: TEST,
    why: '체계가 둘이 되면 스케일이 무의미해진다 — `text-sm`(14)은 15 도 13 도 아니라 사이에 낀다.',
  },
  {
    name: '📐 행 간격이 격자를 벗어난다 (py-3.5)',
    file: 'src/pages/user-profile/list-grammar.tsx',
    find: "  'w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left",
    replace: "  'w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px] text-left",
    test: TEST,
    why: '14px 패딩은 4의 배수가 아니라 이 행만 이웃과 2px 어긋난다 — 줄이 스무 개면 스무 번 어긋난다.',
  },
  {
    name: '🎨 오늘 카드가 파란 밴드(TicketCard)로 되돌아간다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '      <div className={LIST_PLATE_CLS}>\n        <div className="px-4 pt-4 pb-4">',
    replace: '      <TicketCard bandLeft="오늘">\n        <div className="px-4 pt-4 pb-4">',
    test: TEST,
    why: '바로 아래 파란 사용처리 면과 강조색 면이 둘이 된다 — 표면 규칙 ②(강조색 하나)가 깨지는 그 자리다.',
  },
  {
    name: '🎨 유일한 브랜드 면(사용처리)이 회색으로 죽는다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'h-[60px] rounded-2xl bg-brand text-white text-left',
    replace: 'h-[60px] rounded-2xl bg-wash text-gray-900 text-left',
    test: TEST,
    why: '면을 하나로 줄인 뒤라 이것까지 죽으면 화면에 강조가 **아예 없어진다** — 하루에 가장 많이 누르는 버튼이다.',
  },
  {
    name: '🏷️ 딜 잔액이 다시 고아가 된다 (그룹 라벨 제거)',
    file: 'src/pages/user-profile/TeamPointsCard.tsx',
    find: "      <GroupLabel>{'내 딜'}</GroupLabel>\n",
    replace: '',
    test: TEST,
    why: '위아래가 전부 라벨 달린 그룹이라, 라벨이 빠지면 이 줄만 어디에도 안 속한 채 뜬다(대표가 지적한 그 바).',
  },
]
