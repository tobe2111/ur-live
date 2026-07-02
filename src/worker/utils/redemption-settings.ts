/**
 * 🎟️ 2026-07-02 (대표 "사장님이 현지 사용 방식을 선택") — 매장별 이용권 사용 방식 설정 SSOT.
 *
 * 모드 3종:
 *  - 'scan_only'  : 직원 확인만 — 손님 셀프 사용 비활성(QR 스캔/코드 직접입력만). 가장 엄격.
 *  - 'store_code' : 셀프 사용 시 매장 확인코드(4자리, 카운터 스티커) 입력 필수 — 매장에 실제
 *                   있어야만 사용 가능(원격 오사용·60초 취소 악용 구조적 차단). 유저 셀프취소 불가.
 *  - 'self_free'  : 자유 셀프 사용(현행 기본 — 카운터 느슨한 매장). 60초 셀프취소 허용.
 * 미설정 매장 = 'self_free' (기존 동작 보존).
 */
import { swallow } from './swallow'

export type RedemptionMode = 'scan_only' | 'store_code' | 'self_free'
export const REDEMPTION_MODES: readonly RedemptionMode[] = ['scan_only', 'store_code', 'self_free'] as const

const _ensured = new WeakSet<object>()
export async function ensureRedemptionSettingsTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_redemption_settings (
      seller_id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'self_free',
      store_code TEXT,
      updated_at DATETIME DEFAULT (datetime('now'))
    )`).run()
  } catch { /* exists */ }
}

/** 매장 확인코드 생성 — 4자리 숫자(스티커/구두 전달용, 혼동 문자 없음). */
export function generateStoreCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(1000 + (buf[0] % 9000))
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
      ? (row!.mode as RedemptionMode) : 'self_free'
    return { mode, store_code: row?.store_code ?? null }
  } catch {
    return { mode: 'self_free', store_code: null } // fail-open: 기존 동작
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
