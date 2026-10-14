/**
 * 🔎 크롤러 가시성 (2026-10-11 대표 *"네이버도 해주고 … 특히 이용권 페이지들은 더욱"*) — 주입 매니페스트.
 * 가드: src/tests/unit/seo-crawler-visibility-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/seo-crawler-visibility-2026-10-11.test.ts'
const UA = 'src/shared/seo/crawler-ua.ts'
const NS = 'src/worker/utils/crawler-noscript.ts'
// 🔁 2026-10-14 — 행·글자 조립이 `crawler-noscript-rows.ts` 로 **추출**됐다(685줄 → 래칫 600 초과).
//    아래 앵커들의 결함은 한 글자도 안 바꿨고 **파일 경로만** 따라갔다.
const NS_ROWS = 'src/worker/utils/crawler-noscript-rows.ts'
const META = 'src/worker/utils/detail-ssr-meta.ts'
const BRAND = 'src/shared/seo/brand-jsonld.ts'
const WORKER = 'src/worker/index.ts'

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
    name: '🔎 그록·Meta·Mistral·You 가 다시 첫 화면을 못 받는다',
    why: '종전 상태가 정확히 이것이었다 — 라이브 실측에서 `xAI-Bot` 홈 본문이 **34자**(형제는 '
       + '395자)였고 대표가 이름을 댄 넷 중 하나가 그록이다. 그 여섯은 **이미 HTML 200 을 받으므로** '
       + '막혀서 못 본 게 아니라 우리가 그릴 수 있는데 안 그려 주고 있었다.',
    file: 'src/shared/seo/crawler-ua.ts',
    find: '  /xAI-Bot/i,',
    replace: '  // /xAI-Bot/i,',
    test: 'src/tests/unit/seo-crawler-visibility-2026-10-11.test.ts',
  },
  {
    name: '🔎 Meta 검색봇을 학습봇과 한 줄로 삼킨다',
    why: '`Meta-ExternalAgent`(학습 · robots 로 막아 둔 쪽)와 `meta-webindexer`(검색)는 **다른 봇**이다. '
       + '`/Meta/i` 처럼 넓게 잡으면 막아 둔 쪽에 본문을 그려 주게 된다.',
    file: 'src/shared/seo/crawler-ua.ts',
    find: '  /meta-webindexer/i,',
    replace: '  /Meta/i,',
    test: 'src/tests/unit/seo-crawler-visibility-2026-10-11.test.ts',
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
    file: NS_ROWS,
    find: '  const kept = items.filter((x): x is string => typeof x === \'string\' && x.trim().length > 0)',
    replace: '  const kept = items.map((x) => (typeof x === \'string\' ? x : \'\'))',
    test: TEST,
    why: '`주소 ` 만 남은 줄은 없는 것보다 나쁘다 — 크롤러가 빈 필드를 본문으로 센다.',
  },
  {
    name: '🔎 `<noscript>` 가 주소·매장명을 escape 없이 찍는다',
    file: NS_ROWS,
    find: '    .replace(/</g, \'&lt;\')\n    .replace(/>/g, \'&gt;\')',
    replace: '',
    test: TEST,
    why: '셀러가 입력한 주소가 그대로 HTML 이 된다 — 서버가 조립하는 문자열이라 React 가 막아 주지 않는다.',
  },
  {
    name: '🔎 유어샵 요약이 핀을 **중첩** 구조로 읽는다(조용히 비는 그 실수)',
    file: NS,
    // 🔁 2026-10-12 재조준 — 핀 한 줄 조립이 `row()` 헬퍼로 옮겨갔다(사업자 진열과 공유).
    //   불변식 그대로: **평평한 시드를 중첩으로 읽으면 조용히 빈다**.
    find: '    .map((pr) => row(pr.product_name || \'\', pr.restaurant_name, pr.price))',
    replace: '    .map((pr) => row((pr as unknown as { product?: { name?: string } }).product?.name || \'\', pr.restaurant_name, pr.price))',
    test: TEST,
    why: '`pins[]` 는 평평하다 — 중첩으로 읽으면 전부 undefined 가 되는데 **에러가 안 난다**(처음 실제로 그랬다).',
  },
  {
    // 🔀 2026-10-11 재조준: 이 주입은 원래 제가 새로 만든 `brand-jsonld.ts` 를 겨냥했는데, 라이브를
    //   재 보니 `index.html` 에 같은 `@id` 의 블록이 **이미** 있어 그 모듈 자체를 되돌렸다.
    //   불변식은 그대로 — *"사이트 이름 신호가 홈에 실제로 실린다"*. 출처만 옮겼다.
    name: '🔎 홈 `WebSite` 노드가 사라진다(구글이 도메인을 사이트 이름으로 쓴다)',
    file: 'index.html',
    find: '"@type": "WebSite",',
    replace: '"@type": "WebPage",',
    test: TEST,
    why: '사이트 이름의 1순위 소스다 — 없으면 구글이 `urdeal.kr` 로 떨어진다(실제로 그랬다).',
  },
  {
    name: '🔎 설명 주석이 JSON 블록 **안**으로 들어간다(JSON-LD 가 통째로 무효)',
    file: 'index.html',
    // 앵커 유일성: `"name": "유어딜",` 는 Organization·WebSite 둘에 있어 @id 줄까지 포함한다.
    find: '"@id": "https://urdeal.kr/#organization",\n          "name": "유어딜",',
    replace: '"@id": "https://urdeal.kr/#organization", <!-- 설명 -->\n          "name": "유어딜",',
    test: TEST,
    why: 'JSON 에 주석은 못 들어간다 — 에러도 경고도 없이 조용히 무효가 된다. 2026-10-11 에 제가 실제로 그렇게 깨뜨렸다.',
  },
  {
    name: '🔎 `alternateName` 에 도메인을 품은 이름이 되살아난다',
    file: 'index.html',
    find: '"alternateName": ["urdeal", "UrDeal"],',
    replace: '"alternateName": ["urdeal", "UrDeal", "유어딜 urdeal.kr"],',
    test: TEST,
    why: '구글 가이드가 꼽는 실패 원인 — 도메인을 품은 별칭이 사이트 이름 후보를 도메인 쪽으로 가리킨다.',
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
  {
    name: '🔎 봇 셸에서 브랜드 JSON-LD 가 빠진다(크롤러가 사이트 이름을 다시 못 받는다)',
    file: WORKER,
    find: '${brandJsonLdScript()}</head>',
    replace: '</head>',
    test: TEST,
    why: '이 수리의 본체다 — 봇 UA 는 index.html 을 안 받으므로 여기서 빠지면 `WebSite.name` 이 어떤 크롤러에도 안 간다.',
  },
  {
    name: '🔎 브랜드 노드가 `index.html` 과 갈린다(사람과 크롤러가 다른 이름을 본다)',
    file: BRAND,
    find: "      name: '유어딜',\n      alternateName: ['urdeal', 'UrDeal'],",
    replace: "      name: '유어딜 할인',\n      alternateName: ['urdeal', 'UrDeal'],",
    test: TEST,
    why: '두 벌이 갈려도 **에러가 안 난다** — deep-equal 대조가 유일한 방어다.',
  },
  {
    name: '🔎 브랜드 JSON-LD 를 HTML escape 한다(JSON-LD 가 통째로 무효)',
    file: BRAND,
    find: '  const json = JSON.stringify(data).replace(',
    replace: "  const json = JSON.stringify(data).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(",
    test: TEST,
    why: '값은 전부 상수라 escape 할 이유가 없고, 섞이면 파서가 그 블록을 버린다(에러도 경고도 없다).',
  },
  {
    name: '🔎 사람 셸 쪽 메타 빌더에도 브랜드 노드를 넣는다(같은 @id 두 벌)',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: 'export function applySurfaceMeta<T extends RewriterLike<T>>(',
    replace: "import { brandJsonLdScript } from '../../shared/seo/brand-jsonld'\nexport function applySurfaceMeta<T extends RewriterLike<T>>(",
    test: TEST,
    why: '제가 2026-10-11 에 두려워한 바로 그 중복이다 — index.html 이 이미 그 문서에 한 벌 넣는다.',
  },
  {
    name: '🔎 브랜드 설명에 폐기 명칭 "링크샵" 이 돌아온다',
    file: BRAND,
    find: '누구나 만드는 유어샵을 제공합니다',
    replace: '누구나 만드는 링크샵을 제공합니다',
    // 🔑 이 불변식의 주인은 명칭 가드다(src 전수 N1). 이 파일 쪽 시험은 긍정("유어샵이 있다")만 본다 —
    //    부정 리터럴을 적으면 그 명칭 가드가 그 시험 파일 자신을 잡는다(실제로 그랬다).
    test: 'src/tests/unit/urshop-naming.test.ts',
    why: '검색 AI 가 읽는 우리 자기소개다 — `index.html` 은 명칭 치환 당시 검사 경로 밖이라 옛 이름으로 남아 있었다.',
  },
]
