/** 되돌려-검증 주입 — 백업 커서가 표를 이름으로 기억한다 (2026-11-22, 복구 연습 run 44663503923). 가드: d1-backup-chunked.test.ts */
const T = 'src/tests/unit/d1-backup-chunked.test.ts'
const F = 'src/worker/cron/d1-backup-chunked.ts'
export default [
  // ⚠️ '조각·행 수를 더한다' 주입은 넣지 않는다 — 커서가 이름으로 바뀐 뒤엔 같은 표를 두 번 거치지 않아 더하든 번호로 적든 결과가 같다(이중 방어).
  { name: 'backupname: 진행 중이던 표를 잊는다', file: F,
    find: "  const nextTable = (): string | undefined => cur!.table ?? tables.find((n) => !seen.has(n))",
    replace: "  const nextTable = (): string | undefined => tables.find((n) => !seen.has(n))", test: T,
    why: '도중에 생긴 앞쪽 표를 진행 중 rowid 로 읽어 0행으로 끝내고 넘어간다.' },
  { name: 'backupname: 순번으로 다음 표를 고른다(옛 동작)', file: F,
    find: "tables.find((n) => !seen.has(n))", replace: "tables[seen.size]", test: T,
    why: '새 표가 끼면 순번이 밀려 한 표를 처음부터 다시 뜨고 다른 표는 빠진다.' },
]
