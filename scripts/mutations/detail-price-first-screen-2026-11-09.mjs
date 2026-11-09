/** 🧬 주입 — 상세 첫 화면 가격이 빠지거나 화면과 갈리면 빨간불인가. 가드: src/tests/unit/detail-price-first-screen-2026-11-09.test.tsx */
const T = 'src/tests/unit/detail-price-first-screen-2026-11-09.test.tsx'
export default [
  {
    name: '상세가격 — 서버가 가격을 안 그린다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: '      statsAndPriceHtml(d) +\n',
    replace: '',
    test: T,
    why: '폰에서 가격·구매 정보가 앱이 뜰 때(약 2초 뒤)까지 회색 상자로 남는다.',
  },
  {
    name: '상세가격 — 서버 가격 글자 크기가 화면과 갈린다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: '`<span class="${PASS_HEAD.priceNow}" style="color:var(--gbd-ink)">${formatNumber(unitPrice)}원</span>`',
    replace: '`<span class="text-[20px] font-bold" style="color:var(--gbd-ink)">${formatNumber(unitPrice)}원</span>`',
    test: T,
    why: '서버와 화면 글자 크기가 다르면 앱이 뜨는 순간 가격이 움찔한다.',
  },
]
