/**
 * 🧬 주입 — 업체 저장 0 의 이유를 남긴다 (2026-11-17, 프랜차이즈 98회 저장 0)
 *    가드: src/tests/unit/company-save-error-surface-2026-11-17.test.ts
 */
const T = 'src/tests/unit/company-save-error-surface-2026-11-17.test.ts'
const S = 'src/features/marketing/api/company-save.ts'
export default [
  { name: '저장진단 — 묶음 실패를 다시 삼킨다', file: S,
    find: "const res = await DB.batch(stmts).catch((e: unknown) => { batchError = batchError || String((e as { message?: string } | null)?.message || e).slice(0, 300); return null })",
    replace: 'const res = await DB.batch(stmts).catch(() => null)', test: T,
    why: '0건의 원인이 다시 어디에도 안 남는다(98회 그대로 반복).' },
  { name: '저장진단 — 전부 탈락 사유를 안 말한다', file: S,
    find: "  if (!rows.length) return { inserted: 0, upserted: 0, ...(leads.length ?", replace: "  if (!rows.length) return { inserted: 0, upserted: 0 }; if (false) return { inserted: 0, upserted: 0, ...(leads.length ?", test: T,
    why: '분류에서 걸린 것과 저장에서 깨진 것을 구분할 수 없다.' },
]
