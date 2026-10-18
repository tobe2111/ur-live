// 🏷️ 브랜드 3단계 후속 — 손님·판 지점·어드민이 "다른 점주 지점 사용"을 보게 (대표 "응")
const TEST = 'src/tests/unit/brand-cross-owner-visibility-2026-10-18.test.ts'

export default [
  {
    name: '🏷️ 3단계 표시: 다른 점주 지점을 "어디서나" 에 섞어 약속한다',
    file: 'src/pages/group-buy/brand-branches-label.ts',
    find: "  if (cross > 0 && usable > 1) return { main: `${d.name} ${usable}곳 + 가맹점 ${cross}곳에서 사용 가능 · 지점 보기`, note }",
    replace: "  if (cross > 0 && usable > 1) return { main: `${d.name} ${usable + cross}곳 어디서나 사용 가능 · 지점 보기`, note }",
    test: TEST,
    why: '소개 링크로 산 이용권은 다른 점주 지점이 받지 않는다(결재 ②) — "어디서나" 로 말하면 그 손님에게 거짓 약속이 된다.',
  },
  {
    name: '🏷️ 3단계 표시: 소개 링크 주의 문구를 뺀다',
    file: 'src/pages/group-buy/brand-branches-label.ts',
    find: "  const note = cross > 0 ? '소개 링크로 산 이용권은 가맹점에서 못 쓸 수 있어요' : null",
    replace: '  const note = null',
    test: TEST,
    why: '다른 점주 지점 수를 말하면서 예외를 숨기면 소개 링크로 산 손님이 가맹점에서 거절당한다.',
  },
  {
    name: '🏷️ 3단계 표시: 판 지점 주문 상세가 받은 지점을 싣지 않는다',
    file: 'src/worker/utils/order-list-enrich.ts',
    find: "LEFT JOIN voucher_redeem_stores r ON r.voucher_id = v.id AND r.cross_owner = 1",
    replace: "LEFT JOIN voucher_redeem_stores r ON r.voucher_id = v.id AND r.cross_owner = 9",
    test: TEST,
    why: '정산이 다른 점주 지점으로 넘어갔는데 판 지점이 모르면 "왜 정산이 비냐" 문의가 된다.',
  },
  {
    name: '🏷️ 3단계 표시: 기록 테이블이 없으면 이용권 코드까지 사라진다(폴백 제거)',
    file: 'src/worker/utils/order-list-enrich.ts',
    find: "      .catch(() => DB.prepare(",
    replace: "      .catch(() => ({ results: [] as Row[] }).results ?? DB.prepare(",
    test: TEST,
    why: '첫 다른 점주 사용 전엔 테이블이 없다 — 그때 조인 실패가 사장님 주문 상세의 이용권 코드를 지우면 안 된다.',
  },
  {
    name: '🏷️ 3단계 어드민: 환불된 기록까지 다른 점주 사용으로 센다',
    file: 'src/features/admin/api/admin-brand-cross-owner.routes.ts',
    find: "        WHERE r.cross_owner = 1 AND v.status = 'used'`,\n    ).first",
    replace: "        WHERE r.cross_owner = 1`,\n    ).first",
    test: TEST,
    why: '정산이 넘어간 건 쓴 이용권뿐이다 — 환불된 것을 세면 넘어간 금액이 부풀려 보인다.',
  },
]
