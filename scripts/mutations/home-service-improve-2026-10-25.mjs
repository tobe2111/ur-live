// 🏠 생활 견적 개선 넷(2026-10-25 대표 "모두 개선해줘") — 사진·참여권 장수·업체 수·계약 안내 가드가 실제로 실패하는지.
const T = 'src/tests/unit/home-service-improve-2026-10-25.test.ts'

export default [
  {
    name: '생활개선 — 사진 주소 검사를 건너뛴다',
    file: 'src/shared/home-service.ts',
    find: "if (urls.some((u) => !isRequestPhotoUrl(u))) return { ok: false, error: '사진을 다시 올려 주세요' }",
    replace: "if (urls.some((u) => !u)) return { ok: false, error: '사진을 다시 올려 주세요' }",
    test: T,
    why: '외부 주소가 요청서에 들어가 업체 화면에 아무 그림이나 뜬다.',
  },
  {
    name: '생활개선 — 사진 소유 검사가 경계 슬래시를 잃는다',
    file: 'src/shared/home-service.ts',
    find: "!u.includes(`/uploads/user/${userId}/`)",
    replace: "!u.includes(`/uploads/user/${userId}`)",
    test: T,
    why: '1번 손님이 12번 손님 사진을 자기 요청서에 끼운다.',
  },
  {
    name: '생활개선 — 반환이 쓴 장수가 아니라 1장만 돌려준다',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: "       SELECT ?, (SELECT credits FROM home_service_quotes WHERE id = ?), datetime('now') WHERE changes() > 0",
    replace: "       SELECT ?, 1 + 0 * ?, datetime('now') WHERE changes() > 0",
    test: T,
    why: '3장 쓴 업체가 손님 미열람 반환 때 1장만 돌려받는다(업체 손해).',
  },
  {
    name: '생활개선 — 차감은 1장인데 견적에는 장수를 적는다',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: "    ).bind(n, sellerId, n, requestId, requestId, sellerId),",
    replace: "    ).bind(1, sellerId, n, requestId, requestId, sellerId),",
    test: T,
    why: '3장짜리 견적에서 1장만 빠지고 반환은 3장 — 반환할 때마다 참여권이 늘어난다.',
  },
  {
    name: '생활개선 — 업체 수에 정지된 매장도 센다',
    file: 'src/features/home-service/api/home-service-db.ts',
    find: "       JOIN sellers s ON s.id = c.seller_id AND s.status IN ${PRO_OPEN_STATUS_SQL}\n      GROUP BY c.category`,",
    replace: "       JOIN sellers s ON s.id = c.seller_id\n      GROUP BY c.category`,",
    test: T,
    why: '받을 업체가 없는데 "무료 견적" 이 떠 손님 요청이 답 없이 쌓인다.',
  },
  {
    name: '생활개선 — 장수 상한을 안 본다',
    file: 'src/shared/home-service.ts',
    find: 'n >= 1 && n <= MAX_CREDIT_COST',
    replace: 'n >= 1',
    test: T,
    why: '설정 오타 한 번(30)으로 견적 하나에 참여권 30장이 빠진다.',
  },
]
