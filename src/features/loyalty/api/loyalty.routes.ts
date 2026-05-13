/**
 * VIP Tier System API (User Loyalty)
 *
 * GET  /api/loyalty/tiers         - Public: list all tier info (thresholds, benefits)
 * GET  /api/loyalty/my-tier       - Get current user's tier info (auth required)
 * POST /api/loyalty/recalculate   - Recalculate tier after purchase/charge (auth required)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
const loyaltyRoutes = new Hono<{ Bindings: Env }>();

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// ── Ensure tables ──────────────────────────────────────────────

async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS user_tiers (
        user_id TEXT PRIMARY KEY,
        tier TEXT DEFAULT 'bronze' CHECK(tier IN ('bronze','silver','gold','diamond')),
        total_spent INTEGER DEFAULT 0,
        total_charged INTEGER DEFAULT 0,
        extra_discount_percent REAL DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* already exists */ }
}

// ── Tier threshold helpers ─────────────────────────────────────

interface TierThresholds {
  silver_threshold: number;
  gold_threshold: number;
  diamond_threshold: number;
  silver_discount: number;
  gold_discount: number;
  diamond_discount: number;
}

const DEFAULT_THRESHOLDS: TierThresholds = {
  silver_threshold: 50000,
  gold_threshold: 200000,
  diamond_threshold: 500000,
  silver_discount: 2,
  gold_discount: 5,
  diamond_discount: 10,
};

async function getThresholds(DB: D1Database): Promise<TierThresholds> {
  const thresholds = { ...DEFAULT_THRESHOLDS };

  try {
    const { results } = await DB.prepare(
      `SELECT key, value FROM platform_settings WHERE key IN (
        'tier_silver_threshold', 'tier_gold_threshold', 'tier_diamond_threshold',
        'tier_silver_discount', 'tier_gold_discount', 'tier_diamond_discount'
      )`
    ).all<{ key: string; value: string }>();

    for (const row of results ?? []) {
      const num = parseFloat(row.value);
      if (isNaN(num)) continue;
      switch (row.key) {
        case 'tier_silver_threshold': thresholds.silver_threshold = num; break;
        case 'tier_gold_threshold': thresholds.gold_threshold = num; break;
        case 'tier_diamond_threshold': thresholds.diamond_threshold = num; break;
        case 'tier_silver_discount': thresholds.silver_discount = num; break;
        case 'tier_gold_discount': thresholds.gold_discount = num; break;
        case 'tier_diamond_discount': thresholds.diamond_discount = num; break;
      }
    }
  } catch {
    // platform_settings table may not exist — use defaults
  }

  return thresholds;
}

function calculateTier(totalCharged: number, t: TierThresholds): { tier: string; discount: number } {
  if (totalCharged >= t.diamond_threshold) return { tier: 'diamond', discount: t.diamond_discount };
  if (totalCharged >= t.gold_threshold) return { tier: 'gold', discount: t.gold_discount };
  if (totalCharged >= t.silver_threshold) return { tier: 'silver', discount: t.silver_discount };
  return { tier: 'bronze', discount: 0 };
}

function getNextTierInfo(
  currentTier: string,
  totalCharged: number,
  t: TierThresholds
): { name: string; threshold: number; discount: number; remaining: number } | null {
  switch (currentTier) {
    case 'bronze':
      return {
        name: 'silver',
        threshold: t.silver_threshold,
        discount: t.silver_discount,
        remaining: t.silver_threshold - totalCharged,
      };
    case 'silver':
      return {
        name: 'gold',
        threshold: t.gold_threshold,
        discount: t.gold_discount,
        remaining: t.gold_threshold - totalCharged,
      };
    case 'gold':
      return {
        name: 'diamond',
        threshold: t.diamond_threshold,
        discount: t.diamond_discount,
        remaining: t.diamond_threshold - totalCharged,
      };
    case 'diamond':
      return null; // already top tier
    default:
      return null;
  }
}

