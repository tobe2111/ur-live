/**
 * 🔢 숫자 글꼴 Poppins(대표 확정 2026-10-06) — 되돌려-검증 주입.
 */
const TEST = 'src/tests/unit/digits-font-poppins-2026-10-06.test.ts'
export default [
  {
    name: '🔢 계속 바뀌는 숫자에도 Poppins 가 먹는다(시계가 다시 떨린다)',
    file: 'src/index.css',
    find: '.tabular-nums, .dash-num { font-family: "Pretendard Variable",',
    replace: '.tabular-nums, .dash-num { font-family: "UrDigits", "Pretendard Variable",',
    test: TEST,
    why: 'Poppins 숫자는 tabular-nums 를 무시한다 — 초가 바뀔 때마다 폭이 출렁인다(1111 150px vs 0000 261px).',
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
]
