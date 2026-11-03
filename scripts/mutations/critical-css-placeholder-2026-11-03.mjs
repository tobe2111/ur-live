/**
 * 🧬 주입 — 첫 화면 CSS 자리표시자 (2026-11-03)
 *    가드: src/tests/unit/critical-css-placeholder-2026-11-03.test.ts
 */
const T = 'src/tests/unit/critical-css-placeholder-2026-11-03.test.ts'
export default [
  {
    name: '🎨 첫 화면 CSS 를 다시 추적 파일에 커밋한다 (머지마다 충돌)',
    file: 'src/worker/generated/critical-css.ts',
    find: "export const CRITICAL_CSS: string = ''",
    replace: "export const CRITICAL_CSS: string = '.x{color:red}'",
    test: T,
    why: '59KB 한 줄을 커밋하면 동시에 고친 PR 끼리 무조건 충돌한다(3일 머지 109건 중 16건).',
  },
  {
    name: '🎨 플러그인이 빌드 파일로 바꿔 끼우지 않는다 (첫 화면 CSS 가 조용히 빠진 배포)',
    file: 'scripts/critical-css-plugin.cjs',
    find: '        return { path: fs.existsSync(BUILD) ? BUILD : PLACEHOLDER };',
    replace: '        return { path: PLACEHOLDER };',
    test: T,
    why: '에러 없이 첫 화면이 앱 CSS 를 기다리게 된다 — 느려질 뿐이라 아무도 모른다.',
  },
  {
    name: '🎨 번들 대조가 CSS 누락을 그냥 넘긴다',
    file: 'scripts/critical-css-plugin.cjs',
    find: '  if (!probe || !out.includes(probe)) {',
    replace: '  if (false) {',
    test: T,
    why: '플러그인이 헛돌아도 빌드가 초록이다.',
  },
  {
    name: '🎨 워커 빌드에서 첫 화면 CSS 대조를 뺀다',
    file: 'scripts/build-worker.js',
    find: "    assertCriticalCssBundled('dist/_worker.js');",
    replace: '',
    test: T,
    why: '대조가 있어도 안 부르면 지키는 척만 한다.',
  },
]
