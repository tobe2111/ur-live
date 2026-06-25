/**
 * 🏭 BIZ-6 (2026-06-08): 공급사(supplier) 분석 + 운영 도구.
 *   기존 supplier-dashboard.routes.ts 가 카운트만 보여주던 것을 보강 — 매출 시계열/요약/베스트셀러/재고 경고
 *   + 운영 도구(가격 일괄변경 요청 큐 적재, 재고 CSV 일괄 반영).
 *
 *   인증: requireSupplier() (JWT type='supplier'). supplier_id = c.get('user').id.
 *   마운트: app.route('/api/supplier', supplierAnalyticsRoutes)  ← supplier-dashboard 와 동일 prefix.
 *     경로 충돌 없음 — 신규 경로는 /analytics, /products/bulk-price-change, /products/stock-import.
 *
 *   읽기 전용 집계(신규 컬럼/스키마 0). 가격변경은 라이브 supply_price 를 직접 안 바꾸고
 *   기존 어드민 승인 큐(pending_supply_price/...) 에만 적재 — supplier-dashboard 의 단건 흐름과 동일 패턴.
 *
 *   📊 clawback(환불 후 음수 보정 row, note='clawback') 처리: 시계열/요약은 **net**(음수 포함 합산)으로 집계.
 *      → 환불로 회수된 매출이 그대로 반영돼 공급사가 보는 숫자가 실제 잔고/지급액과 정합(정직).
 *      취소(status='cancelled') row 는 제외(매출로 잡힌 적 없는 무효 라인).
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';
import { requireSupplier } from '@/worker/middleware/auth';
import { safeError } from '@/worker/utils/safe-error';
import { parseCsv } from './supply-csv';

export const supplierAnalyticsRoutes = new Hono<{ Bindings: Env }>();

supplierAnalyticsRoutes.use('*', requireSupplier());

function supplierId(c: { get: (k: string) => unknown }): number | null {
  const user = c.get('user') as { id?: string | number } | undefined;
  const id = Number(user?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

// ── GET /analytics?period=30d|90d|12m — 매출 분석 ──────────────────────────────
//   매출 = supplier_settlements.supply_amount (net, cancelled 제외). consumer + wholesale 양 소스 포함.
supplierAnalyticsRoutes.get('/analytics', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;

  const period = c.req.query('period') || '30d';
  if (!['30d', '90d', '12m'].includes(period)) {
    return c.json({ success: false, error: '잘못된 기간입니다 (30d|90d|12m)' }, 400);
  }

  // 기간 경계 + 시계열 버킷. 30/90d 는 일별, 12m 는 월별.
  const isMonthly = period === '12m';
  const sinceExpr = isMonthly ? "datetime('now','-12 months')" : period === '90d' ? "datetime('now','-90 days')" : "datetime('now','-30 days')";
  // strftime 버킷 — 일별 '%Y-%m-%d', 월별 '%Y-%m'.
  const bucketFmt = isMonthly ? '%Y-%m' : '%Y-%m-%d';

  try {
    // 1) 시계열 — net 매출 + 주문수(distinct order_id) per 버킷. cancelled 제외.
    const seriesRows = await DB.prepare(
      `SELECT strftime('${bucketFmt}', created_at) AS bucket,
              COALESCE(SUM(supply_amount), 0) AS revenue,
              COUNT(DISTINCT order_id) AS orders
         FROM supplier_settlements
        WHERE supplier_id = ?
          AND status != 'cancelled'
          AND created_at >= ${sinceExpr}
        GROUP BY bucket
        ORDER BY bucket ASC`
    ).bind(sid).all<{ bucket: string; revenue: number; orders: number }>().catch(() => ({ results: [] as { bucket: string; revenue: number; orders: number }[] }));
    const series = (seriesRows.results || []).map(r => ({
      bucket: r.bucket,
      revenue: Math.floor(Number(r.revenue) || 0),
      orders: Number(r.orders) || 0,
    }));

    // 2) 요약 — 총 매출(net), 주문수(distinct), 객단가, 정산 버킷별 합계(pending/available/paid).
    const summaryRow = await DB.prepare(
      `SELECT COALESCE(SUM(supply_amount), 0) AS total_revenue,
              COUNT(DISTINCT order_id) AS order_count
         FROM supplier_settlements
        WHERE supplier_id = ?
          AND status != 'cancelled'
          AND created_at >= ${sinceExpr}`
    ).bind(sid).first<{ total_revenue: number; order_count: number }>().catch(() => null);
    const totalRevenue = Math.floor(Number(summaryRow?.total_revenue) || 0);
    const orderCount = Number(summaryRow?.order_count) || 0;
    const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

    // 정산 상태별 합계 — 기간 무관 전체(현재 잔고 성격). cancelled 제외, clawback 음수는 net 으로 포함.
    const settleRow = await DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending'   THEN supply_amount ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'available' THEN supply_amount ELSE 0 END), 0) AS available,
         COALESCE(SUM(CASE WHEN status = 'paid'      THEN supply_amount ELSE 0 END), 0) AS paid
       FROM supplier_settlements WHERE supplier_id = ?`
    ).bind(sid).first<{ pending: number; available: number; paid: number }>().catch(() => null);

    // 3) 베스트셀러 top 10 — 기간 내 product_id 별 net 매출 합계 + 주문수. products join.
    const bestRows = await DB.prepare(
      `SELECT ss.product_id AS product_id,
              COALESCE(SUM(ss.supply_amount), 0) AS revenue,
              COUNT(DISTINCT ss.order_id) AS orders,
              p.name AS name, p.image_url AS image_url
         FROM supplier_settlements ss
         LEFT JOIN products p ON p.id = ss.product_id
        WHERE ss.supplier_id = ?
          AND ss.status != 'cancelled'
          AND ss.product_id IS NOT NULL
          AND ss.created_at >= ${sinceExpr}
        GROUP BY ss.product_id
        ORDER BY revenue DESC
        LIMIT 10`
    ).bind(sid).all<{ product_id: number; revenue: number; orders: number; name: string | null; image_url: string | null }>()
      .catch(() => ({ results: [] as { product_id: number; revenue: number; orders: number; name: string | null; image_url: string | null }[] }));
    const bestSellers = (bestRows.results || []).map(r => ({
      product_id: r.product_id,
      name: r.name || `#${r.product_id}`,
      image_url: r.image_url || null,
      revenue: Math.floor(Number(r.revenue) || 0),
      orders: Number(r.orders) || 0,
    }));

    // 4) 재고 현황 — 내 공급상품(supplier_id + is_supply_product) 중 품절/저재고 수.
    //    저재고 = stock <= min_order_qty(기본 1) 이면서 품절 아님.
    const stockRow = await DB.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN COALESCE(stock, 0) <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
         SUM(CASE WHEN COALESCE(stock, 0) > 0 AND COALESCE(stock, 0) <= COALESCE(min_order_qty, 1) THEN 1 ELSE 0 END) AS low_stock
       FROM products
       WHERE supplier_id = ? AND is_supply_product = 1`
    ).bind(sid).first<{ total: number; out_of_stock: number; low_stock: number }>().catch(() => null);

    return c.json({
      success: true,
      data: {
        period,
        granularity: isMonthly ? 'monthly' : 'daily',
        series,
        summary: {
          total_revenue: totalRevenue,
          order_count: orderCount,
          avg_order_value: avgOrderValue,
          settle_pending: Math.floor(Number(settleRow?.pending) || 0),
          settle_available: Math.floor(Number(settleRow?.available) || 0),
          settle_paid: Math.floor(Number(settleRow?.paid) || 0),
        },
        best_sellers: bestSellers,
        stock: {
          total: Number(stockRow?.total) || 0,
          out_of_stock: Number(stockRow?.out_of_stock) || 0,
          low_stock: Number(stockRow?.low_stock) || 0,
        },
      },
    });
  } catch (err) {
    return safeError(c, err, '분석 데이터 조회 중 오류가 발생했습니다', '[supplier-analytics]');
  }
});

// ── POST /products/bulk-price-change — 가격 일괄 변경 요청 (어드민 승인 큐 적재) ──
//   라이브 supply_price/price 는 직접 변경하지 않음 — pending_* 에만 적재 후 어드민 승인 시 반영.
//   (supplier-dashboard.routes 의 단건 price-change-request 와 동일 패턴의 배치판.)
supplierAnalyticsRoutes.post('/products/bulk-price-change', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;

  type Item = { product_id?: number; supply_price?: number; retail_price?: number; reason?: string };
  const body = await c.req.json<{ items?: Item[] }>().catch(() => ({} as { items?: Item[] }));
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400);
  if (items.length > 200) return c.json({ success: false, error: '한 번에 최대 200개까지 변경할 수 있습니다' }, 400);

  type ResultRow = { product_id: number; status: 'ok' | 'skip'; reason?: string };
  const results: ResultRow[] = [];

  try {
    for (const it of items) {
      const pid = Number(it.product_id);
      if (!Number.isFinite(pid) || pid <= 0) {
        results.push({ product_id: Number(it.product_id) || 0, status: 'skip', reason: '잘못된 상품 ID' });
        continue;
      }
      const newSupply = Math.floor(Number(it.supply_price));
      if (!Number.isFinite(newSupply) || newSupply <= 0) {
        results.push({ product_id: pid, status: 'skip', reason: '공급가 오류 (0원 초과)' });
        continue;
      }
      // 소유 + 승인(판매중) 상품만. pending/거부는 단건 PATCH 로 즉시 수정하는 흐름이므로 큐에서 제외.
      const prod = await DB.prepare(
        `SELECT id, supplier_id, supply_approval_status, is_active, supply_price, price
           FROM products WHERE id = ? AND is_supply_product = 1`
      ).bind(pid).first<{ id: number; supplier_id: number | null; supply_approval_status: string | null; is_active: number; supply_price: number; price: number }>().catch(() => null);
      if (!prod || prod.supplier_id !== sid) {
        results.push({ product_id: pid, status: 'skip', reason: '내 상품이 아닙니다' });
        continue;
      }
      const effectiveStatus = prod.supply_approval_status ?? (prod.is_active === 1 ? 'approved' : 'pending');
      if (effectiveStatus !== 'approved') {
        results.push({ product_id: pid, status: 'skip', reason: '승인 대기/거부 상품은 직접 수정하세요' });
        continue;
      }

      // 권장 소비자가 선택 — 입력 시 새 공급가보다 높아야 함(유통 마진). 미입력 시 기존 유지(NULL).
      // 🔧 2026-06-24 (전수조사 M2): 단건과 동일 규칙 — `<` → `<=`(동일가=마진0 차단).
      let newRetail: number | null = null;
      if (it.retail_price != null && String(it.retail_price) !== '') {
        const r = Math.floor(Number(it.retail_price));
        if (!Number.isFinite(r) || r <= newSupply) {
          results.push({ product_id: pid, status: 'skip', reason: '권장 소비자가는 공급가보다 높아야 합니다' });
          continue;
        }
        newRetail = r;
      }
      if (newSupply === prod.supply_price && (newRetail == null || newRetail === prod.price)) {
        results.push({ product_id: pid, status: 'skip', reason: '기존 가격과 동일합니다' });
        continue;
      }

      const reason = (it.reason || '').trim().slice(0, 300) || null;
      await DB.prepare(
        `UPDATE products
            SET pending_supply_price = ?, pending_retail_price = ?,
                pending_price_reason = ?, pending_price_requested_at = datetime('now')
          WHERE id = ? AND supplier_id = ?`
      ).bind(newSupply, newRetail, reason, pid, sid).run();
      results.push({ product_id: pid, status: 'ok' });
    }

    const okCount = results.filter(r => r.status === 'ok').length;
    return c.json({
      success: true,
      summary: { total: items.length, queued: okCount, skipped: items.length - okCount },
      results,
      message: '가격 변경 요청이 접수되었습니다. 운영진 승인 후 반영됩니다. (승인 전까지 기존 가격 유지)',
    });
  } catch (err) {
    return safeError(c, err, '가격 일괄 변경 중 오류가 발생했습니다', '[supplier-analytics]');
  }
});

// ── POST /products/stock-import — 재고 CSV 일괄 반영 (barcode,stock) ────────────
//   바코드로 내 소유 공급상품을 매칭해 stock 을 직접 UPDATE(즉시 반영 — 재고는 승인 대상 아님).
supplierAnalyticsRoutes.post('/products/stock-import', async (c) => {
  const sid = supplierId(c);
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
  const { DB } = c.env;

  const body = await c.req.json<{ csv?: string }>().catch(() => ({} as { csv?: string }));
  if (!body.csv || typeof body.csv !== 'string') return c.json({ success: false, error: 'CSV 데이터가 없습니다' }, 400);

  const rows = parseCsv(body.csv, 5000);
  if (!rows.length) return c.json({ success: false, error: '처리할 행이 없습니다' }, 400);

  let matched = 0, updated = 0, skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const barcode = String(r['바코드'] || r.barcode || '').trim().slice(0, 64);
      const stockRaw = String(r['재고'] || r.stock || '').replace(/[,\s]/g, '');
      if (!barcode) { skipped++; errors.push({ row: i + 2, reason: '바코드 누락' }); continue; }
      const stock = Number(stockRaw);
      if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
        skipped++; errors.push({ row: i + 2, reason: '재고는 0 이상 정수여야 합니다' }); continue;
      }
      // 내 소유 공급상품 중 바코드 매칭.
      const res = await DB.prepare(
        `UPDATE products SET stock = ?, updated_at = datetime('now')
          WHERE supplier_id = ? AND is_supply_product = 1 AND barcode = ?`
      ).bind(Math.floor(stock), sid, barcode).run();
      const changes = res.meta?.changes ?? 0;
      if (changes > 0) { matched++; updated += changes; }
      else { skipped++; errors.push({ row: i + 2, reason: '매칭되는 바코드 없음' }); }
    }

    return c.json({
      success: true,
      summary: { total: rows.length, matched, updated, skipped },
      errors: errors.slice(0, 100),
      message: `${updated}건 재고가 반영되었습니다.`,
    });
  } catch (err) {
    return safeError(c, err, '재고 가져오기 중 오류가 발생했습니다', '[supplier-analytics]');
  }
});
