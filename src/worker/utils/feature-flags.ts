/**
 * Feature Flags (Kill-Switch Infrastructure)
 *
 * Non-critical features can be flagged OFF during traffic spikes to keep
 * core flows (checkout, payment, login) responsive.
 *
 * Storage: Cloudflare KV (SESSION_KV binding) under key `feature_flags`
 * Cache:   In-memory, 30s TTL — a short TTL keeps propagation under 1 min
 *          while avoiding a KV read on every request.
 *
 * Admin UI: PATCH /api/admin/flags/:name   { value: boolean }
 *           POST  /api/admin/flags/emergency-mode   { enable: boolean }
 */

import type { KVNamespace } from '@cloudflare/workers-types';

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
};

let cached: { flags: FeatureFlags; loadedAt: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function getFeatureFlags(KV?: KVNamespace): Promise<FeatureFlags> {
  const now = Date.now();
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.flags;
  }

  if (!KV) {
    cached = { flags: DEFAULT_FLAGS, loadedAt: now };
    return DEFAULT_FLAGS;
  }

  try {
    const stored = await KV.get('feature_flags', { type: 'json' });
    const flags = { ...DEFAULT_FLAGS, ...((stored as Partial<FeatureFlags>) || {}) };
    cached = { flags, loadedAt: now };
    return flags;
  } catch {
    cached = { flags: DEFAULT_FLAGS, loadedAt: now };
    return DEFAULT_FLAGS;
  }
}

/**
 * Admin API: set a single feature flag.
 */
export async function setFeatureFlag(
  KV: KVNamespace,
  flag: keyof FeatureFlags,
  value: boolean,
): Promise<void> {
  const current = ((await KV.get('feature_flags', { type: 'json' })) as Partial<FeatureFlags>) || {};
  current[flag] = value;
  await KV.put('feature_flags', JSON.stringify(current));
  cached = null; // Invalidate cache
}

/**
 * Admin API: atomically overwrite all flags (used by emergency-mode endpoint).
 */
export async function setAllFeatureFlags(
  KV: KVNamespace,
  flags: FeatureFlags,
): Promise<void> {
  await KV.put('feature_flags', JSON.stringify(flags));
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
};

/**
 * Default flag set when Emergency Mode is DISABLED (normal operation).
 */
export const NORMAL_MODE_FLAGS: FeatureFlags = { ...DEFAULT_FLAGS };
