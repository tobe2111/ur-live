/**
 * Admin Users Routes — 유저 관리
 *
 * 🛡️ 2026-04-22 배치 154 (TD-006 부분): admin-management.routes.ts 에서 분리.
 *
 * 엔드포인트:
 * - GET   /users                 — 유저 목록 (검색 + 페이지네이션)
 * - GET   /users/:id             — 유저 상세 (주문·리뷰 통계 포함)
 * - PATCH /users/:id/status      — 유저 상태 변경 (active/suspended/banned)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@/worker/types/env';
import { executeQuery, executeRun } from '@/worker/utils/database';
import { writeAuditLog } from '@/worker/middleware/admin-security';
import { intParam } from '@/shared/pagination'

export const adminUsersRoutes = new Hono<{ Bindings: Env }>();

function safeAdminError(err: unknown, env: Env): string {
  const isProd = (env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'production';
  if (isProd) return 'Internal server error';
  return err instanceof Error ? err.message : String(err);
}

interface CountRow { count: number }
interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  provider: string | null;
  status: string | null;
  created_at: string;
  deal_balance: number | null;
}
interface UserDetailRow extends UserRow {
  order_count: number;
  total_spent: number;
  review_count: number;
}

// 🛡️ 2026-05-24: 페이지네이션 + 정렬 (created_at / order_count / total_spent / review_count) + 검색 (이름/이메일/전화번호).
adminUsersRoutes.get('/users', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const page = Math.max(1, intParam(c.req.query('page'), 1));
    const limit = Math.min(100, Math.max(1, intParam(c.req.query('limit'), 50)));
    const offset = (page - 1) * limit;
    const search = (c.req.query('search') || '').trim();
    const sortRaw = c.req.query('sort') || 'created_at';
    const orderRaw = c.req.query('order') || 'desc';

    // 정렬 화이트리스트 — SQL injection 방어.
    const sortMap: Record<string, string> = {
      created_at: 'u.created_at',
      order_count: 'order_count',
      total_spent: 'total_spent',
      review_count: 'review_count',
      name: 'u.name',
    };
    const sortCol = sortMap[sortRaw] || 'u.created_at';
    const orderDir = orderRaw === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (search) {
      // 이름 / 이메일 / 전화번호 — 전화번호는 숫자만 비교 (하이픈 무관).
      const phoneDigits = search.replace(/[^\d]/g, '');
      if (phoneDigits.length >= 4) {
        conditions.push('(u.name LIKE ? OR u.email LIKE ? OR REPLACE(REPLACE(u.phone, \'-\', \'\'), \' \', \'\') LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${phoneDigits}%`);
      } else {
        conditions.push('(u.name LIKE ? OR u.email LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await executeQuery<CountRow>(DB,
      `SELECT COUNT(*) as count FROM users u ${where}`, params
    );
    const total = countRows[0]?.count || 0;

    // 🛡️ 정렬에 order_count / total_spent / review_count 가 포함되면 subquery JOIN 필수.
    //   기본 created_at 정렬은 subquery 없이도 OK 지만, 일관성 위해 항상 JOIN.
    //   D1 SQLite — LEFT JOIN + GROUP BY 로 aggregate; CAST(u.id AS TEXT) 매핑은 user_id 가 TEXT 일 수도 있는 환경 대응.
    const users = await executeQuery<UserRow & { order_count: number; total_spent: number; review_count: number }>(DB,
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              COALESCE(os.order_count, 0) AS order_count,
              COALESCE(os.total_spent, 0) AS total_spent,
              COALESCE(rs.review_count, 0) AS review_count
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS order_count, COALESCE(SUM(total_amount), 0) AS total_spent
         FROM orders
         WHERE status IN ('PAID','DONE','SHIPPING','DELIVERED')
         GROUP BY user_id
       ) os ON CAST(os.user_id AS TEXT) = CAST(u.id AS TEXT)
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS review_count
         FROM product_reviews
         GROUP BY user_id
       ) rs ON CAST(rs.user_id AS TEXT) = CAST(u.id AS TEXT)
       ${where}
       ORDER BY ${sortCol} ${orderDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return c.json({
      success: true,
      data: users,
      // 🛡️ 2026-05-24: frontend 호환 — 기존 res.data.totalPages / res.data.total 직접 읽기.
      totalPages: Math.ceil(total / limit),
      total,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      sort: sortRaw,
      order: orderRaw,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] users list error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminUsersRoutes.patch('/users/:id/status', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const userId = c.req.param('id');
    // 🛡️ 2026-04-22 배치 160: userId 빈값 검증 (empty string 으로 전체 조회되는 버그 차단)
    if (!userId || userId.trim().length === 0) {
      return c.json({ success: false, error: 'Invalid user ID' }, 400);
    }
    const { status } = await c.req.json<{ status: string }>();

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return c.json({ success: false, error: '유효하지 않은 상태입니다. active, suspended, banned 중 선택하세요' }, 400);
    }

    const rows = await executeQuery<{ id: string; status: string }>(DB,
      `SELECT id, status FROM users WHERE id = ?`, [userId]
    );
    if (rows.length === 0) {
      return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    }

    await executeRun(DB, `UPDATE users SET status = ? WHERE id = ?`, [status, userId]);

    await writeAuditLog(c, {
      action: 'update_user_status',
      targetType: 'user',
      targetId: userId,
      before: { status: rows[0].status },
      after: { status }
    });

    return c.json({ success: true, message: '사용자 상태가 변경되었습니다', data: { id: userId, status } });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] user status error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// ============================================================
// 🛡️ 2026-05-25: 어드민 딜 선물 — POST /api/admin/users/:id/gift-deal
// body: { amount: number, reason?: string }
// 동작:
//   1. user_points balance += amount (upsert)
//   2. point_transactions INSERT (type='admin_gift')
//   3. user_notifications INSERT (선물 알림)
//   4. push 알림 fire-and-forget
//   5. audit log
// ============================================================
adminUsersRoutes.post('/users/:id/gift-deal', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const userId = c.req.param('id');
    if (!userId || userId.trim().length === 0) {
      return c.json({ success: false, error: 'Invalid user ID' }, 400);
    }
    const body = await c.req.json<{ amount?: number; reason?: string }>().catch(() => ({} as any));
    const amount = Number(body.amount);
    const reason = String(body.reason || '').slice(0, 200) || '어드민 딜 선물';

    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ success: false, error: '금액은 1 이상의 숫자여야 합니다' }, 400);
    }
    if (amount > 10_000_000) {
      return c.json({ success: false, error: '한 번에 최대 1000만 딜까지 선물 가능합니다 (오타 방지)' }, 400);
    }

    // 사용자 존재 확인
    const userRow = await DB.prepare('SELECT id, name FROM users WHERE id = ? LIMIT 1')
      .bind(userId).first<{ id: string; name: string }>().catch(() => null);
    if (!userRow) return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);

    // user_points 테이블 보장 (idempotent)
    await DB.prepare(`CREATE TABLE IF NOT EXISTS user_points (
      user_id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      total_charged INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run().catch(() => null);

    // 1. 잔액 적립 (upsert)
    await DB.prepare(`
      INSERT INTO user_points (user_id, balance, total_charged)
      VALUES (?, ?, 0)
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + excluded.balance,
        updated_at = datetime('now')
    `).bind(String(userId), amount).run();

    // 2. 거래 이력
    const balanceAfterRow = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(String(userId)).first<{ balance: number }>().catch(() => null);
    const balanceAfter = balanceAfterRow?.balance ?? amount;

    await DB.prepare(`
      INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, created_at)
      VALUES (?, 'admin_gift', ?, ?, ?, ?, datetime('now'))
    `).bind(String(userId), amount, amount, balanceAfter, reason).run().catch(() => null);

    // 3. 사용자 알림 (DB)
    await DB.prepare(`
      INSERT INTO user_notifications (user_id, type, title, message, link, created_at)
      VALUES (?, 'admin_gift', ?, ?, '/user/profile', datetime('now'))
    `).bind(String(userId), '🎁 딜 선물 도착!', `${amount.toLocaleString()}딜을 선물받으셨어요. (${reason})`).run().catch(() => null);

    // 4. push 알림 (best-effort)
    try {
      const { sendSystemPush } = await import('../../../lib/system-push');
      c.executionCtx.waitUntil(
        sendSystemPush(c.env as any, 'user', String(userId), {
          title: '🎁 딜 선물 도착!',
          body: `${amount.toLocaleString()}딜이 선물 적립되었어요`,
          url: '/user/profile',
          tag: `gift-${userId}-${Date.now()}`,
        }).catch(() => {}),
      );
    } catch { /* graceful */ }

    // 5. audit log
    await writeAuditLog(c, {
      action: 'admin_gift_deal',
      targetType: 'user',
      targetId: String(userId),
      after: { amount, reason, balance_after: balanceAfter },
    });

    return c.json({
      success: true,
      message: `${userRow.name}님에게 ${amount.toLocaleString()}딜을 선물했습니다`,
      data: { user_id: userId, amount, balance_after: balanceAfter },
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] gift deal error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

adminUsersRoutes.get('/users/:id', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const userId = c.req.param('id');
    // 🛡️ 2026-04-22 배치 160: userId 빈값 검증
    if (!userId || userId.trim().length === 0) {
      return c.json({ success: false, error: 'Invalid user ID' }, 400);
    }

    // 🛡️ 2026-04-28: phone 컬럼이 production users 테이블에 없을 수도 → fallback 처리.
    let users: UserRow[] = [];
    try {
      users = await executeQuery<UserRow>(DB,
        `SELECT id, name, email, phone, created_at
         FROM users WHERE id = ?`, [userId]
      );
    } catch {
      // phone 컬럼 없을 때 fallback (NULL 로 채움)
      const usersNoPhone = await executeQuery<Omit<UserRow, 'phone'>>(DB,
        `SELECT id, name, email, created_at FROM users WHERE id = ?`, [userId]
      );
      users = usersNoPhone.map(u => ({ ...u, phone: null }) as UserRow);
    }
    if (users.length === 0) {
      return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);
    }

    // 🛡️ 각 통계 쿼리 try-catch — 한 쿼리 실패해도 다른 통계는 반환
    let orderStats: { order_count: number; total_spent: number }[] = [];
    try {
      orderStats = await executeQuery<{ order_count: number; total_spent: number }>(DB,
        `SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_spent
         FROM orders WHERE user_id = ? AND status IN ('PAID','DONE','SHIPPING','DELIVERED')`,
        [userId]
      );
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[admin-users] order stats failed:', e);
    }

    let reviewStats: CountRow[] = [];
    try {
      reviewStats = await executeQuery<CountRow>(DB,
        `SELECT COUNT(*) as count FROM product_reviews WHERE user_id = ?`, [userId]
      );
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[admin-users] review stats failed:', e);
    }

    // 🛡️ 이 카카오 유저에 연결된 셀러 / 에이전시 계정 조회 (있으면 어드민에게 통합 표시)
    let linkedSeller: Record<string, unknown> | null = null
    try {
      const row = await executeQuery<Record<string, unknown>>(DB,
        `SELECT id, business_name, seller_type, status, commission_rate, created_at
         FROM sellers WHERE linked_user_id = ? LIMIT 1`, [userId]
      )
      linkedSeller = row[0] || null
    } catch { /* sellers.linked_user_id 미적용 DB — skip */ }

    let linkedAgency: Record<string, unknown> | null = null
    try {
      const row = await executeQuery<Record<string, unknown>>(DB,
        `SELECT id, name, contact_name, status, commission_rate, created_at
         FROM agencies WHERE linked_user_id = ? LIMIT 1`, [userId]
      )
      linkedAgency = row[0] || null
    } catch { /* agencies.linked_user_id 미적용 DB — skip */ }

    // 🛡️ 2026-05-24 (사용자 요청): 행 상세에 인라인 통계 추가 — 모달 안 열어도 바로 보임.
    //   딜 잔액 / 최근 거래 5건 / 바우처 수 / 쿠폰 수 / 찜 수.
    let walletBalance = 0
    try {
      const w = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
        .bind(userId).first<{ balance: number }>()
      if (w?.balance != null) walletBalance = Number(w.balance) || 0
    } catch { /* user_points 부재 환경 */ }

    let recentTransactions: Array<{ id: number; type: string; amount: number; description: string; created_at: string }> = []
    try {
      const r = await DB.prepare(
        `SELECT id, type, amount, description, created_at
         FROM point_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 5`
      ).bind(userId).all<typeof recentTransactions[number]>()
      recentTransactions = r.results || []
    } catch { /* point_transactions 부재 */ }

    let voucherCount = 0
    try {
      const v = await DB.prepare('SELECT COUNT(*) AS c FROM vouchers WHERE user_id = ?').bind(userId).first<{ c: number }>()
      voucherCount = Number(v?.c) || 0
    } catch { /* vouchers 부재 */ }

    let couponCount = 0
    try {
      const cp = await DB.prepare('SELECT COUNT(*) AS c FROM user_coupons WHERE user_id = ?').bind(userId).first<{ c: number }>()
      couponCount = Number(cp?.c) || 0
    } catch { /* user_coupons 부재 */ }

    let wishlistCount = 0
    try {
      const wl = await DB.prepare('SELECT COUNT(*) AS c FROM wishlists WHERE user_id = ?').bind(userId).first<{ c: number }>()
      wishlistCount = Number(wl?.c) || 0
    } catch { /* wishlists 부재 */ }

    const user = users[0];
    const detail: UserDetailRow & {
      linked_seller?: unknown;
      linked_agency?: unknown;
      wallet_balance: number;
      voucher_count: number;
      coupon_count: number;
      wishlist_count: number;
      recent_transactions: typeof recentTransactions;
    } = {
      ...user,
      order_count: orderStats[0]?.order_count || 0,
      total_spent: orderStats[0]?.total_spent || 0,
      review_count: reviewStats[0]?.count || 0,
      linked_seller: linkedSeller,
      linked_agency: linkedAgency,
      wallet_balance: walletBalance,
      voucher_count: voucherCount,
      coupon_count: couponCount,
      wishlist_count: wishlistCount,
      recent_transactions: recentTransactions,
    };

    return c.json({ success: true, data: detail });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] user detail error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

