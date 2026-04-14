/**
 * 스케줄 작업 (Cloudflare Cron Triggers)
 * 5분마다 실행 — 만료/정리/자동 상태 전환
 */

import type { Env } from '../types/env';

export async function handleScheduled(env: Env) {
  const DB = env.DB;
  const results: Record<string, number> = {};

  // ── 1. 라이브 방송: 30분 미활동 자동 종료 ──
  try {
    const { meta } = await DB.prepare(`
      UPDATE live_streams
      SET status = 'ended', ended_at = datetime('now'), updated_at = datetime('now')
      WHERE status = 'live'
        AND updated_at < datetime('now', '-30 minutes')
    `).run();
    results.stale_streams_ended = meta.changes ?? 0;
  } catch (e) { console.error('[Cron] stale_streams error:', e) }

  // ── 2. 미결제 주문: 24시간 후 자동 취소 + 재고 복구 ──
  try {
    // 먼저 취소 대상 주문의 상품/수량을 조회
    const { results: pendingOrders } = await DB.prepare(`
      SELECT o.id, oi.product_id, oi.quantity
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status = 'PENDING'
        AND o.created_at < datetime('now', '-24 hours')
    `).all<{ id: number; product_id: number; quantity: number }>();

    if (pendingOrders && pendingOrders.length > 0) {
      // 재고 복구
      for (const item of pendingOrders) {
        await DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .bind(item.quantity, item.product_id).run();
      }

      // 주문 취소
      const { meta } = await DB.prepare(`
        UPDATE orders
        SET status = 'CANCELLED', cancel_reason = '결제 시간 초과 (24시간)', updated_at = datetime('now')
        WHERE status = 'PENDING'
          AND created_at < datetime('now', '-24 hours')
      `).run();
      results.pending_orders_cancelled = meta.changes ?? 0;
    }
  } catch (e) { console.error('[Cron] pending_orders error:', e) }

  // ── 3. 공동구매: 마감 지난 상품 자동 만료 ──
  try {
    const { meta } = await DB.prepare(`
      UPDATE products
      SET group_buy_status = 'expired', updated_at = datetime('now')
      WHERE category = 'meal_voucher'
        AND group_buy_status = 'active'
        AND group_buy_deadline IS NOT NULL
        AND group_buy_deadline < datetime('now')
    `).run();
    results.group_buys_expired = meta.changes ?? 0;
  } catch (e) { console.error('[Cron] group_buys error:', e) }

  // ── 4. 바우처: 만료일 지난 바우처 자동 만료 ──
  try {
    const { meta } = await DB.prepare(`
      UPDATE vouchers
      SET status = 'expired', updated_at = datetime('now')
      WHERE status = 'unused'
        AND expires_at IS NOT NULL
        AND expires_at < datetime('now')
    `).run();
    results.vouchers_expired = meta.changes ?? 0;
  } catch (e) { console.error('[Cron] vouchers error:', e) }

  // ── 5. 경매: 시간 초과 자동 종료 ──
  try {
    const { meta } = await DB.prepare(`
      UPDATE live_auctions
      SET status = 'ended'
      WHERE status = 'active'
        AND ends_at < datetime('now')
    `).run();
    results.auctions_ended = meta.changes ?? 0;
  } catch (e) { console.error('[Cron] auctions error:', e) }

  // ── 6. 타임딜: 만료 자동 종료 ──
  try {
    const { meta: ended } = await DB.prepare(`
      UPDATE time_deals
      SET status = 'ended'
      WHERE status = 'active'
        AND expires_at < datetime('now')
    `).run();
    const { meta: soldout } = await DB.prepare(`
      UPDATE time_deals
      SET status = 'sold_out'
      WHERE status = 'active'
        AND claimed_count >= max_claims
    `).run();
    results.timedeals_ended = (ended.changes ?? 0) + (soldout.changes ?? 0);
  } catch (e) { console.error('[Cron] timedeals error:', e) }

  // ── 7. 친구 초대 공동구매: 48시간 만료 ──
  try {
    const { meta } = await DB.prepare(`
      UPDATE referral_groups
      SET status = 'expired'
      WHERE status = 'open'
        AND expires_at < datetime('now')
    `).run();
    results.referrals_expired = meta.changes ?? 0;
  } catch (e) { console.error('[Cron] referrals error:', e) }

  // ── 8. 알림 정리: 90일 이상 된 알림 삭제 ──
  try {
    await DB.prepare(`
      DELETE FROM user_notifications
      WHERE created_at < datetime('now', '-90 days')
    `).run();
    await DB.prepare(`
      DELETE FROM dashboard_notifications
      WHERE created_at < datetime('now', '-90 days')
    `).run();
  } catch (e) { console.error('[Cron] notifications_cleanup error:', e) }

  // ── 9. 만료된 리프레시 토큰 정리 ──
  try {
    await DB.prepare(`
      DELETE FROM refresh_tokens
      WHERE expires_at < datetime('now')
    `).run();
  } catch (e) { console.error('[Cron] token_cleanup error:', e) }

  // ── 10. 자동 구매확정: 배송 14일 경과 ──
  try {
    const { meta } = await DB.prepare(`
      UPDATE orders
      SET status = 'delivered', delivered_at = datetime('now'),
          settlement_status = 'confirmed', updated_at = datetime('now')
      WHERE status IN ('shipping', 'SHIPPING')
        AND shipped_at < datetime('now', '-14 days')
    `).run();
    results.auto_confirmed = meta.changes ?? 0;
  } catch (e) { console.error('[Cron] auto_confirm error:', e) }

  // ── 11. 예정 방송 30분 전 알림 발송 ──
  try {
    // 30분 이내 시작 예정 + 아직 알림 미발송인 방송 조회
    const { results: upcomingStreams } = await DB.prepare(`
      SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON s.id = ls.seller_id
      WHERE ls.status = 'scheduled'
        AND ls.scheduled_at IS NOT NULL
        AND ls.scheduled_at > datetime('now')
        AND ls.scheduled_at <= datetime('now', '+35 minutes')
        AND COALESCE(ls.pre_notified, 0) = 0
    `).all<{ id: number; title: string; seller_id: number; seller_name: string }>();

    if (upcomingStreams && upcomingStreams.length > 0) {
      // pre_notified 컬럼 보장
      try { await DB.prepare("ALTER TABLE live_streams ADD COLUMN pre_notified INTEGER DEFAULT 0").run() } catch {}

      for (const stream of upcomingStreams) {
        // 구독자에게 인앱 알림 발송
        try {
          const { results: subs } = await DB.prepare(
            "SELECT user_id, user_name FROM broadcast_subscriptions WHERE stream_id = ? AND notify_inapp = 1"
          ).bind(stream.id).all<{ user_id: string; user_name: string }>();

          if (subs && subs.length > 0) {
            const stmts = subs.map(sub =>
              DB.prepare(`
                INSERT INTO user_notifications (user_id, type, title, message, link)
                VALUES (?, 'broadcast_reminder', ?, ?, ?)
              `).bind(
                sub.user_id,
                `⏰ 30분 후 라이브! ${stream.seller_name || '셀러'}`,
                stream.title,
                `/live/${stream.id}`
              )
            );
            // 50개씩 배치
            for (let i = 0; i < stmts.length; i += 50) {
              await DB.batch(stmts.slice(i, i + 50));
            }
          }
        } catch {}

        // 발송 완료 표시
        await DB.prepare("UPDATE live_streams SET pre_notified = 1 WHERE id = ?").bind(stream.id).run();
      }
      results.pre_notifications_sent = upcomingStreams.length;
    }
  } catch (e) { console.error('[Cron] pre_notifications error:', e) }

  // ── 12. 셀러 재고 품절 임박 알림 (5개 이하) ──
  try {
    const { results: lowStock } = await DB.prepare(`
      SELECT p.id, p.name, p.seller_id, COALESCE(p.stock, p.stock_quantity, 0) AS stock
      FROM products p
      WHERE p.is_active = 1 AND COALESCE(p.stock, p.stock_quantity, 0) BETWEEN 1 AND 5
        AND p.seller_id IS NOT NULL
        AND p.id NOT IN (
          SELECT CAST(REPLACE(message, '재고 ', '') AS INTEGER) FROM dashboard_notifications
          WHERE type = 'low_stock' AND created_at > datetime('now', '-24 hours')
        )
      LIMIT 20
    `).all<{ id: number; name: string; seller_id: number; stock: number }>();

    if (lowStock?.length) {
      for (const p of lowStock) {
        await DB.prepare(`INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link)
          VALUES ('seller', ?, 'low_stock', ?, ?, '/seller/products')`)
          .bind(String(p.seller_id), `⚠️ 재고 부족: ${p.name}`, `재고 ${p.stock}개 남음`).run();
      }
      results.low_stock_alerts = lowStock.length;
    }
  } catch (e) { console.error('[Cron] low_stock error:', e) }

  // ── 13. 쿠폰 만료 임박 알림 (D-1, 소비자) ──
  try {
    const { results: expiringCoupons } = await DB.prepare(`
      SELECT c.id, c.code, c.name, c.expires_at
      FROM coupons c
      WHERE c.is_active = 1
        AND c.expires_at IS NOT NULL
        AND c.expires_at > datetime('now')
        AND c.expires_at <= datetime('now', '+1 day')
    `).all<{ id: number; code: string; name: string; expires_at: string }>();

    if (expiringCoupons?.length) {
      // 쿠폰을 사용하지 않은 유저들에게 알림
      for (const coupon of expiringCoupons) {
        const { results: users } = await DB.prepare(`
          SELECT DISTINCT u.id FROM users u
          WHERE u.id NOT IN (SELECT user_id FROM coupon_uses WHERE coupon_id = ?)
          LIMIT 100
        `).bind(coupon.id).all<{ id: string }>();

        if (users?.length) {
          const stmts = users.map(u =>
            DB.prepare('INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
              .bind(u.id, 'coupon_expiring', `🎫 쿠폰 만료 임박!`, `${coupon.name} 쿠폰이 내일 만료됩니다`, '/browse')
          );
          for (let i = 0; i < stmts.length; i += 50) {
            await DB.batch(stmts.slice(i, i + 50));
          }
        }
      }
    }
  } catch (e) { console.error('[Cron] coupon_expiry error:', e) }

  // ── 14. 공동구매 달성 알림 (셀러 + 참여자) ──
  try {
    const { results: achievedGroups } = await DB.prepare(`
      UPDATE products SET group_buy_status = 'achieved', updated_at = datetime('now')
      WHERE category = 'meal_voucher'
        AND group_buy_status = 'active'
        AND group_buy_target > 0
        AND group_buy_current >= group_buy_target
      RETURNING id, name, seller_id
    `).all<{ id: number; name: string; seller_id: number }>();

    if (achievedGroups?.length) {
      for (const g of achievedGroups) {
        // 셀러 알림
        await DB.prepare(`INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link)
          VALUES ('seller', ?, 'group_buy_achieved', ?, ?, '/seller/group-buy')`)
          .bind(String(g.seller_id), '🎉 공동구매 목표 달성!', g.name).run();
      }
      results.group_buy_achieved = achievedGroups.length;
    }
  } catch (e) { console.error('[Cron] group_buy_achieved error:', e) }

  console.log('[Cron] Scheduled cleanup:', JSON.stringify(results));
  return results;
}
