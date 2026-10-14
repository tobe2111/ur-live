export default [
  {
    name: '[shift-compare] 같은 글자 개수가 달라도 첫 번째끼리 짝짓는다',
    file: 'scripts/shift-compare.mjs',
    find: '    if (ys.length !== ys2.length) continue\n',
    replace: '',
    test: 'src/tests/unit/shift-compare-2026-10-14.test.ts',
    why: '하단 탭 라벨과 새 제목이 같은 글자면 812px 밀림으로 읽혀 거짓 빨간불이 난다.',
  },
  {
    name: '[shift-compare] 진짜 밀림을 놓친다',
    file: 'scripts/shift-compare.mjs',
    find: '      if (Math.abs(d) > threshold) {',
    replace: '      if (false) {',
    test: 'src/tests/unit/shift-compare-2026-10-14.test.ts',
    why: '읽던 줄이 밀려도 초록 — 밀림 가드가 헛돈다.',
  },
]
