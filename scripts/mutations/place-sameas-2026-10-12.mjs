/**
 * 🔗 매장 엔티티의 `sameAs`(카카오 장소 프로필) — 2026-10-12
 *
 * 라이브 실측: `/pass/:id`·`/stays/:id`·`/products/:id` 전 표면 `sameAs` **0** 인데
 * `kakao_place_url` 은 딜 14/14 · 숙소에도 있었다. 가드: `src/tests/unit/place-sameas-2026-10-12.test.ts`.
 */
const SRC = 'src/worker/utils/detail-ssr-meta.ts'
const SSOT = 'src/shared/kakao-place-url.ts'
const W = 'src/tests/unit/kakao-place-write-paths-2026-10-13.test.ts'
const T = 'src/tests/unit/place-sameas-2026-10-12.test.ts'

export default [
  {
    name: '🔗 이용권 매장 노드가 sameAs 를 안 낸다',
    why: '종전 상태로의 회귀 — 로컬 질의의 권위(카카오맵)와 우리 가게를 잇는 유일한 표준 속성이 조용히 사라진다(화면·빌드 무변화)',
    file: SRC,
    find: "      ...(sameAs ? { sameAs: [sameAs] } : {}),",
    replace: "",
    test: T,
  },
  {
    name: '🔗 숙소 매장 노드가 sameAs 를 안 낸다',
    why: '한쪽만 배선되면 같은 처방이 상세 종류에 따라 갈린다(에러 0)',
    file: SRC,
    find: "      ...(staySameAs ? { sameAs: [staySameAs] } : {}),",
    replace: "",
    test: T,
  },
  {
    // 🔄 2026-10-13 **두 번** 재조준했다. 처음엔 판정이 SSOT 로 옮겨간 것만 따라갔는데, 주입 러너가
    //   *"결함을 심었는데 통과한다"* 고 잡았다 — 이 호스트 규칙이 지키는 것은 **`sameAs` 가 아니라
    //   저장**이기 때문이다. 호스트를 열어도 `ID_PATTERNS` 가 카카오 호스트를 요구해 id 가 안 나오고,
    //   그래서 `sameAs` 는 그대로 null 이다(= sameAs 시험은 무엇도 느끼지 못한다).
    //   진짜 피해는 `normalizeKakaoPlaceUrl` 이 남의 URL 을 **그대로 돌려줘 저장되는 것**이고,
    //   그걸 보는 가드는 쓰기 경로 시험이다. ⇒ `test:` 를 그쪽으로.
    name: '🔗 호스트를 안 보고 통과시킨다',
    why: '남의 도메인이 매장 링크로 저장된다 — 셀러·어드민·에이전시 입력 경로가 있으므로 실재하는 위험이고, 미니맵이 그 주소를 연다',
    file: SSOT,
    find: "const KAKAO_PLACE_URL_RE = /^https?:\\/\\/(place\\.map\\.kakao\\.com\\/\\d+|map\\.kakao\\.com\\/|kko\\.to\\/[A-Za-z0-9_-]+)/",
    replace: "const KAKAO_PLACE_URL_RE = /^https?:\\/\\//",
    test: W,
  },
  {
    // 🔄 2026-10-13 재조준 — 종전 결함은 *입력* http 를 받는 것이었는데, 그건 이제 **의도**다
    //   (받아서 https 정본으로 올린다). 살아남은 불변식은 **내보내는 값이 늘 https** 라는 것이고
    //   이 주입이 그 방향을 깨뜨린다.
    name: '🔗 내보내는 값이 http 가 된다',
    why: '혼합 콘텐츠 주소를 정본 프로필로 선언한다 — 구조화 데이터가 http 를 가리키면 그 필드의 신뢰가 깎인다',
    file: SSOT,
    find: "  return /^\\d{1,20}$/.test(s) ? `https://place.map.kakao.com/${s}` : null",
    replace: "  return /^\\d{1,20}$/.test(s) ? `http://place.map.kakao.com/${s}` : null",
    test: T,
  },
  {
    // 🔄 2026-10-13 **두 번** 재조준. 숫자 검증은 **두 곳**에 있다 — 검증 정규식(저장 가능한가)과
    //   `ID_PATTERNS`(id 를 뽑을 수 있는가). `ID_PATTERNS` 쪽만 열면 검증 정규식이 먼저 막아
    //   **결함을 심어도 초록**이었다(중복 잠금은 각 잠금을 시험 불가능하게 만든다 — 2026-10-11 교훈).
    //   ⇒ 둘 중 **혼자 막는 쪽**(검증 정규식 = 저장 경로)에 심고, 그걸 보는 쓰기 가드로 보낸다.
    //   (`ID_PATTERNS` 의 숫자 요구는 좌표형 주입 `🔢↩️ 좌표형 …` 이 따로 지킨다.)
    name: '🔗 id 가 숫자인지 안 본다',
    why: '`place.map.kakao.com/<아무글자>` 는 장소 페이지가 아니다 — 저장 검증이 통째로 헐거워져 장소가 아닌 카카오 주소가 매장 링크로 들어온다',
    file: SSOT,
    find: "const KAKAO_PLACE_URL_RE = /^https?:\\/\\/(place\\.map\\.kakao\\.com\\/\\d+|map\\.kakao\\.com\\/|kko\\.to\\/[A-Za-z0-9_-]+)/",
    replace: "const KAKAO_PLACE_URL_RE = /^https?:\\/\\/(place\\.map\\.kakao\\.com\\/|map\\.kakao\\.com\\/|kko\\.to\\/[A-Za-z0-9_-]+)/",
    test: W,
  },
  {
    // 🔄 2026-10-13 재조준 — 같은 불변식, 자리만 SSOT 로.
    name: '🔗 정규형이 아니라 원본을 그대로 돌려준다',
    why: '끝 슬래시·쿼리·해시가 섞인 주소가 그대로 나가 같은 장소가 여러 모양으로 선언된다(`sameAs` 는 동일성 주장이라 모양이 갈리면 약해진다)',
    file: SSOT,
    find: "  return kakaoPlaceCanonicalUrl(url) ?? url.trim().replace(/^http:/, 'https:')",
    replace: "  return url.trim()",
    test: 'src/tests/unit/kakao-place-write-paths-2026-10-13.test.ts',
  },
  {
    name: '🔗 sameAs 로 매장 노드를 새로 만든다',
    why: '반대 방향 — 주소·좌표가 없는 페이지에 이름뿐인 사업체 엔티티가 생긴다(구조화 데이터가 내용보다 많다고 선언하는 꼴)',
    file: SRC,
    find: "    const hasPlace = !!(store && (d.restaurant_address || (d.restaurant_lat && d.restaurant_lng)))",
    replace: "    const hasPlace = !!(store && (d.restaurant_address || d.kakao_place_url || (d.restaurant_lat && d.restaurant_lng)))",
    test: T,
  },
  {
    name: '🔗 Product 에도 sameAs 를 얹는다',
    why: '`sameAs` 는 *사업체*의 정체성인데 상품에 붙으면 "이 메뉴가 그 가게다" 가 된다 + 한 문서에 같은 주장이 두 번',
    file: SRC,
    find: "    const sameAs = placeSameAs(d.kakao_place_url)",
    replace: "    const sameAs = placeSameAs(d.kakao_place_url)\n    if (sameAs) (product as Record<string, unknown>).sameAs = [sameAs]",
    test: T,
  },
  {
    name: '🔗 시드 타입에서 그 필드를 뺀다',
    why: '타입에 없으면 `d.kakao_place_url` 이 조용히 undefined 가 되어 배선이 살아 있는데 값이 영원히 안 온다(이 레포가 반복해 당한 *조용한 부재*)',
    file: SRC,
    find: "  // 🔗 2026-10-12 — 카카오 장소 프로필(`sameAs`). 시드에 이미 온다(실측 14/14).\n  kakao_place_url?: string\n}",
    replace: "}",
    test: T,
  },
  {
    name: '🔗 호스트를 빌더에도 손으로 적는다',
    why: '판정이 두 벌이 되면 한쪽만 고쳐지는 날이 온다 — 이 레포가 반복해 당한 드리프트 클래스',
    file: SRC,
    find: "    const staySameAs = placeSameAs(p.kakao_place_url)",
    replace: "    const staySameAs = String(p.kakao_place_url || '').startsWith('https://place.map.kakao.com/') ? String(p.kakao_place_url) : null",
    test: T,
  },
  // ── 2026-10-13 — 같은 가게의 다른 껍데기 셋을 접는 규칙(SSOT) ─────────────────────
  {
    name: '🔢 지도 itemId 를 못 읽는다 — 같은 가게인데 sameAs 가 안 나간다',
    why: '사람이 `map.kakao.com/?itemId=` 로 붙여넣은 매장은 라이브 실측으로 같은 id 공간인데도 sameAs 가 0 이 된다(에러 0 · 화면 무변화).',
    file: SSOT,
    find: "      const id = u.searchParams.get('itemId')",
    replace: "      const id = null as string | null",
    test: T,
  },
  {
    name: '🔢 공유 링크(link/map·link/to)를 못 읽는다',
    why: '카카오맵 공유 버튼이 주는 모양이다. 못 읽으면 가장 흔한 붙여넣기에서 sameAs 가 빠진다.',
    file: SSOT,
    find: "  /^https?:\\/\\/map\\.kakao\\.com\\/link\\/(?:map|to)\\/(\\d{1,20})(?:[/?#]|$)/,",
    replace: "",
    test: T,
  },
  {
    name: '🔢↩️ 좌표형 링크에서 숫자를 억지로 뽑는다 — 남의 가게를 선언한다',
    why: '반대 방향. `link/map/{이름},{위도},{경도}` 엔 장소 id 가 없다. 거기서 숫자를 뽑으면 **틀린 가게**를 우리 상품의 매장이라고 구조화 데이터로 선언한다 — sameAs 가 없는 것보다 나쁘다.',
    file: SSOT,
    find: "  /^https?:\\/\\/map\\.kakao\\.com\\/link\\/(?:map|to)\\/(\\d{1,20})(?:[/?#]|$)/,",
    replace: "  /^https?:\\/\\/map\\.kakao\\.com\\/link\\/(?:map|to)\\/.*?(\\d{1,20})/,",
    test: T,
  },
  {
    name: '🔢↩️ 단축링크(kko.to)를 정본으로 지어낸다',
    why: '반대 방향. `kko.to/{code}` 의 code 는 장소 id 가 아니다. 그걸 id 로 쓰면 존재하지 않는 장소 프로필을 가리킨다.',
    file: SSOT,
    find: "  /^https?:\\/\\/place\\.map\\.kakao\\.com\\/(\\d{1,20})(?:[/?#]|$)/,",
    replace: "  /^https?:\\/\\/place\\.map\\.kakao\\.com\\/(\\d{1,20})(?:[/?#]|$)/,\n  /^https?:\\/\\/kko\\.to\\/(\\w{1,20})/,",
    test: T,
  },
  {
    name: '🔒 셀러 매장 저장이 검증을 다시 빠뜨린다',
    why: '종전 상태가 정확히 이것이었다(생 `String`). `store-profile` 은 300자 자르기만 하므로 아무 도메인이나 저장되고, 미니맵이 그 주소를 연다.',
    file: 'src/features/seller/api/seller-stores.routes.ts',
    find: "      kakao_place_url: b.kakao_place_url != null ? (normalizeKakaoPlaceUrl(b.kakao_place_url) ?? '') : undefined,",
    replace: "      kakao_place_url: b.kakao_place_url != null ? String(b.kakao_place_url) : undefined,",
    test: 'src/tests/unit/kakao-place-write-paths-2026-10-13.test.ts',
  },
  {
    name: '🔒 에이전시 매장 등록이 검증을 다시 빠뜨린다',
    why: '같은 클래스. 대행사가 등록하는 경로만 구멍이면 그 매장들만 임의 URL 을 갖는다(에러 0).',
    file: 'src/features/agency-console/api/agency-store-register.ts',
    find: "          ...(agencyPlaceUrl ? { kakao_place_url: agencyPlaceUrl } : {}),",
    replace: "          ...(b.kakao_place_url ? { kakao_place_url: String(b.kakao_place_url) } : {}),",
    test: 'src/tests/unit/kakao-place-write-paths-2026-10-13.test.ts',
  },
  {
    name: '🔑 등록 때 받은 장소 id 를 안 쓴다 — 단축링크 매장이 sameAs 를 영영 못 받는다',
    why: '`kko.to` 로 등록된 매장은 URL 에서 id 를 못 뽑는다. 받아 둔 `kakao_place_id` 를 안 쓰면 그 매장은 구조화 데이터에서 영영 카카오 프로필과 안 이어진다(네트워크 왕복 0 으로 닫을 수 있는 틈인데).',
    file: 'src/features/seller/api/seller-stores.routes.ts',
    find: " ?? kakaoPlaceUrlFromId(b.kakao_place_id)  // 🔑 URL 로 id 를 못 뽑으면",
    replace: " ?? null  // 🔑 URL 로 id 를 못 뽑으면",
    test: W,
  },
  {
    name: '🔑↩️ 폴백 순서를 뒤집는다 — id 가 사람이 고친 URL 을 덮는다',
    why: '반대 방향. URL 은 더 최신 입력이다(사람이 방금 고쳤다). id 를 먼저 쓰면 수정이 조용히 무시된다.',
    file: 'src/features/agency-console/api/agency-store-register.ts',
    find: "        const agencyPlaceUrl = normalizeKakaoPlaceUrl(b.kakao_place_url)\n          ?? kakaoPlaceUrlFromId(b.kakao_place_id)",
    replace: "        const agencyPlaceUrl = kakaoPlaceUrlFromId(b.kakao_place_id)\n          ?? normalizeKakaoPlaceUrl(b.kakao_place_url)",
    test: W,
  },
  {
    name: '🔑 id 가 숫자가 아니어도 정본을 만든다',
    why: '`kakaoPlaceUrlFromId` 가 아무 문자열이나 받으면 `place.map.kakao.com/<쓰레기>` 를 매장 링크로 저장하고 구조화 데이터로 선언한다.',
    file: SSOT,
    find: "  return /^\\d{1,20}$/.test(s) ? `https://place.map.kakao.com/${s}` : null",
    replace: "  return s ? `https://place.map.kakao.com/${s}` : null",
    test: W,
  },
]
