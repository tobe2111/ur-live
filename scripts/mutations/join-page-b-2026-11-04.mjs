/** 🧬 주입 — /join 시안 B(2026-11-04). 가드: src/tests/unit/join-page-b-2026-11-04.test.tsx */
const TEST = 'src/tests/unit/join-page-b-2026-11-04.test.tsx'
export default [
  {
    name: '🚪 /join 에서 에이전시 길이 빠진다',
    file: 'src/pages/JoinChoicePage.tsx',
    find: "  { to: '/agency/signup', Icon: PeopleIcon, title: '에이전시로 여러 매장 운영', hint: '이메일 계정 · 직원 초대', testId: 'join-agency' },\n",
    replace: '',
    test: TEST,
    why: '대표 "에이전시 버튼도 있어야 할거고".',
  },
  {
    name: '🚪 /join 이용권 카드에 교환권이 섞인다',
    file: 'src/pages/JoinChoicePage.tsx',
    find: "p.image_url && Number(p.deal_only) !== 1",
    replace: 'p.image_url',
    test: TEST,
    why: '이 화면은 이용권(카드 결제) 손님 길 — 교환권(딜 결제)이 섞이면 말이 틀린다.',
  },
]
