/**
 * 🔔 판매 알림을 마이로 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/store-notifications-in-my-2026-10-12.test.tsx
 *
 * 전부 에러가 안 나는 결함이다 — 남의 매장 알림이 보이거나 지워지고, 종이 조용히 사라진다.
 */
const TEST = 'src/tests/unit/store-notifications-in-my-2026-10-12.test.tsx'
const SRV = 'src/features/seller/api/seller-store-notifications.ts'
const GUARD = 'src/worker/utils/store-seat-guard.ts'
const UI = 'src/pages/user-profile/seller-section/StoreNotifications.tsx'
const MY = 'src/pages/user-profile/SellerSection.tsx'

export default [
  {
    name: '[판매알림] 정지 매장까지 범위에 넣는다',
    file: SRV,
    find: '  return scope.stores.filter((s) => isSeatableStoreStatus(s.status ?? null)).slice(0, NOTIF_MAX_STORES).map((s) => s.seller_id)',
    replace: '  return scope.stores.slice(0, NOTIF_MAX_STORES).map((s) => s.seller_id)',
    test: TEST,
    why: '정지된 매장은 좌석이 안 열린다 — 그 매장 알림을 계속 보여 주면 열 수 없는 화면으로 안내한다.',
  },
  {
    name: '[판매알림] 읽음 처리가 범위를 안 본다 (남의 매장 알림을 지운다)',
    file: SRV,
    find: "      const scopeSql = `recipient_type = 'seller' AND recipient_id IN (${marks}) AND is_read = 0`",
    replace: "      const scopeSql = `recipient_type = 'seller' AND (1 = 1 OR recipient_id IN (${marks})) AND is_read = 0`",
    test: TEST,
    why: '알림 id 는 순번이라 추측된다 — 범위가 없으면 남의 매장의 미읽음 표시를 지울 수 있다.',
  },
  {
    name: '[판매알림] 어드민 알림까지 섞인다',
    file: SRV,
    find: "          WHERE recipient_type = 'seller' AND recipient_id IN (${marks})",
    replace: '          WHERE recipient_id IN (${marks})',
    test: TEST,
    why: 'recipient_id 는 매장 id 와 어드민 id 가 같은 숫자 공간이다 — 종류를 안 보면 어드민 알림이 사장님께 간다.',
  },
  {
    name: '[판매알림] 죽은 좌석 가드가 이 경로를 막는다 (회수된 좌석이면 알림도 못 본다)',
    file: GUARD,
    find: "  '/api/seller/my-stores/notifications', '/api/seller/my-stores/notifications/read', // 🔔 2026-10-12 사람 기준 판매 알림\n",
    replace: '\n',
    test: TEST,
    why: '이 경로는 사람(쿠키)으로 판정한다 — 헤더에 남은 옛 좌석 토큰 때문에 401 이 나면 종이 빈다.',
  },
  {
    name: '[판매알림] 다른 가게 알림을 지금 좌석으로 연다',
    file: UI,
    find: '    if (n.sellerId !== currentSellerId) {',
    replace: '    if (false) {',
    test: TEST,
    why: '좌석 토큰이 매장을 정한다 — 연남 알림을 합정 좌석으로 열면 합정 주문 목록이 뜨고 사장님은 알림이 틀렸다고 읽는다.',
  },
  {
    name: '[판매알림] 마이에서 종이 사라진다',
    file: MY,
    find: "          <StoreNotifButton variant=\"row\" currentSellerId={store.seller_id} onOpenPage={(p) => { void openPage(p, '') }} />\n",
    replace: "          null\n",
    test: TEST,
    why: '대시보드 껍데기를 지우면 이 종이 판매 알림의 유일한 받은편지함이다.',
  },
]
