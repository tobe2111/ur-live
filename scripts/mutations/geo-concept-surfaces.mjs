/**
 * 🧭 AI 검색(GEO) — 컨셉 표면이 크롤러에게 문장을 준다 (2026-10-12, 대표 *"그록, 클로드 등 모든 AI 서비스에서 검색 시 나오게"*) — 주입 매니페스트.
 * 가드: src/tests/unit/geo-concept-surfaces-2026-10-12.test.ts
 *
 * 다섯 불변식이 쌍으로 묶여 있다(robots 비대칭 · 문구 한 벌 · FAQPage 는 /faq 에만 ·
 * noscript 는 로더를 안 지운다 · 지역 항목은 그 지역만 + 시드는 홈과 같은 키).
 * 아래 주입은 그 각각을 하나씩 되돌려 가드가 정말 빨간불을 내는지 확인한다.
 */
const TEST = 'src/tests/unit/geo-concept-surfaces-2026-10-12.test.ts'
const ROBOTS = 'public/robots.txt'
const WORKER = 'src/worker/index.ts'
const NOSCRIPT = 'src/worker/utils/crawler-noscript.ts'
// 🔁 2026-10-14 — 행·글자 조립이 `crawler-noscript-rows.ts` 로 **추출**됐다(685줄 → 래칫 600 초과).
//    아래 앵커들의 결함은 한 글자도 안 바꿨고 **파일 경로만** 따라갔다.
const NS_ROWS = 'src/worker/utils/crawler-noscript-rows.ts'
const LISTLD = 'src/worker/utils/surface-list-jsonld.ts'
const FAQ_PAGE = 'src/pages/FAQPage.tsx'

