/**
 * 🧬 주입 — 생활 견적 참여권·선착순·매칭 (2026-10-24, 결재 2026-10-24-home-service-quotes)
 */
const T = 'src/tests/unit/home-service-quotes-2026-10-24.test.ts'
const DB = 'src/features/home-service/api/home-service-db.ts'
export default [
  {
    name: '생활견적 — 자리 확보가 차감 성공을 안 본다(참여권 없어도 자리를 가져간다)',
    file: DB,
    find: "WHERE id = ? AND status = 'open' AND quote_count < max_quotes AND changes() > 0`,",
    replace: "WHERE id = ? AND status = 'open' AND quote_count < max_quotes`,",
    test: T,
    why: '참여권 0장 사장님이 선착순 자리를 막는다 — 돈 낸 사장님이 못 들어간다.',
  },
  {
    name: '생활견적 — 잔액 증가가 원장 INSERT 성공을 안 본다(같은 결제가 두 번 지급)',
    file: DB,
    find: "       SELECT ?, ?, datetime('now') WHERE changes() > 0\n",
    replace: "       SELECT ?, ?, datetime('now') WHERE 1\n",
    test: T,
    why: '결제창 새로고침마다 참여권이 다시 늘어난다 — 돈 안 낸 참여권.',
  },
  {
    name: '생활견적 — 차감에 자리 검사가 빠진다(마감된 요청에 돈만 빠진다)',
    file: DB,
    find: "          AND EXISTS (SELECT 1 FROM home_service_requests WHERE id = ? AND status = 'open' AND quote_count < max_quotes)\n",
    replace: "          AND EXISTS (SELECT 1 FROM home_service_requests WHERE id = ?)\n",
    test: T,
    why: '선착순이 다 찬 요청에 눌러도 1장이 빠지고 견적은 안 간다.',
  },
  {
    name: '생활견적 — 고른 견적도 반환한다',
    file: DB,
    find: "SET status = 'refunded' WHERE id = ? AND status = 'sent' AND is_house = 0`",
    replace: "SET status = 'refunded' WHERE id = ? AND status IN ('sent','chosen') AND is_house = 0`",
    test: T,
    why: '손님을 실제로 받은 사장님이 참여권도 돌려받는다.',
  },
  {
    name: '생활견적 — 매칭이 매장 상태를 안 본다',
    file: DB,
    find: "     AND s.status IN ${PRO_OPEN_STATUS_SQL}\n     AND (",
    replace: "     AND (",
    test: T,
    why: '정지된 업체에 손님 요청이 간다(2026-10-25 부터 심사 중은 받는다 — 막는 것은 정지·반려).',
  },
  {
    name: '생활견적 — 요청서 지역을 동까지 자르지 않는다(번지·호수가 사장님에게 보인다)',
    file: 'src/shared/home-service.ts',
    find: "const short = v.split(/\\s+/).slice(0, 3).join(' ')",
    replace: "const short = v",
    test: T,
    why: '손님이 고르기 전에 상세 주소가 여러 업체에 퍼진다.',
  },
  {
    name: '생활견적 — 충전 승인이 남의 주문번호를 받는다',
    file: 'src/features/home-service/api/home-service-pro.routes.ts',
    find: '!parsed || parsed.sellerId !== sid',
    replace: '!parsed',
    test: T,
    why: '다른 매장 결제로 내 참여권을 늘릴 수 있다.',
  },
  {
    name: '생활견적 — 직영 견적도 참여권을 돌려받는다(반환이 직영을 안 거른다)',
    file: DB,
    find: "SET status = 'refunded' WHERE id = ? AND status = 'sent' AND is_house = 0`",
    replace: "SET status = 'refunded' WHERE id = ? AND status = 'sent'`",
    test: T,
    why: '참여권을 쓴 적 없는 직영 견적이 반환으로 참여권을 받는다 — 공짜 참여권.',
  },
  {
    name: '생활견적 — 운영팀이 손님이 직접 올린 요청도 대신 고른다',
    file: DB,
    find: "AND (user_id = ? OR (? = 1 AND source = 'admin'))",
    replace: "AND (user_id = ? OR ? = 1)",
    test: T,
    why: '손님 본인이 고를 요청을 운영팀이 대신 골라 손님 연락처를 업체에 넘긴다.',
  },
  {
    name: '생활견적 — 직영 견적이 선착순 자리를 안 본다(6번째 견적이 들어간다)',
    file: DB,
    find: "        WHERE id = ? AND status = 'open' AND quote_count < max_quotes\n          AND NOT EXISTS",
    replace: "        WHERE id = ? AND status = 'open'\n          AND NOT EXISTS",
    test: T,
    why: '견적이 다 찬 요청에 직영이 끼어들어 손님이 비교할 견적 수가 약속보다 많아진다.',
  },
]
