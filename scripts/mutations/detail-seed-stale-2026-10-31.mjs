/** 🧬 주입 — 목록 행 시드가 상세 재요청을 막는다(2026-10-31). 가드: src/tests/unit/detail-seed-stale-2026-10-31.test.ts */
const T = 'src/tests/unit/detail-seed-stale-2026-10-31.test.ts'
export default [
  {
    name: 'detail-seed — 목록 행을 신선한 상세로 넣는다',
    file: 'src/hooks/queries/useGroupBuyProduct.ts',
    find: '  qc.setQueryData(key, p, { updatedAt: 0 })',
    replace: '  qc.setQueryData(key, p)',
    test: T,
    why: '새로고침해야 사진이 다 보인다(대표 신고).',
  },
  {
    name: 'detail-seed — 진짜 상세를 목록 행으로 덮는다',
    file: 'src/hooks/queries/useGroupBuyProduct.ts',
    find: '  if (qc.getQueryData(key) !== undefined) return\n',
    replace: '',
    test: T,
    why: '상세를 본 뒤 홈에 다녀오면 설명·사진이 줄어든다.',
  },
]
