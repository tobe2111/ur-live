/**
 * 🚦 CSS 먼저 → 스크립트 (2026-10-12, 대표 "첫 로딩이 중요해 · 대기업 수준이어야 해") — 주입 매니페스트.
 * 가드: src/tests/unit/css-first-boot-2026-10-12.test.ts
 */
const TEST = 'src/tests/unit/css-first-boot-2026-10-12.test.ts'
const MOD = 'src/worker/utils/css-first-boot.ts'

export default [
  {
    name: '🚦 백스톱이 사라져 CSS 신호가 안 오면 앱이 영영 안 뜬다',
    file: MOD,
    find: 'setTimeout(run,${critical ? CRITICAL_BACKSTOP_MS : CSS_FIRST_BACKSTOP_MS});',
    replace: '',
    test: TEST,
    why: '부팅 스크립트가 유일한 부팅 경로다 — 백스톱이 없으면 CSS load 이벤트를 놓친 기기에서 앱이 통째로 멈춘다.',
  },
  {
    name: '🚦 파싱 중에도 엔트리를 바로 실행한다(#root 없음)',
    file: MOD,
    find: "if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',entry,{once:true});else entry()",
    replace: 'entry()',
    test: TEST,
    why: '동적 module 스크립트는 defer 가 아니다 — 재방문(CSS 캐시)에서 #root 전에 실행돼 createRoot 가 터진다.',
  },
  {
    name: '🚦 CSS 판정이 아무 스타일시트에나 걸린다(폰트 CSS 로 조기 출발)',
    file: MOD,
    find: '&&${APP_CSS_TEST}.test(t.href||\'\')',
    replace: '',
    test: TEST,
    why: '폰트 CSS 가 먼저 오면 앱 CSS 를 기다리지 않고 스크립트가 출발해 다시 회선을 나눠 쓴다.',
  },
  {
    name: '🚦 워커 라우트 청크가 진짜 modulepreload 로 되돌아간다',
    file: 'src/worker/index.ts',
    find: '<link rel="${routePreloadRel(cssFirst)}" crossorigin href="${f}">',
    replace: '<link rel="modulepreload" crossorigin href="${f}">',
    test: TEST,
    why: '라우트 청크만 즉시 출발하면 처방이 반쪽이 된다 — 에러 없이 첫 화면만 다시 늦어진다.',
  },
  {
    // 🔁 2026-10-17 재조준 — 교환권 목록은 서버 첫 화면을 얻어 적용 표면이 됐다(css-first-boot.ts 머리말).
    //   불변식(스크립트에 달린 표면은 빼다)은 그대로이고, 남은 그런 표면인 지도로 옮겼다.
    name: '🚦 첫 화면 CSS 자격이 검색까지 넓어진다(서버 첫 화면이 없는 표면 — 2026-11-09 재조준: 지도는 껍데기 첫 화면이 생겨 정당해졌다)',
    file: MOD,
    find: "return pathname === '/' || pathname === '/vouchers'",
    replace: "return pathname === '/' || pathname === '/vouchers' || pathname === '/search'",
    test: TEST,
    why: '검색은 서버 첫 화면이 없다 — 첫 화면 CSS 자격을 주면 모르는 표면에 폰 CSS 를 인라인하거나(무게) 전체판 폴백으로 돌아간다. 지연 자체는 로더-먼저가 건다.',
  },
  {
    name: '🚦 PC 상세에도 첫 화면 CSS 를 넣는다(서버가 PC 상세 첫 화면을 안 그린다 — 2026-11-09 재조준: PC 홈만 예외)',
    file: MOD,
    find: "if (!shouldRenderMobileFirstScreen(ua)) return (pathname === '/' || pathname === '/index.html') || (!authed && guestTabOf(pathname) === 'login')",
    replace: "if (!shouldRenderMobileFirstScreen(ua)) return true",
    test: TEST,
    why: 'PC 홈 말고는 서버가 PC 첫 화면을 안 그린다 — 다른 PC 화면에 폰 표면 CSS 를 인라인하면 무게만 는다(로더-먼저만 걸어야 한다).',
  },
  {
    name: '🎨 로더-먼저 표면에서 토큰판을 안 넣는다(로더가 투명해진다 — 2026-11-09 배포 뒤 실측)',
    file: MOD,
    find: "const styleCss = crit ? critical : criticalCssUsable(tokens) ? tokens : ''",
    replace: "const styleCss = crit ? critical : ''",
    test: TEST,
    why: '검색·장바구니·뷰어의 로더가 var(--brand)·var(--rule) 값이 없어 투명 — 첫 그림이 앱 렌더(2초)까지 0.',
  },
  {
    name: '🚦 SideBanner 가 다시 폰에서도 마운트된다',
    file: 'src/App.tsx',
    find: '&& shellNeed.sideBanner && <Suspense fallback={null}><SideBanner /></Suspense>}',
    replace: '&& <Suspense fallback={null}><SideBanner /></Suspense>}',
    test: TEST,
    why: '폰에선 hidden 인 배너가 151KB 봉투를 부팅에 끌고 온다 — 에러 없이 첫 방문만 느려진다.',
  },
  {
    name: '🚦 생성기가 엔트리 CSS 를 안 넘긴다(Link 헤더가 폰트만 남는다)',
    file: 'scripts/generate-route-chunk-map.mjs',
    find: 'emit(out, entry.css, bootJs)',
    replace: 'emit(out, [], bootJs)',
    test: TEST,
    why: '빈 배열이면 에러 없이 Link 헤더에서 앱 CSS 가 빠진다 — Early Hints 가 켜져도 효과 0.',
  },
  {
    name: '🚦 Link 헤더에 스크립트까지 싣는다',
    file: MOD,
    find: "rel=preload; as=style${ENTRY_CSS_CROSSORIGIN ? '; crossorigin' : ''}`).join(', ')",
    replace: "rel=preload; as=style${ENTRY_CSS_CROSSORIGIN ? '; crossorigin' : ''}`).concat(['</assets/index.js>; rel=preload; as=style']).join(', ')",
    test: TEST,
    why: '스크립트가 103 으로 앞당겨지면 CSS 와 다시 회선을 나눠 쓴다.',
  },
]
