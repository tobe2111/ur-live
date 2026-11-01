/**
 * 🎁 무상 체험 제공 — 테이블 · 신청권 원장 · 패널티 (2026-10-31)
 *
 * 머니 규칙(CLAUDE.md 💸):
 *  ① 신청 상태 CAS 가 먼저(claim) — 그 다음에만 신청권을 움직인다.
 *  ② 모든 신청권 증감은 원장(`seeding_pass_tx`)에 한 줄. `(kind, ref)` UNIQUE 가 멱등 키다
 *     (grant:signup:<user> · charge:pay:<paymentKey> · spend:app:<id> · refund:app:<id>).
 *  ③ 원장 줄을 먼저 넣고(`INSERT OR IGNORE`) 들어갔을 때만 잔액을 움직인다.
 *  ④ 무료(가입 혜택)와 유료는 칸이 다르다 — 쓸 때 무료부터, 반환은 쓴 칸으로.
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  DEFAULT_FREE_PASSES, PENALTY_WINDOW_DAYS, SLOT_COUNTED_STATUSES, normalizeOffer, penaltyBlockDays,
  sqlIn, type SeedingOffer,
} from '../../../shared/seeding'
import { approvedSellerProductSql, consumerVisibleProductSql } from '../../../shared/db/consumer-visible-product'

export const SEEDING_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS seeding_offers (
    product_id INTEGER PRIMARY KEY,
    seller_id INTEGER,
    enabled INTEGER NOT NULL DEFAULT 0,
    slots_per_month INTEGER NOT NULL DEFAULT 5,
    platforms TEXT NOT NULL DEFAULT 'instagram',
    min_followers INTEGER NOT NULL DEFAULT 0,
    post_requirement TEXT,
    post_deadline_days INTEGER NOT NULL DEFAULT 7,
    offer_note TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS user_sns_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    external_id TEXT NOT NULL,
    username TEXT,
    display_name TEXT,
    profile_url TEXT,
    follower_count INTEGER,
    account_type TEXT,
    access_token_enc TEXT,
    refresh_token_enc TEXT,
    token_expires_at DATETIME,
    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sns_links_user_platform ON user_sns_links(user_id, platform)`,
  // 한 SNS 계정은 한 유어딜 계정에만 — 남의 인스타로 팔로워를 빌려 신청하는 것을 막는다.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sns_links_external ON user_sns_links(platform, external_id)`,
  `CREATE TABLE IF NOT EXISTS seeding_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    seller_id INTEGER,
    user_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    sns_username TEXT,
    follower_count INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    visit_slots TEXT,
    visit_at TEXT,
    voucher_id INTEGER,
    pass_bucket TEXT,
    post_deadline TEXT,
    post_url TEXT,
    admin_note TEXT,
    reminded_at DATETIME,
    month_key TEXT NOT NULL,
    sent_at DATETIME,
    decided_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_seeding_app_product_month ON seeding_applications(product_id, month_key, status)`,
  `CREATE INDEX IF NOT EXISTS idx_seeding_app_user ON seeding_applications(user_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_seeding_app_seller ON seeding_applications(seller_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_seeding_app_status ON seeding_applications(status, created_at)`,
  `CREATE TABLE IF NOT EXISTS seeding_pass_balance (
    user_id INTEGER PRIMARY KEY,
    free_left INTEGER NOT NULL DEFAULT 0,
    paid_left INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS seeding_pass_tx (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    bucket TEXT NOT NULL,
    amount INTEGER NOT NULL,
    price_paid INTEGER NOT NULL DEFAULT 0,
    ref TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_seeding_pass_tx_kind_ref ON seeding_pass_tx(kind, ref)`,
  `CREATE TABLE IF NOT EXISTS seeding_penalties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    application_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  // 한 신청에 패널티는 한 번 — cron 이 두 번 돌아도 경고가 두 개 쌓이지 않는다.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_seeding_penalty_app ON seeding_penalties(application_id)`,
  `CREATE INDEX IF NOT EXISTS idx_seeding_penalty_user ON seeding_penalties(user_id, created_at)`,
]

const _done = new WeakSet<object>()
export async function ensureSeedingTables(DB: D1Database): Promise<void> {
  if (_done.has(DB)) return
  _done.add(DB)
  for (const s of SEEDING_TABLES_SQL) {
    try { await DB.prepare(s).run() } catch { /* exists */ }
  }
}

