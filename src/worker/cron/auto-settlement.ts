/**
 * Auto-Settlement Cron Handler
 *
 * Calculates settlements for used vouchers that are 7+ days old
 * and have not yet been assigned to a settlement record.
 *
 * Groups vouchers by seller, creates a pending settlement per seller,
 * and marks the vouchers as settled.
 */

import type { Env } from '../types/env';
import { sendDiscordAlert } from '../utils/discord-alert';

export async function handleAutoSettlement(env: Env) {
  const DB = env.DB;

  try {
    // Find used vouchers not yet in any settlement, used 7+ days ago
    const usedVouchers = await DB.prepare(`
      SELECT v.id, v.product_id, v.order_id, p.price, p.seller_id, p.restaurant_name,
             COALESCE(p.commission_rate, 15) as commission_rate
      FROM vouchers v
      JOIN products p ON v.product_id = p.id
      WHERE v.status = 'used'
        AND v.used_at <= datetime('now', '-7 days')
        AND v.settlement_id IS NULL
    `).all();

    if (!usedVouchers.results?.length) return;

    // Group by seller_id
    const sellerGroups: Record<number, any[]> = {};
    for (const v of usedVouchers.results) {
      const sid = v.seller_id as number;
      if (!sellerGroups[sid]) sellerGroups[sid] = [];
      sellerGroups[sid].push(v);
    }

    // Create settlement records
    for (const [sellerId, vouchers] of Object.entries(sellerGroups)) {
      const totalRevenue = vouchers.reduce((sum: number, v: any) => sum + (v.price || 0), 0);
      const commissionRate = vouchers[0]?.commission_rate || 15;
      const commissionAmount = Math.floor(totalRevenue * commissionRate / 100);
      const settlementAmount = totalRevenue - commissionAmount;

      const result = await DB.prepare(`
        INSERT INTO restaurant_settlements (seller_id, restaurant_name, total_vouchers_used, total_revenue, commission_rate, commission_amount, settlement_amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
      `).bind(
        Number(sellerId),
        vouchers[0]?.restaurant_name || '',
        vouchers.length,
        totalRevenue,
        commissionRate,
        commissionAmount,
        settlementAmount
      ).run();

      // Mark vouchers as settled
      if (result.meta?.last_row_id) {
        for (const v of vouchers) {
          await DB.prepare("UPDATE vouchers SET settlement_id = ? WHERE id = ?")
            .bind(result.meta.last_row_id, v.id).run();
        }
      }
    }

    console.log(`[Cron] Auto-settlement: ${Object.keys(sellerGroups).length} sellers processed`);
  } catch (err) {
    console.error('[Cron] Auto-settlement failed:', err);
    if (env.DISCORD_WEBHOOK_URL) {
      await sendDiscordAlert(
        env.DISCORD_WEBHOOK_URL,
        'Auto-Settlement Failed',
        `Cron auto-settlement encountered an error: ${(err as Error).message || String(err)}`,
        'error'
      );
    }
  }
}

/**
 * Auto-refund expired vouchers.
 *
 * 1. Find vouchers with status='unused' and expires_at < now
 * 2. Mark them as 'expired'
 * 3. If paid with deal points, refund the user's deal_balance
 * 4. Send notification to the user
 */
export async function handleExpiredVoucherRefunds(env: Env) {
  const DB = env.DB;

  try {
    // Find expired unused vouchers
    const expired = await DB.prepare(`
      SELECT v.id, v.code, v.order_id, v.product_id,
             o.user_id, o.payment_method, p.price, p.name as product_name
      FROM vouchers v
      JOIN orders o ON v.order_id = o.id
      JOIN products p ON v.product_id = p.id
      WHERE v.status = 'unused'
        AND v.expires_at < datetime('now')
    `).all();

    if (!expired.results?.length) return;

    let refundCount = 0;
    let expireCount = 0;

    for (const voucher of expired.results) {
      // Mark voucher as expired
      await DB.prepare("UPDATE vouchers SET status = 'expired' WHERE id = ?")
        .bind(voucher.id).run();
      expireCount++;

      // Refund deal points if paid with deal_points — user_points 테이블 사용
      if (voucher.payment_method === 'deal_points' && voucher.user_id && voucher.price) {
        try {
          await DB.prepare(
            `CREATE TABLE IF NOT EXISTS user_points (
              user_id TEXT PRIMARY KEY,
              balance INTEGER NOT NULL DEFAULT 0,
              total_charged INTEGER NOT NULL DEFAULT 0,
              total_donated INTEGER NOT NULL DEFAULT 0,
              created_at DATETIME DEFAULT (datetime('now')),
              updated_at DATETIME DEFAULT (datetime('now'))
            )`
          ).run();
          const existingPts = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
            .bind(voucher.user_id).first<{ balance: number }>();
          if (existingPts) {
            await DB.prepare("UPDATE user_points SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?")
              .bind(voucher.price, voucher.user_id).run();
          } else {
            await DB.prepare('INSERT INTO user_points (user_id, balance, total_charged) VALUES (?, ?, ?)')
              .bind(voucher.user_id, voucher.price, voucher.price).run();
          }
        } catch (e) {
          if (import.meta.env?.DEV) console.warn('[auto-settlement user_points]', e);
        }
        // Best-effort legacy column sync
        try {
          await DB.prepare("UPDATE users SET deal_balance = COALESCE(deal_balance, 0) + ? WHERE id = ?")
            .bind(voucher.price, voucher.user_id).run();
        } catch (e) {
          if (import.meta.env?.DEV) console.warn('[deal_balance]', e);
        }
        refundCount++;

        // Send notification to user (production notifications requires user_type)
        try {
          await DB.prepare(`
            INSERT INTO notifications (user_id, user_type, type, title, message, created_at, is_read)
            VALUES (?, 'user', 'refund', '바우처 만료 환불', ?, datetime('now'), 0)
          `).bind(
            voucher.user_id,
            `바우처가 만료되어 ${Number(voucher.price).toLocaleString()}딜 포인트가 환불되었습니다 (${voucher.product_name})`
          ).run();
        } catch (e) {
          if (import.meta.env?.DEV) console.warn('[notifications insert]', e);
        }
      }
    }

    console.log(`[Cron] Expired voucher refunds: ${expireCount} expired, ${refundCount} refunded`);
  } catch (err) {
    console.error('[Cron] Expired voucher refund failed:', err);
    if (env.DISCORD_WEBHOOK_URL) {
      await sendDiscordAlert(
        env.DISCORD_WEBHOOK_URL,
        'Expired Voucher Refund Failed',
        `Cron expired voucher refund encountered an error: ${(err as Error).message || String(err)}`,
        'error'
      );
    }
  }
}
