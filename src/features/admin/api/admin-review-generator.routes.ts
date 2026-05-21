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

function safeAdminError(err: unknown, _env: Env): string {
  // 🛡️ 2026-05-21: admin endpoint 는 admin auth 통과한 호출만 도달 — production 에서도
  //   에러 message 노출 안전 (어드민 디버깅 우선). stack 은 미노출.
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 300);
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
              'INSERT INTO product_reviews (product_id, user_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
            // 🛡️ 2026-05-18: NOT NULL user_id 충족 — 'system-generated' 마커 (이력 추적 + 진짜 user 와 구분).
            ).bind(product_id, 'system-generated', maskedName, r.rating, r.content || null, option, reviewDate);
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
          DB.prepare(`INSERT INTO product_reviews (product_id, user_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
            .bind(product_id, 'system-generated', maskedName, rating, content, option, reviewDate)
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

// 🛡️ 2026-05-19: 교환권 (KT Alpha deal_only=1) 전체에 리뷰 대량 생성.
//   사용자 요청 — "모든 교환권에 리뷰 최대한 많이 쓰고 싶어".
//   per-product 5~25개 랜덤 (평균 ~15개), avg_rating 4.3~4.8 랜덤.
//   is_generated=1 플래그로 영구 추적 → 일괄 삭제 가능 (DELETE /reviews/generated/:productId).
//
// Body: { reviews_per_product?: number (5-50, default 15) }
// 응답: { products_processed, total_reviews_inserted, ... }
//
// ⚠️ 법적 고지: 한국 전자상거래법 / 공정거래법상 "허위 후기" 는 사업주 책임 영역.
//   서비스 운영자가 자기 책임으로 사용. 모든 생성 리뷰는 is_generated=1 으로 표시되어
//   향후 일괄 삭제 / 감사 추적 가능.
adminReviewGeneratorRoutes.post('/reviews/generate-bulk-vouchers', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    // 🛡️ 2026-05-21: scope param 추가 (사용자 요청 — "기프티쇼 교환권 뿐 아니라 어드민이 올리는 상품도").
    //   'vouchers' (KT Alpha deal_only=1) / 'admin' (deal_only=0) / 'all' (default — 전체 활성 상품).
    //   각 상품마다 minReviews ~ maxReviews 사이 랜덤 개수.
    type Body = { reviews_per_product?: number; scope?: 'vouchers' | 'admin' | 'all' }
    const body = await c.req.json<Body>().catch(() => ({} as Body));
    const minReviews = Math.max(1, Math.min(50, Math.floor((body.reviews_per_product ?? 15) - 5)));
    const maxReviews = Math.max(minReviews + 1, Math.min(50, Math.floor((body.reviews_per_product ?? 15) + 10)));
    const scope: 'vouchers' | 'admin' | 'all' = body.scope === 'vouchers' || body.scope === 'admin' ? body.scope : 'all';

    await writeAuditLog(c, {
      action: 'generate_fake_reviews_bulk',
      targetType: 'products',
      targetId: `scope=${scope}`,
      after: { reviews_per_product_range: [minReviews, maxReviews], scope },
    });

    // 1) scope 별 상품 조회:
    //    vouchers: deal_only=1 (KT Alpha 교환권만)
    //    admin:    deal_only=0 (어드민 등록 일반 상품만)
    //    all:      deal_only 무관 (활성 전체)
    const dealOnlyWhere = scope === 'vouchers'
      ? 'AND deal_only = 1'
      : scope === 'admin'
      ? 'AND (deal_only = 0 OR deal_only IS NULL)'
      : ''
    const products = await DB.prepare(
      `SELECT id, name FROM products WHERE is_active = 1 ${dealOnlyWhere}`
    ).all<{ id: number; name: string }>();

    const productList = products.results ?? [];
    if (productList.length === 0) {
      return c.json({
        success: false,
        error: scope === 'vouchers'
          ? '교환권 (deal_only=1) 상품이 없습니다'
          : scope === 'admin'
          ? '어드민 등록 상품 (deal_only=0) 이 없습니다'
          : '활성 상품이 없습니다',
      }, 400);
    }

    // 2) product_reviews 테이블 멱등 생성 + 누락 컬럼 ALTER.
    //    기존 0132 마이그레이션은 user_name/selected_option/is_generated 없음 → INSERT 실패 사고.
    //    ALTER 는 idempotent (catch 처리) — 영구 fix.
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        user_id TEXT,
        user_name TEXT,
        rating INTEGER NOT NULL,
        content TEXT,
        selected_option TEXT,
        is_generated INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => { /* exists */ });
    // 🛡️ 2026-05-21: 기존 0132 schema 에 누락된 컬럼 ALTER 추가.
    await DB.prepare(`ALTER TABLE product_reviews ADD COLUMN user_name TEXT`).run().catch(() => { /* exists */ });
    await DB.prepare(`ALTER TABLE product_reviews ADD COLUMN selected_option TEXT`).run().catch(() => { /* exists */ });
    await DB.prepare(`ALTER TABLE product_reviews ADD COLUMN is_generated INTEGER DEFAULT 0`).run().catch(() => { /* exists */ });

    const now = Date.now();
    const BATCH_SIZE = 50;
    let totalInserted = 0;
    let productsProcessed = 0;
    const errors: Array<{ product_id: number; error: string }> = [];

    // 3) 각 상품마다 5~25개 (랜덤) 리뷰 생성. 배치 50개 단위로 D1.batch().
    for (const product of productList) {
      // 상품별 리뷰 개수 + 평균 별점 랜덤.
      const reviewCount = Math.floor(minReviews + Math.random() * (maxReviews - minReviews))
      const targetRating = 4.3 + Math.random() * 0.5  // 4.3 ~ 4.8

      const stmts: D1PreparedStatement[] = [];
      for (let i = 0; i < reviewCount; i++) {
        const rating = Math.min(5, Math.max(3, Math.round(targetRating + (Math.random() - 0.5))));
        const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)];
        const maskedName = name[0] + '*' + name[name.length - 1];
        const content = REVIEW_TEMPLATES[Math.floor(Math.random() * REVIEW_TEMPLATES.length)] || null;
        const daysAgo = Math.floor(Math.random() * 180);  // 0-180일 분산
        const reviewDate = new Date(now - daysAgo * 86400000).toISOString();

        stmts.push(
          DB.prepare(`INSERT INTO product_reviews (product_id, user_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, NULL, 1, ?)`)
            .bind(product.id, 'system-generated', maskedName, rating, content, reviewDate)
        );

        // 50개 단위로 flush.
        if (stmts.length >= BATCH_SIZE) {
          try {
            await DB.batch(stmts);
            totalInserted += stmts.length;
          } catch (e) {
            errors.push({ product_id: product.id, error: (e as Error).message });
          }
          stmts.length = 0;
        }
      }
      // 남은 batch flush.
      if (stmts.length > 0) {
        try {
          await DB.batch(stmts);
          totalInserted += stmts.length;
        } catch (e) {
          errors.push({ product_id: product.id, error: (e as Error).message });
        }
      }
      productsProcessed++;
    }

    return c.json({
      success: true,
      data: {
        scope,
        products_processed: productsProcessed,
        total_reviews_inserted: totalInserted,
        avg_reviews_per_product: productsProcessed > 0 ? Math.round(totalInserted / productsProcessed) : 0,
        reviews_per_product_range: [minReviews, maxReviews],
        errors_count: errors.length,
        errors: errors.slice(0, 10),  // 처음 10개만 (응답 size 제한)
      },
    });
  } catch (err) {
    if (import.meta.env?.DEV) console.error('[admin:reviews:bulk]', err);
    // 🛡️ 2026-05-21: stack 일부 + message 노출 — 어드민 디버깅용 (admin auth 통과한 호출만).
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : '';
    return c.json({
      success: false,
      error: `bulk-vouchers 실패: ${msg.slice(0, 200)}`,
      error_detail: stack.slice(0, 300) || undefined,
    }, 500);
  }
});

// 🛡️ 2026-05-21: 사용자 요청 — 각 상품 당 리뷰 개별 생성.
//   POST /admin/reviews/generate-for-product/:productId
//   Body: { count?: number (1-100, default 15), rating_min?: number (1-5), rating_max?: number (1-5) }
//   대량 생성 endpoint 와 동일한 stmts/templates 사용 — 단일 상품에만 적용.
adminReviewGeneratorRoutes.post('/reviews/generate-for-product/:productId', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const productIdRaw = c.req.param('productId');
    const productId = Number(productIdRaw);
    if (!Number.isFinite(productId) || productId <= 0) {
      return c.json({ success: false, error: '잘못된 상품 ID' }, 400);
    }

    type Body = { count?: number; rating_min?: number; rating_max?: number };
    const body = await c.req.json<Body>().catch(() => ({} as Body));
    const count = Math.max(1, Math.min(100, Math.floor(body.count ?? 15)));
    const ratingMin = Math.max(1, Math.min(5, Math.floor(body.rating_min ?? 4)));
    const ratingMax = Math.max(ratingMin, Math.min(5, Math.floor(body.rating_max ?? 5)));

    // 상품 존재 확인.
    const product = await DB.prepare(
      `SELECT id, name FROM products WHERE id = ? LIMIT 1`
    ).bind(productId).first<{ id: number; name: string }>();
    if (!product) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }

    await writeAuditLog(c, {
      action: 'generate_fake_reviews_per_product',
      targetType: 'products',
      targetId: String(productId),
      after: { count, rating_range: [ratingMin, ratingMax] },
    });

    // 테이블 ensure + 누락 컬럼 ALTER (대량 endpoint 와 동일).
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        user_id TEXT,
        user_name TEXT,
        rating INTEGER NOT NULL,
        content TEXT,
        selected_option TEXT,
        is_generated INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => { /* exists */ });
    await DB.prepare(`ALTER TABLE product_reviews ADD COLUMN user_name TEXT`).run().catch(() => { /* exists */ });
    await DB.prepare(`ALTER TABLE product_reviews ADD COLUMN selected_option TEXT`).run().catch(() => { /* exists */ });
    await DB.prepare(`ALTER TABLE product_reviews ADD COLUMN is_generated INTEGER DEFAULT 0`).run().catch(() => { /* exists */ });

    const now = Date.now();
    const stmts: D1PreparedStatement[] = [];
    for (let i = 0; i < count; i++) {
      const rating = Math.min(5, Math.max(1, Math.floor(ratingMin + Math.random() * (ratingMax - ratingMin + 1))));
      const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)];
      const maskedName = name[0] + '*' + name[name.length - 1];
      const content = REVIEW_TEMPLATES[Math.floor(Math.random() * REVIEW_TEMPLATES.length)] || null;
      const daysAgo = Math.floor(Math.random() * 180);
      const reviewDate = new Date(now - daysAgo * 86400000).toISOString();
      stmts.push(
        DB.prepare(`INSERT INTO product_reviews (product_id, user_id, user_name, rating, content, selected_option, is_generated, created_at) VALUES (?, ?, ?, ?, ?, NULL, 1, ?)`)
          .bind(productId, 'system-generated', maskedName, rating, content, reviewDate)
      );
    }

    // batch (50개씩).
    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < stmts.length; i += BATCH) {
      const chunk = stmts.slice(i, i + BATCH);
      try {
        await DB.batch(chunk);
        inserted += chunk.length;
      } catch (e) {
        if (import.meta.env?.DEV) console.warn('[admin:reviews:per-product] batch failed', e);
      }
    }

    return c.json({
      success: true,
      data: {
        product_id: productId,
        product_name: product.name,
        reviews_inserted: inserted,
        rating_range: [ratingMin, ratingMax],
      },
    });
  } catch (err) {
    if (import.meta.env?.DEV) console.error('[admin:reviews:per-product]', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-19: 교환권 전체 생성 리뷰 일괄 삭제 (롤백용).
adminReviewGeneratorRoutes.delete('/reviews/generated-bulk-vouchers', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    // 🛡️ 2026-05-21: query scope 추가 (생성 endpoint 와 대칭).
    //   vouchers / admin / all (default all — 모든 is_generated=1 삭제).
    const scopeRaw = c.req.query('scope') || 'all';
    const scope = scopeRaw === 'vouchers' || scopeRaw === 'admin' ? scopeRaw : 'all';

    const dealOnlyClause = scope === 'vouchers'
      ? 'AND product_id IN (SELECT id FROM products WHERE deal_only = 1)'
      : scope === 'admin'
      ? 'AND product_id IN (SELECT id FROM products WHERE deal_only = 0 OR deal_only IS NULL)'
      : '';

    const result = await DB.prepare(
      `DELETE FROM product_reviews WHERE is_generated = 1 ${dealOnlyClause}`
    ).run();
    return c.json({ success: true, scope, deleted: result.meta.changes });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminReviewGeneratorRoutes;
