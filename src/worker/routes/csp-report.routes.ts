// ============================================================
// CSP Violation Report Routes — POST /api/csp-report
//
// Browsers POST violation reports here when CSP blocks a resource.
// Keep handler minimal and always return 204 to avoid influencing browser behavior.
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const cspReportRoutes = new Hono<{ Bindings: Env }>()

cspReportRoutes.post('/api/csp-report', async (c) => {
  try {
    const report = await c.req.json().catch(() => null);
    if (import.meta.env.DEV && report) console.warn('[CSP violation]', report);
    // 🛡️ 2026-04-22: CSP 위반 DB 저장 — 어드민이 이상 패턴 분석 가능.
    // 테이블은 auto-create (마이그레이션 미적용 환경 호환).
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
        `).run();
        const body = (report as Record<string, unknown>)['csp-report'] ?? report;
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
        ).run();
      } catch { /* DB 실패도 CSP 에 영향 주지 않음 */ }
    }
  } catch { /* swallow — never surface parse errors to the browser */ }
  return c.body(null, 204);
});
