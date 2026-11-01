/**
 * 🏠 생활 견적 — 테이블 · 참여권 원장 · 사장님 매칭 (2026-10-24)
 *
 * 결재: `docs/decisions/2026-10-24-home-service-quotes.md`. 규칙 SSOT: `src/shared/home-service.ts`.
 *
 * 💸 참여권은 돈이다(카드로 충전한다). 그래서 머니 룰 그대로:
 *  ① 잔액 변경은 원자 증감(`balance = balance ± 1`)과 CAS(`WHERE balance >= 1`)로만 — 절대값 쓰기 금지.
 *  ② 모든 증감은 원장(`home_service_credit_tx`)에 한 줄 — 그 줄의 UNIQUE 가 멱등 키다
 *     (같은 결제·같은 견적의 반환이 두 번 들어와도 잔액은 한 번만 움직인다).
 *  ③ 원장 줄을 **먼저** 넣고(`INSERT OR IGNORE`) 들어갔을 때만 잔액을 움직인다(claim-before-credit).
 */

import { newShareToken } from '../../../shared/home-service-share'
import { maskReviewer, readReviewPhotos } from '../../../shared/home-service-review'
import { CREDIT_COST_KEY, HOME_PARTNERS_KEY, PRO_OPEN_STATUS_SQL, parseCreditCosts, parsePartners, type HomeServiceCategory } from '../../../shared/home-service'

