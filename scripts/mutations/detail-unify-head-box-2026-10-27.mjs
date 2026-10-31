/** 🧬 주입 — 상세 통일 3·4단계(2026-10-27). 가드: src/tests/unit/detail-unify-head-box-2026-10-27.test.tsx */
const T = 'src/tests/unit/detail-unify-head-box-2026-10-27.test.tsx'
export default [
  {
    name: 'detail-unify-head-box — 숙소 섹션 띠가 다시 바탕색이 된다',
    file: 'src/shared/stay-head.ts',
    find: "border-t border-rule bg-surface lg:bg-transparent",
    replace: "border-t border-rule lg:bg-transparent",
    test: T,
    why: '이용권은 흰 면, 숙소는 바탕색 — 같은 앱의 두 상세가 다른 종이처럼 보인다.',
  },
  {
    name: 'detail-unify-head-box — PC 숙소 패널에서 추첨 상품도 예약 버튼이 뜬다',
    file: 'src/pages/stay-detail/StayBookingPanel.tsx',
    find: '      {raffle ? (\n        <button type="button" onClick={raffle.onApply}',
    replace: '      {false && raffle ? (\n        <button type="button" onClick={raffle!.onApply}',
    test: T,
    why: '당첨 전 손님이 예약 창으로 간다 — 폰은 응모인데 PC 만 예약.',
  },
  {
    name: 'detail-unify-head-box — 숙소 제목이 다시 작아진다',
    file: 'src/shared/stay-head.ts',
    find: "  h1: 'text-[24px] leading-[1.3] font-bold tracking-[-.02em]',",
    replace: "  h1: 'text-[17px] lg:text-[24px] font-bold',",
    test: T,
    why: '이용권 상세 제목과 크기가 갈린다.',
  },
]