export async function setting(DB: D1Database, key: string): Promise<string | null> {
  const r = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`).bind(key).first<{ value: string }>().catch(() => null)
  return r?.value ?? null
}

/** 이번 달(KST) 키 — 모집 인원은 달력 기준으로 센다. */
export function monthKeyKst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 7)
}

// ── 제공 설정 ──────────────────────────────────────────────────────

interface OfferRow {
  enabled: number; slots_per_month: number; platforms: string; min_followers: number
  post_requirement: string | null; post_deadline_days: number; offer_note: string | null; seller_id: number | null
}

export async function loadOffer(DB: D1Database, productId: number): Promise<(SeedingOffer & { seller_id: number | null }) | null> {
  const r = await DB.prepare(
    `SELECT enabled, slots_per_month, platforms, min_followers, post_requirement, post_deadline_days, offer_note, seller_id
     FROM seeding_offers WHERE product_id = ?`,
  ).bind(productId).first<OfferRow>().catch(() => null)
  if (!r) return null
  return {
    ...normalizeOffer({ ...r, platforms: String(r.platforms || '').split(',') }),
    seller_id: r.seller_id,
  }
}

export async function saveOffer(DB: D1Database, productId: number, sellerId: number | null, offer: SeedingOffer): Promise<void> {
  await DB.prepare(
    `INSERT INTO seeding_offers (product_id, seller_id, enabled, slots_per_month, platforms, min_followers, post_requirement, post_deadline_days, offer_note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(product_id) DO UPDATE SET seller_id = excluded.seller_id, enabled = excluded.enabled,
       slots_per_month = excluded.slots_per_month, platforms = excluded.platforms, min_followers = excluded.min_followers,
       post_requirement = excluded.post_requirement, post_deadline_days = excluded.post_deadline_days,
       offer_note = excluded.offer_note, updated_at = datetime('now')`,
  ).bind(
    productId, sellerId, offer.enabled ? 1 : 0, offer.slots_per_month, offer.platforms.join(','), offer.min_followers,
    offer.post_requirement, offer.post_deadline_days, offer.offer_note || null,
  ).run()
}

/**
 * 🔎 **지금 신청할 수 있는 체험 목록** — 모집 깔때기의 빠진 조각 (2026-11-01)
 *
 * 왜 필요했나: 2026-10-31 에 신청·승인·신청권까지 다 만들었는데 **인플루언서가 "무엇을 신청할 수 있는지"
 * 볼 곳이 없었다.** 상세(`/pass/:id`)의 [이 이용권 팔아보기] 에서만 신청되므로, 그 상세 주소를 이미
 * 아는 사람만 신청할 수 있었다 — `/my-seeding` 의 빈 상태 문구가 *"이용권 상세의 … 에서 신청할 수
 * 있어요"* 라고 말하면서 **링크를 못 주고 있었던** 것이 그 증거다.
 *
 * ## 규율
 * - 소비자에게 **보여도 되는 상품**만 — 도매 원본 제외(`consumerVisibleProductSql`) · 승인된 매장만
 *   (`approvedSellerProductSql`). 둘 다 SSOT 를 지난다(손으로 베끼면 메인 피드와 갈린다).
 * - **자리가 남은 것만**(이번 달 모집 인원 − 세는 상태 수). 자리가 0 이면 목록에서 빠진다 —
 *   신청 버튼을 눌렀을 때 거절되는 쪽이 더 나쁘다.
 * - 자격(팔로워·패널티·중복)은 **여기서 판정하지 않는다** — 그건 상세의 `checkEligibility` 가 한다.
 *   이 목록은 로그인 없이도 보이고(모집 메일의 착지), 판정은 한 곳에만 둔다.
 * - 상세 주소는 응답에 **담지 않는다**. `category`·`deal_only` 를 그대로 주고 화면이 `detailHref`
 *   SSOT 로 만든다 — 주소 규칙이 두 벌이 되면 같은 상품이 두 URL 로 갈린다.
 */
export interface OpenOfferRow {
  product_id: number; name: string; image_url: string | null; price: number; original_price: number | null
  category: string | null; deal_only: number | null; restaurant_name: string | null; restaurant_address: string | null
  platforms: string[]; min_followers: number; slots_left: number; post_requirement: string; post_deadline_days: number
}

export async function listOpenOffers(DB: D1Database, limit = 40): Promise<OpenOfferRow[]> {
  const lim = Math.max(1, Math.min(60, Math.floor(Number(limit) || 40)))
  const r = await DB.prepare(
    `SELECT o.product_id, o.platforms, o.min_followers, o.slots_per_month, o.post_requirement, o.post_deadline_days,
            p.name, p.image_url, p.price, p.original_price, p.category, p.deal_only,
            p.restaurant_name, p.restaurant_address,
            (SELECT COUNT(*) FROM seeding_applications a
              WHERE a.product_id = o.product_id AND a.month_key = ?
                AND a.status IN ${sqlIn(SLOT_COUNTED_STATUSES)}) AS used
       FROM seeding_offers o
       JOIN products p ON p.id = o.product_id
      WHERE o.enabled = 1
        AND COALESCE(p.is_active, 0) = 1
        AND ${consumerVisibleProductSql('p')}
        AND ${approvedSellerProductSql('p')}
      ORDER BY used ASC, COALESCE(p.sold_count, 0) DESC, p.id DESC
      LIMIT ?`,
  ).bind(monthKeyKst(), lim).all<Record<string, unknown>>().catch(() => null)

  return (r?.results ?? []).flatMap((row) => {
    const offer = normalizeOffer({ ...row, platforms: String(row.platforms || '').split(',') })
    const left = offer.slots_per_month - (Number(row.used) || 0)
    if (!(left > 0)) return []
    return [{
      product_id: Number(row.product_id),
      name: String(row.name ?? ''),
      image_url: (row.image_url as string | null) ?? null,
      price: Number(row.price) || 0,
      original_price: row.original_price == null ? null : Number(row.original_price) || null,
      category: (row.category as string | null) ?? null,
      deal_only: row.deal_only == null ? null : Number(row.deal_only),
      restaurant_name: (row.restaurant_name as string | null) ?? null,
      restaurant_address: (row.restaurant_address as string | null) ?? null,
      platforms: offer.platforms,
      min_followers: offer.min_followers,
      slots_left: left,
      post_requirement: offer.post_requirement,
      post_deadline_days: offer.post_deadline_days,
    }]
  })
}

// ── 신청권 ────────────────────────────────────────────────────────

export interface PassBalance { free_left: number; paid_left: number; total: number }

export async function passBalance(DB: D1Database, userId: number): Promise<PassBalance> {
  const r = await DB.prepare(`SELECT free_left, paid_left FROM seeding_pass_balance WHERE user_id = ?`)
    .bind(userId).first<{ free_left: number; paid_left: number }>().catch(() => null)
  const free = Number(r?.free_left) || 0
  const paid = Number(r?.paid_left) || 0
  return { free_left: free, paid_left: paid, total: free + paid }
}

/** 원장 줄 먼저 → 들어갔을 때만 그 칸을 올린다(claim-before-credit). */
async function addPasses(
  DB: D1Database, userId: number, kind: 'grant' | 'charge' | 'refund', bucket: 'free' | 'paid',
  amount: number, ref: string, pricePaid = 0, note = '',
): Promise<boolean> {
  if (!(amount > 0)) return false
  const col = bucket === 'free' ? 'free_left' : 'paid_left'
  const [ins] = await DB.batch([
    DB.prepare(`INSERT OR IGNORE INTO seeding_pass_tx (user_id, kind, bucket, amount, price_paid, ref, note) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(userId, kind, bucket, amount, pricePaid, ref, note),
    DB.prepare(
      `INSERT INTO seeding_pass_balance (user_id, ${col}, updated_at)
       SELECT ?, ?, datetime('now') WHERE changes() > 0
       ON CONFLICT(user_id) DO UPDATE SET ${col} = ${col} + excluded.${col}, updated_at = datetime('now')`,
    ).bind(userId, amount),
  ])
  return !!ins?.meta?.changes
}