export const HS_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS home_service_pros (
    seller_id INTEGER PRIMARY KEY,
    phone TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS home_service_pro_categories (
    seller_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    PRIMARY KEY (seller_id, category)
  )`,
  `CREATE TABLE IF NOT EXISTS home_service_pro_areas (
    seller_id INTEGER NOT NULL,
    sido TEXT NOT NULL,
    sigungu TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (seller_id, sido, sigungu)
  )`,
  `CREATE TABLE IF NOT EXISTS home_service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    details TEXT NOT NULL,
    summary TEXT NOT NULL,
    sido TEXT NOT NULL,
    sigungu TEXT NOT NULL,
    sido2 TEXT,
    sigungu2 TEXT,
    desired_date TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    quote_count INTEGER NOT NULL DEFAULT 0,
    max_quotes INTEGER NOT NULL DEFAULT 5,
    chosen_quote_id INTEGER,
    customer_viewed_at DATETIME,
    first_quote_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS home_service_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    price INTEGER,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS home_service_dispatch (
    request_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (request_id, seller_id)
  )`,
  `CREATE TABLE IF NOT EXISTS home_service_credit_balance (
    seller_id INTEGER PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS home_service_credit_tx (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    price_paid INTEGER NOT NULL DEFAULT 0,
    ref TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  // 🔑 멱등 키 — 같은 (종류, 참조)는 원장에 한 번만 들어간다.
  //   charge:pay:<paymentKey> · grant:signup:<seller> · spend:quote:<req>:<seller> · refund:quote:<id>
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_credit_tx_kind_ref ON home_service_credit_tx(kind, ref)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_quotes_req_seller ON home_service_quotes(request_id, seller_id)`,
  `CREATE INDEX IF NOT EXISTS idx_hs_requests_user ON home_service_requests(user_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_hs_requests_open ON home_service_requests(status, category, sido)`,
  `CREATE INDEX IF NOT EXISTS idx_hs_pro_areas_match ON home_service_pro_areas(sido, sigungu)`,
  // 🧾 운영팀 대리 접수(2026-10-24 대표 — 영업으로 찾은 **실제 손님**의 요청을 운영팀이 대신 올린다).
  //   source = 'customer'(손님이 직접) | 'admin'(운영팀 대리). 손님 동의를 받았다는 기록이 consent_note.
  `ALTER TABLE home_service_requests ADD COLUMN source TEXT NOT NULL DEFAULT 'customer'`,
  `ALTER TABLE home_service_requests ADD COLUMN created_by_admin INTEGER`,
  `ALTER TABLE home_service_requests ADD COLUMN consent_note TEXT`,
  // 🏠 유어딜 직영 견적(2026-10-24 대표) — 유어딜(또는 협력 업체)이 다른 사장님처럼 견적을 낸다.
  //   손님 화면에 "유어딜 직영" 으로 표시하고, 참여권을 쓰지 않으며 반환도 없다.
  `ALTER TABLE home_service_quotes ADD COLUMN is_house INTEGER NOT NULL DEFAULT 0`,
  // 🔒 상세 주소(2026-10-25 대표 — 오늘의집 흐름). 사장님은 손님이 **고른 뒤에만** 본다(연락처와 같은 규칙).
  `ALTER TABLE home_service_requests ADD COLUMN private_details TEXT`,
  // 🤝 제휴 업체 견적(2026-10-25 대표 — 간판 제휴사). is_house=1 과 같이 참여권을 안 쓰고 반환도 없다.
  //   손님 화면 표시만 "유어딜 제휴" 로 가른다.
  `ALTER TABLE home_service_quotes ADD COLUMN partner INTEGER NOT NULL DEFAULT 0`,
  // 🎟️ 이 견적에 쓴 참여권 장수(2026-10-25). 반환은 **쓴 만큼** 돌려준다 — 카테고리 장수가 나중에 바뀌어도.
  `ALTER TABLE home_service_quotes ADD COLUMN credits INTEGER NOT NULL DEFAULT 1`,
  // 🔗 공유 페이지 토큰(2026-10-25 대표 — 커뮤니티에 요청을 올려 업체를 데려온다). 번호(id)는 추측되므로 따로 둔다.
  `ALTER TABLE home_service_requests ADD COLUMN share_token TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_requests_share ON home_service_requests(share_token) WHERE share_token IS NOT NULL`,
  // 공유 링크로 들어온 업체 — 지역이 달라도 **그 카테고리를 하는 업체면** 이 요청을 보고 견적을 낼 수 있다.
  `CREATE TABLE IF NOT EXISTS home_service_share_access (
    request_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (request_id, seller_id)
  )`,
  // 📝 업체 소개 · 다른 곳 후기 링크(2026-10-26 대표 — 숨고·미소 링크). 규칙 SSOT `shared/home-service-review.ts`.
  `ALTER TABLE home_service_pros ADD COLUMN intro TEXT`,
  `ALTER TABLE home_service_pros ADD COLUMN links TEXT`,
  // ⭐ 유어딜 후기 — 손님이 **고른 업체**에만, 요청 하나에 한 번(request_id UNIQUE).
  `CREATE TABLE IF NOT EXISTS home_service_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    quote_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    body TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_hs_reviews_request ON home_service_reviews(request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_hs_reviews_seller ON home_service_reviews(seller_id, hidden, id)`,
  `ALTER TABLE home_service_reviews ADD COLUMN photos TEXT`,
  // 💬 고르기 전 질문(2026-10-26) — 견적 하나에 손님 ↔ 사장님. 규칙 SSOT `shared/home-service-chat.ts`.
  `CREATE TABLE IF NOT EXISTS home_service_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_hs_messages_quote ON home_service_messages(quote_id, id)`,
  // 후기 부탁 알림을 한 번만 보내려고.
  `ALTER TABLE home_service_requests ADD COLUMN review_asked_at DATETIME`,
] as const

export type ReviewItem = { rating: number; body: string; reviewer: string; created_at: string; photos: string[] }
/** 업체별 후기 요약 — 평균·개수·최근 몇 개(숨긴 것 제외). */
export async function reviewSummaries(
  DB: D1Database, sellerIds: number[], recent: number,
): Promise<Record<number, { avg: number | null; count: number; recent: ReviewItem[] }>> {
  const out: Record<number, { avg: number | null; count: number; recent: ReviewItem[] }> = {}
  const ids = [...new Set(sellerIds.filter((n) => n > 0))]
  if (!ids.length) return out
  const ph = ids.map(() => '?').join(',')
  for (const id of ids) out[id] = { avg: null, count: 0, recent: [] }
  const [agg, rows] = await Promise.all([
    DB.prepare(`SELECT seller_id, AVG(rating) AS avg, COUNT(*) AS n FROM home_service_reviews WHERE hidden = 0 AND seller_id IN (${ph}) GROUP BY seller_id`)
      .bind(...ids).all<{ seller_id: number; avg: number; n: number }>(),
    recent > 0
      ? DB.prepare(
        `SELECT seller_id, rating, body, created_at, reviewer, photos FROM (
           SELECT r.seller_id, r.rating, r.body, r.created_at, r.photos, u.name AS reviewer,
                  ROW_NUMBER() OVER (PARTITION BY r.seller_id ORDER BY r.id DESC) AS rn
             FROM home_service_reviews r LEFT JOIN users u ON u.id = r.user_id
            WHERE r.hidden = 0 AND r.seller_id IN (${ph})
         ) WHERE rn <= ?`,
      ).bind(...ids, recent).all<{ seller_id: number; rating: number; body: string; created_at: string; reviewer: string | null; photos: string | null }>()
      : Promise.resolve({ results: [] as { seller_id: number; rating: number; body: string; created_at: string; reviewer: string | null; photos: string | null }[] }),
  ])
  for (const a of agg.results ?? []) out[Number(a.seller_id)] = { ...out[Number(a.seller_id)], avg: Number(a.avg), count: Number(a.n) }
  for (const r of rows.results ?? []) {
    out[Number(r.seller_id)]?.recent.push({ rating: Number(r.rating), body: r.body, reviewer: maskReviewer(r.reviewer), created_at: r.created_at, photos: readReviewPhotos(r.photos) })
  }
  return out
}

/**
 * 요청의 공유 토큰 — 없으면 만든다(옛 요청·운영팀 대리 접수도 링크를 낼 수 있게).
 * 두 곳이 동시에 만들면 `share_token IS NULL` 조건이 하나만 통과시키고, 둘 다 다시 읽어 같은 값을 쓴다.
 */
export async function ensureShareToken(DB: D1Database, requestId: number): Promise<string | null> {
  const cur = await DB.prepare(`SELECT share_token FROM home_service_requests WHERE id = ?`).bind(requestId)
    .first<{ share_token: string | null }>()
  if (!cur) return null
  if (cur.share_token) return cur.share_token
  await DB.prepare(`UPDATE home_service_requests SET share_token = ? WHERE id = ? AND share_token IS NULL`)
    .bind(newShareToken(), requestId).run()
  const again = await DB.prepare(`SELECT share_token FROM home_service_requests WHERE id = ?`).bind(requestId)
    .first<{ share_token: string | null }>()
  return again?.share_token ?? null
}

/** 카테고리별 참여권 장수(어드민 값). 못 읽으면 빈 표 — 모두 1장. */
export async function loadCreditCosts(DB: D1Database): Promise<Partial<Record<HomeServiceCategory, number>>> {
  const r = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`).bind(CREDIT_COST_KEY)
    .first<{ value: string }>().catch(() => null)
  return parseCreditCosts(r?.value)
}

/**
 * 카테고리별 견적을 받을 수 있는 업체 수(정지·반려가 아닌 · 켜 둔 업체 + 제휴 업체). 생활 페이지가 0 이면
 * "업체 모집 중" 을 보여 준다 — 답이 없을 요청을 아무 말 없이 받지 않으려고.
 */
export async function proCountsByCategory(DB: D1Database): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const { results } = await DB.prepare(
    `SELECT c.category AS category, COUNT(DISTINCT c.seller_id) AS n
       FROM home_service_pro_categories c
       JOIN home_service_pros p ON p.seller_id = c.seller_id AND p.active = 1
       JOIN sellers s ON s.id = c.seller_id AND s.status IN ${PRO_OPEN_STATUS_SQL}
      GROUP BY c.category`,
  ).all<{ category: string; n: number }>()
  for (const r of results ?? []) out[r.category] = Number(r.n)
  for (const cat of Object.keys(await loadPartners(DB))) out[cat] = Math.max(out[cat] ?? 0, 1)
  return out
}

/** 제휴 업체 표(카테고리 → 매장 번호). 못 읽으면 빈 표 — 제휴가 없는 것과 같다. */
export async function loadPartners(DB: D1Database): Promise<Partial<Record<HomeServiceCategory, number>>> {
  const r = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`).bind(HOME_PARTNERS_KEY)
    .first<{ value: string }>().catch(() => null)
  return parsePartners(r?.value)
}

/** 상세 주소(JSON)를 요청서 칸 위에 덮는다 — 볼 자격이 있는 쪽만 이 함수를 부른다. */
export function withPrivateDetails(details: unknown, privateJson: unknown): Record<string, string> {
  const base = (details && typeof details === 'object' ? details : {}) as Record<string, string>
  if (!privateJson) return base
  try {
    const extra = JSON.parse(String(privateJson)) as Record<string, unknown>
    const out = { ...base }
    for (const [k, v] of Object.entries(extra ?? {})) if (typeof v === 'string' && v && k in base) out[k] = v
    return out
  } catch { return base }
}

export async function ensureHomeServiceTables(DB: D1Database): Promise<void> {
  if (_done.has(DB)) return
  _done.add(DB)
  for (const sql of HS_TABLES_SQL) {
    try { await DB.prepare(sql).run() } catch { /* 이미 있음 */ }
  }
}

/**
 * 원장 한 줄 + 잔액 증가 — **한 batch(=한 트랜잭션)** 로. 같은 (kind, ref) 가 이미 있으면 아무것도 안 한다.
 * 잔액 줄은 `WHERE changes() > 0` 으로 바로 앞 INSERT 가 실제로 들어갔을 때만 움직인다
 * (두 문장 사이에서 워커가 죽어 원장과 잔액이 갈리는 틈이 없다). 반환: 실제로 들어갔는가.
 */
export async function creditAdd(
  DB: D1Database, sellerId: number, kind: 'charge' | 'grant' | 'refund', amount: number, ref: string,
  pricePaid = 0, note = '',
): Promise<boolean> {
  if (!(amount > 0)) return false
  const [ins] = await DB.batch([
    DB.prepare(
      `INSERT OR IGNORE INTO home_service_credit_tx (seller_id, kind, amount, price_paid, ref, note) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(sellerId, kind, amount, pricePaid, ref, note),
    DB.prepare(
      `INSERT INTO home_service_credit_balance (seller_id, balance, updated_at)
       SELECT ?, ?, datetime('now') WHERE changes() > 0
       ON CONFLICT(seller_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = datetime('now')`,
    ).bind(sellerId, amount),
  ])
  return !!ins?.meta?.changes
}

