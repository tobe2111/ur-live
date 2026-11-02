/**
 * 🧱 서버 렌더가 `window` 를 읽으면 prerender 가 죽는다 (2026-11-01).
 *
 * 실제 사고: `App.tsx` 의 Suspense 폴백이 렌더 중 `window.location.pathname` 을 읽어
 * `npm run build` 의 prerender 단계가 **몇 달간 매번** 처리 안 된 예외로 죽었다. 그런데
 * ① `drop_console` 이 entry-server 의 안전판 로그를 전부 제거하고 ② 그 폴백이 같은 에러를
 * React 콜백 안에서 다시 던져 `.catch` 밖으로 나가고 ③ `package.json` 의 `|| echo` 가
 * exit code 를 삼켜 **빌드는 초록**이었다 — "실패" 가 아니라 "조용한 부재" 클래스.
 *
 * 아래 둘은 방향이 반대다. 하나는 결함을 되살리고(동작 판정이 잡는다), 하나는 "고친 척"
 * (`typeof window` 가드로 서버가 기본값을 **짐작**)을 되살린다 — 후자는 렌더가 안 터지므로
 * 동작 판정만으로는 통과하고, 소스 단언만이 잡는다. 둘 다 있어야 가드가 양방향으로 선다.
 *
 * 🔁 2026-11-01 후속 — 그 단계는 이제 **검사기**(`scripts/check-ssr-render-window.mjs`)다.
 *    `allReady` 를 켜서 검사 범위를 앱 트리 전체로 넓히고 산출물은 쓰지 않는다(사유·실측:
 *    그 파일 머리말). 뒤쪽 🔬 주입들이 그 계약을 양방향으로 고정한다 — 특히 ⓐ 원 결함인
 *    `null` 인자 ⓑ 그 반대 방향(빌드 체인을 strict 로 만들어 **배포를 막는** 쪽)이다.
 */
const APP = 'src/App.tsx'
const SETUP = 'tests/setup.ts'
const TEST = 'src/tests/unit/ssr-render-window-2026-11-01.test.tsx'
const GUARD = 'scripts/check-ssr-render-window.mjs'
const VP = 'scripts/visual-preview.mjs'
const ENTRY = 'src/entry-server.tsx'

