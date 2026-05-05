/**
 * Seller Tier Auto Evaluation — 5단계 score 기반 자동 등급화 (2026-05-05)
 *
 * Migration 0244 적용 후 동작.
 *
 * 등급 (5단계):
 *   diamond (3% 수수료, 4.0× 노출): score >= 85
 *   gold    (4%, 2.5×):              score >= 70
 *   silver  (5% 기본, 1.5×):          score >= 50
 *   bronze  (5%, 1.0×):              score >= 25
 *   new     (5%, 0.7× 보호):         가입 30일 미만 OR 미달
 *
 * Score 산정 (정규화 0~100):
 *   0.35 × log_normalize(GMV_30d)
 * + 0.20 × clamp(CVR × 10, 0, 100)
 * + 0.15 × log_normalize(donation_30d)
 * + 0.15 × repurchase_rate × 100
 * + 0.10 × refund_safety_score (1 - refund_rate) × 100
 * + 0.05 × abuse_clean_bonus
 *
 * 매주 월요일 02:00 KST 실행. 멱등.
 *
 * 결과:
 *   - sellers.tier / tier_score / exposure_weight / commission_rate 자동 갱신
 *   - seller_tier_history 에 변경 이력
 *   - 등급 격상 시 셀러 알림
 */

import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';

export type SellerTier = 'diamond' | 'gold' | 'silver' | 'bronze' | 'new';

const TIER_RANK: Record<SellerTier, number> = { diamond: 5, gold: 4, silver: 3, bronze: 2, new: 1 };

const TIER_COMMISSION: Record<SellerTier, number> = {
  diamond: 3,
  gold: 4,
  silver: 5,
  bronze: 5,
  new: 5,
};
const TIER_EXPOSURE: Record<SellerTier, number> = {
  diamond: 4.0,
  gold: 2.5,
  silver: 1.5,
  bronze: 1.0,
  new: 0.7,
};

