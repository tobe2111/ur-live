/**
 * 🖼️🔎 상품 사진 alt + 교환권 noindex 근거 (2026-10-12, 대표 "모두 다 진행해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/voucher-noindex-and-image-alt-2026-10-12.test.ts
 *
 * 두 결함 다 **에러가 안 난다** — 빈 alt 은 화면이 멀쩡하고, noindex 를 뒤집어도 빌드가 통과한다.
 */
const TEST = 'src/tests/unit/voucher-noindex-and-image-alt-2026-10-12.test.ts'

export default [
  {
    name: '🖼️ DealRow 사진이 다시 빈 alt — 여섯 화면이 한꺼번에 되돌아간다',
    file: 'src/components/deal/DealRow.tsx',
    find: '            alt={autoAlt}',
    replace: '            alt=""',
    test: TEST,
    why: 'sitemap 이 그 사진을 `image:image` 로 359건 제출한다 — 무엇인지 안 말하면 구글 이미지가 못 읽는다.',
  },
  {
    name: '🖼️ 파생값을 계산만 하고 안 쓴다 (`false &&`)',
    file: 'src/components/deal/DealRow.tsx',
    find: "const autoAlt = typeof title === 'string' ? title : ''",
    replace: "const autoAlt = false && typeof title === 'string' ? title : ''",
    test: TEST,
    why: '계산과 사용은 다른 자리다 — 값은 멀쩡히 남고 결과만 비어진다(이 레포가 `goneStatus` 에서 밟은 함정).',
  },
  {
    name: '🖼️ 유어샵 React 와 워커가 갈린다 — 마운트 때 alt 이 바뀐다',
    file: 'src/worker/utils/curator-ssr-body.ts',
    find: 'alt="${escAttr(pin.product_name || \'\')}"',
    replace: 'alt=""',
    test: TEST,
    why: '한쪽만 고치면 서버가 준 alt 이 마운트 때 사라진다 — 화면은 안 깨지고 크롤러만 영향을 받는다.',
  },
  {
    name: '🖼️ 워커 alt 이 이스케이프를 건너뛴다 — 상품명이 속성을 탈출한다',
    file: 'src/worker/utils/curator-ssr-body.ts',
    find: 'alt="${escAttr(pin.product_name || \'\')}"',
    replace: 'alt="${pin.product_name || \'\'}"',
    test: TEST,
    why: '상품명은 셀러-제어 값이다(2026-06-26 OG 인젝션 차단과 같은 클래스).',
  },
  {
    name: '🖼️ 반대 방향 — 마스코트에 설명을 붙인다',
    // 🔴 마스코트는 `curator-ssr-body` 가 아니라 **워커의 정적 로더**(index.ts)에 있다.
    //    여기를 틀리면 주입이 "대상 못 찾음" 으로 조용히 넘어가 반대 방향이 안 지켜진다.
    file: 'src/worker/index.ts',
    find: 'alt="" aria-hidden="true"',
    replace: 'alt="유달이 마스코트" aria-hidden="true"',
    test: TEST,
    why: '장식 이미지의 빈 alt 은 **맞는 값**이다 — 설명을 붙이면 스크린리더가 장식을 읽는다. "모든 img 에 alt" 로 넘어가는 것을 막는다.',
  },
  {
    name: '🔎 교환권 상세가 색인 가능해진다 (클라)',
    file: 'src/pages/VoucherDetailPage.tsx',
    find: 'url={`/vouchers/${product.id}`} noindex />',
    replace: 'url={`/vouchers/${product.id}`} />',
    test: TEST,
    why: '활성 2,260건 중 91%가 정가다 — 같은 SKU·같은 설명·우리만의 가격조차 없는 2,065장을 색인에 넣으면 사이트 전체 품질 신호를 건다.',
  },
  {
    name: '🔎 서버만 색인 가능해진다 — 클라와 신호가 갈린다',
    file: 'src/worker/utils/detail-ssr-meta.ts',
    find: "ogType: 'product', noindex: true, jsonLd: '' }",
    replace: "ogType: 'product', noindex: false, jsonLd: '' }",
    test: TEST,
    why: '한쪽만 뒤집히면 크롤러가 받는 신호와 렌더 후 신호가 달라진다 — 어느 쪽이 이기는지는 크롤러가 정한다.',
  },
  {
    name: '🔎 결정 근거의 숫자가 사라진다 — 다음 세션이 이유 없이 뒤집는다',
    file: 'src/pages/VoucherDetailPage.tsx',
    find: '            할인 보유            195건 (8.6%)  ← **2,065건(91%)이 정가**',
    replace: '            (측정 생략)',
    test: TEST,
    why: '이 결정은 **그 비율 하나**에 걸려 있다. 숫자가 없으면 "색인이 안 되고 있다" 만 보고 뒤집게 된다 — 2026-07-07 에 실제로 근거가 안 남아 그렇게 될 뻔했다.',
  },
  {
    name: '🔎 sitemap 이 교환권 상세를 제출한다 — noindex 와 모순',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: 'AND COALESCE(deal_only, 0) = 0',  // ⚠️ 쉼표 뒤 공백 — 소스와 byte-일치여야 한다
    replace: '',
    test: TEST,
    why: '색인하지 말라고 선언한 URL 을 "색인해 달라" 고 제출하면 서로 반대되는 신호다(크롤 예산도 2,260건만큼 샌다).',
  },
]
