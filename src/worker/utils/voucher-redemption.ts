/**
 * 🛰️ 2026-06-23 (대표 — 최종 이상형 #3): 사용처리 위치 "증거"(소프트, 게이트 X).
 *   self-redeem 시 손님 GPS 를 *기록만* — 막지 않음(스푸핑/실내오차로 정상 손님 차단 금지).
 *   분쟁 발생 시에만 "사용 위치 ↔ 가게 거리"를 어드민 증거로 활용.
 *   별도 사이드테이블(voucher_redemptions) — vouchers 핫 테이블 미변경.
 */
const _ensuredRedemption = new WeakSet<object>()
export async function ensureVoucherRedemptionsTable(DB: D1Database) {
  if (_ensuredRedemption.has(DB)) return
  _ensuredRedemption.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS voucher_redemptions (
      voucher_id INTEGER PRIMARY KEY,
      used_lat REAL,
      used_lng REAL,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
  } catch { /* ignore */ }
}

/** 위치 기록(베스트에포트). 유효 범위 밖/비유한이면 무시. 멱등(INSERT OR REPLACE). */
export async function recordVoucherRedemptionLocation(
  DB: D1Database,
  voucherId: number,
  lat: unknown,
  lng: unknown,
): Promise<void> {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return
  if (la === 0 && ln === 0) return // null island = 무의미
  try {
    await ensureVoucherRedemptionsTable(DB)
    await DB.prepare(
      "INSERT OR REPLACE INTO voucher_redemptions (voucher_id, used_lat, used_lng, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(voucherId, la, ln).run()
  } catch { /* best-effort */ }
}
