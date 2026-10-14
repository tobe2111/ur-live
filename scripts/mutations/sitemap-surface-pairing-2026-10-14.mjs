/**
 * 🧬 2026-10-14 — sitemap 제출 ↔ 색인 의도 ↔ 본문 출처 **전수** 짝 주장의 주입.
 *
 * 근거는 `src/tests/unit/sitemap-surface-pairing-2026-10-14.test.ts` 머리말(같은 클래스가 네 번
 * 돌아온 이력). 세 주장(R1·R2·R3)과 **측정 자체가 헛돌지 않는가**(R0)를 각각 깨뜨린다.
 */
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const SSOT = 'src/shared/seo/surface-copy.ts'
const TEST = 'src/tests/unit/sitemap-surface-pairing-2026-10-14.test.ts'

export default [
  {
    name: '🔗 R1 — 색인 대상을 제출에서 뺀다 (/partners)',
    file: SITEMAP,
    find: "    { loc: '/partners', priority: 0.7, changefreq: 'weekly' },",
    replace: '',
    test: TEST,
    why:
      '표가 색인 대상이라 선언한 표면을 제출에서 빼면 **sitemap 으로만 발견되는 경로가 사라진다** — ' +
      '2026-10-13 에 미제출 색인 대상 5건을 그래서 찾았다(#43).',
  },
  {
    name: '🔗 R2 — noindex 표면을 제출한다 (/search)',
    file: SITEMAP,
    // 🔀 앵커는 **이 파일에서 가장 안 흔들리는 줄**(홈)로 둔다 — 같은 커밋에서 `/browse` 줄을
    //   앵커로 썼다가 그 줄의 숫자를 바꿔 스스로 낡은 지도를 만들었다.
    find: "    { loc: '/', priority: 1.0, changefreq: 'daily' },",
    replace:
      "    { loc: '/', priority: 1.0, changefreq: 'daily' },\n" +
      "    { loc: '/search', priority: 0.9, changefreq: 'daily' },",
    test: TEST,
    why:
      '색인 말라고 해 놓고(`noindex`) 색인해 달라고 제출하는 것은 **서로 반대되는 신호**다 — ' +
      '구글은 그런 쌍을 받으면 둘 다 무시하고 자기가 고른다(2026-10-12 canonical 2개 사고와 같은 꼴).',
  },
  {
    name: '🔗 R3 — 본문 출처 없는 경로를 제출한다 (/cart)',
    file: SITEMAP,
    find: "    { loc: '/vouchers', priority: 0.9, changefreq: 'daily' },",
    replace:
      "    { loc: '/vouchers', priority: 0.9, changefreq: 'daily' },\n" +
      "    { loc: '/cart', priority: 0.9, changefreq: 'daily' },",
    test: TEST,
    why:
      '**이게 네 번 돌아온 그 결함이다** — 본문을 만드는 기계가 없는 경로를 제출하면 크롤러에게 ' +
      '빈 문서를 색인해 달라고 요청하는 셈(soft-404)이고, 그만큼 크롤 예산이 실제 상품에서 빠진다.',
  },
  {
    name: '🔗 R3 — 제출 중인 표면의 본문 출처를 없앤다 (/privacy)',
    file: SSOT,
    find: "  '/privacy': {\n    lines: [",
    replace: "  '/privacy-DISABLED': {\n    lines: [",
    test: TEST,
    why:
      '`/privacy` 는 시드 기반이 아니라 `surface-copy` 항목이 **유일한** 출처다 — 키가 어긋나면 ' +
      '제출은 그대로인데 본문이 6자로 돌아간다(2026-10-14 에 고친 바로 그 상태).',
  },
  {
    name: '🔗 R0 — 시드 표면 파싱을 망가뜨린다 (R3 이 통째로 헛돈다)',
    file: TEST,
    find: "  const block = src.slice(src.indexOf('LIST_SURFACE_KEEP'))",
    replace: "  const block = src.slice(src.indexOf('__NEVER_MATCHES__'))",
    test: TEST,
    why:
      '시드 표면 집합이 비면 `/browse`·`/map`·`/stays`·`/vouchers` 가 **출처 없음**으로 읽혀 ' +
      '거짓 빨간불이 난다. 반대로 집합이 과도하게 넓어지면 R3 이 아무것도 안 지킨다 — ' +
      '어느 쪽이든 측정이 깨진 것이므로 R0 하한이 먼저 울려야 한다.',
  },
  {
    name: '🔗 R0 — 정적 loc 파싱을 망가뜨린다',
    file: TEST,
    find: "  [...read(SITEMAP).matchAll(/loc: '([^']+)'/g)].map(m => m[1])",
    replace: "  [...read(SITEMAP).matchAll(/loc__NEVER: '([^']+)'/g)].map(m => m[1])",
    test: TEST,
    why:
      'loc 이 0건이면 R1·R2·R3 이 **전부 공집합을 돌며 통과**한다 — 이 레포가 반복해 당한 ' +
      '"검사가 실패할 수 없음" 이고, 그래서 R0 가 하한을 들고 있다.',
  },
  {
    name: '🔗 반대 방향 — 다른 파일 빌더 경로를 지어낸다',
    file: TEST,
    find: "  '/blog': { file: 'src/features/blog/api/blog-ssr-body.ts', wiring: /export function buildBlogListBody/ },",
    replace: "  '/blog': { file: 'src/worker/utils/blog-ssr-meta.ts', wiring: /blog/i },",
    test: TEST,
    why:
      '**실제로 이렇게 지어 적었다가 이 단언이 잡았다.** 가드가 가리키는 고정 경로가 실재하지 ' +
      '않으면 그 항목은 아무것도 보증하지 않는데, 목록에 이름이 있으니 보증하는 것처럼 보인다 ' +
      '(`check-guard-registry` R2 가 말하는 그 자리).',
  },
]
