/**
 * 🧬 주입 — 배포 HTML 다이어트 (2026-10-15)
 */
const T = 'src/tests/unit/html-slim-2026-10-15.test.ts'
export default [
  {
    name: 'HTML다이어트 — JSON 시드까지 압축기에 넣는다',
    file: 'scripts/html-slim.mjs',
    find: "  if (!m) return true\n  return /^(text|application)\\/(javascript|ecmascript)$/i.test(m[1])",
    replace: '  return true',
    test: T,
    why: '__SSR_INITIAL_*__ JSON 을 JS 압축기에 넣으면 시드가 깨지고 첫 화면이 비어 로더로 돌아간다.',
  },
  {
    name: 'HTML다이어트 — 압축 실패 시 빌드를 깬다',
    file: 'scripts/html-slim.mjs',
    find: '      continue\n',
    replace: '      throw e\n',
    test: T,
    why: '인라인 스크립트 하나의 문법 문제로 배포 전체가 멈춘다.',
  },
  {
    name: 'HTML다이어트 — 문자열 치환으로 $& 를 망가뜨린다',
    file: 'scripts/html-slim.mjs',
    find: 'out = out.replace(j.whole, () => `<script${j.attrs}>${code}</script>`)',
    replace: 'out = out.replace(j.whole, `<script${j.attrs}>${code}</script>`)',
    test: T,
    why: '압축된 코드에 $& 나 $1 이 있으면 조용히 다른 코드가 배포된다.',
  },
  {
    name: 'HTML다이어트 — vite 에서 빠진다',
    file: 'vite.config.ts',
    find: "      name: 'ur-html-slim',\n      apply: 'build' as const,",
    replace: "      name: 'ur-html-slim',\n      apply: 'serve' as const,",
    test: T,
    why: '모듈은 남고 배포 HTML 은 주석 17KB 를 그대로 싣는다.',
  },
]
