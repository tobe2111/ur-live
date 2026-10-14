/**
 * 되돌려-검증 주입 — 가게 유어샵(`/s/:username`)의 구조화 데이터 (2026-10-14).
 *
 * 이 처방이 무너지는 방향은 **셋이고 전부 조용하다**:
 *   · 배선이 빠지면 → 빌더는 남아 있는데 **아무도 안 부른다**(이 레포가 반복해 당한 조용한 부재).
 *   · 종류가 틀리면 → 구글이 가게를 **사람**으로 적재한다(에러 0 · 더 나쁜 쪽).
 *   · 넓어지면 → 없는 SNS 계정·빈 목록·noindex URL 을 선언한다(지어내기 — 가장 비싼 쪽).
 * 그래서 절반을 반대 방향으로 심는다.
 */
const LD = 'src/worker/utils/surface-list-jsonld.ts'
const W = 'src/worker/index.ts'
const T = 'src/tests/unit/seller-shop-jsonld-2026-10-14.test.ts'

export default [
  {
    name: '🏪 가게 유어샵 — 배선을 뺀다(빌더는 남고 아무도 안 부른다 = 2026-10-14 이전 상태)',
    file: W,
    find: 'if (sellerMeta) rb = applySurfaceMeta(rb, { ...sellerMeta, jsonLd: buildSellerShopJsonLd(ssrPayload, origin2, sellerMeta) });',
    replace: 'if (sellerMeta) rb = applySurfaceMeta(rb, sellerMeta);',
    test: T,
    why: '앞으로 등록되는 모든 매장의 유어샵이 사이트 전역 브랜드 노드만 받는다 — 빵부스러기도 진열도 없다.',
  },
  {
    name: '🏪 가게 유어샵 — mainEntity 를 Person 으로(가게를 사람으로 적재한다)',
    file: LD,
    find: "    const org: Record<string, unknown> = { '@type': 'Organization', name, url: meta.canonical }",
    replace: "    const org: Record<string, unknown> = { '@type': 'Person', name, url: meta.canonical }",
    test: T,
    why: '형제(개인 유어샵)를 베끼면 이렇게 된다 — 클라가 이미 그 실수를 하고 있다(잠금 파일이라 별건).',
  },
  {
    name: '🏪 가게 유어샵 — 빵부스러기에 `유어샵` 단계를 끼운다(`/s` 라는 없는 URL)',
    file: LD,
    find: "    const trail = withCrumbRoot(origin, [{ name, url: meta.canonical }])\n    const nodes: Array<Record<string, unknown>> = [\n      breadcrumbNode(trail, meta.canonical),\n      {\n        '@type': 'ProfilePage',",
    replace: "    const trail = withCrumbRoot(origin, [{ name: '유어샵', url: `${origin}/s` }, { name, url: meta.canonical }])\n    const nodes: Array<Record<string, unknown>> = [\n      breadcrumbNode(trail, meta.canonical),\n      {\n        '@type': 'ProfilePage',",
    test: T,
    why: '중간 단계를 넣으면 그럴듯한데 그 URL 이 없다 — 형제 빌더가 `/u` 로 같은 함정을 적어 뒀다.',
  },
  {
    name: '🏪 가게 유어샵 — 항목 URL 을 손으로 조립한다(정본 SSOT 우회)',
    file: LD,
    find: "    const items = (Array.isArray(sp?.products) ? sp!.products! : [])\n      .map((p, i) => listItem(p, i + 1, origin))",
    replace: "    const items = (Array.isArray(sp?.products) ? sp!.products! : [])\n      .map((p, i) => p?.id == null ? null : ({ '@type': 'ListItem', position: i + 1, url: `${origin}/products/${p.id}` }))",
    test: T,
    why: '`canonicalDetailPath` 를 안 지나면 이용권을 `/products/:id` 로 제출한다 — 정본이 둘이 되고 교환권 제외도 사라진다.',
  },
  {
    name: '🔵 반대 — 진열이 없어도 ItemList 를 낸다(빈 목록을 선언한다)',
    file: LD,
    // 🩸 앵커가 **형제 빌더(`buildCuratorJsonLd`)와 글자까지 같아서** 2곳에 맞았다 — 둘 다 같은
    //    `if (items.length)` + 같은 `유어샵 진열` 이름을 쓴다. `mainEntity: org,`(가게 전용)부터
    //    묶어 유일 앵커로. ⇒ **같은 틀을 베껐으면 주입 앵커도 겹친다**고 전제할 것.
    find: "        mainEntity: org,\n      },\n    ]\n    if (items.length) {",
    replace: "        mainEntity: org,\n      },\n    ]\n    if (true) {",
    test: T,
    why: '"일관성" 을 이유로 항상 내고 싶어진다 — 빈 목록은 "진열이 있는데 비었다" 로 읽힌다(지어내기).',
  },
  {
    name: '🔵 반대 — sameAs 를 항상 낸다(없는 계정을 가리킨다)',
    file: LD,
    find: '    if (sameAs.length) org.sameAs = sameAs',
    replace: '    org.sameAs = sameAs',
    test: T,
    why: '빈 배열·null 을 그대로 내면 엔티티 결합 신호가 거짓이 된다 — 2026-10-14 `twitter:site` 결재와 같은 클래스.',
  },
  {
    name: '🔵 반대 — 스킴 검사를 없앤다(`ftp://`·아무 문자열이 sameAs 로)',
    file: LD,
    find: "      .filter(v => /^https?:\\/\\//.test(v))",
    replace: '      .filter(v => !!v)',
    test: T,
    why: '어드민 입력이 그대로 구조화 데이터에 실린다 — 검증 없이 외부 주장을 발행하는 것이다.',
  },
  {
    name: '🔵 반대 — 이름이 없어도 노드를 낸다(빈 가게명으로 발행)',
    file: LD,
    find: "    const name = String(sp?.name || sp?.business_name || '').trim()\n    if (!name) return ''",
    replace: "    const name = String(sp?.name || sp?.business_name || '').trim()",
    test: T,
    why: '이름 없는 `Organization` 과 빈 빵부스러기가 나간다 — `\'\'`(미주입)이 종전 동작이고 더 안전하다.',
  },
]
