/**
 * Seller Tier Auto Evaluation — 셀러 등급 자동 평가 (브론즈/실버/골드)
 *
 * 매월 1일 weekly batch 합류 (KST 09:00 월요일 첫주). 멱등.
 *
 * 정책 (느슨, 강제 패널티 X — 단순 분류):
 *   bronze: 가입 30일 이내 OR 전월 매출 50만 이하
 *   silver: 가입 30일+ AND 전월 매출 50만~500만 (또는 활성 라이브 4회+)
 *   gold:   전월 매출 500만+ AND 평균 별점 4.0+
 *
 * 결과:
 *   - sellers.tier 갱신
 *   - 등급 변경 시 셀러에게 알림
 *
 * 마이그레이션 미적용 시 graceful skip (try/catch).
 */

import type { Env } from '../types/env';

import { swallow } from '../utils/swallow';
type Tier = 'bronze' | 'silver' | 'gold';

const SILVER_REVENUE_MIN = 500_000;
const GOLD_REVENUE_MIN = 5_000_000;
const SILVER_AGE_DAYS_MIN = 30;
const GOLD_RATING_MIN = 4.0;
const SILVER_LIVE_COUNT_MIN = 4;

function evaluateSellerTier(opts: {
  daysSinceCreated: number;
  monthlyRevenue: number;
  liveCount: number;
  avgRating: number;
}): Tier {
  if (opts.monthlyRevenue >= GOLD_REVENUE_MIN && opts.avgRating >= GOLD_RATING_MIN) {
    return 'gold';
  }
  if (opts.daysSinceCreated >= SILVER_AGE_DAYS_MIN &&
      (opts.monthlyRevenue >= SILVER_REVENUE_MIN || opts.liveCount >= SILVER_LIVE_COUNT_MIN)) {
    return 'silver';
  }
  return 'bronze';
}

// 단위 테스트용 export
export { evaluateSellerTier };

export async function handleSellerTierEval(env: Env): Promise<void> {
  const DB = env.DB;
  if (!DB) return;

  // sellers.tier 컬럼 보장 (idempotent)
  await DB.prepare(`ALTER TABLE sellers ADD COLUMN tier TEXT DEFAULT 'bronze'`).run().catch(swallow('worker:cron:seller-tier-eval'));

  const sellers = await DB.prepare(`
    SELECT id, status, created_at, COALESCE(tier, 'bronze') AS tier
    FROM sellers WHERE status = 'active'
  `).all<{ id: number; status: string; created_at: string; tier: string }>().catch(() => ({ results: [] as any[] }));

  if (!sellers.results?.length) return;

  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  let evaluated = 0;
  let changed = 0;

  for (const s of sellers.results) {
    try {
      const createdAt = new Date(s.created_at);
      const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / 86400_000);

      // 전월 매출
      const revRow = await DB.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) AS rev FROM orders
        WHERE seller_id = ? AND payment_status = 'approved'
          AND created_at >= ? AND created_at <= ?
      `).bind(s.id, prevMonth.toISOString(), prevMonthEnd.toISOString())
        .first<{ rev: number }>().catch(() => null);
      const monthlyRevenue = revRow?.rev ?? 0;

      // 전월 라이브 횟수
      const liveRow = await DB.prepare(`
        SELECT COUNT(*) AS cnt FROM live_streams
        WHERE seller_id = ?
          AND created_at >= ? AND created_at <= ?
      `).bind(s.id, prevMonth.toISOString(), prevMonthEnd.toISOString())
        .first<{ cnt: number }>().catch(() => null);
      const liveCount = liveRow?.cnt ?? 0;

      // 평균 별점 (sellers.avg_rating 또는 product_reviews 집계)
      let avgRating = 0;
      try {
        const r = await DB.prepare(`
          SELECT COALESCE(AVG(rating), 0) AS avg_r
          FROM product_reviews pr
          JOIN products p ON p.id = pr.product_id
          WHERE p.seller_id = ?
        `).bind(s.id).first<{ avg_r: number }>().catch(() => null);
        avgRating = r?.avg_r ?? 0;
      } catch { /* skip */ }

      const newTier = evaluateSellerTier({ daysSinceCreated, monthlyRevenue, liveCount, avgRating });
      const oldTier = (s.tier || 'bronze') as Tier;

      if (newTier !== oldTier) {
        await DB.prepare(`UPDATE sellers SET tier = ? WHERE id = ?`)
          .bind(newTier, s.id).run().catch(swallow('worker:cron:seller-tier-eval'));

        // 셀러에게 알림
        const direction = ['bronze', 'silver', 'gold'].indexOf(newTier) >
                          ['bronze', 'silver', 'gold'].indexOf(oldTier) ? '⬆️' : '⬇️';
        const tierKor: Record<Tier, string> = { bronze: '브론즈', silver: '실버', gold: '골드' };
        await DB.prepare(`
          INSERT INTO dashboard_notifications (user_type, user_id, type, title, message, link, created_at)
          VALUES ('seller', ?, 'tier_change', ?, ?, '/seller', datetime('now'))
        `).bind(
          String(s.id),
          `${direction} 등급 변경: ${tierKor[oldTier]} → ${tierKor[newTier]}`,
          `전월 매출 ${monthlyRevenue.toLocaleString()}원, 라이브 ${liveCount}회 기준 등급이 갱신됐어요.`,
        ).run().catch(swallow('worker:cron:seller-tier-eval'));

        changed++;
      }
      evaluated++;
    } catch (err) {
      console.error(`[cron:seller-tier-eval] seller ${s.id}:`, err);
    }
  }

  console.info(`[cron:seller-tier-eval] evaluated=${evaluated} changed=${changed}`);
}
