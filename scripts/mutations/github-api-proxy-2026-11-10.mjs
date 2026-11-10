/**
 * 🧬 주입 — 푸시 전 안내 검사의 GitHub 읽기(프록시) (2026-11-10) · 가드: src/tests/unit/github-api-proxy-2026-11-10.test.ts
 */
const T = 'src/tests/unit/github-api-proxy-2026-11-10.test.ts'
export default [
  {
    name: '🌐 프록시가 있어도 Node fetch 로 읽는다 (클라우드에서 403 — 경고가 조용히 죽는다)',
    file: 'scripts/github-api.mjs',
    find: '  if (proxyFor(env)) {',
    replace: '  if (false) {',
    test: T,
    why: '11/3~11/10 클라우드에서 두 경고가 한 번도 안 돌았다 — 재푸시 취소 25건(약 280분)을 못 막았다.',
  },
  {
    name: '🌐 403 응답을 성공으로 읽는다',
    file: 'scripts/github-api.mjs',
    find: "    if (!(status >= 200 && status < 300)) throw new Error(`HTTP ${status || '?'}`)",
    replace: '',
    test: T,
    why: '거절 응답 본문을 목록으로 읽으면 "돌고 있는 검사 없음" 으로 조용히 통과한다.',
  },
  {
    name: '🌐 재푸시 경고가 다시 맨 fetch 를 쓴다',
    file: 'scripts/check-verify-in-flight.mjs',
    find: '    runs = (await getGithubJson(url)).workflow_runs || []',
    replace: '    runs = (await (await fetch(url)).json()).workflow_runs || []',
    test: T,
    why: '맨 fetch 는 프록시를 안 봐서 클라우드 세션에선 늘 실패한다.',
  },
  {
    name: '🌐 겹침 경고가 못 읽어도 아무 말 없이 넘어간다',
    file: 'scripts/check-pr-collision.mjs',
    find: "    console.log(`⚠️ 열린 PR 겹침 경고: GitHub 를 못 읽어 건너뛴다(${String(err?.message ?? err).slice(0, 60)}).`)\n",
    replace: '',
    test: T,
    why: '말없는 실패가 이 경고를 일주일 동안 죽어 있게 했다 — 못 읽었으면 한 줄로 말해야 다음 사람이 안다.',
  },
]
