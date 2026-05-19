/**
 * Seller Onboarding (7일 부트캠프) Routes — Phase 1-5
 *
 * 마운트: /api/seller/onboarding
 *
 * Endpoints:
 *   GET  /                        — 본인 진행률 (7단계 + 자동 평가)
 *   POST /complete/:step_key      — 셀러가 수동 완료 처리 (manual ack)
 *
 * 자동 완료 (수동 호출 없이도 판정):
 *   - profile_complete: 프로필 사진 + 소개 + 주소 모두 채워졌는지
 *   - first_product: products 테이블에 1개 이상
 *   - first_live: live_streams 1개 이상
 *   - first_donation: donations 1개 이상
 *   - first_payment: orders payment_status='approved' 1개 이상
 *   - first_alimtalk: alimtalk_logs 1개 이상 (테이블 없으면 0)
 *   - bootcamp_completed: 위 6개 다 만족 시 자동 부여 + 보상 1만 딜
 *
 * 정책: 강제 X — 안 해도 페널티 없음. 단순 가이드.
 *
 * 마이그레이션 0224 미적용 시 graceful skip.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import type { Env } from '@/worker/types/env';

import { swallow } from '@/worker/utils/swallow';
type SellerCtx = {
  Bindings: Env;
  Variables: { seller: { id: number; email: string } };
};

const app = new Hono<SellerCtx>();

function getBearerToken(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

const requireSeller = async (c: any, next: Next) => {
  const token = getBearerToken(c.req.header('Authorization')) ?? '';
  if (!token) return c.json({ success: false, error: 'unauth' }, 401);
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
    if (payload.type !== 'seller' || !payload.sub) return c.json({ success: false, error: 'unauth' }, 401);
    c.set('seller', { id: Number(payload.sub), email: String(payload.email) });
    return next();
  } catch {
    return c.json({ success: false, error: 'unauth' }, 401);
  }
};

app.use('*', requireSeller);

async function ensureTable(DB: D1Database) {
  if (_done_ensureTable) return
  _done_ensureTable = true
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS seller_onboarding_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      step_key TEXT NOT NULL,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reward_claimed INTEGER DEFAULT 0,
      UNIQUE (seller_id, step_key)
    )
  `).run().catch(swallow('seller:api:seller-onboarding'));
}

const ALL_STEPS = [
  'profile_complete',
  'first_product',
  'first_live',
  'first_donation',
  'first_payment',
  'first_alimtalk',
] as const;

const BOOTCAMP_REWARD_DEAL = 10_000;

interface ProgressRow {
  step_key: string;
  completed_at: string;
  reward_claimed: number;
}

async function autoEvaluate(DB: D1Database, sellerId: number) {
  await ensureTable(DB);

  // 이미 완료된 step 가져오기
  const existing = await DB.prepare(
    `SELECT step_key FROM seller_onboarding_progress WHERE seller_id = ?`
  ).bind(sellerId).all<{ step_key: string }>().catch(() => ({ results: [] as any[] }));
  const completedSet = new Set((existing.results || []).map((r) => r.step_key));

  // 1) profile_complete
  if (!completedSet.has('profile_complete')) {
    const s = await DB.prepare(
      `SELECT profile_image, bio, address FROM sellers WHERE id = ?`
    ).bind(sellerId).first<{ profile_image: string | null; bio: string | null; address: string | null }>().catch(() => null);
    if (s?.profile_image && s?.bio && s?.address) {
      await DB.prepare(
        `INSERT OR IGNORE INTO seller_onboarding_progress (seller_id, step_key) VALUES (?, 'profile_complete')`
      ).bind(sellerId).run().catch(swallow('seller:api:seller-onboarding'));
      completedSet.add('profile_complete');
    }
  }

  // 2) first_product
  if (!completedSet.has('first_product')) {
    const r = await DB.prepare(`SELECT 1 FROM products WHERE seller_id = ? LIMIT 1`)
      .bind(sellerId).first().catch(() => null);
    if (r) {
      await DB.prepare(
        `INSERT OR IGNORE INTO seller_onboarding_progress (seller_id, step_key) VALUES (?, 'first_product')`
      ).bind(sellerId).run().catch(swallow('seller:api:seller-onboarding'));
      completedSet.add('first_product');
    }
  }

  // 3) first_live
  if (!completedSet.has('first_live')) {
    const r = await DB.prepare(`SELECT 1 FROM live_streams WHERE seller_id = ? LIMIT 1`)
      .bind(sellerId).first().catch(() => null);
    if (r) {
      await DB.prepare(
        `INSERT OR IGNORE INTO seller_onboarding_progress (seller_id, step_key) VALUES (?, 'first_live')`
      ).bind(sellerId).run().catch(swallow('seller:api:seller-onboarding'));
      completedSet.add('first_live');
    }
  }

  // 4) first_donation (donations 테이블)
  if (!completedSet.has('first_donation')) {
    const r = await DB.prepare(`SELECT 1 FROM donations WHERE seller_id = ? AND payment_status = 'approved' LIMIT 1`)
      .bind(sellerId).first().catch(() => null);
    if (r) {
      await DB.prepare(
        `INSERT OR IGNORE INTO seller_onboarding_progress (seller_id, step_key) VALUES (?, 'first_donation')`
      ).bind(sellerId).run().catch(swallow('seller:api:seller-onboarding'));
      completedSet.add('first_donation');
    }
  }

  // 5) first_payment
  if (!completedSet.has('first_payment')) {
    const r = await DB.prepare(`SELECT 1 FROM orders WHERE seller_id = ? AND payment_status = 'approved' LIMIT 1`)
      .bind(sellerId).first().catch(() => null);
    if (r) {
      await DB.prepare(
        `INSERT OR IGNORE INTO seller_onboarding_progress (seller_id, step_key) VALUES (?, 'first_payment')`
      ).bind(sellerId).run().catch(swallow('seller:api:seller-onboarding'));
      completedSet.add('first_payment');
    }
  }

  // 6) first_alimtalk (alimtalk_logs 테이블 — 없으면 graceful skip)
  if (!completedSet.has('first_alimtalk')) {
    try {
      const r = await DB.prepare(`SELECT 1 FROM alimtalk_logs WHERE seller_id = ? LIMIT 1`)
        .bind(sellerId).first().catch(() => null);
      if (r) {
        await DB.prepare(
          `INSERT OR IGNORE INTO seller_onboarding_progress (seller_id, step_key) VALUES (?, 'first_alimtalk')`
        ).bind(sellerId).run().catch(swallow('seller:api:seller-onboarding'));
        completedSet.add('first_alimtalk');
      }
    } catch { /* table missing — skip */ }
  }

  // 7) bootcamp_completed (모든 6개 충족 시) + 보상
  const allDone = ALL_STEPS.every((k) => completedSet.has(k));
  if (allDone && !completedSet.has('bootcamp_completed')) {
    await DB.prepare(
      `INSERT OR IGNORE INTO seller_onboarding_progress (seller_id, step_key, reward_claimed) VALUES (?, 'bootcamp_completed', 1)`
    ).bind(sellerId).run().catch(swallow('seller:api:seller-onboarding'));

    // 셀러에게 보상 딜 1만 지급 (user_points 시스템 활용 — 셀러도 user_id 기반으로 매핑되어 있을 경우)
    // 셀러 자체 deal balance 시스템이 있으면 거기에 추가. 없으면 알림만.
    try {
      await DB.prepare(`
        INSERT INTO user_points (user_id, balance, total_charged, total_used)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(user_id) DO UPDATE SET
          balance = balance + ?,
          total_charged = total_charged + ?
      `).bind(sellerId, BOOTCAMP_REWARD_DEAL, BOOTCAMP_REWARD_DEAL, BOOTCAMP_REWARD_DEAL, BOOTCAMP_REWARD_DEAL)
        .run().catch(swallow('seller:api:seller-onboarding'));
    } catch { /* 컬럼 다르면 graceful skip */ }
  }

  return completedSet;
}

