/**
 * 🛡️ 2026-05-19: KT Alpha 자동 발송 헬퍼 — 결제 성공 시 호출.
 *
 *   호출처:
 *     - payment.routes.ts /confirm (Toss 결제)
 *     - points.routes.ts /pay     (딜 결제)
 *
 *   동작:
 *     1. order_items 중 products.kt_alpha_gift_code 보유 + auto_voucher_send=1 만 필터
 *     2. 각 item × quantity 만큼 KT Alpha sendCoupon 호출
 *     3. voucher_orders 에 processing → sent/failed 기록
 *     4. 발송 대상 phone = shipping_phone 우선, users.phone 차선
 *     5. 실패해도 결제 자체엔 영향 없음 (best-effort)
 */
type Env = {
  DB: D1Database
  KT_ALPHA_AUTH_CODE?: string
  KT_ALPHA_TOKEN_KEY?: string
  KT_ALPHA_AUTH_TOKEN?: string
  KT_ALPHA_DEV_MODE?: string
}

interface OrderRow {
  id: number
  shipping_phone?: string | null
  user_id?: string | number | null
}

export async function autoSendKtAlphaVouchersForOrders(
  env: Env,
  orders: OrderRow[],
  fallbackUserId: string | number,
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0
  let totalFailed = 0

  // 운영 설정 — 1회만 로드.
  const settings = await env.DB.prepare(
    "SELECT key, value FROM platform_settings WHERE key IN ('kt_alpha_user_id','kt_alpha_callback_no','kt_alpha_template_id','kt_alpha_banner_id','kt_alpha_admin_seller_id')"
  ).all<{ key: string; value: string }>().catch(() => ({ results: [] }))
  const sMap: Record<string, string> = {}
  for (const r of (settings.results || [])) sMap[r.key] = r.value
  const ktUserId = sMap.kt_alpha_user_id
  const callbackNo = sMap.kt_alpha_callback_no
  const templateId = sMap.kt_alpha_template_id || undefined
  const bannerId = sMap.kt_alpha_banner_id || undefined
  const adminSellerId = Number(sMap.kt_alpha_admin_seller_id) || 0
  if (!ktUserId || !callbackNo) return { sent: 0, failed: 0 }

  const { sendCoupon } = await import('./giftishow-api')

  for (const order of orders) {
    const oid = Number(order.id)
    if (!oid) continue
    const ktItems = await env.DB.prepare(
      `SELECT oi.product_id, oi.product_name, oi.quantity, oi.unit_price,
              p.kt_alpha_gift_code
         FROM order_items oi
         INNER JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ? AND p.kt_alpha_gift_code IS NOT NULL AND p.auto_voucher_send = 1`
    ).bind(oid).all<{
      product_id: number; product_name: string; quantity: number; unit_price: number;
      kt_alpha_gift_code: string;
    }>().catch(() => ({ results: [] }))

    if (!ktItems.results || ktItems.results.length === 0) continue

    // 발송 대상 phone — shipping_phone → users.phone 순서.
    let phone = String(order.shipping_phone || '').replace(/\D/g, '')
    if (!/^01\d{8,9}$/.test(phone)) {
      const lookupId = order.user_id ?? fallbackUserId
      const userRow = await env.DB.prepare('SELECT phone FROM users WHERE id = ?')
        .bind(String(lookupId)).first<{ phone: string }>().catch(() => null)
      phone = String(userRow?.phone || '').replace(/\D/g, '')
    }
    if (!/^01\d{8,9}$/.test(phone)) {
      console.error('[kt-alpha auto-send] no phone for order', oid)
      continue
    }

    for (const item of ktItems.results) {
      for (let i = 0; i < item.quantity; i++) {
        const trId = `ur-cons-${oid}-${item.product_id}-${i + 1}-${Date.now()}`
        const vo = await env.DB.prepare(
          `INSERT INTO voucher_orders (
             seller_id, source, goods_code, goods_name,
             unit_price, quantity, total_amount, recipient_phone,
             withholding_amount, net_amount, status, external_order_id
           ) VALUES (?, 'kt_alpha', ?, ?, ?, 1, ?, ?, 0, ?, 'processing', ?)`
        ).bind(
          adminSellerId, item.kt_alpha_gift_code, item.product_name,
          item.unit_price, item.unit_price, phone, item.unit_price, trId,
        ).run().catch(() => null)
        const voId = vo ? Number(vo.meta.last_row_id) : 0

        try {
          const res = await sendCoupon(env, {
            goodsCode: item.kt_alpha_gift_code,
            phoneNo: phone,
            callbackNo,
            mmsTitle: `[유어딜] ${item.product_name}`.slice(0, 30),
            mmsMsg: `${item.product_name} 교환권이 도착했습니다. 30일 이내 사용해주세요.`,
            trId,
            userId: ktUserId,
            orderNo: `c-${oid}-${i + 1}`,
            gubun: 'N',
            templateId,
            bannerId,
          })
          if (voId) {
            await env.DB.prepare(
              `UPDATE voucher_orders SET status = 'sent', external_order_id = ?, sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
            ).bind(res.orderNo || trId, voId).run().catch(() => { /* noop */ })
          }
          totalSent++
        } catch (sendErr) {
          const errMsg = (sendErr as Error).message.slice(0, 300)
          if (voId) {
            await env.DB.prepare(
              `UPDATE voucher_orders SET status = 'failed', failure_reason = ?, updated_at = datetime('now') WHERE id = ?`
            ).bind(errMsg, voId).run().catch(() => { /* noop */ })
          }
          console.error('[kt-alpha auto-send] failed', { oid, code: item.kt_alpha_gift_code, errMsg })
          totalFailed++
          // 어드민 알림 — 1시간 중복 방지.
          const recent = await env.DB.prepare(
            `SELECT id FROM dashboard_notifications
              WHERE type = 'kt_alpha_send_failed' AND created_at > datetime('now', '-1 hours') LIMIT 1`
          ).first().catch(() => null)
          if (!recent) {
            await env.DB.prepare(
              `INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
               VALUES ('admin', NULL, 'kt_alpha_send_failed', ?, ?, '/admin/kt-alpha', datetime('now'))`
            ).bind(
              '⚠️ KT Alpha 자동 발송 실패',
              `주문 #${oid} · ${item.product_name} · ${errMsg.slice(0, 100)}`,
            ).run().catch(() => { /* noop */ })
          }
        }
      }
    }
  }

  return { sent: totalSent, failed: totalFailed }
}
