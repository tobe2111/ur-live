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
    name: '🛑영입몫 게이트가 기본 켜짐으로 뒤집힌다',
    file: LEDGER,
    find: "  if (introOn?.value !== 'true') return { influencer_id: null, amount: 0 }",
    replace: "  if (introOn?.value === 'false') return { influencer_id: null, amount: 0 }",
    test: TEST,
    why: '설정 하나 없는 것만으로 모든 매장 이용권 사용마다 유어딜 수수료 20% 가 다시 나간다.',
  },
  {
    name: '🛑영입몫 게이트가 사라진다',
    file: LEDGER,
    find: "  if (introOn?.value !== 'true') return { influencer_id: null, amount: 0 }\n",
    replace: "  void introOn\n",
    test: TEST,
    why: '대표가 끈 몫이 코드에서 조용히 되살아난다.',
  },
]
