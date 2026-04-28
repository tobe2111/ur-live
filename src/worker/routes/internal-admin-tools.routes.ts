/**
 * Internal Admin Tools Routes
 *
 * 운영자가 응급 schema/계정 복구를 위한 endpoint.
 *
 *   POST /api/_bootstrap/reset-dashboard-password (BOOTSTRAP_TOKEN 헤더)
 *   POST /api/_internal/clear-rate-limit         (INTERNAL_API_TOKEN 헤더)
 *   POST /api/_internal/reset-admin-password    (INTERNAL_API_TOKEN 헤더)
 *   GET  /api/_internal/repair-new-tables       (admin)
 *   GET  /api/admin/optimize-db                 (admin)
 *
 * 🛡️ 2026-04-27: TD-006 Phase C — worker/index.ts 인라인 핸들러 분리.
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '../middleware/auth';
import { hashPassword } from '@/lib/password';

const internalAdminToolsRoutes = new Hono<{ Bindings: Env }>();

internalAdminToolsRoutes.post('/api/_bootstrap/reset-dashboard-password', async (c) => {
  const expected = (c.env as any).BOOTSTRAP_TOKEN as string | undefined;
  const provided = c.req.header('X-Bootstrap-Token');

  // BOOTSTRAP_TOKEN 미세팅 or 헤더 불일치 → 404 (엔드포인트 존재 감추기)
  if (!expected || !provided || expected !== provided) {
    return c.json({ success: false, error: 'Not Found' }, 404);
  }

  let body: { email?: string; password?: string; role?: string } = {};
  try { body = await c.req.json(); } catch { body = {}; }
  const { email, password, role = 'all' } = body;

  if (!email || !password) {
    return c.json({ success: false, error: 'email, password 필수' }, 400);
  }
  if (password.length < 6) {
    return c.json({ success: false, error: '비밀번호 6자 이상' }, 400);
  }

  // 서버 자체의 hashPassword() 사용 → verifyPassword 와 100% 호환 (top-level import)
  const hash = await hashPassword(password);

  const DB = c.env.DB;
  const results: Record<string, { updated: number; status?: string }> = {};

  const targets = role === 'all' ? ['admins', 'sellers', 'agencies'] : [`${role}s`];

  for (const table of targets) {
    try {
      const activeValue = table === 'sellers' ? 'approved' : 'active';
      const sql = table === 'sellers'
        ? `UPDATE ${table} SET password_hash = ?, status = ?, is_active = 1 WHERE email = ?`
        : `UPDATE ${table} SET password_hash = ?, status = ? WHERE email = ?`;
      const res = await DB.prepare(sql).bind(hash, activeValue, email).run();
      results[table] = { updated: res.meta.changes ?? 0, status: activeValue };
    } catch (e: any) {
      results[table] = { updated: 0, status: `ERROR: ${e.message}` };
    }
  }

  try { await DB.prepare("DELETE FROM account_lockouts").run(); } catch {}

  return c.json({ success: true, results, hashLength: hash.length });
});

internalAdminToolsRoutes.post('/api/_internal/clear-rate-limit', async (c) => {
  const env = c.env as any;
  const opsToken: string | undefined = env.INTERNAL_API_TOKEN;
  const reqToken = c.req.header('X-Internal-Token');
  if (!opsToken || opsToken !== reqToken) return c.json({ success: false, error: 'Forbidden' }, 403);
  const DB = env.DB as D1Database;
  const body = await c.req.json<{ action?: string; ip?: string }>().catch(() => ({} as { action?: string; ip?: string }));
  const action = body.action || 'admin_login';
  if (body.ip) {
    await DB.prepare('DELETE FROM rate_limit_attempts WHERE key = ? AND action = ?')
      .bind(`${action}:${body.ip}`, action).run();
  } else {
    await DB.prepare('DELETE FROM rate_limit_attempts WHERE action = ?').bind(action).run();
  }
  return c.json({ success: true, message: `Rate limit cleared for action: ${action}` });
});

internalAdminToolsRoutes.post('/api/_internal/reset-admin-password', async (c) => {
  const env = c.env as any;
  const opsToken: string | undefined = env.INTERNAL_API_TOKEN;
  const reqToken = c.req.header('X-Internal-Token');
  if (!opsToken || opsToken !== reqToken) return c.json({ success: false, error: 'Forbidden' }, 403);
  const DB = env.DB as D1Database;
  const body = await c.req.json<{ email: string; newPassword: string }>().catch(() => ({ email: '', newPassword: '' }));
  if (!body.email || !body.newPassword) return c.json({ success: false, error: 'email and newPassword required' }, 400);
  const hash = await hashPassword(body.newPassword);
  const result = await DB.prepare('UPDATE admins SET password_hash = ? WHERE email = ?')
    .bind(hash, body.email).run();
  if ((result.meta as any).changes === 0) return c.json({ success: false, error: 'Admin not found' }, 404);
  return c.json({ success: true, message: 'Password reset successful. Login with the new password.' });
});

// 🛡️ 2026-04-27: 신규 마이그레이션 0207~0230 테이블 일괄 생성 (admin 전용).
// repair-schema 가 ALTER (컬럼 추가) 만 처리하므로, CREATE TABLE 신규 테이블은 본 endpoint 로 생성.
// 멱등 (CREATE TABLE IF NOT EXISTS).
internalAdminToolsRoutes.get('/api/_internal/repair-new-tables', requireAdmin(), async (c) => {
  const env = c.env as any;
  const DB = env.DB as D1Database;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);

  const stmts: Array<{ desc: string; sql: string }> = [
    // ── 0207: agency_creator_approvals ──────
    { desc: '0207: agency_creator_approvals', sql: `
      CREATE TABLE IF NOT EXISTS agency_creator_approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        score INTEGER DEFAULT 0,
        evaluated_at DATETIME,
        approved_at DATETIME,
        rejected_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (agency_id, seller_id)
      )` },

    // ── 0208: agency_auto_settle_log ────────
    { desc: '0208: agency_auto_settle_log', sql: `
      CREATE TABLE IF NOT EXISTS agency_auto_settle_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        settlement_id INTEGER,
        amount INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT
      )` },

    // ── 0209: agency_campaigns ──────────────
    { desc: '0209: agency_campaigns', sql: `
      CREATE TABLE IF NOT EXISTS agency_campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        base_incentive_rate REAL DEFAULT 0,
        target_amount INTEGER DEFAULT 0,
        category TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0209: agency_campaign_sellers', sql: `
      CREATE TABLE IF NOT EXISTS agency_campaign_sellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        target_amount INTEGER DEFAULT 0,
        bonus_rate REAL DEFAULT 0,
        achieved_amount INTEGER DEFAULT 0,
        UNIQUE (campaign_id, seller_id)
      )` },

    // ── 0210: agency_incentive_rules ────────
    { desc: '0210: agency_incentive_rules', sql: `
      CREATE TABLE IF NOT EXISTS agency_incentive_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        metric TEXT NOT NULL,
        threshold INTEGER NOT NULL,
        bonus_rate REAL NOT NULL,
        is_active INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0211: auction_winner_history ────────
    { desc: '0211: auction_winner_history', sql: `
      CREATE TABLE IF NOT EXISTS auction_winner_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auction_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT DEFAULT 'won',
        forfeit_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0212: agency_tier_log ───────────────
    { desc: '0212: agency_tier_log', sql: `
      CREATE TABLE IF NOT EXISTS agency_tier_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        from_tier TEXT,
        to_tier TEXT NOT NULL,
        reason TEXT,
        evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0212: agencies.tier', sql: `ALTER TABLE agencies ADD COLUMN tier TEXT DEFAULT 'new'` },
    { desc: '0212: agencies.tier_evaluated_at', sql: `ALTER TABLE agencies ADD COLUMN tier_evaluated_at DATETIME` },
    { desc: '0212: agencies.tier_locked', sql: `ALTER TABLE agencies ADD COLUMN tier_locked INTEGER DEFAULT 0` },

    // ── 정산 계좌 컬럼 (GET /api/agency/profile 이 SELECT 하므로 필수) ──
    { desc: 'agencies.bank_name', sql: `ALTER TABLE agencies ADD COLUMN bank_name TEXT` },
    { desc: 'agencies.bank_account', sql: `ALTER TABLE agencies ADD COLUMN bank_account TEXT` },
    { desc: 'agencies.account_holder', sql: `ALTER TABLE agencies ADD COLUMN account_holder TEXT` },

    // ── 0213: agency_creator_evaluations ────
    { desc: '0213: agency_creator_evaluations', sql: `
      CREATE TABLE IF NOT EXISTS agency_creator_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        score INTEGER DEFAULT 0,
        criteria TEXT,
        evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0214: agency_message_templates ──────
    { desc: '0214: agency_message_templates', sql: `
      CREATE TABLE IF NOT EXISTS agency_message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT,
        is_active INTEGER DEFAULT 1,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0215: agency_monthly_tasks ──────────
    { desc: '0215: agency_monthly_tasks', sql: `
      CREATE TABLE IF NOT EXISTS agency_monthly_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        task_type TEXT NOT NULL,
        target INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (agency_id, month, task_type)
      )` },

    // ── 0216: coupons_agency_distribution ───
    { desc: '0216: coupons_agency_distribution', sql: `
      CREATE TABLE IF NOT EXISTS coupons_agency_distribution (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coupon_id INTEGER NOT NULL,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER,
        quantity INTEGER DEFAULT 1,
        used_count INTEGER DEFAULT 0,
        distributed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0217: agency_members ────────────────
    { desc: '0217: agency_members', sql: `
      CREATE TABLE IF NOT EXISTS agency_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        user_id INTEGER,
        role TEXT DEFAULT 'agent',
        permissions TEXT,
        status TEXT DEFAULT 'invited',
        invite_token TEXT,
        invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        joined_at DATETIME,
        UNIQUE (agency_id, email)
      )` },

    // ── 0218: agency_live_notes ─────────────
    { desc: '0218: agency_live_notes', sql: `
      CREATE TABLE IF NOT EXISTS agency_live_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        live_stream_id INTEGER,
        seller_id INTEGER,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'general',
        visible_to_seller INTEGER DEFAULT 0,
        created_by_email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0219: settlement_invoices ───────────
    { desc: '0219: settlement_invoices', sql: `
      CREATE TABLE IF NOT EXISTS settlement_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        total_amount INTEGER DEFAULT 0,
        commission_amount INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        html_content TEXT,
        issued_at DATETIME,
        paid_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (agency_id, month)
      )` },

    // ── 0220: seller_platform_links ─────────
    { desc: '0220: seller_platform_links', sql: `
      CREATE TABLE IF NOT EXISTS seller_platform_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        external_id TEXT,
        access_token TEXT,
        refresh_token TEXT,
        expires_at DATETIME,
        connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (seller_id, platform)
      )` },

    // ── 0221: tiktok_videos_cache ───────────
    { desc: '0221: tiktok_videos_cache', sql: `
      CREATE TABLE IF NOT EXISTS tiktok_videos_cache (
        video_id TEXT PRIMARY KEY,
        seller_id INTEGER NOT NULL,
        title TEXT,
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        cover_image_url TEXT,
        embed_link TEXT,
        created_time DATETIME,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0222: agency_aux_tables (notifications/contracts/settlements/seller_targets) ──
    { desc: '0222: agency_notifications', sql: `
      CREATE TABLE IF NOT EXISTS agency_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0222: agency_contracts', sql: `
      CREATE TABLE IF NOT EXISTS agency_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        start_date DATE,
        end_date DATE,
        terms TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0222: agency_settlements', sql: `
      CREATE TABLE IF NOT EXISTS agency_settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        total_orders INTEGER NOT NULL DEFAULT 0,
        total_amount INTEGER NOT NULL DEFAULT 0,
        commission_rate REAL NOT NULL DEFAULT 2.0,
        commission_amount INTEGER NOT NULL DEFAULT 0,
        bank_name TEXT,
        bank_account TEXT,
        account_holder TEXT,
        status TEXT DEFAULT 'pending',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        settled_at DATETIME
      )` },
    { desc: '0222: agency_seller_targets', sql: `
      CREATE TABLE IF NOT EXISTS agency_seller_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        target_amount INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (agency_id, seller_id, month)
      )` },

    // ── 0223: agency_invite_codes ───────────
    { desc: '0223: agency_invite_codes', sql: `
      CREATE TABLE IF NOT EXISTS agency_invite_codes (
        code TEXT PRIMARY KEY,
        agency_id INTEGER NOT NULL,
        label TEXT,
        max_uses INTEGER DEFAULT 100,
        used_count INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by_email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )` },
    { desc: '0223: agency_invite_usage', sql: `
      CREATE TABLE IF NOT EXISTS agency_invite_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0224: seller_onboarding_progress ────
    { desc: '0224: seller_onboarding_progress', sql: `
      CREATE TABLE IF NOT EXISTS seller_onboarding_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        step_key TEXT NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reward_claimed INTEGER DEFAULT 0,
        UNIQUE (seller_id, step_key)
      )` },

    // ── 0225: agency public profile columns ─
    { desc: '0225: agencies.slug', sql: `ALTER TABLE agencies ADD COLUMN slug TEXT` },
    { desc: '0225: agencies.bio', sql: `ALTER TABLE agencies ADD COLUMN bio TEXT` },
    { desc: '0225: agencies.logo_url', sql: `ALTER TABLE agencies ADD COLUMN logo_url TEXT` },
    { desc: '0225: agencies.cover_url', sql: `ALTER TABLE agencies ADD COLUMN cover_url TEXT` },
    { desc: '0225: agencies.public_show_revenue', sql: `ALTER TABLE agencies ADD COLUMN public_show_revenue INTEGER DEFAULT 0` },
    { desc: '0225: agencies.public_show_sellers', sql: `ALTER TABLE agencies ADD COLUMN public_show_sellers INTEGER DEFAULT 1` },

    // ── 0226: live_stream_metrics ───────────
    { desc: '0226: live_stream_metrics', sql: `
      CREATE TABLE IF NOT EXISTS live_stream_metrics (
        live_stream_id INTEGER PRIMARY KEY,
        seller_id INTEGER NOT NULL,
        peak_viewers INTEGER DEFAULT 0,
        avg_viewers INTEGER DEFAULT 0,
        total_revenue INTEGER DEFAULT 0,
        total_donations INTEGER DEFAULT 0,
        chat_count INTEGER DEFAULT 0,
        new_followers INTEGER DEFAULT 0,
        duration_seconds INTEGER DEFAULT 0,
        computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0227: donation_boosters ─────────────
    { desc: '0227: donation_boosters', sql: `
      CREATE TABLE IF NOT EXISTS donation_boosters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        live_stream_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        multiplier REAL NOT NULL DEFAULT 2.0,
        duration_seconds INTEGER NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ends_at DATETIME NOT NULL,
        total_donation_amount INTEGER DEFAULT 0,
        total_matched_amount INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active'
      )` },

    // ── 0228: pk_battles ────────────────────
    { desc: '0228: pk_battles', sql: `
      CREATE TABLE IF NOT EXISTS pk_battles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER,
        seller_a_id INTEGER NOT NULL,
        seller_b_id INTEGER NOT NULL,
        live_a_id INTEGER,
        live_b_id INTEGER,
        duration_minutes INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        started_at DATETIME,
        ends_at DATETIME,
        revenue_a INTEGER DEFAULT 0,
        revenue_b INTEGER DEFAULT 0,
        winner_seller_id INTEGER,
        winner_reward_deal INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0229: seller_transfer_requests ──────
    { desc: '0229: seller_transfer_requests', sql: `
      CREATE TABLE IF NOT EXISTS seller_transfer_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        from_agency_id INTEGER NOT NULL,
        to_agency_id INTEGER NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        to_response_at DATETIME,
        to_response TEXT,
        seller_response_at DATETIME,
        seller_response TEXT,
        completed_at DATETIME,
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    // ── 0230: casting marketplace ───────────
    { desc: '0230: advertisers', sql: `
      CREATE TABLE IF NOT EXISTS advertisers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        contact_name TEXT,
        phone TEXT,
        business_number TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    // ── 0231: agency_self_events (매출 챌린지) ──
    { desc: '0231: agency_self_events', sql: `
      CREATE TABLE IF NOT EXISTS agency_self_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        metric TEXT NOT NULL,
        target_value INTEGER NOT NULL,
        reward_deal INTEGER NOT NULL DEFAULT 0,
        max_winners INTEGER DEFAULT 100,
        status TEXT DEFAULT 'active',
        created_by_email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0231: agency_self_event_participants', sql: `
      CREATE TABLE IF NOT EXISTS agency_self_event_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        current_value INTEGER DEFAULT 0,
        achieved INTEGER DEFAULT 0,
        achieved_at DATETIME,
        reward_paid INTEGER DEFAULT 0,
        UNIQUE (event_id, seller_id)
      )` },

    // ── 0232: promote_boost_coupons (Promote to Live) ──
    { desc: '0232: promote_boost_coupons', sql: `
      CREATE TABLE IF NOT EXISTS promote_boost_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        tier TEXT NOT NULL DEFAULT 'silver',
        duration_hours INTEGER NOT NULL,
        status TEXT DEFAULT 'unused',
        issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        used_at DATETIME,
        used_live_id INTEGER,
        boost_ends_at DATETIME,
        note TEXT
      )` },

    // ── 0233: 셀러 등급 + 일일 리포트 토글 컬럼 ──
    { desc: 'sellers.tier', sql: `ALTER TABLE sellers ADD COLUMN tier TEXT DEFAULT 'bronze'` },
    { desc: 'sellers.daily_report_enabled', sql: `ALTER TABLE sellers ADD COLUMN daily_report_enabled INTEGER DEFAULT 0` },

    // ── live_notify_log (라이브 시작 알림 멱등) ──
    { desc: 'live_notify_log', sql: `
      CREATE TABLE IF NOT EXISTS live_notify_log (
        live_stream_id INTEGER PRIMARY KEY,
        seller_id INTEGER NOT NULL,
        notified_count INTEGER DEFAULT 0,
        notified_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },

    { desc: '0230: casting_requests', sql: `
      CREATE TABLE IF NOT EXISTS casting_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        advertiser_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        campaign_title TEXT NOT NULL,
        campaign_brief TEXT,
        product_category TEXT,
        proposed_fee INTEGER NOT NULL,
        expected_revenue INTEGER,
        proposed_live_date DATE,
        status TEXT DEFAULT 'pending',
        admin_review_at DATETIME,
        seller_response_at DATETIME,
        seller_response TEXT,
        rejection_reason TEXT,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
  ];

  const results: Array<{ desc: string; status: string; error?: string }> = [];
  for (const { desc, sql } of stmts) {
    try {
      await DB.prepare(sql).run();
      results.push({ desc, status: 'ok' });
    } catch (e) {
      const errMsg = (e as Error).message;
      // ALTER 의 "duplicate column" 은 이미 있는 거라 ok
      if (/duplicate column|already exists/i.test(errMsg)) {
        results.push({ desc, status: 'exists' });
      } else {
        results.push({ desc, status: 'error', error: errMsg });
      }
    }
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const exists = results.filter(r => r.status === 'exists').length;
  const errors = results.filter(r => r.status === 'error').length;

  return c.json({
    success: true,
    summary: { total: results.length, ok, exists, errors },
    results,
  });
});

// ============================================================
// Database Index Optimization (admin only)
// Creates indexes on frequently queried columns for faster lookups
// ============================================================
internalAdminToolsRoutes.get('/api/admin/optimize-db', requireAdmin(), async (c) => {
  const env = c.env as Env;
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
    'CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status)',
    'CREATE INDEX IF NOT EXISTS idx_vouchers_user_id ON vouchers(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_referral_tree_parent ON referral_tree(parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_referral_commissions_beneficiary ON referral_commissions(beneficiary_id)',
  ];

  let created = 0;
  const errors: string[] = [];

  for (const sql of indexes) {
    try {
      await env.DB.prepare(sql).run();
      created++;
    } catch (e) {
      errors.push(`${sql}: ${(e as Error).message}`);
    }
  }

  return c.json({
    success: true,
    indexes_created: created,
    total: indexes.length,
    ...(errors.length > 0 ? { errors } : {}),
  });
});

export { internalAdminToolsRoutes };
