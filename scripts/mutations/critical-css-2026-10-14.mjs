/**
 * 🎨 첫 화면 전용 CSS (2026-10-14 — 구글로 들어온 첫 방문이 빈 화면 2초) — 주입 매니페스트.
 * 가드: src/tests/unit/critical-css-2026-10-14.test.ts
 */
const TEST = 'src/tests/unit/critical-css-2026-10-14.test.ts'
const MOD = 'src/worker/utils/css-first-boot.ts'
const GEN = 'scripts/generate-critical-css.mjs'

export default [
  {
    name: '🧱 표면 상한을 생성기가 강제하지 않는다(시험만 본다)',
    file: GEN,
    find: '    if (v.length > CRITICAL_SURFACE_MAX_BYTES) throw new Error(`[critical-css] ${k} 표면 CSS ${v.length}B > 표면 상한 ${CRITICAL_SURFACE_MAX_BYTES}B — 그 첫 화면 모듈이 무관한 클래스를 끌고 왔는지 확인`)\n',
    replace: '',
    test: TEST,
    why: '빌드가 40KB 넘는 표면 CSS 를 그대로 손님 HTML 에 인라인한다(첫 왕복이 통째로 CSS).',
  },
  {
    name: '🧱 표면 상한을 조용히 올린다',
    file: GEN,
    find: 'export const CRITICAL_SURFACE_MAX_BYTES = 40_000',
    replace: 'export const CRITICAL_SURFACE_MAX_BYTES = 60_000',
    test: TEST,
    why: '상한은 사람이 근거와 함께 올리는 결정이다(2026-11-09 대표 승인으로 표면별 40KB).',
  },
  {
    name: '🎨 앱 CSS 링크를 media=print 로 바꾸지 않는다',
    file: MOD,
    find: "el.setAttribute('media', 'print')",
    replace: "el.setAttribute('data-noop', 'print')",
    test: TEST,
    why: '첫 화면 CSS 를 넣고도 앱 CSS 가 여전히 렌더를 막는다 — 바이트만 늘고 빨라지지 않는다.',
  },
  {
    name: '🎨 앱 CSS 가 와도 media=all 로 되돌리지 않는다',
    file: MOD,
    find: "for(var k=0;k<cs.length;k++)cs[k].media='all';",
    replace: '',
    test: TEST,
    why: '앱 CSS 가 영영 적용되지 않는다 — React 가 첫 화면 CSS 만 있는 채로 나머지 화면을 그린다.',
  },
  {
    name: '🎨 첫 화면 CSS 응답에서도 백스톱이 3초',
    file: MOD,
    find: '${critical ? CRITICAL_BACKSTOP_MS : CSS_FIRST_BACKSTOP_MS}',
    replace: '${CSS_FIRST_BACKSTOP_MS}',
    test: TEST,
    why: '느린 회선에서 앱 CSS 가 오기 전에 스크립트가 출발해 스타일이 깨진 화면이 그려진다.',
  },
  {
    name: '🎨 ROOTS 에서 첫 화면 모듈 하나를 뺀다',
    file: GEN,
    find: "  'src/worker/utils/curator-ssr-body.ts',\n",
    replace: '',
    test: TEST,
    why: '유어샵 첫 화면의 클래스가 첫 화면 CSS 에 없어, 앱 CSS 가 붙는 순간 화면이 바뀐다.',
  },
  {
    name: '🎨 대시보드 필터가 :not() 안의 글자까지 본다',
    file: GEN,
    find: 'DASHBOARD_ONLY.test(positivePart(s))',
    replace: 'DASHBOARD_ONLY.test(s)',
    test: TEST,
    why: '다크 변형(…:not(.admin-light-theme *))이 전부 지워져 다크 모드 첫 화면이 라이트로 그려진다.',
  },
]
