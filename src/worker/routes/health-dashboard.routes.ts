// ============================================================
// Health Dashboard Routes — GET /api/_internal/health-dashboard
//
// 🩺 상세 헬스 대시보드 (2026-04-22 추가)
// DB latency, 테이블 행 수, 최근 에러 수, 배포 시점 등 운영자용 종합 지표
//
// 🛡️ 2026-04-22: admin 전용 (또는 INTERNAL_OPS_TOKEN 헤더 매치).
// 이전: 누구나 호출 가능 → DB 스키마 조작, 내부 구조 노출 위험.
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAdmin } from '../middleware/auth'
import { getSlowQueryStats } from '../utils/slow-query-logger'

export const healthDashboardRoutes = new Hono<{ Bindings: Env }>()

healthDashboardRoutes.get('/api/_internal/health-dashboard', requireAdmin(), async (c) => {
  const env = c.env;
  const DB = env.DB;
  const start = Date.now();

  // DB latency 측정
  let dbLatency = 0;
  let dbOk = false;
  try {
    const t0 = Date.now();
    await DB.prepare('SELECT 1').first();
    dbLatency = Date.now() - t0;
    dbOk = true;
  } catch {}

  // 주요 테이블 행 수
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

  // 최근 24시간 주문/결제 건수
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
  } catch {}

  // 환경 변수 sanity
  const envCheck = {
    JWT_SECRET: !!env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: !!env.REFRESH_TOKEN_SECRET,
    KAKAO_REST_API_KEY: !!env.KAKAO_REST_API_KEY,
    FIREBASE_PRIVATE_KEY: !!env.FIREBASE_PRIVATE_KEY,
    TOSS_SECRET_KEY: !!env.TOSS_SECRET_KEY,
    RESEND_WEBHOOK_SECRET: !!env.RESEND_WEBHOOK_SECRET,
    INTERNAL_CRON_TOKEN: !!env.INTERNAL_CRON_TOKEN,
  };
  const secretsTotal = Object.keys(envCheck).length;
  const secretsSet = Object.values(envCheck).filter(Boolean).length;

  // Slow query 통계 (24h)
  let slowQueries: Array<{ label: string; count: number; avg_ms: number; max_ms: number }> = [];
  try {
    slowQueries = await getSlowQueryStats(DB, 24);
  } catch {}

  // 최근 5xx spike 기록
  let recent5xxSpikes = 0;
  try {
    const row = await DB.prepare(
      "SELECT COUNT(*) as c FROM rate_limit_attempts WHERE action='5xx_spike' AND window_start >= ?"
    ).bind(Math.floor(Date.now() / 1000) - 86400).first<{ c: number }>();
    recent5xxSpikes = row?.c ?? 0;
  } catch {}

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
    performance: {
      slowQueriesLast24h: slowQueries.length,
      topSlow: slowQueries.slice(0, 5),
    },
    errors: {
      spikesLast24h: recent5xxSpikes,
    },
  });
});
