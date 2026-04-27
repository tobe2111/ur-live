/**
 * Optimal Live Time Recommendation — Phase 3-1
 *
 * 마운트: /api/seller/optimal-time
 *
 * Endpoints:
 *   GET /  — 본 셀러의 과거 라이브 데이터 분석 → 추천 라이브 시간 (요일/시간대)
 *
 * 알고리즘 (단순):
 *   1) 과거 90일 라이브 종료 메트릭 (live_stream_metrics) 조회
 *   2) 요일별 + 시간대별 평균 매출 + 평균 시청자 + 라이브 횟수 집계
 *   3) (avg_revenue * 0.5 + avg_peak_viewers * 0.3 + frequency_bonus * 0.2) 점수
 *   4) 점수 높은 상위 3개 시간 슬롯 추천
 *
 * 데이터 부족 (라이브 5회 미만) 시 일반 권장 (저녁 21~23시) 반환.
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import type { Env } from '@/worker/types/env';

type SellerCtx = {
  Bindings: Env;
  Variables: { seller: { id: number; email: string } };
};

const app = new Hono<SellerCtx>();

function getBearerToken(h?: string | null): string | null {
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

const requireSeller = async (c: any, next: Next) => {
  const token = getBearerToken(c.req.header('Authorization')) ?? '';
  if (!token) return c.json({ success: false, error: 'unauth' }, 401);
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as Record<string, unknown>;
    if (payload.type !== 'seller' || !payload.sub) return c.json({ success: false, error: 'unauth' }, 401);
    c.set('seller', { id: Number(payload.sub), email: String(payload.email) });
    return next();
  } catch {
    return c.json({ success: false, error: 'unauth' }, 401);
  }
};

app.use('*', requireSeller);

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MIN_DATA_POINTS = 5;

interface MetricRow {
  started_at: string;
  total_revenue: number;
  peak_viewers: number;
}

// GET / — 추천 시간
app.get('/', async (c) => {
  const seller = c.get('seller');

  let rows: MetricRow[] = [];
  try {
    const r = await c.env.DB.prepare(`
      SELECT ls.started_at, COALESCE(m.total_revenue, 0) AS total_revenue,
             COALESCE(m.peak_viewers, 0) AS peak_viewers
      FROM live_streams ls
      LEFT JOIN live_stream_metrics m ON m.live_stream_id = ls.id
      WHERE ls.seller_id = ?
        AND ls.started_at IS NOT NULL
        AND ls.started_at >= datetime('now', '-90 days')
    `).bind(seller.id).all<MetricRow>().catch(() => ({ results: [] as MetricRow[] }));
    rows = (r.results || []).filter((row) => row.started_at);
  } catch { /* skip */ }

  // 데이터 부족 시 일반 권장
  if (rows.length < MIN_DATA_POINTS) {
    return c.json({
      success: true,
      data: {
        based_on_data: false,
        message: `과거 라이브 데이터가 ${rows.length}건 — 데이터 ${MIN_DATA_POINTS}건 이상 쌓이면 맞춤 추천 가능합니다.`,
        recommendations: [
          { day_of_week: 2, hour: 21, label: '화 21:00', reason: '평일 저녁 (일반 권장)' },
          { day_of_week: 4, hour: 21, label: '목 21:00', reason: '평일 저녁 (일반 권장)' },
          { day_of_week: 0, hour: 20, label: '일 20:00', reason: '주말 저녁 (일반 권장)' },
        ],
      },
    });
  }

  // 슬롯 (요일 × 3시간 단위) 별 통계
  const slots = new Map<string, { count: number; revenue: number; viewers: number; day: number; hour: number }>();
  for (const row of rows) {
    const d = new Date(row.started_at);
    const dayOfWeek = d.getUTCDay();
    const hour = Math.floor(d.getUTCHours() / 3) * 3; // 0/3/6/9/12/15/18/21
    const key = `${dayOfWeek}-${hour}`;
    const slot = slots.get(key) || { count: 0, revenue: 0, viewers: 0, day: dayOfWeek, hour };
    slot.count++;
    slot.revenue += row.total_revenue;
    slot.viewers += row.peak_viewers;
    slots.set(key, slot);
  }

  const ranked = Array.from(slots.values())
    .map((s) => ({
      day_of_week: s.day,
      hour: s.hour,
      count: s.count,
      avg_revenue: Math.round(s.revenue / s.count),
      avg_viewers: Math.round(s.viewers / s.count),
      score: (s.revenue / s.count) * 0.5 + (s.viewers / s.count) * 1000 * 0.3 + s.count * 1000 * 0.2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // KST 보정 (UTC → KST = +9시간)
  const recommendations = ranked.map((r) => {
    const kstHour = (r.hour + 9) % 24;
    const kstDay = r.hour + 9 >= 24 ? (r.day_of_week + 1) % 7 : r.day_of_week;
    return {
      day_of_week: kstDay,
      hour: kstHour,
      label: `${DAY_LABELS[kstDay]} ${String(kstHour).padStart(2, '0')}:00`,
      reason: `과거 ${r.count}회 평균 매출 ${(r.avg_revenue / 10_000).toFixed(0)}만 / 피크 시청자 ${r.avg_viewers}명`,
      avg_revenue: r.avg_revenue,
      avg_viewers: r.avg_viewers,
    };
  });

  return c.json({
    success: true,
    data: {
      based_on_data: true,
      total_lives_analyzed: rows.length,
      recommendations,
    },
  });
});

export { app as optimalTimeRoutes };
