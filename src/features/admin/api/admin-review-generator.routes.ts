/**
 * Admin Review Generator Routes — 리뷰 자동 생성 (어드민 전용)
 *
 * 🛡️ 2026-04-22 배치 156 (TD-006 부분): admin-management.routes.ts 에서 분리.
 * AI (Claude Haiku) + 템플릿 모드 지원.
 *
 * 엔드포인트:
 * - POST   /reviews/generate                  — 리뷰 자동 생성 (template|ai)
 * - GET    /reviews/product/:productId        — 상품별 리뷰 목록
 * - DELETE /reviews/generated/:productId      — 생성된 리뷰 일괄 삭제
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { KOREAN_NAMES, REVIEW_TEMPLATES } from './review-templates';
export const adminReviewGeneratorRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

adminReviewGeneratorRoutes.post('/reviews/generate', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const { product_id, product_name, product_price, product_category, count, avg_rating, options, mode } = await c.req.json<{
      product_id: number; product_name?: string; product_price?: number; product_category?: string;
      count: number; avg_rating: number; options?: string[]; mode?: 'template' | 'ai';
    }>();

    if (!product_id || !count || count < 1 || count > 20000) {
      return c.json({ success: false, error: '상품 ID와 개수(1-20000)가 필요합니다' }, 400);
    }

    await writeAuditLog(c, {
      action: 'generate_fake_reviews',
      targetType: 'product',
      targetId: String(product_id),
      after: { count, avg_rating: avg_rating ?? 4.5, mode: mode ?? 'template' },
    });

    try {
      await DB.prepare(`
        CREATE TABLE IF NOT EXISTS product_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          user_id TEXT,
          user_name TEXT NOT NULL,
          rating INTEGER NOT NULL,
          content TEXT,
          selected_option TEXT,
          is_generated INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch { /* exists */ }

    let generated = 0;
    const targetRating = avg_rating || 4.5;
    const now = Date.now();
    const BATCH_SIZE = 50;

    // ── AI 모드 ──
    if (mode === 'ai') {
      const apiKey = (c.env as any).ANTHROPIC_API_KEY;
      if (!apiKey) return c.json({ success: false, error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다. Cloudflare 환경변수에 추가해주세요.' }, 400);

      const aiCount = Math.min(count, 500);
      const batchSize = 50;

      for (let batchStart = 0; batchStart < aiCount; batchStart += batchSize) {
        const batchCount = Math.min(batchSize, aiCount - batchStart);
        const ratingsForBatch = Array.from({ length: batchCount }, () =>
          Math.min(5, Math.max(1, Math.round(targetRating + (Math.random() - 0.5))))
        );

        try {
          const prompt = `한국 온라인 쇼핑몰의 상품 리뷰를 ${batchCount}개 작성해주세요.

상품 정보:
- 상품명: ${product_name || '상품'}
- 가격: ${product_price ? Number(product_price ?? 0).toLocaleString('ko-KR') + '원' : '미정'}
- 카테고리: ${product_category || '일반'}
${options?.length ? '- 옵션: ' + options.join(', ') : ''}

각 리뷰의 별점: ${ratingsForBatch.join(', ')}

규칙:
- 실제 구매자가 쓴 것처럼 자연스럽고 다양하게
- 1~3문장 길이, 구어체
- 별점 4-5점은 긍정, 3점은 보통, 1-2점은 부정
- 약 20%는 텍스트 없이 빈 문자열("")만 (별점만 매기는 사람)
- 이모지 가끔 사용 (30% 확률)
- 반복되는 표현 최소화

JSON 배열로만 응답. 각 항목: {"content": "리뷰 내용", "rating": 별점}
빈 리뷰는 {"content": "", "rating": 별점}`;

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            signal: AbortSignal.timeout(30_000),
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 4096,
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          const data: any = await res.json();
          const text = data?.content?.[0]?.text || '[]';

          const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed: unknown = JSON.parse(jsonStr);
          if (!Array.isArray(parsed)) {
            throw new Error('Expected array response from Claude');
          }
          for (const r of parsed) {
            if (
              typeof r !== 'object' || r === null ||
              typeof (r as any).rating !== 'number' ||
              typeof (r as any).content !== 'string'
            ) {
              throw new Error('Invalid review schema');
            }
          }
          const reviews = parsed as { content: string; rating: number }[];

          const stmts = reviews.map((r) => {
            const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)];
            const maskedName = name[0] + '*' + name[name.length - 1];
            const daysAgo = Math.floor(Math.random() * 90);
            const reviewDate = new Date(now - daysAgo * 86400000).toISOString();
            const option = options?.length ? options[Math.floor(Math.random() * options.length)] : null;

            return DB.prepare(
              'INSERT INTO product_reviews (product_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
            ).bind(product_id, maskedName, r.rating, r.content || null, option, reviewDate);
          });

          await DB.batch(stmts);
          generated += stmts.length;
        } catch (e) {
          if (import.meta.env.DEV) console.error('[AI Review] Batch error:', e);
        }
      }

      const soldIncrement = generated * (2 + Math.round(Math.random()));
      try { await DB.prepare('UPDATE products SET sold_count = COALESCE(sold_count, 0) + ? WHERE id = ?').bind(soldIncrement, product_id).run() } catch {}

      return c.json({ success: true, data: { generated }, message: `AI로 ${generated}개 리뷰가 생성되었습니다` });
    }

    // ── 템플릿 모드 ──
    for (let batchStart = 0; batchStart < count; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
      const stmts = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const rating = Math.min(5, Math.max(1, Math.round(targetRating + (Math.random() - 0.5))));
        const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)];
        const maskedName = name[0] + '*' + name[name.length - 1];
        const content = REVIEW_TEMPLATES[Math.floor(Math.random() * REVIEW_TEMPLATES.length)] || null;
        const option = options && options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null;
        const daysAgo = Math.floor(Math.random() * 90);
        const reviewDate = new Date(now - daysAgo * 86400000).toISOString();

        stmts.push(
          DB.prepare(`INSERT INTO product_reviews (product_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`)
            .bind(product_id, maskedName, rating, content, option, reviewDate)
        );
      }

      try {
        await DB.batch(stmts);
        generated += stmts.length;
      } catch { /* partial batch fail */ }
    }

    const soldIncrement = generated * (2 + Math.round(Math.random()));
    try { await DB.prepare('UPDATE products SET sold_count = COALESCE(sold_count, 0) + ? WHERE id = ?').bind(soldIncrement, product_id).run() } catch {}

    return c.json({ success: true, data: { generated, sold_increment: soldIncrement }, message: `${generated}개 리뷰 + ${soldIncrement}명 구매 수 반영` });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminReviewGeneratorRoutes.get('/reviews/product/:productId', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const productId = c.req.param('productId');
    const { results } = await DB.prepare('SELECT * FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 100').bind(productId).all();
    return c.json({ success: true, data: results ?? [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminReviewGeneratorRoutes.delete('/reviews/generated/:productId', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const productId = c.req.param('productId');
    const result = await DB.prepare('DELETE FROM product_reviews WHERE product_id = ? AND is_generated = 1').bind(productId).run();
    return c.json({ success: true, message: `${result.meta.changes}개 생성 리뷰 삭제됨` });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminReviewGeneratorRoutes;
