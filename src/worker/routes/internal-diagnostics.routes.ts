/**
 * Internal Diagnostics Routes (admin only)
 *
 * 운영자가 시스템 상태를 빠르게 파악하기 위한 read-only 엔드포인트.
 *
 *   GET /api/_internal/health-dashboard   — DB / 테이블 카운트 / 트래픽 / secret 상태
 *   GET /api/_internal/migration-status   — 신규 마이그레이션 적용 여부
 *   GET /api/debug/whoami                 — 호출자 인증 정보 dump
 *   GET /api/debug/auth-trace             — 인증 단계별 trace
 *   GET /api/debug/kv-usage               — SESSION_KV 사용량 추정
 *
 * 모두 requireAdmin() 보호. 인프라 정보 노출 방지.
 *
 * 🛡️ 2026-04-27: TD-006 partial split — worker/index.ts 인라인 핸들러 분리.
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '../middleware/auth';

const internalDiagnosticsRoutes = new Hono<{ Bindings: Env }>();

// ─── 카카오 로그인 진단 (iOS WebKit 수정 효과 확인 + 회귀 감지) ───────────────
//   기록은 kakao.routes.ts /sync/callback 가 fire-and-forget 으로 남김.
//   판독: ios_summary 의 success/error 비율 + aggregate 의 browser별 분포.
//   signed_fallback=1 success 가 보이면 → 쿠키 유실을 서명 fallback 이 실제로 구제 중.
internalDiagnosticsRoutes.get('/api/_internal/kakao-login-diag', requireAdmin(), async (c) => {
  const DB = c.env.DB;
  const empty = { results: [] as Record<string, unknown>[] };
  try {
    const aggregate = await DB.prepare(
      `SELECT browser, ios, outcome, reason, COUNT(*) as count
         FROM kakao_login_diag
        WHERE created_at >= datetime('now','-7 days')
        GROUP BY browser, ios, outcome, reason
        ORDER BY count DESC`
    ).all().catch(() => empty);
    const iosSummary = await DB.prepare(
      `SELECT outcome, COUNT(*) as count
         FROM kakao_login_diag
        WHERE ios = 1 AND created_at >= datetime('now','-7 days')
        GROUP BY outcome`
    ).all().catch(() => empty);
    const fallbackWins = await DB.prepare(
      `SELECT COUNT(*) as count
         FROM kakao_login_diag
        WHERE outcome='success' AND signed_fallback=1
          AND created_at >= datetime('now','-7 days')`
    ).first<{ count: number }>().catch(() => ({ count: 0 }));
    // 🩺 2026-06-20 (A 방식 확인): establish 결과를 브라우저별로 — iOS 에서 establish_ok success 가
    //   보이면 = same-origin httpOnly 세션 재발급 성공(쿠키 영속 = A 방식 작동). establish_bad_ticket/
    //   establish_cookie_fail 가 iOS 에 쌓이면 = A 방식 문제 신호.
    const establish = await DB.prepare(
      `SELECT browser, ios, outcome, reason, COUNT(*) as count
         FROM kakao_login_diag
        WHERE reason LIKE 'establish%' AND created_at >= datetime('now','-7 days')
        GROUP BY browser, ios, outcome, reason
        ORDER BY count DESC`
    ).all().catch(() => empty);
    // 🩺 2026-06-20: 콜백 단계별 실측 타이밍(ms) 요약 — "우리 서버가 실제로 몇 ms 쓰는지".
    //   ms_total=콜백 전체 / ms_token=카카오 토큰교환 / ms_userinfo=카카오 사용자정보(제거된
    //   getServiceTerms 의 비용도 이와 비슷했음) / ms_db=upsertUser. p95 는 정렬 OFFSET 근사.
    const timing = await DB.prepare(
      `SELECT COUNT(ms_total) as samples,
              ROUND(AVG(ms_total))    as avg_total_ms,
              MIN(ms_total)           as min_total_ms,
              MAX(ms_total)           as max_total_ms,
              ROUND(AVG(ms_token))    as avg_token_ms,
              ROUND(AVG(ms_userinfo)) as avg_userinfo_ms,
              ROUND(AVG(ms_db))       as avg_db_ms
         FROM kakao_login_diag
        WHERE ms_total IS NOT NULL AND created_at >= datetime('now','-7 days')`
    ).first().catch(() => null);
    const p95 = await DB.prepare(
      `SELECT ms_total FROM kakao_login_diag
        WHERE ms_total IS NOT NULL AND created_at >= datetime('now','-7 days')
        ORDER BY ms_total DESC
        LIMIT 1 OFFSET (SELECT COUNT(*)/20 FROM kakao_login_diag WHERE ms_total IS NOT NULL AND created_at >= datetime('now','-7 days'))`
    ).first<{ ms_total: number }>().catch(() => null);
    const recent = await DB.prepare(
      `SELECT created_at, outcome, reason, browser, ios, had_state_cookie, signed_fallback, is_new, ms_total, ms_token, ms_userinfo, ms_db
         FROM kakao_login_diag ORDER BY id DESC LIMIT 100`
    ).all().catch(() => empty);
    return c.json({
      success: true,
      data: {
        note: 'ios=1 은 모두 WebKit(사파리/카톡인앱). signed_fallback=1 success = 쿠키 유실을 서명 state 가 구제한 건수. establish_7d: A 방식 same-origin 세션발급 결과(iOS establish_ok = 쿠키 영속 성공). server_timing_ms_7d: 콜백이 실제로 쓰는 서버 시간(ms) — ms_token+ms_userinfo+ms_db 가 대부분, 제거된 getServiceTerms 는 ms_userinfo 와 비슷한 비용이었음.',
        ios_summary: iosSummary.results,
        signed_fallback_successes_7d: fallbackWins?.count ?? 0,
        establish_7d: establish.results,
        server_timing_ms_7d: { ...(timing || {}), p95_total_ms: p95?.ms_total ?? null },
        aggregate: aggregate.results,
        recent: recent.results,
      },
    });
  } catch {
    return c.json({ success: false, error: 'diag query failed' }, 500);
  }
});

// ─── Health Dashboard ────────────────────────────────────────────────────
internalDiagnosticsRoutes.get('/api/_internal/health-dashboard', requireAdmin(), async (c) => {
  const env = c.env;
  const DB = env.DB;
  const start = Date.now();

  let dbLatency = 0;
  let dbOk = false;
  try {
    const t0 = Date.now();
    await DB.prepare('SELECT 1').first();
    dbLatency = Date.now() - t0;
    dbOk = true;
  } catch { /* DB 불가 */ }

  const tableCounts: Record<string, number | null> = {};
  const tablesToCheck = ['users', 'sellers', 'products', 'orders', 'live_streams'];
  for (const t of tablesToCheck) {
    try {
      const row = await DB.prepare(`SELECT COUNT(*) as c FROM ${t}`).first<{ c: number }>();
      tableCounts[t] = row?.c ?? null;
    } catch {
      tableCounts[t] = null;
    }
  }

  let recentOrders = 0;
  let recentPaidOrders = 0;
  try {
    const o = await DB.prepare(
      "SELECT COUNT(*) as c FROM orders WHERE created_at >= datetime('now', '-24 hours')"
    ).first<{ c: number }>();
    recentOrders = o?.c ?? 0;
    const p = await DB.prepare(
      "SELECT COUNT(*) as c FROM orders WHERE created_at >= datetime('now', '-24 hours') AND payment_status = 'approved'"
    ).first<{ c: number }>();
    recentPaidOrders = p?.c ?? 0;
  } catch { /* 통계 불가 */ }

  // env 타입에 정의되지 않은 secret 도 런타임엔 존재할 수 있어 unknown 캐스팅
  const envAny = env as unknown as Record<string, string | undefined>;
  const envCheck = {
    JWT_SECRET: !!envAny.JWT_SECRET,
    REFRESH_TOKEN_SECRET: !!envAny.REFRESH_TOKEN_SECRET,
    KAKAO_REST_API_KEY: !!envAny.KAKAO_REST_API_KEY,
    FIREBASE_PRIVATE_KEY: !!envAny.FIREBASE_PRIVATE_KEY,
    TOSS_SECRET_KEY: !!envAny.TOSS_SECRET_KEY,
    RESEND_WEBHOOK_SECRET: !!envAny.RESEND_WEBHOOK_SECRET,
    INTERNAL_CRON_TOKEN: !!envAny.INTERNAL_CRON_TOKEN,
  };
  const secretsTotal = Object.keys(envCheck).length;
  const secretsSet = Object.values(envCheck).filter(Boolean).length;

  // 🛡️ 2026-05-31: 운영 설정 가시화 — 값 노출 없이 presence(true/false)만.
  //   필수 secrets 의 health 에는 영향 주지 않음(별도 블록). 운영자가 env 설정 후 객관 확인용.
  const featureConfig = {
    NTS_API_KEY: !!envAny.NTS_API_KEY,                              // 매장 사업자 자동승인 (없으면 전원 pending)
    DATA_ENCRYPTION_KEY: !!envAny.DATA_ENCRYPTION_KEY,              // 카카오 토큰 암호화 (없으면 평문 degrade)
    TOSS_WEBHOOK_IP_ALLOWLIST: !!envAny.TOSS_WEBHOOK_IP_ALLOWLIST,  // webhook 위조 방어 (선택)
  };

  let slowQueries: Array<{ label: string; count: number; avg_ms: number; max_ms: number }> = [];
  try {
    const { getSlowQueryStats } = await import('../utils/slow-query-logger');
    slowQueries = await getSlowQueryStats(DB, 24);
  } catch { /* slow-query 모듈 불가 */ }

  let recent5xxSpikes = 0;
  try {
    const row = await DB.prepare(
      "SELECT COUNT(*) as c FROM rate_limit_attempts WHERE action='5xx_spike' AND window_start >= ?"
    ).bind(Math.floor(Date.now() / 1000) - 86400).first<{ c: number }>();
    recent5xxSpikes = row?.c ?? 0;
  } catch { /* spike 데이터 없음 */ }

  return c.json({
    timestamp: new Date().toISOString(),
    totalDurationMs: Date.now() - start,
    db: {
      status: dbOk ? 'healthy' : 'unhealthy',
      latencyMs: dbLatency,
      latencyGrade: dbLatency < 50 ? 'excellent' : dbLatency < 200 ? 'good' : dbLatency < 500 ? 'slow' : 'critical',
    },
    tables: tableCounts,
    traffic: {
      last24hOrders: recentOrders,
      last24hPaidOrders: recentPaidOrders,
      conversionPct: recentOrders > 0 ? Math.round((recentPaidOrders / recentOrders) * 100) : 0,
    },
    secrets: {
      total: secretsTotal,
      configured: secretsSet,
      missing: Object.entries(envCheck).filter(([, v]) => !v).map(([k]) => k),
      health: secretsSet === secretsTotal ? 'complete' : 'incomplete',
    },
    featureConfig,
    performance: {
      slowQueriesLast24h: slowQueries.length,
      topSlow: slowQueries.slice(0, 5),
    },
    errors: {
      spikesLast24h: recent5xxSpikes,
    },
  });
});