export default [
  {
    name: '🧱 폴백이 다시 렌더 중 window.location 을 읽는다 (prerender 사망)',
    file: APP,
    find: 'const PageLoader = ({ pathname }: { pathname: string }) => <BootFirstScreenLoader forceDark={isDarkLoaderSurface(pathname)} />',
    replace: 'const PageLoader = () => <BootFirstScreenLoader forceDark={isDarkLoaderSurface(window.location.pathname)} />',
    test: TEST,
    why:
      '이 사고의 원문 그대로. 빌드도 화면도 안 깨지고 prerender 만 조용히 죽으므로, 서버 렌더를 ' +
      '실제로 돌려 보는 동작 판정이 유일한 신호다.',
  },
  {
    name: '🧱 서버가 경로를 짐작한다 (typeof window 가드로 "고친 척")',
    file: APP,
    find: 'forceDark={isDarkLoaderSurface(pathname)} />',
    replace: "forceDark={isDarkLoaderSurface(typeof window !== 'undefined' ? window.location.pathname : '/')} />",
    test: TEST,
    why:
      '렌더가 안 터지므로 동작 판정은 통과한다. 그런데 서버는 /videos 를 그릴 때도 기본값 / 을 ' +
      '골라 다크 표면에 흰 로더를 내고, 경로의 출처가 라우터와 두 벌이 된다 — 소스 단언이 잡는다.',
  },
  {
    name: '🧱 setup.ts 가 다시 node 환경에서 TypeError 를 낸다',
    file: SETUP,
    find: "const __win: any = typeof window !== 'undefined' ? window : {}",
    replace: 'const __win: any = window',
    test: TEST,
    why:
      'node 환경 시험이 import 단계에서 통째로 죽는다 — 그러면 위 렌더 판정이 아예 돌지 못한다. ' +
      '가드가 "실패" 가 아니라 "부재" 로 사라지는 바로 그 모양이라 따로 고정한다.',
  },
  {
    name: '🔬 검사기가 다시 2번째 인자로 null 을 넘긴다 (allReady 가 0ms 로 죽는다)',
    file: GUARD,
    find: "await serverEntry.renderAppComplete('/')",
    replace: "await serverEntry.renderAppComplete('/', null)",
    test: TEST,
    why:
      '원 결함 그대로. `renderAppComplete(url, timeoutMs = 20000)` 이라 null 이 타임아웃이 되고 ' +
      '(기본값은 undefined 에만 적용) 즉시 renderToString 폴백 → 검사 범위가 Suspense 폴백까지로 ' +
      '좁아진다. 렌더는 "성공" 하므로 글자수·폴백 로그만이 신호다.',
  },
  {
    name: '🔬 검사기가 다시 index.html 을 쓴다 (라이브가 버리는 19KB 를 굽는다)',
    file: GUARD,
    find: "import { existsSync } from 'node:fs'",
    replace: "import { existsSync, writeFileSync } from 'node:fs'",
    test: TEST,
    why:
      '쓰기 수단이 돌아오면 다음 세션이 "산출물도 쓰면 좋지" 로 되살린다. 라이브는 워커가 #root 를 ' +
      '100% 교체하므로 그 19KB 는 매 응답에서 파싱된 뒤 버려진다(실측 28,568 → 47,860B).',
  },
  {
    name: '🔬 검사기가 renderApp(renderToString) 폴백으로 조용히 떨어진다',
    file: GUARD,
    find: "if (typeof serverEntry.renderAppComplete !== 'function') {",
    replace: "if (!(serverEntry.renderAppComplete || serverEntry.renderApp)) {",
    test: TEST,
    why:
      '폴백은 "lazy 모듈을 안 보는 모드" 다. 둘은 같은 빌드에서 나오므로 구버전 대비가 필요 없고, ' +
      '남겨 두면 검사 범위가 에러 없이 좁아진다 — 2026-07-05 결함이 3년 산 그 길이다.',
  },
  {
    name: '🔬 검사기가 폴백 여부를 감시하지 않는다 (stderr 가로채기 제거)',
    file: GUARD,
    find: 'if (s.includes(\'[entry-server]\')) ssrLogs.push(s.trim())',
    replace: 'void s',
    test: TEST,
    why:
      'timeoutMs 가 다시 null 이 되면 렌더는 성공하고 글자수만 줄어든다. 폴백을 **썼다는 사실**은 ' +
      'entry-server 의 stderr 로그에만 나타나므로, 이 감시가 없으면 원 결함이 다시 조용해진다.',
  },
  {
    name: '🔬 검사기의 글자수 하한이 사라진다 (빈 렌더가 통과)',
    file: GUARD,
    find: 'const MIN_CHARS = 5000',
    replace: 'const MIN_CHARS = 0',
    test: TEST,
    why:
      '"측정 0 = 통과" 는 이 레포가 반복해 당한 헛도는 가드다. 하한은 폴백(3,077자)과 실제 ' +
      '마크업(20,192자) 사이여야 폴백을 반드시 잡는다.',
  },
  {
    name: '🔬 PR 게이트가 strict 를 뺀다 (검사가 다시 로그 속 침묵이 된다)',
    file: '.github/workflows/verify.yml',
    find: 'node scripts/ci-run.mjs node scripts/check-ssr-render-window.mjs --strict',
    replace: 'node scripts/ci-run.mjs node scripts/check-ssr-render-window.mjs',
    test: TEST,
    why:
      '빌드 체인은 일부러 실패를 삼킨다(배포를 막지 않는다). 그래서 **막는 자리는 PR 하나뿐**이고 ' +
      '여기서 strict 를 빼면 결함이 어디서도 안 막힌다 — 원 사고와 똑같은 모양이 된다.',
  },
  {
    name: '🔬 반대 방향 — 빌드 체인이 strict 로 배포를 막는다',
    file: 'package.json',
    find: "(npm run check:ssr-render || echo '[build] WARN ssr-render-window FOUND DEFECTS",
    replace: "(npm run check:ssr-render --strict && echo '[build] ssr-render OK",
    test: TEST,
    why:
      '"엄격한 쪽이 낫다" 는 유혹의 반대 방향. 이 검사는 앱 트리 전체를 Node 에서 렌더하므로 ' +
      '의존성 하나가 모듈 평가 중 window 를 읽으면 그날부터 main 배포가 통째로 멎는다.',
  },
  {
    name: '🔬 하네스의 #root 비우기가 다시 리터럴이 된다 (헛돈다)',
    file: VP,
    find: 'html = html.replace(/<div id="root"[^>]*>[\\s\\S]*?<\\/div>\\s*(?=<script)/',
    replace: 'html = html.replace(/<div id="root">[\\s\\S]*?<\\/div>\\s*(?=<script)/',
    test: TEST,
    why:
      '실제 태그는 `<div id="root" role="application" aria-label="…">` 라 리터럴은 **한 번도 매치되지 ' +
      '않는다**. 그러면 하네스 6개가 라이브와 다른 첫 프레임을 보는데 에러가 안 난다(몇 달간 그랬다).',
  },
  {
    name: '🔬 entry-server 머리말이 "lazy 는 safe" 로 돌아간다',
    file: ENTRY,
    find: ' *   - 🔴 **lazy import 페이지도 안전하지 않다**(2026-11-01 정정).',
    replace: ' *   - lazy import 페이지는 Suspense fallback 만 렌더 (실제 module 평가 안 됨, safe).',
    test: TEST,
    why:
      'allReady 는 lazy 모듈을 끝까지 평가한다. 그 문장이 "safe" 로 남아 있던 것이 이 결함의 ' +
      '사각지대였고, 되돌아가면 다음 세션이 lazy 페이지를 검사 밖으로 읽는다.',
  },
]