// 🛡️ 2026-05-24 (사용자 우려): "정지원 유저의 딜 잔액 / 쿠폰 / 바우처 / 찜이 사라졌어"
//   진단용 endpoint — 특정 user_id 또는 이름/이메일/전화번호로 검색해
//   전체 상태 한 번에 확인. data loss 여부 vs 다른 user_id 매칭 issue 즉시 판별.
//
//   GET /api/admin/users/:id/full-state
//   응답:
//     - user (id/name/email/phone/kakao_id/created_at)
//     - duplicate_users (같은 이름 또는 같은 kakao_id 의 row 들 — 가장 흔한 원인)
//     - balance (user_points)
//     - point_transactions (최근 10건)
//     - vouchers (count + 최근 5)
//     - coupons (count + 최근 5)
//     - wishlists (count + 최근 5)
//     - orders (count + 최근 5)
//     - diagnosis (한국어 진단 메시지)
adminUsersRoutes.get('/users/:id/full-state', cors(), async (c) => {
  try {
    const DB = c.env.DB;
    const userId = c.req.param('id');
    if (!userId || userId.trim().length === 0) {
      return c.json({ success: false, error: 'Invalid user ID' }, 400);
    }
    const idStr = String(userId);

    // 1. 사용자 본인
    const user = await DB.prepare(
      `SELECT id, name, email, phone, kakao_id, created_at, updated_at, last_login_at
       FROM users WHERE id = ?`
    ).bind(idStr).first<{ id: number; name: string; email: string | null; phone: string | null; kakao_id: string | null; created_at: string; updated_at: string | null; last_login_at: string | null }>().catch(() => null);
    if (!user) return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404);

    // 2. 중복 의심 — 같은 이름 / 같은 이메일 / 같은 kakao_id / 같은 phone 의 다른 row.
    //    유저 데이터가 "사라진" 가장 흔한 원인 — 카카오 콜백이 신규 row 생성.
    const dupConditions: string[] = []
    const dupParams: unknown[] = []
    if (user.name) { dupConditions.push('name = ?'); dupParams.push(user.name) }
    if (user.email) { dupConditions.push('email = ?'); dupParams.push(user.email) }
    if (user.kakao_id) { dupConditions.push('kakao_id = ?'); dupParams.push(user.kakao_id) }
    if (user.phone) { dupConditions.push('phone = ?'); dupParams.push(user.phone) }
    let duplicates: Array<{ id: number; name: string | null; email: string | null; phone: string | null; kakao_id: string | null; created_at: string }> = []
    if (dupConditions.length > 0) {
      const dupQuery = `SELECT id, name, email, phone, kakao_id, created_at
                        FROM users
                        WHERE (${dupConditions.join(' OR ')}) AND id != ?
                        ORDER BY id`
      const r = await DB.prepare(dupQuery).bind(...dupParams, idStr).all<typeof duplicates[number]>().catch(() => ({ results: [] as typeof duplicates }))
      duplicates = r.results || []
    }

    // 3. 딜 잔액
    const wallet = await DB.prepare('SELECT balance, updated_at FROM user_points WHERE user_id = ?')
      .bind(idStr).first<{ balance: number; updated_at: string }>().catch(() => null);

    // 4. point_transactions 최근 10
    const ptx = await DB.prepare(
      `SELECT id, type, amount, balance_after, description, order_id, created_at
       FROM point_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 10`
    ).bind(idStr).all().catch(() => ({ results: [] }));

    // 5. vouchers
    const vouchersCount = (await DB.prepare('SELECT COUNT(*) AS c FROM vouchers WHERE user_id = ?').bind(idStr).first<{ c: number }>().catch(() => ({ c: 0 }))) || { c: 0 };
    const vouchersRecent = await DB.prepare(
      `SELECT v.id, v.code, v.status, v.created_at, p.name AS product_name
       FROM vouchers v LEFT JOIN products p ON v.product_id = p.id
       WHERE v.user_id = ? ORDER BY v.id DESC LIMIT 5`
    ).bind(idStr).all().catch(() => ({ results: [] }));

    // 6. coupons (user_coupons 또는 비슷)
    let couponsCount: { c: number } = { c: 0 };
    let couponsRecent: { results: unknown[] } = { results: [] };
    try {
      couponsCount = await DB.prepare('SELECT COUNT(*) AS c FROM user_coupons WHERE user_id = ?').bind(idStr).first<{ c: number }>() || { c: 0 };
      couponsRecent = await DB.prepare(
        `SELECT id, coupon_code, status, created_at FROM user_coupons WHERE user_id = ? ORDER BY id DESC LIMIT 5`
      ).bind(idStr).all();
    } catch { /* table missing */ }

    // 7. wishlists
    let wishlistCount: { c: number } = { c: 0 };
    let wishlistRecent: { results: unknown[] } = { results: [] };
    try {
      wishlistCount = await DB.prepare('SELECT COUNT(*) AS c FROM wishlists WHERE user_id = ?').bind(idStr).first<{ c: number }>() || { c: 0 };
      wishlistRecent = await DB.prepare(
        `SELECT w.id, w.product_id, w.created_at, p.name AS product_name
         FROM wishlists w LEFT JOIN products p ON w.product_id = p.id
         WHERE w.user_id = ? ORDER BY w.id DESC LIMIT 5`
      ).bind(idStr).all();
    } catch { /* table missing */ }

    // 8. orders
    const ordersCount = (await DB.prepare('SELECT COUNT(*) AS c FROM orders WHERE user_id = ?').bind(idStr).first<{ c: number }>().catch(() => ({ c: 0 }))) || { c: 0 };
    const ordersRecent = await DB.prepare(
      `SELECT id, order_number, status, total_amount, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 5`
    ).bind(idStr).all().catch(() => ({ results: [] }));

    // 9. 진단 메시지
    const diagnosis: string[] = []
    if (duplicates.length > 0) {
      diagnosis.push(`⚠️ 같은 정보 (이름/이메일/kakao_id/phone) 의 다른 user row ${duplicates.length}개 발견 — 데이터가 "사라진" 게 아니라 다른 ID 에 있을 가능성 큼.`)
      duplicates.forEach(d => {
        diagnosis.push(`   → 중복 id=${d.id} (name=${d.name}, email=${d.email}, kakao=${d.kakao_id}, created=${d.created_at})`)
      })
    } else {
      diagnosis.push('✅ 중복 user row 없음 (같은 이름/이메일/kakao_id/phone 의 다른 row 없음).')
    }
    if (!wallet) diagnosis.push('⚠️ user_points row 없음 — 첫 충전/적립 전 상태.')
    else diagnosis.push(`💰 딜 잔액: ${wallet.balance} (마지막 갱신: ${wallet.updated_at})`)
    diagnosis.push(`🎫 vouchers: ${vouchersCount.c}건 / 🎟 coupons: ${couponsCount.c}건 / ❤️ wishlists: ${wishlistCount.c}건 / 📦 orders: ${ordersCount.c}건`)

    return c.json({
      success: true,
      data: {
        user,
        duplicates,
        wallet,
        point_transactions: ptx.results || [],
        vouchers: { count: vouchersCount.c, recent: vouchersRecent.results || [] },
        coupons: { count: couponsCount.c, recent: couponsRecent.results || [] },
        wishlists: { count: wishlistCount.c, recent: wishlistRecent.results || [] },
        orders: { count: ordersCount.c, recent: ordersRecent.results || [] },
        diagnosis,
      },
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[Admin] users full-state error:', err);
    return c.json({ success: false, error: safeAdminError(err, c.env) }, 500);
  }
});

export default adminUsersRoutes;