// ─── Migration Status ────────────────────────────────────────────────────
internalDiagnosticsRoutes.get('/api/_internal/migration-status', requireAdmin(), async (c) => {
  const DB = c.env.DB;
  if (!DB) return c.json({ success: false, error: 'No DB binding' }, 500);

  const tables = [
    { mig: '0207', name: 'agency_creator_approvals' },
    { mig: '0208', name: 'agency_auto_settle_log' },
    { mig: '0209', name: 'agency_campaigns' },
    { mig: '0209', name: 'agency_campaign_sellers' },
    { mig: '0210', name: 'agency_incentive_rules' },
    { mig: '0211', name: 'auction_winner_history' },
    { mig: '0212', name: 'agency_tier_log' },
    { mig: '0213', name: 'agency_creator_evaluations' },
    { mig: '0214', name: 'agency_message_templates' },
    { mig: '0215', name: 'agency_monthly_tasks' },
    { mig: '0216', name: 'coupons_agency_distribution' },
    { mig: '0217', name: 'agency_members' },
    { mig: '0218', name: 'agency_live_notes' },
    { mig: '0219', name: 'settlement_invoices' },
    { mig: '0220', name: 'seller_platform_links' },
    { mig: '0221', name: 'tiktok_videos_cache' },
    { mig: '0222', name: 'agency_notifications' },
    { mig: '0222', name: 'agency_contracts' },
    { mig: '0222', name: 'agency_settlements' },
    { mig: '0222', name: 'agency_seller_targets' },
  ];

  const results: Array<{ migration: string; table: string; exists: boolean }> = [];
  for (const t of tables) {
    let exists = false;
    try {
      await DB.prepare(`SELECT 1 FROM ${t.name} LIMIT 1`).first();
      exists = true;
    } catch {
      exists = false;
    }
    results.push({ migration: t.mig, table: t.name, exists });
  }

  const applied = results.filter((r) => r.exists).length;
  const missing = results.filter((r) => !r.exists);

  return c.json({
    success: true,
    summary: { total: results.length, applied, missing: missing.length },
    missing_tables: missing.map((m) => `${m.migration}: ${m.table}`),
    results,
  });
});

