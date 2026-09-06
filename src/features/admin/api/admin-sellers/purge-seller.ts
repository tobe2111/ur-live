/**
 * 🗑️ 매장 **완전 삭제** — `DELETE /api/admin/sellers/:id/purge[?cascade=1]`
 *
 * 🧱 2026-09-04 `admin-sellers.routes.ts` 에서 분리(file-size 래칫 — 그 파일이 1,079줄로 자랐다).
 *   로직은 **byte-불변**으로 옮겼고, 바뀐 것은 라우터를 인자로 받는 등록 함수로 감싼 것뿐이다.
 */
import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { executeQuery, executeRun } from '@/worker/utils/database'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { swallow } from '@/worker/utils/swallow'
import { requireAdminRole } from '@/worker/middleware/auth'
import { require2FA } from '@/worker/middleware/require-2fa'

export function registerSellerPurgeRoute(
  adminSellersRoutes: Hono<{ Bindings: Env }>,
  safeAdminError: (err: unknown, env: Env) => string,
) {
/**
 * 🗑️ 2026-09-04 (대표 "매장 홍대돈가스 말고는 다 삭제해") — 매장 **완전 삭제**.
 *
 * ## 왜 soft delete 로는 안 되나
 * 위 `DELETE /sellers/:id` 는 `status='suspended'` 로 바꿀 뿐이고, **이미 정지된 매장은 400** 이다.
 * 시험용으로 만들어졌다가 정지만 된 껍데기가 목록에 계속 쌓여 "어느 게 진짜 매장인가"를 흐린다.
 *
 * ## 🔒 안전 규칙 — 빈 매장만 지운다
 * 상품·주문·운영자·원장·정산이 **하나라도** 있으면 409 로 거부한다. 되돌릴 수 없는 작업이라
 * "이 매장은 아무것도 안 남겼다"가 **서버에서** 증명될 때만 통과시킨다(호출자 판단을 믿지 않는다).
 * 매출 이력이 있는 매장을 지우고 싶다면 그건 이 도구가 아니라 별도 판단이다.
 *
 * ⚠️ 함께 지우는 것: `seller_meta`(K-V 사이드테이블) · `seller_operators` · `seller_business_info`
 *    (매장 없이는 의미 없는 그 매장의 사업자등록 정보 — FK 가 RESTRICT 라 안 지우면 매장이 안 지워진다).
 *    남기는 것: `seller_status_history`(감사 흔적) · `admin_audit_logs`.
 */
adminSellersRoutes.delete('/sellers/:id/purge', cors(), requireAdminRole('super'), require2FA(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    // ?cascade=1 — 상품과 그 파생행(리뷰·지역·장바구니·위시리스트…)까지 함께 지운다.
    //   ⚠️ **머니 잔여물(주문·이용권·정산·원장)은 cascade 여도 절대 통과 못 한다** — 아래 blockers 참조.
    const cascade = /^(1|true|yes)$/i.test(c.req.query('cascade') || '');
    /**
     * 🔴 `?purge_ancillary=1` — **부수 머니 기록까지** 지운다 (2026-09-06 대표 명시 지시).
     *
     * 덮는 것은 **후원(`donations`)과 교환권 발송(`voucher_orders`) 둘뿐**이다.
     * 주문·주문항목·이용권·정산·원장은 **이 플래그로도 못 지운다** — 그건 소비자가 들고 있는
     * 자산이거나 회계 원장이고, 이 도구가 손댈 자리가 아니다.
     *
     * ⚠️ 지우기 **전에 행 전문을 감사 로그에 박제**한다. 행은 사라져도 기록은 남는다 —
     *    되돌릴 수 없는 삭제에서 우리가 지킬 수 있는 최소한이다.
     * ⚠️ `cascade` 없이는 안 먹는다(실수로 단독으로 붙는 것을 막는다).
     */
    const purgeAncillary = cascade && /^(1|true|yes)$/i.test(c.req.query('purge_ancillary') || '');

    const rows = await executeQuery<{ id: number; status: string; business_name: string | null; linked_user_id: number | null }>(
      DB, 'SELECT id, status, business_name, linked_user_id FROM sellers WHERE id = ?', [sellerId],
    );
    if (rows.length === 0) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404);
    const seller = rows[0];

    // 🔒 잔여물 검사 — count 조회는 테이블 부재에만 관대하다.
    //    그 외 오류는 "모른다"이므로 **거부**한다(실패를 0 으로 읽으면 있는 걸 없다고 보고 지운다).
    const blockers: string[] = [];
    const countOr = async (label: string, sql: string, binds: unknown[]): Promise<number> => {
      try {
        const r = await DB.prepare(sql).bind(...binds).first<{ n: number }>();
        return Number(r?.n) || 0;
      } catch (e) {
        if (!String(e).includes('no such table')) blockers.push(`${label} 확인 실패`);
        return 0;
      }
    };

    // ── 절대 차단: 돈이 오간 흔적 ──────────────────────────────────────
    const ords = await countOr('주문', 'SELECT COUNT(*) AS n FROM orders WHERE seller_id = ?', [sellerId]);
    if (ords > 0) blockers.push(`주문 ${ords}건`);
    const items = await countOr('주문항목', 'SELECT COUNT(*) AS n FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE p.seller_id = ?', [sellerId]);
    if (items > 0) blockers.push(`주문항목 ${items}건`);
    const vch = await countOr('이용권', 'SELECT COUNT(*) AS n FROM vouchers v JOIN products p ON p.id = v.product_id WHERE p.seller_id = ?', [sellerId]);
    if (vch > 0) blockers.push(`이용권 ${vch}건`);
    const stl = await countOr('정산', 'SELECT COUNT(*) AS n FROM settlements WHERE seller_id = ?', [sellerId]);
    if (stl > 0) blockers.push(`정산 ${stl}건`);
    const led = await countOr('원장', "SELECT COUNT(*) AS n FROM ledger_entries WHERE credit_account = 'seller:' || ? OR debit_account = 'seller:' || ?", [sellerId, sellerId]);
    // 🩸 2026-09-06 라이브 실행에서 드러난 구멍 — 이 둘이 목록에 없었다.
    //   `donations`(후원)는 FK 가 RESTRICT 라 DB 가 막아 **500** 이 났다(운이지 설계가 아니다).
    //   `voucher_orders`(KT 교환권 발송)는 **ON DELETE CASCADE** 라 매장과 함께 **조용히 사라진다** —
    //   더 나쁜 쪽이다. 둘 다 돈이 오간 흔적이므로 cascade 로도 통과하면 안 된다.
    const dons = await countOr('후원', 'SELECT COUNT(*) AS n FROM donations WHERE seller_id = ?', [sellerId]);
    const vord = await countOr('교환권 발송', 'SELECT COUNT(*) AS n FROM voucher_orders WHERE seller_id = ?', [sellerId]);
    if (led > 0) blockers.push(`원장 ${led}건`);
    // 🔴 이 둘만 `purge_ancillary=1` 로 넘어갈 수 있다. 위 다섯(주문·주문항목·이용권·정산·원장)은
    //    플래그와 **무관하게** 계속 막힌다 — 아래 push 들이 이 분기 밖에 있는 이유다.
    if (!purgeAncillary) {
      if (dons > 0) blockers.push(`후원 ${dons}건`);
      if (vord > 0) blockers.push(`교환권 발송 ${vord}건`);
    }

    // ── cascade 로 정리 가능한 것 ─────────────────────────────────────
    const prods = await countOr('상품', 'SELECT COUNT(*) AS n FROM products WHERE seller_id = ?', [sellerId]);
    const ops = await countOr('운영자', 'SELECT COUNT(*) AS n FROM seller_operators WHERE seller_id = ?', [sellerId]);
    if (!cascade) {
      if (prods > 0) blockers.push(`상품 ${prods}건`);
      if (ops > 0) blockers.push(`운영자 ${ops}건`);
      if (seller.linked_user_id) blockers.push(`연결된 유저 계정(#${seller.linked_user_id})`);
    }

    if (blockers.length > 0) {
      return c.json({
        success: false,
        error: `빈 매장이 아니라 삭제할 수 없습니다 — ${blockers.join(' · ')}.`
          + (cascade ? ' 돈이 오간 흔적은 cascade 로도 지울 수 없습니다(정지만 가능).' : ' 상품까지 지우려면 ?cascade=1 을 붙이세요.'),
        data: { id: Number(sellerId), blockers, cascade },
      }, 409);
    }

    // 🔴 `purge_ancillary` 면 **지우기 전에 행 전문을 읽어 둔다.** 감사 로그가 유일한 사본이 되므로
    //    개수가 아니라 **내용**을 남긴다(금액·상대·외부 주문번호까지). 읽기 실패는 삭제를 중단시킨다 —
    //    "박제 못 했는데 지웠다" 가 되면 안 된다.
    let ancillarySnapshot: { donations?: unknown[]; voucher_orders?: unknown[] } | null = null;
    if (purgeAncillary && (dons > 0 || vord > 0)) {
      try {
        const [d, v] = await Promise.all([
          DB.prepare('SELECT * FROM donations WHERE seller_id = ?').bind(sellerId).all(),
          DB.prepare('SELECT * FROM voucher_orders WHERE seller_id = ?').bind(sellerId).all(),
        ]);
        ancillarySnapshot = { donations: d.results || [], voucher_orders: v.results || [] };
      } catch (snapErr) {
        return c.json({
          success: false,
          error: '부수 머니 기록을 감사 로그에 박제하지 못해 삭제를 중단했습니다 (사본 없이 지우지 않습니다).',
          data: { id: Number(sellerId), detail: safeAdminError(snapErr, c.env) },
        }, 409);
      }
    }

    await writeAuditLog(c, {
      action: 'purge_seller', targetType: 'seller', targetId: sellerId,
      before: {
        status: seller.status, business_name: seller.business_name,
        products: prods, operators: ops, linked_user_id: seller.linked_user_id,
        // 행이 사라져도 여기 남는다.
        ...(ancillarySnapshot ? { ancillary_money: ancillarySnapshot } : {}),
      },
      after: { cascade, purge_ancillary: purgeAncillary },
    });

    let productsDeleted = 0;
    if (cascade && prods > 0) {
      const ids = await DB.prepare('SELECT id FROM products WHERE seller_id = ?').bind(sellerId).all<{ id: number }>()
        .catch(() => ({ results: [] as Array<{ id: number }> }));
      for (const { id } of ids.results || []) {
        // 파생 자식행 선정리 — admin-products 하드삭제와 같은 목록(주문이 0 이라 안전).
        for (const t of ['product_supply_meta', 'fcfs_applications', 'product_regions', 'product_reviews', 'cart_items', 'wishlists', 'product_options']) {
          await DB.prepare(`DELETE FROM ${t} WHERE product_id = ?`).bind(id).run().catch(swallow('admin:purge-seller:child'));
        }
        const d = await DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run().catch(() => null);
        if (d?.meta?.changes) productsDeleted++;
      }
      const left = await countOr('상품', 'SELECT COUNT(*) AS n FROM products WHERE seller_id = ?', [sellerId]);
      if (left > 0) {
        // 남은 FK 참조가 있다는 뜻 — 매장을 지우면 그 상품이 **주인 없는 행**으로 떠돈다. 중단.
        return c.json({
          success: false,
          error: `상품 ${left}건이 다른 참조 때문에 안 지워져 매장 삭제를 중단했습니다(고아 상품 방지). 정지만 가능합니다.`,
          data: { id: Number(sellerId), products_deleted: productsDeleted, products_left: left },
        }, 409);
      }
    }

    if (cascade) {
      await DB.prepare('DELETE FROM seller_operators WHERE seller_id = ?').bind(sellerId).run().catch(swallow('admin:purge-seller:ops'));
    }
    await DB.prepare('DELETE FROM seller_meta WHERE seller_id = ?').bind(sellerId).run().catch(swallow('admin:purge-seller:meta'));
    // 🔴 부수 머니 행 삭제 — **위 감사 로그가 먼저 쓰인 뒤**에만 여기 온다(사본 없이 안 지운다).
    //    `voucher_orders` 는 FK 가 CASCADE 라 어차피 함께 사라지지만, **명시적으로** 지운다 —
    //    "조용히 사라지는 것" 과 "지우기로 하고 지운 것" 은 다른 일이고, 그 차이가 이 플래그의 존재 이유다.
    if (purgeAncillary) {
      await DB.prepare('DELETE FROM donations WHERE seller_id = ?').bind(sellerId).run().catch(swallow('admin:purge-seller:donations'));
      await DB.prepare('DELETE FROM voucher_orders WHERE seller_id = ?').bind(sellerId).run().catch(swallow('admin:purge-seller:voucher-orders'));
    }

    // 🩸 2026-09-06 라이브 실행에서 드러난 두 번째 구멍 — 이 줄이 없어서 **매장이 안 지워졌다.**
    //   `seller_business_info` 는 FK 가 RESTRICT(ON DELETE 절 없음)라 남아 있으면 sellers DELETE 가
    //   그대로 던지고, `safeAdminError` 가 그걸 "Internal server error" 로 덮어 원인이 안 보인다.
    //   매장의 사업자등록 정보는 그 매장 없이는 의미가 없으므로 함께 지운다(돈 기록이 아니다).
    await DB.prepare('DELETE FROM seller_business_info WHERE seller_id = ?').bind(sellerId).run().catch(swallow('admin:purge-seller:bizinfo'));

    // 🔒 마지막 DELETE 는 **삼키지 않는다.** 남은 FK 참조가 있으면 500 대신 무엇이 막았는지 말한다 —
    //   500 은 "우리가 모른다"라는 뜻이고, 이 작업에서 모르는 채 다시 누르게 하면 안 된다.
    try {
      await executeRun(DB, 'DELETE FROM sellers WHERE id = ?', [sellerId]);
    } catch (delErr) {
      return c.json({
        success: false,
        error: '매장 행 삭제가 남은 참조에 막혔습니다 — 어떤 테이블이 이 매장을 붙들고 있는지 확인이 필요합니다.'
          + (cascade ? ` (상품 ${productsDeleted}건은 이미 삭제됨)` : ''),
        data: { id: Number(sellerId), products_deleted: productsDeleted, cascade, detail: safeAdminError(delErr, c.env) },
      }, 409);
    }

    return c.json({
      success: true,
      message: '매장이 완전히 삭제되었습니다',
      data: {
        id: Number(sellerId), business_name: seller.business_name, products_deleted: productsDeleted, cascade,
        ...(purgeAncillary ? { ancillary_purged: { donations: dons, voucher_orders: vord } } : {}),
      },
    });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});
}
