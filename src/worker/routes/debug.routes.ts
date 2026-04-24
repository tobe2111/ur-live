import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAdmin } from '../middleware/auth';

export const debugRoutes = new Hono<{ Bindings: Env }>();

debugRoutes.get('/api/debug/build-info', requireAdmin(), (c) => {
  return c.json({
    success: true,
    commitSha: c.env.BUILD_SHA || 'unknown',
    buildTimestamp: c.env.BUILD_TIMESTAMP || 'unknown',
    markers: {
      whoamiEndpoint: true,
      buildInfoEndpoint: true,
    },
  });
});

debugRoutes.get('/api/debug/whoami', requireAdmin(), async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const hasAuthHeader = authHeader.length > 0;
  const cookieHeader = c.req.header('Cookie') || '';
  const hasCookie = cookieHeader.length > 0;
  const cookieNames = cookieHeader.split(';').map(s => s.split('=')[0].trim()).filter(Boolean);

  const authPreview = hasAuthHeader ? authHeader.slice(0, 20) + '...' : null;

  const sessionCookieNames = ['ur_session', 'firebase_token', 'seller_session', 'admin_session'];
  const presentSessionCookies = sessionCookieNames.filter(n => cookieNames.includes(n));

  let tokenInfo: { valid: boolean; type?: unknown; sub?: string | null; exp?: unknown; expired?: unknown; error?: string } | null = null;
  if (hasAuthHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { verify } = await import('hono/jwt');
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
      tokenInfo = {
        valid: true,
        type: payload['type'],
        sub: payload['sub'] ? String(payload['sub']).slice(0, 8) + '...' : null,
        exp: payload['exp'],
        expired: payload['exp'] && (payload['exp'] as number) < Math.floor(Date.now() / 1000),
      };
    } catch (err: unknown) {
      tokenInfo = { valid: false, error: String((err as Error)?.message || err).slice(0, 100) };
    }
  }

  return c.json({
    success: true,
    request: {
      url: c.req.url,
      method: c.req.method,
      origin: c.req.header('Origin') || null,
      userAgent: (c.req.header('User-Agent') || '').slice(0, 60),
      cfConnectingIp: c.req.header('CF-Connecting-IP') || null,
    },
    auth: {
      hasAuthHeader,
      authPreview,
      hasCookie,
      cookieNames,
      presentSessionCookies,
      tokenInfo,
    },
    env: {
      hasJwtSecret: !!c.env.JWT_SECRET,
      hasDb: !!c.env.DB,
      environment: c.env.ENVIRONMENT || 'unknown',
    },
  });
});

debugRoutes.get('/api/debug/auth-trace', requireAdmin(), async (c) => {
  const steps: Record<string, unknown>[] = [];
  try {
    const authHeader = c.req.header('Authorization') || '';
    steps.push({ step: 'headers', authHeaderPresent: !!authHeader });

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      steps.push({ step: 'bearer-found', length: token.length });
      try {
        const { verify } = await import('hono/jwt');
        const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
        steps.push({ step: 'jwt-verified', type: payload['type'], sub: String(payload['sub']).slice(0, 6) + '...' });
      } catch (e: unknown) {
        steps.push({ step: 'jwt-error', error: String((e as Error)?.message || e).slice(0, 100) });
      }
    }

    const cookieHeader = c.req.header('Cookie') || '';
    const urSession = cookieHeader.split(';').map(s => s.trim()).find(c => c.startsWith('ur_session='));
    if (urSession) {
      steps.push({ step: 'ur_session-found', length: urSession.length });
    }

    return c.json({ success: true, trace: steps });
  } catch (e: any) {
    steps.push({ step: 'exception', error: String(e?.message || e).slice(0, 200) });
    return c.json({ success: false, trace: steps });
  }
});

debugRoutes.get('/api/debug/bindings', requireAdmin(), (c) => {
  const env = c.env as Env;
  return c.json({
    hasDB: !!env.DB,
    hasSessionKV: !!env.SESSION_KV,
    environment: env.ENVIRONMENT,
    frontendUrl: env.FRONTEND_URL,
    region: env.REGION,
    envKeys: Object.keys(env || {}),
  });
});

debugRoutes.get('/api/debug/kv-usage', requireAdmin(), async (c) => {
  const env = c.env as Env;
  try {
    let sessionCount = 0;
    if (env.SESSION_KV) {
      const listed = await env.SESSION_KV.list({ limit: 1000 });
      sessionCount = listed.keys.length;
    }

    const readLimit = 100000;
    const writeLimit = 1000;
    const estimatedReads = sessionCount * 10;
    const estimatedWrites = Math.ceil(sessionCount * 0.3);
    const readUsagePercent = Math.min(100, Math.round((estimatedReads / readLimit) * 100));
    const writeUsagePercent = Math.min(100, Math.round((estimatedWrites / writeLimit) * 100));

    return c.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        note: 'KV 사용량은 활성 세션 수 기반 추정치입니다. 정확한 수치는 Cloudflare 대시보드에서 확인하세요.',
        activeSessions: sessionCount,
        reads: estimatedReads,
        writes: estimatedWrites,
        readLimit,
        writeLimit,
        readUsagePercent,
        writeUsagePercent,
        estimatedDailyCost: 0,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

debugRoutes.get('/api/admin/optimize-db', requireAdmin(), async (c) => {
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
