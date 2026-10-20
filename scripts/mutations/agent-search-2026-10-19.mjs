/**
 * 🤖 AI 비서 검색 창구(2026-10-19 ②) — 주입 매니페스트.
 * 가드: src/tests/unit/agent-search-2026-10-19.test.ts
 */
const TEST = 'src/tests/unit/agent-search-2026-10-19.test.ts'

export default [
  {
    name: '🤖 검색어 없이도 전체 목록을 준다',
    file: 'src/shared/agent-search.ts',
    find: '  if (q.length < 1 && region.length < 2) return null\n',
    replace: '',
    test: TEST,
    why: '빈 검색으로 전체 가격표를 긁어 갈 수 있게 된다 — 공개 API 를 막아 둔 결정을 뒤집는다.',
  },
  {
    name: '🤖 한 번에 10건 상한이 풀린다',
    file: 'src/shared/agent-search.ts',
    find: 'Math.min(n, AGENT_SEARCH_MAX)',
    replace: 'n',
    test: TEST,
    why: 'limit=999 로 벌크 수확이 된다.',
  },
  {
    name: '🤖 LIKE 와일드카드를 안 지운다',
    file: 'src/shared/agent-search.ts',
    find: "replace(/[%_\\\\\\u0000-\\u001f]/g, ' ')",
    replace: "replace(/[\\u0000-\\u001f]/g, ' ')",
    test: TEST,
    why: "q=% 하나로 전체 목록이 나온다.",
  },
  {
    name: '🤖 게이트를 안 본다',
    file: 'src/worker/routes/agent-search.routes.ts',
    find: "if (!DB || !(await settingOn(DB, AGENT_SEARCH_GATE))) return c.json({ success: false, error: 'NOT_FOUND' }, 404)",
    replace: "if (!DB) return c.json({ success: false, error: 'NOT_FOUND' }, 404)",
    test: TEST,
    why: '대표가 켜기 전에 창구가 열린다.',
  },
  {
    name: '🤖 데모 이용권을 AI 에게 건넨다',
    file: 'src/worker/routes/agent-search.routes.ts',
    // 2026-10-20: 결제 링크 라우트가 같은 줄을 써서 두 곳에 맞게 됐다 — 검색 쿼리(다음 줄의 where)로 가른다.
    find: "        AND NOT ${demoSlugSql('p')}${scope}\n        ${where.length",
    replace: "        ${scope}\n        ${where.length",
    test: TEST,
    why: '실제 가게 이름의 가짜 딜을 AI 가 추천하면 손님이 없는 거래를 찾아간다.',
  },
]
