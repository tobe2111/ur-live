// ============================================================
// Seller Routes
// GET /api/sellers                            - 판매자 목록
// GET /api/sellers/:id                        - 판매자 상세
// GET /api/sellers/:sellerId/products-public  - 판매자 공개 상품 목록
// GET /api/sellers/:sellerId/streams          - 판매자 스트림 목록 (공개)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { QueryBuilder } from '../repositories/query-builder';
import type { AuthVariables } from '../middleware/auth.middleware';
import type { Seller } from '../../shared/types';
import { cacheGet } from '../utils/cache';
import { intParam } from '@/shared/pagination'

const sellersRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/sellers
sellersRouter.get('/', async (c) => {
  try {
    const qb = new QueryBuilder(c.env.DB);
    const { page = '1', limit = '20' } = c.req.query();
    const pageNum = Math.max(1, intParam(page, 1));
    const limitNum = Math.min(Math.max(intParam(limit, 20), 1), 100);
    const offset = (pageNum - 1) * limitNum;

    // ✅ 실제 sellers 테이블 스키마에 맞게 수정
    const where = "WHERE status = 'approved' AND is_active = 1";
    const countRow = await qb.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM sellers ${where}`,
      []
    );

    // 🔐 2026-06-11 (보안 감사 🔴): 비인증 공개 list 에서 PII 제거 — email/phone/business_number 노출.
    //   /:id 는 2026-04-22 하드닝됐으나 이 list 는 누락됐었음 (대량 PII 수집 가능). 비민감 컬럼만.
    const rows = await qb.queryMany<Record<string, unknown>>(
      `SELECT id, username, name,
              business_name,
              status, is_active, created_at, updated_at
       FROM sellers ${where}
       ORDER BY name
       LIMIT ? OFFSET ?`,
      [limitNum, offset]
    );

    return c.json({
      success: true,
      data: {
        items: rows,
        total: countRow?.count ?? 0,
        page: pageNum,
        limit: limitNum,
        has_next: pageNum * limitNum < (countRow?.count ?? 0),
      },
    });
  } catch (err) {
    console.error('[SELLERS] List error:', err);
    return c.json({ success: false, error: 'Failed to fetch sellers' }, 500);
  }
});

// GET /api/sellers/:id
// 🛡️ 2026-04-22: PII 누출 방어 — 공개 API 에서 phone/email/business_number/bank_account 제거.
// 이 정보는 /api/seller/me (인증된 본인) + admin API 에서만 노출. 공개 페이지는 PUBLIC_SELLER_COLUMNS.
sellersRouter.get('/:id', async (c) => {
  try {
    const qb = new QueryBuilder(c.env.DB);
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(sellerId)) {
      return c.json({ success: false, error: 'Invalid seller ID' }, 400)
    }

    const seller = await qb.queryOne<Seller>(
      `SELECT id, username, name,
              business_name,
              status, is_active,
              created_at, updated_at, approved_at
       FROM sellers WHERE id = ? AND status = 'approved' AND is_active = 1`,
      [sellerId]
    );

    if (!seller) {
      return c.json({ success: false, error: 'Seller not found' }, 404);
    }

    return c.json({ success: true, data: seller });
  } catch (err) {
    console.error('[SELLERS] Detail error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller' }, 500);
  }
});

// 🏁 2026-06-25 (대표 신고 — 링크샵 배너 사라짐): 셀러 공개 프로필 SELECT 를 컬럼 단위 self-heal 로.
//   배경: 기존 FULL/FALLBACK 2단 구조는 sibling 신규컬럼(external_live_* 등)이 prod 에 하나라도 없으면
//   전체가 FALLBACK 으로 떨어지고, 그 FALLBACK 이 'NULL AS banner_url' 이라 → 저장된 배너가 안 읽혔음.
//   이제 실제로 없는 컬럼만 NULL 로 빼고 banner_url 등 존재 컬럼은 보존 (productDetailColsHealed 패턴).
const SELLER_PUBLIC_COLS: Array<{ expr: string; out?: string; probe?: string }> = [
  { expr: 's.id' }, { expr: 's.username' }, { expr: 's.name' },
  { expr: 's.business_name', out: 'business_name', probe: 'business_name' },
  { expr: 's.business_number', out: 'business_number', probe: 'business_number' },
  { expr: 's.business_address', out: 'business_address', probe: 'business_address' },
  { expr: 's.profile_image', out: 'profile_image', probe: 'profile_image' },
  { expr: 's.bio', out: 'bio', probe: 'bio' },
  { expr: 's.commission_rate', out: 'commission_rate', probe: 'commission_rate' },
  { expr: 's.created_at' },
  { expr: 's.sns_instagram', out: 'sns_instagram', probe: 'sns_instagram' },
  { expr: 's.sns_youtube', out: 'sns_youtube', probe: 'sns_youtube' },
  { expr: 's.sns_facebook', out: 'sns_facebook', probe: 'sns_facebook' },
  { expr: 's.sns_twitter', out: 'sns_twitter', probe: 'sns_twitter' },
  { expr: 's.website_url', out: 'website_url', probe: 'website_url' },
  { expr: 's.kakao_chat_url AS kakao_chat_link', out: 'kakao_chat_link', probe: 'kakao_chat_url' },
  { expr: 's.representative_name AS ceo_name', out: 'ceo_name', probe: 'representative_name' },
  { expr: 's.banner_url', out: 'banner_url', probe: 'banner_url' },
  { expr: 's.brand_color', out: 'brand_color', probe: 'brand_color' },
  { expr: 's.external_live_tiktok', out: 'external_live_tiktok', probe: 'external_live_tiktok' },
  { expr: 's.external_live_instagram', out: 'external_live_instagram', probe: 'external_live_instagram' },
  { expr: 's.external_live_facebook', out: 'external_live_facebook', probe: 'external_live_facebook' },
  { expr: '(SELECT COUNT(*) FROM seller_follows WHERE seller_id = s.id) AS follower_count' },
];
const _missingSellerCols = new Set<string>();
function buildSellerPublicSelect(): string {
  return SELLER_PUBLIC_COLS
    .map((col) => (col.probe && col.out && _missingSellerCols.has(col.probe)) ? `NULL AS ${col.out}` : col.expr)
    .join(', ');
}
function pruneSellerPublicCol(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  const m = msg.match(/no such column:?\s*(?:[A-Za-z_]+\.)?([A-Za-z_0-9]+)/i);
  if (!m) return false;
  const col = m[1];
  if (!SELLER_PUBLIC_COLS.some((c) => c.probe === col) || _missingSellerCols.has(col)) return false;
  _missingSellerCols.add(col);
  console.error('[SELLERS] public SELECT 컬럼 자동 제외:', col, '— repair-schema 등록 필요');
  return true;
}

// GET /api/sellers/:id/public — 셀러 공개 프로필 (비인증, ID/username/slug 지원)
sellersRouter.get('/:id/public', async (c) => {
  try {
    const param = c.req.param('id');

    // Seller profile changes infrequently — 5 min TTL with 2 min SWR.
    // Key uses the lookup param directly (id/username/slug) so independent
    // callers that hit different keys stay cache-correct.
    // 🛡️ 2026-04-22: 공개 endpoint — 민감 필드 제외하고 public 필드만 SELECT
    // 이전: SELECT * 로 bank_account/email/phone/password_hash/business_number 노출
    // 🛡️ 2026-04-27: production sellers 테이블에 follower_count/is_verified 컬럼 없어서 500 → 제거
    //                 follower_count 는 seller_follows COUNT 서브쿼리로 대체
    // 🛡️ 2026-04-27 (2차): 너무 많이 잘라내서 셀러공개 페이지에 "이름 없음" + SNS/사업자 정보 미연동 →
    //                       SNS 링크, 사업자 정보 (전자상거래법 표시 의무 항목), 대표자명 추가.
    //                       프론트 호환을 위해 DB 컬럼명 alias: kakao_chat_url→kakao_chat_link, representative_name→ceo_name
    //                       민감 필드는 여전히 제외: password_hash/email/phone/bank_*/account_holder/tax_email
    // 🛡️ 2026-05-15 (PRISM 따라잡기): 미니샵 커스터마이징 컬럼 추가
    //   banner_url / brand_color / external_live_* (TikTok/Instagram/Facebook)
    const seller = await cacheGet(
      c.env.SESSION_KV,
      `seller:${param}`,
      async () => {
        const qb = new QueryBuilder(c.env.DB);
        const isNumeric = /^\d+$/.test(param);
        const where = isNumeric ? 's.id = ?' : 's.username = ?';
        // 컬럼 단위 self-heal: 실제 없는 컬럼만 NULL 로 빼고 재시도 → banner_url 등 존재 컬럼은 보존.
        for (let i = 0; i <= SELLER_PUBLIC_COLS.length; i++) {
          try {
            return await qb.queryOne(`SELECT ${buildSellerPublicSelect()} FROM sellers s WHERE ${where}`, [param]);
          } catch (e) {
            if (!pruneSellerPublicCol(e)) throw e;
          }
        }
        return null;
      },
      { ttl: 300, staleWhileRevalidate: 120 }
    );

    if (!seller) {
      return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    }

    // 🏁 2026-06-12 (P5 — 전 플로우 감사, 사용자 승인 "모두 이상적"): 셀러에 연결된 유저가
    //   큐레이터(핸들 보유)면 handle 을 additive 로 동봉 — SellerPublicPage 가 '추천 핀' 섹션을
    //   lazy 렌더할 수 있게. 기존 응답 필드/캐시 키 불변(추가만), 실패 시 조용히 생략.
    try {
      const sid = (seller as { id?: number }).id
      if (sid) {
        const linked = await c.env.DB.prepare(
          `SELECT u.handle FROM sellers s JOIN users u ON (
                 u.id = s.linked_user_id
              OR (s.linked_user_id IS NULL AND s.email IS NOT NULL AND s.email != '' AND u.email = s.email)
           )
            WHERE s.id = ? AND u.handle IS NOT NULL AND u.handle != '' LIMIT 1`
        ).bind(sid).first<{ handle: string }>()
        if (linked?.handle) (seller as Record<string, unknown>).curator_handle = linked.handle
      }
    } catch { /* additive — 생략 가능 */ }

    // 🖼️ 2026-07-01 (대표 — 링크샵 판매자 정보 "항상 미등록" 수정): 통신판매업신고번호는 sellers 컬럼이
    //   아예 없어(100컬럼 예산제) 공개 응답에 영구 누락 → InfoTab 이 항상 "(정보 미등록)" 표시하던 유령 필드.
    //   side table(seller_business_info)에서 additive enrich + 대표자명/주소도 sellers 값 비었으면 폴백.
    //   기존 응답 필드/캐시 키 불변(추가만), 실패 시 조용히 생략.
    try {
      const sid2 = (seller as { id?: number }).id
      if (sid2) {
        let sbi: { mail_order_number?: string | null; address?: string | null; ceo_name?: string | null } | null = null
        try {
          sbi = await c.env.DB.prepare(
            'SELECT mail_order_number, address, ceo_name FROM seller_business_info WHERE seller_id = ? ORDER BY id DESC LIMIT 1'
          ).bind(sid2).first()
        } catch {
          // mail_order_number 컬럼 미존재 환경 — 주소/대표자 폴백만이라도
          sbi = await c.env.DB.prepare(
            'SELECT address, ceo_name FROM seller_business_info WHERE seller_id = ? ORDER BY id DESC LIMIT 1'
          ).bind(sid2).first()
        }
        if (sbi) {
          const s = seller as Record<string, unknown>
          if (sbi.mail_order_number) s.mail_order_number = sbi.mail_order_number
          if (sbi.address && !s.business_address) s.business_address = sbi.address
          if (sbi.ceo_name && !s.ceo_name) s.ceo_name = sbi.ceo_name
        }
      }
    } catch { /* additive — 생략 가능 */ }

    return c.json({ success: true, data: seller });
  } catch (err) {
    console.error('[SELLERS] Public profile error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller' }, 500);
  }
});

// GET /api/sellers/:sellerId/products-public
// 비인증 판매자 공개 상품 목록 (프론트에서 /api/seller/:sellerId/products-public 및 /api/sellers/:sellerId/products-public 사용)
sellersRouter.get('/:sellerId/products-public', async (c) => {
  try {
    const qb = new QueryBuilder(c.env.DB);
    const sellerId = c.req.param('sellerId');
    if (!sellerId || !/^\d+$/.test(sellerId)) {
      return c.json({ success: false, error: 'Invalid seller ID' }, 400)
    }
    const { page = '1', limit = '20' } = c.req.query();
    const pageNum = Math.max(1, intParam(page, 1));
    const limitNum = Math.min(Math.max(intParam(limit, 20), 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const products = await qb.queryMany<any>(
      `SELECT id, name, description, price, original_price, discount_rate,
              image_url, stock, category, seller_id, is_active,
              created_at, updated_at
       FROM products
       WHERE seller_id = ? AND is_active = 1
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [sellerId, limitNum, offset]
    );

    const countRow = await qb.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM products WHERE seller_id = ? AND is_active = 1`,
      [sellerId]
    );

    return c.json({
      success: true,
      data: products,
      pagination: { page: pageNum, limit: limitNum, total: countRow?.total ?? 0 },
    });
  } catch (err) {
    console.error('[SELLERS] Products error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller products' }, 500);
  }
});

// GET /api/sellers/:sellerId/streams
// 비인증 판매자 공개 스트림 목록
sellersRouter.get('/:sellerId/streams', async (c) => {
  try {
    const db = c.env.DB;
    const sellerId = c.req.param('sellerId');
    if (!sellerId || !/^\d+$/.test(sellerId)) {
      return c.json({ success: false, error: 'Invalid seller ID' }, 400)
    }
    const { status, limit = '10' } = c.req.query();
    const limitNum = Math.min(Math.max(intParam(limit, 10), 1), 50);

    const params: unknown[] = [sellerId];
    let statusWhere = '';
    if (status) {
      statusWhere = 'AND ls.status = ?';
      params.push(status);
    }
    params.push(limitNum);

    const rows = await db
      .prepare(
        `SELECT ls.id, ls.title, ls.status,
                ls.youtube_video_id, ls.created_at
         FROM live_streams ls
         WHERE ls.seller_id = ? ${statusWhere}
         ORDER BY ls.created_at DESC
         LIMIT ?`
      )
      .bind(...params)
      .all();

    return c.json({ success: true, data: rows.results || [] });
  } catch (err) {
    console.error('[SELLERS] Streams error:', err);
    return c.json({ success: false, error: 'Failed to fetch seller streams' }, 500);
  }
});

export { sellersRouter };
