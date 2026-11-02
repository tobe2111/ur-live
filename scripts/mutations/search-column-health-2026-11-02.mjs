/**
 * 🔦 검색이 조용히 망가지지 않게(#2094) — 주입 매니페스트. 인라인 배열 동결(2026-11-02) 뒤에 인라인으로 들어와
 *   `inline-mutations-frozen` 시험이 빨간불이던 2건을 그대로 옮겼다(내용 무변경).
 */
export default [
  {
    name: '🗄️ 컬럼 가드가 라이브 사진을 안 읽는다 (여러 벌 정의를 합쳐 틀린 컬럼이 통과)',
    file: 'scripts/check-sql-column-exists.mjs',
    find: "const LIVE = !process.argv.includes('--no-live') && fs.existsSync(LIVE_SNAPSHOT)",
    replace: 'const LIVE = false',
    test: 'src/tests/unit/search-live-schema-2026-11-02.test.ts',
    why: '2026-11-02 search_logs 가 0행이었던 이유 — 레포의 두 정의를 합쳐 보니 틀린 컬럼도 통과했다.',
  },
  {
    name: '🔦 옛 검색으로 내려간 사실이 응답에서 사라진다 (4주간 조용한 실패)',
    file: 'src/features/products/services/ProductService.ts',
    find: 'searchMode: this.repository.lastSearchMode,',
    replace: '',
    test: 'src/tests/unit/search-live-schema-2026-11-02.test.ts',
    why: '2026-09 랭킹 검색이 매번 죽고 조용히 내려간 것을 4주간 몰랐다. 응답에 실려야 배포 점검이 본다.',
  },
]
