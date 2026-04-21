/**
 * Admin Feature Flags API
 *
 * Mounted under adminApp at /api/admin/flags
 *
 *   GET    /api/admin/flags                 → current flag state
 *   PATCH  /api/admin/flags/:name           → toggle a single flag
 *   POST   /api/admin/flags/emergency-mode  → toggle all non-critical flags
 *
 * Auth: adminApp already enforces requireAdmin() + IP whitelist + audit log.
 */

import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import {
  getFeatureFlags,
  setFeatureFlag,
  setAllFeatureFlags,
  EMERGENCY_MODE_FLAGS,
  NORMAL_MODE_FLAGS,
  type FeatureFlags,
} from '@/worker/utils/feature-flags';

export const adminFlagsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/admin/flags — current flag state
adminFlagsRoutes.get('/', async (c) => {
  const flags = await getFeatureFlags((c.env as Env).SESSION_KV);
  return c.json({ success: true, data: flags });
});

// POST /api/admin/flags/emergency-mode — atomic bulk toggle
// ⚠️ Registered BEFORE the PATCH /:name route so Hono matches the literal path first.
adminFlagsRoutes.post('/emergency-mode', async (c) => {
  const KV = (c.env as Env).SESSION_KV;
  if (!KV) {
    return c.json({ success: false, error: 'KV not configured' }, 503);
  }

  const { enable } = await c.req.json<{ enable: boolean }>();
  const flags = enable ? EMERGENCY_MODE_FLAGS : NORMAL_MODE_FLAGS;

  await setAllFeatureFlags(KV, flags);

  return c.json({
    success: true,
    mode: enable ? 'emergency' : 'normal',
    flags,
  });
});

// PATCH /api/admin/flags/:name — toggle a single flag
adminFlagsRoutes.patch('/:name', async (c) => {
  const KV = (c.env as Env).SESSION_KV;
  if (!KV) {
    return c.json({ success: false, error: 'KV not configured' }, 503);
  }

  const name = c.req.param('name') as keyof FeatureFlags;
  const { value } = await c.req.json<{ value: boolean }>();

  // Guard: ignore unknown flag names rather than writing garbage to KV.
  const known = Object.keys(NORMAL_MODE_FLAGS) as (keyof FeatureFlags)[];
  if (!known.includes(name)) {
    return c.json({ success: false, error: `Unknown flag: ${name}` }, 400);
  }

  await setFeatureFlag(KV, name, Boolean(value));
  return c.json({ success: true, message: `${name} = ${Boolean(value)}` });
});
