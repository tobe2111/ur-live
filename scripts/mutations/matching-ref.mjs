/**
 * 🔗 딜 링크 귀속(G1) · 🛑 영입 몫 기본 꺼짐(G2) (2026-10-10 대표 "고쳐줘 · 몫 꺼줘") 되돌려-검증 주입.
 * 가드: src/tests/unit/matching-ref-and-intro-off-2026-10-10.test.ts
 */
const TEST = 'src/tests/unit/matching-ref-and-intro-off-2026-10-10.test.ts'
const GUARD = 'src/features/group-buy/api/gb-purchase-guards.ts'
const GB = 'src/features/group-buy/api/group-buy.routes.ts'
const CART = 'src/features/group-buy/api/cart-checkout.routes.ts'
const LEDGER = 'src/worker/utils/ledger.ts'

export default [
  {
    name: '🔗딜링크 헤더를 안 읽는다',
    file: GUARD,
    find: '  for (const v of [headerRef, cookieRef]) {',
    replace: '  for (const v of [cookieRef]) {',
    test: TEST,
    why: '딜 링크로 들어온 구매가 다시 소개자 없이 처리된다 — 매장이 약속한 커미션이 조용히 0.',
  },
  {
    name: '🔗딜링크 헤더 모양 검사가 풀린다',
    file: GUARD,
    find: '    if (/^\\d{1,12}$/.test(s)) return s',
    replace: '    if (s) return s',
    test: TEST,
    why: '임의 문자열이 소개자 id 로 들어온다 — 클라 저장 규칙과 서버 판정이 갈린다.',
  },
  {
    name: '🔗딜링크 /join 이 본문만 본다',
    file: GB,
    find: "  const refRaw = pickGbRefSource(ref, c.req.header('X-Affiliate-Ref'), getCookie(c, 'affiliate_ref'))",
    replace: "  const refRaw = ref ? String(ref).trim() : ''",
    test: TEST,
    why: '딜 결제(이용권 딜 구매) 경로의 귀속이 다시 끊긴다.',
  },
  {
    name: '🔗딜링크 confirm-toss 자기귀속이 문자열 비교로 돌아간다',
    file: GB,
    find: "  if (referralInfluencerId && await isSelfReferral(DB, referralInfluencerId, userId)) referralInfluencerId = ''",
    replace: "  if (referralInfluencerId && referralInfluencerId === userId) referralInfluencerId = ''",
    test: TEST,
    why: '사업자 유저가 자기 셀러 id 를 소개자로 실어 카드 결제에서 자기에게 딜 커미션을 준다.',
  },
  {
    name: '🔗딜링크 장바구니가 본문만 본다',
    file: CART,
    find: "ref: await normalizeRef(DB, pickGbRefSource(body.ref, c.req.header('X-Affiliate-Ref'), getCookie(c, 'affiliate_ref')), userId) || null,",
    replace: 'ref: await normalizeRef(DB, body.ref, userId) || null,',
    test: TEST,
    why: '장바구니로 산 이용권만 딜 커미션이 빠진다(단건과 묶음이 다르게 정산).',
  },
  {
    name: '🛑영입몫 사용 처리가 셰어를 다시 부른다',
    file: 'src/features/group-buy/api/group-buy-voucher.routes.ts',
    find: '                //    🛑 2026-10-10 대표 *"마저 폐지해줘. 모두 다"* — 짝이던 영입 셰어(수수료 20%)도 삭제. 사유는 ledger.ts 묘비.\n',
    replace: '                await (await import(\'../../../worker/utils/ledger\') as any).recordIntroductionCommissionShare?.(DB, {})\n',
    test: TEST,
    why: '대표가 폐지한 영입 몫이 이용권 사용마다 유어딜 수수료에서 다시 나간다.',
  },
  {
    name: '🛑영입몫 함수가 되살아난다',
    file: LEDGER,
    find: ' * 🛑 2026-10-10 대표 *"2번은 마저 폐지해줘. 모두 다"* — 여기 있던 `recordIntroductionCommissionShare` 를 삭제했다.\n',
    replace: ' */\nexport async function recordIntroductionCommissionShare() { return { influencer_id: null, amount: 0 } }\n/**\n',
    test: TEST,
    why: '함수만 돌아오면 dedup·만료·본인구매 가드 없이 누군가 다시 배선한다.',
  },
]
