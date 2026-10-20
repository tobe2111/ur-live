import type { D1Database } from '@cloudflare/workers-types'

/**
 * 💸 2026-06-17: orders.deal_used 컬럼 보장 (per-request 멱등 ALTER, WeakSet 메모이즈).
 *
 * 혼합 결제(Toss + 딜 포인트) 주문의 '딜 사용분' 을 주문에 기록 — 결제 성공(/confirm)에서
 * 이 값만큼 잔액 차감, 환불 시 복원. repair-schema 가 영구 추가하지만, 첫 배포/신규 DB 에서
 * 주문 생성이 먼저 닿을 수 있어 호출 시점에 한 번 보강한다(이미 있으면 ALTER 실패 → 무시).
 */
const _ensured = new WeakSet<D1Database>()

export async function ensureOrdersDealUsed(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare('ALTER TABLE orders ADD COLUMN deal_used INTEGER DEFAULT 0').run()
  } catch {
    // 이미 존재 — 정상.
  }
}
