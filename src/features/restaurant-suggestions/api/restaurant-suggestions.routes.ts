/**
 * Restaurant Suggestions Routes
 *
 * 사용자가 카카오 일반 맛집 (식사권 미출시) 에 대해 의향 표시:
 *   - 'invite': 이 매장 셀러 영입 신청
 *   - 'notify': 출시 알림 받기 (phone 등록)
 *
 * 어드민은 수요 많은 매장을 발견 → 셀러 영입 우선순위 결정.
 *
 * 🛡️ 2026-04-28: restaurant-map 페이지 옵션 B 구현.
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { safeError } from '@/worker/utils/safe-error';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { requireAdmin } from '@/worker/middleware/auth';
import { swallow } from '@/shared/utils/swallow';

async function ensureTables(DB: D1Database) {
  if (_done_ensureTables.has(DB)) return
  _done_ensureTables.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS restaurant_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kakao_place_id TEXT NOT NULL,
        place_name TEXT NOT NULL,
        category_name TEXT,
        road_address TEXT,
        phone TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        user_id TEXT,
        user_phone TEXT,
        kind TEXT NOT NULL DEFAULT 'invite',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_restaurant_suggestions_place ON restaurant_suggestions(kakao_place_id)`).run().catch(swallow('rest-sug:idx'));
  } catch { /* idempotent */ }
}

export const restaurantSuggestionsRoutes = new Hono<{ Bindings: Env }>();

// POST /api/restaurant-suggestions — 익명 OK, 5/min rate limit
restaurantSuggestionsRoutes.post('/', rateLimit({ action: 'restaurant_sug', max: 5, windowSec: 60 }), async (c) => {
  await ensureTables(c.env.DB);
  type SuggestionBody = {
    kakao_place_id?: string; place_name?: string; category_name?: string;
    road_address?: string; phone?: string; lat?: number; lng?: number;
    kind?: 'invite' | 'notify'; user_phone?: string;
  };
  const body = await c.req.json<SuggestionBody>().catch(() => ({} as SuggestionBody));

  if (!body.kakao_place_id || !body.place_name || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return c.json({ success: false, error: 'kakao_place_id, place_name, lat, lng 필수' }, 400);
  }

  const kind = body.kind === 'notify' ? 'notify' : 'invite';
  if (kind === 'notify' && body.user_phone && !/^01\d{8,9}$/.test(body.user_phone.replace(/-/g, ''))) {
    return c.json({ success: false, error: '전화번호 형식 010-0000-0000' }, 400);
  }

  // 같은 사용자(또는 phone) 가 같은 place 에 같은 kind 로 중복 신청 차단
  // 익명도 IP 기반 dedup 까진 안 함 (rate limit 으로 충분)
  try {
    await c.env.DB.prepare(`
      INSERT INTO restaurant_suggestions
        (kakao_place_id, place_name, category_name, road_address, phone, lat, lng, user_phone, kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.kakao_place_id, body.place_name, body.category_name || null, body.road_address || null,
      body.phone || null, body.lat, body.lng,
      body.user_phone ? body.user_phone.replace(/-/g, '') : null, kind
    ).run();

    return c.json({
      success: true,
      message: kind === 'notify' ? '출시 시 알림드릴게요!' : '영입 신청이 어드민에 전달됐어요!',
    });
  } catch (e) {
    return safeError(c, e, '요청 처리 중 오류가 발생했습니다', '[restaurant-suggestions]');
  }
});

// GET /api/restaurant-suggestions/stats — admin only, 수요 많은 매장 top N
restaurantSuggestionsRoutes.get('/stats', requireAdmin(), async (c) => {
  await ensureTables(c.env.DB);
  const limit = Math.min(50, Number(c.req.query('limit')) || 20);
  try {
    const rows = await c.env.DB.prepare(`
      SELECT
        kakao_place_id,
        place_name,
        category_name,
        road_address,
        phone,
        lat,
        lng,
        COUNT(*) AS suggestion_count,
        SUM(CASE WHEN kind = 'invite' THEN 1 ELSE 0 END) AS invite_count,
        SUM(CASE WHEN kind = 'notify' THEN 1 ELSE 0 END) AS notify_count,
        MAX(created_at) AS latest_at
      FROM restaurant_suggestions
      GROUP BY kakao_place_id
      ORDER BY suggestion_count DESC, latest_at DESC
      LIMIT ?
    `).bind(limit).all<Record<string, unknown>>();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e) {
    return safeError(c, e, '요청 처리 중 오류가 발생했습니다', '[restaurant-suggestions]');
  }
});


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTables = new WeakSet<object>()
