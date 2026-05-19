/**
 * Agency Public Profile API (Phase 1-7)
 *
 * 마운트: /api/agency-public
 *
 * 공개 라우트 (인증 X):
 *   GET /:slug                     — 에이전시 공개 정보 + 소속 셀러 (옵션) + 누적 매출 (옵션)
 *
 * 인증 라우트:
 *   PATCH /me/public               — 본인 공개 페이지 정보 편집 (slug, bio, logo, cover, 노출 옵션)
 *
 * 마이그레이션 0225 미적용 시 graceful degradation (slug 컬럼 없으면 슬러그 사용 불가).
 */

import { Hono, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { parseSessionCookie } from '@/worker/utils/session';
import type { Env } from '@/worker/types/env';

type AgencyCtx = {
  Bindings: Env;
  Variables: { agency: { id: number; email?: string } };
};

const publicApp = new Hono<{ Bindings: Env }>();
const authedApp = new Hono<AgencyCtx>();

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

authedApp.use('*', requireAgency);

function isValidSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,30}$/.test(s);
}

interface AgencyPublicRow {
  id: number;
  name: string;
  slug: string | null;
  bio: string | null;
  logo_url: string | null;
  cover_url: string | null;
  brand_color: string | null;
  public_show_revenue: number;
  public_show_sellers: number;
  created_at: string;
}

// 🛡️ 2026-05-16 (#20 white-label): brand_color 컬럼 자동 보장.
async function ensureBrandColumn(db: D1Database) {
  if (_done_ensureBrandColumn) return
  _done_ensureBrandColumn = true
  try { await db.prepare("ALTER TABLE agencies ADD COLUMN brand_color TEXT").run(); } catch { /* 이미 존재 */ }
}

