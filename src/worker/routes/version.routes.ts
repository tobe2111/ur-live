import { Hono } from 'hono';
import type { Env } from '../types/env';

export const versionRoutes = new Hono<{ Bindings: Env }>();

let _cachedBuildVersion: { version: string; fetchedAt: number } | null = null;

versionRoutes.get('/api/version', async (c) => {
  const env = c.env;
  const secrets = {
    JWT_SECRET: !!env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: !!env.REFRESH_TOKEN_SECRET,
    KAKAO_REST_API_KEY: !!env.KAKAO_REST_API_KEY,
    FIREBASE_PRIVATE_KEY: !!env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: !!env.FIREBASE_CLIENT_EMAIL,
    TOSS_SECRET_KEY: !!env.TOSS_SECRET_KEY,
    DB: !!env.DB,
  };
  try {
    const now = Date.now();
    if (_cachedBuildVersion && (now - _cachedBuildVersion.fetchedAt) < 60_000) {
      return c.json({ success: true, version: _cachedBuildVersion.version, secrets });
    }

    const origin = new URL(c.req.url).origin;
    const htmlRes = await fetch(`${origin}/`, { cf: { cacheTtl: 30 } } as RequestInit);
    if (!htmlRes.ok) return c.json({ success: false, version: null, secrets }, 200);

    const html = await htmlRes.text();
    const match = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
    const version = match?.[1] || 'unknown';
    _cachedBuildVersion = { version, fetchedAt: now };
    return c.json({ success: true, version, secrets });
  } catch {
    return c.json({ success: false, version: null, secrets }, 200);
  }
});