function logNormalize(value: number, max: number = 1e8): number {
  if (value <= 0) return 0;
  const score = (Math.log10(value + 1) / Math.log10(max + 1)) * 100;
  return Math.min(100, Math.max(0, score));
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface SellerMetrics {
  gmv30d: number;
  donation30d: number;
  uniqueViewers: number;
  uniqueBuyers: number;
  totalOrders: number;
  refundCount: number;
  refundAmount: number;
  repurchaseCount: number;
  abuseFlags: number;
  daysSinceCreated: number;
}

export function calcTierScore(m: SellerMetrics): { score: number; cvr: number; repurchaseRate: number; refundSafety: number } {
  const cvr = m.uniqueViewers > 0 ? m.uniqueBuyers / m.uniqueViewers : 0;
  const repurchaseRate = m.uniqueBuyers > 0 ? m.repurchaseCount / m.uniqueBuyers : 0;
  const refundRate = m.gmv30d > 0 ? m.refundAmount / m.gmv30d : 0;
  const refundSafety = clamp(1 - refundRate, 0, 1);
  const abuseClean = m.abuseFlags === 0 ? 1 : Math.max(0, 1 - m.abuseFlags / 5);

  const score =
    0.35 * logNormalize(m.gmv30d) +
    0.20 * clamp(cvr * 10 * 100, 0, 100) +
    0.15 * logNormalize(m.donation30d, 1e7) +
    0.15 * clamp(repurchaseRate * 100 / 0.4, 0, 100) +
    0.10 * refundSafety * 100 +
    0.05 * abuseClean * 100;

  return { score: Math.round(score * 10) / 10, cvr, repurchaseRate, refundSafety };
}

export function scoreToTier(score: number, daysSinceCreated: number): SellerTier {
  if (daysSinceCreated < 30) return 'new';
  if (score >= 85) return 'diamond';
  if (score >= 70) return 'gold';
  if (score >= 50) return 'silver';
  if (score >= 25) return 'bronze';
  return 'new';
}

async function collectMetrics(DB: D1Database, sellerId: number, daysSinceCreated: number): Promise<SellerMetrics> {
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();

  const gmvRow = await DB.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS gmv,
           COUNT(*) AS total_orders,
           COUNT(DISTINCT user_id) AS unique_buyers
    FROM orders
    WHERE seller_id = ? AND payment_status = 'approved'
      AND status NOT IN ('CANCELLED','REFUNDED','FAILED')
      AND created_at >= ?
  `).bind(sellerId, since30d).first<{ gmv: number; total_orders: number; unique_buyers: number }>().catch(() => null);

  const refundRow = await DB.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) AS refund_amount,
           COUNT(*) AS refund_count
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    WHERE o.seller_id = ? AND r.status = 'refunded'
      AND r.refunded_at >= ?
  `).bind(sellerId, since30d).first<{ refund_amount: number; refund_count: number }>().catch(() => null);

  const donRow = await DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS donation
    FROM donations
    WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ?
  `).bind(sellerId, since30d).first<{ donation: number }>().catch(() => null);

  const viewerRow = await DB.prepare(`
    SELECT COUNT(DISTINCT lsv.user_id) AS unique_viewers
    FROM live_stream_views lsv
    JOIN live_streams ls ON ls.id = lsv.live_stream_id
    WHERE ls.seller_id = ? AND lsv.joined_at >= ?
  `).bind(sellerId, since30d).first<{ unique_viewers: number }>().catch(() => null);

  const repRow = await DB.prepare(`
    SELECT COUNT(*) AS repeat_count FROM (
      SELECT user_id FROM orders
      WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED','REFUNDED')
        AND created_at >= ?
      GROUP BY user_id HAVING COUNT(*) > 1
    )
  `).bind(sellerId, since30d).first<{ repeat_count: number }>().catch(() => null);

  const abuseRow = await DB.prepare(`
    SELECT COUNT(*) AS cnt FROM abuse_detections
    WHERE severity IN ('medium','high') AND created_at >= ?
      AND (ref_id IN (SELECT CAST(id AS TEXT) FROM orders WHERE seller_id = ?))
  `).bind(since30d, sellerId).first<{ cnt: number }>().catch(() => null);

  return {
    gmv30d: Number(gmvRow?.gmv ?? 0),
    donation30d: Number(donRow?.donation ?? 0),
    uniqueViewers: Number(viewerRow?.unique_viewers ?? 0),
    uniqueBuyers: Number(gmvRow?.unique_buyers ?? 0),
    totalOrders: Number(gmvRow?.total_orders ?? 0),
    refundCount: Number(refundRow?.refund_count ?? 0),
    refundAmount: Number(refundRow?.refund_amount ?? 0),
    repurchaseCount: Number(repRow?.repeat_count ?? 0),
    abuseFlags: Number(abuseRow?.cnt ?? 0),
    daysSinceCreated,
  };
}

export async function handleSellerTierEval(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  const sellers = await DB.prepare(`
    SELECT id, created_at, COALESCE(tier, 'new') AS tier, COALESCE(tier_score, 0) AS tier_score
    FROM sellers WHERE COALESCE(is_active, 1) = 1
  `).all<{ id: number; created_at: string; tier: string; tier_score: number }>().catch(() => ({ results: [] as Array<{ id: number; created_at: string; tier: string; tier_score: number }> }));

  if (!sellers.results?.length) return;

  const now = Date.now();
  let evaluated = 0;
  let changed = 0;

  for (const s of sellers.results) {
    try {
      const daysSinceCreated = Math.floor((now - new Date(s.created_at).getTime()) / 86400_000);
      const metrics = await collectMetrics(DB, s.id, daysSinceCreated);
      const { score, cvr, repurchaseRate, refundSafety } = calcTierScore(metrics);
      const newTier = scoreToTier(score, daysSinceCreated);
      const oldTier = (s.tier || 'new') as SellerTier;

      const commissionRate = TIER_COMMISSION[newTier];
      const exposureWeight = TIER_EXPOSURE[newTier];

      await DB.prepare(`
        UPDATE sellers
           SET tier = ?, tier_score = ?, exposure_weight = ?, commission_rate = ?,
               tier_updated_at = datetime('now')
         WHERE id = ?
      `).bind(newTier, score, exposureWeight, commissionRate, s.id).run().catch(swallow('worker:cron:seller-tier-eval'));

      if (newTier !== oldTier) {
        await DB.prepare(`
          INSERT INTO seller_tier_history (seller_id, prev_tier, new_tier, prev_score, new_score, metrics_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          s.id, oldTier, newTier, s.tier_score, score,
          JSON.stringify({ ...metrics, cvr, repurchaseRate, refundSafety })
        ).run().catch(swallow('worker:cron:seller-tier-eval-history'));

        const isUp = TIER_RANK[newTier] > TIER_RANK[oldTier];
        const tierKor: Record<SellerTier, string> = {
          diamond: '💎 다이아몬드', gold: '⭐ 골드', silver: '🥈 실버',
          bronze: '🥉 브론즈', new: '🆕 신규',
        };
        await DB.prepare(`
          INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
          VALUES ('seller', ?, 'tier_change', ?, ?, '/seller', datetime('now'))
        `).bind(
          String(s.id),
          isUp ? `${tierKor[newTier]} 등급 격상! 🎉` : `등급 변경: ${tierKor[oldTier]} → ${tierKor[newTier]}`,
          `최근 30일: GMV ${Math.round(metrics.gmv30d).toLocaleString('ko-KR')}원, ` +
          `CVR ${(cvr * 100).toFixed(1)}%, 재구매율 ${(repurchaseRate * 100).toFixed(0)}%. ` +
          `수수료 ${commissionRate}%, 노출 가중치 ${exposureWeight}× 적용.`,
        ).run().catch(swallow('worker:cron:seller-tier-eval-notif'));

        changed++;
      }
      evaluated++;
    } catch (err) {
      console.error(`[cron:seller-tier-eval] seller ${s.id}:`, err);
    }
  }

  console.info(`[cron:seller-tier-eval] evaluated=${evaluated} changed=${changed}`);
}

// 호환성 export
export const evaluateSellerTier = scoreToTier;
