import { logInfo, logError } from '../utils/logger'
/**
 * 스케줄 작업 (Cloudflare Cron Triggers)
 * 5분마다 실행 — 만료/정리/자동 상태 전환
 */

import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';
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
  } catch (e) { logError('[Cron] stale_streams error:', { error: String(e) }) }

  // ── 1b. dead 웹캠 방송 정리 (2026-05-07) ──
  //   셀러가 웹캠 모드로 시작했지만 YouTube Studio 에서 방송 연결을 완료하지 않은 케이스.
  //   status='live' 인데 youtube_video_id 가 비어있고 30분 이상 경과 → cancelled 처리.
  //   🛡️ 2026-05-11: 10분 → 30분 — 셀러가 YouTube Studio 웹캠 송출 popup 띄우고 천천히 시작하는 케이스 보호.
  try {
    const { meta } = await DB.prepare(`
      UPDATE live_streams
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE status IN ('live', 'scheduled')
        AND (youtube_video_id IS NULL OR youtube_video_id = '')
        AND created_at < datetime('now', '-30 minutes')
    `).run();
    results.dead_webcam_streams_cancelled = meta.changes ?? 0;
  } catch (e) { logError('[Cron] dead_webcam_streams error:', { error: String(e) }) }

  // ── 1c. zombie scheduled 정리 (2026-05-11) ──
  //   broadcast/video_id 는 만들어졌는데 셀러가 송출 시작 안 했거나 OME 미연결로 admission webhook 이
  //   안 와서 영원히 'scheduled' 로 남는 케이스. 2시간 이상 묵으면 ended 처리.
  //   (셀러 dashboard 정합성 + 메인 페이지 zombie 카드 노출 방지)
  try {
    const { meta } = await DB.prepare(`
      UPDATE live_streams
      SET status = 'ended', ended_at = datetime('now'), updated_at = datetime('now'),
          last_error = COALESCE(last_error, '송출이 시작되지 않은 채 2시간 경과 — 자동 종료')
      WHERE status = 'scheduled'
        AND created_at < datetime('now', '-2 hours')
    `).run();
    results.zombie_scheduled_ended = meta.changes ?? 0;
  } catch (e) { logError('[Cron] zombie_scheduled error:', { error: String(e) }) }

  // ── 1d. zombie OME push 정리 (2026-05-11) ──
  //   셀러가 브라우저를 갑자기 닫는 등 closing event 가 안 오면 OME push 가 영원히 남음.
  //   다음 broadcast 와 충돌하지 않도록 cron 으로 청소.
  //   기준: OME 의 active streams 목록에 없는 push 는 모두 stopPush.
  if (env.OME_HOST && env.OME_API_TOKEN) {
    try {
      const auth = btoa(env.OME_API_TOKEN)
      const omeBase = `http://${env.OME_HOST}:8081/v1/vhosts/default/apps/app`
      // 1) 활성 streams 조회
      const streamsRes = await fetch(`${omeBase}/streams`, { headers: { Authorization: `Basic ${auth}` } })
      const streamsData = streamsRes.ok ? await streamsRes.json().catch(() => null) as { response?: string[] } | null : null
      const activeStreams = new Set(streamsData?.response || [])
      // 2) pushes 조회
      const pushesRes = await fetch(`${omeBase}:pushes`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const pushesData = pushesRes.ok ? await pushesRes.json().catch(() => null) as { response?: Array<{ id: string }> } | null : null
      const pushes = pushesData?.response || []
      let removed = 0
      for (const push of pushes) {
        // push.id 형식: "youtube-<streamId>". 대응되는 stream "s<streamId>" 가 active 가 아니면 zombie.
        const m = push.id.match(/^youtube-(\d+)$/)
        if (!m) continue
        const streamName = `s${m[1]}`
        if (activeStreams.has(streamName)) continue  // 정상 활성 push
        // zombie - stopPush
        await fetch(`${omeBase}:stopPush`, {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: push.id }),
        }).catch(() => undefined)
        removed++
      }
      results.zombie_ome_pushes_cleaned = removed
    } catch (e) { logError('[Cron] zombie_ome_pushes error:', { error: String(e) }) }
  }

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
        try { await DB.batch(stmts); } catch (e) { logError('[Cron] stock restore batch', { error: String(e) }); }
      }
      results.pending_orders_cancelled = cancelledOrders.length;
    }
  } catch (e) { logError('[Cron] pending_orders error:', { error: String(e) }) }

  // ── 3. 공동구매: 마감 지난 상품 자동 만료 (6종 카테고리 전체) ──
  // 🛡️ 2026-05-04: 이전엔 meal_voucher 만 → API request 시점에서도 UPDATE 했지만
  //   매 요청 100-300ms 추가됐음. cron 으로 통일 + 6종 카테고리 모두 커버.
  try {
    const { meta } = await DB.prepare(`
      UPDATE products
      SET group_buy_status = 'expired', updated_at = datetime('now')
      WHERE category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
        AND group_buy_status = 'active'
        AND group_buy_deadline IS NOT NULL
        AND group_buy_deadline < datetime('now')
    `).run();
    results.group_buys_expired = meta.changes ?? 0;
  } catch (e) { logError('[Cron] group_buys error:', { error: String(e) }) }

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
  } catch (e) { logError('[Cron] vouchers error:', { error: String(e) }) }

  // ── 5. 경매: 시간 초과 자동 종료 + hold 해제 + winner 알림 ──
  // 🛡️ 2026-04-28: 단순 status 변경에서 → hold 정리 + 낙찰자 결제 안내까지 통합
  try {
    // 1) 종료 대상 조회 (RETURNING 으로 atomic + winner 정보 동시 획득)
    const { results: endedAuctions } = await DB.prepare(`
      UPDATE live_auctions
      SET status = 'ended'
      WHERE status = 'active' AND ends_at < datetime('now')
      RETURNING id, stream_id, winner_user_id, winner_name, current_price, title
    `).all<{
      id: number; stream_id: number; winner_user_id: string | null;
      winner_name: string | null; current_price: number; title: string;
    }>();

    results.auctions_ended = endedAuctions?.length ?? 0;

    // 2) 각 경매별 hold 정리 + winner 알림 (best-effort, 실패해도 다른 경매 영향 0)
    for (const a of endedAuctions || []) {
      // hold 해제: winner 외 모든 active hold (winner 는 결제 완료 시 consumed 처리)
      try {
        if (a.winner_user_id) {
          await DB.prepare(
            "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND user_id != ? AND status = 'active'"
          ).bind(a.id, a.winner_user_id).run();
        } else {
          await DB.prepare(
            "UPDATE auction_holds SET status = 'released', released_at = datetime('now') WHERE auction_id = ? AND status = 'active'"
          ).bind(a.id).run();
        }
      } catch (e) { logError('[Cron] auction hold release error', { auctionId: a.id, error: String(e) }) }

      // winner 결제 안내 알림 (push + alimtalk best-effort)
      if (a.winner_user_id) {
        try {
          const { sendSystemPush } = await import('../../lib/system-push');
          sendSystemPush(env, 'user', a.winner_user_id, {
            title: '경매 낙찰 🎉',
            body: `${a.title} ${Number(a.current_price ?? 0).toLocaleString('ko-KR')}원에 낙찰됐어요. 결제를 진행해주세요.`,
            url: `/live/${a.stream_id}`,
          }).catch(swallow('scheduled-cleanup:auction-winner-push'));
        } catch { /* ignore */ }

        try {
          const phoneRow = await DB.prepare(
            'SELECT phone FROM users WHERE CAST(id AS TEXT) = ? OR firebase_uid = ? LIMIT 1'
          ).bind(a.winner_user_id, a.winner_user_id).first<{ phone: string | null }>();
          if (phoneRow?.phone) {
            const { sendSystemAlimtalk } = await import('../../lib/system-alimtalk');
            sendSystemAlimtalk(env, phoneRow.phone, 'auction_won',
              `[유어딜] 경매 낙찰 안내\n${a.title}\n낙찰가: ${Number(a.current_price ?? 0).toLocaleString('ko-KR')}원\n결제를 진행해주세요.`
            ).catch(swallow('scheduled-cleanup:auction-won-alimtalk'));
          }
        } catch { /* ignore */ }
      }
    }
  } catch (e) { logError('[Cron] auctions error:', { error: String(e) }) }

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
  } catch (e) { logError('[Cron] timedeals error:', { error: String(e) }) }

  // ── 7. 친구 초대 공동구매: 48시간 만료 ──
  try {
    const { meta } = await DB.prepare(`
      UPDATE referral_groups
      SET status = 'expired'
      WHERE status = 'open'
        AND expires_at < datetime('now')
    `).run();
    results.referrals_expired = meta.changes ?? 0;
  } catch (e) { logError('[Cron] referrals error:', { error: String(e) }) }

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
  } catch (e) { logError('[Cron] notifications_cleanup error:', { error: String(e) }) }

  // ── 9. 만료된 리프레시 토큰 정리 ──
  try {
    await DB.prepare(`
      DELETE FROM refresh_tokens
      WHERE expires_at < datetime('now')
    `).run();
  } catch (e) { logError('[Cron] token_cleanup error:', { error: String(e) }) }

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
  } catch (e) { logError('[Cron] auto_confirm error:', { error: String(e) }) }

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
  } catch (e) { logError('[Cron] pre_notifications error:', { error: String(e) }) }

  // ── 11b. 예정 방송 5분 전 긴급 알림 ──
  try {
    try { await DB.prepare("ALTER TABLE live_streams ADD COLUMN pre_notified_5min INTEGER DEFAULT 0").run() } catch {}
    const { results: imminent } = await DB.prepare(`
      SELECT ls.id, ls.title, ls.seller_id, s.name AS seller_name
      FROM live_streams ls
      LEFT JOIN sellers s ON s.id = ls.seller_id
      WHERE ls.status = 'scheduled'
        AND ls.scheduled_at IS NOT NULL
        AND ls.scheduled_at > datetime('now')
        AND ls.scheduled_at <= datetime('now', '+8 minutes')
        AND COALESCE(ls.pre_notified_5min, 0) = 0
      ORDER BY ls.scheduled_at ASC
      LIMIT 50
    `).all<{ id: number; title: string; seller_id: number; seller_name: string }>()

    for (const stream of (imminent ?? []).slice(0, 20)) {
      try {
        const { results: subs } = await DB.prepare(
          "SELECT user_id FROM broadcast_subscriptions WHERE stream_id = ? AND notify_inapp = 1"
        ).bind(stream.id).all<{ user_id: string }>()
        if (subs?.length) {
          const stmts = subs.map(sub =>
            DB.prepare("INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, 'broadcast_reminder', ?, ?, ?)")
              .bind(sub.user_id, `🔴 5분 후 라이브 시작! ${stream.seller_name || '셀러'}`, stream.title, `/live/${stream.id}`)
          )
          for (let i = 0; i < stmts.length; i += 50) await DB.batch(stmts.slice(i, i + 50))
        }
      } catch {}
      await DB.prepare("UPDATE live_streams SET pre_notified_5min = 1 WHERE id = ?").bind(stream.id).run()
    }
  } catch (e) { logError('[Cron] 5min_notifications error:', { error: String(e) }) }

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
  } catch (e) { logError('[Cron] low_stock error:', { error: String(e) }) }

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
  } catch (e) { logError('[Cron] coupon_expiry error:', { error: String(e) }) }

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
          logError(`[Cron] group_buy_achieved notify failed for seller ${g.seller_id}`, { error: String(notifyErr) });
        }
      }
      results.group_buy_achieved = achievedGroups.length;
      results.group_buy_notified = notified;
    }
  } catch (e) { logError('[Cron] group_buy_achieved error:', { error: String(e) }) }

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

  // ── 20-b. 🛡️ 2026-04-28: expired gift 의 토스 부분취소 자동 호출 ──
  //   #20 에서 status='expired' 된 gift 들을 토스 cancel API 로 환불.
  //   성공 시 status='refunded'. 실패는 best-effort (다음 cron tick 에서 재시도).
  try {
    const tossSecretKey = (env as { TOSS_SECRET_KEY?: string }).TOSS_SECRET_KEY;
    if (tossSecretKey) {
      const { results: expiredGifts } = await DB.prepare(`
        SELECT id, toss_payment_key, amount FROM gifts
        WHERE status = 'expired' AND toss_payment_key IS NOT NULL
        LIMIT 50
      `).all<{ id: number; toss_payment_key: string; amount: number }>();

      let refunded = 0, failed = 0;
      for (const g of expiredGifts ?? []) {
        try {
          const { requestTossRefund } = await import('../utils/refund');
          const r = await requestTossRefund(g.toss_payment_key, '선물 30일 미수령 자동 환불', tossSecretKey);
          if (r.success) {
            await DB.prepare(`
              UPDATE gifts SET status = 'refunded', updated_at = datetime('now') WHERE id = ?
            `).bind(g.id).run();
            refunded++;

            // 🛡️ 2026-04-28: sender 에게 환불 알림 (best-effort).
            //   gift 의 sender_user_id 의 phone 을 조회해 알림톡 발송.
            try {
              const aligoKey = (env as { ALIGO_API_KEY?: string }).ALIGO_API_KEY;
              const aligoUser = (env as { ALIGO_USER_ID?: string }).ALIGO_USER_ID;
              if (aligoKey && aligoUser) {
                const giftDetail = await DB.prepare(`
                  SELECT g.amount, u.phone, u.name FROM gifts g
                  LEFT JOIN users u ON u.id = g.sender_user_id WHERE g.id = ?
                `).bind(g.id).first<{ amount: number; phone: string | null; name: string | null }>();
                // 🛡️ 2026-04-28: 플랫폼 senderKey 필요. 미설정이면 발송 skip.
                const aligoSender = (env as { ALIGO_SENDER_KEY?: string }).ALIGO_SENDER_KEY;
                if (giftDetail?.phone && aligoSender) {
                  const { sendAlimtalk } = await import('../../lib/aligo');
                  await sendAlimtalk(
                    { ALIGO_API_KEY: aligoKey, ALIGO_USER_ID: aligoUser },
                    {
                      senderKey: aligoSender,
                      templateCode: 'gift_refunded',
                      to: giftDetail.phone,
                      message: `[유어딜] 보내신 선물 (${Number(giftDetail.amount ?? 0).toLocaleString('ko-KR')}원) 이 30일 미수령으로 자동 환불됐어요.`,
                    }
                  );
                }
              }
            } catch { /* alimtalk 실패는 무시 */ }
          } else {
            failed++;
          }
        } catch { failed++; }
      }
      results.gifts_refunded = refunded;
      if (failed > 0) results.gifts_refund_failed = failed;
    }
  } catch (e) { logError('[Cron] gift refund error:', { error: String(e) }); }

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

  // ── 23. 🛡️ 2026-04-28: consignment_settlements 자동 기록 (월간 윈도우) ──
  //   당월 1일 ~ 어제까지의 consignment 주문건을 분배 기록 (멱등).
  try {
    const { recordConsignmentSettlements } = await import('../../lib/consignment-settlement');
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const r = await recordConsignmentSettlements(DB, monthStart, yesterday);
    if (r.recorded > 0 || r.failed > 0) {
      results.consignment_settlements_recorded = r.recorded;
      if (r.failed > 0) results.consignment_settlements_failed = r.failed;
    }
  } catch (e) { logError('[Cron] consignment_settlements record error:', { error: String(e) }); }

  logInfo('[Cron] Scheduled cleanup:', { details: results });
  return results;
}
