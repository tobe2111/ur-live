/**
 * 🛡️ 2026-06-01 도매몰 INC-4 + INC-6: 공급자(도매상) self-serve 카탈로그 + 대시보드.
 *
 *   INC-4 (카탈로그 self-serve):
 *   - POST   /api/supplier/products       — 공급자가 직접 공급상품 등록 (어드민 승인 대기, is_active=0)
 *   - PATCH  /api/supplier/products/:id    — 자기 상품 수정 (pending/rejected 상태만)
 *   INC-6 (대시보드):
 *   - GET    /api/supplier/me              — 프로필 + 잔고 요약 + 상품/정산 카운트
 *   - GET    /api/supplier/products        — 내 카탈로그 (모든 승인상태)
 *   - GET    /api/supplier/settlements     — 정산(매출) 내역
 *
 * 인증: requireSupplier() (JWT type='supplier'). supplier_id = c.get('user').id.
 * 마운트: app.route('/api/supplier', supplierDashboardRoutes)  ← supplierAuthRoutes 와 같은 prefix.
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireSupplier } from '@/worker/middleware/auth';
import { safeError } from '@/worker/utils/safe-error';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { swallow } from '@/worker/utils/swallow';
import { ensureSupplyVisibilitySchema, normalizeVisibility, recordSupplyPriceChange } from './supply-visibility';
import { buildCsv, csvResponse, parseCsv } from './supply-csv';

export const supplierDashboardRoutes = new Hono<{ Bindings: Env }>();

// 모든 라우트 공급자 인증 필수.
supplierDashboardRoutes.use('*', requireSupplier());

function supplierId(c: { get: (k: string) => unknown }): number | null {
  const user = c.get('user') as { id?: string | number } | undefined;
  const id = Number(user?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// ── GET /me — 프로필 + 잔고 요약 ─────────────────────────────────────────────
supplierDashboardRoutes.get('/me', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    const profile = await DB.prepare(
      `SELECT id, business_name, business_number, representative, email, phone,
              bank_name, bank_account, account_holder, commission_rate, status, created_at
         FROM suppliers WHERE id = ?`
    ).bind(sid).first();
    if (!profile) return c.json({ success: false, error: '공급자를 찾을 수 없습니다' }, 404);

    const balance = await DB.prepare(
      `SELECT pending_amount, available_amount, paid_amount FROM supplier_balances WHERE supplier_id = ?`
    ).bind(sid).first<{ pending_amount: number; available_amount: number; paid_amount: number }>().catch(() => null);

    const counts = await DB.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN supply_approval_status = 'pending'  THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN supply_approval_status = 'approved' OR (supply_approval_status IS NULL AND is_active = 1) THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN supply_approval_status = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM products WHERE supplier_id = ? AND is_supply_product = 1`
    ).bind(sid).first<{ total: number; pending: number; approved: number; rejected: number }>().catch(() => null);

    return c.json({
      success: true,
      data: {
        profile,
        balance: {
          pending_amount: balance?.pending_amount ?? 0,
          available_amount: balance?.available_amount ?? 0,
          paid_amount: balance?.paid_amount ?? 0,
        },
        product_counts: {
          total: counts?.total ?? 0,
          pending: counts?.pending ?? 0,
          approved: counts?.approved ?? 0,
          rejected: counts?.rejected ?? 0,
        },
      },
    });
  } catch (err) {
    return safeError(c, err, '정보 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── GET /products — 내 카탈로그 ───────────────────────────────────────────────
supplierDashboardRoutes.get('/products', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const status = c.req.query('status') || ''; // pending | approved | rejected
  try {
    let where = 'supplier_id = ? AND is_supply_product = 1';
    const params: (string | number)[] = [sid];
    if (status === 'pending' || status === 'rejected') {
      where += ' AND supply_approval_status = ?'; params.push(status);
    } else if (status === 'approved') {
      where += " AND (supply_approval_status = 'approved' OR (supply_approval_status IS NULL AND is_active = 1))";
    }

    const rows = await DB.prepare(
      `SELECT id, name, description, price AS retail_price, COALESCE(supply_price, 0) AS supply_price,
              stock, image_url, category, COALESCE(supply_visibility,'ALL') AS supply_visibility, barcode, is_brand_product,
              COALESCE(min_order_qty,1) AS min_order_qty,
              COALESCE(supply_approval_status, CASE WHEN is_active = 1 THEN 'approved' ELSE 'pending' END) AS approval_status,
              is_active, admin_memo, created_at, updated_at
         FROM products WHERE ${where}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const total = await DB.prepare(
      `SELECT COUNT(*) AS count FROM products WHERE ${where}`
    ).bind(...params).first<{ count: number }>();

    return c.json({
      success: true,
      data: {
        items: rows.results ?? [],
        total: total?.count ?? 0,
        page, limit,
        has_more: (total?.count ?? 0) > offset + limit,
      },
    });
  } catch (err) {
    return safeError(c, err, '상품 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── POST /products — 공급상품 등록 (INC-4) ────────────────────────────────────
supplierDashboardRoutes.post('/products', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    type ProductBody = {
      name?: string; description?: string; supply_price?: number; suggested_retail_price?: number;
      stock?: number; image_url?: string; category?: string;
      supply_visibility?: string; barcode?: string; is_brand_product?: boolean; min_order_qty?: number;
    };
    const body = await c.req.json<ProductBody>().catch(() => ({} as ProductBody));
    await ensureSupplyVisibilitySchema(DB);

    const name = (body.name || '').trim();
    const supplyPrice = Number(body.supply_price);
    const suggestedRetail = Number(body.suggested_retail_price ?? body.supply_price);
    const stock = Number.isFinite(Number(body.stock)) ? Math.max(0, Math.floor(Number(body.stock))) : 0;
    // MOQ — 최소 주문 수량(박스 단위). 1~100000, 기본 1.
    const moq = Number.isFinite(Number(body.min_order_qty)) ? Math.min(100000, Math.max(1, Math.floor(Number(body.min_order_qty)))) : 1;

    if (!name) return c.json({ success: false, error: '상품명은 필수입니다' }, 400);
    if (name.length > 200) return c.json({ success: false, error: '상품명은 200자 이하여야 합니다' }, 400);
    if (!Number.isFinite(supplyPrice) || supplyPrice <= 0) return c.json({ success: false, error: '공급가는 0원 이상이어야 합니다' }, 400);
    if (!Number.isFinite(suggestedRetail) || suggestedRetail < supplyPrice) {
      return c.json({ success: false, error: '권장 소비자가는 공급가 이상이어야 합니다' }, 400);
    }

    // 승인된 공급자만 등록 가능 (정지/대기 차단).
    const sup = await DB.prepare('SELECT status FROM suppliers WHERE id = ?').bind(sid).first<{ status: string }>();
    if (!sup || sup.status !== 'approved') {
      return c.json({ success: false, error: '승인된 공급자만 상품을 등록할 수 있습니다' }, 403);
    }

    const slug = `sup-${sid}-${name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').substring(0, 40)}-${Date.now()}`;

    // 🛡️ is_active=0 (어드민 승인 전 카탈로그 비노출) + supply_approval_status='pending'.
    //   seller_id=NULL (소스 카탈로그 상품 — 셀러가 register 로 자기 스토어에 복제).
    const visibility = normalizeVisibility(body.supply_visibility);
    const barcode = (body.barcode || '').trim().slice(0, 64) || null;
    const isBrand = body.is_brand_product ? 1 : 0;

    const result = await DB.prepare(
      `INSERT INTO products (
         name, description, price, supply_price, stock,
         image_url, category, product_type, is_active, is_supply_product,
         supplier_id, supply_approval_status, supply_visibility, barcode, is_brand_product, min_order_qty, slug, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'regular', 0, 1, ?, 'pending', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      name,
      (body.description || '').slice(0, 5000),
      Math.floor(suggestedRetail),
      Math.floor(supplyPrice),
      stock,
      (body.image_url || '').slice(0, 1000),
      (body.category || 'lifestyle').slice(0, 60),
      sid,
      visibility,
      barcode,
      isBrand,
      moq,
      slug,
    ).run();

    // 어드민 승인 큐 알림.
    createDashboardNotification(DB, 'admin', null, 'supply_product_submitted', '공급상품 승인 요청',
      `공급자 #${sid}: ${name}`, '/admin/products').catch(swallow('supplier-dashboard'));

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, approval_status: 'pending' },
      message: '상품이 등록되었습니다. 어드민 승인 후 셀러 카탈로그에 노출됩니다.',
    }, 201);
  } catch (err) {
    return safeError(c, err, '상품 등록 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── GET /products/bulk-template — 대량등록 표준 양식 CSV ───────────────────────
supplierDashboardRoutes.get('/products/bulk-template', (c) => {
  const headers = ['상품명', '공급가', '권장소비자가', '재고', '카테고리', '바코드', '공급범위', '브랜드제품', '설명']
  const example = ['예시상품A', '5000', '9900', '100', 'lifestyle', '8801234567890', 'ALL', 'N', '상품 설명']
  const example2 = ['예시상품B(유통스타트전용)', '12000', '19900', '50', 'beauty', '', 'UTONGSTART_ONLY', 'Y', '선정 유통사만 노출']
  return csvResponse(buildCsv(headers, [example, example2]), 'supply-products-template.csv')
})

// ── POST /products/bulk — 대량등록 (CSV 업로드) ────────────────────────────────
supplierDashboardRoutes.post('/products/bulk', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    await ensureSupplyVisibilitySchema(DB);
    const sup = await DB.prepare('SELECT status FROM suppliers WHERE id = ?').bind(sid).first<{ status: string }>();
    if (!sup || sup.status !== 'approved') {
      return c.json({ success: false, error: '승인된 공급자만 상품을 등록할 수 있습니다' }, 403);
    }
    const body = await c.req.json<{ csv?: string }>().catch(() => ({} as { csv?: string }));
    if (!body.csv || typeof body.csv !== 'string') return c.json({ success: false, error: 'CSV 데이터가 없습니다' }, 400);
    const rows = parseCsv(body.csv, 2000);
    if (!rows.length) return c.json({ success: false, error: '처리할 행이 없습니다' }, 400);

    const results: { row: number; name?: string; status: 'ok' | 'error'; reason?: string }[] = [];
    // 🛡️ 유효 행만 INSERT statement 로 모아 DB.batch 청크 실행 (행별 순차 .run() 은 Cloudflare subrequest 한도 초과).
    const stmts: D1PreparedStatement[] = [];
    const INSERT_SQL = `INSERT INTO products (name, description, price, supply_price, stock, image_url, category, product_type,
       is_active, is_supply_product, supplier_id, supply_approval_status, supply_visibility, barcode, is_brand_product, slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', ?, 'regular', 0, 1, ?, 'pending', ?, ?, ?, ?, datetime('now'), datetime('now'))`;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = String(r['상품명'] || r.name || '').trim();
      const supplyPrice = Number(String(r['공급가'] || r.supply_price || '').replace(/[,\s]/g, ''));
      const retail = Number(String(r['권장소비자가'] || r.suggested_retail_price || r['공급가'] || '').replace(/[,\s]/g, ''));
      const stock = Math.max(0, Math.floor(Number(String(r['재고'] || r.stock || '0').replace(/[,\s]/g, '')) || 0));
      if (!name) { results.push({ row: i + 2, status: 'error', reason: '상품명 누락' }); continue; }
      if (!Number.isFinite(supplyPrice) || supplyPrice <= 0) { results.push({ row: i + 2, name, status: 'error', reason: '공급가 오류' }); continue; }
      const retailFinal = Number.isFinite(retail) && retail >= supplyPrice ? retail : supplyPrice;
      const visibility = normalizeVisibility(r['공급범위'] || r.supply_visibility);
      const barcode = String(r['바코드'] || r.barcode || '').trim().slice(0, 64) || null;
      const brandRaw = String(r['브랜드제품'] || r.is_brand_product || '').trim().toUpperCase();
      const isBrand = ['Y', 'YES', '예', '1', 'TRUE', 'O'].includes(brandRaw) ? 1 : 0;
      const slug = `sup-${sid}-${name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').substring(0, 30)}-${Date.now()}-${i}`;
      stmts.push(DB.prepare(INSERT_SQL).bind(
        name.slice(0, 200), String(r['설명'] || r.description || '').slice(0, 5000),
        Math.floor(retailFinal), Math.floor(supplyPrice), stock,
        String(r['카테고리'] || r.category || 'lifestyle').slice(0, 60), sid, visibility, barcode, isBrand, slug,
      ));
      results.push({ row: i + 2, name, status: 'ok' });
    }
    let created = 0;
    const CHUNK = 100;
    for (let i = 0; i < stmts.length; i += CHUNK) {
      try { await DB.batch(stmts.slice(i, i + CHUNK)); created += Math.min(CHUNK, stmts.length - i); }
      catch {
        // 청크 실패 시 해당 청크 결과를 error 로 표시 (부분 성공 유지).
        for (const res of results.filter(x => x.status === 'ok').slice(i, i + CHUNK)) { res.status = 'error'; res.reason = 'DB 오류'; }
      }
    }
    if (created > 0) {
      createDashboardNotification(DB, 'admin', null, 'supply_product_submitted', '공급상품 대량 등록',
        `공급자 #${sid}: ${created}건 승인 요청`, '/admin/products').catch(swallow('supplier-dashboard'));
    }
    return c.json({ success: true, summary: { total: rows.length, created, failed: rows.length - created }, results });
  } catch (err) {
    return safeError(c, err, '대량 등록 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 제조사 자가관리: '승인한 유통채널' 상품의 허용 유통사 관리 (UTONGSTART_ONLY 는 관리자 전용) ──
//   소유 검증: supplier_id = sid + supply_source_id IS NULL. visibility='APPROVED_CHANNEL' 인 경우만.
async function ownApprovedChannelProduct(DB: D1Database, pid: number, sid: number) {
  return DB.prepare(
    "SELECT id, COALESCE(supply_visibility,'ALL') AS supply_visibility FROM products WHERE id = ? AND supplier_id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
  ).bind(pid, sid).first<{ id: number; supply_visibility: string }>();
}

supplierDashboardRoutes.get('/products/:id/channel-access', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const pid = Number(c.req.param('id'));
  if (!Number.isFinite(pid) || pid <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400);
  try {
    await ensureSupplyVisibilitySchema(DB);
    const prod = await ownApprovedChannelProduct(DB, pid, sid);
    if (!prod) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    const { results } = await DB.prepare(`
      SELECT pda.id, pda.distributor_seller_id, pda.created_at,
             s.business_name, s.name AS seller_name, s.username, s.distributor_grade
      FROM product_distributor_access pda LEFT JOIN sellers s ON s.id = pda.distributor_seller_id
      WHERE pda.product_id = ? ORDER BY pda.created_at DESC`
    ).bind(pid).all();
    return c.json({ success: true, supply_visibility: prod.supply_visibility, distributors: results ?? [] });
  } catch (err) {
    return safeError(c, err, '채널 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

supplierDashboardRoutes.post('/products/:id/channel-access', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const pid = Number(c.req.param('id'));
  if (!Number.isFinite(pid) || pid <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400);
  try {
    await ensureSupplyVisibilitySchema(DB);
    const prod = await ownApprovedChannelProduct(DB, pid, sid);
    if (!prod) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    if (prod.supply_visibility !== 'APPROVED_CHANNEL') {
      return c.json({ success: false, error: "'승인한 유통채널' 공급 상품만 직접 관리할 수 있습니다. (유통스타트 유통채널은 관리자 선정)" }, 409);
    }
    const body = await c.req.json<{ distributor_seller_id?: number }>().catch(() => ({} as { distributor_seller_id?: number }));
    const dsid = Number(body.distributor_seller_id);
    if (!Number.isFinite(dsid) || dsid <= 0) return c.json({ success: false, error: '유통사 ID를 입력하세요' }, 400);
    const seller = await DB.prepare('SELECT 1 FROM sellers WHERE id = ?').bind(dsid).first();
    if (!seller) return c.json({ success: false, error: '존재하지 않는 유통사입니다' }, 400);
    await DB.prepare('INSERT OR IGNORE INTO product_distributor_access (product_id, distributor_seller_id) VALUES (?, ?)').bind(pid, dsid).run();
    return c.json({ success: true });
  } catch (err) {
    return safeError(c, err, '유통사 승인 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

supplierDashboardRoutes.delete('/products/:id/channel-access/:accessId', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const pid = Number(c.req.param('id'));
  const accessId = Number(c.req.param('accessId'));
  if (!Number.isFinite(pid) || !Number.isFinite(accessId)) return c.json({ success: false, error: '잘못된 ID' }, 400);
  try {
    const prod = await ownApprovedChannelProduct(DB, pid, sid);
    if (!prod) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    // 소유 상품의 access 행만 삭제 (product_id 일치 강제).
    await DB.prepare('DELETE FROM product_distributor_access WHERE id = ? AND product_id = ?').bind(accessId, pid).run();
    return c.json({ success: true });
  } catch (err) {
    return safeError(c, err, '승인 해제 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── PATCH /products/:id — 자기 상품 수정 (pending/rejected 만) ─────────────────
supplierDashboardRoutes.patch('/products/:id', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const pid = c.req.param('id');
  if (!/^\d+$/.test(String(pid))) return c.json({ success: false, error: '잘못된 상품 ID' }, 400);
  try {
    const existing = await DB.prepare(
      `SELECT id, supplier_id, supply_approval_status, is_active, supply_price
         FROM products WHERE id = ? AND is_supply_product = 1`
    ).bind(pid).first<{ id: number; supplier_id: number | null; supply_approval_status: string | null; is_active: number; supply_price: number }>();

    if (!existing || existing.supplier_id !== sid) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }
    // 승인된 상품(셀러 카탈로그 노출 중)은 수정 불가 — 가격/내용 변동 방지. 대기/거부만 수정.
    const effectiveStatus = existing.supply_approval_status ?? (existing.is_active === 1 ? 'approved' : 'pending');
    if (effectiveStatus === 'approved') {
      return c.json({ success: false, error: '승인된 상품은 수정할 수 없습니다. 어드민에 문의하세요' }, 409);
    }

    type EditBody = {
      name?: string; description?: string; supply_price?: number; suggested_retail_price?: number;
      stock?: number; image_url?: string; category?: string;
      supply_visibility?: string; barcode?: string; is_brand_product?: boolean;
    };
    const body = await c.req.json<EditBody>().catch(() => ({} as EditBody));
    await ensureSupplyVisibilitySchema(DB);

    const sets: string[] = [];
    const params: (string | number)[] = [];
    if (typeof body.name === 'string' && body.name.trim()) { sets.push('name = ?'); params.push(body.name.trim().slice(0, 200)); }
    if (typeof body.description === 'string') { sets.push('description = ?'); params.push(body.description.slice(0, 5000)); }
    if (typeof body.image_url === 'string') { sets.push('image_url = ?'); params.push(body.image_url.slice(0, 1000)); }
    if (typeof body.category === 'string' && body.category.trim()) { sets.push('category = ?'); params.push(body.category.trim().slice(0, 60)); }
    if (body.stock != null && Number.isFinite(Number(body.stock))) { sets.push('stock = ?'); params.push(Math.max(0, Math.floor(Number(body.stock)))); }
    if (typeof body.supply_visibility === 'string') { sets.push('supply_visibility = ?'); params.push(normalizeVisibility(body.supply_visibility)); }
    if (typeof body.barcode === 'string') { sets.push('barcode = ?'); params.push(body.barcode.trim().slice(0, 64)); }
    if (body.is_brand_product != null) { sets.push('is_brand_product = ?'); params.push(body.is_brand_product ? 1 : 0); }

    let newSupply = existing.supply_price;
    let supplyChanged = false;
    if (body.supply_price != null) {
      newSupply = Number(body.supply_price);
      if (!Number.isFinite(newSupply) || newSupply <= 0) return c.json({ success: false, error: '공급가는 0원 이상이어야 합니다' }, 400);
      newSupply = Math.floor(newSupply);
      sets.push('supply_price = ?'); params.push(newSupply);
      supplyChanged = newSupply !== existing.supply_price;
    }
    if (body.suggested_retail_price != null) {
      const r = Number(body.suggested_retail_price);
      if (!Number.isFinite(r) || r < newSupply) return c.json({ success: false, error: '권장 소비자가는 공급가 이상이어야 합니다' }, 400);
      sets.push('price = ?'); params.push(Math.floor(r));
    }

    if (sets.length === 0) return c.json({ success: false, error: '변경할 내용이 없습니다' }, 400);

    // 거부 상태였으면 재제출 → 다시 pending.
    sets.push("supply_approval_status = 'pending'", 'is_active = 0', "updated_at = datetime('now')");
    await DB.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).bind(...params, pid).run();

    // 🛡️ 스펙: 공급가 수정 시 수정 전 금액 기록 (관리자만 확인).
    if (supplyChanged) {
      await recordSupplyPriceChange(DB, Number(pid), sid, existing.supply_price, newSupply, `supplier:${sid}`);
    }

    return c.json({ success: true, data: { id: Number(pid), approval_status: 'pending' }, message: '수정되었습니다. 다시 승인 대기 상태가 됩니다.' });
  } catch (err) {
    return safeError(c, err, '상품 수정 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── GET /settlements — 정산(매출) 내역 ───────────────────────────────────────
supplierDashboardRoutes.get('/settlements', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const status = c.req.query('status') || ''; // pending | available | paid | cancelled
  try {
    let where = 'ss.supplier_id = ?';
    const params: (string | number)[] = [sid];
    if (['pending', 'available', 'paid', 'cancelled'].includes(status)) {
      where += ' AND ss.status = ?'; params.push(status);
    }
    const rows = await DB.prepare(
      `SELECT ss.id, ss.order_id, ss.product_id, ss.seller_id,
              ss.retail_amount, ss.supply_amount, ss.status,
              ss.created_at, ss.available_at, ss.paid_at, ss.note,
              p.name AS product_name
         FROM supplier_settlements ss
         LEFT JOIN products p ON p.id = ss.product_id
         WHERE ${where}
         ORDER BY ss.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    const total = await DB.prepare(
      `SELECT COUNT(*) AS count FROM supplier_settlements ss WHERE ${where}`
    ).bind(...params).first<{ count: number }>();

    return c.json({
      success: true,
      data: {
        items: rows.results ?? [],
        total: total?.count ?? 0,
        page, limit,
        has_more: (total?.count ?? 0) > offset + limit,
      },
    });
  } catch (err) {
    return safeError(c, err, '정산 내역 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── GET /orders — 발송 대기/처리 주문 (INC-8 위탁/드랍쉽) ──────────────────────
//   이 공급자의 공급상품(원본)을 셀러가 복제판매 → 결제된 주문을 공급자가 직접 배송.
//   order_items → products(sp, 셀러 복제본) → sp.supply_source_id = 공급자 원본(src.supplier_id).
supplierDashboardRoutes.get('/orders', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  // status: to_ship(발송대기) | shipped(발송완료) | all
  const status = c.req.query('status') || 'to_ship';
  try {
    let statusWhere = "o.status IN ('PAID','PREPARING','READY')";
    if (status === 'shipped') statusWhere = "o.status IN ('SHIPPING','DELIVERED')";
    else if (status === 'all') statusWhere = "o.status NOT IN ('PENDING','CANCELLED','FAILED','REFUNDED')";

    // 주문 단위 집계 — 이 공급자 라인이 1개 이상 있는 주문.
    const rows = await DB.prepare(
      `SELECT o.id AS order_id, o.order_number, o.status, o.created_at,
              o.shipping_name, o.shipping_phone, o.shipping_address,
              o.recipient_name, o.recipient_phone,
              o.courier, o.tracking_number, o.shipped_at,
              COUNT(oi.id) AS line_count, SUM(oi.quantity) AS total_qty,
              GROUP_CONCAT(sp.name, ' | ') AS item_names
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products sp ON sp.id = oi.product_id
         JOIN products src ON src.id = sp.supply_source_id
        WHERE src.supplier_id = ? AND sp.supply_source_id IS NOT NULL AND ${statusWhere}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?`
    ).bind(sid, limit, offset).all();

    const totalRow = await DB.prepare(
      `SELECT COUNT(DISTINCT o.id) AS count
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products sp ON sp.id = oi.product_id
         JOIN products src ON src.id = sp.supply_source_id
        WHERE src.supplier_id = ? AND sp.supply_source_id IS NOT NULL AND ${statusWhere}`
    ).bind(sid).first<{ count: number }>().catch(() => null);

    return c.json({
      success: true,
      data: {
        items: rows.results ?? [],
        total: totalRow?.count ?? 0,
        page, limit,
        has_more: (totalRow?.count ?? 0) > offset + limit,
      },
    });
  } catch (err) {
    return safeError(c, err, '주문 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── PUT /orders/:orderId/shipping — 공급자 운송장 입력 (INC-8) ─────────────────
//   기존 셀러 배송 인프라(courier 정규화 + tracking_carrier_code + shipping_tracking_events) 재사용.
supplierDashboardRoutes.put('/orders/:orderId/shipping', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const orderId = c.req.param('orderId');
  if (!/^\d+$/.test(String(orderId))) return c.json({ success: false, error: '잘못된 주문 ID' }, 400);
  try {
    const body = await c.req.json<{ courier?: string; tracking_number?: string }>().catch(() => ({} as { courier?: string; tracking_number?: string }));
    const tracking = String(body.tracking_number || '').replace(/\s+/g, '');
    if (!tracking) return c.json({ success: false, error: '운송장 번호를 입력해주세요' }, 400);

    // 소유권 검증 — 이 주문에 공급자의 공급상품 라인이 실제로 있는지.
    const owns = await DB.prepare(
      `SELECT 1 FROM order_items oi
         JOIN products sp ON sp.id = oi.product_id
         JOIN products src ON src.id = sp.supply_source_id
        WHERE oi.order_id = ? AND src.supplier_id = ? LIMIT 1`
    ).bind(orderId, sid).first().catch(() => null);
    if (!owns) return c.json({ success: false, error: '해당 주문을 찾을 수 없습니다' }, 404);

    const { normalizeCourierKey } = await import('../../../worker/utils/courier-codes');
    const carrierKey = normalizeCourierKey(body.courier);

    await DB.prepare(
      `UPDATE orders
          SET tracking_number = ?, courier = ?, tracking_carrier_code = ?,
              shipped_at = COALESCE(shipped_at, datetime('now')),
              status = CASE WHEN status IN ('PAID','PREPARING','READY') THEN 'SHIPPING' ELSE status END,
              updated_at = datetime('now')
        WHERE id = ?`
    ).bind(tracking, body.courier || null, carrierKey || null, orderId).run();

    // 배송 추적 이벤트 audit (셀러 흐름과 동일 — 테이블 없으면 무시).
    await DB.prepare(
      `INSERT INTO shipping_tracking_events (order_id, carrier_code, tracking_number, status, status_text, source, created_at)
       VALUES (?, ?, ?, 'shipped', '공급자 발송 등록', 'supplier', datetime('now'))`
    ).bind(orderId, carrierKey || null, tracking).run().catch(() => { /* table optional */ });

    return c.json({ success: true, message: '운송장이 등록되었습니다.' });
  } catch (err) {
    return safeError(c, err, '운송장 등록 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});
