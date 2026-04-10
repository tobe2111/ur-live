/**
 * Notification Helper Functions
 * 소비자: user_notifications 테이블
 * 셀러/어드민: dashboard_notifications 테이블
 */

export async function notifyUser(DB: D1Database, userId: string, type: string, title: string, message?: string, link?: string) {
  try {
    await DB.prepare(`INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`)
      .bind(userId, type, title, message ?? null, link ?? null).run();
  } catch {}
}

export async function notifySeller(DB: D1Database, sellerId: string | number, type: string, title: string, message?: string, link?: string) {
  try {
    await DB.prepare(`INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link) VALUES ('seller', ?, ?, ?, ?, ?)`)
      .bind(String(sellerId), type, title, message ?? null, link ?? null).run();
  } catch {}
}

export async function notifyAdmin(DB: D1Database, type: string, title: string, message?: string, link?: string) {
  try {
    await DB.prepare(`INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link) VALUES ('admin', NULL, ?, ?, ?, ?)`)
      .bind(type, title, message ?? null, link ?? null).run();
  } catch {}
}

// 팔로워들에게 알림 (셀러의 모든 팔로워)
export async function notifyFollowers(DB: D1Database, sellerId: number, type: string, title: string, message?: string, link?: string) {
  try {
    const { results } = await DB.prepare('SELECT user_id FROM seller_follows WHERE seller_id = ?').bind(sellerId).all<{ user_id: string }>();
    if (!results?.length) return;
    const stmts = results.map(f =>
      DB.prepare('INSERT INTO user_notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)')
        .bind(f.user_id, type, title, message ?? null, link ?? null)
    );
    for (let i = 0; i < stmts.length; i += 50) {
      await DB.batch(stmts.slice(i, i + 50));
    }
  } catch {}
}

