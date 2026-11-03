/**
 * 🧬 주입 — 큰 PR · 열린 PR 겹침 경고 (2026-11-03) · 가드: src/tests/unit/pr-collision-2026-11-03.test.ts
 */
const T = 'src/tests/unit/pr-collision-2026-11-03.test.ts'
const F = 'scripts/check-pr-collision.mjs'
export default [
  {
    name: '🚧 348파일짜리 PR 에도 아무 말을 안 한다',
    file: F,
    find: '  if (files > MAX_FILES) why.push(',
    replace: '  if (false) why.push(',
    test: T,
    why: '#2139 — 348파일 · 12시간 열려 하루 여덟 번 충돌했다.',
  },
  {
    name: '🚧 다른 열린 PR 이 같은 파일을 고쳐도 모른다',
    file: F,
    find: '    if (hit.length) out.push({ number: o.number, title: o.title, files: hit })',
    replace: '    void hit',
    test: T,
    why: '#2159 가 같은 파일을 고치는 동안 #2139 는 그걸 몰랐다 — 먼저 머지된 쪽이 다른 쪽을 처음부터 다시 돌게 했다.',
  },
  {
    name: '🚧 번역 파일 겹침까지 알려 경고가 소음이 된다',
    file: F,
    find: '  const set = new Set(mine.filter((f) => !IGNORE.some((re) => re.test(f))))',
    replace: '  const set = new Set(mine)',
    test: T,
    why: '매번 우는 경고는 안 읽는다 — 자리가 흩어진 번역 파일은 git 이 알아서 합친다.',
  },
]