/** 가입 혜택(첫 N회 무료) — 사람마다 평생 한 번. */
export async function grantSignupPasses(DB: D1Database, userId: number): Promise<void> {
  // ⚠️ 설정이 없으면(null) 기본값 — `Number(null)` 은 0 이라 그대로 쓰면 무료 3회가 0회가 된다(시험이 잡았다).
  const v = await setting(DB, 'seeding_free_passes')
  const raw = v === null || v.trim() === '' ? NaN : Number(v)
  const n = Number.isFinite(raw) && raw >= 0 && raw <= 20 ? Math.floor(raw) : DEFAULT_FREE_PASSES
  if (n > 0) await addPasses(DB, userId, 'grant', 'free', n, `signup:${userId}`, 0, `가입 혜택 ${n}회 무료`).catch(() => false)
}

export async function chargePasses(DB: D1Database, userId: number, passes: number, paymentKey: string, price: number, note: string): Promise<boolean> {
  return addPasses(DB, userId, 'charge', 'paid', passes, `pay:${paymentKey}`, price, note)
}

/**
 * 신청권 1장 사용 — 무료 칸부터. 호출부가 신청 상태 CAS 를 **먼저** 잡은 뒤에만 부른다.
 * @returns 쓴 칸, 잔액이 없으면 null
 */
