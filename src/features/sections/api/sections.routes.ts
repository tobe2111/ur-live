/**
 * 홈페이지 섹션 관리 API
 *
 * 공개:
 *   GET /api/sections              - 활성 섹션 + 상품 목록 (메인페이지용)
 *
 * 어드민:
 *   GET    /api/sections/admin      - 전체 섹션 목록 (비활성 포함)
 *   POST   /api/sections            - 섹션 생성
 *   PUT    /api/sections/:id        - 섹션 수정
 *   DELETE /api/sections/:id        - 섹션 삭제
 *   POST   /api/sections/:id/products - 섹션에 상품 추가/교체
 *   DELETE /api/sections/:id/products/:productId - 섹션에서 상품 제거
 *   POST   /api/sections/reorder    - 섹션 순서 변경
 */

import { Hono } from 'hono';
import { edgeCache } from '../../../worker/middleware/edge-cache';
import { cors } from 'hono/cors';
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth';
import { cacheGet, cacheInvalidate } from '@/worker/utils/cache';
import type { Env } from '@/worker/types/env';
import type { KVNamespace } from '@cloudflare/workers-types';
// 🏠 2026-08-04 (대표 시안 승인): 규칙 기반 섹션. 기존 수동 큐레이션은 기본값으로 그대로 유지.
import {
  DEFAULT_SECTION_SOURCE,
  SECTION_DEFAULT_LIMIT,
  clampSectionLimit,
  normalizeSectionSource,
} from '@/shared/constants/home-showcase';
import { resolveSectionProducts, CARD_COLS } from './section-rules';
import { maybeSeedHomeSections } from './section-seed';
import { mainScopeFor } from '@/worker/utils/consumer-scope';
const sectionsRoutes = new Hono<{ Bindings: Env }>();

/**
 * 공개 홈 섹션 캐시(`sections:public`, 120초) 무효화.
 * 어드민이 무엇을 바꾸든 홈이 바로 따라오게 — 기다리는 동안은 "안 된다"로 보인다.
 * `cacheInvalidate` 는 L1 을 비우고 KV 삭제는 L2 게이트가 OFF 면 건너뛴다(무료한도 보호).
 */
async function invalidateSectionsCache(env: Env): Promise<void> {
  const { SESSION_KV } = env as Env & { SESSION_KV?: KVNamespace };
  await cacheInvalidate(SESSION_KV, 'sections:public').catch(() => {});
}

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

async function ensureTables(DB: D1Database) {
  if (_done_ensureTables.has(DB)) return
  _done_ensureTables.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS homepage_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subtitle TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        layout TEXT DEFAULT 'grid3' CHECK (layout IN ('grid3', 'grid2', 'scroll')),
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    `).run();
  } catch { /* exists */ }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS section_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (section_id) REFERENCES homepage_sections(id) ON DELETE CASCADE,
        UNIQUE(section_id, product_id)
      )
    `).run();
  } catch { /* exists */ }
  // 🏠 2026-08-04 (대표 시안 승인): 규칙 기반 섹션 컬럼. 전부 기본값이 있어
  //   **기존 행은 `source='manual'` 로 읽혀 동작이 그대로다**(추가일 뿐 변경 아님).
  for (const sql of [
    `ALTER TABLE homepage_sections ADD COLUMN source TEXT DEFAULT '${DEFAULT_SECTION_SOURCE}'`,
    `ALTER TABLE homepage_sections ADD COLUMN source_value TEXT`,
    `ALTER TABLE homepage_sections ADD COLUMN limit_count INTEGER DEFAULT ${SECTION_DEFAULT_LIMIT}`,
    `ALTER TABLE homepage_sections ADD COLUMN more_href TEXT`,
  ]) {
    try { await DB.prepare(sql).run(); } catch { /* 이미 있음 */ }
  }
}

