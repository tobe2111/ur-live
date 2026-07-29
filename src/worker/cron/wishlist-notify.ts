/**
 * 🔔 2026-07-01 소비자 위시리스트(찜) 알림 cron — 재입고 + 가격 인하.
 *
 * 배경: 소비자가 `wishlists`(찜) 에 담은 상품이 (1) 재입고(stock 0→양수) 되거나 (2) 가격이
 *   내려가면 알려주는 표준 커머스 리텐션 알림이 그동안 **emitter 가 없어 미구현**이었다(설정/설계만).
 *   재고·가격 갱신 site 는 셀러/어드민 여러 곳(일부 잠금)에 흩어져 있어 hooking 은 결합도가 높다.
 *   → 도매 재입고(`wholesale-restock-notify`)와 동일하게 **cron 이 주기적으로 스캔**하는 저결합 단일
 *   통지 경로. 재고/가격 쓰기 코드는 전혀 건드리지 않는다.
 *
 * 멱등/스팸 방지(별도 dedup 테이블 — `wishlists` 핫 테이블 불변):
 *   - `wishlist_stock_notifications(user_id, product_id, notified_at)` UNIQUE(user,product):
 *     재입고 통지 1회 후 행 존재 → 재통지 차단. 상품이 다시 품절(stock=0) 되면 행 삭제 → 다음 재입고 재통지.
 *   - `wishlist_price_notifications(user_id, product_id, last_price, notified_at)` UNIQUE(user,product):
 *     첫 관측은 baseline(last_price) 기록만(무통지). 이후 `price < last_price` 일 때만 통지 + last_price 갱신
 *     → 반복 인하는 매번 통지하되 같은/높은 가격엔 통지 0(스팸 방지).
 *
 * 통지 채널: 인앱(`notifyUser` → user_notifications) + 웹/네이티브 푸시(`sendSystemPush`, push_enabled 존중).
 * 권장 주기: 재입고=15~30분(또는 매시), 가격인하=매시/일배치. 부하 낮음(멱등, BATCH_CAP).
 */
import type { Env } from '../types/env'
import { notifyUser } from '../../lib/notifications'
import { sendSystemPush } from '../../lib/system-push'
import { isVoucherCategory } from '../../shared/constants/voucher-categories'
import { logInfo, logError } from '../utils/logger'

const BATCH_CAP = 200

