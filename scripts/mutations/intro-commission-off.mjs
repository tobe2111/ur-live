/**
 * 🛑 영입 커미션 중단 (2026-09-24 대표 "아예 없기로 했는데") — 주입 매니페스트.
 * 가드: src/tests/unit/intro-commission-off-2026-09-24.test.ts
 */
const TEST = 'src/tests/unit/intro-commission-off-2026-09-24.test.ts'

export default [
  {
    name: '🛑 요율 해석이 0 을 falsy 로 취급해 "끔"이 조용히 기본값으로 되돌아간다',
    file: 'src/worker/utils/influencer-store-intro-commission.ts',
    find: 'Number.isFinite(pct) && pct >= 0 ? pct : DEFAULT_STORE_INTRO_PCT',
    replace: 'Number.isFinite(pct) && pct > 0 ? pct : DEFAULT_STORE_INTRO_PCT',
    test: TEST,
    why: '어드민이 0(중단)을 넣어도 안 꺼진다. 에러도 로그도 없어 끈 줄 알고 지나간다 — 실제로 그 상태였다.',
  },
  {
    name: '🛑 코드 기본값이 2% 로 되살아나 설정 행이 없으면 다시 지급된다',
    file: 'src/shared/constants/policy.ts',
    find: '  INFLUENCER_STORE_INTRO_PCT: 0,',
    replace: '  INFLUENCER_STORE_INTRO_PCT: 2.0,',
    test: TEST,
    why: '설정 행이 지워지거나 DB 가 초기화되면 폴백이 곧 정책이 된다. 중단은 두 겹(코드+설정)이어야 한다.',
  },
  {
    name: '🛑 금액 0 조기 반환이 빠져 0원 적립 행이 쌓인다',
    file: 'src/worker/utils/influencer-store-intro-commission.ts',
    find: '    if (commission <= 0) return',
    replace: '    if (commission < 0) return',
    test: TEST,
    why: '요율 0 이어도 0원짜리 attribution 행과 잔액 UPSERT 가 주문마다 생긴다(원장 오염 + 화면 오해).',
  },
  {
    name: '🛑 셀러 가이드가 없어진 "매출의 2% 1년" 을 다시 약속한다',
    file: 'src/features/guides/api/guide-seed-seller.ts',
    find: '### 🛑 2026-09-24 — 영입 커미션은 중단됐습니다',
    replace: '### 규칙은 하나입니다\n매장을 유어딜에 **데려온 사람**에게 그 매장 **매출의 2%** 를 **1년간** 드립니다.',
    test: TEST,
    why: '코드가 안 주는데 가이드가 준다고 하면 그게 분쟁이 된다 — 라이브 가이드는 재시드로만 바뀐다.',
  },
]
