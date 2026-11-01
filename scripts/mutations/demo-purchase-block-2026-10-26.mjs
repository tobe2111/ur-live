/** 🧬 주입 — 데모 상품 결제 차단(2026-10-26). 가드: src/tests/unit/demo-purchase-block-2026-10-26.test.ts */
const T = 'src/tests/unit/demo-purchase-block-2026-10-26.test.ts'
const STAY = 'src/features/group-buy/api/stays-public.routes.ts'
const DEMO = "if (await isDemoProductForPurchase(c.env.DB, productId)) return c.json({ success: false, error: DEMO_PURCHASE_ERROR, code: 'DEMO_NOT_PURCHASABLE' }, 403)\n\n    // 모드별 검증."
export default [
  {
    name: 'demo-purchase — 공용 결제 검사가 데모 판정을 건너뛴다',
    file: 'src/worker/utils/fcfs-gate.ts',
    find: "  if (demo) return { ok: false, error: DEMO_PURCHASE_ERROR, code: 'DEMO_NOT_PURCHASABLE' }",
    replace: '  void demo',
    test: T,
    why: '추첨 설정이 없는 데모(숙소·유어샵 예시)가 다시 결제된다.',
  },
  {
    name: 'demo-purchase — 조회 실패를 데모로 읽어 정상 상품까지 막는다',
    file: 'src/worker/utils/fcfs-gate.ts',
    find: ".bind(Number(productId)).first<{ slug: string | null }>().catch(() => null)\n  return isDemoSlug(row?.slug)",
    replace: ".bind(Number(productId)).first<{ slug: string | null }>().catch(() => ({ slug: 'demo-x' }))\n  return isDemoSlug(row?.slug)",
    test: T,
    why: 'DB 가 잠깐 흔들리면 모든 결제가 막힌다.',
  },
  {
    name: 'demo-purchase — 숙소 단건 예약이 데모 검사를 잃는다',
    file: STAY,
    find: DEMO,
    replace: '\n    // 모드별 검증.',
    test: T,
    why: '숙소 예약 API 를 직접 부르면 데모 숙소가 결제된다(대표가 막으라고 한 바로 그 경로).',
  },
  {
    name: 'demo-purchase — 숙소 승인 직전 재검증이 사라진다',
    file: STAY,
    find: "    for (const pid of new Set(allBookings.map((b) => Number(b.product_id)).filter(Number.isFinite))) if (await isDemoProductForPurchase(c.env.DB, pid)) return c.json({ success: false, error: DEMO_PURCHASE_ERROR, code: 'DEMO_NOT_PURCHASABLE' }, 403)\n",
    replace: '',
    test: T,
    why: '이미 만들어진 데모 예약이 Toss 승인까지 간다.',
  },
]
