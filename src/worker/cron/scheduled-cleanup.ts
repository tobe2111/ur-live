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
  // ✅ CONCURRENCY FIX (Cron C2): UPDATE RETURNING은 원자적으로 PENDING → CANCELLED
  // 전환된 행만 반환하므로 웹훅과의 경쟁에서도 재고 복구는 한 번만 실행됨.
  // 추가 방어: 재고 복구한 order_items를 CANCELLED로 표시해서 이중 복구 차단.
  try {
    const { results: cancelledOrders } = await DB.prepare(`
      UPDATE orders
      SET status = 'CANCELLED', cancel_reason = '결제 시간 초과 (24시간)', updated_at = datetime('now')
      WHERE status = 'PENDING'
        AND created_at < datetime('now', '-24 hours')
      RETURNING id
    `).all<{ id: number }>();

    if (cancelledOrders && cancelledOrders.length > 0) {
      const orderIds = cancelledOrders.map(o => o.id);
      // ✅ PERF: single IN-query to fetch all items for every cancelled order.
      const ph = orderIds.map(() => '?').join(',');
      const { results: items = [] } = await DB.prepare(
        `SELECT order_id, product_id, quantity FROM order_items
         WHERE order_id IN (${ph}) AND (status IS NULL OR status != 'CANCELLED')`
      ).bind(...orderIds).all<{ order_id: number; product_id: number; quantity: number }>();

      if (items.length > 0) {
        // Batch stock restores + bulk CANCELLED flip in a single atomic D1 batch.
        const stmts = items.map(it =>
          DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
            .bind(it.quantity, it.product_id)
        );
        stmts.push(
          DB.prepare(
            `UPDATE order_items SET status = 'CANCELLED' WHERE order_id IN (${ph})`
          ).bind(...orderIds)
        );
        try { await DB.batch(stmts); } catch (e) { console.error('[Cron] stock restore batch', e); }
      }
      results.pending_orders_cancelled = cancelledOrders.length;
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

  // ── 9b. 만료된 idempotency 키 정리 (테이블이 존재할 때만) ──
  // idempotentWrite() 유틸리티가 저장하는 결과 캐시를 주기적으로 청소한다.
  // 테이블이 없는 환경(신규 배포)에서는 조용히 건너뛴다.
  try {
    await DB.prepare(
      "DELETE FROM idempotency_keys WHERE expires_at < datetime('now')"
    ).run();
  } catch { /* table may not exist yet — skip silently */ }

  // ── 10. 자동 구매확정: 배송 14일 경과 ──
  // 프로덕션 DB는 대문자 상태값 사용 ('SHIPPING', 'DELIVERED').
  // settlement_status는 'completed' 사용 (정산 자동화 스크립트와 일치).
  // ✅ FIX (Cron C3): settlement_status가 이미 completed/paid인 행은 건너뛰어
  // 이미 정산된 주문을 재처리하지 않도록 필터링.
  try {
    const { meta } = await DB.prepare(`
      UPDATE orders
      SET status = 'DELIVERED', delivered_at = datetime('now'),
          settlement_status = 'completed', updated_at = datetime('now')
      WHERE status = 'SHIPPING'
        AND shipped_at < datetime('now', '-14 days')
        AND (settlement_status IS NULL OR settlement_status = 'pending')
    `).run();
    results.auto_confirmed = meta.changes ?? 0;
  } catch (e) { console.error('[Cron] auto_confirm error:', e) }

  // ── 11. 예정 방송 30분 전 알림 발송 ──
  // 🛡️ 2026-04-22: LIMIT 100 추가 — 1000+ scheduled streams 시 OOM 방어
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
      ORDER BY ls.scheduled_at ASC
      LIMIT 100
    `).all<{ id: number; title: string; seller_id: number; seller_name: string }>();

    if (upcomingStreams && upcomingStreams.length > 0) {
      // pre_notified 컬럼 보장
      try { await DB.prepare("ALTER TABLE live_streams ADD COLUMN pre_notified INTEGER DEFAULT 0").run() } catch {}

      // ✅ FIX (H4): Cap loop size to avoid Worker subrequest limits (50 per invocation)
      for (const stream of upcomingStreams.slice(0, 20)) {
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
  // 24시간 시간 윈도우 기반 dedup: 제품명이 title에 포함되는지로 확인.
  // (dashboard_notifications에 metadata 컬럼 없음 — title LIKE 매칭으로 충분)
  try {
    const { results: lowStock } = await DB.prepare(`
      SELECT p.id, p.name, p.seller_id, COALESCE(p.stock, p.stock_quantity, 0) AS stock
      FROM products p
      WHERE p.is_active = 1 AND COALESCE(p.stock, p.stock_quantity, 0) BETWEEN 1 AND 5
        AND p.seller_id IS NOT NULL
      LIMIT 50
    `).all<{ id: number; name: string; seller_id: number; stock: number }>();

    let alertsSent = 0;
    if (lowStock?.length) {
      // ✅ FIX (H4): Batch inserts + cap loop to stay within subrequest budget.
      const inserts: any[] = [];
      for (const p of lowStock.slice(0, 20)) {
        // 24시간 윈도우 dedup: 같은 셀러 + 같은 제품명에 대해 최근 알림 존재 확인
        const existing = await DB.prepare(`
          SELECT 1 FROM dashboard_notifications
          WHERE recipient_type = 'seller'
            AND recipient_id = ?
            AND type = 'low_stock'
            AND title LIKE ?
            AND created_at > datetime('now', '-24 hours')
          LIMIT 1
        `).bind(String(p.seller_id), `%${p.name}%`).first();
        if (existing) continue;

        inserts.push(DB.prepare(`INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link)
          VALUES ('seller', ?, 'low_stock', ?, ?, '/seller/products')`)
          .bind(String(p.seller_id), `⚠️ 재고 부족: ${p.name}`, `재고 ${p.stock}개 남음`));
        alertsSent++;
      }
      if (inserts.length > 0) {
        await DB.batch(inserts);
      }
      results.low_stock_alerts = alertsSent;
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
      ORDER BY c.expires_at ASC
      LIMIT 100
    `).all<{ id: number; code: string; name: string; expires_at: string }>();

    if (expiringCoupons?.length) {
      // 쿠폰을 사용하지 않은 유저들에게 알림
      // ✅ FIX (H4): Cap coupon loop to stay within subrequest budget.
      for (const coupon of expiringCoupons.slice(0, 10)) {
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
      // 🛡️ 2026-04-22: per-group try-catch — 한 알림 실패해도 나머지 진행
      let notified = 0;
      for (const g of achievedGroups) {
        try {
          await DB.prepare(`INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link)
            VALUES ('seller', ?, 'group_buy_achieved', ?, ?, '/seller/group-buy')`)
            .bind(String(g.seller_id), '🎉 공동구매 목표 달성!', g.name).run();
          notified++;
        } catch (notifyErr) {
          console.error(`[Cron] group_buy_achieved notify failed for seller ${g.seller_id}:`, notifyErr);
        }
      }
      results.group_buy_achieved = achievedGroups.length;
      results.group_buy_notified = notified;
    }
  } catch (e) { console.error('[Cron] group_buy_achieved error:', e) }

  // ── 15. csp_violations 정리: 30일 경과 (DoS 방어 + DB 부피 관리) ──
  // 🛡️ 2026-04-22: CSP 보고가 너무 많이 쌓이면 DB 비용 + 분석 노이즈
  try {
    await DB.prepare(`
      DELETE FROM csp_violations WHERE created_at < datetime('now', '-30 days')
    `).run();
  } catch { /* table may not exist */ }

  // ── 16. account_lockouts 정리: 만료된 잠금 기록 ──
  try {
    await DB.prepare(`
      DELETE FROM account_lockouts WHERE locked_until < datetime('now', '-7 days')
    `).run();
  } catch { /* table may not exist */ }

  // ── 17. chat_messages 정리: 90일 경과 (live stream 종료 후 보관) ──
  // 라이브 종료 후 대량 채팅 누적 → 검색 부하. 라이브 다시보기에 필요한 90일만 보관.
  try {
    await DB.prepare(`
      DELETE FROM chat_messages
      WHERE created_at < datetime('now', '-90 days')
        AND live_stream_id IN (
          SELECT id FROM live_streams WHERE status = 'ended' AND ended_at < datetime('now', '-90 days')
        )
    `).run();
  } catch { /* table may not exist */ }

  // ── 18. rate_limit_attempts 정리: 24시간 이상 된 카운터 ──
  try {
    await DB.prepare(`
      DELETE FROM rate_limit_attempts WHERE window_start < (CAST(strftime('%s', 'now') AS INTEGER) - 86400)
    `).run();
  } catch { /* table may not exist */ }

  // ── 19. stripe_webhook_events 정리: 90일 경과 (idempotency 키, 더 이상 필요없음) ──
  try {
    await DB.prepare(`
      DELETE FROM stripe_webhook_events WHERE processed_at < datetime('now', '-90 days')
    `).run();
  } catch { /* table may not exist */ }

  // ── 20. 🛡️ 2026-04-28: gift 만료 처리 (paid 상태 + expires_at 경과) ──
  //   - 30일 내 recipient 가 claim 안 하면 expired
  //   - 환불은 후속 작업 (별도 cron 이 status='expired' → Toss 부분취소 호출)
  try {
    const { meta } = await DB.prepare(`
      UPDATE gifts
      SET status = 'expired', updated_at = datetime('now')
      WHERE status = 'paid'
        AND expires_at IS NOT NULL
        AND expires_at < datetime('now')
    `).run();
    results.gifts_expired = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  // ── 21. 🛡️ 2026-04-28: pending 상태 gift 자동 정리 (24시간 결제 미완료) ──
  //   토스 결제 confirm 호출 안 된 채 24시간 경과 → refunded (실 결제 안 된 상태)
  try {
    const { meta } = await DB.prepare(`
      UPDATE gifts
      SET status = 'refunded', updated_at = datetime('now')
      WHERE status = 'pending'
        AND created_at < datetime('now', '-24 hours')
    `).run();
    results.gifts_pending_cleaned = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  // ── 22. 🛡️ 2026-04-28: consignment_partnerships pending 30일 자동 정리 ──
  //   양측 모두 응답 안 하면 자동 ended (cleanup)
  try {
    const { meta } = await DB.prepare(`
      UPDATE consignment_partnerships
      SET status = 'ended', ended_at = datetime('now'), updated_at = datetime('now')
      WHERE status = 'pending'
        AND created_at < datetime('now', '-30 days')
    `).run();
    results.consignment_pending_expired = meta.changes ?? 0;
  } catch { /* table may not exist */ }

  console.log('[Cron] Scheduled cleanup:', JSON.stringify(results));
  return results;
}
