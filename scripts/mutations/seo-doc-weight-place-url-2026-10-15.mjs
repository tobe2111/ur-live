/**
 * 🔎 서빙 문서 무게(주석 8KB gzip) + 매장 엔티티 `url` 비대칭 (2026-10-15) — 주입 매니페스트.
 * 가드: src/tests/unit/seo-doc-weight-place-url-2026-10-15.test.ts
 */
const TEST = 'src/tests/unit/seo-doc-weight-place-url-2026-10-15.test.ts'
const STRIP = 'scripts/strip-html-comments.mjs'
const META = 'src/worker/utils/detail-ssr-meta.ts'

export default [
  {
    name: '🧹 주석 제거기가 무손실 검증을 건너뛴다 (조용히 망가진 문서를 서빙한다)',
    file: STRIP,
    find: '  if (!blocksSame || changed.length) {',
    replace: '  if (false) {',
    test: TEST,
    why: '스크립트 안에 `<!--` 가 생기는 날 주석 제거가 뒤 마크업을 먹는데 빌드가 통과한다 — 이 레포가 다섯 번 밟은 클래스이고, 그때 깨지는 것은 서빙되는 문서다.',
  },
  {
    name: '🧹 인라인 블록 비교를 길이만 보게 한다 (내용이 바뀌어도 통과)',
    file: STRIP,
    find: 'const blocksSame = a.length === b.length && a.every((x, i) => x === b[i])',
    replace: 'const blocksSame = a.length === b.length',
    test: TEST,
    why: '블록 수는 같은데 내용이 먹힌 경우를 놓친다 — 수만 세는 검사는 "실패할 수 없는 검사" 의 전형이다.',
  },
  {
    name: '🧹 vite 배선을 뺀다 (소스만 고쳐 두고 서빙 문서는 그대로)',
    file: 'vite.config.ts',
    find: '    stripHtmlCommentsPlugin(),',
    replace: '',
    test: TEST,
    why: '플러그인이 존재하는데 안 돌면 8KB 가 계속 나간다 — 이 레포가 "등록은 됐는데 안 돈다" 로 반복해 당한 모양.',
  },
  {
    name: '🧹 order 를 pre 로 바꾼다 (다른 플러그인이 넣는 태그를 못 본다)',
    file: STRIP,
    find: "      order: 'post',",
    replace: "      order: 'pre',",
    test: TEST,
    why: 'react·i18n 플러그인이 뒤에 넣는 주석이 남고, 무손실 검증도 최종 문서가 아닌 중간본을 본다.',
  },
  {
    name: '🔗 이용권 매장 노드의 url 을 뺀다 (숙소와 다시 갈린다)',
    file: META,
    // 🩸 `replace` 가 `find` 의 **부분문자열이면 안 된다** — 복원 검사(`replace 는 있고 find 는 없으면
    //    복원 실패`)가 오발한다. 처음에 `'    } : null'` 로 썼더니 그 문자열이 파일에 3번 나와
    //    실제로 거짓 "복원 실패" 가 떴다(CLAUDE.md 가 적어 둔 그 함정이다).
    //    그래서 **읽히지 않는 이름으로 바꾼다** — `url` 이 사라지는 결함은 그대로다.
    // 🩸 그리고 `      url: canonical,` 은 파일에 **두 곳**이다(이용권 294 · 숙소 405) —
    //    주입 대상이 유일해야 하므로 바로 다음 줄(`sameAs` 전개, 이용권 쪽에만 있다)까지 포함한다.
    find: '      url: canonical,\n      ...(sameAs ? { sameAs: [sameAs] } : {}),',
    replace: '      urlOmitted: canonical,\n      ...(sameAs ? { sameAs: [sameAs] } : {}),',
    test: TEST,
    why: '구글 LocalBusiness 권장 필드가 이용권 310건에서만 비는 상태로 되돌아간다 — 빌더 단위 비대칭이 이 레포의 반복 사고 클래스다.',
  },
  {
    name: '🔗 매장 노드 url 을 canonical 아닌 요청 경로로 (사본 URL 을 가게 주소라 말한다)',
    file: META,
    find: '      url: canonical,\n      ...(sameAs ? { sameAs: [sameAs] } : {}),',
    replace: '      url: `${origin}${pathname}`,\n      ...(sameAs ? { sameAs: [sameAs] } : {}),',
    test: TEST,
    why: '`/products/:id` 같은 사본으로 들어오면 정본이 아닌 URL 을 그 가게의 페이지라고 선언한다(canonical 통합과 서로 반대 신호).',
  },
  {
    name: '🔗 이용권 매장에 priceRange 를 지어낸다',
    file: META,
    find: '      url: canonical,\n      ...(sameAs ? { sameAs: [sameAs] } : {}),',
    replace: "      url: canonical, priceRange: `${price}`,\n      ...(sameAs ? { sameAs: [sameAs] } : {}),",
    test: TEST,
    why: '이용권은 상품 ≠ 매장이다 — 딜 한 건의 값을 식당의 가격대라고 말하는 것은 지어내기다(숙소는 객실 가격대라 성립하지만 "일관성" 을 이유로 몰면 안 된다).',
  },
]
