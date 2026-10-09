/**
 * 📏 2026-10-08 (대표 "1,2 모두 진행해줘" — ① 실제로 잘 읽히는지 기록): 계산대 스캔 세션 한 줄 적재.
 * 라우트(`POST /api/seller/scan-telemetry`)는 seller-scan-devices.routes.ts 에 있다(같은 신원 규칙).
 *
 * 클라이언트: `src/components/voucher/scan-telemetry.ts` (스캔 화면을 한 번 열 때마다 정확히 한 줄).
 * 왜: 10-07 에 카메라를 세 번 고쳤는데 근거가 전부 신고와 추측이었다. 못 읽는 것은 에러가 아니라
 *   로그가 남지 않는다 — 다음 수정부터는 이 표를 보고 한다.
 *
 * 🔐 **스캔과 같은 신원만 받는다** — 사장님 seller JWT, 또는 스캔 전용 기기 키(직원 폰).
 *   ⚠️ 기기 키는 `verifyScanDeviceKey` 를 **직접** 부른다 — `scanOrSellerAuth` 미들웨어를 배선하지 않는다
 *   (그 미들웨어는 use-by-seller 전용 · "scope 확장 금지" 룰). 여기서 신원은 **귀속**에만 쓰이고 권한을 주지 않는다.
 *   신원이 없으면 **204 로 조용히 버린다** — 익명 쓰기 구멍을 만들지 않고, 클라이언트에 오류도 안 띄운다.
 * 🔒 개인정보 없음 — 코드·상품·손님·UA 원문을 받지 않는다(플랫폼은 ios/android/other 세 갈래).
 * ⚠️ 모든 값은 화이트리스트·범위 검증 후 저장한다(숫자는 정수 클램프, 문자열은 enum).
 */
const OUTCOMES = ['read', 'photo', 'manual', 'none', 'camera_error'] as const
const ENGINES = ['detector', 'wasm'] as const
const PLATFORMS = ['ios', 'android', 'other'] as const
/** 한 세션이 이보다 길면 값이 아니라 고장이다(계산대가 하루 종일 열려 있어도 첫 코드는 그 안에 온다). */
const MAX_MS = 6 * 60 * 60 * 1000

const ensured = new WeakSet<object>()
export async function ensureScanSessionsTable(DB: D1Database): Promise<void> {
  if (ensured.has(DB as unknown as object)) return
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS voucher_scan_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      scan_device_id INTEGER,
      platform TEXT NOT NULL,
      engine TEXT,
      handed_over INTEGER NOT NULL DEFAULT 0,
      cam_count INTEGER,
      lens_cached INTEGER NOT NULL DEFAULT 0,
      lens_repicked INTEGER NOT NULL DEFAULT 0,
      camera_ms INTEGER,
      first_read_ms INTEGER,
      outcome TEXT NOT NULL,
      help_shown INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`
  ).run()
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_scan_sessions_created ON voucher_scan_sessions(created_at)').run().catch(() => {})
  ensured.add(DB as unknown as object)
}

function pick<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null
}
function msOrNull(v: unknown): number | null {
  const n = Number(v)
  if (v == null || !Number.isFinite(n) || n < 0) return null
  return Math.min(MAX_MS, Math.round(n))
}
const flag = (v: unknown): 0 | 1 => (v === 1 || v === true ? 1 : 0)

export interface ScanSessionRow {
  platform: (typeof PLATFORMS)[number]
  engine: (typeof ENGINES)[number] | null
  handed_over: 0 | 1
  cam_count: number | null
  lens_cached: 0 | 1
  lens_repicked: 0 | 1
  camera_ms: number | null
  first_read_ms: number | null
  outcome: (typeof OUTCOMES)[number]
  help_shown: 0 | 1
}

/** 순수 검증 — 받을 수 없는 몸이면 null. (테스트가 직접 부른다) */
export function parseScanSession(body: unknown): ScanSessionRow | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const outcome = pick(b.outcome, OUTCOMES)
  const platform = pick(b.platform, PLATFORMS)
  if (!outcome || !platform) return null
  const cam = Number(b.cam_count)
  return {
    platform,
    engine: pick(b.engine, ENGINES),
    handed_over: flag(b.handed_over),
    cam_count: b.cam_count == null || !Number.isFinite(cam) ? null : Math.max(0, Math.min(16, Math.round(cam))),
    lens_cached: flag(b.lens_cached),
    lens_repicked: flag(b.lens_repicked),
    camera_ms: msOrNull(b.camera_ms),
    first_read_ms: msOrNull(b.first_read_ms),
    outcome,
    help_shown: flag(b.help_shown),
  }
}

/** 한 줄 적재. 실패는 호출자가 삼킨다(fail-soft). */
export async function insertScanSession(DB: D1Database, sellerId: number, deviceId: number | null, row: ScanSessionRow): Promise<void> {
  await ensureScanSessionsTable(DB)
  await DB.prepare(
    `INSERT INTO voucher_scan_sessions
      (seller_id, scan_device_id, platform, engine, handed_over, cam_count, lens_cached, lens_repicked, camera_ms, first_read_ms, outcome, help_shown)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    sellerId, deviceId, row.platform, row.engine, row.handed_over, row.cam_count,
    row.lens_cached, row.lens_repicked, row.camera_ms, row.first_read_ms, row.outcome, row.help_shown,
  ).run()
}
