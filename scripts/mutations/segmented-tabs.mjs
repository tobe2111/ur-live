/**
 * 🧭 탭 라벨 두 줄 접힘 — 되돌려-검증 주입 (2026-10-06).
 */
export default [
  {
    name: '🧭 탭 라벨이 다시 줄바꿈을 허용한다',
    file: 'src/components/ui/segmented-tabs.tsx',
    find: 'gap-1 whitespace-nowrap rounded-lg',
    replace: 'gap-1 rounded-lg',
    test: 'src/tests/unit/segmented-tabs-2026-10-06.test.ts',
    why: '좁은 폰에서 "판매 중지 0" 이 다시 두 줄로 접힌다 — 대표가 근본 해결을 지시한 그 모양.',
  },
  {
    name: '🧭 탭 칸을 다시 똑같이 나눈다 (글자보다 좁아질 수 있음)',
    file: 'src/components/ui/segmented-tabs.tsx',
    find: "style={{ flex: '1 0 auto' }}",
    replace: "style={{ flex: '1 1 0%' }}",
    test: 'src/tests/unit/segmented-tabs-2026-10-06.test.ts',
    why: '긴 라벨("판매 중지")만 손해를 본다 — 칸이 글자보다 좁아지면 nowrap 이어도 글자가 칸 밖으로 넘친다.',
  },
  {
    name: '🧭 이용권 관리 탭을 다시 손으로 그린다',
    file: 'src/pages/SellerGroupBuyPage.tsx',
    find: '        <SegmentedTabs<Seg>',
    replace: '        <SegmentedTabsRemoved<Seg>',
    test: 'src/tests/unit/segmented-tabs-2026-10-06.test.ts',
    why: '부품을 빠져나가면 다음에 누가 칸 여백을 고치는 순간 같은 결함이 그 화면에서만 돌아온다.',
  },
]