// GET /:slug — 공개 페이지 데이터
publicApp.get('/:slug', async (c) => {
  const slug = c.req.param('slug').toLowerCase();
  if (!isValidSlug(slug)) {
    return c.json({ success: false, error: 'invalid slug' }, 400);
  }

  await ensureBrandColumn(c.env.DB);

  let row: AgencyPublicRow | null = null;
  try {
    row = await c.env.DB.prepare(`
      SELECT id, name, slug, bio, logo_url, cover_url, brand_color,
             COALESCE(public_show_revenue, 0) AS public_show_revenue,
             COALESCE(public_show_sellers, 1) AS public_show_sellers,
             created_at
      FROM agencies
      WHERE slug = ? AND status = 'active'
    `).bind(slug).first<AgencyPublicRow>();
  } catch {
    return c.json({ success: false, error: 'public_profile_not_supported' }, 503);
  }

  if (!row) return c.json({ success: false, error: 'not_found' }, 404);

  let totalSellers = 0;
  let topSellers: Array<{ id: number; business_name: string; profile_image: string | null }> = [];
  let totalRevenue = 0;

  if (row.public_show_sellers) {
    const cnt = await c.env.DB.prepare(`
      SELECT COUNT(*) AS cnt FROM agency_sellers WHERE agency_id = ?
    `).bind(row.id).first<{ cnt: number }>().catch(() => null);
    totalSellers = cnt?.cnt ?? 0;

    const top = await c.env.DB.prepare(`
      SELECT s.id, s.business_name, s.profile_image
      FROM agency_sellers ag_s
      JOIN sellers s ON s.id = ag_s.seller_id
      WHERE ag_s.agency_id = ? AND s.status = 'active'
      ORDER BY ag_s.created_at DESC
      LIMIT 12
    `).bind(row.id).all<{ id: number; business_name: string; profile_image: string | null }>().catch(() => ({ results: [] as any[] }));
    topSellers = top.results || [];
  }

  if (row.public_show_revenue) {
    const rev = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(o.total_amount), 0) AS rev
      FROM agency_sellers ag_s
      JOIN orders o ON o.seller_id = ag_s.seller_id
      WHERE ag_s.agency_id = ? AND o.payment_status = 'approved'
    `).bind(row.id).first<{ rev: number }>().catch(() => null);
    totalRevenue = rev?.rev ?? 0;
  }

  return c.json({
    success: true,
    data: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      bio: row.bio,
      logo_url: row.logo_url,
      cover_url: row.cover_url,
      brand_color: row.brand_color,
      created_at: row.created_at,
      stats: {
        total_sellers: row.public_show_sellers ? totalSellers : null,
        total_revenue: row.public_show_revenue ? totalRevenue : null,
        years_active: Math.max(1, Math.floor((Date.now() - new Date(row.created_at).getTime()) / (365 * 86400_000))),
      },
      top_sellers: topSellers,
    },
  });
});

// PATCH /me/public — 본인 공개 페이지 정보 편집
authedApp.patch('/me/public', async (c) => {
  const agency = c.get('agency');
  await ensureBrandColumn(c.env.DB);

  const body = await c.req.json<{
    slug?: string;
    bio?: string;
    logo_url?: string;
    cover_url?: string;
    brand_color?: string;
    public_show_revenue?: boolean;
    public_show_sellers?: boolean;
  }>().catch(() => ({} as any));

  const sets: string[] = [];
  const binds: any[] = [];

  if (body.slug !== undefined) {
    const s = body.slug.toLowerCase().trim();
    if (s && !isValidSlug(s)) {
      return c.json({ success: false, error: 'slug must be 3~31 chars: a-z 0-9 -' }, 400);
    }
    if (s) {
      const conflict = await c.env.DB.prepare(
        `SELECT id FROM agencies WHERE slug = ? AND id != ?`
      ).bind(s, agency.id).first().catch(() => null);
      if (conflict) return c.json({ success: false, error: 'slug already taken' }, 409);
    }
    sets.push('slug = ?');
    binds.push(s || null);
  }
  if (body.bio !== undefined) {
    sets.push('bio = ?');
    binds.push(body.bio.slice(0, 500));
  }
  if (body.logo_url !== undefined) {
    if (body.logo_url && !/^https?:\/\//i.test(body.logo_url)) {
      return c.json({ success: false, error: 'logo_url must start with http:// or https://' }, 400);
    }
    sets.push('logo_url = ?');
    binds.push(body.logo_url || null);
  }
  if (body.cover_url !== undefined) {
    if (body.cover_url && !/^https?:\/\//i.test(body.cover_url)) {
      return c.json({ success: false, error: 'cover_url must start with http:// or https://' }, 400);
    }
    sets.push('cover_url = ?');
    binds.push(body.cover_url || null);
  }
  if (body.brand_color !== undefined) {
    // HEX color (#RGB / #RRGGBB) 또는 빈 값
    if (body.brand_color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(body.brand_color)) {
      return c.json({ success: false, error: 'brand_color must be HEX (#RGB or #RRGGBB)' }, 400);
    }
    sets.push('brand_color = ?');
    binds.push(body.brand_color || null);
  }
  if (body.public_show_revenue !== undefined) {
    sets.push('public_show_revenue = ?');
    binds.push(body.public_show_revenue ? 1 : 0);
  }
  if (body.public_show_sellers !== undefined) {
    sets.push('public_show_sellers = ?');
    binds.push(body.public_show_sellers ? 1 : 0);
  }

  if (!sets.length) return c.json({ success: false, error: 'nothing to update' }, 400);
  binds.push(agency.id);

  try {
    await c.env.DB.prepare(`UPDATE agencies SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
  } catch (err) {
    return c.json({ success: false, error: 'update_failed_migration_pending' }, 503);
  }

  return c.json({ success: true });
});

// GET /me/public — 본인 공개 페이지 정보 조회 (편집용)
authedApp.get('/me/public', async (c) => {
  const agency = c.get('agency');
  await ensureBrandColumn(c.env.DB);
  try {
    const row = await c.env.DB.prepare(`
      SELECT slug, bio, logo_url, cover_url, brand_color,
             COALESCE(public_show_revenue, 0) AS public_show_revenue,
             COALESCE(public_show_sellers, 1) AS public_show_sellers
      FROM agencies WHERE id = ?
    `).bind(agency.id).first().catch(() => null);
    return c.json({ success: true, data: row || {} });
  } catch {
    return c.json({ success: true, data: {} });
  }
});

export { publicApp as agencyPublicRoutes, authedApp as agencyPublicEditRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureBrandColumn = false
