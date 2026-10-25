// 🏋️ 2026-10-25 글자 굵기 체계 — 400·500·700(+ 디스플레이 800). 시험이 실제로 빨간불을 내는가.
const T = 'src/tests/unit/weight-scale-2026-10-25.test.ts'
export default [
  {
    name: '🏋️ 교환권 타일 브랜드 줄이 다시 굵어진다(13px bold)',
    file: 'src/shared/voucher-tile.ts',
    find: "self-start text-[12px] text-gray-500",
    replace: "self-start text-[12px] font-bold text-gray-500",
    test: T,
    why: '작은 글자를 굵게 하면 뭉친다 — 교환권 화면이 굵은 글자 73% 였던 원인 중 하나.',
  },
  {
    name: '🏋️ 이행 화면에 600(semibold)이 돌아온다',
    file: 'src/pages/group-buy/PassHeadCard.tsx',
    find: '<span className="text-[28px] font-bold tracking-[-.02em]"',
    replace: '<span className="text-[28px] font-semibold tracking-[-.02em]"',
    test: T,
    why: '세 단계 체계에서 600 은 없다 — 섞이면 굵기가 네 단계가 되어 다시 위계가 흐려진다.',
  },
  {
    name: '🏋️ 인라인 style 의 800 을 못 본다',
    file: 'src/pages/group-buy/DealPurchaseBox.tsx',
    find: "fontSize: 15, fontWeight: 700, color: 'var(--gbd-ink)' }} aria-live",
    replace: "fontSize: 15, fontWeight: 800, color: 'var(--gbd-ink)' }} aria-live",
    test: T,
    why: '이용권 상세 부품 다수가 인라인 style 이다 — 그걸 못 보면 체계 밖 굵기가 조용히 남는다.',
  },
  {
    name: '🏋️ 변환이 여러 줄 백틱을 놓친다',
    file: 'scripts/codemods/weight-scale.mjs',
    find: '|(`)((?:[^`\\\\]|\\\\.)*)`/g',
    replace: '|(`)((?:[^`\\\\\\n]|\\\\.)*)`/g',
    test: T,
    why: '첫 판이 실제로 그랬다 — 카테고리 칩 20개가 굵은 채 남았는데 변환은 "0건" 이었다.',
  },
]
