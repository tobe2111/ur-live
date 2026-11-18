/**
 * 🔑🔐 2026-11-18 (대표 *"다 해결해줘"*) — 결제 키 한 개는 **구매 한 곳**에만 쓰인다.
 *
 * ## 무엇을 막나
 * 토스는 이미 승인된 결제를 같은 (paymentKey, orderId, amount)로 다시 승인하라고 하면 "이미 처리됨" 으로 답하고,
 * 우리 게이트웨이는 그것을 **성공**으로 읽는다(새로고침·재시도 때문에 필요한 동작이다).
 * 그런데 확정 주소가 여러 개고(이용권 · 장바구니 · 숙소 · 체험 신청권 · 생활견적 참여권 · 딜 충전 · 선물),
 * 각자 **자기 표 안에서만** 중복을 봤다. ⇒ 한 번 낸 결제를 다른 확정 주소에 그대로 내밀면 양쪽에서 다 받았다.
 * (예: 체험 신청권을 결제 → 같은 값으로 이용권 확정 → 신청권을 환불해도 이용권은 남는다.)
 *
 * ## 어떻게
 * 승인 **전에** 전역 장부(`payment_key_claims`)에 (결제 키 → 어느 구매·어느 주문)을 `INSERT OR IGNORE` 로 선점한다.
 *   - 처음이면 통과.
 *   - 같은 구매·같은 주문이면 통과(새로고침·재시도 — 각 확정 주소의 멱등 처리가 그대로 돈다).
 *   - 다른 구매거나 다른 주문이면 **거절**. 승인 전이라 돈은 안 움직인다.
 * `orderNumberMustBeOurs` — 주문 번호를 손님이 정할 수 있는 확정 주소(이용권 단건)용. 그 번호로 이미 **다른 결제의
 *   주문**이 있으면 거절한다(일반 주문 `/api/payments/confirm` 은 잠금 파일이라 장부에 안 적는다 — 그쪽 방향은 이 검사가 막는다).
 *
 * ## 못 막는 것
 * - 일반 주문 확정(`payment.routes` — 잠금표)과 유어애즈 결제는 장부에 적지 않는다. 둘 다 주문 번호가 서버가 만든 행에
 *   묶여 있어 다른 결제를 받아들이지 않지만, **그 둘에서 낸 결제를 주문 번호 형식이 자유로운 새 확정 주소에 내미는 것**은
 *   그 새 주소가 이 함수를 불러야만 막힌다. 새 확정 주소를 만들면 반드시 부를 것(시험이 호출부를 센다).
 * - 장부 조회 실패는 **거절**(fail-closed)이다 — 승인 전이라 손님은 다시 시도하면 된다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type PaymentScope = 'gb' | 'gb-cart' | 'stay' | 'seeding-pass' | 'home-service' | 'points' | 'gift'

export type PaymentKeyClaim =
  | { ok: true }
  | { ok: false; status: 409 | 503; error: string; code: 'PAYMENT_KEY_REUSED' | 'PAYMENT_CLAIM_UNAVAILABLE' }

const ensured = new WeakSet<object>()
async function ensureClaims(DB: D1Database): Promise<void> {
  if (ensured.has(DB as unknown as object)) return
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS payment_key_claims (
      payment_key TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      ref TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ).run()
  ensured.add(DB as unknown as object)
}

/** 장부의 기존 행이 이번 요청과 같은 구매·같은 주문인가(순수). */
export function sameClaim(row: { scope?: string | null; ref?: string | null } | null | undefined, scope: string, ref: string): boolean {
  return !!row && row.scope === scope && String(row.ref) === ref
}

const REUSED: PaymentKeyClaim = { ok: false, status: 409, error: '이미 다른 구매에 쓰인 결제입니다', code: 'PAYMENT_KEY_REUSED' }

export async function claimPaymentKey(
  DB: D1Database, paymentKey: string, scope: PaymentScope, ref: string,
  opts: { orderNumberMustBeOurs?: string } = {},
): Promise<PaymentKeyClaim> {
  const key = String(paymentKey || '')
  const r = String(ref || '')
  if (!key || !r) return REUSED
  try {
    await ensureClaims(DB)
    if (opts.orderNumberMustBeOurs) {
      const other = await DB.prepare(
        "SELECT 1 AS x FROM orders WHERE order_number = ? AND COALESCE(payment_key, '') != ? LIMIT 1",
      ).bind(opts.orderNumberMustBeOurs, key).first<{ x: number }>()
      if (other) return REUSED
    }
    const ins = await DB.prepare('INSERT OR IGNORE INTO payment_key_claims (payment_key, scope, ref) VALUES (?, ?, ?)')
      .bind(key, scope, r).run()
    if ((ins.meta?.changes ?? 0) > 0) return { ok: true }
    const row = await DB.prepare('SELECT scope, ref FROM payment_key_claims WHERE payment_key = ?')
      .bind(key).first<{ scope: string; ref: string }>()
    return sameClaim(row, scope, r) ? { ok: true } : REUSED
  } catch (err) {
    console.error('[payment-key-claim] ledger unavailable', (err as Error)?.message)
    return { ok: false, status: 503, error: '결제 확인이 잠시 지연되고 있어요. 잠시 후 다시 시도해 주세요.', code: 'PAYMENT_CLAIM_UNAVAILABLE' }
  }
}
