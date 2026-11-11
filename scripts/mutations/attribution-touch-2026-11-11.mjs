/**
 * 🧬 주입 — 누가 데려왔나 · 무엇을 보고 샀나 (2026-11-11)
 *    가드: src/tests/unit/attribution-touch-2026-11-11.test.ts
 */
const T = 'src/tests/unit/attribution-touch-2026-11-11.test.ts'
export default [
  { name: 'attrib: 홈으로 온 소개 링크가 구매 귀속에 안 남는다', file: 'src/utils/affiliate-track.ts',
    find: '  if (isConsumerLandingPath(pathname)) storeAffiliateRef(ref) // 저장 + 유입 클릭(같은 ref 1회)\n  else captureInflowRef(ref)',
    replace: '  captureInflowRef(ref)',
    test: T, why: '인플루언서 기본 공유 링크(홈)로 와서 유어쇼츠 보고 산 손님이 인플루언서 성과에서 빠진다.' },
  { name: 'attrib: 매장 영입 링크가 손님 소개로 저장된다', file: 'src/utils/affiliate-track.ts',
    find: "['/store', '/seller',", replace: "['/seller',",
    test: T, why: '/store/new?ref= 의 영입인이 그 사장님이 산 이용권의 소개 성과까지 가져간다.' },
  { name: 'attrib: 장바구니 확정이 본문만 본다', file: 'src/features/group-buy/api/cart-checkout.routes.ts',
    find: "const referralInfluencerId = await normalizeRef(DB, pickGbRefSource(body.ref, c.req.header('X-Affiliate-Ref'), getCookie(c, 'affiliate_ref')), userId)",
    replace: 'const referralInfluencerId = await normalizeRef(DB, body.ref, userId)',
    test: T, why: '장바구니 카드 결제는 완료 주소에 ref 가 없어 늘 무귀속이 된다.' },
  { name: 'attrib: 유어쇼츠가 인플루언서를 이긴다', file: 'src/worker/utils/order-touch.ts',
    find: "  if (ref && String(ref).trim()) return 'influencer'\n  if (viaKind === 'urshorts') return 'urshorts'",
    replace: "  if (viaKind === 'urshorts') return 'urshorts'\n  if (ref && String(ref).trim()) return 'influencer'",
    test: T, why: '인플루언서 링크로 와서 유어쇼츠를 본 손님이 유어쇼츠 성과로 집계된다(대표가 막으라 한 바로 그 경우).' },
  { name: 'attrib: 카드 확정이 갈래를 안 적는다', file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: "        try {\n          const { recordOrderTouch } = await import('../../../worker/utils/order-touch')\n          await recordOrderTouch(DB, { orderRef: orderNumber, userId, productId: Number(productId), ref: referralInfluencerId, viaRaw: c.req.header('X-Ur-Via') })\n        } catch { /* fail-soft */ }\n",
    replace: '',
    test: T, why: '카드로 산 이용권이 갈래 집계에서 통째로 빠진다.' },
  { name: 'attrib: 유어쇼츠 구매가 꼬리표를 안 남긴다', file: 'src/pages/VideosPage.tsx',
    find: '            onClick={() => writeTouch(`urshorts:${cur.video_id}`)}', replace: '            onClick={() => {}}',
    test: T, why: '유어쇼츠를 보고 산 결제가 순수 유어딜로 섞인다.' },
]
