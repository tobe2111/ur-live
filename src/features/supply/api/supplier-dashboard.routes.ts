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
import { setSupplyMeta } from '@/worker/utils/product-supply-meta';
import { ensureSupplyVisibilitySchema, normalizeVisibility, recordSupplyPriceChange } from './supply-visibility';
import { buildCsv, csvResponse, parseCsv } from './supply-csv';
import { buildXlsx, xlsxResponse, type XlsxCell } from './xlsx';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { listSupplierPurchaseInvoices } from './wholesale-tax-invoices';
import { SUPPLY_CHANNEL_THRESHOLDS_KEY, parseChannelThresholds } from '@/shared/supply-channels';

export const supplierDashboardRoutes = new Hono<{ Bindings: Env }>();

// 모든 라우트 공급자 인증 필수.
supplierDashboardRoutes.use('*', requireSupplier());

function supplierId(c: { get: (k: string) => unknown }): number | null {
  const user = c.get('user') as { id?: string | number } | undefined;
  const id = Number(user?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// ── BIZ-8 (2026-06-08) MOQ/단가 고도화 — pack_size / order_multiple 컬럼 멱등 ensure. ───
//   pack_size = 1박스 낱개 수(표시용), order_multiple = 주문 배수 강제(1=제약 없음). min_order_qty 는 기존 컬럼.
//   wholesale.routes 의 ensureQtyConstraintSchema 와 동일 — 제조사가 catalog 조회 전 먼저 등록할 수도 있어 양쪽 self-ensure.
const _qtyConstraintEnsured = new WeakSet<object>();
async function ensureQtyConstraintSchema(DB: D1Database) {
  if (_qtyConstraintEnsured.has(DB)) return;
  _qtyConstraintEnsured.add(DB);
  for (const sql of [
    'ALTER TABLE products ADD COLUMN pack_size INTEGER DEFAULT 1',
    'ALTER TABLE products ADD COLUMN order_multiple INTEGER DEFAULT 1',
    // 🏷️ 2026-06-09 브랜드 전시관 — brand_name(브랜드제품 라벨, is_brand_product=1 일 때만 의미). repair-schema 와 멱등 동일.
    'ALTER TABLE products ADD COLUMN brand_name TEXT',
    // 🏷️ 2026-06-09 브랜드 전시관 로고 — brand_logo_url(선택 이미지 URL). 없으면 기존 텍스트 칩 불변.
    'ALTER TABLE products ADD COLUMN brand_logo_url TEXT',
  ]) { await DB.prepare(sql).run().catch(swallow('supplier-dashboard:biz8:alter')); }
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

    // 🧭 2026-06-12 (감사 개선 ⑥ — 온보딩 마일스톤): 가입→첫 상품→첫 승인→첫 주문→첫 정산.
    //   홈 탭 체크리스트용 — 라이트한 COUNT 2개(fail-soft)만 추가, 기존 응답 필드 불변(additive).
    const [orderCnt, settleCnt] = await Promise.all([
      DB.prepare('SELECT COUNT(*) AS n FROM wholesale_order_items WHERE supplier_id = ?')
        .bind(sid).first<{ n: number }>().catch(() => null),
      DB.prepare("SELECT COUNT(*) AS n FROM supplier_settlements WHERE supplier_id = ? AND source = 'wholesale'")
        .bind(sid).first<{ n: number }>().catch(() => null),
    ]);

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
        milestones: {
          orders: orderCnt?.n ?? 0,
          settlements: settleCnt?.n ?? 0,
        },
      },
    });
  } catch (err) {
    return safeError(c, err, '정보 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 🚚 2026-06-09 제조사별 배송/주문 정책 — suppliers 3컬럼 멱등 ensure. ──────────────
//   min_order_amount / shipping_fee / free_ship_threshold (0 = 제한/배송비/무료배송 없음).
//   wholesale.routes 의 ensureSupplierPolicySchema 와 동일 — 제조사가 정책을 먼저 저장할 수도 있어 양쪽 self-ensure.
const _supPolicyEnsured = new WeakSet<object>();
async function ensureSupplierPolicySchema(DB: D1Database) {
  if (_supPolicyEnsured.has(DB)) return;
  _supPolicyEnsured.add(DB);
  for (const sql of [
    'ALTER TABLE suppliers ADD COLUMN min_order_amount INTEGER DEFAULT 0',
    'ALTER TABLE suppliers ADD COLUMN shipping_fee INTEGER DEFAULT 0',
    'ALTER TABLE suppliers ADD COLUMN free_ship_threshold INTEGER DEFAULT 0',
  ]) { await DB.prepare(sql).run().catch(swallow('supplier-dashboard:policy:alter')); }
}

// ── GET /shipping-policy — 내 배송/주문 정책 조회 ──────────────────────────────
supplierDashboardRoutes.get('/shipping-policy', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    await ensureSupplierPolicySchema(DB);
    const row = await DB.prepare(
      `SELECT COALESCE(min_order_amount,0) AS min_order_amount, COALESCE(shipping_fee,0) AS shipping_fee, COALESCE(free_ship_threshold,0) AS free_ship_threshold
         FROM suppliers WHERE id = ?`
    ).bind(sid).first<{ min_order_amount: number; shipping_fee: number; free_ship_threshold: number }>().catch(() => null);
    return c.json({
      success: true,
      data: {
        min_order_amount: Math.max(0, Math.floor(row?.min_order_amount ?? 0)),
        shipping_fee: Math.max(0, Math.floor(row?.shipping_fee ?? 0)),
        free_ship_threshold: Math.max(0, Math.floor(row?.free_ship_threshold ?? 0)),
      },
    });
  } catch (err) {
    return safeError(c, err, '배송 정책 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── PATCH /shipping-policy — 내 배송/주문 정책 저장 ────────────────────────────
//   min_order_amount(최소주문금액) / shipping_fee(배송비) / free_ship_threshold(무료배송 기준).
//   모두 0 이상 정수. 상식적 상한(1억원) clamp. 미지정 필드는 기존값 유지.
const POLICY_MAX = 100_000_000; // 1억원 — 비현실 값/오타 방어 상한.
supplierDashboardRoutes.patch('/shipping-policy', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    await ensureSupplierPolicySchema(DB);
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    // 입력 검증 — finite + 0 이상 + 상한 clamp. 미지정(undefined)은 그대로 두고 갱신 안 함.
    const sanitize = (v: unknown): number | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return Math.min(POLICY_MAX, Math.floor(n));
    };
    const minOrder = sanitize(body.min_order_amount);
    const shipFee = sanitize(body.shipping_fee);
    const freeShip = sanitize(body.free_ship_threshold);
    if (minOrder === undefined && shipFee === undefined && freeShip === undefined) {
      return c.json({ success: false, error: '변경할 값이 없습니다' }, 400);
    }
    const sets: string[] = [];
    const params: number[] = [];
    if (minOrder !== undefined) { sets.push('min_order_amount = ?'); params.push(minOrder); }
    if (shipFee !== undefined) { sets.push('shipping_fee = ?'); params.push(shipFee); }
    if (freeShip !== undefined) { sets.push('free_ship_threshold = ?'); params.push(freeShip); }
    await DB.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).bind(...params, sid).run();
    const row = await DB.prepare(
      `SELECT COALESCE(min_order_amount,0) AS min_order_amount, COALESCE(shipping_fee,0) AS shipping_fee, COALESCE(free_ship_threshold,0) AS free_ship_threshold
         FROM suppliers WHERE id = ?`
    ).bind(sid).first<{ min_order_amount: number; shipping_fee: number; free_ship_threshold: number }>().catch(() => null);
    return c.json({
      success: true,
      message: '배송 정책이 저장되었습니다',
      data: {
        min_order_amount: Math.max(0, Math.floor(row?.min_order_amount ?? 0)),
        shipping_fee: Math.max(0, Math.floor(row?.shipping_fee ?? 0)),
        free_ship_threshold: Math.max(0, Math.floor(row?.free_ship_threshold ?? 0)),
      },
    });
  } catch (err) {
    return safeError(c, err, '배송 정책 저장 중 오류가 발생했습니다', '[supplier-dashboard]');
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
    await ensureSupplyVisibilitySchema(DB);
    await ensureQtyConstraintSchema(DB); // BIZ-8: pack_size / order_multiple 컬럼 보장(SELECT 전).
    let where = 'supplier_id = ? AND is_supply_product = 1';
    const params: (string | number)[] = [sid];
    if (status === 'pending' || status === 'rejected') {
      where += ' AND supply_approval_status = ?'; params.push(status);
    } else if (status === 'approved') {
      where += " AND (supply_approval_status = 'approved' OR (supply_approval_status IS NULL AND is_active = 1))";
    }

    const rows = await DB.prepare(
      `SELECT id, name, description, price AS retail_price, COALESCE(supply_price, 0) AS supply_price,
              stock, image_url, category, COALESCE(supply_visibility,'ALL') AS supply_visibility, barcode, is_brand_product, brand_name, brand_logo_url,
              COALESCE(min_order_qty,1) AS min_order_qty,
              COALESCE(pack_size,1) AS pack_size, COALESCE(order_multiple,1) AS order_multiple,
              lowest_price_url, COALESCE(lowest_price_checked,0) AS lowest_price_checked,
              pending_supply_price, pending_retail_price, pending_price_url, pending_price_reason, pending_price_requested_at,
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
      supply_visibility?: string; barcode?: string; is_brand_product?: boolean; brand_name?: string; brand_logo_url?: string; min_order_qty?: number;
      pack_size?: number; order_multiple?: number;
      lowest_price_url?: string;
      // 🖼️ 2026-06-12: 상세페이지 이미지 — 배열 또는 쉼표 구분 문자열 (썸네일 image_url 과 분리).
      detail_images?: string[] | string;
    };
    const body = await c.req.json<ProductBody>().catch(() => ({} as ProductBody));
    await ensureSupplyVisibilitySchema(DB);
    await ensureQtyConstraintSchema(DB); // BIZ-8: pack_size / order_multiple 컬럼 보장(INSERT 전). (+ brand_name)

    const name = (body.name || '').trim();
    const supplyPrice = Number(body.supply_price);
    // 🆕 2026-06-16 신모델(판매가 대비 보장마진): 권장 소비자가(판매가) 필수 + 공급가보다 높아야 함.
    //   유통사/플랫폼 마진이 전부 (판매가−공급가) 에서 나옴 — 미입력/동일가면 마진 0(팔 수 없는 상품)이라 차단.
    const suggestedRetail = Number(body.suggested_retail_price);
    const stock = Number.isFinite(Number(body.stock)) ? Math.max(0, Math.floor(Number(body.stock))) : 0;
    // MOQ — 최소 주문 수량(박스 단위). 1~100000, 기본 1.
    const moq = Number.isFinite(Number(body.min_order_qty)) ? Math.min(100000, Math.max(1, Math.floor(Number(body.min_order_qty)))) : 1;
    // 🏭 BIZ-8 (2026-06-08) pack_size(1박스 낱개 — 표시용) / order_multiple(주문 배수 강제). 정수 ≥1, 기본 1.
    const packSize = Number.isFinite(Number(body.pack_size)) ? Math.min(100000, Math.max(1, Math.floor(Number(body.pack_size)))) : 1;
    const orderMultiple = Number.isFinite(Number(body.order_multiple)) ? Math.min(100000, Math.max(1, Math.floor(Number(body.order_multiple)))) : 1;

    if (!name) return c.json({ success: false, error: '상품명은 필수입니다' }, 400);
    if (name.length > 200) return c.json({ success: false, error: '상품명은 200자 이하여야 합니다' }, 400);
    if (!Number.isFinite(supplyPrice) || supplyPrice <= 0) return c.json({ success: false, error: '공급가는 0원 이상이어야 합니다' }, 400);
    if (!Number.isFinite(suggestedRetail) || suggestedRetail <= supplyPrice) {
      return c.json({ success: false, error: '권장 소비자가(판매가)는 공급가보다 높아야 합니다 — 유통 마진이 여기서 나옵니다', code: 'RETAIL_TOO_LOW' }, 400);
    }

    // 승인된 공급자만 등록 가능 (정지/대기 차단).
    const sup = await DB.prepare('SELECT status FROM suppliers WHERE id = ?').bind(sid).first<{ status: string }>();
    if (!sup || sup.status !== 'approved') {
      return c.json({ success: false, error: '승인된 공급자만 상품을 등록할 수 있습니다' }, 403);
    }

    const slug = `sup-${sid}-${name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').substring(0, 40)}-${Date.now()}`;

    // 🛡️ is_active=0 (어드민 승인 전 카탈로그 비노출) + supply_approval_status='pending'.
    //   seller_id=NULL (소스 카탈로그 상품 — 셀러가 register 로 자기 스토어에 복제).
    const visibility = normalizeVisibility(body.supply_visibility, true);
    const barcode = (body.barcode || '').trim().slice(0, 64) || null;
    const isBrand = body.is_brand_product ? 1 : 0;
    // 🏷️ 2026-06-17 (대표 요청): 브랜드명 상시 입력 — is_brand_product 체크 무관하게 저장(브랜드 전시관 노출용).
    const brandName = (body.brand_name || '').trim().slice(0, 120) || null;
    // 🏷️ 브랜드 로고 URL — 브랜드제품일 때만 저장. http(s) 또는 /api/... 상대경로(≤1000자).
    const brandLogoRaw = (body.brand_logo_url || '').trim().slice(0, 1000);
    const brandLogoUrl = isBrand && (/^https?:\/\//i.test(brandLogoRaw) || /^\//.test(brandLogoRaw)) ? brandLogoRaw : null;
    // 온라인 최저가 참고 링크 (어드민 최저가 검수용). http(s) 만 허용.
    const lpUrlRaw = (body.lowest_price_url || '').trim().slice(0, 500);
    const lpUrl = /^https?:\/\//i.test(lpUrlRaw) ? lpUrlRaw : null;
    // 🖼️ 상세페이지 이미지 — 배열/쉼표 문자열 모두 허용, http(s) 만, 최대 10장 → detail_images JSON.
    const detailListRaw = Array.isArray(body.detail_images)
      ? body.detail_images.map(u => String(u))
      : String(body.detail_images || '').split(/[,\n|]/);
    const detailList = detailListRaw.map(u => u.trim().slice(0, 500)).filter(u => /^https?:\/\//i.test(u)).slice(0, 10);
    const detailImages = detailList.length ? JSON.stringify(detailList) : null;

    const result = await DB.prepare(
      `INSERT INTO products (
         name, description, price, supply_price, stock,
         image_url, detail_images, category, product_type, is_active, is_supply_product,
         supplier_id, supply_approval_status, supply_visibility, barcode, is_brand_product, brand_name, brand_logo_url, min_order_qty, pack_size, order_multiple, lowest_price_url, mall_id, slug, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'regular', 0, 1, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(mall_id,1) FROM suppliers WHERE id=?), ?, datetime('now'), datetime('now'))`
    ).bind(
      name,
      (body.description || '').slice(0, 5000),
      Math.floor(suggestedRetail),
      Math.floor(supplyPrice),
      stock,
      (body.image_url || '').slice(0, 1000),
      detailImages,
      (body.category || 'lifestyle').slice(0, 60),
      sid,
      visibility,
      barcode,
      isBrand,
      brandName,
      brandLogoUrl,
      moq,
      packSize,
      orderMultiple,
      lpUrl,
      sid, // 🏬 mall_id = 공급자 소속 몰(서브쿼리 바인드) — 신규 몰 제조사 상품이 그 몰 카탈로그에 노출
      slug,
    ).run();

    // 🚚 2026-06-15 (대표 요청): 상품별 배송비 — product_supply_meta(products 컬럼 미증식). 0=무료, 미입력=제조사 정책 폴백.
    {
      const shipRaw = (body as { shipping_fee?: unknown }).shipping_fee;
      if (shipRaw != null && shipRaw !== '' && Number.isFinite(Number(shipRaw))) {
        await setSupplyMeta(DB, Number(result.meta.last_row_id), { wholesale_shipping_fee: Math.max(0, Math.floor(Number(shipRaw))) }).catch(swallow('supplier-dashboard:ship-meta'));
      }
    }

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

// ── GET /products/bulk-template — 대량등록 표준 양식 (CSV/.xlsx) ────────────────
// 📥 2026-06-12: 단건 폼과 parity — 박스입수/주문배수/이미지 추가. 업로드는 .xlsx 도 지원(클라가 CSV 변환).
// 🖼️ 2026-06-12 (사용자 요청): 썸네일(대표)과 상세페이지 이미지 분리 — 상세는 쉼표로 여러 장(최대 10).
const BULK_TEMPLATE_HEADERS = ['상품명', '공급가', '권장소비자가', '재고', '카테고리', '바코드', '공급범위', '브랜드제품', '브랜드명', '최소주문수량', '박스입수', '주문배수', '썸네일 이미지URL', '상세 이미지URL(쉼표로 여러 장)', '설명']
const BULK_TEMPLATE_ROWS = [
  ['예시상품A', '5000', '9900', '100', 'lifestyle', '8801234567890', 'ALL', 'N', '', '1', '1', '1', 'https://example.com/a.jpg', 'https://example.com/a-detail1.jpg,https://example.com/a-detail2.jpg', '상품 설명'],
  ['예시상품B(유통스타트전용)', '12000', '19900', '50', 'beauty', '', 'UTONGSTART_ONLY', 'Y', '브랜드A', '20', '20', '20', '', '', '브랜드제품(브랜드명 입력)·선정 유통사만 노출(20개 단위)'],
]
supplierDashboardRoutes.get('/products/bulk-template', (c) => {
  return csvResponse(buildCsv(BULK_TEMPLATE_HEADERS, BULK_TEMPLATE_ROWS), 'supply-products-template.csv')
})
// 엑셀로 바로 열리는 진짜 .xlsx 양식 (사용자 요청 — "엑셀파일로").
// 📐 2026-06-12 (사용자 요청): 공급률(%)·셀러 마진율(%) **엑셀 수식 자동계산** 컬럼 —
//   공급가(B)/권장소비자가(C)를 입력하는 즉시 그 행에서 계산(200행 미리 깔림, IF 가드로
//   미입력 행은 빈칸 → 업로드 파서가 빈 행으로 무시). 공급률 = 채널 안내와 동일 지표.
//   CSV 양식엔 수식 미포함(CSV 는 수식 보존 불가 + injection 혼동 방지) — 데이터 컬럼만.
export function buildBulkTemplateXlsx(): Uint8Array {
  const headers = [...BULK_TEMPLATE_HEADERS, '공급률(%) 자동계산', '셀러 마진율(%) 자동계산']
  const FORMULA_ROWS = 200
  const rows: XlsxCell[][] = []
  for (let i = 0; i < FORMULA_ROWS; i++) {
    const rn = i + 2 // 엑셀 행 번호 (1행 = 헤더)
    const base: XlsxCell[] = i < BULK_TEMPLATE_ROWS.length
      ? [...BULK_TEMPLATE_ROWS[i]]
      : Array(BULK_TEMPLATE_HEADERS.length).fill('')
    rows.push([
      ...base,
      // 공급률 = 공급가 ÷ 권장소비자가 × 100 — 낮을수록 더 많은 유통채널 제안 가능.
      { formula: `IF(OR($B${rn}="",$C${rn}="",$C${rn}=0),"",ROUND($B${rn}/$C${rn}*100,1))` },
      // 셀러 마진율 = (권장가 − 공급가) ÷ 공급가 × 100.
      { formula: `IF(OR($B${rn}="",$B${rn}=0,$C${rn}=""),"",ROUND(($C${rn}-$B${rn})/$B${rn}*100,1))` },
    ])
  }
  return buildXlsx(headers, rows, '상품등록')
}
supplierDashboardRoutes.get('/products/bulk-template.xlsx', (c) => {
  return xlsxResponse(buildBulkTemplateXlsx(), 'supply-products-template.xlsx')
})

// ── POST /products/bulk — 대량등록 (CSV 업로드) ────────────────────────────────
supplierDashboardRoutes.post('/products/bulk', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    await ensureSupplyVisibilitySchema(DB);
    await ensureQtyConstraintSchema(DB); // 🏷️ brand_name 컬럼 보장(bulk INSERT 전).
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
    const INSERT_SQL = `INSERT INTO products (name, description, price, supply_price, stock, image_url, detail_images, category, product_type,
       is_active, is_supply_product, supplier_id, supply_approval_status, supply_visibility, barcode, is_brand_product, brand_name, min_order_qty, pack_size, order_multiple, mall_id, slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'regular', 0, 1, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(mall_id,1) FROM suppliers WHERE id=?), ?, datetime('now'), datetime('now'))`;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // 📐 2026-06-12: 완전 빈 행은 조용히 skip — 양식의 수식 컬럼(IF→"") 잔여 행/공백 줄이
      //   '상품명 누락' 오류로 잡히지 않게. (값이 하나라도 있는 행은 기존대로 검증.)
      if (Object.values(r).every(v => !String(v ?? '').trim())) continue;
      const name = String(r['상품명'] || r.name || '').trim();
      const supplyPrice = Number(String(r['공급가'] || r.supply_price || '').replace(/[,\s]/g, ''));
      const retail = Number(String(r['권장소비자가'] || r.suggested_retail_price || r['공급가'] || '').replace(/[,\s]/g, ''));
      const stock = Math.max(0, Math.floor(Number(String(r['재고'] || r.stock || '0').replace(/[,\s]/g, '')) || 0));
      if (!name) { results.push({ row: i + 2, status: 'error', reason: '상품명 누락' }); continue; }
      if (!Number.isFinite(supplyPrice) || supplyPrice <= 0) { results.push({ row: i + 2, name, status: 'error', reason: '공급가 오류' }); continue; }
      const retailFinal = Number.isFinite(retail) && retail >= supplyPrice ? retail : supplyPrice;
      const visibility = normalizeVisibility(r['공급범위'] || r.supply_visibility, true);
      const barcode = String(r['바코드'] || r.barcode || '').trim().slice(0, 64) || null;
      const brandRaw = String(r['브랜드제품'] || r.is_brand_product || '').trim().toUpperCase();
      const isBrand = ['Y', 'YES', '예', '1', 'TRUE', 'O'].includes(brandRaw) ? 1 : 0;
      // 🏷️ 브랜드명 — 브랜드제품일 때만 저장(일반제품이면 null). 120자 cap.
      const brandName = isBrand ? (String(r['브랜드명'] || r.brand_name || '').trim().slice(0, 120) || null) : null;
      const moq = Math.min(100000, Math.max(1, Math.floor(Number(String(r['최소주문수량'] || r.min_order_qty || '1').replace(/[,\s]/g, '')) || 1)));
      // 📥 2026-06-12 parity: 박스입수/주문배수/이미지URL (단건 폼과 동일 — 기본 1/1/'').
      const packSize = Math.min(100000, Math.max(1, Math.floor(Number(String(r['박스입수'] || r.pack_size || '1').replace(/[,\s]/g, '')) || 1)));
      const orderMultiple = Math.min(100000, Math.max(1, Math.floor(Number(String(r['주문배수'] || r.order_multiple || '1').replace(/[,\s]/g, '')) || 1)));
      // 🖼️ 썸네일(대표) — 구 헤더 '이미지URL' 도 하위호환 인식.
      const imageUrlRaw = String(r['썸네일 이미지URL'] || r['이미지URL'] || r.image_url || '').trim().slice(0, 500);
      const imageUrl = /^https?:\/\//i.test(imageUrlRaw) ? imageUrlRaw : '';
      // 🖼️ 상세페이지 이미지 — 쉼표/줄바꿈 구분 여러 장(최대 10), http(s) 만 → detail_images JSON 배열.
      const detailRaw = String(r['상세 이미지URL(쉼표로 여러 장)'] || r['상세이미지URL'] || r.detail_images || '').trim();
      const detailList = detailRaw
        ? detailRaw.split(/[,\n|]/).map(u => u.trim().slice(0, 500)).filter(u => /^https?:\/\//i.test(u)).slice(0, 10)
        : [];
      const detailImages = detailList.length ? JSON.stringify(detailList) : null;
      const slug = `sup-${sid}-${name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').substring(0, 30)}-${Date.now()}-${i}`;
      stmts.push(DB.prepare(INSERT_SQL).bind(
        name.slice(0, 200), String(r['설명'] || r.description || '').slice(0, 5000),
        Math.floor(retailFinal), Math.floor(supplyPrice), stock, imageUrl, detailImages,
        String(r['카테고리'] || r.category || 'lifestyle').slice(0, 60), sid, visibility, barcode, isBrand, brandName, moq, packSize, orderMultiple, sid, slug,
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
      supply_visibility?: string; barcode?: string; is_brand_product?: boolean; brand_name?: string; brand_logo_url?: string; lowest_price_url?: string;
      min_order_qty?: number; pack_size?: number; order_multiple?: number; shipping_fee?: number;
    };
    const body = await c.req.json<EditBody>().catch(() => ({} as EditBody));
    // 🚚 2026-06-16: 상품별 배송비 수정 — product_supply_meta(wholesale_shipping_fee). 컬럼 아님(예산제) → sets 와 별개.
    const shipFee = (body.shipping_fee != null && Number.isFinite(Number(body.shipping_fee)))
      ? Math.max(0, Math.floor(Number(body.shipping_fee)))
      : undefined;
    await ensureSupplyVisibilitySchema(DB);
    await ensureQtyConstraintSchema(DB); // BIZ-8: pack_size / order_multiple 컬럼 보장(UPDATE 전).

    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (typeof body.name === 'string' && body.name.trim()) { sets.push('name = ?'); params.push(body.name.trim().slice(0, 200)); }
    if (typeof body.description === 'string') { sets.push('description = ?'); params.push(body.description.slice(0, 5000)); }
    if (typeof body.lowest_price_url === 'string') {
      const u = body.lowest_price_url.trim().slice(0, 500);
      sets.push('lowest_price_url = ?'); params.push(/^https?:\/\//i.test(u) ? u : '');
    }
    if (typeof body.image_url === 'string') { sets.push('image_url = ?'); params.push(body.image_url.slice(0, 1000)); }
    if (typeof body.category === 'string' && body.category.trim()) { sets.push('category = ?'); params.push(body.category.trim().slice(0, 60)); }
    if (body.stock != null && Number.isFinite(Number(body.stock))) { sets.push('stock = ?'); params.push(Math.max(0, Math.floor(Number(body.stock)))); }
    if (typeof body.supply_visibility === 'string') { sets.push('supply_visibility = ?'); params.push(normalizeVisibility(body.supply_visibility, true)); }
    if (typeof body.barcode === 'string') { sets.push('barcode = ?'); params.push(body.barcode.trim().slice(0, 64)); }
    if (body.is_brand_product != null) { sets.push('is_brand_product = ?'); params.push(body.is_brand_product ? 1 : 0); }
    // 🏷️ 브랜드명 수정 — 문자열 들어오면 120자 cap(빈 문자열이면 null 로 해제).
    if (typeof body.brand_name === 'string') { sets.push('brand_name = ?'); params.push(body.brand_name.trim().slice(0, 120) || null); }
    // 🏷️ 브랜드 로고 URL 수정 — http(s) 또는 /api/... 상대경로만 허용(≤1000자). 빈 문자열이면 null 로 해제.
    if (typeof body.brand_logo_url === 'string') {
      const raw = body.brand_logo_url.trim().slice(0, 1000);
      const safe = (/^https?:\/\//i.test(raw) || /^\//.test(raw)) ? raw : null;
      sets.push('brand_logo_url = ?'); params.push(safe);
    }
    // 🏭 BIZ-8 (2026-06-08) MOQ/박스단위 수정 — 정수 ≥1, 1~100000 clamp. (가격 산식 무관 — 수량 제약만.)
    if (body.min_order_qty != null && Number.isFinite(Number(body.min_order_qty))) { sets.push('min_order_qty = ?'); params.push(Math.min(100000, Math.max(1, Math.floor(Number(body.min_order_qty))))); }
    if (body.pack_size != null && Number.isFinite(Number(body.pack_size))) { sets.push('pack_size = ?'); params.push(Math.min(100000, Math.max(1, Math.floor(Number(body.pack_size))))); }
    if (body.order_multiple != null && Number.isFinite(Number(body.order_multiple))) { sets.push('order_multiple = ?'); params.push(Math.min(100000, Math.max(1, Math.floor(Number(body.order_multiple))))); }

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
      // 🆕 2026-06-16 신모델: 판매가 > 공급가 (동일가 = 마진 0 차단).
      if (!Number.isFinite(r) || r <= newSupply) return c.json({ success: false, error: '권장 소비자가(판매가)는 공급가보다 높아야 합니다', code: 'RETAIL_TOO_LOW' }, 400);
      sets.push('price = ?'); params.push(Math.floor(r));
    }

    if (sets.length === 0 && shipFee === undefined) return c.json({ success: false, error: '변경할 내용이 없습니다' }, 400);

    // 거부 상태였으면 재제출 → 다시 pending.
    sets.push("supply_approval_status = 'pending'", 'is_active = 0', "updated_at = datetime('now')");
    await DB.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).bind(...params, pid).run();

    // 🚚 상품별 배송비(meta) — 컬럼이 아니라 product_supply_meta. 제공 시에만 갱신(fail-soft).
    if (shipFee !== undefined) {
      await setSupplyMeta(DB, Number(pid), { wholesale_shipping_fee: shipFee }).catch(swallow('supplier-dashboard:patch-ship-meta'));
    }

    // 🛡️ 스펙: 공급가 수정 시 수정 전 금액 기록 (관리자만 확인).
    if (supplyChanged) {
      await recordSupplyPriceChange(DB, Number(pid), sid, existing.supply_price, newSupply, `supplier:${sid}`);
    }

    return c.json({ success: true, data: { id: Number(pid), approval_status: 'pending' }, message: '수정되었습니다. 다시 승인 대기 상태가 됩니다.' });
  } catch (err) {
    return safeError(c, err, '상품 수정 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── POST /products/:id/price-change-request — 승인된(판매중) 상품 가격 수정 요청 ────────
//   🏭 2026-06-07 (사용자 요청): 승인된 상품 가격은 즉시 못 바꿈 → 운영진 승인 필요.
//   pending_* 에 적재만 하고 라이브 supply_price/price 는 유지(승인 전 노출가 불변).
//   어드민이 /api/admin/supplier-products/:id/price-change 로 승인 시에만 실제 반영.
supplierDashboardRoutes.post('/products/:id/price-change-request', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  const pid = c.req.param('id');
  if (!/^\d+$/.test(String(pid))) return c.json({ success: false, error: '잘못된 상품 ID' }, 400);
  try {
    await ensureSupplyVisibilitySchema(DB);
    const existing = await DB.prepare(
      `SELECT id, name, supplier_id, supply_approval_status, is_active, supply_price, price
         FROM products WHERE id = ? AND is_supply_product = 1`
    ).bind(pid).first<{ id: number; name: string; supplier_id: number | null; supply_approval_status: string | null; is_active: number; supply_price: number; price: number }>();
    if (!existing || existing.supplier_id !== sid) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404);
    }
    // 승인(판매중) 상품만 이 흐름 사용. 대기/거부 상품은 일반 PATCH 로 즉시 수정.
    const effectiveStatus = existing.supply_approval_status ?? (existing.is_active === 1 ? 'approved' : 'pending');
    if (effectiveStatus !== 'approved') {
      return c.json({ success: false, error: '승인 대기/거부 상품은 가격을 바로 수정할 수 있습니다' }, 409);
    }

    const body = await c.req.json<{ new_supply_price?: number; new_retail_price?: number; lowest_price_url?: string; reason?: string }>()
      .catch(() => ({} as { new_supply_price?: number; new_retail_price?: number; lowest_price_url?: string; reason?: string }));

    const newSupply = Math.floor(Number(body.new_supply_price));
    if (!Number.isFinite(newSupply) || newSupply <= 0) {
      return c.json({ success: false, error: '변경할 공급가는 0원 이상이어야 합니다' }, 400);
    }
    // 권장 소비자가는 미입력 시 기존 유지. 입력 시 새 공급가보다 높아야 함(신모델 — 마진 0 차단).
    let newRetail: number | null = null;
    if (body.new_retail_price != null && String(body.new_retail_price) !== '') {
      const r = Math.floor(Number(body.new_retail_price));
      if (!Number.isFinite(r) || r <= newSupply) {
        return c.json({ success: false, error: '권장 소비자가(판매가)는 공급가보다 높아야 합니다', code: 'RETAIL_TOO_LOW' }, 400);
      }
      newRetail = r;
    }
    if (newSupply === existing.supply_price && (newRetail == null || newRetail === existing.price)) {
      return c.json({ success: false, error: '기존 가격과 동일합니다' }, 400);
    }

    const lpRaw = (body.lowest_price_url || '').trim().slice(0, 500);
    const lpUrl = /^https?:\/\//i.test(lpRaw) ? lpRaw : null;
    const reason = (body.reason || '').trim().slice(0, 300) || null;

    await DB.prepare(
      `UPDATE products
          SET pending_supply_price = ?, pending_retail_price = ?, pending_price_url = ?,
              pending_price_reason = ?, pending_price_requested_at = datetime('now')
        WHERE id = ? AND supplier_id = ?`
    ).bind(newSupply, newRetail, lpUrl, reason, pid, sid).run();

    // 어드민 승인 큐 알림.
    createDashboardNotification(DB, 'admin', null, 'supply_price_change_requested', '공급가 변경 승인 요청',
      `공급자 #${sid}: ${existing.name} ${existing.supply_price.toLocaleString()}→${newSupply.toLocaleString()}원`, '/admin/products')
      .catch(swallow('supplier-dashboard'));

    return c.json({
      success: true,
      data: { id: Number(pid), pending_supply_price: newSupply, pending_retail_price: newRetail },
      message: '가격 수정 요청이 접수되었습니다. 운영진 승인 후 반영됩니다. (승인 전까지 기존 가격 유지)',
    });
  } catch (err) {
    return safeError(c, err, '가격 수정 요청 중 오류가 발생했습니다', '[supplier-dashboard]');
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

// ── GET /settlements/export — 정산 내역 .xlsx 다운로드 (공급자 본인 것만, IDOR 가드) ──────
//   컬럼: 일자/주문번호/상품명/공급가액/상태/출금일. 최신 5000건.
//   Rate limit: 10건/분 — 반복 대량 추출 방지.
supplierDashboardRoutes.get('/settlements/export', rateLimit({ action: 'supplier-settlements-export', max: 10, windowSec: 60 }), async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    const { results } = await DB.prepare(
      `SELECT ss.id, ss.order_id, ss.supply_amount, ss.status,
              ss.created_at, ss.available_at, ss.paid_at,
              p.name AS product_name
         FROM supplier_settlements ss
         LEFT JOIN products p ON p.id = ss.product_id
        WHERE ss.supplier_id = ?
        ORDER BY ss.created_at DESC LIMIT 5000`
    ).bind(sid).all<{
      id: number; order_id: number | null; supply_amount: number; status: string
      created_at: string; available_at: string | null; paid_at: string | null; product_name: string | null
    }>();
    const STATUS_KO: Record<string, string> = {
      pending: '정산 대기', available: '출금 가능', paid: '지급 완료', cancelled: '취소(환불)',
    };
    const headers = ['일자', '주문번호', '상품명', '공급가액', '상태', '출금 가능일', '지급일'];
    const rows = (results || []).map(s => [
      (s.created_at || '').slice(0, 10),
      s.order_id != null ? `#${s.order_id}` : '-',
      s.product_name || '-',
      s.supply_amount,
      STATUS_KO[s.status] || s.status,
      (s.available_at || '').slice(0, 10) || '-',
      (s.paid_at || '').slice(0, 10) || '-',
    ]);
    const date = new Date().toISOString().slice(0, 10);
    return xlsxResponse(buildXlsx(headers, rows, '정산내역'), `supplier-settlements-${date}.xlsx`);
  } catch (err) {
    return safeError(c, err, '정산 내역 내보내기 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── GET /tax-invoices — 내(제조사) 매입 역발행 세금계산서 목록 (제조사→플랫폼) ─────────
//   🏭 Wave 3c: 도매 주문 정산 적립 시 자동발행된 purchase 레코드를 본인 것만 조회. 공급가액/세액/합계/상태.
supplierDashboardRoutes.get('/tax-invoices', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  try {
    const invoices = await listSupplierPurchaseInvoices(c.env.DB, sid);
    return c.json({ success: true, invoices });
  } catch (err) {
    return safeError(c, err, '세금계산서 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
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
    // DONE = 결제완료(정산완료 주문), PARTIAL_REFUNDED = 부분환불됐지만 나머지 발송완료 주문
    if (status === 'shipped') statusWhere = "o.status IN ('SHIPPING','DELIVERED','DONE','PARTIAL_REFUNDED')";
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

// ── order_items 라인별 배송 컬럼 멱등 ensure ───────────────────────────────────
//   🛡️ 2026-06-07 SEC-1: 위탁(dropship) 발송은 주문 전체가 아니라 공급자 본인 라인만
//     발송 처리돼야 함. 소비자 order_items 테이블엔 라인별 courier/tracking/shipped 컬럼이
//     없으므로 wholesale_order_items(line_status/courier/...) 와 동일한 라인 스코프를 위해
//     order_items 에 per-line 컬럼을 멱등 추가. (D1 은 ADD COLUMN IF NOT EXISTS 미지원.)
const _orderItemsShipEnsuring = new WeakMap<object, Promise<void>>();
async function ensureOrderItemsShipSchema(DB: D1Database): Promise<void> {
  const existing = _orderItemsShipEnsuring.get(DB);
  if (existing) return existing;
  const p = (async () => {
    const cols = await DB.prepare("SELECT name FROM pragma_table_info('order_items')")
      .all<{ name: string }>().catch(() => ({ results: [] as { name: string }[] }));
    const have = new Set((cols.results || []).map(r => r.name));
    if (!have.has('shipped_at')) {
      await DB.prepare("ALTER TABLE order_items ADD COLUMN shipped_at DATETIME").run().catch(swallow('order-items:add-shipped-at'));
    }
    if (!have.has('courier')) {
      await DB.prepare("ALTER TABLE order_items ADD COLUMN courier TEXT").run().catch(swallow('order-items:add-courier'));
    }
    if (!have.has('tracking_number')) {
      await DB.prepare("ALTER TABLE order_items ADD COLUMN tracking_number TEXT").run().catch(swallow('order-items:add-tracking'));
    }
    if (!have.has('tracking_carrier_code')) {
      await DB.prepare("ALTER TABLE order_items ADD COLUMN tracking_carrier_code TEXT").run().catch(swallow('order-items:add-carrier-code'));
    }
  })();
  _orderItemsShipEnsuring.set(DB, p);
  try {
    await p;
  } catch {
    _orderItemsShipEnsuring.delete(DB);
  }
}

// ── PUT /orders/:orderId/shipping — 공급자 운송장 입력 (INC-8) ─────────────────
//   기존 셀러 배송 인프라(courier 정규화 + tracking_carrier_code + shipping_tracking_events) 재사용.
//   🛡️ SEC-1 fix: 공급자 본인 라인(order_items whose product.supply_source_id → src.supplier_id=sid)
//     만 발송 처리. 혼합 주문(타 공급자/일반 셀러 라인 포함)에선 공유 orders 행의
//     tracking/courier 를 절대 덮어쓰지 않음 — 라인 레벨에만 기록.
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

    await ensureOrderItemsShipSchema(DB);

    const { normalizeCourierKey } = await import('../../../worker/utils/courier-codes');
    const carrierKey = normalizeCourierKey(body.courier);

    // 1)~3) 발송 기록 3 writes — 원자 배치 (🛡️ 2026-06-11 감사: 라운드트립 3→1).
    //   배치는 한 트랜잭션에서 순차 실행되므로 2)·3) 의 NOT EXISTS 가 1) 의 shipped_at 반영을 봄.
    await DB.batch([
      // 1) 라인 레벨 발송 기록 — 본인(공급자) 라인만. 다른 공급자/셀러 라인은 절대 미변경.
      //    아직 발송 안 된(shipped_at IS NULL) 라인만 채움(멱등).
      DB.prepare(
        `UPDATE order_items
            SET tracking_number = ?, courier = ?, tracking_carrier_code = ?,
                shipped_at = datetime('now')
          WHERE order_id = ?
            AND shipped_at IS NULL
            AND product_id IN (
              SELECT sp.id FROM products sp
                JOIN products src ON src.id = sp.supply_source_id
               WHERE src.supplier_id = ?
            )`
      ).bind(tracking, body.courier || null, carrierKey || null, orderId, sid),
      // 2) 주문 상태 승급 — 주문 내 미발송 라인이 하나도 남지 않았을 때만 'SHIPPING'.
      //    (wholesale-supplier.routes 의 NOT EXISTS(unshipped) 패턴과 동일.)
      //    CANCELLED/REFUNDED 라인은 발송 대상이 아니므로 미발송 집계에서 제외.
      DB.prepare(
        `UPDATE orders
            SET shipped_at = COALESCE(shipped_at, datetime('now')),
                status = 'SHIPPING',
                updated_at = datetime('now')
          WHERE id = ?
            AND status IN ('PAID','PREPARING','READY','PARTIAL_REFUNDED')
            AND NOT EXISTS (
              SELECT 1 FROM order_items oi
               WHERE oi.order_id = ?
                 AND oi.shipped_at IS NULL
                 AND (oi.status IS NULL OR oi.status NOT IN ('CANCELLED','REFUNDED'))
            )`
      ).bind(orderId, orderId),
      // 3) 공유 orders 행의 tracking/courier 는 이 공급자가 주문의 "모든" 발송대상 라인을
      //    소유할 때만 설정(순수 단일 공급자 주문). 혼합 주문이면 미설정 — 타 당사자 데이터 보호.
      DB.prepare(
        `UPDATE orders
            SET tracking_number = ?, courier = ?, tracking_carrier_code = ?,
                updated_at = datetime('now')
          WHERE id = ?
            AND (tracking_number IS NULL OR tracking_number = '')
            AND NOT EXISTS (
              SELECT 1 FROM order_items oi
               WHERE oi.order_id = ?
                 AND (oi.status IS NULL OR oi.status NOT IN ('CANCELLED','REFUNDED'))
                 AND oi.product_id NOT IN (
                   SELECT sp.id FROM products sp
                     JOIN products src ON src.id = sp.supply_source_id
                    WHERE src.supplier_id = ?
                 )
            )`
      ).bind(tracking, body.courier || null, carrierKey || null, orderId, orderId, sid),
    ]);

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

// ── 🛒 네이버쇼핑 최저가 대조 (2026-06-12 사용자 요청) ────────────────────────
//   제조사 상품 등록/가격수정 폼에서 상품명으로 시중 최저가 자동 조회 — 공급가가 시장가 대비
//   어디인지 즉시 확인. 키(NAVER_SEARCH_CLIENT_ID/SECRET) 미설정 시 configured:false (UI 숨김).
supplierDashboardRoutes.get('/naver-price-check', rateLimit({ action: 'naver-price-check', max: 30, windowSec: 60 }), async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  try {
    const q = String(c.req.query('q') || '').trim().slice(0, 100);
    const { checkNaverLowestPrice } = await import('../../../worker/utils/naver-shopping-price');
    const r = await checkNaverLowestPrice(c.env.NAVER_SEARCH_CLIENT_ID, c.env.NAVER_SEARCH_CLIENT_SECRET, q);
    if (!r.configured) return c.json({ success: true, configured: false });
    if (!r.ok) return c.json({ success: false, configured: true, error: r.error }, 502);
    return c.json({ success: true, configured: true, lowest: r.lowest, items: r.items });
  } catch (err) {
    return safeError(c, err, '최저가 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 📊 수요 신호 — 네이버 데이터랩 (2026-06-12 사용자 요청 ②④) ──────────────
//   ② 쇼핑인사이트: 카테고리 내 키워드 클릭 추이(6개월) → 상승/하락/보합
//   ④ 검색어트렌드: 24개월 시즌성 → 성수기 월. 키 미설정/쿼터 소진 시 null → UI 자연 숨김.
//   데이터랩 일 1,000회 쿼터 — 코어가 12h 캐시 + 소진 시 자정까지 호출 차단.
supplierDashboardRoutes.get('/demand-signal', rateLimit({ action: 'naver-demand-signal', max: 20, windowSec: 60 }), async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  try {
    const q = String(c.req.query('q') || '').trim().slice(0, 100);
    const category = String(c.req.query('category') || '').trim().slice(0, 30);
    const { fetchDemandSignal } = await import('../../../worker/utils/naver-datalab');
    const r = await fetchDemandSignal(c.env.NAVER_SEARCH_CLIENT_ID, c.env.NAVER_SEARCH_CLIENT_SECRET, q, category);
    return c.json({ success: true, ...r });
  } catch (err) {
    return safeError(c, err, '수요 신호 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 🏭 공급 채널 안내 기준 (2026-06-12 영업단 제안) ──────────────────────────
//   등록 폼이 "이 공급가면 제안 가능 채널: …" 실시간 안내에 사용. 표시 전용 — 영업단이
//   /api/admin/distributor/channel-thresholds 로 조정한 platform_settings 를 읽기만.
supplierDashboardRoutes.get('/channel-thresholds', async (c) => {
  try {
    const row = await c.env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(SUPPLY_CHANNEL_THRESHOLDS_KEY).first<{ value: string }>().catch(() => null);
    return c.json({ success: true, thresholds: parseChannelThresholds(row?.value) });
  } catch (err) {
    return safeError(c, err, '채널 기준 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 🔔 알림 (2026-06-12 도매몰 감사 fix) ─────────────────────────────────────
//   배경: 출금 승인/반려 등이 recipient_type='supplier' 로 INSERT 하는데 제조사가 읽을 경로가
//   없어 데드 코드였음. dashboard_notifications 의 supplier 행을 본인 id 로만 조회(IDOR 불가 —
//   sid 는 requireSupplier 토큰에서). CHECK 제약은 repair-schema 가 'supplier' 포함으로 마이그레이션.

// GET /notifications?limit=20 — 내 알림 목록 (최신순)
supplierDashboardRoutes.get('/notifications', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(50, Math.floor(limitRaw)) : 20;
    const rows = await DB.prepare(
      `SELECT id, type, title, message, link, is_read, created_at
         FROM dashboard_notifications
        WHERE recipient_type = 'supplier' AND recipient_id = ?
        ORDER BY id DESC LIMIT ?`
    ).bind(String(sid), limit).all().catch(() => ({ results: [] }));
    const unread = await DB.prepare(
      `SELECT COUNT(*) AS n FROM dashboard_notifications
        WHERE recipient_type = 'supplier' AND recipient_id = ? AND is_read = 0`
    ).bind(String(sid)).first<{ n: number }>().catch(() => null);
    return c.json({ success: true, items: rows.results || [], unread: Number(unread?.n) || 0 });
  } catch (err) {
    return safeError(c, err, '알림을 불러오지 못했습니다', '[supplier-dashboard]');
  }
});

// POST /notifications/read-all — 전체 읽음 처리
supplierDashboardRoutes.post('/notifications/read-all', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    await DB.prepare(
      `UPDATE dashboard_notifications SET is_read = 1
        WHERE recipient_type = 'supplier' AND recipient_id = ? AND is_read = 0`
    ).bind(String(sid)).run();
    return c.json({ success: true });
  } catch (err) {
    return safeError(c, err, '읽음 처리 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 📥 내 스토어 상품 가져오기 (2026-06-12 사용자 요청 — 역방향 임포트)
//   제조사가 본인 스마트스토어/쿠팡 계정을 연결해 "이미 팔고 있는 상품"을 도매 공급상품으로
//   일괄 등록(승인 대기). 공식 API 의 본인 데이터 범위만 사용 — 타인 상품 수집 아님.
//   공급가 = 스토어 판매가 × 공급률(%) 일괄 적용(폼에서 조정). 이미지는 R2 미러(핫링크 깨짐 방지).
// ═══════════════════════════════════════════════════════════════════════════

// ── 네이버 연결 (owner_type='supplier' — 유통사 연결과 별도 행) ───────────────
supplierDashboardRoutes.post('/store/naver/connect', rateLimit({ action: 'sup-naver-connect', max: 10, windowSec: 600 }), async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  try {
    const { issueNaverToken, saveNaverConnection } = await import('./naver-commerce-core');
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    const clientId = String(body.client_id || '').trim();
    const clientSecret = String(body.client_secret || '').trim();
    if (!/^[A-Za-z0-9]{10,64}$/.test(clientId)) return c.json({ success: false, error: '애플리케이션 ID 형식을 확인해주세요' }, 400);
    if (clientSecret.length < 20 || clientSecret.length > 128) return c.json({ success: false, error: '애플리케이션 시크릿을 확인해주세요' }, 400);
    const tok = await issueNaverToken(clientId, clientSecret);
    if (!tok.ok) return c.json({ success: false, error: tok.error }, 400);
    await saveNaverConnection(c.env.DB, sid, clientId, clientSecret, c.env.DATA_ENCRYPTION_KEY, 'supplier');
    return c.json({ success: true, message: '스마트스토어가 연결되었습니다' });
  } catch (err) {
    return safeError(c, err, '스토어 연결 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 쿠팡 연결 (owner_type='supplier') ─────────────────────────────────────────
supplierDashboardRoutes.post('/store/coupang/connect', rateLimit({ action: 'sup-coupang-connect', max: 10, windowSec: 600 }), async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  try {
    const { listOutboundPlaces, saveCoupangConnection } = await import('./coupang-core');
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    const accessKey = String(body.access_key || '').trim();
    const secretKey = String(body.secret_key || '').trim();
    const vendorId = String(body.vendor_id || '').trim().toUpperCase();
    if (!/^[a-f0-9-]{20,50}$/i.test(accessKey)) return c.json({ success: false, error: 'Access Key 형식을 확인해주세요' }, 400);
    if (secretKey.length < 20 || secretKey.length > 128) return c.json({ success: false, error: 'Secret Key 를 확인해주세요' }, 400);
    if (!/^A\d{8}$/.test(vendorId)) return c.json({ success: false, error: '업체코드(예: A00012345) 형식을 확인해주세요' }, 400);
    const probe = await listOutboundPlaces({ access_key: accessKey, secret_key: secretKey, vendor_id: vendorId, vendor_user_id: null });
    if (!probe.ok) return c.json({ success: false, error: probe.error ? `쿠팡 인증 실패: ${probe.error}` : '쿠팡 인증 실패 — 키를 확인해주세요' }, 400);
    await saveCoupangConnection(c.env.DB, sid, accessKey, secretKey, vendorId, null, c.env.DATA_ENCRYPTION_KEY, 'supplier');
    return c.json({ success: true, message: '쿠팡 계정이 연결되었습니다' });
  } catch (err) {
    return safeError(c, err, '쿠팡 연결 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 연결 상태 (양 채널 한 번에 — 임포트 모달 진입 시 1콜) ─────────────────────
supplierDashboardRoutes.get('/store/status', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    const { ensureNaverConnectionSchema } = await import('./naver-commerce-core');
    const { ensureCoupangConnectionSchema } = await import('./coupang-core');
    await Promise.all([ensureNaverConnectionSchema(DB), ensureCoupangConnectionSchema(DB)]);
    const [naver, coupang] = await Promise.all([
      DB.prepare("SELECT client_id FROM naver_commerce_connections WHERE owner_type = 'supplier' AND seller_id = ?").bind(sid).first().catch(() => null),
      DB.prepare("SELECT vendor_id FROM coupang_connections WHERE owner_type = 'supplier' AND owner_id = ?").bind(sid).first().catch(() => null),
    ]);
    return c.json({ success: true, naver_connected: !!naver, coupang_connected: !!coupang });
  } catch (err) {
    return safeError(c, err, '연결 상태 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 내 스토어 상품 목록 ───────────────────────────────────────────────────────
supplierDashboardRoutes.get('/store/products', rateLimit({ action: 'sup-store-products', max: 30, windowSec: 60 }), async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  try {
    const channel = String(c.req.query('channel') || 'naver');
    if (channel === 'naver') {
      const { loadNaverConnection, listNaverStoreProducts } = await import('./naver-commerce-core');
      const conn = await loadNaverConnection(c.env.DB, sid, c.env.DATA_ENCRYPTION_KEY, 'supplier');
      if (!conn) return c.json({ success: false, error: '먼저 스마트스토어를 연결해주세요', code: 'NOT_CONNECTED' }, 400);
      const page = Math.max(1, Math.floor(Number(c.req.query('page')) || 1));
      const r = await listNaverStoreProducts(conn, page, 50);
      if (!r.ok) return c.json({ success: false, error: r.error }, 502);
      return c.json({ success: true, channel, items: r.items, total: r.total, page });
    }
    if (channel === 'coupang') {
      const { loadCoupangConnection, listCoupangStoreProducts } = await import('./coupang-core');
      const conn = await loadCoupangConnection(c.env.DB, sid, c.env.DATA_ENCRYPTION_KEY, 'supplier');
      if (!conn) return c.json({ success: false, error: '먼저 쿠팡 계정을 연결해주세요', code: 'NOT_CONNECTED' }, 400);
      const r = await listCoupangStoreProducts(conn, String(c.req.query('next_token') || ''));
      if (!r.ok) return c.json({ success: false, error: r.error }, 502);
      // 쿠팡 목록은 가격/이미지가 없음(상세에서) — 임포트 시 서버가 상세 조회.
      return c.json({ success: true, channel, items: r.items, next_token: r.next_token });
    }
    return c.json({ success: false, error: '지원하지 않는 채널' }, 400);
  } catch (err) {
    return safeError(c, err, '스토어 상품 조회 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});

// ── 가져오기 — 선택 상품을 공급상품(승인 대기)으로 일괄 등록 ───────────────────
supplierDashboardRoutes.post('/store/import', rateLimit({ action: 'sup-store-import', max: 10, windowSec: 600 }), async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;
  try {
    await ensureSupplyVisibilitySchema(DB);
    await ensureQtyConstraintSchema(DB);
    const sup = await DB.prepare('SELECT status FROM suppliers WHERE id = ?').bind(sid).first<{ status: string }>();
    if (!sup || sup.status !== 'approved') return c.json({ success: false, error: '승인된 공급자만 상품을 등록할 수 있습니다' }, 403);

    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    const channel = String(body.channel || 'naver');
    const ratePct = Number(body.supply_rate_pct);
    if (!Number.isFinite(ratePct) || ratePct < 10 || ratePct > 100) {
      return c.json({ success: false, error: '공급률(%)은 10~100 사이여야 합니다' }, 400);
    }

    // 채널별 입력 정규화 — naver 는 목록에 가격/이미지가 이미 있음, coupang 은 상세를 서버가 조회.
    type ImportItem = { name: string; sale_price: number; stock: number; image_url: string | null };
    let items: ImportItem[] = [];
    if (channel === 'naver') {
      const raw = Array.isArray(body.items) ? body.items : [];
      items = (raw as Array<Record<string, unknown>>).slice(0, 100).map(r => ({
        name: String(r.name || '').trim().slice(0, 200),
        sale_price: Math.max(0, Math.floor(Number(r.sale_price) || 0)),
        stock: Math.max(0, Math.floor(Number(r.stock) || 0)),
        image_url: r.image_url ? String(r.image_url).slice(0, 500) : null,
      }));
    } else if (channel === 'coupang') {
      const { loadCoupangConnection, getCoupangProductDetail } = await import('./coupang-core');
      const conn = await loadCoupangConnection(DB, sid, c.env.DATA_ENCRYPTION_KEY, 'supplier');
      if (!conn) return c.json({ success: false, error: '먼저 쿠팡 계정을 연결해주세요', code: 'NOT_CONNECTED' }, 400);
      const ids = (Array.isArray(body.product_ids) ? body.product_ids : []).map(String).filter(Boolean).slice(0, 50);
      for (const id of ids) {
        const d = await getCoupangProductDetail(conn, id);
        if (d.ok && d.item && d.item.name) {
          items.push({ name: d.item.name, sale_price: d.item.sale_price, stock: d.item.stock, image_url: d.item.image_url });
        }
      }
    } else {
      return c.json({ success: false, error: '지원하지 않는 채널' }, 400);
    }
    if (!items.length) return c.json({ success: false, error: '가져올 상품이 없습니다' }, 400);

    const { mirrorImageToR2 } = await import('./naver-commerce-core');
    const r2env = c.env as unknown as { MEDIA_BUCKET?: R2Bucket; PUBLIC_R2_URL?: string };

    const results: Array<{ name: string; status: 'ok' | 'error'; reason?: string }> = [];
    const INSERT_SQL = `INSERT INTO products (name, description, price, supply_price, stock, image_url, category, product_type,
       is_active, is_supply_product, supplier_id, supply_approval_status, supply_visibility, min_order_qty, pack_size, order_multiple, mall_id, slug, created_at, updated_at)
     VALUES (?, '', ?, ?, ?, ?, 'lifestyle', 'regular', 0, 1, ?, 'pending', 'ALL', 1, 1, 1, (SELECT COALESCE(mall_id,1) FROM suppliers WHERE id=?), ?, datetime('now'), datetime('now'))`;
    let created = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name) { results.push({ name: '(이름 없음)', status: 'error', reason: '상품명 누락' }); continue; }
      if (it.sale_price <= 0) { results.push({ name: it.name, status: 'error', reason: '판매가 없음 — 직접 등록해주세요' }); continue; }
      const supplyPrice = Math.max(1, Math.round(it.sale_price * ratePct / 100));
      // 이미지 R2 미러 (실패 시 원본 URL 폴백 — 등록은 진행).
      const image = it.image_url ? await mirrorImageToR2(r2env, it.image_url) : '';
      const slug = `sup-${sid}-import-${Date.now()}-${i}`;
      try {
        await DB.prepare(INSERT_SQL).bind(
          it.name, it.sale_price, supplyPrice, it.stock, image, sid, sid, slug,
        ).run();
        created++;
        results.push({ name: it.name, status: 'ok' });
      } catch {
        results.push({ name: it.name, status: 'error', reason: 'DB 오류' });
      }
    }
    if (created > 0) {
      createDashboardNotification(DB, 'admin', null, 'supply_product_submitted', '공급상품 스토어 가져오기',
        `공급자 #${sid}: ${channel} 에서 ${created}건 승인 요청`, '/admin/products').catch(swallow('supplier-dashboard'));
    }
    return c.json({ success: true, summary: { total: items.length, created, failed: items.length - created }, results });
  } catch (err) {
    return safeError(c, err, '스토어 가져오기 중 오류가 발생했습니다', '[supplier-dashboard]');
  }
});