// GET /api/sections — 메인페이지용 (활성 섹션 + 상품)
/**
 * 🐢 2026-08-19 (대표 신고 — "첫 접속하면 지금 인기 이용권이 먼저 안뜨고 가까운 동네딜이 먼저 보여.
 *   시간 지나면 … 지금 인기 이용권과 주말에 떠나는 숙소가 보여"): **엣지 캐시가 아예 없었다.**
 *
 *   실측: `cf-cache-status: DYNAMIC` · 응답 0.6~1.2s. 위 주석은 "on top of edge cache" 라고 적고
 *   있었지만 그런 미들웨어가 이 라우트에 **붙어 있지 않았다**(cacheGet 의 L2 KV 는 2026-06-04 에
 *   무료한도 보호로 꺼져 있어 사실상 매 요청 D1). 반면 동네딜 피드는 SSR 시드로 0-RTT 라,
 *   같은 화면에서 **한쪽만 늦게 끼어드는** 것처럼 보였다.
 *   ⇒ `edgeCache(120)` — 응답 뒤 `caches.default` 에 저장, 다음 요청은 ~5ms.
 *   ⚠️ 120s 인 이유: 어드민이 편성을 바꾸면 최대 그만큼 늦게 반영된다(5분은 편집 확인이 답답하다).
 *      `bypassIfAuthed` 라 어드민 자신은 항상 최신을 본다.
 */
sectionsRoutes.get('/', edgeCache(120), async (c) => {
  const { DB, SESSION_KV } = c.env as Env & { SESSION_KV?: KVNamespace };
  try {
    const result = await cacheGet(
      SESSION_KV,
      'sections:public',
      async () => {
        await ensureTables(DB);
        // 🏠 2026-08-04: 승인된 시안의 세 줄을 기본으로 넣는다 — 아무도 안 만들면 홈이
        //   "틀만 있고 안이 빈" 화면이 되고, 그건 시안이 아니다(대표 신고). 편집·삭제는 보존.
        await maybeSeedHomeSections(c.env as Env);

        const { results: sections } = await DB.prepare(`
          SELECT id, title, subtitle, layout,
                 COALESCE(source, '${DEFAULT_SECTION_SOURCE}') AS source,
                 source_value, limit_count, more_href
          FROM homepage_sections WHERE is_active = 1 ORDER BY sort_order ASC
        `).all();

        const sectionList = (sections ?? []) as Array<Record<string, unknown>>;
        // 🏠 규칙 섹션은 질의로 채운다. manual 만 아래 section_products 조회 대상.
        const ruleSections = sectionList.filter(s => normalizeSectionSource(s.source) !== 'manual');
        const ruleProducts = new Map<number, unknown[]>();
        for (const s of ruleSections) {
          ruleProducts.set(s.id as number, await resolveSectionProducts(c.env as Env, {
            source: normalizeSectionSource(s.source),
            sourceValue: (s.source_value as string) ?? null,
            limit: (s.limit_count as number) ?? null,
          }));
        }

        const sectionIds = sectionList
          .filter(s => normalizeSectionSource(s.source) === 'manual')
          .map(s => s.id as number);
        const productsBySection = new Map<number, unknown[]>();
        if (sectionIds.length > 0) {
          const ph = sectionIds.map(() => '?').join(',');
          // 🏠 2026-08-04: 규칙 섹션과 **같은 컬럼**(CARD_COLS)을 싣는다 — 카드 링크가
          //   `getProductFlow`(deal_only·group_buy_status) SSOT 로 결정되기 때문.
          //   + 본진 몰 격리(운영자 SaaS 몰 상품이 유어딜 홈에 섞이지 않게).
          const productScope = await mainScopeFor(DB, 'products', 'p');
          const { results: rows } = await DB.prepare(`
            SELECT sp.section_id, sp.sort_order, ${CARD_COLS}
            FROM section_products sp
            JOIN products p ON sp.product_id = p.id AND p.is_active = 1
            WHERE sp.section_id IN (${ph})${productScope}
            ORDER BY sp.section_id ASC, sp.sort_order ASC
          `).bind(...sectionIds).all<{ section_id: number; sort_order: number } & Record<string, unknown>>();

          for (const row of rows ?? []) {
            const sid = row.section_id;
            const arr = productsBySection.get(sid) ?? [];
            if (arr.length < 12) {
              const { section_id: _sid, sort_order: _so, ...product } = row;
              arr.push(product);
              productsBySection.set(sid, arr);
            }
          }
        }

        return sectionList
          .map(s => ({
            ...s,
            products: normalizeSectionSource(s.source) === 'manual'
              ? (productsBySection.get(s.id as number) ?? [])
              : (ruleProducts.get(s.id as number) ?? []),
          }))
          // 🚫 상품이 하나도 없는 줄은 아예 내리지 않는다 — 홈에 제목만 있고 아래가 빈
          //    섹션이 남으면 "빈손을 광고"하게 된다(대표가 배너에 정한 원칙과 같은 이유).
          .filter(s => (s.products as unknown[]).length > 0);
      },
      { ttl: 120 }
    );

    return c.json({ success: true, data: result });
  } catch (err) {
    console.error('[sections] GET / failed:', err);
    return c.json({ success: true, data: [] });
  }
});

