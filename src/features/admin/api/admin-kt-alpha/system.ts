import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { safeError } from '../../../../worker/utils/safe-error'

export function registerSystem(r: Hono<{ Bindings: Env }>) {
  // 🛡️ 2026-05-25 사용자 명령 (B 옵션): "유어딜 공식" 운영 seller 자동 생성 + platform_settings 자동 set.
  //   기존 fallback (첫 approved seller) → system 명의로 분리.
  //   idempotent — 이미 username='system-kt-alpha' 있으면 그 id 반환.
  //   POST /api/admin/kt-alpha/init-system-seller
  r.post('/kt-alpha/init-system-seller', cors(), async (c) => {
    try {
      const { DB } = c.env

      let existing = await DB.prepare(
        `SELECT id, business_name FROM sellers WHERE username = 'system-kt-alpha' LIMIT 1`,
      ).first<{ id: number; business_name: string }>().catch(() => null)

      let created = false
      if (!existing) {
        try {
          await DB.prepare(`
            INSERT INTO sellers (
              username, password_hash, name, email, phone,
              business_name, business_number, bank_account,
              status, seller_type, can_broadcast, is_active,
              commission_rate, base_shipping_fee
            ) VALUES (
              'system-kt-alpha', 'no-login-system', '유어딜 공식 운영', 'system@ur-team.com', NULL,
              '유어딜 운영', NULL, NULL,
              'approved', 'store_owner', 0, 1,
              0, 0
            )
          `).run()
          existing = await DB.prepare(
            `SELECT id, business_name FROM sellers WHERE username = 'system-kt-alpha' LIMIT 1`,
          ).first<{ id: number; business_name: string }>()
          created = true
        } catch (insertErr) {
          return c.json({
            success: false,
            error: `sellers INSERT 실패: ${(insertErr as Error).message?.slice(0, 200) || 'unknown'}`,
          }, 500)
        }
      }

      if (!existing) {
        return c.json({ success: false, error: 'sellers 생성 후에도 조회 실패' }, 500)
      }

      // platform_settings.kt_alpha_admin_seller_id 자동 set
      await DB.prepare(`
        INSERT INTO platform_settings (key, value, updated_at)
        VALUES ('kt_alpha_admin_seller_id', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `).bind(String(existing.id)).run()

      try {
        const { invalidatePolicyCache } = await import('../../../../worker/utils/dynamic-policy')
        invalidatePolicyCache()
      } catch { /* graceful */ }

      return c.json({
        success: true,
        created,
        seller: { id: existing.id, business_name: existing.business_name },
        message: created
          ? `'유어딜 공식 운영' seller 생성됨 (id=${existing.id}) + platform_settings 자동 set`
          : `기존 system seller 발견 (id=${existing.id}) + platform_settings 자동 set`,
      })
    } catch (err) {
      return safeError(c, err, '처리 중 오류가 발생했습니다', '[admin-kt-alpha]')
    }
  })

  // 🛡️ 2026-05-25 사용자 명령: 특정 order_id 에 KT Alpha 자동발송 수동 trigger.
  //   진단 결과 "voucher_orders 기록 없음 = autoSendKtAlphaVouchersForOrders 미실행" 케이스
  //   → 어드민이 수동으로 trigger. 동기 호출 (응답 ~1-3초) — 발송 보장.
  //   POST /api/admin/kt-alpha/trigger-order/:order_id
  r.post('/kt-alpha/trigger-order/:order_id', cors(), async (c) => {
    try {
      const orderId = Number(c.req.param('order_id'))
      if (!Number.isFinite(orderId) || orderId <= 0) {
        return c.json({ success: false, error: '잘못된 order_id' }, 400)
      }

      const { DB } = c.env
      // 주문 + user 정보 조회
      const order = await DB.prepare(
        `SELECT o.id, o.user_id, o.order_number, o.shipping_phone, o.status, u.phone AS user_phone
         FROM orders o LEFT JOIN users u ON u.id = o.user_id
         WHERE o.id = ? LIMIT 1`,
      ).bind(orderId).first<{
        id: number; user_id: number; order_number: string; shipping_phone: string | null; status: string; user_phone: string | null
      }>().catch(() => null)

      if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)

      // autoSendKtAlphaVouchersForOrders 동기 호출 (수동 trigger 라 await 안전)
      const { autoSendKtAlphaVouchersForOrders } = await import('../../../../worker/utils/kt-alpha-auto-send')
      const result = await autoSendKtAlphaVouchersForOrders(
        c.env as unknown as Parameters<typeof autoSendKtAlphaVouchersForOrders>[0],
        [{
          id: order.id,
          user_id: order.user_id,
          shipping_phone: order.shipping_phone || order.user_phone,
        }],
        order.user_id,
      )

      // 결과 확인 — voucher_orders 생성 여부
      const voucherOrders = await DB.prepare(
        `SELECT id, status, failure_reason, created_at FROM voucher_orders
         WHERE external_order_id LIKE ? ORDER BY id DESC LIMIT 10`,
      ).bind(`%-${orderId}-%`).all().catch(() => ({ results: [] as any[] }))

      return c.json({
        success: true,
        result,
        voucher_orders: voucherOrders.results || [],
        // 🛡️ 2026-05-25: 실패 사유 노출 (이전: voucher_orders.failure_reason 만 — 실패 시 row 자체 없으면 확인 불가)
        errors: result.errors || [],
        message: result.sent > 0
          ? `${result.sent}건 발송 성공`
          : result.failed > 0
            ? `${result.failed}건 실패 — ${result.errors?.[0] || '사유 미상'}`
            : (result.errors?.[0] || 'KT Alpha 상품 없음 또는 phone 누락'),
      })
    } catch (err) {
      return safeError(c, err, '처리 중 오류가 발생했습니다', '[admin-kt-alpha]')
    }
  })

  // 🛡️ 2026-05-24 사용자 명령: "voucher 샀어도 기프티쇼 연계 맞아?" 진단 endpoint.
  //   특정 order_id 의 KT Alpha 연동 상태를 한 번에 보여줌.
  //   - settings 완비 여부
  //   - 주문 안에 KT Alpha 상품 있는지 (kt_alpha_gift_code + auto_voucher_send=1)
  //   - 사용자 phone 등록 여부
  //   - voucher_orders 발송 기록
  //   - vouchers (내부 QR) 발급 기록
  //   - 권장 다음 액션
  //   GET /api/admin/kt-alpha/diagnose-order/:order_id
  r.get('/kt-alpha/diagnose-order/:order_id', cors(), async (c) => {
    try {
      const orderId = Number(c.req.param('order_id'))
      if (!Number.isFinite(orderId) || orderId <= 0) return c.json({ success: false, error: '잘못된 order_id' }, 400)

      const { DB } = c.env

      // 1. 설정 상태
      const settings = await DB.prepare(
        "SELECT key, value FROM platform_settings WHERE key IN ('kt_alpha_user_id','kt_alpha_callback_no','kt_alpha_template_id','kt_alpha_banner_id','kt_alpha_admin_seller_id')"
      ).all<{ key: string; value: string }>().catch(() => ({ results: [] }))
      const sMap: Record<string, string> = {}
      for (const r of (settings.results || [])) sMap[r.key] = r.value
      const settingsStatus = {
        kt_alpha_user_id: !!sMap.kt_alpha_user_id,
        kt_alpha_callback_no: !!sMap.kt_alpha_callback_no,
        kt_alpha_admin_seller_id: !!sMap.kt_alpha_admin_seller_id,
        template_id_set: !!sMap.kt_alpha_template_id,
        banner_id_set: !!sMap.kt_alpha_banner_id,
        dev_mode: (c.env as { KT_ALPHA_DEV_MODE?: string }).KT_ALPHA_DEV_MODE !== 'N',
        auth_token_set: !!(c.env as { KT_ALPHA_AUTH_TOKEN?: string; KT_ALPHA_TOKEN_KEY?: string }).KT_ALPHA_AUTH_TOKEN || !!(c.env as { KT_ALPHA_TOKEN_KEY?: string }).KT_ALPHA_TOKEN_KEY,
      }

      // 2. 주문 + 사용자 phone
      const order = await DB.prepare(
        `SELECT o.id, o.order_number, o.user_id, o.status, o.payment_method, o.total_amount, o.created_at,
                o.shipping_phone, u.phone AS user_phone, u.name AS user_name
         FROM orders o
         LEFT JOIN users u ON CAST(o.user_id AS TEXT) = CAST(u.id AS TEXT)
         WHERE o.id = ?`
      ).bind(orderId).first<{
        id: number; order_number: string; user_id: string; status: string; payment_method: string;
        total_amount: number; created_at: string; shipping_phone: string | null;
        user_phone: string | null; user_name: string | null;
      }>().catch(() => null)
      if (!order) return c.json({ success: false, error: `주문 ${orderId} 없음` }, 404)

      // 3. 주문 안의 KT Alpha 상품
      const items = await DB.prepare(
        `SELECT oi.product_id, oi.product_name, oi.quantity, oi.unit_price,
                p.kt_alpha_gift_code, p.auto_voucher_send, p.deal_only, p.category
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`
      ).bind(orderId).all<{
        product_id: number; product_name: string; quantity: number; unit_price: number;
        kt_alpha_gift_code: string | null; auto_voucher_send: number | null;
        deal_only: number | null; category: string | null;
      }>().catch(() => ({ results: [] }))
      const ktItemsCount = (items.results || []).filter(
        it => it.kt_alpha_gift_code && it.auto_voucher_send === 1
      ).length

      // 4. voucher_orders 발송 기록 (KT Alpha)
      // 🛡️ 2026-05-25: trId 형식 2가지 매칭 — 옛 'ur-cons-{oid}-...' + 신 'u{oid}-...' (TRID 20자 fix 후).
      const voucherOrders = await DB.prepare(
        `SELECT id, goods_code, goods_name, status, failure_reason, recipient_phone, sent_at, external_order_id, created_at
         FROM voucher_orders
         WHERE external_order_id LIKE ? OR external_order_id LIKE ?
         ORDER BY id DESC`
      ).bind(`ur-cons-${orderId}-%`, `u${orderId}-%`).all().catch(() => ({ results: [] }))

      // 5. vouchers (내부 QR) 발급 기록
      const vouchers = await DB.prepare(
        `SELECT id, code, status, expires_at, created_at FROM vouchers WHERE order_id = ?`
      ).bind(orderId).all().catch(() => ({ results: [] }))

      // 6. 관련 frontend_errors (해당 주문 관련)
      const ferrors = await DB.prepare(
        `SELECT type, message, created_at FROM frontend_errors
         WHERE type IN ('kt_alpha_skip','kt_alpha_no_phone') AND message LIKE ?
         ORDER BY id DESC LIMIT 10`
      ).bind(`%order ${orderId}%`).all().catch(() => ({ results: [] }))

      // 7. 진단 + 권장 액션
      const phoneOk = /^01\d{8,9}$/.test(String(order.shipping_phone || '').replace(/\D/g, '')) ||
                      /^01\d{8,9}$/.test(String(order.user_phone || '').replace(/\D/g, ''))
      const diagnosis: string[] = []
      const recommendations: string[] = []
      if (!settingsStatus.kt_alpha_user_id || !settingsStatus.kt_alpha_callback_no) {
        diagnosis.push('❌ KT Alpha 운영 설정 미완료 (user_id 또는 callback_no)')
        recommendations.push('/admin/kt-alpha 에서 사업자 ID / 발신번호 등록')
      }
      if (ktItemsCount === 0) {
        diagnosis.push('⚠️ 이 주문 안에 KT Alpha 자동발송 대상 상품 없음 (kt_alpha_gift_code + auto_voucher_send=1)')
        recommendations.push('이 상품은 일반 voucher (QR) 만 발급되며 기프티쇼 발송 없음. 정상.')
      } else {
        diagnosis.push(`✅ KT Alpha 대상 상품 ${ktItemsCount}개`)
        if (!phoneOk) {
          diagnosis.push('❌ 사용자 phone 없음 또는 잘못된 형식 → KT Alpha 발송 불가')
          recommendations.push('사용자에게 마이 페이지에서 phone 등록 요청. 등록 후 /admin/voucher-orders 에서 재발송.')
        } else {
          const sentCount = (voucherOrders.results || []).filter((vo) => (vo as { status: string }).status === 'sent').length
          const failedCount = (voucherOrders.results || []).filter((vo) => (vo as { status: string }).status === 'failed').length
          const processingCount = (voucherOrders.results || []).filter((vo) => (vo as { status: string }).status === 'processing').length
          if (sentCount > 0) diagnosis.push(`✅ KT Alpha 발송 완료 ${sentCount}건`)
          if (failedCount > 0) {
            diagnosis.push(`❌ KT Alpha 발송 실패 ${failedCount}건`)
            recommendations.push('/admin/voucher-orders 에서 failed 항목 → "재발송" 버튼.')
          }
          if (processingCount > 0) diagnosis.push(`⏳ 발송 진행 중 ${processingCount}건`)
          if (voucherOrders.results?.length === 0) {
            diagnosis.push('❌ voucher_orders 기록 없음 — autoSendKtAlphaVouchersForOrders 가 trigger 안 됨')
            recommendations.push('group-buy/join 흐름이 waitUntil 후속 호출 실패. server 로그 / frontend_errors 확인.')
          }
        }
      }
      if (settingsStatus.dev_mode) {
        diagnosis.push('⚠️ KT_ALPHA_DEV_MODE 활성 — 실 KT API 미호출 (테스트 모드)')
        recommendations.push('Cloudflare Dashboard 에서 KT_ALPHA_DEV_MODE=N 설정 (production).')
      }

      return c.json({
        success: true,
        data: {
          order: {
            ...order,
            phone_ok: phoneOk,
            masked_user_phone: order.user_phone ? order.user_phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
          },
          settings_status: settingsStatus,
          order_items: items.results || [],
          kt_alpha_target_items_count: ktItemsCount,
          voucher_orders: voucherOrders.results || [],
          vouchers: vouchers.results || [],
          frontend_errors: ferrors.results || [],
          diagnosis,
          recommendations,
        },
      })
    } catch (err) {
      return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
    }
  })
}
