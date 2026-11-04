/** 🧬 주입 — 쇼핑(/browse) 폐기(2026-11-04 대표 "없애줄 수 있나? 구글에서도 쇼핑 안 떴으면"). 가드: src/tests/unit/consumer-redirects.test.ts */
const TEST = 'src/tests/unit/consumer-redirects.test.ts'
export default [
  {
    name: '🛍️ /browse 가 다시 살아난다(301 빠짐 — 구글에 쇼핑 줄)',
    file: 'src/shared/seo/consumer-redirects.ts',
    find: "  '/browse': '/vouchers',\n",
    replace: '',
    test: TEST,
    why: '쇼핑 탭은 숨김인데 주소가 200 으로 살아 검색결과에 "쇼핑" 이 뜬다.',
  },
]
