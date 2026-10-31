/** 🧬 주입 — 상세 사진 위 매장 영상 버튼(2026-10-26). 가드: src/tests/unit/store-shorts-pill-2026-10-26.test.tsx */
const T = 'src/tests/unit/store-shorts-pill-2026-10-26.test.tsx'
export default [
  {
    name: 'store-shorts — 다른 이용권 영상까지 고른다',
    file: 'src/shared/urshorts-store.ts',
    find: 'Number(x?.product_id) === id && ',
    replace: '',
    test: T,
    why: '남의 가게 영상이 이 이용권 위에 뜬다.',
  },
  {
    name: 'store-shorts — PC 에서 버튼이 대형 사진 버튼 안으로 들어간다',
    file: 'src/pages/group-buy/DetailGallery.tsx',
    find: "            {!has && fallback}\n",
    replace: "            {!has && fallback}\n            {overlay}\n",
    test: T,
    why: '버튼 안 링크 — 누르면 사진 크게 보기와 영상 이동이 같이 일어난다.',
  },
  {
    name: 'store-shorts — 숙소 상세 배선이 빠진다',
    file: 'src/pages/StayDetailPage.tsx',
    find: '            overlay={<StoreShortsPill productId={stay.id} />}\n',
    replace: '',
    test: T,
    why: '숙소에 붙인 매장 영상이 안 보인다.',
  },
]
