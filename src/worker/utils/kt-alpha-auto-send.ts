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
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let totalSent = 0
  let totalFailed = 0
  const errors: string[] = []

  // 🛡️ 2026-05-25: voucher_orders 테이블 lazy CREATE (production 미적용 환경 graceful).
  //   migration 0257 미적용 시 INSERT throw → silent fail. 사용자 신고 (Order #85).
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS voucher_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      goods_code TEXT NOT NULL,
      goods_name TEXT NOT NULL,
      goods_image_url TEXT,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_amount INTEGER NOT NULL,
      recipient_phone TEXT NOT NULL,
      withholding_amount INTEGER NOT NULL DEFAULT 0,
      net_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      external_order_id TEXT,
      coupon_code TEXT,
      failure_reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run()
  } catch { /* graceful */ }

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
  const adminSellerIdRaw = Number(sMap.kt_alpha_admin_seller_id) || 0
  if (!ktUserId || !callbackNo) {
    errors.push(`platform_settings 누락: kt_alpha_user_id=${!!ktUserId}, kt_alpha_callback_no=${!!callbackNo}`)
    return { sent: 0, failed: 0, errors }
  }

  // 🛡️ 2026-05-25 사용자 진단 fix: kt_alpha_admin_seller_id 가 sellers 에 없으면 첫 approved seller fallback.
  //   FK constraint: voucher_orders.seller_id REFERENCES sellers(id).
  //   잘못된 admin_seller_id 설정 시 INSERT 영구 fail → 첫 approved seller 자동 사용 (Order #85 사고).
  let adminSellerId = adminSellerIdRaw
  if (adminSellerId) {
    const exists = await env.DB.prepare('SELECT id FROM sellers WHERE id = ? LIMIT 1')
      .bind(adminSellerId).first<{ id: number }>().catch(() => null)
    if (!exists) {
      const fallback = await env.DB.prepare(`SELECT id FROM sellers WHERE status = 'approved' ORDER BY id ASC LIMIT 1`)
        .first<{ id: number }>().catch(() => null)
      if (fallback?.id) {
        errors.push(`kt_alpha_admin_seller_id=${adminSellerIdRaw} 가 sellers 에 없음 → 첫 approved seller(id=${fallback.id}) fallback`)
        adminSellerId = fallback.id
      } else {
        errors.push(`kt_alpha_admin_seller_id=${adminSellerIdRaw} invalid + sellers 에 approved 셀러 0건 → INSERT 불가`)
        return { sent: 0, failed: 0, errors }
      }
    }
  } else {
    const fallback = await env.DB.prepare(`SELECT id FROM sellers WHERE status = 'approved' ORDER BY id ASC LIMIT 1`)
      .first<{ id: number }>().catch(() => null)
    if (fallback?.id) {
      adminSellerId = fallback.id
    } else {
      errors.push(`kt_alpha_admin_seller_id 미설정 + sellers 에 approved 셀러 0건 → INSERT 불가`)
      return { sent: 0, failed: 0, errors }
    }
  }

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

    if (!ktItems.results || ktItems.results.length === 0) {
      // 🛡️ 2026-05-23: silent skip 영구 제거 — admin 가시성 위해 frontend_errors 에 기록.
      await env.DB.prepare(
        `INSERT INTO frontend_errors (message, type, url, user_id, created_at) VALUES (?, 'kt_alpha_skip', ?, ?, datetime('now'))`,
      ).bind(`KT Alpha skip — order ${oid} 에 kt_alpha_gift_code 보유 상품 없음 (auto_voucher_send=1)`, `/admin/voucher-orders`, String(fallbackUserId)).run().catch(() => null)
      continue
    }

    // 발송 대상 phone — shipping_phone → users.phone 순서.
    let phone = String(order.shipping_phone || '').replace(/\D/g, '')
    if (!/^01\d{8,9}$/.test(phone)) {
      const lookupId = order.user_id ?? fallbackUserId
      const userRow = await env.DB.prepare('SELECT phone FROM users WHERE id = ?')
        .bind(String(lookupId)).first<{ phone: string }>().catch(() => null)
      phone = String(userRow?.phone || '').replace(/\D/g, '')
    }
    if (!/^01\d{8,9}$/.test(phone)) {
      console.error('[kt-alpha auto-send] missing recipient for order', oid)
      // 🛡️ 2026-05-23: phone 없음을 voucher_orders + frontend_errors 둘 다 기록 — admin 즉시 인지.
      try {
        await env.DB.prepare(
          `INSERT INTO voucher_orders (seller_id, source, goods_code, goods_name, unit_price, quantity, total_amount, recipient_phone, withholding_amount, net_amount, status, failure_reason)
           VALUES (?, 'kt_alpha', ?, ?, ?, ?, ?, '', 0, ?, 'failed', ?)`,
        ).bind(
          adminSellerId, ktItems.results[0]?.kt_alpha_gift_code || '?',
          ktItems.results[0]?.product_name || '?',
          ktItems.results[0]?.unit_price || 0, 1,
          ktItems.results[0]?.unit_price || 0, ktItems.results[0]?.unit_price || 0,
          `users.phone NULL 또는 잘못된 형식 (order ${oid}, user ${order.user_id})`,
        ).run().catch(() => null)
        await env.DB.prepare(
          `INSERT INTO frontend_errors (message, type, url, user_id, created_at) VALUES (?, 'kt_alpha_no_phone', ?, ?, datetime('now'))`,
        ).bind(`KT Alpha skip — order ${oid} 에 폰 없음 (users.phone 비어있거나 잘못된 형식). 사용자가 마이/내정보 에서 폰 등록 필요.`, '/admin/voucher-orders', String(order.user_id || fallbackUserId)).run().catch(() => null)
      } catch { /* graceful */ }
      continue
    }

    for (const item of ktItems.results) {
      for (let i = 0; i < item.quantity; i++) {
        const trId = `ur-cons-${oid}-${item.product_id}-${i + 1}-${Date.now()}`
        // 🛡️ 2026-05-25: INSERT 실패 사유 capture (이전 silent .catch(() => null)).
        let voInsertErr: string | null = null
        const vo = await env.DB.prepare(
          `INSERT INTO voucher_orders (
             seller_id, source, goods_code, goods_name,
             unit_price, quantity, total_amount, recipient_phone,
             withholding_amount, net_amount, status, external_order_id
           ) VALUES (?, 'kt_alpha', ?, ?, ?, 1, ?, ?, 0, ?, 'processing', ?)`
        ).bind(
          adminSellerId, item.kt_alpha_gift_code, item.product_name,
          item.unit_price, item.unit_price, phone, item.unit_price, trId,
        ).run().catch((err: Error) => {
          voInsertErr = err?.message?.slice(0, 200) || String(err)
          return null
        })
        const voId = vo ? Number(vo.meta.last_row_id) : 0
        if (voInsertErr) {
          errors.push(`voucher_orders INSERT 실패 (order ${oid}, code ${item.kt_alpha_gift_code}): ${voInsertErr}`)
        }

        try {
          const res = await sendCoupon(env, {
            goodsCode: item.kt_alpha_gift_code,
            phoneNo: phone,
            callbackNo,
            // 🛡️ 2026-05-25: KT Alpha API title 10자 제한 (ERR0806). 기존 30자 → 10자.
            mmsTitle: '유어딜 교환권',
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
          // 🛡️ 2026-05-25: sendCoupon 에러 errors 배열 + frontend_errors 둘 다 기록
          errors.push(`sendCoupon 실패 (order ${oid}, code ${item.kt_alpha_gift_code}): ${errMsg}`)
          await env.DB.prepare(
            `INSERT INTO frontend_errors (message, type, url, user_id, created_at)
             VALUES (?, 'kt_alpha_send_throw', '/api/admin/kt-alpha/trigger-order', ?, datetime('now'))`
          ).bind(`sendCoupon throw (order ${oid}, code ${item.kt_alpha_gift_code}): ${errMsg}`, String(order.user_id || fallbackUserId))
            .run().catch(() => null)
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

  return { sent: totalSent, failed: totalFailed, errors }
}
