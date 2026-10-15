// 🛍️ 2026-10-15 — 유어샵 '누적 구매' = 이 유어샵을 거쳐 팔린 수. 가드: src/tests/unit/ushop-sales-2026-10-15.test.ts
const TEST = 'src/tests/unit/ushop-sales-2026-10-15.test.ts'
export default [
  {
    name: '🛍️ 유어샵 누적 구매가 환불·취소된 주문까지 센다',
    file: 'src/worker/utils/ushop-sales.ts',
    find: "          AND UPPER(COALESCE(o.status, '')) NOT IN (${placeholders})`,\n    ).bind(curatorUserId, ...USHOP_SALES_EXCLUDED_STATUSES)",
    replace: "          AND 1 = 1`,\n    ).bind(curatorUserId)",
    test: TEST,
    why: '돈이 돌아간 주문을 "이 유어샵이 판 것" 으로 세면 숫자가 부풀려진다.',
  },
  {
    name: '🛍️ 카드로 산 유어샵 구매가 기록되지 않는다(딜 결제만 세짐)',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: "      await recordUShopSale(DB, { orderId: newOrderId, ref: referralInfluencerId, buyerId: userId, items: [{ productId: Number(productId), qty }] })\n    })())",
    replace: "    })())",
    test: TEST,
    why: '결제수단에 따라 숫자가 갈린다 — 카드 손님이 많을수록 유어샵 실적이 사라진다.',
  },
  {
    name: '🛍️ 자기 유어샵에서 자기가 산 것을 센다',
    file: 'src/worker/utils/ushop-sales.ts',
    find: "  if (String(buyerId ?? '') === s) return null\n",
    replace: '',
    test: TEST,
    why: '주인이 자기 링크로 사서 숫자를 올릴 수 있게 된다.',
  },
  {
    name: '🛍️ 누적 구매가 다시 진열 상품의 전체 판매수로',
    file: 'src/pages/CuratorPage.tsx',
    find: 'soldTotal={curatorSoldTotal(curator)}',
    replace: 'soldTotal={pins.reduce((s, p) => s + (Number(p.sold_count) || 0), 0)}',
    test: TEST,
    why: '대표 확정(2026-10-15) — 어디서 팔렸든 센 숫자는 이 유어샵의 실적이 아니다.',
  },
]
