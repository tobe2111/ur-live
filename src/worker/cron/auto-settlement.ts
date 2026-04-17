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
  }
}
