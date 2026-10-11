/**
 * 🔎 크롤러 가시성 (2026-10-11 대표 *"네이버도 해주고 … 특히 이용권 페이지들은 더욱"*) — 주입 매니페스트.
 * 가드: src/tests/unit/seo-crawler-visibility-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/seo-crawler-visibility-2026-10-11.test.ts'
const UA = 'src/shared/seo/crawler-ua.ts'
const NS = 'src/worker/utils/crawler-noscript.ts'
const META = 'src/worker/utils/detail-ssr-meta.ts'

export default [
  {
    name: '🔎 네이버 Yeti 를 크롤러 목록에서 뺀다(국내 검색이 다시 6자만 본다)',
    file: UA,
    find: '  /Yeti\\//i,',
    replace: '  /YetiDisabled\\//i,',
    test: TEST,
    why: '이 수리의 본체다 — Yeti 가 빠지면 네이버가 본문 6자짜리 페이지를 보던 상태로 돌아간다.',
  },
  {
    name: '🔎 크롤러 판정이 사람 브라우저까지 true 를 낸다(PC 에 모바일 첫 화면이 깔린다)',
    file: UA,
    find: '  for (const p of SEARCH_CRAWLER_UA_PATTERNS) if (p.test(s)) return true\n  return false',
    replace: '  for (const p of SEARCH_CRAWLER_UA_PATTERNS) if (p.test(s)) return true\n  return s.length > 0',
    test: TEST,
    why: 'PC 방문자에게 폰 레이아웃을 그리면 마운트 때 화면이 통째로 바뀐다 — 크롤러 판정은 좁아야 한다.',
  },
  {
    name: '🔎 첫 화면 조건이 크롤러만 보고 폰을 빼먹는다',
    file: UA,
    find: '  return isMobileUserAgent(ua) || isSearchCrawlerUA(ua)',
    replace: '  return isSearchCrawlerUA(ua)',
    test: TEST,
    why: '폰 사용자가 종전 로더로 되돌아간다 — 2026-10-08/09 수리를 통째로 되돌리는 셈.',
  },
  {
    name: '🔎 사진 폭 SSOT 에 크롤러를 섞는다(한 술어가 두 질문에 답한다)',
    file: 'src/shared/detail-hero-image.ts',
    // 🩸 첫 판은 이 결함을 **주석**(`/** Yeti… */`)으로 심어 헛돌았다 — `readCode` 가 주석을
    //   걷어내므로 단언이 그걸 볼 수 없다(이 레포가 반복해 밟은 자리). 판정 대상은 **코드**다.
    find: "  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua || '')",
    replace: "  return /Mobi|Android|iPhone|iPad|iPod|Yeti|Googlebot/i.test(ua || '')",
    test: TEST,
    why: '"몇 px 로 받나" 와 "본문을 그려 주나" 가 한 함수가 되면 한쪽 수정이 다른 쪽을 조용히 움직인다.',
  },
  {
    name: '🔎 `<noscript>` 가 제목을 되풀이한다(크롤러가 같은 문구를 두 번 본다)',
    file: NS,
    find: '  const descLine = desc && desc !== name ? esc(desc) : \'\'',
    replace: '  const descLine = desc ? esc(desc) : \'\'',
    test: TEST,
    why: '규율 ② — 첫 화면 h1 이 이미 말한 것이다. 반복은 정보가 아니라 중복 신호다.',
  },
  {
    name: '🔎 `<noscript>` 가 값 없는 빈 라벨을 남긴다',
    file: NS,
    find: '  const kept = items.filter((x): x is string => typeof x === \'string\' && x.trim().length > 0)',
    replace: '  const kept = items.map((x) => (typeof x === \'string\' ? x : \'\'))',
    test: TEST,
    why: '`주소 ` 만 남은 줄은 없는 것보다 나쁘다 — 크롤러가 빈 필드를 본문으로 센다.',
  },
  {
    name: '🔎 `<noscript>` 가 주소·매장명을 escape 없이 찍는다',
    file: NS,
    find: '    .replace(/</g, \'&lt;\')\n    .replace(/>/g, \'&gt;\')',
    replace: '',
    test: TEST,
    why: '셀러가 입력한 주소가 그대로 HTML 이 된다 — 서버가 조립하는 문자열이라 React 가 막아 주지 않는다.',
  },
  {
    name: '🔎 유어샵 요약이 핀을 **중첩** 구조로 읽는다(조용히 비는 그 실수)',
    file: NS,
    find: '      const nm = (pr.product_name || \'\').trim()',
    replace: '      const nm = ((pr as { product?: { name?: string } }).product?.name || \'\').trim()',
    test: TEST,
    why: '`pins[]` 는 평평하다 — 중첩으로 읽으면 전부 undefined 가 되는데 **에러가 안 난다**(처음 실제로 그랬다).',
  },
  {
    name: '🔎 브랜드 JSON-LD 가 홈 밖에도 실린다(중복 엔티티)',
    file: 'src/shared/seo/consumer-surfaces.ts',
    find: "    ...(path === '/' ? { jsonLd: buildBrandJsonLd(origin, entry.description) } : {}),",
    replace: '    jsonLd: buildBrandJsonLd(origin, entry.description),',
    test: TEST,
    why: '구글은 사이트 이름을 **홈페이지의** WebSite 에서만 읽는다 — 다른 페이지엔 Product 가 맞다.',
  },
  {
    name: '🔎 브랜드 JSON-LD 가 `</script>` 를 그대로 흘린다',
    file: 'src/shared/seo/brand-jsonld.ts',
    find: "  return s.replace(/</g, '\\\\u003c').replace(/>/g, '\\\\u003e').replace(/&/g, '\\\\u0026')",
    replace: '  return s',
    test: TEST,
    why: '홈 메타 설명이 스크립트 블록을 끊으면 그 자리에서 임의 스크립트가 실행된다.',
  },
  {
    name: '🔎 매장 주소·좌표가 다시 `Product` 안으로 들어간다(구글이 버리는 자리)',
    file: META,
    find: '    if (place) (product.offers as Record<string, unknown>).availableAtOrFrom = { \'@id\': placeId }',
    replace: '    if (place) Object.assign(product, { address: place.address, geo: place.geo })',
    test: TEST,
    why: 'address·geo 는 Product 표준 속성이 아니다 — 거기 두면 로컬 신호가 한 번도 전달되지 않는다(실제로 그랬다).',
  },
  {
    name: '🔎 매장 엔티티를 아예 안 싣는다(이용권 페이지에서 로컬 신호 0)',
    file: META,
    find: '    const jsonLd = escapeScript(JSON.stringify(place ? [product, place, breadcrumb] : [product, breadcrumb]))',
    replace: '    const jsonLd = escapeScript(JSON.stringify([product, breadcrumb]))',
    test: TEST,
    why: '대표 *"특히 이용권 페이지들은 더욱"* 의 핵심 — 매장이 곧 이 상품의 정체다.',
  },
  {
    name: '🔎 업종 타입이 전부 FoodEstablishment 로 간다(뷰티·숙소를 음식점이라고 선언)',
    file: META,
    find: "    default: return 'LocalBusiness'",
    replace: "    default: return 'FoodEstablishment'",
    test: TEST,
    why: '틀린 업종 선언은 덜 구체적인 상위 타입보다 나쁘다 — 구글이 엉뚱한 리치 결과를 판정한다.',
  },
  {
    name: '🔎 리뷰 0건에도 평점을 선언한다(구글 정책 위반 · 0점짜리로 읽힌다)',
    file: META,
    find: '    if (rc > 0 && rv > 0) {',
    replace: '    if (rc >= 0) {',
    test: TEST,
    why: '`ratingValue: 0` 은 "평점 0점" 이라고 말하는 것이고, 리뷰 없는 aggregateRating 은 정책 위반이다.',
  },
  {
    name: '🔎 매장 정보가 없어도 빈 엔티티를 만든다(이름만 있는 LocalBusiness)',
    file: META,
    find: '    const hasPlace = !!(store && (d.restaurant_address || (d.restaurant_lat && d.restaurant_lng)))',
    replace: '    const hasPlace = true',
    test: TEST,
    why: '주소도 좌표도 없는 매장 엔티티는 아무것도 말하지 않으면서 스키마만 어지럽힌다.',
  },
]
