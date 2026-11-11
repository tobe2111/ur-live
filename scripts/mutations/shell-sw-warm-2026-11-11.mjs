/** 🧬 주입 — 재방문 즉시 표시 첫 방문 데우기. 가드: src/tests/unit/shell-sw-warm-2026-11-11.test.ts */
const T = 'src/tests/unit/shell-sw-warm-2026-11-11.test.ts'
const F = 'public/shell-sw.js'
export default [
  { name: 'SW데우기 — 활성화 때 데우지 않는다(즉시 표시가 세 번째 방문부터)', file: F, find: '    await warmOpenWindows()\n', replace: '', test: T, why: '2026-11-11 실측 — 2차 방문 0.89s, 3차 0.24s.' },
  { name: 'SW데우기 — 울타리 없이 아무 주소나 받는다(로그인·결제 화면까지 저장)', file: F, find: "      if (!shouldHandle(url, 'GET', 'navigate', self.location.origin)) continue\n", replace: '', test: T, why: '2026-04-27 카카오 로그인 사고의 울타리.' },
  { name: 'SW데우기 — 저장본이 있어도 또 받는다(첫 방문마다 HTML 두 번)', file: F, find: '      if (await cache.match(cacheKey(pathname, variant))) continue\n', replace: '', test: T, why: '불필요한 서버 요청.' },
  { name: 'SW데우기 — 상한을 없앤다', file: F, find: 'for (var i = 0; i < wins.length && n < WARM_MAX; i++) {', replace: 'for (var i = 0; i < wins.length; i++) {', test: T, why: '창이 많으면 그만큼 HTML 을 받는다.' },
]
