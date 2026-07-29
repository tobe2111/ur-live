/**
 * 🤝 매장↔에이전시 위임(delegation) 관계 — 설계 SSOT: docs/design/vendor-commission-passthrough.md §4.3
 *   (2026-07-08 대표 확정 · 3단 권한 모델: 'self' 셀프형 / 'approval' 승인형(기본) / 'full' 완전위임형)
 *
 * ⚠️ 이 모듈은 **관계 + 모드 저장만** — 돈 효과 0.
 *   분배 엔진(vendor_commission_splits 발효/강등, pass-through 적립)은 **미구현**(8월 flip 과 함께,
 *   docs/design/commission-funding-restructure.md 참조). 지금은 위임 관계 관리 + 읽기 전용 투명성 API 의 토대.
 *
 * 🔒 불변 원칙 (§4.3 — 어느 모드에서도 절대):
 *   1. 투명성: 매장은 자기 promo 지출 내역을 항상 조회 가능(완전위임형이어도).
 *   2. 회수권: 매장은 위임을 언제든 회수('full'/'approval' → 'self') 가능 — 조건 없음.
 *   3. 유어딜은 캡·투명성 가드만: 값·승인·분배엔 관여 안 함. 유어딜 5% 무관.
 */

export type DelegationMode = 'self' | 'approval' | 'full'

export const DELEGATION_MODES: readonly DelegationMode[] = ['self', 'approval', 'full'] as const

export function isDelegationMode(v: unknown): v is DelegationMode {
  return v === 'self' || v === 'approval' || v === 'full'
}

// 🛡️ per-worker 메모이제이션 (per-request DDL 금지 — 머니 부수 룰)
const _done_ensureStoreAgencyDelegation = new WeakSet<object>()

/** store_agency_delegation 테이블 보장 — repair-schema.routes.ts 에도 동일 CREATE 등록(이중 방어). */
export async function ensureStoreAgencyDelegation(DB: D1Database): Promise<void> {
  if (_done_ensureStoreAgencyDelegation.has(DB)) return
  _done_ensureStoreAgencyDelegation.add(DB)
  try {
    // 설계 §4.3 스케치 그대로 + id/타임스탬프 (UNIQUE(seller_id, agency_id) = upsert 멱등 기반)
    await DB.prepare(`CREATE TABLE IF NOT EXISTS store_agency_delegation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      agency_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'approval',
      granted_at DATETIME,
      revoked_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      UNIQUE(seller_id, agency_id)
    )`).run()
    await DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_store_agency_delegation_agency ON store_agency_delegation(agency_id, mode)`
    ).run().catch(() => { /* best-effort */ })
  } catch { /* fail-soft — 조회부는 .catch 폴백 보유 */ }
}

export interface DelegationRow {
  id: number
  seller_id: number
  agency_id: number
  mode: DelegationMode
  granted_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

/**
 * 현재 위임 모드 조회.
 * @returns row 있으면 그 mode / **없으면 null** — 해석은 호출부 몫.
 *   (설계 의미: 관계 자체가 없으면 사실상 'self'(매장 셀프 운영)와 동일하지만,
 *    "신규 관계의 기본 모드는 'approval'" 이라는 §4.3 의 기본값과 혼동하지 않도록
 *    이 함수는 저장된 사실만 반환한다. UI 라벨: null → '미위임(셀프)'.)
 */
export async function getDelegationMode(
  DB: D1Database,
  sellerId: number,
  agencyId: number,
): Promise<DelegationMode | null> {
  await ensureStoreAgencyDelegation(DB)
  const row = await DB.prepare(
    `SELECT mode FROM store_agency_delegation WHERE seller_id = ? AND agency_id = ? LIMIT 1`
  ).bind(sellerId, agencyId).first<{ mode: string }>().catch(() => null)
  if (!row) return null
  return isDelegationMode(row.mode) ? row.mode : null
}

/**
 * 위임 부여/갱신 (매장만 호출 — grant 는 매장의 권한, 유어딜/에이전시는 요청만).
 * UNIQUE(seller_id, agency_id) upsert — granted_at 갱신 + revoked_at 해제.
 */
export async function upsertDelegation(
  DB: D1Database,
  sellerId: number,
  agencyId: number,
  mode: DelegationMode,
): Promise<void> {
  await ensureStoreAgencyDelegation(DB)
  await DB.prepare(
    `INSERT INTO store_agency_delegation (seller_id, agency_id, mode, granted_at, revoked_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), NULL, datetime('now'))
     ON CONFLICT(seller_id, agency_id) DO UPDATE SET
       mode = excluded.mode,
       granted_at = datetime('now'),
       revoked_at = NULL,
       updated_at = datetime('now')`
  ).bind(sellerId, agencyId, mode).run()
}

/**
 * 위임 회수 (🔒 불변 원칙 #2 — 매장은 언제든, 조건 없이).
 * mode → 'self' + revoked_at 기록. 진행 중 에이전시 설정의 'proposed' 강등은
 * vendor_commission_splits 구현(8월)과 함께 — 지금은 모드 전환만(§4.3 열린 결정).
 * @returns 변경된 행 수 (0 = 위임 관계 없음)
 */
export async function revokeDelegation(
  DB: D1Database,
  sellerId: number,
  agencyId: number,
): Promise<number> {
  await ensureStoreAgencyDelegation(DB)
  const res = await DB.prepare(
    `UPDATE store_agency_delegation
        SET mode = 'self', revoked_at = datetime('now'), updated_at = datetime('now')
      WHERE seller_id = ? AND agency_id = ?`
  ).bind(sellerId, agencyId).run()
  return res.meta?.changes ?? 0
}