// GET /api/sections/admin — 어드민용 전체 목록
sectionsRoutes.get('/admin', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  await ensureTables(DB);
  await maybeSeedHomeSections(c.env as Env);

  const { results: sections } = await DB.prepare(
    'SELECT * FROM homepage_sections ORDER BY sort_order ASC'
  ).all();

  // ✅ PERF: per-section product SELECT 제거 — 단일 IN-query
  const sectionList = (sections ?? []) as Array<Record<string, unknown>>;
  const sectionIds = sectionList.map(s => s.id as number);
  const productsBySection = new Map<number, unknown[]>();
  if (sectionIds.length > 0) {
    const ph = sectionIds.map(() => '?').join(',');
    const { results: rows } = await DB.prepare(`
      SELECT sp.section_id, sp.id as sp_id, sp.sort_order, p.id, p.name, p.price, p.image_url, p.restaurant_name
      FROM section_products sp
      JOIN products p ON sp.product_id = p.id
      WHERE sp.section_id IN (${ph})
      ORDER BY sp.section_id ASC, sp.sort_order ASC
    `).bind(...sectionIds).all<{ section_id: number } & Record<string, unknown>>();

    for (const row of rows ?? []) {
      const sid = row.section_id;
      const arr = productsBySection.get(sid) ?? [];
      const { section_id: _sid, ...product } = row;
      arr.push(product);
      productsBySection.set(sid, arr);
    }
  }

  const result = sectionList.map(s => ({
    ...s,
    products: productsBySection.get(s.id as number) ?? [],
  }));

  return c.json({ success: true, data: result });
});

// POST /api/sections — 섹션 생성
sectionsRoutes.post('/', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  await ensureTables(DB);
  const { title, subtitle, layout, source, source_value, limit_count, more_href } = await c.req.json<{
    title: string; subtitle?: string; layout?: string;
    source?: string; source_value?: string; limit_count?: number; more_href?: string;
  }>();

  if (!title) return c.json({ success: false, error: '섹션 제목은 필수입니다' }, 400);

  const maxOrder = await DB.prepare('SELECT MAX(sort_order) as max_order FROM homepage_sections').first<{ max_order: number }>();

  // 🏠 2026-08-04: source/limit 은 화이트리스트·클램프를 거친 값만 저장한다(어드민 입력이라도
  //   ORDER BY·LIMIT 에 닿는 값은 SSOT 를 통과시킨다).
  await DB.prepare(
    `INSERT INTO homepage_sections (title, subtitle, layout, sort_order, source, source_value, limit_count, more_href)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    title, subtitle ?? null, layout ?? 'grid3', (maxOrder?.max_order ?? 0) + 1,
    normalizeSectionSource(source), source_value ?? null, clampSectionLimit(limit_count), more_href ?? null,
  ).run();

  await invalidateSectionsCache(c.env as Env);
  return c.json({ success: true, message: '섹션이 생성되었습니다' }, 201);
});

// PUT /api/sections/:id — 섹션 수정
sectionsRoutes.put('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const sectionId = c.req.param('id');
  const { title, subtitle, layout, is_active, source, source_value, limit_count, more_href } = await c.req.json<{
    title?: string; subtitle?: string; layout?: string; is_active?: number;
    source?: string; source_value?: string | null; limit_count?: number; more_href?: string | null;
  }>();

  await ensureTables(DB);
  const updates: string[] = ['updated_at = datetime(\'now\')'];
  const params: (string | number | null)[] = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (subtitle !== undefined) { updates.push('subtitle = ?'); params.push(subtitle); }
  if (layout !== undefined) { updates.push('layout = ?'); params.push(layout); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
  // 🏠 2026-08-04 — 생성 경로와 동일하게 SSOT 통과분만 저장.
  if (source !== undefined) { updates.push('source = ?'); params.push(normalizeSectionSource(source)); }
  if (source_value !== undefined) { updates.push('source_value = ?'); params.push(source_value ?? null); }
  if (limit_count !== undefined) { updates.push('limit_count = ?'); params.push(clampSectionLimit(limit_count)); }
  if (more_href !== undefined) { updates.push('more_href = ?'); params.push(more_href ?? null); }

  params.push(sectionId!);
  await DB.prepare(`UPDATE homepage_sections SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  await invalidateSectionsCache(c.env as Env);
  return c.json({ success: true, message: '섹션이 수정되었습니다' });
});