/**
 * 🏁 견적 보내기 — 참여권 1장 차감 · 선착순 자리 · 견적 줄 · 원장 줄을 **한 트랜잭션**으로.
 *
 * D1 은 트랜잭션을 하나씩 실행하므로 이 batch 안에서 "자리가 있는가" 와 "자리를 가져간다" 사이에
 * 다른 사장님이 끼어들 수 없다. 앞 문장이 실패하면 뒤 문장은 `changes() > 0` 에 막혀 아무것도 안 한다 —
 * 그래서 **돈만 빠지고 자리를 못 얻는 경우가 구조적으로 없다**.
 *
 * 반환 ok=false 면 사유를 다시 읽어 구분한다(자리 마감 / 이미 보냄 / 참여권 없음 / 요청 닫힘).
 */
export async function sendQuoteAtomic(
  DB: D1Database, requestId: number, sellerId: number, price: number | null, message: string, cost = 1,
): Promise<{ ok: true; quoteId: number } | { ok: false; reason: 'closed' | 'full' | 'already' | 'no_credit' }> {
  // 🎟️ 장수는 1 이상 정수만(카테고리별 — 결재 2026-10-25). 이상한 값은 1장으로.
  const n = Number.isInteger(cost) && cost >= 1 ? cost : 1
  const res = await DB.batch([
    DB.prepare(
      `UPDATE home_service_credit_balance SET balance = balance - ?, updated_at = datetime('now')
        WHERE seller_id = ? AND balance >= ?
          AND EXISTS (SELECT 1 FROM home_service_requests WHERE id = ? AND status = 'open' AND quote_count < max_quotes)
          AND NOT EXISTS (SELECT 1 FROM home_service_quotes WHERE request_id = ? AND seller_id = ?)`,
    ).bind(n, sellerId, n, requestId, requestId, sellerId),
    DB.prepare(
      `UPDATE home_service_requests
          SET quote_count = quote_count + 1, first_quote_at = COALESCE(first_quote_at, datetime('now')),
              updated_at = datetime('now')
        WHERE id = ? AND status = 'open' AND quote_count < max_quotes AND changes() > 0`,
    ).bind(requestId),
    DB.prepare(
      `INSERT OR IGNORE INTO home_service_quotes (request_id, seller_id, price, message, status, credits)
       SELECT ?, ?, ?, ?, 'sent', ? WHERE changes() > 0`,
    ).bind(requestId, sellerId, price, message, n),
    DB.prepare(
      `INSERT OR IGNORE INTO home_service_credit_tx (seller_id, kind, amount, ref)
       SELECT ?, 'spend', ?, ? WHERE changes() > 0`,
    ).bind(sellerId, -n, `quote:${requestId}:${sellerId}`),
  ])
  if (res[2]?.meta?.changes) {
    const q = await DB.prepare(`SELECT id FROM home_service_quotes WHERE request_id = ? AND seller_id = ?`)
      .bind(requestId, sellerId).first<{ id: number }>()
    return { ok: true, quoteId: Number(q?.id) }
  }
  const mine = await DB.prepare(`SELECT 1 AS x FROM home_service_quotes WHERE request_id = ? AND seller_id = ?`)
    .bind(requestId, sellerId).first()
  if (mine) return { ok: false, reason: 'already' }
  const r = await DB.prepare(`SELECT status, quote_count, max_quotes FROM home_service_requests WHERE id = ?`)
    .bind(requestId).first<{ status: string; quote_count: number; max_quotes: number }>()
  if (!r || r.status !== 'open') return { ok: false, reason: 'closed' }
  if (Number(r.quote_count) >= Number(r.max_quotes)) return { ok: false, reason: 'full' }
  return { ok: false, reason: 'no_credit' }
}

