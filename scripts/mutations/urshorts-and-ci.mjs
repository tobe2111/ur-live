/**
 * 🧬 유어쇼츠 뷰어 · CI 주입 스코핑 — 되돌려-검증 주입.
 *
 * **분할 매니페스트의 첫 파일이다** (2026-09-08). 규칙은 `check-guard-mutations.mjs` 의
 * "📁 분할 매니페스트" 주석에 있다 — 요지는 `export default [ … ]` 하나, 이름은 전체에서 유일.
 *
 * ⚠️ 여기 담긴 것은 **오늘 이 PR 에서 새로 만든 8건뿐**이다. 이미 main 에 있는 주입은
 * 옮기지 않았다 — 지금 열려 있는 다른 세션 브랜치들이 그 배열을 만지고 있어, 통째로 옮기면
 * 그 브랜치가 전부 깨진다. 옛 배열은 그대로 두고 **새 주입만 여기로** 온다.
 */
export default [
  {
    name: '🎬 뷰어에 영상 번호(1 / 3)가 되돌아온다',
    file: 'src/pages/VideosPage.tsx',
    find: '        <X size={18} />',
    replace: "        <X size={18} />\n      </button>\n      <span>{idx + 1} / {items.length}",
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '대표가 2026-09-08 에 "3/3 이런거 안나오면 좋겠어 지금 번잡해" 로 지웠다. 우상단 숫자 하나가 ' +
      '유튜브 자기 아이콘들 옆에 붙어 화면이 시끄러워진다 — 기능이 아니라 소음이라 아무도 버그로 안 본다.',
  },
  {
    name: '🎬 스와이프가 다시 iframe 에 먹힌다 (제스처 층이 아래로)',
    file: 'src/pages/VideosPage.tsx',
    find: 'className="absolute inset-0 z-10"',
    replace: 'className="absolute inset-0 -z-10"',
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '교차 출처 iframe 은 터치·휠을 자기가 먹고 부모에게 안 넘긴다. 층이 iframe 아래로 내려가면 ' +
      '핸들러가 한 번도 안 불리는데 **코드는 멀쩡해 보인다** — 실제로 그 상태로 배포돼 있었다.',
  },
  {
    name: '🎬 유튜브 컨트롤이 되살아나 구매 바와 겹친다',
    file: 'src/pages/VideosPage.tsx',
    // 🩸 2026-09-08: `{ autoplay: true, controls: false }` 만 쓰면 **대상이 2곳**이 됐다
    //    (IFrame API 경로 `youTubePlayerVars(...)` + 폴백 `youTubeEmbedUrl(...)`). 함수 이름까지 앵커.
    find: 'youTubePlayerVars({ autoplay: true, controls: false })',
    replace: 'youTubePlayerVars({ autoplay: true })',
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '실측(430×608): 유튜브 진행 바 56px · Shorts 로고 18px, 구매 바는 10~76px — 이용권을 붙이면 ' +
      '아래쪽에 세 겹이 쌓인다. 대표가 렌더 보기 전에 먼저 알아챈 그 겹침이다.',
  },
  {
    name: '⏱️ 전수 워크플로까지 좁혀 돌아 전수가 사라진다',
    file: '.github/workflows/guard-mutations-full.yml',
    find: '        run: node scripts/check-guard-mutations.mjs -s',
    replace: '        run: node scripts/check-guard-mutations.mjs --changed -s',
    test: 'src/tests/unit/guard-mutations-scope.test.ts',
    why:
      'PR 이 --changed 로 좁힌 만큼을 되찾는 곳이 여기뿐이다. 여기까지 좁히면 전수는 어디서도 안 도는데 ' +
      '**아무 에러도 안 난다** — 이 레포가 반복해 당한 "검사가 실패하는 게 아니라 아예 안 도는" 클래스.',
  },
  {
    name: '⏱️ 전수의 야간 보증이 사라진다 (schedule 제거)',
    file: '.github/workflows/guard-mutations-full.yml',
    find: '  schedule:',
    replace: '  x-schedule-off:',
    test: 'src/tests/unit/guard-mutations-scope.test.ts',
    why:
      'main push 만 남으면 main 이 조용한 날 전수가 며칠씩 안 돈다. 그 사이 쌓인 헛도는 가드는 ' +
      '아무도 모른다 — 야간이 유일한 "하루 한 번은 반드시" 보증이다.',
  },
  {
    name: '⏱️ 가드 자신을 고쳐도 좁혀 돈다 (fail-safe 제거)',
    file: 'scripts/guard-mutations-scope.mjs',
    find: "  'scripts/',                        // 가드 스크립트 자신(매니페스트 · 이 파일 포함)",
    replace: '  // (fail-safe 제거됨)',
    test: 'src/tests/unit/guard-mutations-scope.test.ts',
    why:
      '주입을 새로 추가하는 PR 이 자기 주입을 안 돌리게 된다. 새 주입이 헛돌아도 그 PR 은 초록이고, ' +
      '전수가 도는 다음 날에야 드러난다 — 그때는 이미 머지돼 있다.',
  },
  {
    name: '⏱️ 좁힘이 아무것도 안 걸러 --changed 가 무의미해진다',
    file: 'scripts/guard-mutations-scope.mjs',
    find: '  return scope.files.has(m.file) || scope.files.has(m.test)',
    replace: '  return true',
    test: 'src/tests/unit/guard-mutations-scope.test.ts',
    why:
      '옵션은 받는데 전부 통과시켜 CI 가 그대로 48분이다. 느려지는 것뿐이라 사람이 버그로 안 읽고 ' +
      '"좁혔는데 왜 안 빨라지지" 로만 남는다.',
  },
  {
    name: '⏱️ 바뀐 파일 0개를 "돌 것 없음" 으로 읽는다',
    file: 'scripts/guard-mutations-scope.mjs',
    find: "  if (list.length === 0) return '바뀐 파일이 0개로 보인다 — 믿지 않고 전수로 돈다'",
    replace: '  if (list.length === 0) return null',
    test: 'src/tests/unit/guard-mutations-scope.test.ts',
    why:
      'base 계산이 틀려도 0 개가 나온다. 그걸 믿으면 **주입을 하나도 안 돌리고 초록**이 뜬다 — ' +
      '이 레포가 반복해 당한 "측정 0 = 통과" 그 자체다.',
  },
  {
    name: '📁 분할 매니페스트를 안 읽는다 (로더 제거)',
    file: 'scripts/check-guard-mutations.mjs',
    find: 'const ALL = [...MUTATIONS, ...SPLIT]',
    replace: 'const ALL = [...MUTATIONS]',
    test: 'src/tests/unit/guard-mutations-scope.test.ts',
    why:
      '분할 파일의 주입이 통째로 안 돌게 되는데 **개수만 줄고 에러는 없다**. 새 주입을 거기 넣은 ' +
      '다음 세션은 자기 가드가 검증됐다고 믿는다 — 이 레포가 반복해 당한 "조용한 부재" 그대로다.',
  },
  {
    name: '📁 분할 파일이 융합-키 검사를 안 받는다',
    file: 'scripts/check-guard-mutations.mjs',
    find: '  ...SPLIT_FILES.flatMap((f) => scanIntegrity(',
    replace: '  ...[].flatMap((f) => scanIntegrity(',
    test: 'src/tests/unit/guard-mutations-scope.test.ts',
    why:
      '병합이 `},{` 경계를 삼켜 주입 둘이 한 객체로 융합되면 앞 항목이 통째로 사라진다(2026-09-02 에 ' +
      '10건이 그 상태로 main 에 있었다). 나누면서 그 보호만 빠지는 것이 가장 흔한 퇴행이다.',
  },
  {
    name: '🔇 자막이 한 번만 꺼진다 (다음 영상에서 되살아난다)',
    file: 'src/pages/VideosPage.tsx',
    find: '        onStateChange: (e) => {\n          killCaptions(e.target)',
    replace: '        onStateChange: (e) => {',
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '`loadVideoById` 로 다음 영상이 오면 유튜브가 자막 모듈을 **다시 싣는다.** onReady 에서만 끄면 ' +
      '첫 편만 깨끗하고 두 번째부터 자막이 돌아온다 — 대표가 처음 신고한 그 화면으로 되돌아가는데 ' +
      '테스트도 에러도 없다.',
  },
  {
    name: '🔇 자막 모듈을 하나만 내린다 (세대가 다르면 안 꺼진다)',
    file: 'src/pages/videos/youtube-player.ts',
    find: "export const CAPTION_MODULES = ['captions', 'cc'] as const",
    replace: "export const CAPTION_MODULES = ['captions'] as const",
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '유튜브가 플레이어 세대에 따라 `captions` 와 `cc` 중 하나를 쓴다. 하나만 부르면 **어떤 기기에서는 ' +
      '꺼지고 어떤 기기에서는 안 꺼진다** — 재현이 안 되는 결함이 되어 원인을 못 찾는다.',
  },
  {
    name: '🎬 재생기가 둘 이상 살아남는다 (중복 생성 가드 제거)',
    file: 'src/pages/VideosPage.tsx',
    find: "    if (apiState !== 'ready' || playerRef.current) return",
    replace: "    if (apiState !== 'ready') return",
    test: 'src/tests/unit/urshorts-core.test.ts',
    why:
      '유튜브 재생기는 무겁다. effect 가 다시 돌 때마다 하나씩 더 붙으면 폰에서 화면이 멈추는데, ' +
      '앞의 것이 소리 없이 계속 재생돼 **소리만 겹친다** — 에러가 없어 원인을 엉뚱한 데서 찾게 된다.',
  },
  {
    name: '🎬 전환이 갈아 끼우기가 아니라 재부팅이 된다',
    file: 'src/pages/VideosPage.tsx',
    find: '    try { p.loadVideoById(wantId) }',
    replace: '    try { void p }',
    test: 'src/tests/unit/urshorts-core.test.ts',
    why:
      'IFrame API 경로에서 이 한 줄이 빠지면 **넘겨도 영상이 안 바뀐다.** 구매 바와 카운터는 다음 ' +
      '영상으로 바뀌는데 화면만 그대로라, 사용자는 우리가 엉뚱한 상품을 파는 것으로 본다.',
  },
  {
    name: '🎬 나갈 때 재생기를 안 치운다 (postMessage 리스너가 남는다)',
    file: 'src/pages/VideosPage.tsx',
    find: '      try { playerRef.current?.destroy() } catch',
    replace: '      try { void 0 } catch',
    test: 'src/tests/unit/urshorts-core.test.ts',
    why:
      '뷰어를 닫아도 유튜브 iframe 과 리스너가 남는다. 홈으로 돌아온 뒤에도 **소리가 계속 나는** ' +
      '형태로 드러나는데, 그때쯤이면 어느 화면이 원인인지 알기 어렵다.',
  },
  {
    name: '🛟 API 가 안 오면 화면이 검게 죽는다 (폴백 제거)',
    file: 'src/pages/VideosPage.tsx',
    find: "      {apiState === 'off' && cur && (",
    replace: '      {false && cur && (',
    // 🩸 처음에 viewer-chrome 을 가리켰다가 **초록**이 떴다(그 파일은 로더와 로딩 게이트만 본다).
    //    폴백 마크업을 고정하는 단언은 core 쪽에 있다 — 되돌려-검증이 이 오조준을 잡았다.
    test: 'src/tests/unit/urshorts-core.test.ts',
    why:
      '광고 차단기나 네트워크로 `iframe_api` 가 막힌 사용자에게 `/videos` 가 **아무것도 없는 검은 화면**이 ' +
      '된다. 우리 콘솔엔 에러가 없고 그 사용자는 신고도 안 한다 — 그냥 안 돌아온다.',
  },
  {
    name: '🛟 로더가 실패를 던진다 (검은 화면 + 콘솔만 빨강)',
    file: 'src/pages/videos/youtube-player.ts',
    find: '    s.onerror = () => { clearTimeout(timer); finish(null) }',
    replace: '    s.onerror = () => { clearTimeout(timer); reject(new Error("yt api")) }',
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '이 Promise 는 `apiState` 를 정하는 유일한 경로다. reject 하면 `.then` 이 안 불려 화면이 ' +
      '**로더에서 영원히 멈춘다** — "느리다"로 보고되고 원인은 스크립트 차단이다.',
  },
  {
    name: '👆 탭 일시정지가 사라진다 (controls=0 인데 대신할 것이 없다)',
    file: 'src/pages/VideosPage.tsx',
    find: '          if (Math.abs(dy) < 12 && Date.now() - touchAt.current < 400) togglePlay()',
    replace: '          if (Math.abs(dy) < 12 && Date.now() - touchAt.current < 400) return',
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '`controls=0` 으로 유튜브 조작을 끄고 그 위를 제스처 층이 덮었으니, 이걸 지우면 **영상을 멈출 ' +
      '방법이 하나도 없다.** 기능이 사라진 게 아니라 처음부터 없던 것처럼 보여 아무도 버그로 안 적는다.',
  },
  {
    name: '👆 탭 한 번에 두 번 토글된다 (합성 click 가드 제거)',
    file: 'src/pages/VideosPage.tsx',
    find: '          if (Date.now() - touchEndAt.current < 600) return',
    replace: '          if (false) return',
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '모바일 브라우저는 터치 뒤에 합성 click 을 한 번 더 쏜다. 두 번 토글되면 **탭해도 아무 일도 ' +
      '안 일어난 것처럼** 보인다(멈췄다 곧바로 재생) — 재현이 기기 의존이라 원인 찾기가 오래 걸린다.',
  },
  {
    name: '🎞️ PC 레일 화살표가 다시 죽는다 (group 제거)',
    file: 'src/components/home/UrShortsRail.tsx',
    find: '      <div className="group relative">',
    replace: '      <div className="relative">',
    test: 'src/tests/unit/urshorts-core.test.ts',
    why:
      '`group-hover:grid` 는 조상에 `group` 이 없으면 **영원히 안 걸린다.** 기본값이 `hidden` 이라 ' +
      '화살표가 한 번도 안 뜨는데 에러도 경고도 없다 — 2026-09-08 까지 실제로 그 상태였고, ' +
      '대표에게는 "넘길 방법이 없는 레일"로 보였다.',
  },
  {
    name: '🔁 영상이 끝나면 유튜브 끝 화면이 뜬다 (반복 재생 제거)',
    file: 'src/pages/VideosPage.tsx',
    find: "          if (e.data === (st?.ENDED ?? 0)) { try { e.target.playVideo() }",
    replace: '          if (false) { try { e.target.playVideo() }',
    test: 'src/tests/unit/urshorts-viewer-chrome.test.ts',
    why:
      '10~18초짜리가 끝나면 유튜브가 **관련 영상 끝 화면**을 깐다. 그걸 누른 사람은 우리 화면을 ' +
      '떠나고 다시 안 온다 — 매출 장치로 놓은 것이 이탈 장치가 되는 정확한 지점이다.',
  },
  {
    name: '⏱️ 준비 전에 넘기면 그 영상에서 굳는다 (playerReady 게이트 제거)',
    file: 'src/pages/VideosPage.tsx',
    find: '    if (!p || !playerReady || !wantId || loadedRef.current === wantId) return',
    replace: '    if (!p || !wantId || loadedRef.current === wantId) return',
    test: 'src/tests/unit/urshorts-core.test.ts',
    why:
      '재생기는 `onReady` 전에는 명령을 못 받아 `loadVideoById` 가 던진다. 그 예외를 삼키면 ' +
      '`loadedRef` 만 앞서 나가 **넘겨도 영상이 안 바뀐다** — 구매 바는 다음 상품인데 화면은 이전 ' +
      '영상이라, 우리가 엉뚱한 상품을 파는 것처럼 보인다.',
  },
  {
    name: '🧭 저장된 지역이 다시 거리순을 막는다 (홈이 인기순으로 되돌아감)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: "    () => (readCachedLoc() ? 'near' : 'popular'),",
    replace: "    () => (readCachedLoc() && !readHomeRegion().regionKey ? 'near' : 'popular'),",
    // 🩸 2026-09-08: 처음엔 `home-nearest-first` 를 가리켰는데, 같은 날 그 계약을 **이 파일로 옮기면서**
    //    거기엔 규칙이 안 남았다 → 결함을 심어도 초록. CI 가 잡았다(계약을 옮기면 주입 지도도 옮긴다).
    test: 'src/tests/unit/home-top-banner-and-near-default.test.ts',
    why:
      '예전에 지역을 한 번 골라 둔 사람은 위치가 잡혀 있어도 영영 인기순이 된다. 그런데 헤더는 ' +
      '동네 이름을 띄우므로 **화면과 목록이 서로 다른 말을 한다** — 대표가 "동탄5동" 아래 서울 강남 ' +
      '딜을 본 그 화면이다. 에러가 없어 아무도 버그로 안 적는다.',
  },
  {
    name: '🧭 좌표가 있는데도 저장된 지역을 씌운다 (헤더와 목록이 어긋난다)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: 'useState<HomeRegion>(() => (readCachedLoc() ? {} : readHomeRegion()))',
    replace: 'useState<HomeRegion>(() => readHomeRegion())',
    test: 'src/tests/unit/home-top-banner-and-near-default.test.ts',
    why:
      '헤더는 위치를 우선해 "동탄5동"을 띄우는데 목록만 저장된 지역으로 걸린다. 그 지역에 딜이 0건이면 ' +
      '전체 폴백까지 걸려 **그 동네 이름 아래 엉뚱한 도시 딜**이 뜬다 — 목록이 거짓말을 하는 상태다.',
  },
  {
    name: '📛 정렬 알약이 남의 라벨을 그린다 (거리순인데 "인기순"이라고 적힘)',
    file: 'src/pages/main-home/GroupBuyFeed.tsx',
    find: 'options={userLoc ? [NEAR_SORT, ...SORTS] : SORTS}',
    replace: 'options={SORTS}',
    test: 'src/tests/unit/home-nearest-first.test.ts',
    why:
      '`SortMenu` 는 `value` 가 `options` 에 없으면 조용히 `options[0]` 을 그린다. 그래서 실제로는 ' +
      '거리순인 화면이 **"인기순"이라고 적혀 있었고**, 다른 정렬을 한 번 고르면 거리순으로 돌아갈 길이 ' +
      '없었다(일방통행). 라벨이 틀린 것은 에러가 아니라 조용한 거짓말이다.',
  },
  {
    name: "🗺️ 지도 시트 맨 위를 '오늘의 핫딜'이 다시 가로챈다",
    file: 'src/pages/RestaurantMapPage.tsx',
    find: '            <RestaurantList',
    replace: '            <HeroCarousel heroDeals={[]} userLoc={userLoc} onSelect={selectAndPan} />\n            <RestaurantList',
    test: 'src/tests/unit/map-chips-b.test.ts',
    why:
      '대표가 "거리순이 가장 우선"이라 못박은 자리다. 할인율순 다섯 장이 거리순 목록 위에 서면 ' +
      '화면 맨 위가 가까운 곳이 아니게 되고, 거리 1등과 할인 1등이 같으면 한 화면에 같은 카드가 ' +
      '두 번 뜬다(대표 실측). 게다가 수요 로딩 이후엔 "전체 중 top 5"도 아니다.',
  },
  {
    name: '🌑 잉크 패널에 light-island 이 되돌아온다 (라이트에서 글자가 사라진다)',
    file: 'src/components/home/UrShortsRail.tsx',
    find: 'className="ur-home-panel ur-panel-ink"',
    replace: 'className="ur-home-panel ur-panel-ink light-island"',
    test: 'src/tests/unit/urshorts-rail-ink-panel.test.ts',
    why:
      '`light-island` 은 안쪽 `dark:` 유틸을 **전부 끈다**. 배경이 잉크인 채로 그게 켜지면 라이트 ' +
      '모드에서 회색 글자가 살아나 잉크 위 잉크색이 된다 — 다크에서 보면 멀쩡해서 못 본다. ' +
      '2026-09-03 지도 검색창(흰 배경 위 흰 글자 1.1:1)과 정확히 같은 클래스다.',
  },
  {
    name: '🌑 잉크 패널 위에 라이트 회색 글자가 돌아온다',
    file: 'src/components/home/UrShortsRail.tsx',
    find: 'text-[17px] font-black tracking-tight text-white',
    replace: 'text-[17px] font-black tracking-tight text-gray-900',
    test: 'src/tests/unit/urshorts-rail-ink-panel.test.ts',
    why:
      '패널이 늘 어두우므로 라이트 회색 토큰은 어느 테마에서도 안 읽힌다. 그런데 `check-theme-consistency` ' +
      '는 `text-gray-900`+`dark:text-white` 짝만 보므로 **짝을 갖춰 놓으면 통과한다** — 배경이 늘 ' +
      '어둡다는 사실은 그 가드가 모른다.',
  },
  {
    name: '🌑 색면 토큰 대신 새 hex 를 발명한다',
    file: 'src/index.css',
    find: '.ur-panel-ink {\n  background: var(--home-field);',
    replace: '.ur-panel-ink {\n  background: #1B1E27;',
    test: 'src/tests/unit/urshorts-rail-ink-panel.test.ts',
    why:
      '09-02 표면 규칙은 "표면 두 톤"이다. 여기서 넷째 회색을 만들면 홈에 색면이 두 벌이 되어 ' +
      '히어로(--home-field)와 이 패널이 미묘하게 어긋난다 — 한쪽만 바꾸는 날 이음매가 드러난다. ' +
      '같은 실수를 카드 할인 빨강에서 이미 한 번 했다(#FF8A93 발명 후 되돌림).',
  },
  {
    name: '🎬 스크롤이 바깥 컨테이너로 옮겨져 유어쇼츠 진입점이 같이 밀린다',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '<div className="flex items-end gap-3 px-4">\n        <nav aria-label="카테고리" className="flex min-w-0 flex-1 gap-5 overflow-x-auto scrollbar-hide">',
    replace: '<div className="flex items-end gap-3 px-4 overflow-x-auto scrollbar-hide">\n        <nav aria-label="카테고리" className="flex min-w-0 flex-1 gap-5">',
    test: 'src/tests/unit/home-shorts-entry.test.ts',
    why:
      '"두 칸으로 나눈 걸 한 칸으로 합치자" 는 흔한 정리다. 그 순간 진입점의 shrink-0 가 무의미해지고 ' +
      '카테고리와 함께 스크롤된다. 이 결함은 **화면으로 안 보인다** — 카테고리가 다섯 개라 스크롤이 ' +
      '안 생기기 때문이다. 하나만 늘어나는 날 진입점이 조용히 화면 밖으로 사라진다.',
  },
  {
    name: '🔵 유어쇼츠 마침표가 점으로 떨어진다 (뱃지로 읽힌다)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '유어쇼츠<span className="-ml-[3px] text-brand-text">.</span>',
    replace: '유어쇼츠<span className="ml-1 text-brand-text">.</span>',
    test: 'src/tests/unit/home-shorts-entry.test.ts',
    why:
      '붙은 마침표는 로고 `urdeal.` 과 같은 **서명**이라 상시로 켜 둬도 안 낡는다. 띄우는 순간 ' +
      '바로 옆 알림 종 때문에 **뱃지**로 읽혀, 한 주면 배경이 되고 진짜 뱃지의 신뢰도까지 깎인다.',
  },
  {
    name: '🎬 쇼츠 아이콘 재생 삼각형이 선이 된다 (16px 에서 속이 빈다)',
    file: 'src/components/icons/urdeal-icons.tsx',
    find: '<path d="M10.6 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none" />',
    replace: '<path d="M10.6 9.2v5.6l4.6-2.8z" />',
    test: 'src/tests/unit/home-shorts-entry.test.ts',
    why:
      '실제로 쓰이는 크기가 16px 다. 삼각형을 획 1.6 선으로 그리면 그 크기에서 속이 비어 ' +
      '무엇인지 안 읽힌다(시안에서 40px·16px 를 나란히 놓고 판정한 기준이 이것 하나였다).',
  },
]
