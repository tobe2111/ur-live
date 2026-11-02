/**
 * 🎁 이용권 상세 '이 이용권 팔기' B안 · 배너 통합 · 수수료 요청 (2026-11-02) — 주입 매니페스트.
 * 가드: src/tests/unit/sell-this-b-2026-11-02.test.tsx
 */
const T = 'src/tests/unit/sell-this-b-2026-11-02.test.tsx'
const CARD = 'src/components/seeding/SellThisCard.tsx'
const SHEET = 'src/components/seeding/SellThisSheet.tsx'
const ROUTES = 'src/features/seeding/api/seeding.routes.ts'

export default [
  {
    name: '팔기 줄 — 로그아웃 상태에서도 딜을 물어 401 을 낸다',
    file: CARD,
    find: '    if (!getUserIdSync()) { setDeal(null); return }\n',
    replace: '\n',
    test: T,
    why: '2026-10-15 라이브: 로그아웃 이용권 상세마다 deal-for-seller 401(옛 배너). 통합하면서 그 수리를 잃으면 안 된다.',
  },
  {
    name: '팔기 창 — 24시간 조건이 문구에서 빠진다',
    file: SHEET,
    find: '내 링크로 들어온 손님이 24시간 안에 사면',
    replace: '내 링크로 들어온 손님이 사면',
    test: T,
    why: '대표 "24시간 유효하다고 해야할 것 같은데" — 소개는 들어온 뒤 24시간·마지막 링크 기준이다(affiliate-ref-store).',
  },
  {
    name: '팔기 창 — 약정이 없어도 수수료 요청 버튼이 안 뜬다',
    file: SHEET,
    find: '{deal === 0 && sellerId != null && (',
    replace: '{false && (',
    test: T,
    why: '약정이 없는 사람에게 다음 걸음이 없으면 "팔기" 는 0원짜리 약속이 된다.',
  },
  {
    name: '수수료 요청 — 하루 한 번 제한이 빠져 사장님께 알림이 쏟아진다',
    file: ROUTES,
    find: "          AND created_at >= datetime('now', '-1 day') LIMIT 1`,",
    replace: '          LIMIT 1`,',
    test: T,
    why: '같은 사람이 같은 매장에 버튼을 연타하면 알림함이 그 사람으로 찬다.',
  },
  {
    name: '수수료 요청 — 이미 약정이 있는데도 또 보낸다',
    file: ROUTES,
    find: '    if (await findActiveDealPct(DB, product.seller_id, String(me))) {',
    replace: '    if (false) {',
    test: T,
    why: '약정이 있는 사람의 요청은 사장님께 소음이다 — 판정은 결제와 같은 SSOT.',
  },
]