export async function spendPass(DB: D1Database, userId: number, applicationId: number): Promise<'free' | 'paid' | null> {
  const ref = `app:${applicationId}`
  const prior = await DB.prepare(`SELECT bucket FROM seeding_pass_tx WHERE kind = 'spend' AND ref = ?`).bind(ref).first<{ bucket: string }>()
  if (prior) return prior.bucket === 'paid' ? 'paid' : 'free'
  for (const bucket of ['free', 'paid'] as const) {
    const col = bucket === 'free' ? 'free_left' : 'paid_left'
    const dec = await DB.prepare(`UPDATE seeding_pass_balance SET ${col} = ${col} - 1, updated_at = datetime('now') WHERE user_id = ? AND ${col} > 0`)
      .bind(userId).run()
    if (!dec.meta?.changes) continue
    const ins = await DB.prepare(`INSERT OR IGNORE INTO seeding_pass_tx (user_id, kind, bucket, amount, ref, note) VALUES (?, 'spend', ?, -1, ?, '노쇼 방지 보증금')`)
      .bind(userId, bucket, ref).run()
    if (!ins.meta?.changes) {
      // 동시에 다른 요청이 먼저 썼다 — 방금 뺀 1장을 되돌린다.
      await DB.prepare(`UPDATE seeding_pass_balance SET ${col} = ${col} + 1 WHERE user_id = ?`).bind(userId).run()
      const again = await DB.prepare(`SELECT bucket FROM seeding_pass_tx WHERE kind = 'spend' AND ref = ?`).bind(ref).first<{ bucket: string }>()
      return again?.bucket === 'paid' ? 'paid' : 'free'
    }
    return bucket
  }
  return null
}

