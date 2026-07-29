/**
 * 🛰️ 2026-06-23 (대표 — 최종 이상형 #3): 사용처리 위치 "증거"(소프트, 게이트 X).
 *   self-redeem 시 손님 GPS 를 *기록만* — 막지 않음(스푸핑/실내오차로 정상 손님 차단 금지).
 *   분쟁 발생 시에만 "사용 위치 ↔ 가게 거리"를 어드민 증거로 활용.
 *   별도 사이드테이블(voucher_redemptions) — vouchers 핫 테이블 미변경.
 *
 * 🔒 2026-07-13 (데이터 감사 1단계 — 대표 승인 "위치 원좌표 하향"): 정밀좌표 원본 저장 중단.
 *   법무 답변 전까지 위치는 **상권/매장 단위 이상**으로만 보존 → 소수 2자리(≈1.1km 격자)로
 *   양자화해 저장(개인 정밀위치 미보존, 상권 단위 분쟁증거는 유지). 기존 정밀 행도 일회성 하향.
 *   원좌표 정밀 저장 재개는 법무 답변 후 별도 결정.
 */
/** 위치 정밀도 하향 격자(소수 자릿수). 2 = ≈1.1km(상권 단위). 법무 답변 후 조정. */
const LOCATION_COARSE_DECIMALS = 2
const _coarseFactor = Math.pow(10, LOCATION_COARSE_DECIMALS)
/** 원좌표를 상권 단위 격자로 양자화(중심 스냅). 개인 정밀위치 미보존. */
function coarsenCoord(v: number): number {
  return Math.round(v * _coarseFactor) / _coarseFactor
}

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
    // 🔒 일회성 하향: 이미 저장된 정밀좌표를 상권 단위 격자로 라운딩(법무 전 정밀좌표 미보존).
    //   멱등(이미 격자값이면 no-op) · best-effort(실패해도 사용처리 무영향).
    await DB.prepare(
      `UPDATE voucher_redemptions
          SET used_lat = ROUND(used_lat, ${LOCATION_COARSE_DECIMALS}),
              used_lng = ROUND(used_lng, ${LOCATION_COARSE_DECIMALS})
        WHERE used_lat IS NOT NULL AND used_lng IS NOT NULL
          AND (used_lat <> ROUND(used_lat, ${LOCATION_COARSE_DECIMALS})
            OR used_lng <> ROUND(used_lng, ${LOCATION_COARSE_DECIMALS}))`
    ).run()
  } catch { /* ignore */ }
}

/**
 * 위치 기록(베스트에포트). 유효 범위 밖/비유한이면 무시. 멱등(INSERT OR REPLACE).
 * 🔒 정밀좌표는 저장하지 않음 — 상권 단위(≈1.1km) 격자로 양자화 후 저장(법무 전 정밀위치 미보존).
 */
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
  // 🔒 상권 단위 격자로 하향 — 정밀 원좌표는 DB 에 남기지 않음.
  const laCoarse = coarsenCoord(la)
  const lnCoarse = coarsenCoord(ln)
  try {
    await ensureVoucherRedemptionsTable(DB)
    await DB.prepare(
      "INSERT OR REPLACE INTO voucher_redemptions (voucher_id, used_lat, used_lng, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(voucherId, laCoarse, lnCoarse).run()
  } catch { /* best-effort */ }
}
