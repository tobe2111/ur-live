/**
 * 🧺 장바구니 UI 게이트 짝 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/voucher-cart-gate-pairing-2026-09-15.test.ts
 * 되살리는 결함: 담기 버튼이 서버 게이트와 어긋나 "담기는 되는데 결제는 403" 인 막다른 길.
 */
const TEST = 'src/tests/unit/voucher-cart-gate-pairing-2026-09-15.test.ts'
export default [
  {
    name: '[장바구니짝] 담기 버튼이 다시 게이트 밖으로 나온다 (막다른 길 재발)',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: 'show={VOUCHER_CART_UI_ENABLED && isJoinable && !isPrelaunch}',
    replace: 'show={isJoinable && !isPrelaunch}',
    test: TEST,
    why: '게이트가 꺼진 라이브에서 담기만 되고 결제는 403 — 초대해 놓고 못 사게 하는 화면이 된다.',
  },
  {
    name: '[장바구니짝] UI 플래그가 켜진 채로 머지된다 (staging 전에 열린다)',
    file: 'src/shared/feature-flags.ts',
    find: 'export const VOUCHER_CART_UI_ENABLED = false',
    replace: 'export const VOUCHER_CART_UI_ENABLED = true',
    test: TEST,
    why: '머니 경로는 staging 실결제 뒤 대표 결재로만 열린다 — 기본값이 켜짐이면 그 절차를 우회한다.',
  },
  {
    name: '[장바구니짝] 서버 게이트 하나를 떼고 UI 플래그로 대신한다',
    file: 'src/features/group-buy/api/cart-checkout.routes.ts',
    find: "  if (!await cartEnabled(DB)) return c.json(GATE_OFF, 403)\n\n  const userId = await resolveUserIdString(DB, user.id, user.isDbId)\n  /** ⚠️ `items` 가 없다",
    replace: "  const userId = await resolveUserIdString(DB, user.id, user.isDbId)\n  /** ⚠️ `items` 가 없다",
    test: TEST,
    why: 'UI 를 숨기는 것은 편의다 — API 를 직접 치는 사람은 화면을 안 본다. 경계는 서버다.',
  },
  {
    name: '[장바구니짝] 의사 기록 청소 호출을 뗀다 (헬퍼만 남고 아무도 안 부른다)',
    file: 'src/worker/cron/scheduled-cleanup-daily.ts',
    find: '    const n = await purgeStaleCartIntents(DB);\n    if (n > 0) results.cart_intents_purged = n;',
    replace: '    const n = 0;\n    if (n > 0) results.cart_intents_purged = n;',
    test: TEST,
    why: '이 세션의 실제 누락이다 — 헬퍼는 썼는데 호출부가 0 이었다. 켜는 날부터 이탈 행이 조용히 쌓인다.',
  },
]
