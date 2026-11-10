/** 🗄️ 2026-11-10 — NOT NULL INSERT 검사의 라이브 사진 대조. 가드: src/tests/unit/not-null-guard-live-schema-2026-11-10.test.ts */
const TEST = 'src/tests/unit/not-null-guard-live-schema-2026-11-10.test.ts'
export default [
  {
    name: '[notnull] 라이브에 없는 컬럼을 다시 누락으로 센다',
    file: 'scripts/check-sql-not-null-insert.mjs',
    find: '        if (liveCols(table) && !liveCols(table).has(colName)) continue\n',
    replace: '',
    test: TEST,
    why: '매 커밋 거짓 경고 2건 — 진짜 경고가 묻힌다.',
  },
  {
    name: '[notnull] 사진에 표가 있으면 무조건 거른다',
    file: 'scripts/check-sql-not-null-insert.mjs',
    find: 'if (liveCols(table) && !liveCols(table).has(colName)) continue',
    replace: 'if (liveCols(table)) continue',
    test: TEST,
    why: '진짜 누락(500 에러)까지 통과한다.',
  },
]
