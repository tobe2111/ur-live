/**
 * 🛒 AI 비서 결제 넘겨받기 (2026-10-20, 대표 "4번도 일단은 하자. 가장 이상적으로.")
 * 가드: src/tests/unit/agent-checkout-2026-10-20.test.tsx
 */
const TEST = 'src/tests/unit/agent-checkout-2026-10-20.test.tsx'

export default [
  {
    name: '🛒 결제 링크 수량이 상한을 넘는다',
    file: 'src/shared/agent-checkout.ts',
    find: '  return Math.min(n, top)',
    replace: '  return n',
    test: TEST,
    why: '링크를 손으로 고쳐 1인당 한도를 넘는 수량을 미리 채울 수 있게 된다(서버가 다시 막지만 손님은 막힌 버튼을 만난다).',
  },
  {
    name: '🛒 결제 링크가 결제 링크 게이트를 안 본다',
    file: 'src/worker/routes/agent-search.routes.ts',
    find: 'if (!searchOn || !checkoutOn)',
    replace: 'if (!searchOn)',
    test: TEST,
    why: '게이트를 꺼도 결제 링크가 계속 나간다 — 롤백 스위치가 안 듣는다.',
  },
  {
    name: '🛒 결제 링크가 데모 이용권도 내준다',
    file: 'src/worker/routes/agent-search.routes.ts',
    find: "        AND NOT ${demoSlugSql('p')}${scope}\n      LIMIT 1",
    replace: '        ${scope}\n      LIMIT 1',
    test: TEST,
    why: '데모는 진짜 거래가 아니다 — AI 가 손님을 없는 딜로 보낸다.',
  },
  {
    name: '🛒 주인·판매 전에도 구매 창이 열린다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: 'ready: isJoinable && buyable && !isPrelaunch && !isOwner,',
    replace: 'ready: isJoinable,',
    test: TEST,
    why: '주인이 자기 이용권 결제 창을 받거나, 사전 응모 상품에서 막힌 결제 버튼을 만난다.',
  },
  {
    name: '🛒 표식 없이도 구매 창이 열린다',
    file: 'src/shared/agent-checkout.ts',
    find: "  if (p.get('via') !== AGENT_VIA) return null",
    replace: '',
    test: TEST,
    why: '평범한 상세 방문(`?qty=` 만 붙은 링크)에서도 창이 저절로 열린다.',
  },
  {
    name: '🛒 결제 링크 게이트가 꺼져도 llms.txt 가 그 주소를 적는다',
    file: 'src/shared/seo/llms-txt.ts',
    find: '...(opts.agentSearch && opts.agentCheckout ? agentCheckoutLines(base) : []),',
    replace: '...agentCheckoutLines(base),',
    test: TEST,
    why: '꺼진 창구는 404 다 — 그 주소를 안내하면 거짓 안내가 된다.',
  },
]
