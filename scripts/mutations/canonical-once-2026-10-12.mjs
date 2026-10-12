/**
 * 🔗 canonical 은 문서에 정확히 하나 (2026-10-12, 대표 "응 모두 해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/canonical-once-2026-10-12.test.ts
 *
 * 이 결함은 **빌드도 테스트도 화면도 안 깨뜨린다** — 두 canonical 의 값이 같으면 무해하고,
 * 값이 갈리는 날에만 조용히 정본 선언이 무효가 된다. 그래서 기계가 지켜야 한다.
 */
const TEST = 'src/tests/unit/canonical-once-2026-10-12.test.ts'
const SSOT = 'src/worker/utils/surface-ssr-meta.ts'

export default [
  {
    name: '🔗 applyCanonical 이 기존 태그를 안 지운다 — 봇 문서에 canonical 2개가 돌아온다',
    file: SSOT,
    find: ".on('link[rel=\"canonical\"]', { element(el) { el.remove() } })",
    replace: ".on('meta[name=\"ur-noop\"]', { element(el) { el.remove() } })",
    test: TEST,
    why: '봇 셸은 자기 canonical 을 이미 갖고 있다 — 지우지 않으면 붙인 것과 2개가 되고, 값이 갈리는 순간(숙소 정본) 구글이 둘 다 무시한다.',
  },
  {
    name: '🔗 applyCanonical 이 붙이지 않는다 — 사람이 받는 문서의 canonical 이 0 이 된다',
    file: SSOT,
    find: 'element(el) { el.append(`<link rel="canonical" href="${href}">`, { html: true }) },',
    replace: 'element(_el) { /* no append */ },',
    test: TEST,
    why: '`index.html` 에는 canonical 태그가 **없다**(실측) — 교체만 하면 사람 경로에서 그 선언이 통째로 사라진다. 이 방향이 중복보다 더 나쁘다.',
  },
  {
    name: '🔗 canonical 속성 이스케이프 제거 — 상품명이 메타를 탈출한다',
    file: SSOT,
    find: 'const href = escapeAttr(canonical)',
    replace: 'const href = canonical',
    test: TEST,
    why: 'canonical 은 `products.name`·슬러그 등 사용자-제어 값에서 조립된다. 탈출하면 서빙 문서에 HTML 주입이 된다(2026-06-26 OG 인젝션 차단과 같은 클래스).',
  },
  {
    name: '🔗 applySurfaceMeta 가 helper 를 우회해 직접 append — 목록 표면이 다시 2개',
    file: SSOT,
    find: 'let withCanon = applyCanonical(out, meta.canonical)',
    replace: 'let withCanon = out.on(\'head\', { element(el) { el.append(`<link rel="canonical" href="${escapeAttr(meta.canonical)}">`, { html: true }) } })',
    test: TEST,
    why: '우회로가 하나라도 남으면 "canonical 을 붙이는 자리" 가 다시 둘이 된다 — 그게 이 결함이 자란 방식이다.',
  },
  {
    name: '🔗 워커 배선 하나 제거 — 블로그 목록 canonical 이 다시 2개',
    file: 'src/worker/index.ts',
    find: '      rb = applyCanonical(rb, canon);',
    replace: '      rb = rb;',
    test: TEST,
    why: 'SSOT 가 멀쩡해도 호출부가 빠지면 그 표면만 조용히 종전으로 돌아간다(이 레포가 반복해 당한 "실패가 아니라 조용한 부재").',
  },
  {
    name: '🔗 반대 방향 — 봇 셸의 self-canonical 을 지운다',
    file: 'src/worker/index.ts',
    find: '<link rel="canonical" href="${esc(canonical)}" />',
    replace: '<!-- canonical removed -->',
    test: TEST,
    why: '메타 빌더가 없는 표면은 rewriter 를 안 탄다 — 셸의 self-canonical 을 지우면 그 표면들의 쿼리 변형 통합 신호가 사라진다. 중복을 고치려다 반대쪽으로 넘어가는 것을 막는다.',
  },
]
