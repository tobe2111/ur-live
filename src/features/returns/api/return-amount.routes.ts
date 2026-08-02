/**
 * 💸 **부분환불 금액 설정** — 세션 ④-c (머니 경로 · 게이트 뒤)
 *
 * `PATCH /api/returns/:id/amount` — 환불 **전에** 금액을 정한다.
 *
 * ## 🔴 왜 별도 파일·별도 엔드포인트인가
 * - `returns.routes.ts` 는 **865줄로 동결**돼 있다(file-size 래칫). 거기 얹으면 래칫이 막는다.
 * - 그리고 **섞지 않는 편이 맞다**: `PUT /:id/refund` 는 **돈을 실제로 내보내는** 엔드포인트다.
 *   그 시그니처를 건드리지 않고 **금액만 따로** 정하면, 환불 실행 경로는 **byte-불변**으로 남는다.
 * - `refund` 는 `rateLimit(max:3/시간)` 이다. 금액 조정을 거기 섞으면 **오타 한 번에 그 예산이 탄다.**
 *
 * ## 🔴 실행기는 이미 부분환불을 전제로 쓰여 있다
 * 이 값을 낮추면 그대로 따라간다 — Toss 취소 `amount` · 딜 사용분 **비례** 복원
 * (`refunded / paidCash`) · 셀러 정산 clawback · 소비자 알림 금액.
 * **그래서 이 파일이 하는 일은 값을 바꾸는 것 하나뿐**이고, 그게 없어서 전액만 가능했다.
 *
 * ## 🔴 안전판
 * 1. **게이트** `partial_refund_enabled`(기본 OFF) — OFF 면 이 엔드포인트가 아무것도 안 한다
 * 2. **결제액 상한** — 서버에서 주문 실결제액으로 클램프(클라 값 신뢰 금지)
 * 3. **환불 후엔 못 바꾼다** — `refunded`/`cancelled`/`rejected` 상태는 거부
 * 4. **누가·언제·왜** 를 같은 행에 남긴다 — 금액 변경은 머니 결정이다
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { requireAuth, getCurrentUser } from '../../../worker/middleware/auth'
import { rateLimit } from '../../../worker/middleware/rate-limit'
import { safeError } from '../../../worker/utils/safe-error'
import { resolveRefundAmount, canEditRefundAmount } from '../../../shared/refund-amount'

export const returnAmountRoutes = new Hono<{ Bindings: Env }>()

const _colsEnsured = new WeakSet<object>()

/**
 * 결정의 흔적을 담을 컬럼. `returns` 는 컬럼 예산 대상이 아니다
 * (예산제는 `products`·`sellers` 한정 — CLAUDE.md).
 */
async function ensureAmountColumns(DB: D1Database): Promise<void> {
  if (_colsEnsured.has(DB as unknown as object)) return
  _colsEnsured.add(DB as unknown as object)
  for (const ddl of [
    'ALTER TABLE returns ADD COLUMN refund_amount_set_by TEXT',
    'ALTER TABLE returns ADD COLUMN refund_amount_set_at DATETIME',
    'ALTER TABLE returns ADD COLUMN refund_amount_note TEXT',
  ]) {
    try { await DB.prepare(ddl).run() } catch { /* exists */ }
  }
}

async function partialRefundEnabled(DB: D1Database): Promise<boolean> {
  try {
    const row = await DB.prepare(
      "SELECT value FROM platform_settings WHERE key = 'partial_refund_enabled'"
    ).first<{ value: string }>()
    return String(row?.value ?? '') === 'true'
  } catch {
    // 🔴 설정을 못 읽으면 **꺼진 것으로 본다.** 머니 경로에서 조회 실패는 '허용'이 아니다.
    return false
  }
}

/**
 * PATCH /:id/amount — 환불 금액 설정
 * Body: `{ amount: number | string, note?: string }`
 */
returnAmountRoutes.patch(
  '/:id/amount',
  rateLimit({ action: 'return_amount', max: 30, windowSec: 3600 }),
  requireAuth(),
  async (c) => {
    try {
      const user = getCurrentUser(c)
      if (!user || (user.type !== 'seller' && user.type !== 'admin')) {
        return c.json({ success: false, error: 'forbidden' }, 403)
      }
      const isAdminActor = user.type === 'admin'
      const sellerId = Number(user.id)
      const { DB } = c.env

      if (!(await partialRefundEnabled(DB))) {
        return c.json({ success: false, error: '부분 환불이 아직 활성화되지 않았습니다' }, 403)
      }
      await ensureAmountColumns(DB)

      const returnId = Number(c.req.param('id'))
      if (!Number.isFinite(returnId) || returnId <= 0) {
        return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
      }

      const body = await c.req
        .json<{ amount?: unknown; note?: string }>()
        .catch(() => ({} as { amount?: unknown; note?: string }))

      const rec = await DB.prepare(
        'SELECT id, order_id, seller_id, status, refund_amount FROM returns WHERE id = ?'
      ).bind(returnId).first<{
        id: number; order_id: number; seller_id: number | null; status: string; refund_amount: number
      }>()
      // 남의 것과 없는 것을 **같은 404** 로 — 존재 여부가 새면 반품 id 를 훑을 수 있다.
      if (!rec || (!isAdminActor && rec.seller_id !== sellerId)) {
        return c.json({ success: false, error: '반품 내역을 찾을 수 없습니다' }, 404)
      }

      if (!canEditRefundAmount(rec.status)) {
        return c.json({ success: false, error: '이미 처리된 반품은 금액을 바꿀 수 없습니다' }, 400)
      }

      const order = await DB.prepare(
        'SELECT total_amount FROM orders WHERE id = ?'
      ).bind(rec.order_id).first<{ total_amount: number | null }>()

      const verdict = resolveRefundAmount({
        requested: body.amount,
        orderPaidAmount: Number(order?.total_amount ?? 0),
      })
      if (!verdict.ok) return c.json({ success: false, error: verdict.error }, 400)

      // 🔴 상태를 다시 확인하면서 쓴다(CAS) — 그 사이 환불이 나갔으면 덮어쓰지 않는다.
      const note = String(body.note ?? '').trim().slice(0, 500) || null
      const res = await DB.prepare(
        `UPDATE returns
            SET refund_amount = ?, refund_amount_set_by = ?, refund_amount_set_at = datetime('now'),
                refund_amount_note = ?
          WHERE id = ? AND status = ?`
      ).bind(verdict.amount, `${user.type}:${user.id}`, note, returnId, rec.status).run()

      if (!res.meta?.changes) {
        return c.json({ success: false, error: '반품 상태가 바뀌어 금액을 저장하지 못했습니다' }, 409)
      }

      return c.json({
        success: true,
        amount: verdict.amount,
        previous_amount: rec.refund_amount,
        // 말없이 깎지 않는다 — 운영자가 자기 입력이 그대로 나간 줄 알면 안 된다.
        clamped: verdict.clamped,
        message: verdict.clamped
          ? `결제 금액을 넘을 수 없어 ${verdict.amount.toLocaleString('ko-KR')}원으로 저장했습니다`
          : `환불 금액을 ${verdict.amount.toLocaleString('ko-KR')}원으로 저장했습니다`,
      })
    } catch (err) {
      return safeError(c, err, '환불 금액을 저장하지 못했습니다', '[returns:amount]')
    }
  },
)
