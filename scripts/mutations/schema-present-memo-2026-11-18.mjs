/** 🧬 주입 — schemaPresent 메모 키 (2026-11-18) · 가드: src/tests/unit/replica-session-no-ddl-2026-11-05.test.ts */
export default [
  { name: 'schemamemo: 메모 키가 세션 객체로 돌아간다', file: 'src/worker/utils/d1-read-replica.ts',
    find: '  const memoOwner = dbKey(DB)\n', replace: '  const memoOwner = DB\n',
    test: 'src/tests/unit/replica-session-no-ddl-2026-11-05.test.ts',
    why: '요청마다 새 세션이라 메모가 한 번도 안 맞고 sqlite_master 를 하루 2천 번 훑는다.' },
]
