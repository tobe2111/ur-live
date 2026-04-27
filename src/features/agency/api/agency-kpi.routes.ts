/**
 * Agency 6대 KPI Dashboard API (Phase 1-4)
 *
 * TikTok Backstage 의 6대 핵심 지표를 우리 서비스에 적응:
 *   1) total_revenue          — 총 딜 매출 (TikTok 의 다이아몬드 매핑)
 *   2) live_progress_rate     — 라이브 진행률 (라이브한 셀러 / 전체 셀러)
 *   3) effective_progress_rate— 유효 라이브 진행률 (30분+ 라이브 셀러 비율)
 *   4) active_sellers         — 활성 셀러 수 (이번 기간 1+ 라이브)
 *   5) effective_active       — 유효 활성 셀러 (이번 기간 30분+ 라이브)
 *   6) new_sellers            — 신규 셀러 수 (이번 기간 가입)
 *
 * 정책 (느슨): 강제 패널티 X — 참고/벤치마크용.
 *
 * 라우트:
 *   GET /api/agency/kpi?range=week|month  — 본인 에이전시 KPI 6개
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { parseSessionCookie } from '@/worker/utils/session';
import type { Env } from '@/worker/types/env';

type AgencyCtx = {
  Bindings: Env;
  Variables: { agency: { id: number; email?: string } };
};

const app = new Hono<AgencyCtx>();

function getBearerToken(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  if (!token) return null;
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>;
    if (payload.type !== 'agency' || !payload.sub) return null;
    return { id: Number(payload.sub), email: String(payload.email) };
  } catch { return null; }
}

const requireAgency = async (c: any, next: Next) => {
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getBearerToken(c.req.header('Authorization')) ?? '');
  if (!payload) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency']);
      if (sess && sess.userId) payload = { id: Number(sess.userId), email: sess.email || '' };
    } catch { /* */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401);
  c.set('agency', payload);
  return next();
};

app.use('*', requireAgency);

const EFFECTIVE_LIVE_DURATION_SEC = 30 * 60; // 30분

// GET /api/agency/kpi?range=week|month
app.get('/', async (c) => {
  const agency = c.get('agency');
  const range = c.req.query('range') || 'week';

  const now = new Date();
  const startDate = new Date(now);
  if (range === 'month') {
    startDate.setDate(now.getDate() - 30);
  } else {
    startDate.setDate(now.getDate() - 7);
  }
  const startISO = startDate.toISOString();

  try {
    // 전체 소속 셀러 수 (분모)
    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM agency_sellers WHERE agency_id = ?`
    ).bind(agency.id).first<{ cnt: number }>().catch(() => null);
    const totalSellers = totalRow?.cnt ?? 0;

    // 1) 총 매출 (period 동안 결제 완료)
    const revRow = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(o.total_amount), 0) AS revenue
      FROM agency_sellers ag_s
      JOIN orders o ON o.seller_id = ag_s.seller_id
      WHERE ag_s.agency_id = ?
        AND o.payment_status = 'approved'
        AND o.created_at >= ?
    `).bind(agency.id, startISO).first<{ revenue: number }>().catch(() => null);
    const totalRevenue = revRow?.revenue ?? 0;

    // 2) 활성 셀러 + 4) 유효 활성 셀러 (period 동안 1+ 라이브 / 30분+ 라이브)
    // live_streams 의 ended_at - started_at 으로 duration 계산. 없으면 created_at 기준 1+ 라이브로 fallback.
    const liveRows = await c.env.DB.prepare(`
      SELECT
        ag_s.seller_id,
        COUNT(ls.id) AS live_count,
        MAX(
          CASE WHEN ls.ended_at IS NOT NULL AND ls.started_at IS NOT NULL
            THEN CAST((julianday(ls.ended_at) - julianday(ls.started_at)) * 86400 AS INTEGER)
            ELSE 0 END
        ) AS max_duration_sec
      FROM agency_sellers ag_s
      LEFT JOIN live_streams ls ON ls.seller_id = ag_s.seller_id AND ls.created_at >= ?
      WHERE ag_s.agency_id = ?
      GROUP BY ag_s.seller_id
    `).bind(startISO, agency.id).all<{
      seller_id: number; live_count: number; max_duration_sec: number;
    }>().catch(() => ({ results: [] as any[] }));

    const liveResults = liveRows.results || [];
    const activeSellers = liveResults.filter((r) => r.live_count > 0).length;
    const effectiveActive = liveResults.filter((r) => r.max_duration_sec >= EFFECTIVE_LIVE_DURATION_SEC).length;

    // 6) 신규 셀러 (period 동안 가입한 셀러)
    const newRow = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT s.id) AS cnt
      FROM agency_sellers ag_s
      JOIN sellers s ON s.id = ag_s.seller_id
      WHERE ag_s.agency_id = ?
        AND s.created_at >= ?
    `).bind(agency.id, startISO).first<{ cnt: number }>().catch(() => null);
    const newSellers = newRow?.cnt ?? 0;

    // 3) 라이브 진행률 + 5) 유효 진행률 (소속 셀러 대비 비율, %)
    const liveProgressRate = totalSellers > 0 ? Math.round((activeSellers / totalSellers) * 1000) / 10 : 0;
    const effectiveProgressRate = totalSellers > 0 ? Math.round((effectiveActive / totalSellers) * 1000) / 10 : 0;

    return c.json({
      success: true,
      data: {
        range,
        period: { start: startISO, end: now.toISOString() },
        total_sellers: totalSellers,
        kpi: {
          total_revenue: totalRevenue,
          live_progress_rate: liveProgressRate,         // %
          effective_progress_rate: effectiveProgressRate, // %
          active_sellers: activeSellers,
          effective_active: effectiveActive,
          new_sellers: newSellers,
        },
      },
    });
  } catch (err) {
    console.error('[agency-kpi] failed:', err);
    return c.json({
      success: true,
      data: {
        range,
        total_sellers: 0,
        kpi: {
          total_revenue: 0, live_progress_rate: 0, effective_progress_rate: 0,
          active_sellers: 0, effective_active: 0, new_sellers: 0,
        },
      },
    });
  }
});

export { app as agencyKpiRoutes };
