/**
 * Admin Sellers Routes — 판매자 관리
 *
 * 🛡️ 2026-04-22 배치 146 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET    /sellers                          — 판매자 목록
 * - GET    /sellers/pending                  — 승인 대기 목록
 * - GET    /sellers/:id                      — 판매자 상세
 * - PATCH  /sellers/:id/business-info/approve — 사업자 정보 승인
 * - PATCH  /sellers/:id/business-info/reject  — 사업자 정보 반려
 * - PATCH  /sellers/:id/approve              — 판매자 승인
 * - PATCH  /sellers/:id/reject               — 판매자 거부
 * - DELETE /sellers/:id                      — 판매자 정지 (soft delete)
 * - PATCH  /sellers/:id/commission           — 수수료율 변경
 * - PATCH  /sellers/:id/donation-commission  — 후원 수수료율 변경
 * - PATCH  /sellers/:id/permissions          — 특수 권한 변경
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { swallow } from '@/worker/utils/swallow';
import { rateLimit } from '@/worker/middleware/rate-limit';

export const adminSellersRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface SellerRow {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  business_name: string | null;
  business_number: string | null;
  status: string;
  created_at: string;
  commission_rate?: number;
  can_manipulate_stats?: number;
  linked_user_id?: number;
  linked_user_name?: string;
  bank_name?: string | null;
  bank_account?: string | null;
  account_holder?: string | null;
  business_registration_image_url?: string | null;
  business_registration_status?: string | null;
  business_registration_reject_reason?: string | null;
}

interface IdRow {
  id: number;
  status?: string;
  commission_rate?: number;
}

adminSellersRoutes.get('/sellers', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const page = Math.max(parseInt(c.req.query('page') || '1'), 1);
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50'), 1), 200);
    const offset = (page - 1) * limit;

    let sellers;
    try {
      sellers = await executeQuery<SellerRow>(DB, `
        SELECT id, email, name, phone, business_name, business_number,
               status, created_at,
               COALESCE(commission_rate, 5) AS commission_rate,
               COALESCE(can_manipulate_stats, 0) AS can_manipulate_stats,
               linked_user_id,
               bank_name, bank_account, account_holder,
               business_registration_image_url, business_registration_status,
               business_registration_reject_reason
        FROM sellers ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
      `, [limit, offset]);
    } catch {
      // 🛡️ 2026-05-20: migration 0257 (business_registration_*) / 0128 (bank_name, account_holder)
      //   가 안 적용된 환경 fallback. 정산/검증 컬럼 빠지면 어드민에서 NULL 로 보임.
      try {
        sellers = await executeQuery<SellerRow>(DB, `
          SELECT id, email, name, phone, business_name, business_number,
                 status, created_at,
                 COALESCE(commission_rate, 5) AS commission_rate,
                 bank_name, bank_account, account_holder
          FROM sellers ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
        `, [limit, offset]);
      } catch {
        sellers = await executeQuery<SellerRow>(DB, `
          SELECT id, email, name, phone, business_name, business_number,
                 status, created_at
          FROM sellers ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
        `, [limit, offset]);
      }
    }
    const totalRow = await DB.prepare('SELECT COUNT(*) as cnt FROM sellers').first<{ cnt: number }>();
    return c.json({
      success: true,
      data: sellers,
      pagination: {
        page, limit, total: totalRow?.cnt ?? 0,
        totalPages: Math.ceil((totalRow?.cnt ?? 0) / limit),
      },
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] sellers error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.get('/sellers/pending', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellers = await executeQuery<SellerRow>(DB, `
      SELECT s.id, s.email, s.name, s.phone, s.business_name, s.business_number,
             s.status, s.created_at,
             COALESCE(s.commission_rate, 5) AS commission_rate,
             s.linked_user_id, u.name AS linked_user_name
      FROM sellers s LEFT JOIN users u ON s.linked_user_id = u.id
      WHERE s.status = 'pending' ORDER BY s.created_at ASC
    `);
    return c.json({ success: true, data: sellers });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] pending sellers error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.get('/sellers/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);

    const seller = await DB.prepare(`
      SELECT s.id, s.email, s.name, s.phone, s.business_name, s.business_number,
             s.status, s.created_at,
             COALESCE(s.commission_rate, 5) AS commission_rate,
             COALESCE(s.can_manipulate_stats, 0) AS can_manipulate_stats,
             s.bank_name, s.bank_account, s.account_holder,
             s.business_registration_image_url, s.business_registration_status,
             s.business_registration_reject_reason
      FROM sellers s WHERE s.id = ?
    `).bind(sellerId).first().catch(() => null);

    if (!seller) {
      const row2 = await DB.prepare(
        `SELECT id, email, name, phone, business_name, business_number, status, created_at FROM sellers WHERE id = ?`
      ).bind(sellerId).first();
      if (!row2) return c.json({ success: false, error: 'Not found' }, 404);
      // 🛡️ 2026-05-02: 기본 수수료율 5% (platform_settings.commission_rate_default 와 일치)
      return c.json({ success: true, data: { ...row2, commission_rate: 5, can_manipulate_stats: 0 } });
    }

    let biz = null;
    try {
      biz = await DB.prepare(`
        SELECT business_number AS biz_number, business_name AS biz_name, ceo_name,
               business_type, business_category, postal_code,
               address, address_detail, phone AS biz_phone, email AS biz_email,
               is_verified AS biz_is_verified, verified_at AS biz_verified_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first();
    } catch {
      biz = await DB.prepare(`
        SELECT business_number AS biz_number, business_name AS biz_name, ceo_name,
               business_type, business_category, postal_code,
               address, '' AS address_detail, phone AS biz_phone, email AS biz_email,
               is_verified AS biz_is_verified, verified_at AS biz_verified_at
        FROM seller_business_info WHERE seller_id = ?
      `).bind(sellerId).first().catch(() => null);
    }

    return c.json({ success: true, data: { ...seller, ...(biz || {}) } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/business-info/approve', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const existing = await DB.prepare(
      `SELECT id, is_verified FROM seller_business_info WHERE seller_id = ?`
    ).bind(sellerId).first<{ id: number; is_verified: number }>();
    if (!existing) return c.json({ success: false, error: '사업자 정보가 없습니다' }, 404);
    if (existing.is_verified) return c.json({ success: false, error: '이미 승인된 사업자 정보입니다' }, 400);
    await DB.prepare(`
      UPDATE seller_business_info
      SET is_verified = 1, verified_at = datetime('now'), updated_at = datetime('now')
      WHERE seller_id = ?
    `).bind(sellerId).run();
    await writeAuditLog(c, { action: 'approve_business_info', targetType: 'seller', targetId: sellerId, after: { is_verified: true } });
    return c.json({ success: true, message: '사업자 정보를 승인했습니다' });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/business-info/reject', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const { reason } = await c.req.json<{ reason?: string }>();
    const existing = await DB.prepare(
      `SELECT id FROM seller_business_info WHERE seller_id = ?`
    ).bind(sellerId).first();
    if (!existing) return c.json({ success: false, error: '사업자 정보가 없습니다' }, 404);
    await DB.prepare(`
      UPDATE seller_business_info
      SET is_verified = 0, verified_at = NULL, updated_at = datetime('now')
      WHERE seller_id = ?
    `).bind(sellerId).run();
    await writeAuditLog(c, { action: 'reject_business_info', targetType: 'seller', targetId: sellerId, after: { is_verified: false, reason } });
    return c.json({ success: true, message: '사업자 정보를 반려했습니다' });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-18: 사업자등록증 (migration 0257) 검증 — 셀러가 제출한 이미지 확인 후 verified/rejected.
//   verified → 현금 정산 + 딜 환급 가능
//   rejected → 사유 안내, 셀러 재제출 가능
adminSellersRoutes.patch('/sellers/:id/business-registration/verify', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const { action, reason } = await c.req.json<{ action?: string; reason?: string }>();
    if (action !== 'verify' && action !== 'reject') {
      return c.json({ success: false, error: 'action 은 verify 또는 reject 여야 합니다' }, 400);
    }

    // 셀러 존재 + 제출된 이미지 있는지 확인.
    const row = await DB.prepare(
      `SELECT id, business_registration_status, business_registration_image_url
         FROM sellers WHERE id = ?`
    ).bind(sellerId).first<{
      id: number;
      business_registration_status: string | null;
      business_registration_image_url: string | null;
    }>().catch(() => null);
    if (!row) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    if (!row.business_registration_image_url && action === 'verify') {
      return c.json({ success: false, error: '제출된 사업자등록증 이미지가 없습니다' }, 400);
    }

    if (action === 'verify') {
      // 관리자 토큰에서 admin id 추출 (audit 용 — JWTPayload 형식 따름).
      const auth = c.req.header('Authorization') || '';
      let adminId: number | null = null;
      try {
        const tk = auth.replace(/^Bearer\s+/i, '');
        const payload = await import('hono/jwt').then(m => m.verify(tk, c.env.JWT_SECRET, 'HS256'));
        adminId = Number((payload as { admin_id?: number; user_id?: number }).admin_id ?? (payload as { user_id?: number }).user_id ?? 0) || null;
      } catch { /* token parse 실패 — null 유지 */ }

      await DB.prepare(
        `UPDATE sellers
            SET business_registration_status = 'verified',
                business_registration_verified_at = datetime('now'),
                business_registration_verified_by = ?,
                business_registration_reject_reason = NULL,
                updated_at = datetime('now')
          WHERE id = ?`
      ).bind(adminId, sellerId).run();

      await writeAuditLog(c, {
        action: 'verify_business_registration',
        targetType: 'seller',
        targetId: sellerId,
        before: { status: row.business_registration_status },
        after: { status: 'verified' },
      });
      createDashboardNotification(DB, 'seller', String(sellerId), 'business_reg_verified',
        '사업자등록 검증 완료', '현금 정산 + 딜 환급이 가능합니다',
        '/seller/settlements').catch(() => { /* noop */ });

      // 🛡️ 2026-05-18: 카카오 알림톡 발송 (ALIGO 설정된 경우).
      sendBusinessRegistrationAlimtalk(c.env as unknown as { DB: D1Database } & Record<string, string | undefined>, Number(sellerId), 'verify', null).catch(() => { /* fail-soft */ });

      return c.json({ success: true, message: '사업자등록을 승인했습니다' });
    }

    // action === 'reject'
    const rejectReason = String(reason || '').trim().slice(0, 500);
    if (!rejectReason) return c.json({ success: false, error: '거부 사유가 필요합니다' }, 400);

    await DB.prepare(
      `UPDATE sellers
          SET business_registration_status = 'rejected',
              business_registration_reject_reason = ?,
              updated_at = datetime('now')
        WHERE id = ?`
    ).bind(rejectReason, sellerId).run();

    await writeAuditLog(c, {
      action: 'reject_business_registration',
      targetType: 'seller',
      targetId: sellerId,
      before: { status: row.business_registration_status },
      after: { status: 'rejected', reason: rejectReason },
    });
    createDashboardNotification(DB, 'seller', String(sellerId), 'business_reg_rejected',
      '사업자등록 반려', rejectReason, '/seller/settlements').catch(() => { /* noop */ });

    // 🛡️ 2026-05-18: 카카오 알림톡 발송.
    sendBusinessRegistrationAlimtalk(c.env as unknown as { DB: D1Database } & Record<string, string | undefined>, Number(sellerId), 'reject', rejectReason).catch(() => { /* fail-soft */ });

    return c.json({ success: true, message: '사업자등록을 반려했습니다' });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 사업자 검증 대기 목록 조회 — 어드민 대시보드에서 사용.
