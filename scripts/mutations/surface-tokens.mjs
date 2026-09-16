/**
 * 🧬 주입 — 표면 토큰 채택 (2026-09-15 "색 정리")
 *
 * 여기서 지키는 것은 전부 **에러 없이 조용히 되돌아간다**. 토큰이 고정 hex 로 돌아가도,
 * 되박기 목록에서 스코프 하나가 빠져도 빌드는 초록이다. ②는 특히 고약하다 —
 * **라이트 모드에서는 아무 일도 안 일어나고**, OS 가 다크인 사용자의 셀러 대시보드만 검게 뜬다.
 */
const TEST = 'src/tests/unit/surface-tokens-2026-09-15.test.ts'
const TW = 'tailwind.config.js'
const CSS = 'src/index.css'

export default [
  {
    name: '[색정리] 🎨 surface 가 다시 고정 흰색이 된다',
    file: TW,
    find: "        surface: 'var(--surface)',",
    replace: "        surface: '#FFFFFF',",
    test: TEST,
    why:
      '고정 hex 로 돌아가면 `bg-surface` 가 다크에서도 흰색이라, 화면마다 다시 ' +
      '`dark:bg-[#1D1F29]` 를 손으로 적게 된다 — 1,776번 재입력하던 그 상태로의 복귀다.',
  },
  {
    name: '[색정리] 🔴 셀러 대시보드가 되박기 목록에서 빠진다',
    file: CSS,
    find: '.light-island, .force-light-theme, .admin-light-theme, .agency-light-theme, .seller-light-theme {',
    replace: '.light-island, .force-light-theme, .admin-light-theme, .agency-light-theme {',
    test: TEST,
    why:
      '대시보드는 화이트 고정이다(CLAUDE.md "🚨 절대 규칙"). 이 한 셀렉터가 빠지면 ' +
      '`html.dark` 에서 셀러 대시보드가 `--bg`(#11141C)를 읽어 **배경이 검게** 뜬다. ' +
      '라이트 사용자에겐 아무 일도 안 일어나므로 개발 중엔 안 보인다.',
  },
  {
    name: '[색정리] 🩶 되박기 블록이 --surface 를 빠뜨린다',
    file: CSS,
    find: '  --surface: #FFFFFF;\n  --line: #EAE4E0;',
    replace: '  --line: #EAE4E0;',
    test: TEST,
    why: '스코프는 목록에 있는데 토큰 하나가 빠지는 형태 — 카드만 검게 뜬다. 더 찾기 어렵다.',
  },
  {
    name: '[색정리] 🚧 코드모드가 gray-100 까지 접는다 (화면이 바뀐다)',
    file: 'scripts/codemods/adopt-surface-tokens.mjs',
    find: "  ['border-gray-200', 'dark:border-[#2C2F35]', 'border-line'],",
    replace: "  ['border-gray-200', 'dark:border-[#2C2F35]', 'border-line'],\n  ['border-gray-100', 'dark:border-[#2C2F35]', 'border-line'],",
    test: TEST,
    why:
      'gray-100 은 #F3EEEA, `--line` 라이트는 #EAE4E0 — **다른 값**이다. 접으면 258곳의 ' +
      '라이트 화면이 조용히 바뀐다. "값이 한 글자도 안 바뀌는 짝만" 이 이 작업의 유일한 안전선이다.',
  },
  {
    name: '[색정리] 🚧 코드모드가 bg-white→#11141C 까지 접는다 (디자인 결정 침범)',
    file: 'scripts/codemods/adopt-surface-tokens.mjs',
    find: "  ['bg-white', 'dark:bg-[#1D1F29]', 'bg-surface'],",
    replace: "  ['bg-white', 'dark:bg-[#1D1F29]', 'bg-surface'],\n  ['bg-white', 'dark:bg-[#11141C]', 'bg-surface'],",
    test: TEST,
    why:
      '같은 `bg-white` 가 321곳에선 페이지(#11141C), 168곳에선 카드(#1D1F29)로 간다. ' +
      '어느 쪽이 맞는지는 **대표 판단**이지 기계가 고를 일이 아니다.',
  },
  {
    name: '[색정리] 📏 래칫이 CI 에서 빠진다',
    file: '.github/workflows/verify.yml',
    find: '        run: node scripts/check-consumer-hex-ratchet.mjs',
    replace: '        run: echo skip',
    test: TEST,
    why: '가드가 파일로만 있고 안 돌면 "지키는 척" 이다 — 이 레포가 반복해 당한 클래스.',
  },
  {
    name: '[색정리] 📏 래칫이 대상 0건일 때 통과한다',
    file: 'scripts/check-consumer-hex-ratchet.mjs',
    find: 'if (files.length < 300) {',
    replace: 'if (false) {',
    test: TEST,
    why: '경로 목록이 낡아 파일을 하나도 못 찾으면 **늘 초록**이 된다. 0건은 통과가 아니다.',
  },
]