// ─── Debug: whoami ───────────────────────────────────────────────────────
internalDiagnosticsRoutes.get('/api/debug/whoami', requireAdmin(), async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const hasAuthHeader = authHeader.length > 0;
  const cookieHeader = c.req.header('Cookie') || '';
  const hasCookie = cookieHeader.length > 0;
  const cookieNames = cookieHeader.split(';').map((s) => s.split('=')[0].trim()).filter(Boolean);

  const authPreview = hasAuthHeader ? authHeader.slice(0, 20) + '...' : null;

  const sessionCookieNames = ['ur_session', 'firebase_token', 'seller_session', 'admin_session'];
  const presentSessionCookies = sessionCookieNames.filter((n) => cookieNames.includes(n));

  let tokenInfo: Record<string, unknown> | null = null;
  if (hasAuthHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { verify } = await import('hono/jwt');
      const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
      tokenInfo = {
        valid: true,
        type: payload.type,
        sub: payload.sub ? String(payload.sub).slice(0, 8) + '...' : null,
        exp: payload.exp,
        expired: typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000),
      };
    } catch (err) {
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

// ─── Debug: auth-trace ───────────────────────────────────────────────────
internalDiagnosticsRoutes.get('/api/debug/auth-trace', requireAdmin(), async (c) => {
  const steps: Array<Record<string, unknown>> = [];
  try {
    const authHeader = c.req.header('Authorization') || '';
    steps.push({ step: 'headers', authHeaderPresent: !!authHeader });

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      steps.push({ step: 'bearer-found', length: token.length });
      try {
        const { verify } = await import('hono/jwt');
        const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
        steps.push({ step: 'jwt-verified', type: payload.type, sub: String(payload.sub).slice(0, 6) + '...' });
      } catch (e) {
        steps.push({ step: 'jwt-error', error: String((e as Error)?.message || e).slice(0, 100) });
      }
    }

    const cookieHeader = c.req.header('Cookie') || '';
    const urSession = cookieHeader.split(';').map((s) => s.trim()).find((c) => c.startsWith('ur_session='));
    if (urSession) {
      steps.push({ step: 'ur_session-found', length: urSession.length });
    }

    return c.json({ success: true, trace: steps });
  } catch (e) {
    steps.push({ step: 'exception', error: String((e as Error)?.message || e).slice(0, 200) });
    return c.json({ success: false, trace: steps });
  }
});

// ─── Debug: kv-usage ─────────────────────────────────────────────────────
internalDiagnosticsRoutes.get('/api/debug/kv-usage', requireAdmin(), async (c) => {
  const env = c.env;
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

export { internalDiagnosticsRoutes };
