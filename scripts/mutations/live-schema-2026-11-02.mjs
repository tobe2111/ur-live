/**
 * 🗄️ 라이브 컬럼 사진 · 검색 엔진 상태 · 사진 가드로 찾은 결함 둘 (2026-11-02) — 주입 매니페스트.
 * 가드: src/tests/unit/search-live-schema-2026-11-02.test.ts · src/tests/unit/live-column-repairs-2026-11-02.test.ts
 *
 * 성질: 전부 **에러 없이** 망가지는 클래스다(틀린 컬럼 INSERT 를 catch 가 삼킴 · 폴백이 조용히 결과를 냄).
 * 그래서 되돌리면 빨간불이 뜨는지를 주입으로 고정한다.
 */
export default [
  {
    name: '🩸 단골 목록이 다시 빈다 (seller_follows.notify_new_product 보강 누락)',
    file: 'src/features/seller-public/api/seller-public.routes.ts',
    find: "    try { await DB.prepare(`ALTER TABLE seller_follows ADD COLUMN notify_new_product INTEGER DEFAULT 1`).run() } catch { /* exists */ }",
    replace: '',
    test: 'src/tests/unit/live-column-repairs-2026-11-02.test.ts',
    why: '2026-11-02 라이브 — 단골 3건이 있는데 /my/follows 가 매번 실패해 빈 목록이었다.',
  },
  {
    name: '🩸 탈퇴 기록이 다시 안 남는다 (deleted_accounts.reason 보강 누락)',
    file: 'src/worker/services/delete-account.service.ts',
    find: "    await db.prepare('ALTER TABLE deleted_accounts ADD COLUMN reason TEXT').run().catch(() => null)",
    replace: '',
    test: 'src/tests/unit/live-column-repairs-2026-11-02.test.ts',
    why: '2026-11-02 라이브 — reason 이 없어 INSERT 가 매번 실패, 탈퇴 기록 0행.',
  },
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
