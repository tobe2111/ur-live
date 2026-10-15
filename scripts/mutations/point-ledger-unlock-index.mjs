// 🩸 2026-10-15 — 라이브 point_transactions 에는 `idx_point_tx_user_type(user_id, type)` 이 있다.
//   SQLite 는 인덱스가 걸린 컬럼을 DROP 못 해서, 그 인덱스를 떼지 않으면 제약 제거가 중간에 멈춘다.
export default [
  {
    name: '🩸 원장 제약 제거가 type 인덱스를 떼지 않는다 (라이브에서 3번째 문장에 멈춘다)',
    file: 'src/worker/utils/point-ledger-unlock.ts',
    find: '    for (const d of deps) await DB.prepare(`DROP INDEX IF EXISTS "${d.name}"`).run()',
    replace: '    // 인덱스 떼기 생략',
    test: 'src/tests/unit/point-ledger-unlock.test.ts',
    why:
      '시험 스키마가 라이브 인덱스를 빠뜨렸던 탓에 종전 절차는 라이브에서 실패할 운명이었다. ' +
      '떼는 단계가 빠지면 DROP COLUMN 이 거부되고 `_type_bak` 만 남는다.',
  },
  {
    name: '🩸 원장 제약 제거 뒤 떼었던 type 인덱스를 다시 달지 않는다 (조회가 조용히 느려진다)',
    file: 'src/worker/utils/point-ledger-unlock.ts',
    find: '    for (const d of deps) await DB.prepare(ifNotExists(d.sql)).run()\n',
    replace: '\n',
    test: 'src/tests/unit/point-ledger-unlock.test.ts',
    why: '인덱스가 사라져도 에러는 없다 — 유저별·종류별 원장 조회만 풀스캔이 된다.',
  },
]
