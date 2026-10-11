/**
 * 🎁 이용권 선물(넘기기) — 공용 규칙 (2026-10-11 대표 확정)
 *
 * 대표 결정(AskUserQuestion): **"내 이용권 넘기기"** + **"받은 뒤엔 환불 막기"**.
 *
 * ## 모델
 * - 보낸 사람이 지갑의 안 쓴 이용권으로 선물 링크를 만든다(`voucher_gifts`, status='pending').
 *   이때 이용권은 **아직 보낸 사람 것**이다 — 쓰거나 취소할 수도 있고, 그러면 링크는 죽는다.
 * - 친구가 받으면 `vouchers.user_id` 가 친구로 바뀌고 `gift_from_user_id` 에 보낸 사람이 남는다.
 *   2026-06-12 에 걷은 '선물하기'는 **QR 링크를 나눠 줄 뿐 주인이 그대로**라, 보낸 사람이 취소하면
 *   받은 사람 이용권이 사라졌다. 이번엔 받는 순간 주인이 바뀐다.
 *
 * ## 받은 뒤의 환불 (머니 경로 — 대표 결정 그대로)
 * `gift_from_user_id` 가 찍힌 이용권은 **보낸 사람도 받은 사람도 셀프로 무를 수 없다.**
 * 막는 자리 셋: 이용권 셀프 취소(`/voucher/:code/cancel`) · 주문 취소(`/api/orders/:id/cancel`, 어드민 제외) ·
 * 환불 요청(`/api/returns/request`). 결제는 보낸 사람 카드로 됐으므로 열어 두면 "친구가 쓰고 나는 환불" 이 된다.
 * 셀러·어드민 환불(고객센터)은 막지 않는다 — 사람이 판단하는 자리다.
 * ⚠️ **만료 자동 환불은 그대로다**: 그 cron 은 `orders.user_id`(=보낸 사람) 결제 수단으로 돌려준다
 *   (`expired-voucher-refund-sql.ts`). 바꾸면 만료 환불 규정에 닿으므로 손대지 않았다.
 */

export const GIFT_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

const ensured = new WeakSet<D1Database>()

/** 선물 표. 요청마다 DDL 을 돌리지 않게 D1 당 1회(머니 룰 부수 규칙). */
export async function ensureVoucherGiftTable(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS voucher_gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    voucher_id INTEGER NOT NULL,
    order_id INTEGER,
    sender_user_id TEXT NOT NULL,
    recipient_user_id TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    accepted_at TEXT,
    cancelled_at TEXT
  )`).run()
  // 한 이용권에 살아 있는 선물은 하나 — 동시에 두 번 눌러도 링크가 둘 생기지 않는다.
  await DB.prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_voucher_gifts_pending ON voucher_gifts(voucher_id) WHERE status = 'pending'",
  ).run()
  ensured.add(DB)
}

/** 링크 토큰 — 추측 불가(24바이트 = 192bit), URL 안전. */
export function newGiftToken(): string {
  const b = new Uint8Array(24)
  crypto.getRandomValues(b)
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 이 주문에 **받은 선물**(주인이 바뀐 이용권)이 있는가. 있으면 주문 단위 셀프 환불을 막는다.
 * 조회가 실패하면 **막는다(true)** — 이 질문이 틀렸을 때 비용은 "환불이 고객센터로 간다" 쪽이 훨씬 싸다.
 */
export async function orderHasGiftedVoucher(DB: D1Database, orderId: number | string): Promise<boolean> {
  try {
    const row = await DB.prepare(
      'SELECT 1 AS x FROM vouchers WHERE order_id = ? AND gift_from_user_id IS NOT NULL LIMIT 1',
    ).bind(orderId).first<{ x: number }>()
    return !!row
  } catch {
    return true
  }
}

export const GIFTED_REFUND_BLOCKED = '선물로 주고받은 이용권은 직접 취소·환불할 수 없어요. 고객센터로 문의해 주세요'
