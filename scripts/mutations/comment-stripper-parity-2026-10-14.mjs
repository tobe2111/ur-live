/**
 * 🧬 2026-10-14 — `.mjs` 주석 제거기가 문자열·템플릿·정규식을 추적하는가.
 *
 * 근거는 `scripts/comment-strip.mjs` 머리말(실측: `app.use('/api/*', m());` 한 줄이 다음 닫는
 * 기호까지 코드를 통째로 지웠다). 이 클래스의 피해는 **빨간불이 아니라 초록불**이라
 * (증발한 구간은 검사에서 사라진다) 사람이 아니라 주입이 센다.
 *
 * 🔀 절반은 **반대 방향**이다 — 문자열을 추적한다며 주석을 남기기 시작하면 em-dash 래칫이
 *   635건으로 돌아가고 그 값으로는 진짜 문구 회귀가 숨는다.
 */
const STRIP = 'scripts/comment-strip.mjs'
const TEST = 'src/tests/unit/comment-stripper-parity-2026-10-14.test.ts'

export default [
  {
    name: '🔧 제거기 — 문자열·템플릿 추적을 없앤다 (문자열 속 /* 가 다시 코드를 먹는다)',
    file: STRIP,
    find: "      if (c === '\"' || c === \"'\" || c === '`') {",
    replace: "      if (false) {",
    test: TEST,
    why:
      '이 분기 하나가 2026-10-14 사고의 수리 전부다 — 없으면 `app.use(\'/api/*\', …)` 가 ' +
      '블록주석을 열어 `worker/index.ts` 의 `<title>` 문자열이 증발한다.',
  },
  {
    name: '🔧 제거기 — 정규식 리터럴 추적을 없앤다 (`/[\'"]/` 안의 따옴표가 문자열을 연다)',
    file: STRIP,
    find: "      if (c === '/' && prev !== '<' && /[(,=:[!&|?{};+\\-*%^~<>]/.test(prev) && hasCloserOnLine(src, i, '/')) {",
    replace: "      if (false) {",
    test: TEST,
    why:
      '정규식을 안 건너뛰면 `/[\'"]/` 의 따옴표가 문자열 시작으로 읽혀 **다음 따옴표까지** 통째로 ' +
      '문자열이 되고, 그 사이의 주석이 전부 살아남는다(= em-dash 래칫이 터진다).',
  },
  {
    name: '🔧 제거기 — JSX 닫는 태그를 정규식으로 읽는다 (`prev !== \'<\'` 제거)',
    file: STRIP,
    find: "      if (c === '/' && prev !== '<' && ",
    replace: "      if (c === '/' && ",
    test: TEST,
    why:
      '`</div>` 의 `/` 를 정규식 시작으로 읽으면 다음 `/` 까지 삼킨다 — `source-text.ts` 가 ' +
      '2026-09-13 에 `RegisterPage.tsx` 15,428자 중 141자만 지우고 있던 그 사고다.',
  },
  {
    name: "🔧 제거기 — 아포스트로피 안전판을 없앤다 (`don't` 가 문자열을 연다)",
    file: STRIP,
    find: "        if (c !== '`' && !hasCloserOnLine(src, i, c)) { buf += c; prev = c; i++; continue }",
    replace: '',
    test: TEST,
    why:
      'JSX 본문의 `don\'t`·`대표\'s` 를 문자열 시작으로 보면 **다음 따옴표까지**(여러 줄 넘어) ' +
      '문자열이 되어 그 사이 주석이 살아남는다. 그 줄에서 닫히지 않으면 문자열이 아니다.',
  },
  {
    name: '🔧 제거기 — 여러 줄 템플릿에서 줄번호를 세지 않는다 (가드 좌표가 전부 밀린다)',
    file: STRIP,
    find: "          if (d === '\\n') { flush(); line++; i++; continue }   // 백틱 여러 줄",
    replace: "          if (d === '\\n') { buf += d; i++; continue }",
    test: TEST,
    why:
      '줄번호가 밀리면 가드가 가리키는 `파일:줄` 이 전부 틀려진다 — 틀린 좌표는 "없는 결함" 처럼 ' +
      '읽혀서 고치는 사람이 그 자리를 못 찾는다.',
  },
  {
    name: '🔁 제거기 반대 방향 — 블록 주석을 안 지운다 (em-dash 래칫이 635건으로)',
    file: STRIP,
    find: "      if (c2 === '/*') { mode = 'block'; i += 2; continue }",
    replace: '',
    test: TEST,
    why:
      '"문자열을 추적한다" 를 과하게 적용해 주석을 남기는 쪽으로 퇴화하는 것을 막는다 — ' +
      '주석의 em-dash 635건 사이에 진짜 문구 회귀가 숨는다.',
  },
  {
    name: '🔁 제거기 반대 방향 — 탐침 목록을 비운다 (②③ 이 0회 반복으로 통과)',
    file: TEST,
    // 🩸 첫 판은 `([] as never[]).length ? [] as never : [` 였는데 `[].length` 가 0(falsy)이라
    //   **원본 배열로 떨어지는 no-op** 이었다. 주입이 자기 자신을 검증해 준 자리다.
    find: 'const PROBES: Array<[name: string, src: string, keep: string[], drop: string[]]> = [',
    replace:
      'const PROBES: Array<[name: string, src: string, keep: string[], drop: string[]]> = []\\n' +
      'const PROBES_UNUSED: Array<[name: string, src: string, keep: string[], drop: string[]]> = [',
    test: TEST,
    why:
      '목록이 비면 `for` 가 0회 돌아 ②③ 이 **전부 사라진다**(실패가 아니라 부재). ①의 하한이 ' +
      '그걸 잡는다 — 이 레포가 반복해 밟은 "헛도는 시험" 자리.',
  },
  {
    name: '🔁 제거기 반대 방향 — `{}` 정규화가 아무 차이나 봐준다',
    file: TEST,
    find: "const normBraces = (s: string) => s.replace(/\\{\\}/g, '')",
    replace: "const normBraces = (s: string) => s.replace(/[^가-힣]/g, '')",
    test: TEST,
    why:
      '정규화를 넓히면 ⑦ 이 **어떤 차이도 통과**시킨다(의도된 `{}` 차이만 봐주려던 장치가 ' +
      '탈출구가 된다). ⑧ 이 *차이가 정확히 `{}` 뿐인가* 를 따로 재는 이유다.',
  },
]