/**
 * 🏠 유어딜 직영 견적 — 자리 확보 + 견적 줄을 **한 트랜잭션**으로. 참여권은 쓰지 않는다.
 * 선착순 자리는 다른 사장님과 똑같이 하나 차지한다(손님이 비교하는 견적 수는 그대로 5개 이하).
 */
export async function sendHouseQuoteAtomic(
  DB: D1Database, requestId: number, sellerId: number, price: number | null, message: string, partner = false,
): Promise<{ ok: true; quoteId: number } | { ok: false; reason: 'closed' | 'full' | 'already' }> {
  const res = await DB.batch([
    DB.prepare(
      `UPDATE home_service_requests
          SET quote_count = quote_count + 1, first_quote_at = COALESCE(first_quote_at, datetime('now')),
              updated_at = datetime('now')
        WHERE id = ? AND status = 'open' AND quote_count < max_quotes
          AND NOT EXISTS (SELECT 1 FROM home_service_quotes WHERE request_id = ? AND seller_id = ?)`,
    ).bind(requestId, requestId, sellerId),
    DB.prepare(
      `INSERT OR IGNORE INTO home_service_quotes (request_id, seller_id, price, message, status, is_house, partner)
       SELECT ?, ?, ?, ?, 'sent', 1, ? WHERE changes() > 0`,
    ).bind(requestId, sellerId, price, message, partner ? 1 : 0),
  ])
  if (res[1]?.meta?.changes) {
    const q = await DB.prepare(`SELECT id FROM home_service_quotes WHERE request_id = ? AND seller_id = ?`)
      .bind(requestId, sellerId).first<{ id: number }>()
    return { ok: true, quoteId: Number(q?.id) }
  }
  const mine = await DB.prepare(`SELECT 1 AS x FROM home_service_quotes WHERE request_id = ? AND seller_id = ?`)
    .bind(requestId, sellerId).first()
  if (mine) return { ok: false, reason: 'already' }
  const r = await DB.prepare(`SELECT status FROM home_service_requests WHERE id = ?`).bind(requestId).first<{ status: string }>()
  if (!r || r.status !== 'open') return { ok: false, reason: 'closed' }
  return { ok: false, reason: 'full' }
}

