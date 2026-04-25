// ============================================================
// Side Banners Public Routes — GET /api/side-banners
//
// 사이드 배너 (공개 API, 인증 불필요)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const sideBannersPublicRoutes = new Hono<{ Bindings: Env }>()

sideBannersPublicRoutes.get('/api/side-banners', async (c) => {
  const env = c.env as Env;
  try {
    // Auto-create table if not exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS side_banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        link_url TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
    const { results } = await env.DB.prepare(
      `SELECT id, title, image_url, link_url, sort_order
       FROM side_banners WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC`
    ).all();
    return c.json({ success: true, data: results ?? [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});
