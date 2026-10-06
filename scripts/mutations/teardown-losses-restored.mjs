/**
 * 되돌려-검증 주입 — 철거로 잃은 둘 복원 (2026-10-06)
 * 가드: src/tests/unit/teardown-losses-restored-2026-10-06.test.ts
 */
export default [
  {
    name: '잃은것① 환불 사유 입력이 사라진다(확인 창만 남는다)',
    file: 'src/pages/seller-orders/refund-prompt.ts',
    find: 'return promptDialog({',
    replace: 'return confirmDialog({},' + ' // eslint-disable-line\n  // @ts-expect-error 주입\n  ) as never || promptDialogX({',
    test: 'src/tests/unit/teardown-losses-restored-2026-10-06.test.ts',
    why: '되돌릴 수 없는 환불에 이유가 안 남는다 — 분쟁의 유일한 근거가 사라진다.',
  },
  {
    name: '잃은것① 취소해도 환불이 나간다',
    file: 'src/pages/SellerOrdersPage.tsx',
    find: 'if (reason === null) return',
    replace: 'if (reason === null) { /* 그대로 진행 */ }',
    test: 'src/tests/unit/teardown-losses-restored-2026-10-06.test.ts',
    why: '창을 닫은 사람에게 환불이 실행된다 — 되돌릴 수 없는 일이다.',
  },
  {
    name: '잃은것① 사유가 서버로 안 간다(빈 본문)',
    file: 'src/pages/SellerOrdersPage.tsx',
    find: `/refund\`, {
        reason: reason.trim() || REFUND_REASON_FALLBACK,
      })`,
    replace: '/refund`, {})',
    test: 'src/tests/unit/teardown-losses-restored-2026-10-06.test.ts',
    why: '입력은 받고 보내지 않는다 — 사람에겐 적게 하고 기록엔 안 남는 최악의 조합이다.',
  },
  {
    name: '잃은것② 가격변경 확인이 사라진다',
    file: 'src/pages/seller-product-edit/confirm-price-change.ts',
    find: '  if (nextPrice === basePrice) return true',
    replace: '  if (true) return true',
    test: 'src/tests/unit/teardown-losses-restored-2026-10-06.test.ts',
    why: '한 손 실수가 손님이 보는 값을 그대로 바꾼다.',
  },
  {
    name: '잃은것② 물어 보고도 저장한다(거절 분기 제거)',
    file: 'src/pages/SellerProductEditPage.tsx',
    find: 'if (!(await confirmPriceChange(t, product?.price, formData.price))) return',
    replace: 'await confirmPriceChange(t, product?.price, formData.price)',
    test: 'src/tests/unit/teardown-losses-restored-2026-10-06.test.ts',
    why: '확인 창이 장식이 된다 — 거절해도 가격이 바뀐다.',
  },
  {
    name: '잃은것② 가격이 안 바뀌어도 매번 묻는다(경고가 죽는다)',
    file: 'src/pages/seller-product-edit/confirm-price-change.ts',
    find: 'if (nextPrice === basePrice) return true',
    replace: 'if (false) return true',
    test: 'src/tests/unit/teardown-losses-restored-2026-10-06.test.ts',
    why: '저장마다 뜨면 사람이 눌러 넘기는 습관이 생겨 진짜 변경에서도 안 읽는다.',
  },
]
