/**
 * Order status state machine
 * ==========================
 *
 * Centralises the legal state transitions for `orders.status` and provides a
 * single atomic helper to transition orders safely under concurrent requests.
 *
 * Why: without a state machine, two concurrent requests can rewrite `status`
 * in incompatible directions (e.g. a refund webhook flipping PAID → PENDING,
 * or a seller bulk update flipping DELIVERED → SHIPPING). We enforce the
 * allowed graph below and use a conditional UPDATE
 *   `UPDATE orders SET status = ? WHERE id = ? AND status IN (<prev>)`
 * so only one transition wins.
 *
 * The transition map is intentionally permissive about synonyms Toss/Kakao
 * use in different environments (PAID and DONE are treated as the same state).
 */
import type { D1Database } from '@cloudflare/workers-types';

export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING:           ['PAID', 'DONE', 'AWAITING_PAYMENT', 'CANCELLED', 'FAILED'],
  AWAITING_PAYMENT:  ['PAID', 'DONE', 'CANCELLED', 'FAILED'],
  // PAID / DONE are synonyms — both can progress to any *forward* fulfillment state.
  // 🛡️ 2026-07-05 (대표 신고 — 관리자가 결제완료 주문을 '배송 완료'로 못 바꿈): 결제 이후
  //   이행 상태(PREPARING/SHIPPING/DELIVERED)로의 **전진 건너뛰기**를 허용. 관리자/셀러가
  //   PAID 주문을 곧장 DELIVERED 로 표시(교환권·매장픽업·외부 송장 등 SHIPPING 단계가 없는
  //   케이스)할 수 있어야 함. 머니-안전 불변 유지: 뒤로가기(DELIVERED→SHIPPING) 차단,
  //   종결상태 유지, 미결제(PENDING/AWAITING_PAYMENT)는 여전히 이행상태로 점프 불가(선결제),
  //   CANCELLED/REFUNDED 는 계속 refundOrderFully 경유(여기 추가 안 함).
  PAID:              ['DONE', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
  DONE:              ['PAID', 'PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
  PREPARING:         ['SHIPPING', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
  SHIPPING:          ['DELIVERED', 'CANCELLED', 'REFUNDED'],
  DELIVERED:         ['REFUNDED'],
  // Terminal states — no outgoing transitions.
  CANCELLED:         [],
  REFUNDED:          [],
  FAILED:            [],
};

const ALIAS: Record<string, string> = {
  PAY_COMPLETE: 'PAID',
};

function normalize(status: string | null | undefined): string {
  if (!status) return '';
  const upper = String(status).toUpperCase();
  return ALIAS[upper] ?? upper;
}

/**
 * Returns whether `from → to` is a legal transition.
 */
export function canTransition(from: string | null | undefined, to: string): boolean {
  const f = normalize(from);
  const t = normalize(to);
  if (!f || !t) return false;
  if (f === t) return true; // idempotent (no-op) transitions are allowed
  const allowed = ORDER_TRANSITIONS[f];
  if (!allowed) return false;
  return allowed.includes(t);
}

/**
 * Returns the list of statuses that can legally transition INTO `to`.
 * Used to build atomic CAS UPDATEs:
 *   `UPDATE orders SET status = ? WHERE id = ? AND status IN (...allowedPrev)`
 */
export function statusesThatCanReach(to: string): string[] {
  const t = normalize(to);
  const result: string[] = [];
  for (const [from, tos] of Object.entries(ORDER_TRANSITIONS)) {
    if (tos.includes(t)) result.push(from);
  }
  return result;
}

export interface TransitionOptions {
  /** Extra SET fields to append (e.g. paid_at, cancel_reason). */
  extraSets?: Record<string, unknown>;
  /** Override the set of allowed previous statuses. Default: derived from graph. */
  allowedPrev?: string[];
  /** Match by order_number instead of id. */
  matchByOrderNumber?: boolean;
}

/**
 * Atomically transition an order's status. Returns true if the row actually
 * moved; false if the transition was rejected (wrong current state or the
 * order doesn't exist).
 */
export async function transitionOrderStatus(
  DB: D1Database,
  orderIdOrNumber: number | string,
  toStatus: string,
  opts: TransitionOptions = {},
): Promise<boolean> {
  const target = normalize(toStatus);
  if (!target) return false;

  const allowedPrev = (opts.allowedPrev ?? statusesThatCanReach(target)).map(normalize);
  if (allowedPrev.length === 0) {
    // No prior state can move here — nothing to do.
    return false;
  }

  // Build SET clause
  const setClauses: string[] = ['status = ?', "updated_at = datetime('now')"];
  const setValues: unknown[] = [target];
  if (opts.extraSets) {
    for (const [col, val] of Object.entries(opts.extraSets)) {
      if (val === undefined) continue;
      setClauses.push(`${col} = ?`);
      setValues.push(val);
    }
  }

  const whereCol = opts.matchByOrderNumber ? 'order_number' : 'id';
  const placeholders = allowedPrev.map(() => '?').join(',');

  const sql = `UPDATE orders
               SET ${setClauses.join(', ')}
               WHERE ${whereCol} = ?
                 AND UPPER(status) IN (${placeholders})`;

  const result = await DB.prepare(sql)
    .bind(...setValues, orderIdOrNumber, ...allowedPrev)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}
