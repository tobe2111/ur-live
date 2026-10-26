// 🛍️ 2026-10-25 유어샵 D안 — 가드가 실제로 실패할 수 있는지.
const T = 'src/tests/unit/ushop-d-2026-10-25.test.ts'
export default [
  {
    name: '유어샵D — 상품명이 다시 굵게',
    file: 'src/shared/ushop-row.ts',
    find: "line-clamp-2 font-medium text-gray-900",
    replace: "line-clamp-2 font-bold text-gray-900",
    test: T,
    why: '한 덩어리에 굵은 제목은 하나 — 줄의 굵은 글자는 가격이다(굵기 ⑨).',
  },
  {
    name: '유어샵D — 탭 전부 굵게(공용 클래스에 굵기)',
    file: 'src/shared/ushop-row.ts',
    find: "-mb-px border-b-2 text-[15px] whitespace-nowrap",
    replace: "-mb-px border-b-2 text-[15px] font-bold whitespace-nowrap",
    test: T,
    why: '선택만 굵어야 어느 탭인지 읽힌다(교환권 밑줄 탭과 같은 문법).',
  },
  {
    name: '유어샵D — 워커 첫 화면이 상품명을 손으로 적는다(두 벌)',
    file: 'src/worker/utils/curator-ssr-body.ts',
    find: '  rowTitle: PLAIN_CLS.title,',
    replace: "  rowTitle: 'text-[15px] leading-snug line-clamp-2 font-bold text-gray-900 dark:text-white',",
    test: T,
    why: '두 벌이면 마운트 때 상품명 굵기가 바뀌며 줄이 다시 그려진다.',
  },
]
