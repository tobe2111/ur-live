/**
 * FAQ Bot — Phase 3-2
 *
 * 마운트: /api/faq-bot
 *
 * Endpoints:
 *   GET /search?q=<query>&role=admin|seller|agency  — 가이드 텍스트 검색 + 매칭 섹션 반환
 *
 * 접근:
 *   - 단순 키워드 매칭 + 점수 (제목 가중치 3, 본문 1)
 *   - operation_guides 테이블 + (없으면) guide-seed.ts 의 시드 검색
 *   - 인증 X (공개 — 누구나 검색 가능)
 *
 * 외부 AI 미사용 (비용 + 의존성 회피). 추후 GPT/Claude 연동은 별도 PR.
 */

import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
// 🛡️ 2026-05-18: GUIDE_SEEDS (87KB) dynamic import — worker bundle 외 분리.

const app = new Hono<{ Bindings: Env }>();

interface SearchHit {
  role: 'admin' | 'seller' | 'agency';
  section_key: string;
  section_title: string;
  excerpt: string;
  score: number;
}

function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreMatch(query: string, title: string, content: string): { score: number; excerpt: string } {
  const qTokens = tokenize(query);
  if (!qTokens.length) return { score: 0, excerpt: '' };

  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();

  let score = 0;
  for (const t of qTokens) {
    // 제목 매치는 가중치 3
    if (titleLower.includes(t)) score += 3;
    // 본문 매치는 가중치 1
    const matches = contentLower.split(t).length - 1;
    score += matches;
  }

  // excerpt — 첫 번째 매치 위치 기준 ±100자
  let excerpt = '';
  for (const t of qTokens) {
    const idx = contentLower.indexOf(t);
    if (idx >= 0) {
      const start = Math.max(0, idx - 80);
      const end = Math.min(content.length, idx + 200);
      excerpt = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
      break;
    }
  }
  if (!excerpt) excerpt = content.slice(0, 200) + '...';

  return { score, excerpt };
}

// GET /search?q=...&role=...
app.get('/search', async (c) => {
  const query = c.req.query('q')?.trim() || '';
  const role = c.req.query('role') as 'admin' | 'seller' | 'agency' | undefined;

  if (query.length < 2) {
    return c.json({ success: false, error: 'query too short (min 2 chars)' }, 400);
  }

  const targetRoles: Array<'admin' | 'seller' | 'agency'> = role
    ? [role]
    : ['admin', 'seller', 'agency'];

  const hits: SearchHit[] = [];

  for (const r of targetRoles) {
    // 1차: DB 조회 (어드민 편집한 최신 컨텐츠)
    let sections: Array<{ section_key: string; title: string; content: string }> = [];
    try {
      const rows = await c.env.DB.prepare(`
        SELECT section_key, title, content
        FROM operation_guides
        WHERE guide_type = ?
      `).bind(r).all<{ section_key: string; title: string; content: string }>().catch(() => null);
      sections = rows?.results || [];
    } catch { /* skip */ }

    // 2차: DB 비어있으면 시드 사용 (dynamic import — 87KB)
    if (!sections.length) {
      const { GUIDE_SEEDS } = await import('./guide-seed');
      sections = GUIDE_SEEDS[r].map((s: any) => ({
        section_key: s.key,
        title: s.title,
        content: s.content,
      }));
    }

    for (const sec of sections) {
      const { score, excerpt } = scoreMatch(query, sec.title, sec.content);
      if (score > 0) {
        hits.push({
          role: r,
          section_key: sec.section_key,
          section_title: sec.title,
          excerpt,
          score,
        });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score);

  return c.json({
    success: true,
    data: {
      query,
      total: hits.length,
      hits: hits.slice(0, 10),
    },
  });
});

export { app as faqBotRoutes };
