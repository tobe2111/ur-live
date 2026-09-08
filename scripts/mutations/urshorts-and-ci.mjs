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
    find: '{ autoplay: true, controls: false }',
    replace: '{ autoplay: true }',
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
]
