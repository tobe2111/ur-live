/**
 * 🧯 분할 백업 표 구조 · 복구 연습 (2026-11-18) — 주입 매니페스트.
 * 가드: src/tests/unit/restore-drill-chunked-2026-11-18.test.ts · src/tests/unit/d1-backup-chunked.test.ts
 */
export default [
  {
    name: '🧯 분할 백업이 표 구조(schema.sql)를 다시 안 남긴다(되살릴 수 없는 백업)',
    file: 'src/worker/cron/d1-backup-chunked.ts',
    find: "  await bucket.put(`backups/${cur.date}/${label}/schema.sql`, schemaSql, { httpMetadata: { contentType: 'application/sql' } })\n",
    replace: '',
    test: 'src/tests/unit/restore-drill-chunked-2026-11-18.test.ts',
    why: '조각엔 INSERT 행만 있다 — 표를 만들 구조가 없으면 빈 DB 에 되살릴 방법이 없다.',
  },
  {
    name: '🧯 복구 연습이 행 수 대조를 건너뛴다(잘린 백업을 성공으로 본다)',
    file: 'scripts/restore-drill-chunked.mjs',
    find: "      if (got !== want) problems.push(`${label}: ${t} 행 수 ${got} ≠ 백업 기록 ${want}`)\n",
    replace: '',
    test: 'src/tests/unit/restore-drill-chunked-2026-11-18.test.ts',
    why: '조각 하나가 빠져도 "되살아났다" 로 보고된다 — 없는 것보다 나쁜 백업 신뢰.',
  },
]