// DELETE /api/sections/:id — 섹션 삭제
sectionsRoutes.delete('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const sectionId = c.req.param('id');

  await DB.prepare('DELETE FROM section_products WHERE section_id = ?').bind(sectionId).run();
  await DB.prepare('DELETE FROM homepage_sections WHERE id = ?').bind(sectionId).run();

  await invalidateSectionsCache(c.env as Env);
  return c.json({ success: true, message: '섹션이 삭제되었습니다' });
});

// POST /api/sections/:id/products — 섹션에 상품 추가 (배열)
sectionsRoutes.post('/:id/products', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const sectionId = c.req.param('id');
  const { product_ids } = await c.req.json<{ product_ids: number[] }>();

  if (!product_ids?.length) return c.json({ success: false, error: '상품 ID를 입력해주세요' }, 400);

  // 기존 상품 제거 후 재삽입
  await DB.prepare('DELETE FROM section_products WHERE section_id = ?').bind(sectionId).run();

  for (let i = 0; i < product_ids.length; i++) {
    await DB.prepare(
      'INSERT OR IGNORE INTO section_products (section_id, product_id, sort_order) VALUES (?, ?, ?)'
    ).bind(sectionId, product_ids[i], i).run();
  }

  // 🏠 2026-08-04: 담자마자 홈에 반영되게 공개 캐시를 비운다 — 안 그러면 최대 120초 동안
  //   "담았는데 홈에 없다" 가 되고, 그건 고장과 구분되지 않는다.
  await invalidateSectionsCache(c.env as Env);
  return c.json({ success: true, message: `${product_ids.length}개 상품이 설정되었습니다` });
});

// DELETE /api/sections/:id/products/:productId — 상품 제거
sectionsRoutes.delete('/:id/products/:productId', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  await DB.prepare('DELETE FROM section_products WHERE section_id = ? AND product_id = ?')
    .bind(c.req.param('id'), c.req.param('productId')).run();

  await invalidateSectionsCache(c.env as Env);
  return c.json({ success: true, message: '상품이 제거되었습니다' });
});

// POST /api/sections/reorder — 순서 변경
sectionsRoutes.post('/reorder', requireAuth(), async (c) => {
  const user = getCurrentUser(c);
  if (!user || user.type !== 'admin') return c.json({ success: false, error: '관리자만 접근 가능' }, 403);

  const { DB } = c.env;
  const { section_ids } = await c.req.json<{ section_ids: number[] }>();

  for (let i = 0; i < section_ids.length; i++) {
    await DB.prepare('UPDATE homepage_sections SET sort_order = ? WHERE id = ?')
      .bind(i, section_ids[i]).run();
  }

  await invalidateSectionsCache(c.env as Env);
  return c.json({ success: true, message: '순서가 변경되었습니다' });
});

export { sectionsRoutes };


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTables = new WeakSet<object>()
