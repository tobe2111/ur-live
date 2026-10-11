/**
 * 🔗 소개 링크 24시간 · 마지막 링크 우선 (2026-10-11 대표) 되돌려-검증 주입.
 * 가드: src/tests/unit/affiliate-ref-24h-last-link-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/affiliate-ref-24h-last-link-2026-10-11.test.ts'
const STORE = 'src/utils/affiliate-ref-store.ts'

export default [
  {
    name: '🔗24h 엔트리가 정책 파일을 끌어온다',
    file: STORE,
    find: "import { REFERRAL_TTL_HOURS } from '@/shared/utils/referral-ttl'",
    replace: "import { CURATOR_DEFAULTS } from '@/shared/constants/policy'\nconst REFERRAL_TTL_HOURS = CURATOR_DEFAULTS.REF_COOKIE_TTL_HOURS",
    test: TEST,
    why: 'lib/api.ts(엔트리)가 이 파일을 import 한다 — policy.ts 를 거치면 app-constants 청크가 첫 페인트에 실린다(2026-10-11 Verify 가 잡았다).',
  },
  {
    name: '🔗24h 유효기간이 7일로 돌아간다',
    file: 'src/shared/utils/referral-ttl.ts',
    find: 'export const REFERRAL_TTL_HOURS = 24',
    replace: 'export const REFERRAL_TTL_HOURS = 168',
    test: TEST,
    why: '대표가 24시간으로 정한 소개 기간이 조용히 7일로 늘어난다 — 매장이 7일 전 클릭에 커미션을 낸다.',
  },
  {
    name: '🔗24h 옛 7일 값이 그대로 산다',
    file: STORE,
    find: '      at = exp - LEGACY_TTL_MS',
    replace: '      at = exp - AFFILIATE_REF_TTL_MS',
    test: TEST,
    why: '2026-10-11 이전에 심긴 값이 7일을 그대로 누린다.',
  },
  {
    name: '🔗24h 지난 쿠키를 안 지운다',
    file: STORE,
    find: "    localStorage.removeItem(AFFILIATE_REF_EXP_KEY)\n    document.cookie = 'affiliate_ref=; path=/; max-age=0; SameSite=Lax'",
    replace: '    localStorage.removeItem(AFFILIATE_REF_EXP_KEY)',
    test: TEST,
    why: '서버가 쿠키를 폴백으로 읽어 24시간이 지난 소개자에게 커미션이 붙는다.',
  },
  {
    name: '🔗마지막링크 먼저 연 ?seller= 가 이긴다',
    file: 'src/lib/seller-tracking.ts',
    find: '  if (seller && aff) return aff.at >= seller.at ? aff.ref : seller.id',
    replace: '  if (seller && aff) return seller.id',
    test: TEST,
    why: '나중에 연 딜 링크가 무시되고 먼저 연 매장 링크가 결제 ref 가 된다(대표 결정과 반대).',
  },
  {
    name: '🔗마지막링크 헤더가 만료를 안 본다',
    file: 'src/lib/api.ts',
    find: '      pruneExpiredAffiliateRef();\n',
    replace: '',
    test: TEST,
    why: '요청 헤더 경로만 정리가 빠지면 옛 쿠키가 서버 폴백으로 살아남는다.',
  },
  {
    name: '🔗마지막링크 이용권 카드결제가 옛 함수로 돌아간다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "      const { getPurchaseRef: getRef } = await import('@/lib/seller-tracking')",
    replace: "      const { getTrackedSellerId: getRef } = await import('@/lib/seller-tracking')",
    test: TEST,
    why: '카드 결제 경로만 옛 이름(=없는 함수)을 부르면 소개자가 빠진 채 결제된다.',
  },
]