/**
 * 손님이 견적 하나를 고른다(CAS — 열린 요청의 보낸 견적일 때만, 한 번만).
 * byAdmin=true 는 **운영팀이 대리 접수한 요청**(source='admin')에서만 통한다 — 손님이 전화로 고른 것을 대신 누른다.
 * 앱에서 손님이 직접 올린 요청은 운영팀이 대신 고를 수 없다.
 */
export async function chooseQuoteAtomic(
  DB: D1Database, requestId: number, quoteId: number, userId: number, byAdmin: boolean,
): Promise<boolean> {
  const [upd] = await DB.batch([
    DB.prepare(
      `UPDATE home_service_requests SET status = 'chosen', chosen_quote_id = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'open'
          AND (user_id = ? OR (? = 1 AND source = 'admin'))
          AND EXISTS (SELECT 1 FROM home_service_quotes WHERE id = ? AND request_id = ? AND status = 'sent')`,
    ).bind(quoteId, requestId, userId, byAdmin ? 1 : 0, quoteId, requestId),
    DB.prepare(`UPDATE home_service_quotes SET status = 'chosen' WHERE id = ? AND request_id = ? AND changes() > 0`)
      .bind(quoteId, requestId),
  ])
  return !!upd?.meta?.changes
}

export async function creditBalance(DB: D1Database, sellerId: number): Promise<number> {
  const r = await DB.prepare(`SELECT balance FROM home_service_credit_balance WHERE seller_id = ?`)
    .bind(sellerId).first<{ balance: number }>()
  return Number(r?.balance ?? 0)
}

