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

// 🔔 2026-06-17 (사용자 요청): 발송 실패 시 유저에게도 알림(기존엔 admin frontend_errors/dashboard 만).
//   best-effort — notifications 테이블/컬럼 차이여도 발송 흐름에 영향 없음.
async function notifyUserKtSendFailed(
  env: { DB: D1Database },
  userId: string | number | null | undefined,
  title: string,
  message: string,
): Promise<void> {
  if (userId === null || userId === undefined || userId === '') return
  try {
    await env.DB.prepare(
      `INSERT INTO notifications (user_id, type, title, message, link, created_at)
       VALUES (?, 'kt_alpha_send_failed', ?, ?, '/my-vouchers', datetime('now'))`
    ).bind(String(userId), title, message).run()
  } catch { /* notifications 테이블/컬럼 차이 — silent (best-effort) */ }
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
      retry_count INTEGER DEFAULT 0,
      last_retry_at DATETIME,
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
    // 🛡️ 2026-06-26 per-order 멱등 — confirm+webhook 양 경로 배선 후 이중발송 방지(상태 CAS 외 추가 방어).
    //   이 주문의 KT 발송이 이미 시작/완료(voucher_orders 에 external_order_id 'u{oid}-…' 행 존재)면 skip.
    //   trId 가 'u{oid}-…' 라 LIKE 'u{oid}-%' 는 oid 경계('-')로 prefix 충돌 없음(u85- 는 u850- 미매치).
    const ktAlready = await env.DB.prepare(
      `SELECT 1 FROM voucher_orders WHERE source = 'kt_alpha' AND external_order_id LIKE ? LIMIT 1`
    ).bind(`u${oid}-%`).first().catch(() => null)
    if (ktAlready) continue
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
      // 🔔 유저 알림 — 전화번호 미등록으로 발송 못 함 (등록 후 재발송 요청 안내).
      await notifyUserKtSendFailed(env, order.user_id || fallbackUserId,
        '🎫 교환권 발송 실패',
        '전화번호가 없어 교환권을 발송하지 못했어요. 내 정보에서 전화번호 등록 후 고객센터에 재발송을 요청해 주세요.')
      continue
    }

    for (const item of ktItems.results) {
      for (let i = 0; i < item.quantity; i++) {
        // 🛡️ 2026-05-25: KT Alpha TRID 20자 제한 (ERR0807). base36 timestamp + short suffix.
        // 형식: u{oid}-{ts36}{i} — 예: 'u85-m4abc1z3' = 12자 (oid 자릿수에 따라 ~14-16자, 20자 이내).
        const trId = `u${oid}-${Date.now().toString(36)}${i}`
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

        // 🔢 2026-06-17 (#4 인앱 바코드): KT_ALPHA_PIN_MODE='1' 이면 PIN 모드(gubun:'Y')로 pinNo 수신 →
        //   voucher_orders.coupon_code 에 저장(카드가 CODE128 바코드 렌더). PIN 모드 실패(계약 미허용 등) 시
        //   MMS('N') 로 안전 폴백 → 발송 누락 0. 플래그 OFF(기본)면 기존 MMS 그대로(바코드 없음).
        //   ⚠️ PIN 모드는 자체발송(giftishow 자동 MMS 안 감) — 켜기 전 giftishow 계약/발송채널 확인 필수.
        const usePin = (env as { KT_ALPHA_PIN_MODE?: string }).KT_ALPHA_PIN_MODE === '1'
        try {
          const baseArgs = {
            goodsCode: item.kt_alpha_gift_code,
            phoneNo: phone,
            callbackNo,
            // 🛡️ 2026-05-25: KT Alpha API title 10자 제한 (ERR0806). 기존 30자 → 10자.
            mmsTitle: '유어딜 교환권',
            mmsMsg: `${item.product_name} 교환권이 도착했습니다. 30일 이내 사용해주세요.`,
            trId,
            userId: ktUserId,
            orderNo: `c-${oid}-${i + 1}`,
            templateId,
            bannerId,
          }
          let res: { code: string; message: string; orderNo?: string; pinNo?: string }
          if (usePin) {
            try { res = await sendCoupon(env, { ...baseArgs, gubun: 'Y' }) }
            catch (pinErr) {
              if (import.meta.env?.DEV) console.warn('[kt-alpha] PIN 모드 실패 → MMS 폴백:', String(pinErr))
              res = await sendCoupon(env, { ...baseArgs, gubun: 'N' })
            }
          } else {
            res = await sendCoupon(env, { ...baseArgs, gubun: 'N' })
          }
          if (voId) {
            await env.DB.prepare(
              `UPDATE voucher_orders SET status = 'sent', external_order_id = ?, coupon_code = COALESCE(?, coupon_code), sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
            ).bind(res.orderNo || trId, res.pinNo || null, voId).run().catch(() => { /* noop */ })
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
          // 🔔 유저 알림 — 발송 실패 (재발송 요청 안내). 결제는 이미 완료라 사용자 인지 필요.
          await notifyUserKtSendFailed(env, order.user_id || fallbackUserId,
            '🎫 교환권 발송 실패',
            `${item.product_name} 교환권 발송에 실패했어요. 고객센터로 재발송을 요청해 주세요.`)
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

  // 🛡️ 2026-05-27: 발송 실패 / 오류 발생 시 Discord 즉시 알림 (DISCORD_WEBHOOK_URL 있을 때만).
  //   기존: errors 배열 반환 — admin 이 voucher-transactions 페이지 보러 가야 인지.
  //   변경: 실패 / errors 있으면 즉시 webhook → 운영자 즉시 대응.
  //   비용: 0 (Discord webhook 무료). silent fail 시 best-effort skip.
  if (totalFailed > 0 || errors.length > 0) {
    const webhook = (env as { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
    if (webhook) {
      try {
        const { sendDiscordAlert } = await import('./discord-alert')
        const summary = `발송 ${totalSent}건 / 실패 ${totalFailed}건${errors.length > 0 ? ` / 오류 ${errors.length}건` : ''}`
        const detail = errors.slice(0, 5).join('\n').slice(0, 1500)
        await sendDiscordAlert(webhook, `🟡 KT Alpha 발송 이슈`, `${summary}\n\n${detail}`, totalFailed > 0 ? 'error' : 'warn')
      } catch { /* webhook 자체 실패는 무시 */ }
    }
  }

  return { sent: totalSent, failed: totalFailed, errors }
}
