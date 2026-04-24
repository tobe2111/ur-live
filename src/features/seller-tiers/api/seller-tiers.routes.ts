/**
 * 셀러 등급/수수료 시스템 API
 *
 * GET  /api/seller-tiers              - 등급 목록 (공개)
 * GET  /api/seller-tiers/my           - 내 등급 정보 (셀러)
 * PUT  /api/seller-tiers/assign/:sellerId - 등급 수동 지정 (어드민)
 * POST /api/seller-tiers/recalculate  - 전체 셀러 등급 재계산 (어드민/크론)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import type { Env } from '@/worker/types/env';
import { ALLOWED_ORIGINS } from '@/shared/constants';

const sellerTiersRoutes = new Hono<{ Bindings: Env }>();

sellerTiersRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

async function ensureTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS seller_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        min_monthly_sales INTEGER NOT NULL DEFAULT 0,
        commission_rate REAL NOT NULL,
        benefits TEXT DEFAULT '[]',
        sort_order INTEGER DEFAULT 0
      )
    `).run();
    // 기본 등급 데이터 삽입
    const count = await DB.prepare('SELECT COUNT(*) as cnt FROM seller_tiers').first<{ cnt: number }>();
    if (!count?.cnt) {
      await DB.prepare(`INSERT OR IGNORE INTO seller_tiers (name, min_monthly_sales, commission_rate, benefits, sort_order) VALUES
        ('브론즈', 0, 12.0, '["기본 정산"]', 1),
        ('실버', 1000000, 10.0, '["기본 정산", "우선 노출"]', 2),
        ('골드', 5000000, 8.0, '["기본 정산", "우선 노출", "배너 노출"]', 3),
        ('플래티넘', 10000000, 6.0, '["기본 정산", "우선 노출", "배너 노출", "전담 매니저"]', 4),
        ('다이아', 30000000, 4.0, '["기본 정산", "우선 노출", "배너 노출", "전담 매니저", "수수료 최저"]', 5)
      `).run();
    }
  } catch { /* 이미 존재 */ }
}

// GET /api/seller-tiers — 등급 목록 (공개)
sellerTiersRoutes.get('/', async (c) => {
  const { DB } = c.env;
  await ensureTable(DB);

  const { results } = await DB.prepare(
    'SELECT id, name, min_monthly_sales, commission_rate, benefits, sort_order FROM seller_tiers ORDER BY sort_order'
  ).all();

  return c.json({
    success: true,
    data: (results ?? []).map((t: any) => ({
      ...t,
      benefits: (() => {
        try { return JSON.parse(t.benefits || '[]'); } catch { return []; }
      })(),
    })),
  });
});

// GET /api/seller-tiers/my — 내 등급 정보
sellerTiersRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

  const { DB } = c.env;
  await ensureTable(DB);

  // 셀러 정보 조회
  const seller = await DB.prepare(
    'SELECT id, name, commission_rate FROM sellers WHERE id = ? OR username = ?'
  ).bind(user.id, user.id).first<{ id: number; name: string; commission_rate: number }>();

  if (!seller) return c.json({ success: false, error: '셀러 정보를 찾을 수 없습니다' }, 404);

  // 최근 30일 매출
  const sales = await DB.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as monthly_sales
    FROM orders
    WHERE seller_id = ? AND status IN ('DONE', 'DELIVERED', 'PAID')
      AND created_at >= datetime('now', '-30 days')
  `).bind(seller.id).first<{ monthly_sales: number }>();

  const monthlySales = sales?.monthly_sales ?? 0;

  // 현재 등급 계산
  const tier = await DB.prepare(`
    SELECT name, commission_rate, benefits, min_monthly_sales
    FROM seller_tiers
    WHERE min_monthly_sales <= ?
    ORDER BY min_monthly_sales DESC
    LIMIT 1
  `).bind(monthlySales).first<{ name: string; commission_rate: number; benefits: string; min_monthly_sales: number }>();

  // 다음 등급
  const nextTier = await DB.prepare(`
    SELECT name, commission_rate, min_monthly_sales
    FROM seller_tiers
    WHERE min_monthly_sales > ?
    ORDER BY min_monthly_sales ASC
    LIMIT 1
  `).bind(monthlySales).first<{ name: string; commission_rate: number; min_monthly_sales: number }>();

  return c.json({
    success: true,
    data: {
      seller_id: seller.id,
      seller_name: seller.name,
      current_commission_rate: seller.commission_rate,
      monthly_sales: monthlySales,
      tier: {
        name: tier?.name ?? '브론즈',
        commission_rate: tier?.commission_rate ?? 12.0,
        benefits: (() => {
          try { return JSON.parse(tier?.benefits || '[]'); } catch { return []; }
        })(),
      },
      next_tier: nextTier ? {
        name: nextTier.name,
        commission_rate: nextTier.commission_rate,
        remaining_sales: nextTier.min_monthly_sales - monthlySales,
      } : null,
    },
  });
});

// POST /api/seller-tiers/recalculate — 전체 셀러 등급 재계산
sellerTiersRoutes.post('/recalculate', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') {
    return c.json({ success: false, error: '관리자만 접근 가능합니다' }, 403);
  }

  const { DB } = c.env;
  await ensureTable(DB);

  // 모든 활성 셀러의 30일 매출 조회
  const { results: sellers } = await DB.prepare(`
    SELECT s.id, s.name, s.commission_rate,
           COALESCE(SUM(o.total_amount), 0) as monthly_sales
    FROM sellers s
    LEFT JOIN orders o ON s.id = o.seller_id
      AND o.status IN ('DONE', 'DELIVERED', 'PAID')
      AND o.created_at >= datetime('now', '-30 days')
    GROUP BY s.id
  `).all();

  const { results: tiers } = await DB.prepare(
    'SELECT min_monthly_sales, commission_rate FROM seller_tiers ORDER BY min_monthly_sales DESC'
  ).all();

  let updated = 0;
  for (const seller of (sellers ?? [])) {
    const s = seller as { monthly_sales?: number; [key: string]: unknown };
    // 매출에 맞는 등급 찾기
    const matchedTier = (tiers ?? []).find((t: { min_monthly_sales?: number }) => (s.monthly_sales ?? 0) >= (t.min_monthly_sales ?? 0));
    if (matchedTier && matchedTier.commission_rate !== s.commission_rate) {
      await DB.prepare('UPDATE sellers SET commission_rate = ? WHERE id = ?')
        .bind(matchedTier.commission_rate, s.id).run();
      updated++;
    }
  }

  return c.json({
    success: true,
    data: { total_sellers: sellers?.length ?? 0, updated },
    message: `${updated}명의 셀러 등급이 업데이트되었습니다.`,
  });
});

export { sellerTiersRoutes };
