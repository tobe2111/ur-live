/** 🧬 주입 — 2026-11-04 손님 화면 셋. 가드: src/tests/unit/consumer-fixes-2026-11-04.test.ts */
const TEST = 'src/tests/unit/consumer-fixes-2026-11-04.test.ts'
export default [
  {
    name: '📏 생활 견적 판에 안쪽 가로 여백이 돌아온다(양쪽 40px)',
    // 🔁 2026-11-08 재조준: 값이 서버 첫 화면과 같은 SSOT(`shared/life-page.ts`)로 옮겨갔다.
    file: 'src/shared/life-page.ts',
    find: "  card: 'rounded-2xl py-5',",
    replace: "  card: 'rounded-2xl px-5 py-5',",
    test: TEST,
    why: '대표 "양쪽 공백 왜 이렇게 두는거야" — 평면 판이라 바깥 여백과 겹친다.',
  },
  {
    name: '📏 지도 카드가 한 장일 때도 80% 로 왼쪽에 붙는다',
    file: 'src/pages/MyVouchersPage.tsx',
    find: "${mapCarousel.length === 1 ? 'w-full' : 'w-[80%] max-w-[300px]'}",
    replace: 'w-[80%] max-w-[300px]',
    test: TEST,
    why: '대표 "중앙정렬도 안 되어 있어".',
  },
]
