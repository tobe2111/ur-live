/**
 * Feature Flags (Kill-Switch Infrastructure)
 *
 * Non-critical features can be flagged OFF during traffic spikes to keep
 * core flows (checkout, payment, login) responsive.
 *
 * Storage: Cloudflare KV (SESSION_KV binding) — primary
 *          D1 (feature_flags_kv table) — fallback when KV not configured
 * Cache:   In-memory, 30s TTL — a short TTL keeps propagation under 1 min
 *          while avoiding a KV read on every request.
 *
 * Admin UI: PATCH /api/admin/flags/:name   { value: boolean }
 *           POST  /api/admin/flags/emergency-mode   { enable: boolean }
 */

import type { KVNamespace, D1Database } from '@cloudflare/workers-types';

import { swallow } from './swallow';
export interface FeatureFlags {
  // Kill switches — turn OFF to disable non-critical features during high load
  enable_reviews: boolean;
  enable_chat: boolean;
  enable_analytics_tracking: boolean;
  enable_push_notifications: boolean;
  enable_shorts_feed: boolean;
  enable_search_suggestions: boolean;
  enable_realtime_viewer_count: boolean;
  enable_donation_live_toast: boolean;
  // 🛡️ 2026-04-26 (X2): 신규 에이전시 기능 kill switches.
  // 마이그레이션 0207~0221 미적용 또는 cron 오작동 시 즉시 OFF 가능.
  // OFF 시: cron handler 가 시작 시 graceful skip.
  enable_agency_tier_eval: boolean;        // Q1
  enable_agency_creator_eval: boolean;     // Q3
  enable_agency_monthly_tasks: boolean;    // Q6
  enable_agency_auto_settle: boolean;      // P0 #3
  enable_agency_monthly_invoices: boolean; // M6
  enable_tiktok_videos_sync: boolean;      // T2
  enable_agency_campaigns_aggregate: boolean; // P0 #4
  // Always-on critical features (never flag these off)
  // - checkout
  // - payment
  // - login
}

const DEFAULT_FLAGS: FeatureFlags = {
  enable_reviews: true,
  enable_chat: true,
  enable_analytics_tracking: true,
  enable_push_notifications: true,
  enable_shorts_feed: true,
  enable_search_suggestions: true,
  enable_realtime_viewer_count: true,
  enable_donation_live_toast: true,
  // 신규 cron — 디폴트 ON. 문제 발생 시 즉시 OFF.
  enable_agency_tier_eval: true,
  enable_agency_creator_eval: true,
  enable_agency_monthly_tasks: true,
  enable_agency_auto_settle: true,
  enable_agency_monthly_invoices: true,
  enable_tiktok_videos_sync: true,
  enable_agency_campaigns_aggregate: true,
};

let cached: { flags: FeatureFlags; loadedAt: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

async function ensureFlagsTable(DB: D1Database) {
  if (_done_ensureFlagsTable) return
  _done_ensureFlagsTable = true
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS feature_flags_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(swallow('worker:utils:feature-flags'));
}

export async function getFeatureFlags(KV?: KVNamespace, DB?: D1Database): Promise<FeatureFlags> {
  const now = Date.now();
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.flags;
  }

  // ── 1차: KV 조회 ─────────────────────────────────────
  if (KV) {
    try {
      const stored = await KV.get('feature_flags', { type: 'json' });
      const flags = { ...DEFAULT_FLAGS, ...((stored as Partial<FeatureFlags>) || {}) };
      cached = { flags, loadedAt: now };
      return flags;
    } catch {
      // fall through to D1
    }
  }

  // ── 2차: D1 fallback (KV 미세팅 시 유일한 지속 저장소) ─
  if (DB) {
    try {
      await ensureFlagsTable(DB);
      const row = await DB.prepare(
        "SELECT value FROM feature_flags_kv WHERE key='feature_flags'"
      ).first<{ value: string }>();
      if (row?.value) {
        const parsed = JSON.parse(row.value) as Partial<FeatureFlags>;
        const flags = { ...DEFAULT_FLAGS, ...parsed };
        cached = { flags, loadedAt: now };
        return flags;
      }
    } catch {
      // fall through to defaults
    }
  }

  cached = { flags: DEFAULT_FLAGS, loadedAt: now };
  return DEFAULT_FLAGS;
}

/**
 * Admin API: set a single feature flag. Writes to both KV + D1 fallback.
 */
export async function setFeatureFlag(
  flag: keyof FeatureFlags,
  value: boolean,
  KV?: KVNamespace,
  DB?: D1Database,
): Promise<void> {
  let current: Partial<FeatureFlags> = {};
  if (KV) {
    current = ((await KV.get('feature_flags', { type: 'json' })) as Partial<FeatureFlags>) || {};
  } else if (DB) {
    await ensureFlagsTable(DB);
    const row = await DB.prepare("SELECT value FROM feature_flags_kv WHERE key='feature_flags'").first<{ value: string }>();
    if (row?.value) current = JSON.parse(row.value);
  }
  current[flag] = value;
  const json = JSON.stringify(current);
  if (KV) await KV.put('feature_flags', json);
  if (DB) {
    await ensureFlagsTable(DB);
    await DB.prepare(
      `INSERT INTO feature_flags_kv (key, value) VALUES ('feature_flags', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(json).run();
  }
  cached = null;
}

/**
 * Admin API: atomically overwrite all flags (used by emergency-mode endpoint).
 */
export async function setAllFeatureFlags(
  flags: FeatureFlags,
  KV?: KVNamespace,
  DB?: D1Database,
): Promise<void> {
  const json = JSON.stringify(flags);
  if (KV) await KV.put('feature_flags', json);
  if (DB) {
    await ensureFlagsTable(DB);
    await DB.prepare(
      `INSERT INTO feature_flags_kv (key, value) VALUES ('feature_flags', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(json).run();
  }
  cached = null;
}

/**
 * Default flag set when Emergency Mode is ENABLED.
 * Non-critical features go OFF; shorts stay ON for engagement.
 */
export const EMERGENCY_MODE_FLAGS: FeatureFlags = {
  enable_reviews: false,
  enable_chat: false,
  enable_analytics_tracking: false,
  enable_push_notifications: false,
  enable_shorts_feed: true, // keep for engagement
  enable_search_suggestions: false,
  enable_realtime_viewer_count: false,
  enable_donation_live_toast: false,
  // 비상 모드 시 cron 도 모두 OFF
  enable_agency_tier_eval: false,
  enable_agency_creator_eval: false,
  enable_agency_monthly_tasks: false,
  enable_agency_auto_settle: false,
  enable_agency_monthly_invoices: false,
  enable_tiktok_videos_sync: false,
  enable_agency_campaigns_aggregate: false,
};

/**
 * Default flag set when Emergency Mode is DISABLED (normal operation).
 */
export const NORMAL_MODE_FLAGS: FeatureFlags = { ...DEFAULT_FLAGS };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureFlagsTable = false
