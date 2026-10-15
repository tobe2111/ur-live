/**
 * 💸 0.5% 공구 추천 보너스 — 지급 경로는 없고, 진실은 설정값 한 곳이다 (2026-10-16) — 주입 매니페스트.
 * 가드: src/tests/unit/referral-bonus-single-source-2026-10-16.test.ts
 *
 * 절반은 **반대 방향**이다 — "0.5% 없앤다" 를 넓게 읽어 어드민 스위치(Path A)나
 * 매장이 건 소개비(`seller_influencer_deals`)까지 지우는 쪽이 더 조용하고 더 나쁘다.
 */
const TEST = 'src/tests/unit/referral-bonus-single-source-2026-10-16.test.ts'
const ROUTES = 'src/features/group-buy/api/group-buy.routes.ts'
const HELPERS = 'src/features/group-buy/api/helpers.ts'
const RATES = 'src/features/group-buy/api/commission-rates.ts'
const POLICY = 'src/shared/constants/policy.ts'

export default [
  {
    name: '[refbonus] 0.5 상수를 policy.ts 에 되살린다',
    file: POLICY,
    find: '  AFFILIATE_COMMISSION_PCT: 2,',
    replace: '  AFFILIATE_COMMISSION_PCT: 2,\n  REFERRAL_BONUS_BOTHSIDES_PCT: 0.5,',
    test: TEST,
    why:
      '이 상수가 있으면 어드민 정책표와 **대외 제안서**가 아무도 안 주는 0.5% 를 다시 광고한다. ' +
      '전날 결재로 닫은 바로 그 거짓 약속이고, 숫자만 남으면 다음 세션이 지급 코드를 되살린다.',
  },
  {
    name: '[refbonus] 어드민 정책표에 0.5% 행을 되살린다',
    file: 'src/pages/admin-policy/policy-rows.ts',
    find: "      { key: 'CURATOR_AFFILIATE_PCT',",
    replace:
      "      { key: 'REFERRAL_BONUS_BOTHSIDES_PCT', value: '0.5%', unit: '%', desc: '공구 양쪽 보너스' },\n" +
      "      { key: 'CURATOR_AFFILIATE_PCT',",
    test: TEST,
    why: '어드민이 정책표에서 0.5% 를 읽고 "지급되는 값" 으로 운영 판단을 한다 — 실제로는 한 푼도 안 나간다.',
  },
  {
    name: '[refbonus] 설정값 게이트를 무조건 참으로 (A 경로가 0 을 무시한다)',
    file: ROUTES,
    find: '    const userBonusAmount = hasInfluencer ? Math.floor(totalAmount * rates.user_referral_bonus_pct / 100) : 0',
    replace: '    const userBonusAmount = hasInfluencer ? Math.max(1, Math.floor(totalAmount * rates.user_referral_bonus_pct / 100)) : 0',
    test: TEST,
    why:
      '설정이 0 인데 지급된다 — 어드민 스위치가 거짓이 된다. B 를 지운 이유가 정확히 이것이라 ' +
      'A 에서 같은 일이 생기면 수리가 통째로 무효다.',
  },
  {
    name: '[refbonus] 🔴 반대 방향 — 설정값 경로(A)를 라우트에서 지운다',
    file: ROUTES,
    find: 'rates.user_referral_bonus_pct',
    replace: '0 /* removed */',
    test: TEST,
    why:
      '"0.5% 없앤다" 를 넓게 읽어 어드민 스위치까지 지우는 쪽. 나중에 대표가 보너스를 켜고 싶어도 ' +
      '켤 자리가 없고, **에러가 안 난다**(늘 0 이라 화면도 안 깨진다).',
  },
  {
    name: '[refbonus] 🔴 반대 방향 — helpers 의 설정값 게이트를 지운다',
    file: HELPERS,
    find: '  const userBonusAmount = Math.floor(p.totalAmount * rates.user_referral_bonus_pct / 100)',
    replace: '  const userBonusAmount = 0 /* removed */',
    test: TEST,
    why: '장바구니 경로의 같은 스위치. 한쪽만 남으면 경로에 따라 보너스가 갈린다.',
  },
  {
    name: '[refbonus] 🔴 반대 방향 — 설정 키를 어드민 읽기 목록에서 뺀다',
    file: RATES,
    find: "'platform_margin_pct', 'influencer_commission_pct', 'user_referral_bonus_pct',",
    replace: "'platform_margin_pct', 'influencer_commission_pct',",
    test: TEST,
    why: '키가 목록에서 빠지면 어드민이 그 값을 못 내려보낸다 — 기본값으로 조용히 떨어진다.',
  },
  {
    name: '[refbonus] 🔴 반대 방향 — 매장이 건 소개비 조회를 지운다',
    file: HELPERS,
    find: 'seller_influencer_deals',
    replace: 'seller_influencer_deals_REMOVED',
    test: TEST,
    why:
      '대표 **"소개비는 매장 사장님이 설정했다면 매장에서 부담하는거"** — 0.5% 와 이름이 비슷해 ' +
      '같이 지워지기 쉬운데, 이건 살려야 하는 레일이다(라이브 active 1건).',
  },
]
