/**
 * 🎟️ 2026-07-02 (대표 "사장님이 현지 사용 방식을 선택") — 매장별 이용권 사용 방식 설정 SSOT.
 *
 * 모드 3종:
 *  - 'scan_only'  : 직원 확인만 — 손님 셀프 사용 비활성(QR 스캔/코드 직접입력만). 가장 엄격.
 *  - 'store_code' : 셀프 사용 시 매장 확인코드(숫자, 카운터 스티커 — 신규 발급 6자리, 기존 4자리 유효) 입력 필수 — 매장에 실제
 *                   있어야만 사용 가능(원격 오사용·60초 취소 악용 구조적 차단). 유저 셀프취소 불가.
 *  - 'self_free'  : ⛔ **폐기(2026-09-03 대표 확정)** — "우리는 QR 아니면 매장 확인코드야".
 *                   코드 없이 아무 데서나 소각되던 모드. 아래 SELECTABLE_MODES 에서 빠져
 *                   더는 저장될 수 없고, 예전에 저장된 값도 읽는 순간 'store_code' 로 읽힌다.
 *
 * 🔑 **두 방식은 양자택일이 아니다.** 직원 QR 스캔(`/:code/use-by-seller`)은 **모드와 무관하게
 *   항상 열려 있다**(그 경로엔 모드 검사가 없다). 모드는 **손님 셀프 사용**만 가른다:
 *     scan_only  = 셀프 차단(직원 QR 만)
 *     store_code = 셀프 시 매장 확인코드 필수  **+ 직원 QR 도 그대로**  ← 기본값
 *
 * 미설정 매장 = 'store_code'. 확인코드는 조회 시 자동 발급되므로 사장님이 아무것도 안 해도
 * 코드가 존재한다(대시보드에서 확인). 손님은 매장에 실제로 있어야만 셀프 사용할 수 있다.
 */
import { swallow } from './swallow'

export type RedemptionMode = 'scan_only' | 'store_code' | 'self_free'
/**
 * 저장·검증에 쓰는 목록 — **`self_free` 는 없다**(2026-09-03 폐기).
 *
 * ⚠️ 이 목록에서 빠진 값은 `getRedemptionSettings` 의 검증도 통과 못 하므로, DB 에 남아 있는
 *   옛 `self_free` 행은 **읽는 순간 기본값(store_code)** 이 된다 — 별도 데이터 이관이 필요 없다.
 */
export const REDEMPTION_MODES: readonly RedemptionMode[] = ['scan_only', 'store_code'] as const

/** 미설정·폐기값·조회실패의 귀착점. fail-**closed**: 모르면 느슨한 쪽이 아니라 코드를 요구한다. */
export const DEFAULT_REDEMPTION_MODE: RedemptionMode = 'store_code'

const _ensured = new WeakSet<object>()
export async function ensureRedemptionSettingsTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_redemption_settings (
      seller_id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'store_code',
      store_code TEXT,
      updated_at DATETIME DEFAULT (datetime('now'))
    )`).run()
  } catch { /* exists */ }
}

/**
 * 매장 확인코드 생성 — 6자리 숫자(스티커/구두 전달용, 혼동 문자 없음).
 *
 * 🛡️ 2026-07-11 보안(R1, docs/design/pre-launch-security-audit-2026-07.md): 4자리(9,000조합)
 *   → 6자리(900,000조합) 확대 — self-redeem 원격 브루트포스 여지 축소(rate limit 와 이중 방어).
 *   ⚠️ 하위호환: 검증부(self-redeem)는 문자열 정확일치라 기존 발급된 4자리 코드도 그대로 유효
 *   (재발급 불필요) — 이 함수는 신규/재발급분에만 적용되어 그 분부터 6자리로 강해짐.
 */
export function generateStoreCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
}

export async function getRedemptionSettings(
  DB: D1Database,
  sellerId: number,
): Promise<{ mode: RedemptionMode; store_code: string | null }> {
  try {
    await ensureRedemptionSettingsTable(DB)
    const row = await DB.prepare(
      'SELECT mode, store_code FROM seller_redemption_settings WHERE seller_id = ?'
    ).bind(sellerId).first<{ mode: string; store_code: string | null }>()
    const mode = (REDEMPTION_MODES as readonly string[]).includes(row?.mode || '')
      ? (row!.mode as RedemptionMode) : DEFAULT_REDEMPTION_MODE
    return { mode, store_code: row?.store_code ?? null }
  } catch {
    // 🔒 2026-09-03: 예전엔 fail-open(self_free)이라 **DB 가 한 번 삐끗하면 아무나 소각**할 수 있었다.
    //   모르면 막는 쪽으로 — 직원 QR 은 어차피 이 설정과 무관하게 살아 있다.
    return { mode: DEFAULT_REDEMPTION_MODE, store_code: null }
  }
}

export async function upsertRedemptionSettings(
  DB: D1Database,
  sellerId: number,
  mode: RedemptionMode,
  storeCode: string | null,
): Promise<void> {
  await ensureRedemptionSettingsTable(DB)
  await DB.prepare(`
    INSERT INTO seller_redemption_settings (seller_id, mode, store_code, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(seller_id) DO UPDATE SET mode = excluded.mode, store_code = excluded.store_code, updated_at = datetime('now')
  `).bind(sellerId, mode, storeCode).run().catch(swallow('redemption-settings:upsert'))
}
