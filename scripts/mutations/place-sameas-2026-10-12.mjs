/**
 * 🔗 매장 엔티티의 `sameAs`(카카오 장소 프로필) — 2026-10-12
 *
 * 라이브 실측: `/pass/:id`·`/stays/:id`·`/products/:id` 전 표면 `sameAs` **0** 인데
 * `kakao_place_url` 은 딜 14/14 · 숙소에도 있었다. 가드: `src/tests/unit/place-sameas-2026-10-12.test.ts`.
 */
const SRC = 'src/worker/utils/detail-ssr-meta.ts'
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
    name: '🔗 호스트를 안 보고 통과시킨다',
    why: '남의 도메인을 "이 가게의 프로필" 로 선언한다 — 셀러·어드민 입력 경로가 있으므로 실재하는 위험이고, 거짓 sameAs 는 신뢰 신호를 깎는다',
    file: SRC,
    find: "    if (u.protocol !== 'https:' || u.hostname !== 'place.map.kakao.com') return null",
    replace: "    if (u.protocol !== 'https:') return null",
    test: T,
  },
  {
    name: '🔗 http(비보안)도 허용한다',
    why: '혼합 콘텐츠 주소를 정본 프로필로 선언한다',
    file: SRC,
    find: "    if (u.protocol !== 'https:' || u.hostname !== 'place.map.kakao.com') return null",
    replace: "    if (u.hostname !== 'place.map.kakao.com') return null",
    test: T,
  },
  {
    name: '🔗 id 가 숫자인지 안 본다',
    why: '`place.map.kakao.com/<아무글자>` 는 장소 페이지가 아니다 — 모양 검증이 통째로 헐거워진다',
    file: SRC,
    find: "    const m = /^\\/(\\d{1,20})$/.exec(u.pathname.replace(/\\/+$/, '') || '/')",
    replace: "    const m = /^\\/(.+)$/.exec(u.pathname.replace(/\\/+$/, '') || '/')",
    test: T,
  },
  {
    name: '🔗 정규형이 아니라 원본을 그대로 돌려준다',
    why: '끝 슬래시·쿼리·해시가 섞인 주소가 그대로 나가 같은 장소가 여러 모양으로 선언된다(`sameAs` 는 동일성 주장이라 모양이 갈리면 약해진다)',
    file: SRC,
    find: "    return m ? `https://place.map.kakao.com/${m[1]}` : null",
    replace: "    return m ? s : null",
    test: T,
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
]
