/**
 * ⚫ 하단 탭 — 전부 검정, 누르면 채워진다 (2026-10-14 대표 야놀자 레퍼런스) — 주입 매니페스트.
 * 가드: src/tests/unit/bottomnav-black-filled-2026-10-14.test.ts
 */
const TEST = 'src/tests/unit/bottomnav-black-filled-2026-10-14.test.ts'
const FILE = 'src/components/main/BottomNav.tsx'

export default [
  {
    name: '⚫ 비활성 탭 아이콘을 회색으로 되돌린다',
    file: FILE,
    find: 'className="text-gray-900 dark:text-white"\n              strokeWidth={1.6}',
    replace: "className={active ? 'text-gray-900 dark:text-white' : 'text-gray-400'}\n              strokeWidth={1.6}",
    test: TEST,
    why: '대표가 "버튼들 검정색" 으로 확정했다 — 회색이면 비활성이 흐려 보이고 눌러도 되는지 헷갈린다.',
  },
  {
    name: '⚫ 활성 라벨 아래 브랜드 점을 다시 단다',
    file: FILE,
    find: '          {label}\n        </span>',
    replace: '          {label}\n          {active && <span aria-hidden="true" className="absolute left-1/2 -bottom-[7px] -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />}\n        </span>',
    test: TEST,
    why: '채움 + 굵기에 점까지 더하면 신호가 셋이 되어 "깔끔하게" 가 무너진다.',
  },
  {
    name: '⚫ 홈 상단 아이콘을 회색으로 되돌린다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: 'flex items-center gap-1 text-gray-900 dark:text-white',
    replace: 'flex items-center gap-1 text-gray-500 dark:text-gray-400',
    test: TEST,
    why: '하단 탭과 상단 아이콘의 규칙이 갈린다 — 대표가 "똑같이" 로 묶었다.',
  },
  {
    name: '⚫ 손을 떼도 채움이 남는다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '    onPointerUp: () => setPressed(null),\n',
    replace: '',
    test: TEST,
    why: '누른 뒤 아이콘이 채워진 채로 남아 그 화면이 열려 있는 것처럼 보인다.',
  },
]
