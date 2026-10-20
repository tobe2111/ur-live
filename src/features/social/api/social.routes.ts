import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow';
import { intParam } from '@/shared/pagination'
const socialRoutes = new Hono<{ Bindings: Env }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

// 🛡️ 2026-05-19: per-worker 메모이제이션.
let _socialTablesEnsured = false
async function ensureTables(DB: D1Database) {
  if (_done_ensureTables.has(DB)) return
  _done_ensureTables.add(DB)
  if (_socialTablesEnsured) return
  try { await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_follows (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, seller_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, seller_id))`).run() } catch {}
  try { await DB.prepare(`CREATE TABLE IF NOT EXISTS user_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run() } catch {}
  _socialTablesEnsured = true
}

// 팔로우 토글
socialRoutes.post('/follow/:sellerId', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const sellerId = c.req.param('sellerId')
  const userId = String(user.id)

  const existing = await DB.prepare("SELECT id FROM seller_follows WHERE user_id = ? AND seller_id = ?").bind(userId, sellerId).first()
  if (existing) {
    await DB.prepare("DELETE FROM seller_follows WHERE user_id = ? AND seller_id = ?").bind(userId, sellerId).run()
    return c.json({ success: true, data: { following: false } })
  }
  await DB.prepare("INSERT INTO seller_follows (user_id, seller_id) VALUES (?, ?)").bind(userId, sellerId).run()
  // 셀러에게 새 팔로워 알림
  try {
    const { notifySeller } = await import('../../../lib/notifications')
    notifySeller(DB, sellerId || '', 'new_follower', '👤 새 팔로워!', `${user.name || '유저'}님이 팔로우했습니다`, `/profile/${sellerId}`).catch(swallow('social:api:social'))
  } catch {}
  return c.json({ success: true, data: { following: true } })
})

// 팔로우 상태 확인
socialRoutes.get('/follow/:sellerId', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const existing = await DB.prepare("SELECT id FROM seller_follows WHERE user_id = ? AND seller_id = ?").bind(String(user.id), c.req.param('sellerId')).first()
  return c.json({ success: true, data: { following: !!existing } })
})

// 팔로잉 셀러 목록
socialRoutes.get('/following', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const { results } = await DB.prepare(`
    SELECT s.id, s.name, s.profile_image, s.bio FROM seller_follows f
    LEFT JOIN sellers s ON f.seller_id = s.id WHERE f.user_id = ? ORDER BY f.created_at DESC
  `).bind(String(user.id)).all()
  return c.json({ success: true, data: results ?? [] })
})