export default [
  {
    name: '🧭 robots 가 Google-Extended 를 다시 막아 제미나이 인용을 끊는다',
    file: ROBOTS,
    find: 'User-agent: GPTBot\n',
    replace: 'User-agent: GPTBot\nUser-agent: Google-Extended\n',
    test: TEST,
    why: '그 토큰은 학습과 **그라운딩(=인용)** 을 한 덩어리로 묶는다 — 막으면 제미나이가 우리를 근거로 쓸 수 없다.',
  },
  {
    name: '🧭 제미나이 해제가 학습 봇 차단까지 풀어 버린다',
    file: ROBOTS,
    find: 'User-agent: GPTBot\n',
    replace: '',
    test: TEST,
    why: '인용은 받고 학습은 거부하는 비대칭이 이 레포의 결정이다. 한쪽만 보면 전면 개방으로 번진다.',
  },
  {
    name: '🧭 FAQ 문구가 화면에 베낀 배열로 되돌아간다 (두 벌)',
    file: FAQ_PAGE,
    find: '  const faqs: FAQ[] = CONCEPT_FAQ.map((f, i) => ({',
    replace: "  const faqs: FAQ[] = [{ id: 1, category: '서비스', question: t('faq.q1', { defaultValue: '베낀 질문' }), answer: '베낀 답변' }]\n  const _unused = CONCEPT_FAQ.map((f, i) => ({",
    test: TEST,
    why: '손으로 베끼면 화면과 구조화 데이터가 갈린다 — 구글은 내용-스키마 불일치를 정책 위반으로 본다.',
  },
  {
    name: '🧭 서버 FAQPage 구조화 데이터가 사라져 다시 helmet 에만 남는다',
    file: LISTLD,
    find: "  if (path === '/faq') {",
    replace: "  if (false && path === '/faq') {",
    test: TEST,
    why: 'helmet 경유 JSON-LD 는 JS 를 안 돌리는 크롤러에게 **한 글자도 배달되지 않는다**(라이브 0건이던 원인).',
  },
  {
    name: '🧭 FAQPage 가 전 표면에 붙는다 (그 페이지에 없는 Q&A 선언)',
    file: LISTLD,
    find: "  if (path === '/faq') {",
    replace: "  if (true) {",
    test: TEST,
    why: '페이지에 없는 Q&A 를 선언하면 리치결과가 아니라 불일치 신고감이다. 허용목록 한 줄이 의도다.',
  },
  {
    name: '🧭 noscript 가 로더를 대체해 로딩 화면이 사라진다',
    file: WORKER,
    find: 'el.setInnerContent(staticNs + urdealLoaderHtml, { html: true });',
    replace: 'el.setInnerContent(staticNs, { html: true });',
    test: TEST,
    why: '사람 화면 영향 0 이 이 처방의 전제다 — 로더를 지우면 모든 소비자 라우트 첫 페인트가 깨진다.',
  },
  {
    name: '🧭 지역 요약에서 지역 필터가 빠져 다른 동네 가게가 섞인다',
    file: NS_ROWS,
    find: "    if (!addressInRegion(p?.restaurant_address || p?.business_address, ref)) continue",
    replace: "    if (false) continue",
    test: TEST,
    why: '`/region/서울` 이 파주 가게를 말하면 그건 요약이 아니라 거짓이다 — 화면과 같은 SSOT 로 걸러야 한다.',
  },
  {
    name: '🧭 지역 요약이 교환권을 매장 이용권처럼 말한다',
    file: NS_ROWS,
    find: '    if (p?.deal_only === 1) continue',
    replace: '    if (false) continue',
    test: TEST,
    why: '교환권(기프티콘)은 매장이 없다 — 지역 페이지 요약에 섞으면 "그 동네 가게" 라고 말하는 셈이다.',
  },
  {
    name: '🧭 지역 요약이 시드 값을 탈출 없이 마크업에 넣는다',
    file: NS_ROWS,
    // 🔗 2026-10-12 재조준 — 행 조립이 `liOf` 로 옮겨갔다(링크가 생겼다). 지키려던 것은 그대로다:
    //   **시드 값이 탈출 없이 마크업에 들어가지 않는다.** 여기선 *링크 안쪽 글자*를 본다
    //   (주소 쪽은 `crawler-internal-links-2026-10-12.mjs`, 링크 없는 분기는
    //   `list-surface-noscript.mjs` 가 맡는다 — 세 경로가 다르다).
    // 🔁 2026-10-14 재조준: 사진이 붙으며 탈출 지점이 `body` 조립으로 옮겨갔다(불변식 그대로).
    find: '  const body = `${img}${esc(r.text)}`',
    replace: '${r.text}</a>',
    test: TEST,
    why: '가게명·메뉴명은 셀러가 입력한 값이다 — 상수가 아니라 **시드 값**이라 탈출이 실제로 일한다.',
  },
  {
    name: '🧭 지역 ItemList 가 전국 항목을 그 지역이라고 낸다',
    file: LISTLD,
    // 🧾 2026-10-12 재조준: 그 필터가 `keepItem`(표면별 술어 추가) 안으로 옮겨갔다.
    //   결함은 그대로 — **지역 필터를 늘 통과시킨다**. 앵커만 새 자리로.
    find: '      return addressInRegion(',
    replace: '      return true || addressInRegion(',
    test: TEST,
    why: 'ItemList 는 "이 목록의 항목" 선언이다 — 다른 지역을 담으면 구조화 데이터가 페이지와 어긋난다.',
  },
  {
    name: '🧭 지역 시드 경로가 리터럴로 갈려 예열을 못 맞는다',
    file: WORKER,
    find: "path: MAIN_SEED_PATH }; // 🗺️ 2026-10-12: 리터럴 → 상수(값 불변)",
    replace: "path: '/api/group-buy/products?status=active&category=all' }; // 🗺️ 2026-10-12: 리터럴 → 상수(값 불변)",
    test: TEST,
    why: '홈과 지역이 같은 캐시 키여야 cron 예열을 맞는다("추가 비용 0" 의 근거). 리터럴로 베끼면 고치는 날 조용히 갈린다.',
  },
  {
    name: '🧭 지역 경로 판정이 목록(/region)과 더 깊은 경로를 삼킨다',
    file: 'src/shared/seo/region-seed.ts',
    find: "export const REGION_PATH_RE = /^\\/region\\/[^/]+(?:\\/[^/]+)?\\/?$/",
    replace: "export const REGION_PATH_RE = /^\\/region/",
    test: TEST,
    why: '`/region` 목록은 딜을 안 그리고, 더 깊은 경로는 없는 URL 이다 — 삼키면 빈 ItemList·엉뚱한 시드가 붙는다.',
  },
  {
    name: '🧭 컨셉 FAQ 가 한 언어 로케일에서만 빠진다 (그 언어만 한국어가 섞인다)',
    file: 'public/locales/en/translation.json',
    find: '"q11": "Where can I find discount passes for restaurants near me?",',
    replace: '',
    test: TEST,
    why: '`defaultValue` 폴백은 **에러 없이** 한국어를 내보낸다 — 로케일 누락은 조용한 결함이라 가드만이 잡는다.',
  },
]