/**
 * 견적 하나의 참여권을 돌려준다(멱등) — 상태 CAS → 원장 → 잔액이 한 트랜잭션.
 * 고른 견적(chosen)은 돌려주지 않는다 — 손님을 실제로 받았다.
 */
export async function refundQuote(DB: D1Database, quoteId: number, sellerId: number, why: string): Promise<boolean> {
  const [upd] = await DB.batch([
    DB.prepare(`UPDATE home_service_quotes SET status = 'refunded' WHERE id = ? AND status = 'sent' AND is_house = 0`).bind(quoteId),
    // 🎟️ 쓴 만큼 돌려준다(`quotes.credits` — 카테고리 장수가 나중에 바뀌어도 그 견적에 쓴 값).
    DB.prepare(
      `INSERT OR IGNORE INTO home_service_credit_tx (seller_id, kind, amount, ref, note)
       SELECT ?, 'refund', (SELECT credits FROM home_service_quotes WHERE id = ?), ?, ? WHERE changes() > 0`,
    ).bind(sellerId, quoteId, `quote:${quoteId}`, why),
    DB.prepare(
      `INSERT INTO home_service_credit_balance (seller_id, balance, updated_at)
       SELECT ?, (SELECT credits FROM home_service_quotes WHERE id = ?), datetime('now') WHERE changes() > 0
       ON CONFLICT(seller_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = datetime('now')`,
    ).bind(sellerId, quoteId),
  ])
  return !!upd?.meta?.changes
}

/** 요청 하나의 보낸 견적 전부 반환. */
export async function refundAllQuotes(DB: D1Database, requestId: number, why: string): Promise<number> {
  const { results } = await DB.prepare(
    `SELECT id, seller_id FROM home_service_quotes WHERE request_id = ? AND status = 'sent' AND is_house = 0`,
  ).bind(requestId).all<{ id: number; seller_id: number }>()
  let n = 0
  for (const q of results ?? []) if (await refundQuote(DB, q.id, q.seller_id, why)) n++
  return n
}

/**
 * 이 요청을 받을 사장님. 카테고리 + 지역(시/도 전체 또는 시군구) 일치, 활성, 정지·반려가 아닌 매장(심사 중 포함 — `PRO_OPEN_STATUSES`).
 * 이사는 출발지·도착지 둘 다 본다. 이미 보낸 사장님(`home_service_dispatch`)은 뺀다.
 */
