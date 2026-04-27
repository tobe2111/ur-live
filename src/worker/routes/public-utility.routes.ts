/**
 * Public Utility Routes
 *
 * 인증 불필요한 공개 유틸리티 엔드포인트 — worker/index.ts 분할 (P1).
 *
 * - POST /api/csp-report           — CSP 위반 보고서 수집 (DB 저장)
 * - GET  /manifest.webmanifest     — PWA manifest (assets fetch + fallback)
 * - GET  /api/version              — 빌드 버전 + secret 존재 여부 (boolean)
 *
 * 작성일: 2026-04-26 (P1)
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const publicUtilityRoutes = new Hono<{ Bindings: Env }>()

// 모듈 스코프 캐시 (60초)
let _cachedBuildVersion: { version: string; fetchedAt: number } | null = null

// ── POST /api/csp-report ─────────────────────────
publicUtilityRoutes.post('/api/csp-report', async (c) => {
  try {
    const report = await c.req.json().catch(() => null)
    if (import.meta.env.DEV && report) console.warn('[CSP violation]', report)
    if (report && c.env.DB) {
      try {
        await c.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS csp_violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blocked_uri TEXT,
            violated_directive TEXT,
            document_uri TEXT,
            source_file TEXT,
            line_number INTEGER,
            user_agent TEXT,
            ip TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run()
        const body = (report as any)['csp-report'] || report
        await c.env.DB.prepare(`
          INSERT INTO csp_violations
            (blocked_uri, violated_directive, document_uri, source_file, line_number, user_agent, ip)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          String(body?.['blocked-uri'] || body?.blockedURL || '').slice(0, 500),
          String(body?.['violated-directive'] || body?.effectiveDirective || '').slice(0, 200),
          String(body?.['document-uri'] || body?.documentURL || '').slice(0, 500),
          String(body?.['source-file'] || body?.sourceFile || '').slice(0, 500),
          Number(body?.['line-number'] || body?.lineNumber || 0) || null,
          (c.req.header('User-Agent') || '').slice(0, 300),
          c.req.header('CF-Connecting-IP') || '',
        ).run()
      } catch { /* DB 실패도 CSP 에 영향 X */ }
    }
  } catch { /* swallow — parse errors don't surface */ }
  return c.body(null, 204)
})

// ── GET /manifest.webmanifest ────────────────────
publicUtilityRoutes.get('/manifest.webmanifest', async (c) => {
  try {
    const assets = (c.env as any).ASSETS
    if (assets) {
      const res = await assets.fetch(new Request(new URL('/manifest.webmanifest', c.req.url).toString()))
      if (res && res.ok) {
        const body = await res.text()
        return new Response(body, {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      }
    }
  } catch { /* fall through to inline */ }
  // Fallback: 인라인 매니페스트
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
  })
})

// ── GET /api/version ─────────────────────────────
publicUtilityRoutes.get('/api/version', async (c) => {
  // 공개 secret 존재 여부 boolean — 값 자체는 노출 안 됨. 500 진단용.
  const env = c.env as any
  const secrets = {
    JWT_SECRET: !!env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: !!env.REFRESH_TOKEN_SECRET,
    KAKAO_REST_API_KEY: !!env.KAKAO_REST_API_KEY,
    FIREBASE_PRIVATE_KEY: !!env.FIREBASE_PRIVATE_KEY,
    FIREBASE_CLIENT_EMAIL: !!env.FIREBASE_CLIENT_EMAIL,
    TOSS_SECRET_KEY: !!env.TOSS_SECRET_KEY,
    DB: !!env.DB,
  }
  try {
    const now = Date.now()
    if (_cachedBuildVersion && (now - _cachedBuildVersion.fetchedAt) < 60_000) {
      return c.json({ success: true, version: _cachedBuildVersion.version, secrets })
    }

    const origin = new URL(c.req.url).origin
    const htmlRes = await fetch(`${origin}/`, { cf: { cacheTtl: 30 } } as RequestInit)
    if (!htmlRes.ok) return c.json({ success: false, version: null, secrets }, 200)

    const html = await htmlRes.text()
    const match = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/)
    const version = match?.[1] || 'unknown'
    _cachedBuildVersion = { version, fetchedAt: now }
    return c.json({ success: true, version, secrets })
  } catch {
    return c.json({ success: false, version: null, secrets }, 200)
  }
})
