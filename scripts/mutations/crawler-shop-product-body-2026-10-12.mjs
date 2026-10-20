/**
 * 🛍️ 2026-10-12 — 유어샵·쇼핑 상세 크롤러 본문 주입.
 *
 * 시험: src/tests/unit/crawler-shop-product-body-2026-10-12.test.ts
 * 라이브 실측(그 시험 머리말): sitemap 이 제출한 유어샵·쇼핑 상세 7건 중 **6건이 본문 6자**.
 */
const NS = 'src/worker/utils/crawler-noscript.ts'
const WORKER = 'src/worker/index.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const TEST = 'src/tests/unit/crawler-shop-product-body-2026-10-12.test.ts'

export default [
  {
    name: '🛍️ 유어샵 폴백이 다시 로더뿐 — 첫 화면이 빈 경우가 전부 soft-404',
    why: '첫 화면 빌더는 세 경우에 `` 를 준다(사업자 유어샵 · 핀 0 · 파싱 실패). 폴백이 로더면 '
       + '그 URL 들은 sitemap 에 제출된 채 본문 6자가 된다 — 라이브에서 실제로 그랬다.',
    file: WORKER,
    find: 'curatorFirst || (curatorNoscriptFromPayload(ssrPayload) + urdealLoaderHtml)',
    replace: 'curatorFirst || urdealLoaderHtml',
    test: TEST,
  },
  {
    name: '🛍️ 폴백 경로에서 유어샵 이름을 뺀다 — 본문이 다시 빈다',
    why: '첫 화면이 없는 경로에서는 h1 이 없으므로 규율 ②의 전제가 사라진다. 이름을 빼면 '
       + '소개·진열이 없는 유어샵은 본문이 통째로 비고, 그게 원래 증상이었다.',
    file: NS,
    find: 'return buildCuratorNoscript(JSON.parse(ssrPayload) as NoscriptCuratorSeed, { withName: true })',
    replace: 'return buildCuratorNoscript(JSON.parse(ssrPayload) as NoscriptCuratorSeed)',
    test: TEST,
  },
  {
    name: '🛍️ 첫 화면이 그려지는 경로에도 이름을 넣는다 — 같은 말을 두 번',
    why: '반대 방향. 첫 화면의 h1 이 이미 이름을 말하므로(규율 ②) 그 경로의 요약에 이름을 넣으면 '
       + '중복이다 — 2026-10-12 og:image 항목이 지적한 "카드 안에 또 카드" 와 같은 클래스.',
    file: NS,
    // 🔁 2026-10-14 재조준 — 그 줄이 `standalone` 게이트 + `h1Of()` 로 바뀌었다(#87).
    //   불변식 그대로: **첫 화면이 이름을 말하는 경로에서 요약이 또 말하면 중복**이다.
    find: "const body = (standalone ? h1Of(name && `${name} 유어샵`) : '')",
    replace: "const body = (h1Of(name && `${name} 유어샵`) || '')",
    test: TEST,
  },
  {
    name: '🛍️ 핀이 비어도 사업자 진열을 안 본다 — `/u/user40` 이 다시 빈다',
    why: '사업자 유어샵은 핀이 0 이어도 `linked_seller_products` 에 진열이 있다. 그걸 안 읽으면 '
       + '사업자 유어샵 전부가 본문 없이 제출된다.',
    file: NS,
    find: 'const items = pins.length ? pins : (Array.isArray(seed.linked_seller_products) ? seed.linked_seller_products : [])',
    replace: 'const items = pins.length ? pins : ([] as never[])',
    test: TEST,
  },
  {
    name: '🛍️ 핀과 사업자 진열을 **합친다** — 같은 상품을 두 번 말한다',
    why: '반대 방향. user40 실측에서 둘이 같은 상품(id 2917)이었다 — 합치면 요약이 같은 줄을 '
       + '두 번 낸다(크롤러가 중복으로 읽는다).',
    file: NS,
    find: 'const items = pins.length ? pins : (Array.isArray(seed.linked_seller_products) ? seed.linked_seller_products : [])',
    replace: 'const items = pins.concat(Array.isArray(seed.linked_seller_products) ? [] : [])\n    .concat((Array.isArray(seed.linked_seller_products) ? seed.linked_seller_products : [])\n      .filter((x): x is NonNullable<NoscriptCuratorSeed[\'linked_seller_products\']>[number] & object => !!x)\n      .map((pr) => row(pr.name || \'\', pr.restaurant_name, pr.price))\n      .filter(Boolean)) as string[]\n  const _unused = (Array.isArray(seed.linked_seller_products) ? seed.linked_seller_products : [])',
    test: TEST,
  },
  {
    name: '🛍️ 이름만 남는 유어샵도 본문을 낸다 — 측정만 좋아 보인다',
    why: '`<title>` 이 이미 그 이름을 말한다. 이름만 적으면 글자수는 늘지만 thin 인 사실은 그대로이고, '
       + '그러면 sitemap 을 조일 근거가 흐려진다(재료 없는 URL 을 계속 제출하게 된다).',
    file: NS,
    find: "  if (!bio && !items.length) return ''",
    replace: '',
    test: TEST,
  },
  {
    name: '🛒 쇼핑 상세 요약을 아예 안 낸다',
    why: '라이브 `/products/2917` 이 `index, follow` + sitemap 제출인데 본문 6자였다. 시드는 이미 와 있다.',
    file: NS,
    find: '  const prodId = path.match(/^\\/products\\/(\\d+)$/)?.[1]',
    replace: '  const prodId = null as string | null',
    test: TEST,
  },
  {
    name: '🛒 cross-canonical 게이트 제거 — 정본 아닌 URL 을 키운다',
    why: '이용권·숙소는 `/products/:id` 로도 닿지만 정본은 `/pass`·`/stays` 이고 거기엔 서버 첫 화면이 '
       + '이미 있다. 사본에 본문을 키우면 같은 상품의 두 URL 이 서로 경쟁한다.',
    file: NS,
    find: "if (canonicalDetailPath({ id: prodId, deal_only: d.deal_only, category: d.category }) != null) return ''",
    replace: 'if (false) return \'\'',
    test: TEST,
  },
  {
    name: '🛒 가게·주소·전화를 요약에 넣는다 — 클로킹',
    why: '`ProductDetailPage` 는 그 줄을 `category === \'meal_voucher\'` 일 때만 그린다(실측 :647). '
       + '`lifestyle` 상품의 응답에도 그 필드가 담겨 오므로, 넣으면 **화면에 없는 말**을 크롤러에게 준다.',
    file: NS,
    find: "        desc ? esc(desc) : '',\n      ]))",
    replace: "        desc ? esc(desc) : '',\n        d.restaurant_name ? `${esc(String(d.restaurant_name))} ${esc(String(d.restaurant_phone || ''))}` : '',\n      ]))",
    test: TEST,
  },
  {
    name: '🗺️ sitemap 핀 기준을 **행 존재**로 되돌린다 — "핀이 있다 ≠ 보인다"',
    why: '종전 상태가 정확히 이것이었다. `product_pins` 행만 세면 비활성·도매 원본 핀을 가진 유어샵이 '
       + '제출되고 크롤러는 로더만 받는다(`/u/user31`·`/u/jongmun` 실측).',
    file: SITEMAP,
    find: `            AND EXISTS (SELECT 1 FROM product_pins pp JOIN products pq ON pq.id = pp.product_id
                         WHERE pp.user_id = u.id AND pq.is_active = 1
                           AND \${consumerVisibleProductSql('pq')})`,
    replace: '            AND EXISTS (SELECT 1 FROM product_pins pp WHERE pp.user_id = u.id)',
    test: TEST,
  },
  {
    name: '🗺️ sitemap 핀 기준에서 도매 원본 제외만 뺀다 — `/u/jongmun` 이 되살아난다',
    why: '`is_active` 만으로는 부족하다. jongmun 의 핀은 **활성**인 도매 원본(`Canvas Tote Bag`)이고 '
       + '소비자 API 어디에도 없어 클릭하면 404 다(`consumer-visible-product.ts` 머리말).',
    file: SITEMAP,
    find: `                         WHERE pp.user_id = u.id AND pq.is_active = 1
                           AND \${consumerVisibleProductSql('pq')})`,
    replace: '                         WHERE pp.user_id = u.id AND pq.is_active = 1)',
    test: TEST,
  },
  {
    name: '🗺️ 판매사 재판매 복제본까지 막는다 — 반대 방향(멀쩡한 유어샵이 색인에서 빠진다)',
    why: '도매 **원본**만 가려야 한다. 복제본(`supply_source_id` 있음)은 소비자에게 정상 노출되는 '
       + '상품이라, 그걸 막으면 제출해야 할 유어샵이 빠지고 색인은 돌아오는 데 수주다.',
    file: SITEMAP,
    find: `                         WHERE pp.user_id = u.id AND pq.is_active = 1
                           AND \${consumerVisibleProductSql('pq')})`,
    replace: `                         WHERE pp.user_id = u.id AND pq.is_active = 1
                           AND COALESCE(pq.is_supply_product,0) = 0)`,
    test: TEST,
  },
  {
    name: '🗺️ 도매 원본 제외를 **인라인 사본**으로 되돌린다 — 드리프트 재발',
    why: '`consumer-visible-product.ts` 머리말이 *"같은 술어가 sitemap 에 인라인으로 복사돼 있다 … '
       + '다음에 만질 때 이 상수로 모으면 된다"* 고 적어 둔 자리다. 사본이 생기면 한 곳이 반드시 빠진다.',
    file: SITEMAP,
    find: `           AND group_buy_status IN ('active','achieved')
           AND \${consumerVisibleProductSql('products')}\${productScope}`,
    replace: `           AND group_buy_status IN ('active','achieved')
           AND NOT (COALESCE(is_supply_product,0) = 1 AND COALESCE(supply_source_id,0) = 0)\${productScope}`,
    test: TEST,
  },
]
