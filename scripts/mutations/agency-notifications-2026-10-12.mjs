/**
 * 🔔 에이전시 콘솔 판매 알림 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/agency-notifications-2026-10-12.test.tsx
 */
const TEST = 'src/tests/unit/agency-notifications-2026-10-12.test.tsx'
const SRV = 'src/features/agency-console/api/agency-store-notifications.ts'
const PANEL = 'src/pages/agency-console/AgencyStoresPanel.tsx'

export default [
  {
    name: '[콘솔알림] 맡김 요청 단계 매장 알림까지 보인다',
    file: SRV,
    find: "      WHERE l.agency_id = ? AND l.status = 'active'\n",
    replace: "      WHERE l.agency_id = ? AND l.status IN ('active','pending')\n",
    test: TEST,
    why: '수락 전 매장은 아직 우리 매장이 아니다 — 사장님 알림을 에이전시가 먼저 본다.',
  },
  {
    name: '[콘솔알림] 직원 배정을 안 본다 (배정 밖 매장 알림이 보인다)',
    file: SRV,
    find: "        AND ${staffStoreAccessSql('me', 'l.seller_id')}\n      LIMIT ${AGENCY_NOTIF_MAX_STORES}`,",
    replace: '      LIMIT ${AGENCY_NOTIF_MAX_STORES}`,',
    test: TEST,
    why: '관리자가 고른 매장만 맡긴 직원이 다른 매장의 주문·정산 알림을 본다.',
  },
  {
    name: '[콘솔알림] 판매 알림이 매장 범위를 안 본다',
    file: 'src/features/agency-console/api/channel-sales.ts',
    find: "      WHERE p.seller_id IN (${ids.map(() => '?').join(',')}) AND COALESCE(v.is_experience, 0) = 0",
    replace: "      WHERE (1 = 1 OR p.seller_id IN (${ids.map(() => '?').join(',')})) AND COALESCE(v.is_experience, 0) = 0",
    test: TEST,
    why: '배정 안 된 매장(같은 에이전시라도 이 직원 담당 밖)의 판매가 알림으로 샌다.',
  },
  {
    name: '[콘솔알림] 알림을 누를 때마다 좌석을 새로 받는다',
    file: PANEL,
    find: '    if (!isMyAgencySeat(store.sellerId, staffId)) {\n      const r = await enterAgencyStore(store.sellerId, store.name)',
    replace: '    {\n      const r = await enterAgencyStore(store.sellerId, store.name)',
    test: TEST,
    why: '좌석 발급은 레이트리밋이 걸린 요청이다 — 같은 매장 알림을 연달아 열면 30번째에서 막힌다.',
  },
  {
    name: '[콘솔알림] 콘솔에서 판매 알림 줄이 사라진다',
    file: PANEL,
    find: '            label="판매 알림"\n',
    replace: '            label="알림 꺼짐"\n',
    test: TEST,
    why: '대시보드 껍데기를 지우면 에이전시 직원의 유일한 판매 알림함이다.',
  },
]
