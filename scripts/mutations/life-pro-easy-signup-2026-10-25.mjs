// 🚪 생활 업체 — 심사 중에도 견적 · 한 화면 가입 (2026-10-25) — `life-pro-easy-signup-2026-10-25.test.ts` 가 잡아야 하는 결함.
const TEST = 'src/tests/unit/life-pro-easy-signup-2026-10-25.test.ts'
export default [
  {
    name: '🚪 생활 견적 판정이 정지 업체까지 연다',
    file: 'src/shared/home-service.ts',
    find: "export const PRO_OPEN_STATUSES = ['pending', 'approved', 'active'] as const",
    replace: "export const PRO_OPEN_STATUSES = ['pending', 'approved', 'active', 'suspended'] as const",
    test: TEST,
    why: '어드민이 정지한 업체가 계속 요청을 받고 견적을 보낸다 — 막을 수단이 사라진다.',
  },
  {
    name: '🚪 견적 보내기가 다시 승인 업체만 받는다',
    file: 'src/features/home-service/api/home-service-pro.routes.ts',
    find: 'if (!proStatusOpen(seller?.status)) {',
    replace: "if (!['approved', 'active'].includes(String(seller?.status))) {",
    test: TEST,
    why: '가입은 쉬운데 견적은 못 내는 막다른 길 — 대표 "1번은 해줘" 가 조용히 되돌아간다.',
  },
  {
    name: '🚪 가입이 하는 일·지역을 매장 행 뒤에 거른다',
    file: 'src/features/home-service/api/home-service-pro-signup.ts',
    find: '    const parsed = parseProBody(body)\n    if (!parsed.ok) return c.json({ success: false, error: parsed.error }, 400)\n',
    replace: '',
    test: TEST,
    why: '하는 일을 안 고른 채 누르면 빈 매장만 남고, 다시 누르면 "이미 가게 있음" 으로 이어져 엉킨다.',
  },
  {
    name: '🚪 가입 매장이 처음부터 승인 상태로 만들어진다',
    file: 'src/features/home-service/api/home-service-pro-signup.ts',
    find: "'store_owner', 'pending'",
    replace: "'store_owner', 'approved'",
    test: TEST,
    why: '심사 없이 승인되면 이용권 판매·메인 노출 문까지 열린다 — 쉬운 가입이 생활 견적 밖으로 샌다.',
  },
  {
    name: '🚪 제휴 지정이 심사 중 매장까지 받는다',
    file: 'src/features/home-service/api/home-service-admin.routes.ts',
    find: "['approved', 'active'].includes(String(s.status))",
    replace: "['pending', 'approved', 'active'].includes(String(s.status))",
    test: TEST,
    why: '무료로 자리를 주는 제휴는 심사를 마친 매장만이어야 한다(반대 방향).',
  },
]
