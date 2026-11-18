/**
 * 📟🔐 2026-11-18 (대표 *"모두 이상적으로 해줘"*): 계산대 스캔 기기 키의 **발급자 기록**과 **함께 끊기**.
 *
 * 종전: 위임받은 운영자가 만든 스캔 기기 키는 사장님이 그 사람의 위임을 회수해도 살아 있었다.
 *   좌석 토큰은 끊기는데 기기 키는 사람과 무관하게 매장에만 묶여 있어서다 — 그 키로 이용권 사용 처리가 계속 된다.
 * 지금: 발급할 때 **누가 만들었는지**를 옆 표에 적고, 그 사람의 위임이 끝나면 그 사람이 만든 키를 같이 끈다.
 *   매장 주인이 바뀌거나 매장이 탈퇴하면 그 매장의 키를 전부 끈다(새 주인은 새로 발급한다).
 *
 * 옆 표(`seller_scan_device_issuers`)인 이유: `seller_scan_devices` 는 라이브 컬럼 사진에 있는 표라
 *   컬럼을 늘리면 배포 전까지 가드와 어긋난다. 발급자는 운영자일 때만 적는다(주인 발급분은 행이 없다).
 *
 * ## 못 막는 것
 * - 이 변경 **이전에** 운영자가 만든 키 — 누가 만들었는지 기록이 없다. 주인 화면 목록에서 끌 수 있다.
 * - 에이전시 직원 좌석이 만든 키(사람 id 가 없다) — 에이전시 연결이 끝날 때의 처리는 여기 없다.
 */
import type { D1Database } from '@cloudflare/workers-types'

const ensured = new WeakSet<object>()
export async function ensureScanDeviceIssuers(DB: D1Database): Promise<void> {
  if (ensured.has(DB as unknown as object)) return
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS seller_scan_device_issuers (
      device_id INTEGER PRIMARY KEY,
      seller_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ).run()
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_scan_device_issuers_seller_user ON seller_scan_device_issuers(seller_id, user_id)').run().catch(() => {})
  ensured.add(DB as unknown as object)
}

/** 운영자가 만든 키면 발급자를 적는다. 주인(operatorUserId null)이면 아무것도 안 한다. */
export async function recordScanDeviceIssuer(
  DB: D1Database, deviceId: number, sellerId: number, operatorUserId: number | null,
): Promise<void> {
  if (!operatorUserId || !Number.isInteger(deviceId) || deviceId <= 0) return
  await ensureScanDeviceIssuers(DB)
  await DB.prepare('INSERT OR IGNORE INTO seller_scan_device_issuers (device_id, seller_id, user_id) VALUES (?, ?, ?)')
    .bind(deviceId, sellerId, operatorUserId).run()
}

/** 그 사람이 이 매장에서 만든 살아 있는 키를 끈다. 실패는 삼키지 않고 0 을 돌려준다(회수 자체는 막지 않는다). */
export async function revokeScanDevicesIssuedBy(DB: D1Database, sellerId: number, userId: number): Promise<number> {
  try {
    await ensureScanDeviceIssuers(DB)
    const r = await DB.prepare(
      `UPDATE seller_scan_devices SET revoked_at = datetime('now')
        WHERE seller_id = ? AND revoked_at IS NULL
          AND id IN (SELECT device_id FROM seller_scan_device_issuers WHERE seller_id = ? AND user_id = ?)`,
    ).bind(sellerId, sellerId, userId).run()
    return r.meta?.changes ?? 0
  } catch (err) {
    console.warn('[scan-device-revoke] by-issuer failed', (err as Error)?.message)
    return 0
  }
}

/** 매장의 살아 있는 키를 전부 끈다 — 주인이 바뀌었거나 매장이 탈퇴했을 때. */
export async function revokeAllScanDevices(DB: D1Database, sellerId: number): Promise<number> {
  try {
    const r = await DB.prepare(
      "UPDATE seller_scan_devices SET revoked_at = datetime('now') WHERE seller_id = ? AND revoked_at IS NULL",
    ).bind(sellerId).run()
    return r.meta?.changes ?? 0
  } catch (err) {
    console.warn('[scan-device-revoke] all failed', (err as Error)?.message)
    return 0
  }
}
