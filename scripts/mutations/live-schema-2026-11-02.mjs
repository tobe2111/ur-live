/**
 * 🗄️ 라이브 컬럼 사진 · 검색 엔진 상태 · 사진 가드로 찾은 결함 둘 (2026-11-02) — 주입 매니페스트.
 * 가드: src/tests/unit/live-column-repairs-2026-11-02.test.ts
 * (사진 가드·검색 상태 주입 2건은 search-live-schema-2026-11-02.mjs 에 있다 — #2089 와 #2098 이 같은 둘을 각각 옮겨 중복됐던 것을 2026-11-02 정리)
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
]