// ── GET /api/loyalty/tiers — Public: list all tier info ────────

loyaltyRoutes.get('/tiers', async (c) => {
  const { DB } = c.env;
  const t = await getThresholds(DB);

  return c.json({
    success: true,
    data: [
      { tier: 'bronze', threshold: 0, extra_discount: 0, label: 'Bronze' },
      { tier: 'silver', threshold: t.silver_threshold, extra_discount: t.silver_discount, label: 'Silver' },
      { tier: 'gold', threshold: t.gold_threshold, extra_discount: t.gold_discount, label: 'Gold' },
      { tier: 'diamond', threshold: t.diamond_threshold, extra_discount: t.diamond_discount, label: 'Diamond' },
    ],
  });
});

// ── GET /api/loyalty/my-tier — Current user's tier info ────────

loyaltyRoutes.get('/my-tier', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);
  const t = await getThresholds(DB);

  // Auto-create record if not exists
  let record = await DB.prepare(
    'SELECT user_id, tier, total_spent, total_charged, extra_discount_percent, updated_at FROM user_tiers WHERE user_id = ?'
  ).bind(userId).first<{
    user_id: string;
    tier: string;
    total_spent: number;
    total_charged: number;
    extra_discount_percent: number;
    updated_at: string;
  }>();

  if (!record) {
    await DB.prepare(
      `INSERT INTO user_tiers (user_id, tier, total_spent, total_charged, extra_discount_percent)
       VALUES (?, 'bronze', 0, 0, 0)`
    ).bind(userId).run();

    record = {
      user_id: userId,
      tier: 'bronze',
      total_spent: 0,
      total_charged: 0,
      extra_discount_percent: 0,
      updated_at: new Date().toISOString(),
    };
  }

  // Auto-recalculate tier based on total_charged
  const { tier, discount } = calculateTier(record.total_charged, t);

  if (tier !== record.tier || discount !== record.extra_discount_percent) {
    await DB.prepare(
      `UPDATE user_tiers SET tier = ?, extra_discount_percent = ?, updated_at = datetime('now') WHERE user_id = ?`
    ).bind(tier, discount, userId).run();
    record.tier = tier;
    record.extra_discount_percent = discount;
  }

  const nextTier = getNextTierInfo(record.tier, record.total_charged, t);

  return c.json({
    success: true,
    data: {
      tier: record.tier,
      total_spent: record.total_spent,
      total_charged: record.total_charged,
      extra_discount_percent: record.extra_discount_percent,
      updated_at: record.updated_at,
      next_tier_info: nextTier,
    },
  });
});

// ── POST /api/loyalty/recalculate — Recalculate tier ───────────

loyaltyRoutes.post('/recalculate', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);

  const { DB } = c.env;
  await ensureTables(DB);

  const userId = String(user.id);
  const t = await getThresholds(DB);

  // Ensure record exists
  let record = await DB.prepare(
    'SELECT total_charged FROM user_tiers WHERE user_id = ?'
  ).bind(userId).first<{ total_charged: number }>();

  if (!record) {
    await DB.prepare(
      `INSERT INTO user_tiers (user_id, tier, total_spent, total_charged, extra_discount_percent)
       VALUES (?, 'bronze', 0, 0, 0)`
    ).bind(userId).run();
    record = { total_charged: 0 };
  }

  const { tier, discount } = calculateTier(record.total_charged, t);

  await DB.prepare(
    `UPDATE user_tiers SET tier = ?, extra_discount_percent = ?, updated_at = datetime('now') WHERE user_id = ?`
  ).bind(tier, discount, userId).run();

  const nextTier = getNextTierInfo(tier, record.total_charged, t);

  return c.json({
    success: true,
    data: {
      tier,
      total_charged: record.total_charged,
      extra_discount_percent: discount,
      next_tier_info: nextTier,
    },
    message: `Tier recalculated: ${tier}`,
  });
});

export { loyaltyRoutes };
