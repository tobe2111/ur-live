/**
 * Agency Match Suggestions API (2026-05-05)
 *
 * Migration 0245 적용 후 동작.
 *
 * GET  /match-suggestions          — 내 에이전시로 들어온 매칭 제안 목록 (pending)
 * POST /match-suggestions/:id/accept — 제안 수락 → agency_sellers 에 INSERT
 * POST /match-suggestions/:id/decline — 제안 거절
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { requireAgency, type AgencyVars } from '@/lib/agency-shared';
import { swallow } from '@/worker/utils/swallow';

const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>();
app.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }));
app.use('*', requireAgency);

// GET /match-suggestions
app.get('/match-suggestions', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number };
  const DB = c.env.DB;

  const rows = await DB.prepare(`
    SELECT
      ams.id,
      ams.seller_id,
      ams.score,
      ams.status,
      ams.match_reason,
      ams.created_at,
      ams.expires_at,
      s.name       AS seller_name,
      s.business_name,
      s.email      AS seller_email,
      s.created_at AS seller_created_at,
      COALESCE(s.tier, 'new') AS seller_tier,
      COALESCE(s.tier_score, 0) AS seller_tier_score
    FROM agency_match_suggestions ams
    JOIN sellers s ON s.id = ams.seller_id
    WHERE ams.agency_id = ?
      AND ams.status = 'pending'
      AND ams.expires_at > datetime('now')
    ORDER BY ams.score DESC, ams.created_at DESC
    LIMIT 50
  `).bind(agencyId).all().catch(() => null);

  return c.json({ suggestions: rows?.results ?? [] });
});

// POST /match-suggestions/:id/accept
app.post('/match-suggestions/:id/accept', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number };
  const suggestionId = Number(c.req.param('id'));
  if (!Number.isFinite(suggestionId)) return c.json({ error: 'invalid id' }, 400);

  const DB = c.env.DB;

  const suggestion = await DB.prepare(`
    SELECT seller_id, status FROM agency_match_suggestions
    WHERE id = ? AND agency_id = ?
  `).bind(suggestionId, agencyId).first<{ seller_id: number; status: string }>().catch(() => null);

  if (!suggestion) return c.json({ error: 'not found' }, 404);
  if (suggestion.status !== 'pending') return c.json({ error: 'already responded' }, 409);

  // 수락: agency_sellers 에 추가 + status 갱신
  await DB.batch([
    DB.prepare(`
      INSERT OR IGNORE INTO agency_sellers (agency_id, seller_id)
      VALUES (?, ?)
    `).bind(agencyId, suggestion.seller_id),
    DB.prepare(`
      UPDATE agency_match_suggestions
         SET status = 'accepted', responded_at = datetime('now')
       WHERE id = ?
    `).bind(suggestionId),
    // 셀러에게 수락 알림
    DB.prepare(`
      INSERT INTO dashboard_notifications
        (recipient_type, recipient_id, type, title, message, link, created_at)
      VALUES ('seller', ?, 'agency_match_accepted', '에이전시 매칭이 확정되었습니다! 🎉',
        '에이전시가 매칭을 수락했습니다. 이제 에이전시의 지원을 받을 수 있습니다.',
        '/seller/agency', datetime('now'))
    `).bind(String(suggestion.seller_id)),
  ]).catch(swallow('agency:match-suggestions:accept'));

  return c.json({ ok: true });
});

// POST /match-suggestions/:id/decline
app.post('/match-suggestions/:id/decline', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number };
  const suggestionId = Number(c.req.param('id'));
  if (!Number.isFinite(suggestionId)) return c.json({ error: 'invalid id' }, 400);

  const DB = c.env.DB;

  const suggestion = await DB.prepare(`
    SELECT seller_id, status FROM agency_match_suggestions
    WHERE id = ? AND agency_id = ?
  `).bind(suggestionId, agencyId).first<{ seller_id: number; status: string }>().catch(() => null);

  if (!suggestion) return c.json({ error: 'not found' }, 404);
  if (suggestion.status !== 'pending') return c.json({ error: 'already responded' }, 409);

  await DB.prepare(`
    UPDATE agency_match_suggestions
       SET status = 'declined', responded_at = datetime('now')
     WHERE id = ?
  `).bind(suggestionId).run().catch(swallow('agency:match-suggestions:decline'));

  return c.json({ ok: true });
});

export { app as agencyMatchSuggestionsRoutes };
