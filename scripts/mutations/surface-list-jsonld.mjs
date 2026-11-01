/**
 * 🔎 목록·유어샵 구조화 데이터 (2026-10-11 대표 *"세계최고의 SEO, GEO를 자랑하게"*) — 주입 매니페스트.
 * 가드: src/tests/unit/surface-list-jsonld-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/surface-list-jsonld-2026-10-11.test.ts'
const B = 'src/worker/utils/surface-list-jsonld.ts'
const TABLE = 'src/shared/seo/consumer-surface-table.ts' // 🗂️ 2026-11-01 표 분리(불변식 불변 — 대상 파일만 옮겨갔다)
const WORKER = 'src/worker/index.ts'

export default [
  {
    name: '🧾 교환권(noindex 상세)을 ItemList 에 섞는다',
    file: B,
    find: "  if (Number(p.deal_only) === 1) return null",
    replace: "  if (Number(p.deal_only) === 99) return null",
    test: TEST,
    why: '색인하지 말라고 한 URL 을 "이 목록의 항목" 으로 제출하면 서로 반대되는 신호를 보낸다 — 에러는 안 난다.',
  },
  {
    // 🩸 이 주입이 **두 번** 헛돌았다. ① 시험 픽스처가 시드를 전부 `deal_only=1` 로 둬서 항목이
    //    어차피 걸러졌다 ② 고친 뒤엔 규칙을 "슬롯 허용목록 + 경로 차단목록" **두 겹**으로 짜서,
    //    한 겹을 없애도 다른 겹이 같은 결과를 냈다. ⇒ 규칙을 **한 줄**(경로 허용목록)로 모았다.
    //    교훈: **중복 잠금은 각 잠금을 출력으로 판정할 수 없게 만든다.**
    name: '🧾 `/vouchers` 가 항목 허용목록에 들어간다(교환권 상세는 noindex 인데)',
    file: B,
    // 🏨 2026-10-12 재조준: 허용목록에 `/stays` 가 들어갔다(그 상세는 색인 대상이다).
    // 🗺️ 2026-10-14 재조준: `/map` 도 들어갔다. **결함은 두 번 다 그대로** — 교환권을 더해
    //   noindex 상세를 목록 항목으로 제출한다. 허용목록은 자라므로 이 앵커는 또 낡을 것이고,
    //   그때도 지우지 말고 `, '/vouchers'` 를 더하는 형태로 재조준할 것.
    find: "  const ITEM_PATHS = new Set(['/', '/browse', '/stays', '/map'])",
    replace: "  const ITEM_PATHS = new Set(['/', '/browse', '/stays', '/map', '/vouchers'])",
    test: TEST,
    why: '교환권 상세는 2026-07-07 결정으로 noindex 다. 목록이 그 URL 들을 항목으로 내밀면 안 된다.',
  },
  {
    // 🗺️ 2026-10-14 — `/map` 은 크롤러 본문에서 **이미 그 항목들을 링크하고 있었는데**
    //   `ItemList` 만 0건이었다(라이브 실측 `<a href="/pass/…">` 8건). 그 누락으로 되돌린다.
    name: '🗺️ `/map` 을 항목 허용목록에서 뺀다(링크는 있는데 구조화 신호만 0건으로 회귀)',
    file: B,
    find: "'/browse', '/stays', '/map'])",
    replace: "'/browse', '/stays'])",
    test: TEST,
    why: '본문이 링크하는 항목을 "이 목록의 항목" 이라고 말하지 않으면 리치결과 후보에서 빠진다 — 에러는 안 난다.',
  },
  {
    name: '🧾 항목 허용목록이 사라진다(아무 표면이나 항목을 낸다)',
    file: B,
    find: "  const items = ITEM_PATHS.has(path)",
    replace: "  const items = true",
    test: TEST,
    why: '시드 모양을 모르는 표면이 쓰레기 항목을 내거나 noindex 상세를 가리키게 된다.',
  },
  {
    name: '🧾 끝 슬래시 정규화를 뺀다(`/browse/` 가 빵부스러기도 항목도 못 받는다)',
    file: B,
    find: "  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname",
    replace: "  const path = pathname",
    test: TEST,
    why: '`resolveConsumerSurfaceSeo` 는 이미 떼고 찾는다 — 여기서 안 떼면 같은 페이지가 메타는 받고 구조화 데이터는 못 받는다.',
  },
  {
    name: '🧾 항목 URL 을 손으로 만든다(`canonicalDetailPath` SSOT 우회)',
    file: B,
    find: "  const path = canonicalDetailPath({ id, deal_only: p.deal_only, category: p.category }) ?? `/products/${id}`",
    replace: "  const path = `/group-buy/${id}`",
    test: TEST,
    why: '두 벌이 갈리면 같은 상품을 두 URL 로 제출하게 되고 그게 곧 중복 신호다(`/group-buy/:id` 는 301 자리다).',
  },
  {
    name: '🧾 position 재매김을 뺀다(교환권을 걸러낸 자리에 번호 구멍이 남는다)',
    file: B,
    find: "        .map((x, i) => ({ ...x, position: i + 1 }))\n    : []",
    replace: "    : []",
    test: TEST,
    why: 'ItemList 의 position 은 1..N 연속이어야 한다 — 구멍이 나면 구글이 목록을 통째로 버린다.',
  },
  {
    name: '🧾 noindex 표면(`/search`)에도 구조화 데이터를 낸다',
    file: B,
    find: "  if (meta.noindex) return ''",
    replace: "  if (false) return ''",
    test: TEST,
    why: '색인하지 말라면서 리치결과를 달라고 하는 셈이다.',
  },
  {
    name: '🧾 사진을 상대 경로 그대로 낸다',
    file: B,
    find: "  if (/^https?:\\/\\//i.test(v)) return v\n  return v.startsWith('/') ? `${origin}${v}` : null",
    replace: "  return v",
    test: TEST,
    why: '구조화 데이터의 `image` 는 절대 URL 이어야 한다 — 상대 경로면 구글이 그 필드를 버리고 **에러는 안 난다**(유어샵 핀이 실제로 `/api/media/...` 로 온다).',
  },
  {
    name: '🧾 리뷰 0건에 평점을 낸다(평점 0점짜리 상품이라고 말한다)',
    file: B,
    find: "  if (rc > 0 && rv > 0) {",
    replace: "  if (rc >= 0 && rv >= 0) {",
    test: TEST,
    why: '0건에 `ratingValue: 0` 은 구글 정책 위반이고, 2026-10-11 #1712 이 상세에서 같은 것을 고쳤다.',
  },
  {
    name: '🧾 가격 0 에도 offers 를 낸다(0원 상품)',
    file: B,
    find: "  if (Number.isFinite(price) && price > 0) {",
    replace: "  if (Number.isFinite(price)) {",
    test: TEST,
    why: '가격을 모르는 것과 0원인 것은 다르다.',
  },
  {
    name: '🛍️ 유어샵 진열 순서를 SSOT 대신 원래 순서로',
    file: B,
    find: "    const items = (Array.isArray(pins) ? curatorHomePins(pins) : [])",
    replace: "    const items = (Array.isArray(pins) ? pins : [])",
    test: TEST,
    why: '순번은 SNS 에서 "N번 이용권" 으로 부르는 **주소**다(`curator-pin-order.ts` 머리말) — 두 벌이면 에러가 아니라 거짓말이 된다.',
  },
  {
    name: '🛍️ 유어샵 빵부스러기에 없는 `/u` 단계를 넣는다',
    file: B,
    // 🔀 2026-10-14 재조준 ① — 루트를 `withCrumbRoot` 가 붙이게 되어(상세 빌더 셋과 같은 함수)
    //   손으로 적던 루트 줄이 사라졌다. 결함(없는 `/u` 단계)과 불변식은 한 글자도 안 바꿨다.
    // 🩸 재조준 ② (같은 날) — 같은 파일에 **가게 유어샵 빌더**(`buildSellerShopJsonLd`, #80)가
    //   생기면서 이 한 줄이 **두 곳에 맞게** 됐다(같은 틀을 베꼈으니 같은 줄이 생긴다).
    //   ⇒ 개인 유어샵 전용인 `person` 줄과 묶어 유일 앵커로. **같은 틀을 복제하면 주입 앵커도
    //   겹친다**고 전제할 것 — 이 세션에서 내 새 주입도 똑같이 걸렸다.
    find: "    const trail = withCrumbRoot(origin, [{ name, url: meta.canonical }])\n    const person:",
    replace: "    const trail = withCrumbRoot(origin, [{ name: '유어샵', url: `${origin}/u` }, { name, url: meta.canonical }])\n    const person:",
    test: TEST,
    why: '`/u` 는 라우트가 없다 — 빵부스러기가 404 를 가리키면 그 자체가 품질 신호를 깎는다.',
  },
  {
    name: '🧾 JSON 을 HTML escape 한다(JSON 이 깨진다)',
    file: B,
    find: "  return json.replace(/<\\//g, '<\\\\/')",
    replace: "  return json.replace(/<\\//g, '<\\\\/').replace(/&/g, '&amp;')",
    test: TEST,
    why: '`&amp;` 는 JSON 문자열이 아니다 — 블록 전체가 파싱 실패하고 구조화 데이터가 0건이 된다.',
  },
  {
    name: '🧾 목록 표면 배선이 사라진다(구조화 데이터 0건으로 회귀)',
    file: WORKER,
    find: "      if (sm) rb = applySurfaceMeta(rb, { ...sm, jsonLd: buildSurfaceListJsonLd(url.pathname, url.search, origin2, sm, crawlerPayload) });",
    replace: "      if (sm) rb = applySurfaceMeta(rb, sm);",
    test: TEST,
    why: '빌더가 멀쩡해도 배선이 빠지면 라이브는 종전 그대로다 — 2026-10-11 에 "파일에 있다 ≠ 크롤러가 받는다" 로 값을 치렀다.',
  },
  {
    name: '🛍️ 유어샵 배선이 사라진다',
    file: WORKER,
    find: "            jsonLd: buildCuratorJsonLd(ssrPayload, origin2, { title: cTitle, description: cDesc, canonical: canon }, cur),\n",
    replace: "",
    test: TEST,
    why: '같은 이유 — 유어샵은 공유해서 퍼지는 표면이라 구조화 데이터가 가장 비싼 자리다.',
  },
  {
    name: '🍞 noindex 표면에 빵부스러기 라벨을 준다',
    file: TABLE,
    find: "  '/search': {\n",
    replace: "  '/search': {\n    crumb: '검색',\n",
    test: TEST,
    why: 'noindex 표면에 리치결과용 라벨을 달면 그 표면이 조용히 구조화 데이터를 내게 된다.',
  },
  {
    name: '🍞 색인 표면의 빵부스러기 라벨을 뺀다',
    file: TABLE,
    find: "    crumb: '교환권',\n",
    replace: "",
    test: TEST,
    why: '라벨이 없으면 그 표면은 빵부스러기를 못 낸다 — 검색결과가 제목 아래에 생 URL 을 보여 준다.',
  },
]
