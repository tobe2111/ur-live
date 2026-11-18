/** 📟🔐 2026-11-18 — 가드: src/tests/unit/scan-device-revoke-2026-11-18.test.ts */
const TEST = 'src/tests/unit/scan-device-revoke-2026-11-18.test.ts'
export default [
  {
    name: '[scan-revoke] 위임 회수가 스캔 기기 키를 안 끈다',
    file: 'src/worker/utils/seller-operators.ts',
    find: '    await revokeScanDevicesIssuedBy(DB, sellerId, userId)\n',
    replace: '',
    test: TEST,
    why: '회수된 운영자의 기기 링크로 이용권 사용 처리가 계속 된다.',
  },
  {
    name: '[scan-revoke] 발급자 기준 회수가 매장을 안 본다',
    file: 'src/worker/utils/scan-device-revoke.ts',
    find: 'WHERE seller_id = ? AND revoked_at IS NULL\n          AND id IN (SELECT device_id FROM seller_scan_device_issuers WHERE seller_id = ? AND user_id = ?)',
    replace: 'WHERE revoked_at IS NULL AND ? = ?\n          AND id IN (SELECT device_id FROM seller_scan_device_issuers WHERE user_id = ?)',
    test: TEST,
    why: '한 매장의 회수가 그 사람이 다른 매장에서 만든 키까지 끈다.',
  },
  {
    name: '[scan-revoke] 주인 발급분에도 발급자를 적는다',
    file: 'src/worker/utils/scan-device-revoke.ts',
    find: '  if (!operatorUserId || !Number.isInteger(deviceId) || deviceId <= 0) return\n',
    replace: '  operatorUserId = operatorUserId || 100\n',
    test: TEST,
    why: '발급자 표가 주인·운영자를 구분하지 못한다.',
  },
  {
    name: '[scan-revoke] 주인 변경이 기기 키를 남긴다',
    file: 'src/worker/utils/store-ownership-transfer.ts',
    find: '  await revokeAllScanDevices(DB, sellerId)\n',
    replace: '',
    test: TEST,
    why: '이전 주인 쪽 기기가 새 주인 매장의 이용권을 계속 처리한다.',
  },
  {
    name: '[scan-revoke] 재무 역할이 에이전시 지급 처리를 한다',
    file: 'src/shared/admin-roles.ts',
    find: "    'settlements', 'settlement', 'payout-center', 'payouts',",
    replace: "    'settlements', 'settlement', 'payout-center', 'payouts', 'agency-payouts',",
    test: TEST,
    why: '지급 처리 권한이 결재 없이 넓어진다.',
  },
]