/** 보증금 반환 — 쓴 칸으로 1장. 같은 신청은 한 번만. */
export async function refundPass(DB: D1Database, userId: number, applicationId: number, note: string): Promise<boolean> {
  const spent = await DB.prepare(`SELECT bucket FROM seeding_pass_tx WHERE kind = 'spend' AND ref = ?`)
    .bind(`app:${applicationId}`).first<{ bucket: string }>().catch(() => null)
  if (!spent) return false
  return addPasses(DB, userId, 'refund', spent.bucket === 'paid' ? 'paid' : 'free', 1, `app:${applicationId}`, 0, note)
}

export async function passHistory(DB: D1Database, userId: number) {
  const r = await DB.prepare(`SELECT kind, bucket, amount, price_paid, note, created_at FROM seeding_pass_tx WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
    .bind(userId).all().catch(() => ({ results: [] }))
  return r.results ?? []
}

// ── 패널티 ────────────────────────────────────────────────────────

export interface PenaltyState { strikes: number; blocked_until: string | null }

export async function penaltyState(DB: D1Database, userId: number): Promise<PenaltyState> {
  const rows = await DB.prepare(
    `SELECT created_at FROM seeding_penalties WHERE user_id = ? AND created_at > datetime('now', ?) ORDER BY created_at ASC`,
  ).bind(userId, `-${PENALTY_WINDOW_DAYS} days`).all<{ created_at: string }>().catch(() => ({ results: [] as { created_at: string }[] }))
  const list = rows.results ?? []
  const strikes = list.length
  const days = penaltyBlockDays(strikes)
  if (!days || !list.length) return { strikes, blocked_until: null }
  const last = Date.parse(list[list.length - 1].created_at.replace(' ', 'T') + 'Z')
  const until = new Date(last + days * 86400_000).toISOString().replace('T', ' ').slice(0, 19)
  return { strikes, blocked_until: until }
}

/** 패널티 1회 — 같은 신청은 한 번만(UNIQUE). @returns 새로 기록됐는가 */
export async function addPenalty(DB: D1Database, userId: number, applicationId: number, reason: string): Promise<boolean> {
  const r = await DB.prepare(`INSERT OR IGNORE INTO seeding_penalties (user_id, application_id, reason) VALUES (?, ?, ?)`)
    .bind(userId, applicationId, reason).run().catch(() => null)
  return !!r?.meta?.changes
}

/** 상태 CAS — 기대 상태에서만 옮긴다. @returns 옮겼는가 */
export async function transition(
  DB: D1Database, id: number, from: readonly string[], to: string, extra: Record<string, unknown> = {},
): Promise<boolean> {
  const keys = Object.keys(extra)
  const set = keys.map((k) => `${k} = ?`).join(', ')
  const sql = `UPDATE seeding_applications SET status = ?, ${set ? set + ', ' : ''}updated_at = datetime('now')
    WHERE id = ? AND status IN (${from.map(() => '?').join(',')})` // d1-bind-ok: from 은 코드가 넘기는 상태 목록(최대 5개) — 사용자 입력 길이가 아니다
  const r = await DB.prepare(sql).bind(to, ...keys.map((k) => extra[k]), id, ...from).run()
  return !!r.meta?.changes
}

// ── 구매 취소(청약철회 — 산 지 7일 안, 그 묶음만큼 안 쓴 경우) ─────────────────

/** 전자상거래법 청약철회 기간. 이 안에서, 그 묶음의 장수가 아직 유료 칸에 남아 있으면 취소할 수 있다. */
export const PURCHASE_CANCEL_DAYS = 7

export interface RefundablePurchase { payment_key: string; passes: number; price_paid: number; created_at: string; refundable: boolean; reason: string | null }

export async function listPurchases(DB: D1Database, userId: number): Promise<RefundablePurchase[]> {
  const rows = await DB.prepare(
    `SELECT t.ref, t.amount, t.price_paid, t.created_at,
            (t.created_at > datetime('now', ?)) AS in_window,
            EXISTS (SELECT 1 FROM seeding_pass_tx c WHERE c.kind = 'cancel' AND c.ref = t.ref) AS cancelled
     FROM seeding_pass_tx t WHERE t.user_id = ? AND t.kind = 'charge' ORDER BY t.id DESC LIMIT 20`,
  ).bind(`-${PURCHASE_CANCEL_DAYS} days`, userId)
    .all<{ ref: string; amount: number; price_paid: number; created_at: string; in_window: number; cancelled: number }>()
    .catch(() => ({ results: [] as { ref: string; amount: number; price_paid: number; created_at: string; in_window: number; cancelled: number }[] }))
  const bal = await passBalance(DB, userId)
  return (rows.results ?? []).map((r) => {
    const reason = r.cancelled ? '취소됨' : !r.in_window ? `구매 후 ${PURCHASE_CANCEL_DAYS}일이 지났어요` : bal.paid_left < r.amount ? '이 묶음의 신청권을 이미 썼어요' : null
    return { payment_key: r.ref.replace(/^pay:/, ''), passes: r.amount, price_paid: r.price_paid, created_at: r.created_at, refundable: !reason, reason }
  })
}

/**
 * 구매 취소 선점 — 원장에 cancel 줄을 먼저 넣고(같은 결제는 한 번만), 유료 칸에서 그 장수를 CAS 로 뺀다.
 * 토스 취소가 실패하면 호출부가 `revertPurchaseCancel` 로 되돌린다.
 * @returns 'ok' | 'not_found' | 'done' | 'expired' | 'spent'
 */
export async function claimPurchaseCancel(DB: D1Database, userId: number, paymentKey: string): Promise<{ status: 'ok' | 'not_found' | 'done' | 'expired' | 'spent'; passes?: number; price?: number }> {
  const ref = `pay:${paymentKey}`
  const buy = await DB.prepare(
    `SELECT amount, price_paid, (created_at > datetime('now', ?)) AS in_window FROM seeding_pass_tx WHERE user_id = ? AND kind = 'charge' AND ref = ?`,
  ).bind(`-${PURCHASE_CANCEL_DAYS} days`, userId, ref).first<{ amount: number; price_paid: number; in_window: number }>()
  if (!buy) return { status: 'not_found' }
  if (!buy.in_window) return { status: 'expired' }
  const ins = await DB.prepare(
    `INSERT OR IGNORE INTO seeding_pass_tx (user_id, kind, bucket, amount, price_paid, ref, note) VALUES (?, 'cancel', 'paid', ?, ?, ?, '구매 취소(청약철회)')`,
  ).bind(userId, -buy.amount, -buy.price_paid, ref).run()
  if (!ins.meta?.changes) return { status: 'done' }
  const dec = await DB.prepare(
    `UPDATE seeding_pass_balance SET paid_left = paid_left - ?, updated_at = datetime('now') WHERE user_id = ? AND paid_left >= ?`,
  ).bind(buy.amount, userId, buy.amount).run()
  if (!dec.meta?.changes) {
    await DB.prepare(`DELETE FROM seeding_pass_tx WHERE kind = 'cancel' AND ref = ?`).bind(ref).run()
    return { status: 'spent' }
  }
  return { status: 'ok', passes: buy.amount, price: buy.price_paid }
}

/** 토스 취소가 실패했을 때 선점을 되돌린다(잔액 복구 + cancel 줄 삭제). */
export async function revertPurchaseCancel(DB: D1Database, userId: number, paymentKey: string, passes: number): Promise<void> {
  const ref = `pay:${paymentKey}`
  const del = await DB.prepare(`DELETE FROM seeding_pass_tx WHERE kind = 'cancel' AND ref = ?`).bind(ref).run()
  if (del.meta?.changes) {
    await DB.prepare(`UPDATE seeding_pass_balance SET paid_left = paid_left + ? WHERE user_id = ?`).bind(passes, userId).run()
  }
}
