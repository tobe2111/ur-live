import { Hono } from 'hono';
import type { Env } from '../types/env';

export const manifestRoutes = new Hono<{ Bindings: Env }>();

// v32 FIX: PWA manifest MIME type 명시 (Workers asset serving은 _headers 미지원)
manifestRoutes.get('/manifest.webmanifest', async (c) => {
  try {
    const assets = (c.env as any).ASSETS;
    if (assets) {
      const res = await assets.fetch(new Request(new URL('/manifest.webmanifest', c.req.url).toString()));
      if (res && res.ok) {
        const body = await res.text();
        return new Response(body, {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
  } catch {}
  return new Response(JSON.stringify({
    name: '유어딜',
    short_name: '유어딜',
    start_url: '/',
    display: 'standalone',
    background_color: '#020202',
    theme_color: '#020202',
    orientation: 'portrait',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