// GET / — 본인 부트캠프 진행률
app.get('/', async (c) => {
  const seller = c.get('seller');
  await autoEvaluate(c.env.DB, seller.id);

  const rows = await c.env.DB.prepare(
    `SELECT step_key, completed_at, reward_claimed FROM seller_onboarding_progress WHERE seller_id = ?`
  ).bind(seller.id).all<ProgressRow>().catch(() => ({ results: [] as ProgressRow[] }));

  const completedMap = new Map((rows.results || []).map((r) => [r.step_key, r]));
  const steps = ALL_STEPS.map((key) => ({
    step_key: key,
    completed: completedMap.has(key),
    completed_at: completedMap.get(key)?.completed_at || null,
  }));

  const total = ALL_STEPS.length;
  const done = steps.filter((s) => s.completed).length;

  const bootcampRow = completedMap.get('bootcamp_completed');

  return c.json({
    success: true,
    data: {
      steps,
      progress: { done, total, percent: Math.round((done / total) * 100) },
      bootcamp_completed: !!bootcampRow,
      bootcamp_completed_at: bootcampRow?.completed_at || null,
      reward_deal: BOOTCAMP_REWARD_DEAL,
      reward_claimed: bootcampRow?.reward_claimed === 1,
    },
  });
});

// POST /complete/:step_key — 셀러 수동 완료 (예: 알림톡 발송 후 직접 ack)
app.post('/complete/:step_key', async (c) => {
  const seller = c.get('seller');
  const step = c.req.param('step_key');
  if (!ALL_STEPS.includes(step as any)) {
    return c.json({ success: false, error: 'invalid step' }, 400);
  }
  await ensureTable(c.env.DB);
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO seller_onboarding_progress (seller_id, step_key) VALUES (?, ?)`
  ).bind(seller.id, step).run().catch(swallow('seller:api:seller-onboarding'));
  await autoEvaluate(c.env.DB, seller.id);
  return c.json({ success: true });
});

export { app as sellerOnboardingRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTable = false
