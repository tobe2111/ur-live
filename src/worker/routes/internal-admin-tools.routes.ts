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
import { rateLimit } from '../middleware/rate-limit';

const internalAdminToolsRoutes = new Hono<{ Bindings: Env }>();

internalAdminToolsRoutes.post('/api/_bootstrap/reset-dashboard-password', rateLimit({ action: 'bootstrap_reset_password', max: 5, windowSec: 3600 }), async (c) => {
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

internalAdminToolsRoutes.post('/api/_internal/clear-rate-limit', rateLimit({ action: 'internal_clear_ratelimit', max: 20, windowSec: 3600 }), async (c) => {
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

internalAdminToolsRoutes.post('/api/_internal/reset-admin-password', rateLimit({ action: 'internal_reset_admin_password', max: 5, windowSec: 3600 }), async (c) => {
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

    // ── 0244: 셀러 자동 등급화 (tier_score / exposure_weight / tier_updated_at + 이력 + 광고 입찰) ──
    { desc: '0244: sellers.tier_score', sql: `ALTER TABLE sellers ADD COLUMN tier_score REAL DEFAULT 0` },
    { desc: '0244: sellers.tier_updated_at', sql: `ALTER TABLE sellers ADD COLUMN tier_updated_at DATETIME` },
    { desc: '0244: sellers.exposure_weight', sql: `ALTER TABLE sellers ADD COLUMN exposure_weight REAL DEFAULT 1.0` },
    { desc: '0244: seller_tier_history', sql: `
      CREATE TABLE IF NOT EXISTS seller_tier_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        prev_tier TEXT,
        new_tier TEXT,
        prev_score REAL,
        new_score REAL,
        metrics_json TEXT,
        changed_at DATETIME DEFAULT (datetime('now'))
      )` },
    { desc: '0244: idx_tier_history_seller', sql: `CREATE INDEX IF NOT EXISTS idx_tier_history_seller ON seller_tier_history(seller_id, changed_at DESC)` },
    { desc: '0244: ad_slots', sql: `
      CREATE TABLE IF NOT EXISTS ad_slots (
        slot_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        description TEXT,
        base_price INTEGER NOT NULL DEFAULT 50000,
        current_seller_id INTEGER,
        current_bid INTEGER,
        starts_at DATETIME,
        expires_at DATETIME,
        auto_renew INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
      )` },
    { desc: '0244: idx_ad_slots_active_expires', sql: `CREATE INDEX IF NOT EXISTS idx_ad_slots_active_expires ON ad_slots(is_active, expires_at)` },
    { desc: '0244: ad_bids', sql: `
      CREATE TABLE IF NOT EXISTS ad_bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_id TEXT NOT NULL,
        seller_id INTEGER NOT NULL,
        bid_amount INTEGER NOT NULL CHECK(bid_amount > 0),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','won','lost','cancelled','refunded')),
        start_period DATETIME,
        end_period DATETIME,
        payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','approved','failed')),
        toss_payment_key TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
      )` },
    { desc: '0244: idx_ad_bids_slot_status', sql: `CREATE INDEX IF NOT EXISTS idx_ad_bids_slot_status ON ad_bids(slot_id, status, bid_amount DESC)` },
    { desc: '0244: idx_ad_bids_seller', sql: `CREATE INDEX IF NOT EXISTS idx_ad_bids_seller ON ad_bids(seller_id, created_at DESC)` },
    { desc: '0244: ad_slots seed', sql: `INSERT OR IGNORE INTO ad_slots (slot_id, display_name, description, base_price) VALUES
      ('main_hero', '메인 hero 영역', '메인 홈 최상단 24시간 노출', 100000),
      ('category_top_1', '카테고리 상위 1', '카테고리 첫 번째 슬롯 (24시간)', 50000),
      ('live_recommend_1', '라이브 추천 1', '라이브 페이지 추천 1순위', 80000),
      ('live_recommend_2', '라이브 추천 2', '라이브 페이지 추천 2순위', 50000),
      ('live_recommend_3', '라이브 추천 3', '라이브 페이지 추천 3순위', 30000)` },
    { desc: '0244: seller_baseline_stats', sql: `
      CREATE TABLE IF NOT EXISTS seller_baseline_stats (
        seller_id INTEGER PRIMARY KEY,
        avg_donation_amount REAL DEFAULT 0,
        std_donation_amount REAL DEFAULT 0,
        donation_count_30d INTEGER DEFAULT 0,
        avg_orders_per_day REAL DEFAULT 0,
        std_orders_per_day REAL DEFAULT 0,
        median_buyer_account_age_days REAL DEFAULT 0,
        updated_at DATETIME DEFAULT (datetime('now'))
      )` },
    { desc: '0244: seller_kpi_daily', sql: `
      CREATE TABLE IF NOT EXISTS seller_kpi_daily (
        seller_id INTEGER NOT NULL,
        date DATE NOT NULL,
        unique_viewers INTEGER DEFAULT 0,
        viewers_purchased INTEGER DEFAULT 0,
        gmv INTEGER DEFAULT 0,
        donation_total INTEGER DEFAULT 0,
        cvr REAL DEFAULT 0,
        arpu INTEGER DEFAULT 0,
        refund_amount INTEGER DEFAULT 0,
        refund_count INTEGER DEFAULT 0,
        PRIMARY KEY (seller_id, date)
      )` },
    { desc: '0244: idx_seller_kpi_date', sql: `CREATE INDEX IF NOT EXISTS idx_seller_kpi_date ON seller_kpi_daily(date DESC, seller_id)` },

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

    // 🛡️ 2026-05-07: 데이터 영구 안정성 보강 — UNIQUE 제약 + 상태 변경 이력 테이블.
    //   사용자 신고 \"분명 셀러 등록한 적 있는데 새로 등록하라고 함\" 사고 재발 방지.
    //   1. UNIQUE INDEX (sellers.email, sellers.linked_user_id, sellers.business_number)
    //      → 중복 셀러 가입 자체 차단. 이미 데이터 있어도 IF NOT EXISTS 안전.
    //   2. seller_status_history — 모든 상태 변경 (pending→approved→suspended 등) 이력 추적.
    //      → 잘못 정지된 셀러 복구 / 감사 / 분쟁 대응.
    //   3. agencies / users 동일 패턴.
    { desc: '0245: idx_sellers_email_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_email_unique ON sellers(email) WHERE email IS NOT NULL` },
    { desc: '0245: idx_sellers_linked_user_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_linked_user_unique ON sellers(linked_user_id) WHERE linked_user_id IS NOT NULL` },
    { desc: '0245: idx_sellers_business_number', sql: `CREATE INDEX IF NOT EXISTS idx_sellers_business_number ON sellers(business_number) WHERE business_number IS NOT NULL` },
    { desc: '0245: idx_agencies_email_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_email_unique ON agencies(email) WHERE email IS NOT NULL` },
    { desc: '0245: idx_agencies_linked_user_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_linked_user_unique ON agencies(linked_user_id) WHERE linked_user_id IS NOT NULL` },
    { desc: '0245: seller_status_history', sql: `
      CREATE TABLE IF NOT EXISTS seller_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        prev_status TEXT,
        new_status TEXT NOT NULL,
        reason TEXT,
        changed_by_admin_id INTEGER,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0245: idx_seller_status_history', sql: `CREATE INDEX IF NOT EXISTS idx_seller_status_history ON seller_status_history(seller_id, changed_at DESC)` },
    { desc: '0245: agency_status_history', sql: `
      CREATE TABLE IF NOT EXISTS agency_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        prev_status TEXT,
        new_status TEXT NOT NULL,
        reason TEXT,
        changed_by_admin_id INTEGER,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0245: idx_agency_status_history', sql: `CREATE INDEX IF NOT EXISTS idx_agency_status_history ON agency_status_history(agency_id, changed_at DESC)` },
    // ── 0246: 어드민 감사 로그 ──────────────────────────────────────────
    { desc: '0246: admin_audit_log', sql: `
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id TEXT NOT NULL,
        actor_email TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        ip TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )` },
    { desc: '0246: idx_audit_log_actor', sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON admin_audit_log(actor_id, created_at DESC)` },
    { desc: '0246: idx_audit_log_resource', sql: `CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON admin_audit_log(resource_type, resource_id, created_at DESC)` },

    // 🛡️ 2026-05-12: 알림 dead-letter (transient 실패 자동 재시도용).
    //   sendSystemEmail / sendSystemPush 가 실패 시 INSERT, retry-notifications cron 이 5분 주기 drain.
    { desc: '0247: email_failures', sql: `
      CREATE TABLE IF NOT EXISTS email_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        html TEXT NOT NULL,
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        next_retry_at DATETIME DEFAULT (datetime('now', '+5 minutes')),
        resolved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0247: idx_email_failures_pending', sql: `CREATE INDEX IF NOT EXISTS idx_email_failures_pending ON email_failures(resolved, next_retry_at)` },
    { desc: '0247: push_failures', sql: `
      CREATE TABLE IF NOT EXISTS push_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_type TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        url TEXT,
        subscription_count INTEGER NOT NULL DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        next_retry_at DATETIME DEFAULT (datetime('now', '+5 minutes')),
        resolved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )` },
    { desc: '0247: idx_push_failures_pending', sql: `CREATE INDEX IF NOT EXISTS idx_push_failures_pending ON push_failures(resolved, next_retry_at)` },
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

// 🛡️ 2026-05-27 Step P1-1: 정산 흐름 e2e audit endpoint.
//   매장 정산이 정확히 동작하는지 admin 이 한 번에 확인:
//   - 사용된 바우처 (status='used') 중 settlement_id 미연결 (정산 대기)
//   - pending settlements 수 + 총 금액
//   - 최근 paid settlements + 누적 송금
//   - 사업자 검증 안 된 셀러 중 정산 신청 가능 매장 (블로커)
internalAdminToolsRoutes.get('/api/admin/settlement-audit', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB

    // 정산 대기 바우처 (사용됐는데 settlement 연결 안 됨, 7일 경과)
    const pendingVouchers = await DB.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(v.applied_price), 0) AS total
        FROM vouchers v
        JOIN products p ON p.id = v.product_id
       WHERE v.status = 'used'
         AND v.settlement_id IS NULL
         AND v.used_at <= datetime('now', '-7 days')
    `).first<{ n: number; total: number }>().catch(() => null)

    // pending settlements (어드민 검토 대기)
    const pendingSettlements = await DB.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(settlement_amount), 0) AS total
        FROM restaurant_settlements
       WHERE status = 'pending'
    `).first<{ n: number; total: number }>().catch(() => null)

    // 최근 30일 paid settlements
    const recentPaid = await DB.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(settlement_amount), 0) AS total
        FROM restaurant_settlements
       WHERE status = 'paid'
         AND updated_at >= datetime('now', '-30 days')
    `).first<{ n: number; total: number }>().catch(() => null)

    // 사업자 미검증 매장 — 정산 신청 가능한지 확인
    const unverifiedSellers = await DB.prepare(`
      SELECT COUNT(*) AS n FROM sellers
       WHERE status IN ('active', 'approved')
         AND (business_registration_status IS NULL OR business_registration_status != 'verified')
    `).first<{ n: number }>().catch(() => null)

    return c.json({
      success: true,
      data: {
        pending_vouchers: pendingVouchers ?? { n: 0, total: 0 },
        pending_settlements: pendingSettlements ?? { n: 0, total: 0 },
        recent_paid_30d: recentPaid ?? { n: 0, total: 0 },
        unverified_sellers: unverifiedSellers?.n ?? 0,
        notes: [
          'pending_vouchers — 사용 후 7일 경과 + settlement_id 없음 = cron 미실행 가능성',
          'pending_settlements — 어드민이 검토 후 송금 처리 필요',
          'unverified_sellers — 사업자등록증 미검증 매장 (정산 신청 시 deal/KT Alpha 옵션 만)',
        ],
      },
    })
  } catch (err) {
    return c.json({ success: false, error: 'settlement-audit 조회 실패' }, 500)
  }
})

// 🛡️ 2026-05-27 Step G (e2e 검증): 매장 입점 전체 흐름 상태 점검 endpoint.
//   admin 이 한 번에 production 상태 확인:
//   - NTS_API_KEY env 등록 여부
//   - NAVER_CLIENT_ID env 등록 여부
//   - AI binding 등록 여부
//   - prospects 테이블 존재 + 컬럼 존재
//   - 트리거 존재
//   - cron 활성
internalAdminToolsRoutes.get('/api/admin/seller-onboarding-status', requireAdmin(), async (c) => {
  try {
    const env = c.env as { NTS_API_KEY?: string; NAVER_CLIENT_ID?: string; NAVER_CLIENT_SECRET?: string; AI?: unknown }
    const checks: Array<{ name: string; ok: boolean; note?: string }> = []

    // env 체크
    checks.push({ name: 'NTS_API_KEY (자동 진위확인)', ok: !!env.NTS_API_KEY, note: env.NTS_API_KEY ? '활성' : 'data.go.kr 신청 + env 등록 필요' })
    checks.push({ name: 'NAVER_CLIENT_ID (매장 진위 추가 검증)', ok: !!env.NAVER_CLIENT_ID, note: env.NAVER_CLIENT_ID ? '활성' : '선택 — developers.naver.com' })
    checks.push({ name: 'AI binding (사업자등록증 OCR)', ok: !!env.AI, note: env.AI ? '활성' : '선택 — wrangler.toml [[ai]] 추가' })

    // DB 컬럼 체크
    const colCheck = async (col: string) => {
      try {
        await c.env.DB.prepare(`SELECT ${col} FROM sellers LIMIT 1`).first()
        return true
      } catch { return false }
    }
    checks.push({ name: 'sellers.business_start_date 컬럼', ok: await colCheck('business_start_date') })
    checks.push({ name: 'sellers.nts_verified_at 컬럼', ok: await colCheck('nts_verified_at') })
    checks.push({ name: 'sellers.nts_verify_result 컬럼', ok: await colCheck('nts_verify_result') })

    // prospects 테이블 체크
    const prospectTable = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='seller_prospects'"
    ).first().catch(() => null)
    checks.push({ name: 'seller_prospects 테이블', ok: !!prospectTable, note: prospectTable ? '활성' : 'POST /api/_internal/repair-schema 호출 필요' })

    // 트리거 체크
    const trigger = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_product_reviews_aggregate_insert'"
    ).first().catch(() => null)
    checks.push({ name: '리뷰 aggregate 트리거', ok: !!trigger })

    // 통계
    const pendingCount = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sellers WHERE status='pending'`)
      .first<{ n: number }>().catch(() => ({ n: 0 }))
    const prospectsCount = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM seller_prospects WHERE status='visiting'`)
      .first<{ n: number }>().catch(() => ({ n: 0 }))

    const okCount = checks.filter(c => c.ok).length
    return c.json({
      success: true,
      health: `${okCount}/${checks.length}`,
      ready: okCount === checks.length,
      checks,
      stats: {
        pending_sellers: pendingCount?.n ?? 0,
        visiting_prospects: prospectsCount?.n ?? 0,
      },
    })
  } catch (err) {
    return c.json({ success: false, error: 'onboarding-status 조회 실패' }, 500)
  }
})

// 🛡️ 2026-05-27 (사용자 결정): 매장 검수 통합 페이지 endpoint.
//   pending sellers + NTS 결과 + 영업 증빙 한 번에.
internalAdminToolsRoutes.get('/api/admin/pending-sellers', requireAdmin(), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.username, s.business_name, s.business_number, s.representative_name,
              s.business_start_date, s.phone, s.email, s.store_category, s.seller_type, s.status,
              s.nts_verified_at, s.nts_verify_result,
              s.introduced_by_agency_id, s.introduced_by_influencer_id, s.created_at,
              p.proof_image_url AS prospect_proof_url,
              p.notes AS prospect_notes
         FROM sellers s
         LEFT JOIN seller_prospects p ON p.converted_seller_id = s.id
        WHERE s.status = 'pending'
        ORDER BY s.created_at DESC
        LIMIT 100`
    ).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results })
  } catch (err) {
    return c.json({ success: false, error: 'pending sellers 조회 실패' }, 500)
  }
})

// 🛡️ 2026-05-27 (사용자 결정): 매장별 영입 commission 기간 설정 + 영입자 조회.
//   referral_bonus_until: NULL = 무기한, 날짜 = 만료일. admin 이 매장마다 조정.
internalAdminToolsRoutes.get('/api/admin/sellers/:id/commission-settings', requireAdmin(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
    const seller = await c.env.DB.prepare(
      `SELECT s.id, s.business_name, s.commission_rate, s.referral_bonus_until,
              s.introduced_by_agency_id, s.introduced_by_influencer_id, s.introduced_at,
              a.name AS agency_name, u.handle AS influencer_handle
         FROM sellers s
         LEFT JOIN agencies a ON a.id = s.introduced_by_agency_id
         LEFT JOIN users u ON u.id = s.introduced_by_influencer_id
        WHERE s.id = ?`
    ).bind(id).first().catch(() => null)
    if (!seller) return c.json({ success: false, error: 'seller 없음' }, 404)
    return c.json({ success: true, data: seller })
  } catch (err) {
    return c.json({ success: false, error: 'commission-settings 조회 실패' }, 500)
  }
})

internalAdminToolsRoutes.patch('/api/admin/sellers/:id/commission-settings', requireAdmin(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
    const body = await c.req.json<{
      referral_bonus_until?: string | null
      commission_rate?: number
      bonus_months?: number
    }>().catch(() => ({} as { referral_bonus_until?: string | null; commission_rate?: number; bonus_months?: number }))

    const updates: string[] = []
    const binds: (string | number | null)[] = []

    if (typeof body.bonus_months === 'number' && body.bonus_months > 0) {
      const until = new Date()
      until.setMonth(until.getMonth() + body.bonus_months)
      updates.push('referral_bonus_until = ?')
      binds.push(until.toISOString())
    } else if ('referral_bonus_until' in body) {
      const v = body.referral_bonus_until
      updates.push('referral_bonus_until = ?')
      binds.push(v && String(v).trim() ? String(v) : null)
    }

    if (typeof body.commission_rate === 'number' && body.commission_rate >= 0 && body.commission_rate <= 50) {
      updates.push('commission_rate = ?')
      binds.push(body.commission_rate)
    }

    if (updates.length === 0) return c.json({ success: false, error: '변경할 필드 없음' }, 400)
    binds.push(id)
    await c.env.DB.prepare(
      `UPDATE sellers SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).bind(...binds).run()

    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: 'commission-settings 수정 실패' }, 500)
  }
})

// admin NTS 재검증 (수동 trigger)
internalAdminToolsRoutes.post('/api/admin/sellers/:id/recheck-nts', requireAdmin(), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

    const seller = await c.env.DB.prepare(
      `SELECT business_number, representative_name, business_start_date FROM sellers WHERE id = ?`
    ).bind(id).first<{ business_number: string; representative_name: string | null; business_start_date: string | null }>()
    if (!seller) return c.json({ success: false, error: 'seller 없음' }, 404)
    if (!seller.representative_name || !seller.business_start_date) {
      return c.json({ success: false, error: '대표자명 / 개업일 누락 — 재검증 불가' }, 400)
    }

    const { ntsValidateBusiness } = await import('../utils/nts-business-verify')
    const ntsKey = (c.env as { NTS_API_KEY?: string }).NTS_API_KEY
    const r = await ntsValidateBusiness(ntsKey, {
      businessNumber: seller.business_number,
      startDate: seller.business_start_date,
      representative: seller.representative_name,
    })
    const resultJson = JSON.stringify({ valid: r.valid, status: r.status, message: r.message })

    if (r.autoApprovable) {
      await c.env.DB.prepare(
        `UPDATE sellers SET status = 'approved', nts_verified_at = datetime('now'), nts_verify_result = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(resultJson, id).run()
    } else {
      await c.env.DB.prepare(
        `UPDATE sellers SET nts_verify_result = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(resultJson, id).run()
    }

    return c.json({ success: true, message: r.message, autoApproved: r.autoApprovable })
  } catch (err) {
    return c.json({ success: false, error: 'NTS 재검증 실패' }, 500)
  }
})

// admin prospects 전체 검토 페이지 endpoint
internalAdminToolsRoutes.get('/api/admin/prospects', requireAdmin(), async (c) => {
  try {
    const status = c.req.query('status') || 'visiting'
    const { results } = await c.env.DB.prepare(
      `SELECT p.id, p.introducer_type, p.introducer_id,
              p.store_name, p.contact_name, p.contact_phone, p.contact_email,
              p.business_address, p.notes, p.proof_image_url,
              p.status, p.converted_seller_id, p.first_sale_at, p.commission_locked_at,
              p.expires_at, p.created_at
         FROM seller_prospects p
        WHERE p.status = ?
        ORDER BY p.created_at DESC
        LIMIT 200`
    ).bind(status).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results })
  } catch (err) {
    return c.json({ success: false, error: 'prospects 조회 실패' }, 500)
  }
})

// 🛡️ 2026-05-27: 운영 대시보드 통합 status — 한 endpoint 에 SSR/cron/D1/cache 상태.
//   사용자 요청 — 운영 상태 점검 위해 분산된 정보 통합.
internalAdminToolsRoutes.get('/api/admin/ops-status', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    const now = Date.now()

    // 1) 최근 cron 실행 (frontend_errors / cron 로그가 없으면 schema-repair 만)
    //    schema_repair_history 가 있으면 마지막 실행 시각
    const lastRepair = await DB.prepare(
      `SELECT MAX(applied_at) AS at FROM schema_repair_history`
    ).first<{ at: string | null }>().catch(() => null)

    // 2) D1 row count — 빠른 indicator
    const productCount = await DB.prepare(`SELECT COUNT(*) AS n FROM products WHERE is_active = 1`)
      .first<{ n: number }>().catch(() => null)
    const orderCount = await DB.prepare(`SELECT COUNT(*) AS n FROM orders WHERE created_at >= datetime('now', '-1 day')`)
      .first<{ n: number }>().catch(() => null)

    // 3) 최근 frontend_errors 5건
    const errors = await DB.prepare(
      `SELECT type, message, COUNT(*) AS count, MAX(created_at) AS last_at
         FROM frontend_errors
        WHERE created_at >= datetime('now', '-1 day')
        GROUP BY type, message
        ORDER BY count DESC
        LIMIT 5`
    ).all<{ type: string; message: string; count: number; last_at: string }>()
      .catch(() => ({ results: [] as any[] }))

    // 4) KT Alpha 발송 최근 24h 통계
    const ktStats = await DB.prepare(
      `SELECT status, COUNT(*) AS n FROM voucher_orders
        WHERE created_at >= datetime('now', '-1 day')
        GROUP BY status`
    ).all<{ status: string; n: number }>().catch(() => ({ results: [] as any[] }))

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        last_schema_repair: lastRepair?.at ?? null,
        active_products: productCount?.n ?? 0,
        orders_24h: orderCount?.n ?? 0,
        recent_errors: errors.results ?? [],
        kt_alpha_24h: (ktStats.results ?? []).reduce(
          (acc: Record<string, number>, r) => ({ ...acc, [r.status]: r.n }),
          {},
        ),
      },
    })
  } catch (err) {
    return c.json({ success: false, error: 'ops-status 조회 실패' }, 500)
  }
})

// 🛡️ 2026-05-27: CSP violation 누적 분석 — admin endpoint.
//   /api/csp-report 가 INSERT 만 → admin 이 패턴 보지 못함.
//   집계: violated_directive + blocked_uri 별 카운트, 최근 24h / 7d.
internalAdminToolsRoutes.get('/api/admin/csp-violations', requireAdmin(), async (c) => {
  try {
    const range = c.req.query('range') === '7d' ? '-7 days' : '-1 day'
    const { results } = await c.env.DB.prepare(
      `SELECT violated_directive, blocked_uri, document_uri,
              COUNT(*) AS count, MAX(created_at) AS last_at
         FROM csp_violations
        WHERE created_at >= datetime('now', ?)
        GROUP BY violated_directive, blocked_uri
        ORDER BY count DESC
        LIMIT 50`,
    ).bind(range).all<{
      violated_directive: string; blocked_uri: string; document_uri: string;
      count: number; last_at: string
    }>().catch(() => ({ results: [] as any[] }))
    return c.json({ success: true, range, data: results })
  } catch (err) {
    return c.json({ success: false, error: 'csp violations 조회 실패' }, 500)
  }
})

export { internalAdminToolsRoutes };
