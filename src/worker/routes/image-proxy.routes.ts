// ============================================================
// Image Proxy Routes — GET /api/image/resize
//
// Image Optimization Proxy (Cloudflare Image Resizing)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const imageProxyRoutes = new Hono<{ Bindings: Env }>()

imageProxyRoutes.get('/api/image/resize', async (c) => {
  const url = c.req.query('url');
  // 🛡️ 2026-04-22: radix=10 명시 (legacy octal 해석 방지) + 범위 clamp
  const width = Math.min(2048, Math.max(16, parseInt(c.req.query('w') || '400', 10) || 400));
  const quality = Math.min(100, Math.max(10, parseInt(c.req.query('q') || '80', 10) || 80));

  if (!url) return c.json({ error: 'url required' }, 400);

  // SSRF 방어: 허용된 도메인만 프록시
  const ALLOWED_HOSTS = ['firebasestorage.googleapis.com', 'img.youtube.com', 'k.kakaocdn.net', 'images.unsplash.com', 'live.ur-team.com', 'ur-live.pages.dev']
  try {
    const parsed = new URL(url)
    if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
      return c.json({ error: 'domain not allowed' }, 403)
    }
  } catch {
    return c.json({ error: 'invalid url' }, 400)
  }

  try {
    const response = await fetch(url, {
      cf: {
        image: {
          width,
          quality,
          format: 'webp',
        }
      } as Record<string, unknown>
    });

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Content-Type', response.headers.get('Content-Type') || 'image/webp');

    return new Response(response.body, { headers });
  } catch {
    return c.redirect(url);
  }
});
