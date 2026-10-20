/**
 * 🤖 llms.txt 의 AI 비서 검색 창구 안내 (2026-10-20, 대표 "통로 열어줘")
 * 가드: src/tests/unit/llms-agent-search-2026-10-20.test.ts
 */
const TEST = 'src/tests/unit/llms-agent-search-2026-10-20.test.ts'

export default [
  {
    name: '🤖 창구가 꺼져 있어도 llms.txt 가 그 주소를 적는다 (404 를 가리킨다)',
    file: 'src/shared/seo/llms-txt.ts',
    find: '...(opts.agentSearch ? agentSearchLines(base) : []),',
    replace: '...agentSearchLines(base),',
    test: TEST,
    why: '꺼진 창구는 404 다. 그 주소를 AI 에게 안내하면 거짓 안내가 된다.',
  },
  {
    name: '🤖 라우트가 게이트를 안 넘긴다 (켜도 안내가 안 실린다)',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: 'const body = buildLlmsTxt(new URL(c.req.url).origin, { agentSearch, agentCheckout })',
    replace: 'const body = buildLlmsTxt(new URL(c.req.url).origin, { agentSearch: false && agentSearch, agentCheckout })',
    test: TEST,
    why: '창구를 켰는데 AI 가 주소를 모르는 상태 — 이 작업이 고친 바로 그 상태다.',
  },
  {
    name: '🤖 안내 주소가 실제 라우트와 갈린다',
    file: 'src/shared/agent-search.ts',
    find: "export const AGENT_SEARCH_PATH = '/api/agent/search'",
    replace: "export const AGENT_SEARCH_PATH = '/api/agents/search'",
    test: TEST,
    why: '안내가 없는 주소를 가리키면 AI 는 404 만 받는다.',
  },
]
