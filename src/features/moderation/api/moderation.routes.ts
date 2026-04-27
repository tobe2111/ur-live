/**
 * Moderation Routes — Phase 3-3
 *
 * 마운트: /api/moderation
 *
 * Endpoints:
 *   POST /check     — 채팅 메시지 검사 (allow/warn/block + cleaned)
 *   GET  /stats     — 어드민: 차단 통계 (24h)
 *
 * 라이브 채팅 코드(chat WebSocket handler) 에서 send 직전 호출.
 * 또는 클라이언트가 미리 호출해서 차단된 메시지는 발송 안 함.
 */

import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { moderateChat } from '@/shared/utils/chat-moderation';

import { swallow } from '@/worker/utils/swallow';
const app = new Hono<{ Bindings: Env }>();

// POST /check — 채팅 메시지 사전 검사
app.post('/check', async (c) => {
  const body = await c.req.json<{ message: string }>().catch(() => ({ message: '' }));
  const message = (body.message || '').slice(0, 500);
  if (!message.trim()) {
    return c.json({ success: true, data: { action: 'allow', category: 'clean' } });
  }

  const result = moderateChat(message);

  // 차단/경고 발생 시 통계용 INSERT (선택 — 테이블 없으면 skip)
  if (result.action !== 'allow') {
    try {
      await c.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS moderation_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_excerpt TEXT,
          action TEXT,
          category TEXT,
          matched_patterns TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run().catch(swallow('moderation:api:moderation'));

      await c.env.DB.prepare(`
        INSERT INTO moderation_log (message_excerpt, action, category, matched_patterns)
        VALUES (?, ?, ?, ?)
      `).bind(
        message.slice(0, 100),
        result.action,
        result.category,
        JSON.stringify(result.matched_patterns)
      ).run().catch(swallow('moderation:api:moderation'));
    } catch { /* skip */ }
  }

  return c.json({ success: true, data: result });
});

// GET /stats — 24h 통계 (admin token 또는 internal)
app.get('/stats', async (c) => {
  const opsToken = (c.env as any).INTERNAL_API_TOKEN;
  const reqToken = c.req.header('X-Internal-Token');
  if (!opsToken || opsToken !== reqToken) {
    return c.json({ success: false, error: 'forbidden' }, 403);
  }

  try {
    const r = await c.env.DB.prepare(`
      SELECT category, action, COUNT(*) AS cnt
      FROM moderation_log
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY category, action
    `).all().catch(() => ({ results: [] as any[] }));
    return c.json({ success: true, data: r.results || [] });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

export { app as moderationRoutes };
