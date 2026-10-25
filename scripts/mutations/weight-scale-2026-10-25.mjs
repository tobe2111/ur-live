// 🏋️ 2026-10-25 글자 굵기 체계 — 400·500·700(+ 디스플레이 800). 시험이 실제로 빨간불을 내는가.
const T = 'src/tests/unit/weight-scale-2026-10-25.test.ts'
export default [
  {
    name: '🏋️ 교환권 타일 브랜드 줄이 다시 굵어진다(13px bold)',
    file: 'src/shared/voucher-tile.ts',
    find: "self-start text-[13px] font-medium text-gray-900",
    replace: "self-start text-[13px] font-bold text-gray-900",
    test: T,
    why: '작은 글자를 굵게 하면 뭉친다 — 교환권 화면이 굵은 글자 73% 였던 원인 중 하나.',
  },
  {
    name: '🏋️ 이행 화면에 600(semibold)이 돌아온다',
    file: 'src/pages/group-buy/PassOptionCard.tsx',
    find: 'className="m-0 mb-3 px-1 text-[17px] font-bold"',
    replace: 'className="m-0 mb-3 px-1 text-[17px] font-semibold"',
    test: T,
    why: '세 단계 체계에서 600 은 없다 — 섞이면 굵기가 네 단계가 되어 다시 위계가 흐려진다.',
  },
  {
    name: '🏋️ 인라인 style 의 800 을 못 본다',
    file: 'src/pages/group-buy/DealPurchaseBox.tsx',
    find: "fontSize: 14, fontWeight: 700, color: 'var(--gbd-ink)' }} aria-live",
    replace: "fontSize: 14, fontWeight: 800, color: 'var(--gbd-ink)' }} aria-live",
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
  {
    name: '🏋️ 옵션 카드 안쪽 이름이 다시 bold — 굵은 제목이 둘',
    file: 'src/pages/group-buy/PassOptionCard.tsx',
    find: 'text-[17px] font-medium leading-[1.35]',
    replace: 'text-[17px] font-bold leading-[1.35]',
    test: T,
    why: '한 덩어리에 굵은 제목은 하나 — 크기 규칙으로는 못 잡는 역할 규칙이라 따로 고정한다.',
  },
]
