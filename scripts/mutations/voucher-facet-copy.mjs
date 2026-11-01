/**
 * 🏷️ 교환권 facet 문구 — 주입 매니페스트 (2026-10-18 등록).
 * 가드: src/tests/unit/voucher-facet-copy-2026-10-18.test.ts
 */
export default [
  {
    name: '🏷️ 교환권 facet 이 다시 기본 문구에 값만 붙인다 (20개가 같은 브랜드 나열)',
    file: 'src/shared/seo/consumer-surface-table.ts',
    find: "    facetDescription: '{v} 기프티콘 교환권을 할인가로 사세요. 결제하면 바로 발송되고, 유효기간 안에 매장에서 쓰면 됩니다.',\n",
    replace: '',
    test: 'src/tests/unit/voucher-facet-copy-2026-10-18.test.ts',
    why: '편의점 페이지 설명이 "편의점: 스타벅스·메가MGC커피·GS25…" 가 된다 — 사실이 아니고, 20페이지가 같은 설명으로 색인을 다툰다.',
  },
  {
    name: '🏷️ 교환권 facet 에서 카테고리가 브랜드를 이긴다',
    file: 'src/shared/seo/consumer-surfaces.ts',
    find: '    const facet = brand || category\n',
    replace: '    const facet = category || brand\n',
    test: 'src/tests/unit/voucher-facet-copy-2026-10-18.test.ts',
    why: '2026-09-02 에 잠근 "브랜드가 카테고리보다 우선" — 브랜드 칩 딥링크(?brand=)의 제목이 카테고리로 바뀐다.',
  },
  {
    name: '🏷️ 교환권 클라 SEO 가 다시 정본을 /vouchers 로 박는다',
    file: 'src/pages/VouchersPage.tsx',
    find: "vouchersSeo = { title: vSeo.title, description: vSeo.description, url: vSeo.canonical }",
    replace: "vouchersSeo = { title: vSeo.title, description: vSeo.description, url: '/vouchers' }",
    test: 'src/tests/unit/voucher-facet-copy-2026-10-18.test.ts',
    why: 'JS 를 렌더하는 구글이 facet 20개(?category=…)의 정본을 /vouchers 로 읽어 하나로 통합한다 — 서버는 각자를 정본으로 선언하는데 클라가 반대 신호를 낸다.',
  },
]
