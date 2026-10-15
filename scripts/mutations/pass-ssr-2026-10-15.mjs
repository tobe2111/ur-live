/**
 * 🧊 이용권 상세 서버 렌더 3단계(앱 전체 + 이어받기) — 주입 매니페스트.
 * 가드: src/tests/unit/pass-ssr-2026-10-15.test.ts · src/tests/unit/app-hydrate-2026-10-15.test.tsx
 *
 * 이 결함들은 **화면을 안 깨뜨린다** — 워커가 조용히 종전 손그림 첫 화면으로 폴백하거나(서버 렌더가 꺼진 채),
 * React 가 서버 화면을 조용히 버리고 다시 그리거나(이어받기 이득 0), 앱이 붙기 전 누름이 사라질 뿐이다.
 * 에러가 없어 아무도 신고하지 않는다.
 */
const TEST = 'src/tests/unit/pass-ssr-2026-10-15.test.ts'
const HYD = 'src/tests/unit/app-hydrate-2026-10-15.test.tsx'

export default [
  {
    name: '🧊 워커가 상세 서버 렌더를 안 부른다(손그림만)',
    file: 'src/worker/index.ts',
    find: "const firstScreen = appSsr ? '' : buildDetailFirstScreen(",
    replace: 'const firstScreen = buildDetailFirstScreen(',
    test: TEST,
    why: '서버가 그린 앱 대신 손그림이 나간다 — 가격·구매하기가 다시 앱 코드 뒤로 1.3초 밀린다(에러 0).',
  },
  {
    name: '🧊 #root 에 이어받기 표식을 안 단다',
    file: 'src/worker/index.ts',
    find: 'el.setAttribute(SSR_APP_ATTR, SSR_APP_VALUE); ',
    replace: '',
    test: TEST,
    why: '브라우저가 서버 화면을 이어받지 않고 통째로 다시 그린다 — 누를 수 있는 시점이 그만큼 늦다.',
  },
  {
    name: '🧊 누름 기억 스크립트를 #root 안에 넣는다',
    file: 'src/worker/index.ts',
    find: "el.setInnerContent(appSsr ? appSsr.root : (firstScreen || urdealLoaderHtml), { html: true });",
    replace: "el.setInnerContent(appSsr ? appSsr.root + appSsr.after : (firstScreen || urdealLoaderHtml), { html: true });",
    test: TEST,
    why: 'React 가 모르는 노드가 #root 안에 생겨 이어받기가 갈린다 — 서버 화면을 버리고 다시 그린다.',
  },
  {
    name: '🧊 PC 에서도 서버 렌더를 쓴다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: '  if (!isPassSsrPath(o.pathname) || !isMobileUserAgent(o.userAgent)) return null',
    replace: '  if (!isPassSsrPath(o.pathname)) return null',
    test: TEST,
    why: '서버는 좁은 화면으로 그린다 — PC 는 넓은 화면 부품이 이어받은 뒤 끼어들어 내용이 밀린다.',
  },
  {
    name: '🧊 캐시에 있어도 매번 다시 그린다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: '      if (hit) body = await hit.text()',
    replace: '      if (hit && false) body = await hit.text()',
    test: TEST,
    why: '상품마다 같은 HTML 인데 요청마다 리액트 렌더를 돈다 — 격리 첫 렌더 비용(번들 초기화)을 매번 낸다.',
  },
  {
    name: '🧊 캐시 키가 주소(쿼리)를 안 본다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: "await sha1Hex(o.payload + '\\n' + url)",
    replace: 'await sha1Hex(o.payload)',
    test: TEST,
    why: '?new=1 같은 주소로 그린 화면이 다른 주소에 나간다 — 그 화면을 이어받으면 갈린다.',
  },
  {
    name: '🧊 이상하게 짧은 렌더를 그대로 보낸다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: '      if (!body || body.length < 5000) return null',
    replace: '      if (!body) return null',
    test: TEST,
    why: '로더나 빈 화면이 그려진 결과를 캐시까지 해서 10분 동안 모든 손님에게 보낸다.',
  },
  {
    name: '🧊 배포 빌드가 서버 렌더 번들을 안 만든다',
    file: 'package.json',
    find: '&& npm run build:ssr-pass && npm run build:worker',
    replace: '&& npm run build:worker',
    test: TEST,
    why: '워커가 스텁을 묶어 서버 렌더가 조용히 꺼진다 — 빌드·배포는 초록이다.',
  },
  {
    name: '🧊 앱이 붙기 전 누른 구매하기를 버린다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: "  useEffect(() => { if (consumeEarlyTap('buy') && isJoinable && !isPrelaunch) setOpen(true) }, [])",
    replace: '  useEffect(() => {}, [])',
    test: TEST,
    why: '서버가 그린 구매하기를 눌렀는데 앱이 붙은 뒤에도 아무 일이 없다 — 다시 눌러야 한다.',
  },
  {
    name: '🧊 누름 기억이 링크까지 막는다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: "t.closest('#root [data-early-tap]')",
    replace: "t.closest('#root a,#root [data-early-tap]')",
    test: TEST,
    why: '가게 보기·길찾기 같은 링크는 앱 없이도 이동해야 한다 — 막으면 그 1~2초 동안 링크가 죽는다.',
  },
  {
    name: '🧊 누름 기억이 전파를 안 멈춘다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: 'e.preventDefault();e.stopPropagation();window.__urEarlyTap',
    replace: 'e.preventDefault();window.__urEarlyTap',
    test: TEST,
    why: '이어받는 React 도 같은 클릭을 받아 다시 실행한다 — 창이 두 번 토글돼 열렸다 닫힌다.',
  },
  {
    name: '🧊 이어받은 뒤에도 누름을 가로챈다',
    file: 'src/lib/early-tap.ts',
    find: '  w.__urHydrated = true\n',
    replace: '',
    test: TEST,
    why: '버튼이 붙은 뒤의 클릭도 스크립트가 삼킨다 — 구매하기가 영영 안 열린다.',
  },
  {
    name: '🧊 셸 문지기가 렌더 중 localStorage 를 직접 읽는다',
    file: 'src/App.tsx',
    find: '<SignedInOnly><Suspense fallback={null}><PushNotificationSetup /></Suspense></SignedInOnly>',
    replace: "{(() => { try { return !!localStorage.getItem('user_id') } catch { return false } })() && <Suspense fallback={null}><PushNotificationSetup /></Suspense>}",
    test: HYD,
    why: '서버(없음)와 로그인한 브라우저(있음)가 첫 렌더부터 갈린다 — React 가 서버 화면을 버리고 다시 그린다(에러 0).',
  },
  {
    name: '🧊 문지기 읽기를 이어받기 영역 바깥(AppContent)으로 올린다',
    file: 'src/App.tsx',
    find: '<SignedInOnly><Suspense fallback={null}><PushNotificationSetup /></Suspense></SignedInOnly>',
    replace: "{!!useStoredValue('user_id') && <Suspense fallback={null}><PushNotificationSetup /></Suspense>}",
    test: HYD,
    why: '이어받기가 끝나기 전에 바뀐 값이 영역 안으로 흘러든다 — "received an update before it finished hydrating" 로 영역 전체를 다시 그린다.',
  },
  {
    name: '🧊 서버가 요청마다 새 QueryClient 를 안 쓴다',
    file: 'src/ssr/pass-detail-entry.tsx',
    find: '          queryClient={qc}\n',
    replace: '',
    test: HYD,
    why: '모듈 하나의 QueryClient 를 요청끼리 나눠 쓴다 — 다른 요청의 상품이 섞이거나 옛 시드로 그린다.',
  },
  {
    name: '🧊 서버가 문구 준비를 안 기다리고 그린다',
    file: 'src/ssr/pass-detail-entry.tsx',
    find: "Promise.all([i18nReady, preloadBootPage('gbDetail')])",
    replace: "Promise.all([preloadBootPage('gbDetail')])",
    test: HYD,
    why: '서버가 critical 문구만으로 그리고 브라우저는 core 까지 받은 뒤 이어받는다 — 글자가 갈려 화면을 버린다.',
  },
]
