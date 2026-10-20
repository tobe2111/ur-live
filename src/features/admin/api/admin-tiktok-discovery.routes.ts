/**
 * Admin TikTok Discovery — Phase 3-4
 *
 * 마운트: /api/admin/tiktok-discovery
 *
 * 컨셉: TikTok 연동된 셀러들의 비디오 데이터로 잠재 라이브 셀러 발굴.
 *   - 조회수 높은 비디오 → 활성 영상 콘텐츠 → 라이브 가능성 ↑
 *   - 어드민이 셀러에게 "라이브 시작" 추천 메시지 발송 도구
 *
 * Endpoints:
 *   GET / — 등록 비디오 통계 (조회수/좋아요 정렬, 셀러별 그룹)
 *
 * 마이그레이션 0221 (tiktok_videos_cache) 미적용 시 graceful skip.
 */

import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireAdmin } from '@/worker/middleware/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('*', requireAdmin());

interface DiscoveryRow {
  seller_id: number;
  seller_name: string | null;
  video_count: number;
  total_view_count: number;
  total_like_count: number;
  avg_view_count: number;
  best_video_title: string | null;
  best_video_views: number;
  is_seller_active: number;
}

// GET / — 발굴 후보
app.get('/', async (c) => {
  let rows: DiscoveryRow[] = [];

  try {
    const r = await c.env.DB.prepare(`
      SELECT
        s.id AS seller_id,
        s.business_name AS seller_name,
        COUNT(v.video_id) AS video_count,
        COALESCE(SUM(v.view_count), 0) AS total_view_count,
        COALESCE(SUM(v.like_count), 0) AS total_like_count,
        COALESCE(AVG(v.view_count), 0) AS avg_view_count,
        (SELECT title FROM tiktok_videos_cache WHERE seller_id = s.id ORDER BY view_count DESC LIMIT 1) AS best_video_title,
        (SELECT view_count FROM tiktok_videos_cache WHERE seller_id = s.id ORDER BY view_count DESC LIMIT 1) AS best_video_views,
        (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM live_streams WHERE seller_id = s.id AND created_at >= datetime('now', '-30 days')) AS is_seller_active
      FROM sellers s
      JOIN tiktok_videos_cache v ON v.seller_id = s.id
      GROUP BY s.id
      ORDER BY total_view_count DESC
      LIMIT 100
    `).all<DiscoveryRow>().catch(() => null);
    rows = r?.results || [];
  } catch {
    return c.json({
      success: true,
      data: [],
      message: '마이그레이션 0221 미적용 또는 TikTok 비디오 캐시 데이터 없음.',
    });
  }

  // 발굴 점수 — 조회수 + 활성도 (라이브 안 한 셀러가 우선순위 ↑)
  const scored = rows.map((r) => ({
    ...r,
    score: r.total_view_count * (r.is_seller_active ? 0.3 : 1.0),
    recommendation: r.is_seller_active
      ? '이미 라이브 활성 — 라이브 빈도 향상 권장'
      : '라이브 미경험 — 첫 라이브 권유 강력 추천',
  }));

  scored.sort((a, b) => b.score - a.score);

  return c.json({ success: true, data: scored });
});

export { app as adminTikTokDiscoveryRoutes };
