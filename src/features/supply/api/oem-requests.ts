/**
 * 🏭 2026-06-03 유통스타트 도매몰 — OEM/ODM 신청·매칭.
 * (스펙: 유통회원이 OEM/ODM 신청 → 유통스타트가 제조사 찾기·연결·생산까지 지원)
 *
 * 흐름: 유통회원 신청(open) → 관리자 검토/제조사 매칭(matching→matched) → 종료(closed)/반려(rejected).
 */
import { swallow } from '@/worker/utils/swallow'

export const OEM_STATUSES = ['open', 'matching', 'matched', 'closed', 'rejected'] as const
export type OemStatus = (typeof OEM_STATUSES)[number]

const _ensured = new WeakSet<object>()

export async function ensureOemSchema(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS oem_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_seller_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'OEM',
    product_name TEXT NOT NULL,
    category TEXT,
    target_qty INTEGER,
    target_price INTEGER,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    admin_memo TEXT,
    matched_supplier_id INTEGER,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('oem:create'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_oem_seller ON oem_requests(distributor_seller_id, created_at DESC)')
    .run().catch(swallow('oem:idx-seller'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_oem_status ON oem_requests(status, created_at DESC)')
    .run().catch(swallow('oem:idx-status'))
}

export function normalizeOemStatus(v: unknown): OemStatus | null {
  const s = String(v || '').toLowerCase()
  return (OEM_STATUSES as readonly string[]).includes(s) ? (s as OemStatus) : null
}
