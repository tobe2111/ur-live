/**
 * 🗑️ 이용권 등록 임시저장 제거 — 되돌려-검증 주입 (2026-10-06 대표 "그냥 없애줘").
 */
export default [
  {
    name: '🗑️ 이용권 등록에 자동저장이 되살아난다',
    file: 'src/pages/SellerMealVoucherNewPage.tsx',
    find: '  // 🗑️ 2026-10-06 (대표 "임시저장된 작성 내용이 있어요',
    replace: '  useEffect(() => { saveVoucherDraft(form, 0) }, [form])\n  // 🗑️ 2026-10-06 (대표 "임시저장된 작성 내용이 있어요',
    test: 'src/tests/unit/voucher-draft.test.ts',
    why: '자동저장이 돌면 다음 진입에 "임시저장된 작성 내용이 있어요" 를 다시 띄우고 싶어진다 — 대표가 불편하다며 없앤 그 흐름.',
  },
]