adminSellersRoutes.get('/sellers/business-registration/pending', cors(), async (c) => {
  try {
    const { DB } = c.env;
    // defensive: 컬럼 없으면 빈 배열 반환.
    const rows = await DB.prepare(
      `SELECT s.id, s.name, s.business_name, s.business_number, s.business_registration_image_url,
              s.business_registration_status, s.business_registration_reject_reason, s.created_at, s.updated_at
         FROM sellers s
        WHERE s.business_registration_image_url IS NOT NULL
          AND s.business_registration_status = 'pending'
        ORDER BY s.updated_at DESC
        LIMIT 50`
    ).all<{
      id: number; name: string; business_name: string; business_number: string | null;
      business_registration_image_url: string;
      business_registration_status: string;
      business_registration_reject_reason: string | null;
      created_at: string; updated_at: string;
    }>().catch(() => ({ results: [] as Array<{
      id: number; name: string; business_name: string; business_number: string | null;
      business_registration_image_url: string;
      business_registration_status: string;
      business_registration_reject_reason: string | null;
      created_at: string; updated_at: string;
    }> }));
    return c.json({ success: true, data: rows.results || [] });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/approve', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, status FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    if (rows[0].status === 'approved') return c.json({ success: false, error: '이미 승인된 판매자입니다' }, 400);
    const prevStatus = rows[0].status;
    await executeQuery(DB, `UPDATE sellers SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    // 🛡️ 2026-05-07: seller_status_history INSERT — 영구 변경 이력. 잘못된 거절 복구 / 분쟁 대응.
    DB.prepare(`INSERT INTO seller_status_history (seller_id, prev_status, new_status, reason) VALUES (?, ?, 'approved', NULL)`)
      .bind(sellerId, prevStatus).run().catch(() => { /* 테이블 없을 시 silent */ });
    await writeAuditLog(c, { action: 'approve_seller', targetType: 'seller', targetId: sellerId, before: { status: prevStatus }, after: { status: 'approved' } });
    createDashboardNotification(DB, 'seller', String(sellerId), 'seller_approved', '셀러 승인 완료', '판매를 시작할 수 있습니다', '/seller').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) });

    // 🛡️ 2026-04-28: 셀러에게 카카오 알림톡
    try {
      const sellerInfo = await executeQuery<{ name: string; phone: string | null }>(DB,
        'SELECT name, phone FROM sellers WHERE id = ?', [sellerId]
      );
      const phone = sellerInfo[0]?.phone;
      const sellerName = sellerInfo[0]?.name || '';
      if (phone) {
        const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk');
        sendSystemAlimtalk(c.env, phone, 'seller_approved',
          `[유어딜] ${sellerName}님,\n셀러 가입이 승인되었어요!\n지금 바로 판매를 시작해보세요.`
        ).catch(swallow('admin-sellers:approve-alimtalk'));
      }
    } catch { /* ignore */ }

    return c.json({ success: true, data: { id: sellerId, status: 'approved' } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/reject', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const { reason: rawReason } = await c.req.json<{ reason?: string }>();
    const reason = typeof rawReason === 'string' ? rawReason.slice(0, 500) : null;
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    const prevStatusRow = await executeQuery<{ status: string }>(DB, 'SELECT status FROM sellers WHERE id = ?', [sellerId]);
    const prevStatus = prevStatusRow[0]?.status || null;
    await executeQuery(DB, `UPDATE sellers SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    DB.prepare(`INSERT INTO seller_status_history (seller_id, prev_status, new_status, reason) VALUES (?, ?, 'rejected', ?)`)
      .bind(sellerId, prevStatus, reason).run().catch(() => { /* silent */ });
    await writeAuditLog(c, { action: 'reject_seller', targetType: 'seller', targetId: sellerId, after: { status: 'rejected', reason } });

    // 🛡️ 2026-04-28: 셀러에게 거절 알림 (대시보드)
    createDashboardNotification(DB, 'seller', String(sellerId), 'seller_rejected', '셀러 가입 거절', reason ? `사유: ${reason}` : '관리자에게 문의해주세요', '/seller').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) });

    return c.json({ success: true, data: { id: sellerId, status: 'rejected', reason } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.delete('/sellers/:id', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, status FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    if (rows[0].status === 'suspended') return c.json({ success: false, error: '이미 정지된 판매자입니다' }, 400);
    const prevStatus = rows[0].status;
    try {
      await executeRun(DB, `UPDATE sellers SET is_active = 0, status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    } catch {
      await executeRun(DB, `UPDATE sellers SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sellerId]);
    }
    DB.prepare(`INSERT INTO seller_status_history (seller_id, prev_status, new_status, reason) VALUES (?, ?, 'suspended', NULL)`)
      .bind(sellerId, prevStatus).run().catch(() => { /* silent */ });

    try {
      await executeRun(DB, `UPDATE products SET is_active = 0 WHERE seller_id = ?`, [sellerId]);
    } catch { /* defensive — schema may vary */ }
    try {
      await executeRun(DB, `UPDATE live_streams SET status = 'ended' WHERE seller_id = ? AND status = 'live'`, [sellerId]);
    } catch { /* defensive */ }

    await writeAuditLog(c, { action: 'suspend_seller', targetType: 'seller', targetId: sellerId, before: { status: rows[0].status }, after: { status: 'suspended', is_active: 0 } });
    return c.json({ success: true, message: '판매자가 정지되었습니다', data: { id: sellerId, status: 'suspended' } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/commission', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const { commission_rate } = await c.req.json();
    if (commission_rate === undefined || commission_rate < 0 || commission_rate > 100)
      return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);
    const rows = await executeQuery<IdRow>(DB, 'SELECT id, commission_rate FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB, `UPDATE sellers SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [commission_rate, sellerId]);
    await writeAuditLog(c, { action: 'change_commission', targetType: 'seller', targetId: sellerId, before: { commission_rate: rows[0].commission_rate }, after: { commission_rate } });
    return c.json({ success: true, data: { id: sellerId, commission_rate } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/donation-commission', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const { donation_commission_rate } = await c.req.json();
    if (donation_commission_rate === undefined || donation_commission_rate < 0 || donation_commission_rate > 100) {
      return c.json({ success: false, error: '수수료율은 0~100 사이여야 합니다' }, 400);
    }
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    await executeQuery(DB,
      `UPDATE sellers SET donation_commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [donation_commission_rate, sellerId]
    );
    return c.json({ success: true, data: { id: sellerId, donation_commission_rate } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-21 Phase D: 사장님(store_owner) 매직링크 재발송 — 어드민/에이전시 1-click.
//   기존 endpoint (seller-orders.routes.ts:961) 는 셀러 본인용. 어드민이 발송 트리거 시 본 endpoint.
//   인프라 동일 (sendStoreOwnerAlimtalk + token) — 어드민 권한 확장만.
adminSellersRoutes.post('/sellers/:id/notify-magic-link', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    // 셀러의 첫 product (store_owner type) 또는 명시 productId
    const body = await c.req.json<{ product_id?: number }>().catch(() => ({} as { product_id?: number }));
    const product = body.product_id
      ? await DB.prepare("SELECT id, name, restaurant_name, restaurant_phone, store_owner_token, category FROM products WHERE id = ? AND seller_id = ?").bind(body.product_id, sellerId).first<{ id: number; name: string; restaurant_name: string; restaurant_phone: string; store_owner_token: string | null; category: string | null }>()
      : await DB.prepare("SELECT id, name, restaurant_name, restaurant_phone, store_owner_token, category FROM products WHERE seller_id = ? AND restaurant_phone IS NOT NULL ORDER BY id DESC LIMIT 1").bind(sellerId).first<{ id: number; name: string; restaurant_name: string; restaurant_phone: string; store_owner_token: string | null; category: string | null }>();
    if (!product) return c.json({ success: false, error: '발송 대상 상품을 찾을 수 없습니다 (restaurant_phone 필요)' }, 404);
    if (!product.restaurant_phone) return c.json({ success: false, error: '매장 전화번호가 없습니다' }, 400);

    const { generateStoreOwnerToken, sendStoreOwnerAlimtalk } = await import('../../group-buy/api/group-buy.routes');
    const { getVoucherShortLabel } = await import('../../../shared/constants/voucher-categories');
    let token: string = product.store_owner_token || '';
    if (!token) {
      token = generateStoreOwnerToken();
      try { await DB.prepare(`UPDATE products SET store_owner_token = ? WHERE id = ?`).bind(token, product.id).run(); } catch { /* graceful */ }
    }
    const statsUrl = `https://live.ur-team.com/store/stats/${product.id}?t=${token}`;
    await sendStoreOwnerAlimtalk(c.env as { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string }, product.restaurant_phone, {
      restaurantName: product.restaurant_name || '사장님',
      productName: product.name,
      statsUrl,
      categoryLabel: getVoucherShortLabel(product.category),
    });
    return c.json({ success: true, data: { product_id: product.id, stats_url: statsUrl } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-21: 에이전시 lock-in 재배정 — docs/AGENCY_POLICY.md 룰.
//   sellers.introduced_by_agency_id 는 가입 시 1회 lock-in. 변경은 이 endpoint 만 허용.
//   감사 로그 + 강력 경고 (admin_audit_log 자동 기록).
//   사유: 가게 사장님 분쟁 (영업권 충돌) / 에이전시 무활동 6개월 unlock 등.
adminSellersRoutes.patch('/sellers/:id/reassign-agency', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const body = await c.req.json<{ new_agency_id: number | null; reason: string }>().catch(() => ({} as { new_agency_id?: number | null; reason?: string }));
    const newAgencyId = body.new_agency_id;
    const reason = (body.reason || '').trim();
    if (!reason || reason.length < 5) {
      return c.json({ success: false, error: '재배정 사유를 최소 5자 이상 입력하세요.' }, 400);
    }
    if (newAgencyId != null) {
      // 새 agency 존재 확인
      const agency = await DB.prepare('SELECT id FROM agencies WHERE id = ?').bind(newAgencyId).first();
      if (!agency) return c.json({ success: false, error: '대상 에이전시를 찾을 수 없습니다.' }, 404);
    }
    // 현재 값 조회 (감사 로그용)
    const current = await DB.prepare('SELECT introduced_by_agency_id FROM sellers WHERE id = ?').bind(sellerId).first<{ introduced_by_agency_id: number | null }>();
    if (!current) return c.json({ success: false, error: '셀러를 찾을 수 없습니다.' }, 404);
    const previousAgencyId = current.introduced_by_agency_id;

    // UPDATE — introduced_at 도 갱신 (재배정 시점 기록)
    await DB.prepare(
      `UPDATE sellers SET introduced_by_agency_id = ?, introduced_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(newAgencyId, sellerId).run();

    // 감사 로그 (admin_audit_log 자동 생성, 없으면 silent skip)
    const actor = (c as unknown as { get: (k: string) => { id?: string | number; email?: string } }).get('user');
    try {
      await DB.prepare(
        `INSERT INTO admin_audit_log (actor_id, actor_email, action, resource_type, resource_id, old_value, new_value, ip, created_at)
         VALUES (?, ?, 'agency_reassign', 'seller', ?, ?, ?, ?, datetime('now'))`,
      ).bind(
        String(actor?.id || 'unknown'),
        actor?.email || null,
        sellerId,
        JSON.stringify({ introduced_by_agency_id: previousAgencyId }),
        JSON.stringify({ introduced_by_agency_id: newAgencyId, reason }),
        c.req.header('CF-Connecting-IP') || null,
      ).run();
    } catch { /* audit log 없으면 silent skip */ }

    return c.json({ success: true, data: { seller_id: sellerId, previous_agency_id: previousAgencyId, new_agency_id: newAgencyId, reason } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminSellersRoutes.patch('/sellers/:id/permissions', cors(), async (c) => {
  try {
    const { DB } = c.env;
    const sellerId = c.req.param('id');
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400);
    const { can_manipulate_stats } = await c.req.json();
    if (![0, 1, true, false].includes(can_manipulate_stats))
      return c.json({ success: false, error: 'can_manipulate_stats는 0 또는 1이어야 합니다' }, 400);
    const rows = await executeQuery<IdRow>(DB, 'SELECT id FROM sellers WHERE id = ?', [sellerId]);
    if (rows.length === 0) return c.json({ success: false, error: '판매자를 찾을 수 없습니다' }, 404);
    const val = can_manipulate_stats ? 1 : 0;
    await executeQuery(DB, `UPDATE sellers SET can_manipulate_stats = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [val, sellerId]);
    return c.json({ success: true, data: { id: sellerId, can_manipulate_stats: val } });
  } catch (err) {
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-18: 사업자 검증 결과 알림톡 — verify/reject 후 셀러에게 발송.
//   ALIGO env 미설정 시 silent skip (가이드 docs/kakao-alimtalk-templates.md 참조).
async function sendBusinessRegistrationAlimtalk(
  env: { DB: D1Database } & Record<string, string | undefined>,
  sellerId: number,
  action: 'verify' | 'reject',
  reason: string | null,
): Promise<void> {
  const apiKey = env.ALIGO_API_KEY
  const userId = env.ALIGO_USER_ID
  const senderKey = env.ALIGO_SENDER_KEY
  const templateCode = env.ALIGO_BUSINESS_REGISTRATION_RESULT || 'business_registration_result'
  if (!apiKey || !userId || !senderKey) return  // env 미설정 → skip

  const seller = await env.DB.prepare(
    'SELECT name, business_name, business_number, phone FROM sellers WHERE id = ?'
  ).bind(sellerId).first<{ name: string; business_name: string | null; business_number: string | null; phone: string | null }>()
    .catch(() => null)
  if (!seller?.phone) return

  const phone = seller.phone.replace(/\D/g, '')
  if (!/^01\d{8,9}$/.test(phone)) return

  const message = action === 'verify'
    ? `[유어딜] 사업자등록증 검증 완료\n\n회원님의 사업자등록증이 승인되었습니다.\n\n· 상호: ${seller.business_name || seller.name}\n· 사업자번호: ${seller.business_number || '-'}\n\n이제 현금 정산 + 딜 환급이 가능합니다.`
    : `[유어딜] 사업자등록증 반려\n\n· 사유: ${reason || '미상'}\n\n다시 제출해주세요. 검증 완료 후 현금 정산이 가능합니다.`

  try {
    const { sendAlimtalk } = await import('../../../lib/aligo')
    await sendAlimtalk(
      { ALIGO_API_KEY: apiKey, ALIGO_USER_ID: userId },
      { senderKey, templateCode, to: phone, message },
    )
  } catch { /* silent fail */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ 2026-05-19: POST /sellers/store-owner — 공급자 (가게 사장님) 빠른 등록.
//
// 사용 시나리오: D 공동구매 정책 — 셀러(인플루언서) + 가게 + 플랫폼 3자 분배.
//   가게는 라이브 송출 안 함, 상품만 등록 + 정산 받음.
//   어드민이 가게 정보 받아서 한 번에 셀러 계정 생성 → 가게에 자격증명 전달.
//
// Body: { business_name, contact_name, phone, email?, business_number?, password? }
//   password 미지정 시 임시 비밀번호 자동 생성 (8자리).
//   응답에 password 평문 1회 노출 — 어드민이 가게에 전달.
//
// 생성된 셀러:
//   seller_type='store_owner', can_broadcast=0, status='approved', is_active=1
//   commission_rate = 5% (platform 기본)
// ─────────────────────────────────────────────────────────────────────────────
adminSellersRoutes.post('/sellers/store-owner', cors(), rateLimit({ action: 'admin_create_store_owner', max: 30, windowSec: 3600 }), async (c) => {
  try {
    const DB = c.env.DB
    const body = await c.req.json<{
      business_name?: string
      contact_name?: string
      phone?: string
      email?: string
      business_number?: string
      password?: string
      commission_rate?: number  // 0~100 (%)
    }>()

    // 입력 검증
    if (!body.business_name || !body.contact_name || !body.phone) {
      return c.json({ success: false, error: 'business_name, contact_name, phone 필수' }, 400)
    }
    if (typeof body.business_name !== 'string' || body.business_name.length < 1 || body.business_name.length > 100) {
      return c.json({ success: false, error: '가게명 1~100자' }, 400)
    }
    if (typeof body.contact_name !== 'string' || body.contact_name.length < 1 || body.contact_name.length > 50) {
      return c.json({ success: false, error: '담당자명 1~50자' }, 400)
    }
    if (!/^01\d{8,9}$/.test(body.phone.replace(/-/g, ''))) {
      return c.json({ success: false, error: '휴대폰 번호 형식 오류 (010xxxxxxxx)' }, 400)
    }
    if (body.email && (typeof body.email !== 'string' || body.email.length > 255 || !body.email.includes('@'))) {
      return c.json({ success: false, error: '이메일 형식 오류' }, 400)
    }
    if (body.commission_rate != null) {
      const r = Number(body.commission_rate)
      if (!Number.isFinite(r) || r < 0 || r > 100) {
        return c.json({ success: false, error: '수수료율은 0~100 범위' }, 400)
      }
    }

    // 이메일 중복 체크 (있을 때만)
    if (body.email) {
      const dup = await DB.prepare('SELECT id FROM sellers WHERE email = ?').bind(body.email).first()
      if (dup) return c.json({ success: false, error: '이미 사용 중인 이메일' }, 409)
    }

    // 임시 비밀번호 생성 (지정 안 했을 때)
    const tempPassword = body.password ?? (
      // 8자리 — 영문 대소+숫자
      Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[b % 54])
        .join('')
    )
    if (typeof tempPassword !== 'string' || tempPassword.length < 6 || tempPassword.length > 128) {
      return c.json({ success: false, error: '비밀번호 6~128자' }, 400)
    }

    const { hashPassword } = await import('../../../lib/password')
    const hash = await hashPassword(tempPassword)
    const phone = body.phone.replace(/-/g, '')
    const email = body.email ?? `store_${phone}@store.ur-team.com`  // 가짜 이메일 (필수 컬럼)
    const username = `store_${phone}`

    // username 중복 회피 — 같은 번호로 재등록 시 _1 _2 suffix
    let finalUsername = username
    for (let i = 1; i < 100; i++) {
      const existing = await DB.prepare('SELECT id FROM sellers WHERE username = ?').bind(finalUsername).first()
      if (!existing) break
      finalUsername = `${username}_${i}`
    }

    const commissionRate = body.commission_rate != null ? Number(body.commission_rate) : 5

    // INSERT — seller_type='store_owner', can_broadcast=0, status='approved'
    let result
    try {
      result = await DB.prepare(`
        INSERT INTO sellers (
          username, password_hash, name, email, phone, business_name, business_number,
          status, is_active, commission_rate, seller_type, can_broadcast,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, 'store_owner', 0, datetime('now'), datetime('now'))
      `).bind(
        finalUsername, hash, body.contact_name, email, phone,
        body.business_name, body.business_number || null,
        commissionRate,
      ).run()
    } catch (err) {
      // seller_type / can_broadcast 컬럼 미존재 환경 fallback (migration 0272 미적용).
      if (import.meta.env?.DEV) console.warn('[admin:store-owner] new columns missing, fallback:', err)
      result = await DB.prepare(`
        INSERT INTO sellers (
          username, password_hash, name, email, phone, business_name, business_number,
          status, is_active, commission_rate, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, ?, datetime('now'), datetime('now'))
      `).bind(
        finalUsername, hash, body.contact_name, email, phone,
        body.business_name, body.business_number || null, commissionRate,
      ).run()
    }

    const newId = Number(result.meta?.last_row_id)

    // Audit log — 어드민이 누구 등록했는지 추적.
    await writeAuditLog(c, {
      action: 'seller.create_store_owner',
      targetType: 'seller',
      targetId: String(newId),
      after: {
        business_name: body.business_name,
        contact_name: body.contact_name,
        phone: phone.slice(0, 3) + '****' + phone.slice(-4),  // PII masked
        commission_rate: commissionRate,
      },
    })

    return c.json({
      success: true,
      data: {
        id: newId,
        username: finalUsername,
        temp_password: tempPassword,  // 어드민이 가게에 1회 전달용 — 응답 후 다신 노출 안 됨
        business_name: body.business_name,
        contact_name: body.contact_name,
        seller_type: 'store_owner',
        commission_rate: commissionRate,
        login_url: '/seller/login',
        note: '가게 사장님께 username + temp_password 안내하세요. 로그인 후 비밀번호 변경 권장.',
      },
    })
  } catch (err) {
    if (import.meta.env?.DEV) console.error('[admin:store-owner] error:', err)
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500)
  }
})

export default adminSellersRoutes;