let _ensured = false
async function ensureTables(DB: D1Database) {
  if (_ensured) return
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS wishlist_stock_notifications (
      user_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, product_id)
    )`).run()
    await DB.prepare(`CREATE TABLE IF NOT EXISTS wishlist_price_notifications (
      user_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      last_price INTEGER,
      notified_at DATETIME,
      PRIMARY KEY (user_id, product_id)
    )`).run()
    _ensured = true
  } catch { /* exists */ }
}

function productLink(productId: number, category: string | null): string {
  return isVoucherCategory(category) ? `/group-buy/${productId}` : `/products/${productId}`
}

/**
 * 찜 추가 시점 baseline 시드(라우트에서 호출). fail-soft.
 *  - 재고>0 이면 stock 알림행 시드 → 지금 정상재고를 '재입고'로 오통지하지 않게 함. (품절이면 시드
 *    안 함 → 나중에 stock>0 회복 시 통지 대상.) ★ 이게 없으면 in-stock 상품 찜마다 '재입고' 오발송.
 *  - price baseline = 찜 시점 현재가(첫 스캔가 대신) → 찜 직후 인하도 놓치지 않음.
 */
export async function seedWishlistBaseline(DB: D1Database, userId: string | number, productId: number | string | undefined): Promise<void> {
  try {
    await ensureTables(DB)
    const uid = String(userId)
    const pid = Number(productId)
    if (!Number.isFinite(pid)) return
    const p = await DB.prepare('SELECT COALESCE(stock, stock_quantity, 0) AS stock, price FROM products WHERE id = ?')
      .bind(pid).first<{ stock: number; price: number | null }>()
    if (!p) return
    if (Number(p.stock) > 0) {
      await DB.prepare("INSERT OR IGNORE INTO wishlist_stock_notifications (user_id, product_id, notified_at) VALUES (?, ?, datetime('now'))")
        .bind(uid, pid).run().catch(() => {})
    }
    if (p.price != null && Number(p.price) > 0) {
      await DB.prepare('INSERT OR IGNORE INTO wishlist_price_notifications (user_id, product_id, last_price) VALUES (?, ?, ?)')
        .bind(uid, pid, Number(p.price)).run().catch(() => {})
    }
  } catch { /* best-effort */ }
}

/** 찜 제거 시 baseline 정리(라우트에서 호출) — 재입고/가격 dedup 행 누적 방지 + 재추가 시 fresh 시드. */
export async function clearWishlistBaseline(DB: D1Database, userId: string | number, productId: number | string | undefined): Promise<void> {
  try {
    const uid = String(userId)
    const pid = Number(productId)
    if (!Number.isFinite(pid)) return
    await DB.prepare('DELETE FROM wishlist_stock_notifications WHERE user_id = ? AND product_id = ?').bind(uid, pid).run().catch(() => {})
    await DB.prepare('DELETE FROM wishlist_price_notifications WHERE user_id = ? AND product_id = ?').bind(uid, pid).run().catch(() => {})
  } catch { /* best-effort */ }
}

interface RestockRow { user_id: string; product_id: number; product_name: string | null; category: string | null }

/** 재입고 알림: 찜한 상품이 stock>0 으로 회복되면 통지(1회). 품절 시 dedup 행 삭제 → 재입고 시 재통지. */
export async function handleWishlistRestockNotify(env: Env): Promise<{ notified: number }> {
  const DB = env.DB
  let notified = 0
  try {
    await ensureTables(DB)

    // 품절(stock=0) 된 상품의 dedup 행 정리 → 나중에 재입고되면 다시 통지 대상이 됨.
    await DB.prepare(`
      DELETE FROM wishlist_stock_notifications
      WHERE product_id IN (
        SELECT id FROM products WHERE COALESCE(stock, stock_quantity, 0) = 0
      )
    `).run().catch(() => { /* best-effort */ })

    const { results } = await DB.prepare(`
      SELECT w.user_id AS user_id, w.product_id AS product_id, p.name AS product_name, p.category AS category
      FROM wishlists w
      JOIN products p ON p.id = w.product_id
      LEFT JOIN wishlist_stock_notifications n
             ON n.user_id = w.user_id AND n.product_id = w.product_id
      WHERE COALESCE(p.is_active, 1) = 1
        AND COALESCE(p.stock, p.stock_quantity, 0) > 0
        AND n.product_id IS NULL
      ORDER BY w.created_at ASC
      LIMIT ?
    `).bind(BATCH_CAP).all<RestockRow>().catch(() => ({ results: [] as RestockRow[] }))

    for (const row of (results ?? [])) {
      if (row.user_id == null) continue
      // 멱등 claim — 행이 없을 때만 INSERT(=이번 주기 통지 권리 확보). 동시 cron/중복 통지 차단.
      const claim = await DB.prepare(
        "INSERT OR IGNORE INTO wishlist_stock_notifications (user_id, product_id, notified_at) VALUES (?, ?, datetime('now'))"
      ).bind(String(row.user_id), row.product_id).run().catch(() => null)
      if ((claim?.meta?.changes ?? 0) === 0) continue // 이미 통지됨/다른 주기가 처리

      const name = row.product_name || '찜한 상품'
      const link = productLink(row.product_id, row.category)
      await notifyUser(DB, String(row.user_id), 'wishlist_restock', '🔔 찜한 상품 재입고!', `${name} 이(가) 다시 입고됐어요. 품절 전에 확인하세요!`, link).catch(() => {})
      await sendSystemPush(env, 'user', row.user_id, { title: '🔔 찜한 상품 재입고!', body: `${name} 이(가) 다시 입고됐어요`, url: link }).catch(() => {})
      notified++
    }

    if (notified > 0) logInfo('[Cron] wishlist-restock-notify', { notified })
    return { notified }
  } catch (err) {
    logError('[Cron] wishlist-restock-notify failed', { error: String(err) })
    return { notified }
  }
}

interface PriceRow { user_id: string; product_id: number; product_name: string | null; price: number | null; category: string | null; last_price: number | null }

/** 가격 인하 알림: 찜한 상품 가격이 직전 관측/통지가보다 내려가면 통지. 첫 관측은 baseline 만 기록(무통지). */
export async function handleWishlistPriceDropNotify(env: Env): Promise<{ notified: number }> {
  const DB = env.DB
  let notified = 0
  try {
    await ensureTables(DB)

    const { results } = await DB.prepare(`
      SELECT w.user_id AS user_id, w.product_id AS product_id, p.name AS product_name,
             p.price AS price, p.category AS category, n.last_price AS last_price
      FROM wishlists w
      JOIN products p ON p.id = w.product_id
      LEFT JOIN wishlist_price_notifications n
             ON n.user_id = w.user_id AND n.product_id = w.product_id
      WHERE COALESCE(p.is_active, 1) = 1
        AND p.price IS NOT NULL AND p.price > 0
        AND (n.last_price IS NULL OR p.price < n.last_price)
      ORDER BY w.created_at ASC
      LIMIT ?
    `).bind(BATCH_CAP).all<PriceRow>().catch(() => ({ results: [] as PriceRow[] }))

    for (const row of (results ?? [])) {
      if (row.user_id == null || row.price == null) continue
      const price = Number(row.price)

      if (row.last_price == null) {
        // 첫 관측 — baseline 기록만(통지 X). 이후 이 값보다 내려가면 통지.
        await DB.prepare(
          "INSERT OR IGNORE INTO wishlist_price_notifications (user_id, product_id, last_price) VALUES (?, ?, ?)"
        ).bind(String(row.user_id), row.product_id, price).run().catch(() => {})
        continue
      }

      // 인하 claim — 아직 last_price 가 현재가보다 높을 때만 원자적으로 낮춰 통지 권리 확보.
      const claim = await DB.prepare(
        "UPDATE wishlist_price_notifications SET last_price = ?, notified_at = datetime('now') WHERE user_id = ? AND product_id = ? AND last_price > ?"
      ).bind(price, String(row.user_id), row.product_id, price).run().catch(() => null)
      if ((claim?.meta?.changes ?? 0) === 0) continue // 다른 주기가 이미 통지/갱신

      const name = row.product_name || '찜한 상품'
      const link = productLink(row.product_id, row.category)
      const priceStr = price.toLocaleString('ko-KR')
      await notifyUser(DB, String(row.user_id), 'wishlist_price_drop', '💸 찜한 상품 가격 인하!', `${name} 이(가) ${priceStr}원으로 내려갔어요`, link).catch(() => {})
      await sendSystemPush(env, 'user', row.user_id, { title: '💸 찜한 상품 가격 인하!', body: `${name} ${priceStr}원`, url: link }).catch(() => {})
      notified++
    }

    if (notified > 0) logInfo('[Cron] wishlist-price-drop-notify', { notified })
    return { notified }
  } catch (err) {
    logError('[Cron] wishlist-price-drop-notify failed', { error: String(err) })
    return { notified }
  }
}
