// 🤝 생활 견적 제휴 업체 + 카테고리 확대(2026-10-25) — 가드가 실제로 실패하는지.
const T = 'src/tests/unit/home-service-partner-2026-10-25.test.ts'

export default [
  {
    name: '생활제휴 — 제휴 업체가 지역 밖 요청을 못 받는다',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: "   AND (instr(',' || ? || ',', ',' || r.category || ',') > 0\n       OR (",
    replace: "   AND (instr(',' || ? || ',', ',' || r.category || ',') < 0\n       OR (",
    test: T,
    why: '간판 제휴사가 등록 지역 밖의 간판 요청을 영영 못 본다.',
  },
  {
    name: '생활제휴 — 쉼표 경계 없이 비교해 다른 카테고리가 샌다',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: "   AND (instr(',' || ? || ',', ',' || r.category || ',') > 0",
    replace: "   AND (instr(?, r.category) > 0",
    test: T,
    why: '입주청소(move_in_clean) 제휴가 이사(move) 요청까지 받는다.',
  },
  {
    name: '생활제휴 — 제휴 견적에 partner 표시를 안 남긴다',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: "SELECT ?, ?, ?, ?, 'sent', 1, ? WHERE changes() > 0`,\n    ).bind(requestId, sellerId, price, message, partner ? 1 : 0),",
    replace: "SELECT ?, ?, ?, ?, 'sent', 1, ? WHERE changes() > 0`,\n    ).bind(requestId, sellerId, price, message, 0),",
    test: T,
    why: '손님 화면에 제휴 업체가 "유어딜 직영" 으로 잘못 뜬다.',
  },
  {
    name: '생활제휴 — 제휴 업체가 참여권을 내고 견적한다',
    file: 'src/features/home-service/api/home-service-pro.routes.ts',
    find: '      ? await sendHouseQuoteAtomic(DB, id, sid, price, message, true)',
    replace: '      ? await sendQuoteAtomic(DB, id, sid, price, message)',
    test: T,
    why: '참여권이 없는 제휴사가 견적을 못 낸다.',
  },
  {
    name: '생활제휴 — 새 요청 알림이 제휴 업체에게 안 간다',
    file: 'src/features/home-service/api/home-service-notify.ts',
    find: '  const partnerId = (await loadPartners(DB))[req.category]',
    replace: '  const partnerId = 0 as number',
    test: T,
    why: '간판 요청이 와도 제휴사가 모른다.',
  },
  {
    name: '생활제휴 — 간판 요청서가 예산을 안 묻는다',
    file: 'src/shared/home-service-categories.ts',
    find: "      { key: 'budget', label: '생각하는 예산', type: 'select', required: true,\n        options: ['100만 원 이하',",
    replace: "      { key: 'budget_x', label: '생각하는 예산', type: 'select', required: false,\n        options: ['100만 원 이하',",
    test: T,
    why: '간판 업체가 예산을 몰라 견적 범위를 못 잡는다.',
  },
  {
    name: '생활제휴 — 수리 카테고리에 간판이 다시 섞인다',
    file: 'src/shared/home-service-categories.ts',
    find: "options: ['전기', '배관·누수', '문·유리·셔터', '타일·바닥', '기타'] },",
    replace: "options: ['전기', '배관·누수', '간판', '문·유리·셔터', '타일·바닥', '기타'] },",
    test: T,
    why: '간판 요청이 수리로 들어가 간판 제휴사에게 안 간다.',
  },
]
