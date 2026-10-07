/**
 * 🔢 숫자 글꼴 Roboto(대표 확정 2026-10-06) — 되돌려-검증 주입.
 */
const TEST = 'src/tests/unit/digits-font-2026-10-06.test.ts'
export default [
  {
    name: '🔢 계속 바뀌는 숫자만 다른 글꼴로 빠져나간다',
    file: 'src/index.css',
    find: '.dash-num { font-variant-numeric: tabular-nums;',
    replace: '.tabular-nums, .dash-num { font-family: "Pretendard Variable", sans-serif; }\n.dash-num { font-variant-numeric: tabular-nums;',
    test: TEST,
    why: 'Roboto 숫자는 처음부터 같은 폭이라 예외가 필요 없다 — 박으면 그 자리만 대표가 고른 글꼴이 아니다.',
  },
  {
    name: '🔢 본문 스택에서 UrDigits 가 빠진다(숫자 글꼴이 조용히 안 바뀐다)',
    file: 'src/index.css',
    find: '    font-family:\n      "UrDigits",\n',
    replace: '    font-family:\n',
    test: TEST,
    why: '@font-face 만 있고 스택에 없으면 아무 데서도 안 쓰인다 — 에러 없이 대표가 고른 글꼴이 사라진다.',
  },
  {
    name: '🔢 .dash-num 이 다시 터미널 글꼴',
    file: 'src/index.css',
    find: '.dash-num { font-variant-numeric: tabular-nums;',
    replace: ".dash-num { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums;",
    test: TEST,
    why: '대표가 "숫자가 너무 아날로그"라고 한 타자기 모양이 그것이다.',
  },
  {
    name: '🔢 숫자 글꼴 파일 경로가 옛 Poppins 로 돌아간다',
    file: 'src/index.css',
    find: "url('/static/fonts/roboto-digits-700.woff2')",
    replace: "url('/static/fonts/poppins-digits-700.woff2')",
    test: TEST,
    why: '그 파일은 지웠다 — 404 가 나도 화면은 조용히 Pretendard 로 떨어져 아무도 모른다.',
  },
]
