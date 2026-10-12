/**
 * 🤖 `/llms.txt` (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/llms-txt-2026-10-12.test.ts
 *
 * 네 겹을 각각 되돌린다: 문구 두 벌 · noindex 표면 권유 · 색인 대상 누락 · 서비스 설명이 뒤로 밀림.
 */
const TEST = 'src/tests/unit/llms-txt-2026-10-12.test.ts'
const B = 'src/shared/seo/llms-txt.ts'
const ROUTE = 'src/worker/routes/sitemap.routes.ts'
const ROBOTS = 'public/robots.txt'

export default [
  {
    name: '🤖 llms.txt 소개 문구를 손으로 베낀다 (네 번째 사본)',
    file: B,
    find: '    ...CONCEPT_ABOUT_LINES.slice(1),',
    replace: "    '유어딜은 동네 할인권을 파는 곳입니다.',",
    test: TEST,
    why: '화면·구조화 데이터·noscript 에 더해 네 번째 사본이 생기고, 소개가 바뀔 때 여기만 낡는다.',
  },
  {
    name: '🤖 llms.txt 가 noindex 표면까지 AI 에게 권한다',
    file: B,
    find: "    (p) => p !== '/' && !CONSUMER_SURFACE_SEO[p]?.noindex,",
    replace: "    (p) => p !== '/',",
    test: TEST,
    why: '색인 말라고 한 URL 을 "여기를 보라" 고 제출하는 것은 서로 반대되는 신호다.',
  },
  {
    name: '🤖 llms.txt 가 정책 표면만 내고 서비스 표면을 빠뜨린다',
    file: B,
    find: '    ...service.map(linkLine),',
    replace: '    ...service.slice(0, 1).map(linkLine),',
    test: TEST,
    why: '표면이 늘었는데 이 파일만 안 따라가는 쪽이 조용하다 — 누락은 에러를 안 낸다.',
  },
  {
    name: '🤖 llms.txt FAQ 가 다시 배송 문의로 시작한다',
    file: B,
    find: "    ...CONCEPT_FAQ.filter((f) => f.category === '서비스'),\n    ...CONCEPT_FAQ.filter((f) => f.category !== '서비스'),",
    replace: '    ...CONCEPT_FAQ,',
    test: TEST,
    why: 'AI 가 "유어딜이 뭐야" 로 와서 처음 읽는 문장이 "주문을 취소하고 싶어요" 가 된다.',
  },
  {
    name: '🤖 llms.txt 가 상대 경로 링크를 낸다',
    file: B,
    find: '    `- [${labelOf(p)}](${base}${p}): ${oneLine(CONSUMER_SURFACE_SEO[p]?.description || \'\')}`',
    replace: '    `- [${labelOf(p)}](${p}): ${oneLine(CONSUMER_SURFACE_SEO[p]?.description || \'\')}`',
    test: TEST,
    why: 'AI 에이전트는 상대 경로를 못 따라간다 — 파일은 멀쩡해 보이고 링크만 죽는다.',
  },
  {
    name: '🤖 llms.txt 에 도메인을 박아 둔다',
    file: B,
    find: '  const base = origin.replace(/\\/+$/, \'\')',
    replace: "  const base = 'https://urdeal.kr'",
    test: TEST,
    why: '도메인 이전(2026-07-20 live.ur-team.com → urdeal.kr)을 또 겪는다. 그때 이 파일만 옛 도메인을 가리킨다.',
  },
  {
    name: '🤖 llms.txt 를 Content-Type 없이 서빙한다',
    file: ROUTE,
    find: "      'Content-Type': 'text/plain; charset=utf-8',",
    replace: '',
    test: TEST,
    why: '브라우저·크롤러가 다운로드로 처리하거나 인코딩을 추측해 한글이 깨진다.',
  },
  {
    name: '🤖 robots 의 `*` 그룹이 llms.txt 를 막는다',
    file: ROBOTS,
    find: 'User-agent: *\n',
    replace: 'User-agent: *\nDisallow: /llms.txt\n',
    test: TEST,
    why: '만들어 두고 막으면 아무 효과가 없는데 파일은 멀쩡히 존재해 "했다" 고 착각하게 된다.',
  },
]
