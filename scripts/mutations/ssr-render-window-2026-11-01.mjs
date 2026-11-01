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
 */
const APP = 'src/App.tsx'
const SETUP = 'tests/setup.ts'
const TEST = 'src/tests/unit/ssr-render-window-2026-11-01.test.tsx'

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
]