// 알림 목록
// 🛡️ 2026-07-01: 두 테이블(user_notifications + 레거시 notifications[user_type='user'])
//   통합 조회. 이전엔 user_notifications 만 읽어, notifications 테이블에 쓰인 소비자
//   알림(쿠폰/이용권 만료·숙소 리마인더·KT 교환권·결제완료 등)이 목록엔 안 뜨는데
//   미읽음 뱃지(unread-count 는 두 테이블 합산)엔 카운트돼 '안 지워지는 유령 뱃지'가 됐음.
//   id 는 un_/n_ prefix(unified) 로 반환 → 읽음/삭제가 올바른 테이블로 라우팅.
socialRoutes.get('/notifications', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  // 🏁 2026-06-12 (감사 🟢): limit/offset additive — 기본(무파라미터)은 기존과 동일 50/0.
  const limit = Math.min(100, Math.max(1, intParam(c.req.query('limit'), 50)))
  const offset = Math.max(0, intParam(c.req.query('offset'), 0))
  const userId = String(user.id)
  const need = limit + offset
  const all: any[] = []
  try {
    const { results } = await DB.prepare(
      `SELECT ('un_' || id) AS id, type, title, message, link, is_read, created_at
       FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(userId, need).all()
    all.push(...(results ?? []))
  } catch { /* 테이블 없음 */ }
  try {
    const { results } = await DB.prepare(
      `SELECT ('n_' || id) AS id, type, title, message, link, is_read, created_at
       FROM notifications WHERE user_id = ? AND user_type = 'user' ORDER BY created_at DESC LIMIT ?`
    ).bind(userId, need).all()
    all.push(...(results ?? []))
  } catch { /* 테이블 없음 */ }
  all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const page = all.slice(offset, offset + limit)
  return c.json({ success: true, data: page, has_more: all.length > offset + limit })
})

// 알림 읽음 처리 — id prefix(un_/n_)로 대상 테이블 라우팅. prefix 없으면 양쪽 시도(하위호환).
socialRoutes.put('/notifications/:id/read', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  const raw = c.req.param('id') || ''
  const userId = String(user.id)
  // 🏁 2026-06-12: 본인 소유 검증(id + user_id) — 타인 알림 읽음 플립(저위험 IDOR) 방지.
  let changed = 0
  if (raw.startsWith('un_') || !raw.startsWith('n_')) {
    const nid = raw.startsWith('un_') ? raw.slice(3) : raw
    try {
      const r = await DB.prepare("UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?")
        .bind(nid, userId).run()
      changed += r.meta?.changes ?? 0
    } catch {}
  }
  if (raw.startsWith('n_') || (changed === 0 && !raw.startsWith('un_'))) {
    const nid = raw.startsWith('n_') ? raw.slice(2) : raw
    try {
      const r = await DB.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND user_type = 'user'")
        .bind(nid, userId).run()
      changed += r.meta?.changes ?? 0
    } catch {}
  }
  return c.json({ success: true })
})

// 알림 전체 읽음 — 두 테이블 모두 처리(뱃지 = 두 테이블 합산이므로 양쪽 지워야 0).
socialRoutes.put('/notifications/read-all', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  const userId = String(user.id)
  try { await DB.prepare("UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").bind(userId).run() } catch {}
  try { await DB.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND user_type = 'user' AND is_read = 0").bind(userId).run() } catch {}
  return c.json({ success: true })
})

// ── 셀러 후원 랭킹 (서포터 뱃지) ──
socialRoutes.get('/supporters/:sellerId', async (c) => {
  const { DB } = c.env
  const sellerId = c.req.param('sellerId')

  // donations 테이블에서 셀러별 총 후원액 랭킹
  try {
    const { results } = await DB.prepare(`
      SELECT donor_user_id, donor_name, SUM(amount) as total_amount, COUNT(*) as donation_count
      FROM donations
      WHERE seller_id = ? AND payment_status = 'completed'
      GROUP BY donor_user_id
      ORDER BY total_amount DESC
      LIMIT 50
    `).bind(sellerId).all()

    const ranked = (results ?? []).map((r: any, i: number) => ({
      ...r,
      rank: i + 1,
      badge: i === 0 ? 'crown' : i === 1 ? 'diamond' : i === 2 ? 'star' : null
    }))

    // 총 후원 통계
    const stats = await DB.prepare(`
      SELECT COUNT(DISTINCT donor_user_id) as supporter_count, SUM(amount) as total_donations
      FROM donations WHERE seller_id = ? AND payment_status = 'completed'
    `).bind(sellerId).first<{ supporter_count: number; total_donations: number }>()

    return c.json({ success: true, data: { supporters: ranked, stats: stats || { supporter_count: 0, total_donations: 0 } } })
  } catch {
    return c.json({ success: true, data: { supporters: [], stats: { supporter_count: 0, total_donations: 0 } } })
  }
})

// 셀러 팔로워 수
socialRoutes.get('/followers/:sellerId', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)
  const count = await DB.prepare("SELECT COUNT(*) as cnt FROM seller_follows WHERE seller_id = ?").bind(c.req.param('sellerId')).first<{ cnt: number }>()
  return c.json({ success: true, data: { count: count?.cnt ?? 0 } })
})

export { socialRoutes }


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTables = new WeakSet<object>()