export const MATCH_PROS_SQL = `
  SELECT DISTINCT p.seller_id AS seller_id, COALESCE(NULLIF(p.phone, ''), s.phone) AS phone
    FROM home_service_pros p
    JOIN sellers s ON s.id = p.seller_id
    JOIN home_service_pro_categories c ON c.seller_id = p.seller_id AND c.category = ?
    JOIN home_service_pro_areas a ON a.seller_id = p.seller_id
   WHERE p.active = 1
     AND s.status IN ${PRO_OPEN_STATUS_SQL}
     AND (
       (a.sido = ? AND (a.sigungu = '' OR a.sigungu = ?))
       OR (? IS NOT NULL AND a.sido = ? AND (a.sigungu = '' OR a.sigungu = ?))
     )
     AND NOT EXISTS (SELECT 1 FROM home_service_dispatch d WHERE d.request_id = ? AND d.seller_id = p.seller_id)
   LIMIT ?`

/**
 * 사장님 한 명이 받을 수 있는 열린 요청(카테고리·지역 일치, 날짜 안 지남). 요청함과 가입 직후 보내기가 같이 쓴다.
 * 제휴 업체는 자기 제휴 카테고리(세 번째 인자, 쉼표 목록)를 **지역과 무관하게** 받는다.
 * bind: (seller, 오늘, 제휴카테고리csv, seller, seller, limit)
 */
export const OPEN_REQUESTS_FOR_PRO_SQL = `
  SELECT r.id, r.category, r.summary, r.desired_date, r.status, r.quote_count, r.max_quotes, r.created_at,
         q.id AS my_quote_id, q.status AS my_quote_status
    FROM home_service_requests r
    LEFT JOIN home_service_quotes q ON q.request_id = r.id AND q.seller_id = ?
   WHERE r.status = 'open'
     AND r.desired_date >= ?
     AND (instr(',' || ? || ',', ',' || r.category || ',') > 0
       OR (r.category IN (SELECT category FROM home_service_pro_categories WHERE seller_id = ?)
           AND EXISTS (
             SELECT 1 FROM home_service_pro_areas a
              WHERE a.seller_id = ?
                AND ((a.sido = r.sido AND (a.sigungu = '' OR a.sigungu = r.sigungu))
                  OR (r.sido2 IS NOT NULL AND a.sido = r.sido2 AND (a.sigungu = '' OR a.sigungu = r.sigungu2)))
           )))
   ORDER BY r.id DESC
   LIMIT ?`

const _done = new WeakSet<object>()

/**
 * 💬 대화 한 줄 넣기 — 견적이 아직 살아 있을 때만(요청이 열려 있거나 그 견적이 골라진 것), 줄 수 상한 안에서.
 * 조건을 INSERT…SELECT 한 문장에 넣어 확인과 쓰기 사이 틈이 없다. 반환: 들어갔는가.
 */
export async function addQuoteMessage(DB: D1Database, quoteId: number, sender: 'customer' | 'pro', body: string, maxPerQuote: number): Promise<boolean> {
  const r = await DB.prepare(
    `INSERT INTO home_service_messages (quote_id, sender, body)
     SELECT q.id, ?, ? FROM home_service_quotes q JOIN home_service_requests r ON r.id = q.request_id
      WHERE q.id = ? AND (r.status = 'open' AND q.status = 'sent' OR q.status = 'chosen')
        AND (SELECT COUNT(*) FROM home_service_messages m WHERE m.quote_id = q.id) < ?`,
  ).bind(sender, body, quoteId, maxPerQuote).run()
  return !!r.meta?.changes
}

export async function listQuoteMessages(DB: D1Database, quoteId: number): Promise<{ id: number; sender: string; body: string; created_at: string }[]> {
  const { results } = await DB.prepare(`SELECT id, sender, body, created_at FROM home_service_messages WHERE quote_id = ? ORDER BY id ASC LIMIT 200`)
    .bind(quoteId).all<{ id: number; sender: string; body: string; created_at: string }>()
  return results ?? []
}
