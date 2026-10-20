/**
 * 🛡️ 2026-06-18: 주문내역 '구매 내역 삭제(숨김)' — 실제 DELETE 금지(재무/감사 레코드 보존),
 *   사용자 뷰에서만 숨김. orders ALTER 회피 위해 side table + ensureXxx(WeakSet) 패턴
 *   (product-supply-meta.ts 와 동일 — CLAUDE.md 머니/정합성 룰: 핸들러 inline DDL 금지).
 *
 * - 멱등: INSERT OR IGNORE (order_id PK — order:user 1:1)
 * - 소유권: 호출측이 order.user_id 검증 후 호출 + user_id 도 저장(감사/복구용)
 * - self-healing: CREATE TABLE IF NOT EXISTS — repair-schema 의존 없이 첫 호출에 생성
 */
import type { D1Database } from '@cloudflare/workers-types'
import { swallow } from './swallow'

const _ensured = new WeakSet<object>()

export async function ensureHiddenOrdersTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS hidden_orders (
    order_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    hidden_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('hidden-orders:create'))
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_hidden_orders_user ON hidden_orders(user_id)'
  ).run().catch(swallow('hidden-orders:idx'))
}

/** 주문 숨김 (멱등). 소유권 검증은 호출측 책임. */
export async function hideOrder(DB: D1Database, orderId: number | string, userId: number | string): Promise<void> {
  await ensureHiddenOrdersTable(DB)
  await DB.prepare(
    "INSERT OR IGNORE INTO hidden_orders (order_id, user_id, hidden_at) VALUES (?, ?, datetime('now'))"
  ).bind(orderId, userId).run().catch(swallow('hidden-orders:hide'))
}
