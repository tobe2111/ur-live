/**
 * 🪙 **딜을 얼마나 쓸지 고르기 전에, 서버에 물어본다** — `GET /api/group-buy/deal-plan/:productId`
 *
 * 대표 신고 2026-09-13: *"딜을 쓰고 결제할지, 딜 일부만 쓰고 결제할지 등 선택도 안돼."*
 *
 * ## 왜 화면이 혼자 계산하면 안 되나
 * 이 레포가 이미 값을 치른 교훈이다(2026-09-04 audit log):
 *
 *   > 값은 **서버가 계산해 돌려준 것**만 쓴다 — 화면이 잔액으로 추정하면
 *   > **게이트가 꺼진 순간 그 안내가 거짓말이 된다.**
 *
 * 부분결제는 `platform_settings.voucher_partial_deal_enabled` 로 켜고 끄는데, 클라이언트는
 * 그 스위치를 볼 수 없다. 잔액만 보고 "딜 11,200원 쓸 수 있어요" 라고 그렸다가 게이트가 꺼져
 * 있으면, 사용자는 카드에서 전액이 빠져나간 뒤에야 알게 된다.
 *
 * ⇒ 그래서 **결제 시작 전에** 같은 함수(`resolvePartialDealPlan`)로 계산한 값을 받아 그린다.
 *   `/join` 이 실제로 쓰는 그 함수다 — 두 벌이면 언젠가 갈린다.
 *
 * ## 🔒 이 엔드포인트는 아무것도 바꾸지 않는다
 * 읽기 전용이다. 딜은 여기서 차감되지 않고(승인 뒤 원자 CAS 가 한다), 주문도 안 만든다.
 * 본인 잔액만 돌려주므로(`requireAuth` + 토큰의 user id) 남의 잔액을 볼 자리가 없다.
 *
 * ## ⚠️ 여기 값은 **안내**다
 * 사용자가 화면을 띄워 둔 사이 잔액이 바뀔 수 있다. 진짜 판정은 결제 승인 뒤
 * `spendPartialDeal` 의 CAS 이고, 그때 모자라면 거기서 막힌다. 그래서 이 값으로
 * 결제를 **미리 막지는 않는다** — 막으면 카드가 아예 안 긁힌다.
 */
import type { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { resolveUserIdString } from '@/worker/utils/resolve-user-id'
import { safeError } from '@/worker/utils/safe-error'
import { maxTierDiscount } from './helpers'
import { resolvePartialDealPlan, isPartialDealEnabled, getDealBalance, MIN_CARD_AMOUNT } from './partial-deal'

export function registerDealPlanEndpoint(app: Hono<{ Bindings: Env }>) {
  app.get('/deal-plan/:productId',
    rateLimit({ action: 'group_buy_deal_plan', max: 30, windowSec: 60 }),
    requireAuth(),
    async (c) => {
      try {
        const user = getCurrentUser(c)
        if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
        const productId = Number(c.req.param('productId'))
        if (!Number.isInteger(productId) || productId <= 0) {
          return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
        }
        const qty = Math.max(1, Math.min(100, Math.floor(Number(c.req.query('qty') ?? 1)) || 1))
        const { DB } = c.env
        const userId = await resolveUserIdString(DB, user.id, user.isDbId)

        // 총액은 `/join` 토스 분기와 **같은 식**으로 센다(즉시판매 단일가 — 최대 tier 할인).
        //   여기서 달리 세면 화면의 "카드 5,300원" 과 실제 청구액이 갈린다.
        const product = await DB.prepare(
          'SELECT id, price, group_buy_tiers FROM products WHERE id = ? AND is_active = 1',
        ).bind(productId).first<{ id: number; price: number; group_buy_tiers: string | null }>()
        if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

        const totalAmount = Math.round(product.price * (1 - maxTierDiscount(product.group_buy_tiers) / 100)) * qty
        const enabled = await isPartialDealEnabled(DB)
        const balance = await getDealBalance(DB, userId)
        // 기본 계획(요청 없음 = 최대한) — 화면의 '최대' 버튼이 쓸 값.
        const plan = await resolvePartialDealPlan(DB, { userId, totalAmount })

        return c.json({
          success: true,
          data: {
            enabled,
            balance,
            total_amount: totalAmount,
            /** 이 결제에서 딜로 낼 수 있는 최대 — 잔액과 '카드 최소액' 중 작은 쪽. */
            max_deal_usable: plan.dealUsed,
            /** 아무것도 안 고르면 이렇게 된다(= 종전 자동 동작). */
            default_deal_used: plan.dealUsed,
            default_card_amount: plan.cardAmount,
            /** 딜만으로 다 낼 수 있는가 — 그 경우는 카드를 안 타고 `payment_method='deal'` 로 간다. */
            can_pay_all_with_deal: enabled && balance >= totalAmount,
            min_card_amount: MIN_CARD_AMOUNT,
          },
        })
      } catch (err) {
        return safeError(c, err, '딜 사용 가능액을 불러오지 못했습니다', '[deal-plan]')
      }
    })
}
