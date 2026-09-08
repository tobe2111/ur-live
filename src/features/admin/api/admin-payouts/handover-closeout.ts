/**
 * 🤝 **손바뀜 정산 마감** — `POST /api/admin/payouts/handover-closeout`
 *
 * 🧱 2026-09-08: `admin-payouts.routes.ts` 를 600줄 아래로 유지하려고 같은이름 폴더로 뺐다.
 *
 * 🤝 **무엇인가** — 주인이 바뀌기 전에 *지금 주인* 몫을 떼어 배정한다.
 *
 * ⭐ 2026-09-08 대표 확정: *"중개사가 한 매장으로 유어딜에서 번 돈이 있으면 그 돈은 승계가
 * 되더라도 일단 중개사에게 정산되어야지. 반대 상황도 마찬가지고."*
 *
 * ## 왜 이게 마감이 되나 (새 기계를 안 만들었다)
 * `payouts` 행은 **생성 시점의 계좌를 자기 안에 스냅샷**한다. 그래서 손바뀜 *전에* 만들면
 * 그 행은 **이전 주인 계좌**를 들고 있고, 나중에 주인이 바뀌어도 그 행은 안 변한다.
 * 그리고 주간 집계(`payouts-generate`)가 `pending/approved/sent` 를 빼므로 그 금액은
 * **새 주인 몫으로 다시 잡히지 않는다.** ⇒ 전기간 누적 집계를 건드릴 필요가 없다.
 *
 * ## 🔴 이 API 는 송금하지 않는다
 * `status='pending'` 행을 만들 뿐이고, 실제 송금은 종전 그대로 어드민이 승인(approve) →
 * 송금(sent) 해야 한다. 여기서 하는 일은 **"이 돈은 이 사람 것"** 이라고 못 박는 것뿐이다.
 *
 * ## ⚠️ 최소출금액(10,000원)을 적용하지 않는다
 * 주간 cron 은 소액을 건너뛰지만(다음 주에 합산되니까), 마감은 **다음 주가 없다** —
 * 건너뛴 금액은 그대로 새 주인에게 간다. 그래서 1원이라도 행을 만든다.
 */
import type { Context } from 'hono'
import type { Env } from '../../../../worker/types/env'
import { safeError } from '@/worker/utils/safe-error'

export async function handoverCloseout(c: Context<{ Bindings: Env }>): Promise<Response> {
    try {
      const DB = c.env.DB
      const body = await c.req.json<{ seller_id?: unknown; reason?: unknown }>()
        .catch(() => ({} as { seller_id?: unknown; reason?: unknown }))
      const sellerId = Number(body.seller_id)
      if (!Number.isInteger(sellerId) || sellerId <= 0) {
        return c.json({ success: false, error: 'seller_id 가 올바르지 않습니다.' }, 400)
      }
      const reason = String(body.reason || '').trim()
      if (reason.length < 5) {
        return c.json({ success: false, error: '마감 사유를 최소 5자 이상 입력하세요.' }, 400)
      }

      const seller = await DB.prepare(
        'SELECT id, linked_user_id, bank_account, business_name FROM sellers WHERE id = ? LIMIT 1',
      ).bind(sellerId).first<{ id: number; linked_user_id: number | null; bank_account: string | null; business_name: string | null }>()
      if (!seller) return c.json({ success: false, error: '매장을 찾을 수 없습니다.' }, 404)

      const { getUnsettledBalance } = await import('../../../../worker/utils/ledger')
      const raw = await getUnsettledBalance(DB, `seller:${sellerId}`)
      const amount = Math.round(raw)

      if (amount === 0) {
        return c.json({ success: true, data: { closed: false, amount: 0, note: '마감할 잔액이 없습니다. 바로 소유자를 변경할 수 있어요.' } })
      }
      if (amount < 0) {
        // payouts.amount 는 CHECK(amount > 0) — 음수는 이 창구로 표현할 수 없다.
        return c.json({
          success: false,
          code: 'NEGATIVE_BALANCE',
          error: `이 매장은 플랫폼에 정산할 금액(${Math.abs(amount).toLocaleString('ko-KR')}원)이 남아 있어 이 창구로 마감할 수 없습니다. 원장을 먼저 정리해주세요.`,
        }, 409)
      }

      // 🔒 계좌가 없으면 만들지 않는다 — 받는 사람이 없는 마감은 마감이 아니고,
      //   나중에 새 주인 계좌가 채워지면 그 사람에게 송금될 위험이 생긴다.
      if (!seller.bank_account) {
        return c.json({
          success: false,
          code: 'NO_ACCOUNT',
          error: '지금 소유자의 정산 계좌가 등록돼 있지 않습니다. 계좌를 먼저 확인한 뒤 마감해주세요.',
        }, 409)
      }

      const today = new Date().toISOString().slice(0, 10)
      const memo = `손바뀜 정산 마감 (소유자 변경 전) · 사유: ${reason}`
      // UNIQUE(payee_type, payee_id, period_start, period_end) — 같은 날 두 번이면 두 번째는 무시된다.
      //   첫 마감이 잔액을 배정했으므로 두 번째는 어차피 amount 0 으로 걸러진다(이중 배정 0).
      const ins = await DB.prepare(
        `INSERT OR IGNORE INTO payouts (payee_type, payee_id, amount, period_start, period_end, status, account_number, account_holder, admin_memo)
         VALUES ('seller', ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      ).bind(String(sellerId), amount, today, today, seller.bank_account, seller.business_name || null, memo).run()

      if (!(ins.meta?.changes ?? 0)) {
        return c.json({ success: false, code: 'ALREADY_CLOSED_TODAY', error: '오늘 이미 이 매장의 마감 정산이 만들어져 있습니다.' }, 409)
      }

      return c.json({
        success: true,
        data: {
          closed: true,
          amount,
          payee_user_id: seller.linked_user_id,
          account_holder: seller.business_name,
          note: '이전 소유자 계좌로 배정했습니다. 승인·송금은 정산 화면에서 진행하세요. 이제 소유자를 변경할 수 있습니다.',
        },
      })
    } catch (err) {
      return safeError(c, err, '손바뀜 마감 중 오류가 발생했습니다', '[payouts-closeout]')
    }
}
