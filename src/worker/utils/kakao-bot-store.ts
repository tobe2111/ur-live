/**
 * 💬 카카오톡 채널 챗봇으로 **매장 관리** — 계정 연결·좌석 재확인·확인 대기 (2026-10-10)
 *
 * 대표: *"카카오톡으로 유어딜 세팅도 가능해? 이용권 관리같은거"* → *"이상적으로 진행해줘"*.
 *
 * ## 이 모듈이 푸는 문제 — 봇은 카카오 로그인 정체성을 모른다
 * 오픈빌더 스킬 요청이 주는 것은 `userRequest.user.id`(봇 사용자 키) 하나다. 이건 카카오 로그인
 * (`users.kakao_id`)과 **다른 값**이라 "이 채팅 상대가 누구인가" 를 우리가 알 방법이 없다.
 * ⇒ 셀러 대시보드(이미 그 매장 좌석에 앉은 사람)가 **6자리 1회용 코드**를 발급하고, 그 사람이
 *   채널에 `연결 123456` 을 보내면 (봇 키 → 사람·매장) 관계를 만든다.
 *
 * ## 🔐 권한은 연결 시점이 아니라 **매 명령마다** 다시 본다
 * 연결은 "그때 그 사람이 그 매장 좌석에 있었다" 일 뿐이다. 운영자 회수·매장 정지 뒤에도 채팅이
 * 계속 열려 있으면 안 된다 ⇒ `resolveLinkedSeat` 가 매번 `canOperateStore` + 좌석 가능 상태를 보고,
 * 실패하면 **연결을 지우고** 그 사실을 말한다. 채팅에서 온 매장 id 는 어떤 것도 믿지 않는다 —
 * 매장은 오직 연결 행(서버가 만든 것)에서 온다.
 *
 * ## 🚦 게이트(기본 OFF)
 * `KAKAO_BOT_STORE_OPS_ENABLED === 'true'`(env) 또는 `platform_settings.kakao_bot_store_ops_enabled = 'true'`.
 * 꺼져 있으면 연결·명령은 "준비 중" 이고 FAQ 는 종전 그대로다. 스킬 자체의 게이트(`KAKAO_SKILL_SECRET`)는 별개.
 *
 * ⚠️ 이 모듈이 못 막는 것: 카카오 계정 자체를 남에게 넘긴 경우(계정 공유) · 사장님이 코드를 남에게
 *   보여 준 경우(10분 안에 남이 먼저 보내면 그 사람이 연결된다 — 그래서 대시보드에 연결 목록·해제가 있다).
 */
import { canOperateStore } from './seller-operators'
import { isSeatableStoreStatus } from '../../shared/seller-status'

/** 연결 코드 유효 시간(초) — 대시보드 안내 문구와 같은 값. */
export const LINK_CODE_TTL_SEC = 600
/** 확인(네/아니요) 대기 유효 시간 — 짧게. 3분 뒤 "네" 는 아무 일도 안 한다. */
export const PENDING_TTL_SEC = 180
/** 봇 키당 시간당 실패 연결 시도 상한 (6자리 무차별 대입 방어). */
export const LINK_FAIL_LIMIT_PER_HOUR = 5
/** 전체 시간당 실패 상한 — 봇 키를 바꿔 가며 두드리는 경우의 천장. */
export const LINK_FAIL_GLOBAL_LIMIT_PER_HOUR = 300

/** DDL SSOT — `ensureKakaoBotTables` 와 repair-schema 가 같은 문장을 쓴다(두 벌이면 갈린다). */
export const KAKAO_BOT_DDL: Array<{ name: string; sql: string }> = [
  { name: 'kakao_bot_links', sql: `CREATE TABLE IF NOT EXISTS kakao_bot_links (
    bot_user_key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    seller_id INTEGER NOT NULL,
    linked_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    last_list TEXT
  )` },
  { name: 'idx_kakao_bot_links_seller', sql: 'CREATE INDEX IF NOT EXISTS idx_kakao_bot_links_seller ON kakao_bot_links(seller_id)' },
  { name: 'kakao_bot_link_codes', sql: `CREATE TABLE IF NOT EXISTS kakao_bot_link_codes (
    code TEXT PRIMARY KEY,
    user_id TEXT,
    seller_id INTEGER,
    expires_at TEXT,
    used_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )` },
  { name: 'kakao_bot_link_attempts', sql: `CREATE TABLE IF NOT EXISTS kakao_bot_link_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_user_key TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )` },
  { name: 'idx_kakao_bot_link_attempts_key', sql: 'CREATE INDEX IF NOT EXISTS idx_kakao_bot_link_attempts_key ON kakao_bot_link_attempts(bot_user_key, created_at)' },
  { name: 'kakao_bot_pending', sql: `CREATE TABLE IF NOT EXISTS kakao_bot_pending (
    bot_user_key TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    payload TEXT,
    seller_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL
  )` },
]

// 🛡️ per-worker 메모이제이션 (per-request DDL 금지)
const _done = new WeakSet<object>()
export async function ensureKakaoBotTables(DB: D1Database): Promise<void> {
  if (_done.has(DB as unknown as object)) return
  _done.add(DB as unknown as object)
  for (const d of KAKAO_BOT_DDL) {
    try { await DB.prepare(d.sql).run() } catch { /* 레거시/권한 — 호출부 fail-soft */ }
  }
}

type GateEnv = { KAKAO_BOT_STORE_OPS_ENABLED?: string }

/** 매장 관리 게이트. 설정 조회가 실패하면 **꺼진 것**으로 본다(fail-closed). */
export async function isStoreOpsEnabled(env: GateEnv, DB: D1Database): Promise<boolean> {
  if (env.KAKAO_BOT_STORE_OPS_ENABLED === 'true') return true
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'kakao_bot_store_ops_enabled' LIMIT 1")
    .first<{ value: string }>().catch(() => null)
  return row?.value === 'true'
}

/** 6자리 숫자 — CSPRNG + 거절 표본(모듈로 편향 없음). */
export function randomLinkCode(): string {
  const buf = new Uint32Array(1)
  const LIMIT = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < LIMIT) return String(buf[0] % 1_000_000).padStart(6, '0')
  }
}

/**
 * 연결 코드 발급 — 같은 (사람, 매장)의 이전 미사용 코드는 무효로 돌린다(살아 있는 코드는 늘 하나).
 * 호출부가 이미 `canOperateStore` 로 그 사람이 그 매장 좌석에 있음을 확인했어야 한다.
 */
export async function issueLinkCode(DB: D1Database, userId: number, sellerId: number): Promise<string | null> {
  await ensureKakaoBotTables(DB)
  await DB.prepare(
    "UPDATE kakao_bot_link_codes SET used_at = datetime('now') WHERE user_id = ? AND seller_id = ? AND used_at IS NULL"
  ).bind(String(userId), sellerId).run().catch(() => null)
  // 오래된 행 청소(하루 지난 것) — 표가 무한히 자라지 않게.
  await DB.prepare("DELETE FROM kakao_bot_link_codes WHERE created_at < datetime('now', '-1 day')").run().catch(() => null)
  for (let i = 0; i < 5; i++) {
    const code = randomLinkCode()
    const r = await DB.prepare(
      `INSERT OR IGNORE INTO kakao_bot_link_codes (code, user_id, seller_id, expires_at)
       VALUES (?, ?, ?, datetime('now', '+${LINK_CODE_TTL_SEC} seconds'))`
    ).bind(code, String(userId), sellerId).run()
    if (r.meta?.changes) return code
  }
  return null
}

export type LinkResult =
  | { ok: true; sellerId: number; storeName: string }
  | { ok: false; reason: 'rate_limited' | 'invalid' | 'no_seat' }

async function recordFailedAttempt(DB: D1Database, botUserKey: string): Promise<void> {
  await DB.prepare('INSERT INTO kakao_bot_link_attempts (bot_user_key) VALUES (?)').bind(botUserKey).run().catch(() => null)
  await DB.prepare("DELETE FROM kakao_bot_link_attempts WHERE created_at < datetime('now', '-1 day')").run().catch(() => null)
}

/**
 * `연결 123456` — 코드를 **원자적으로** 소비하고(CAS) 봇 키를 그 사람·매장에 묶는다.
 * 무차별 대입: 봇 키당 시간당 실패 5회, 전체 300회에서 멈춘다(시도 자체를 안 한다).
 */
export async function consumeLinkCode(DB: D1Database, botUserKey: string, code: string): Promise<LinkResult> {
  await ensureKakaoBotTables(DB)
  const mine = await DB.prepare(
    "SELECT COUNT(*) AS n FROM kakao_bot_link_attempts WHERE bot_user_key = ? AND created_at > datetime('now', '-1 hour')"
  ).bind(botUserKey).first<{ n: number }>().catch(() => ({ n: 0 }))
  if (Number(mine?.n) >= LINK_FAIL_LIMIT_PER_HOUR) return { ok: false, reason: 'rate_limited' }
  const all = await DB.prepare(
    "SELECT COUNT(*) AS n FROM kakao_bot_link_attempts WHERE created_at > datetime('now', '-1 hour')"
  ).first<{ n: number }>().catch(() => ({ n: 0 }))
  if (Number(all?.n) >= LINK_FAIL_GLOBAL_LIMIT_PER_HOUR) return { ok: false, reason: 'rate_limited' }

  if (!/^\d{6}$/.test(code)) { await recordFailedAttempt(DB, botUserKey); return { ok: false, reason: 'invalid' } }

  // CAS — 두 사람이 같은 코드를 동시에 보내도 한 명만 이긴다. 만료는 같은 문장에서 함께 본다.
  const claimed = await DB.prepare(
    "UPDATE kakao_bot_link_codes SET used_at = datetime('now') WHERE code = ? AND used_at IS NULL AND expires_at > datetime('now')"
  ).bind(code).run()
  if (!claimed.meta?.changes) { await recordFailedAttempt(DB, botUserKey); return { ok: false, reason: 'invalid' } }

  const row = await DB.prepare('SELECT user_id, seller_id FROM kakao_bot_link_codes WHERE code = ? LIMIT 1')
    .bind(code).first<{ user_id: string; seller_id: number }>()
  if (!row) return { ok: false, reason: 'invalid' }

  // 발급 뒤 10분 사이에 좌석이 회수됐을 수 있다 — 연결 순간에도 다시 본다.
  const seat = await checkSeat(DB, Number(row.user_id), Number(row.seller_id))
  if (!seat.ok) return { ok: false, reason: 'no_seat' }

  await DB.prepare(
    `INSERT INTO kakao_bot_links (bot_user_key, user_id, seller_id, linked_at, last_used_at, last_list)
     VALUES (?, ?, ?, datetime('now'), datetime('now'), NULL)
     ON CONFLICT(bot_user_key) DO UPDATE SET
       user_id = excluded.user_id, seller_id = excluded.seller_id,
       linked_at = excluded.linked_at, last_used_at = excluded.last_used_at, last_list = NULL`
  ).bind(botUserKey, String(row.user_id), Number(row.seller_id)).run()
  await DB.prepare('DELETE FROM kakao_bot_pending WHERE bot_user_key = ?').bind(botUserKey).run().catch(() => null)
  return { ok: true, sellerId: Number(row.seller_id), storeName: seat.storeName }
}

async function checkSeat(DB: D1Database, userId: number, sellerId: number): Promise<{ ok: true; storeName: string } | { ok: false }> {
  const access = await canOperateStore(DB, userId, sellerId)
  if (!access.ok) return { ok: false }
  const s = await DB.prepare('SELECT status, business_name, name FROM sellers WHERE id = ? LIMIT 1')
    .bind(sellerId).first<{ status: string | null; business_name: string | null; name: string | null }>().catch(() => null)
  if (!s || !isSeatableStoreStatus(s.status)) return { ok: false }
  return { ok: true, storeName: s.business_name || s.name || `매장 #${sellerId}` }
}

export interface LinkedSeat {
  botUserKey: string
  userId: number
  sellerId: number
  storeName: string
  lastList: number[]
}

export type SeatLookup =
  | { kind: 'none' }
  | { kind: 'revoked' }
  | { kind: 'ok'; seat: LinkedSeat }

/** 연결된 봇 키의 좌석을 **지금** 다시 확인한다. 권한이 없어졌으면 연결을 지우고 `revoked`. */
export async function resolveLinkedSeat(DB: D1Database, botUserKey: string): Promise<SeatLookup> {
  await ensureKakaoBotTables(DB)
  const link = await DB.prepare('SELECT user_id, seller_id, last_list FROM kakao_bot_links WHERE bot_user_key = ? LIMIT 1')
    .bind(botUserKey).first<{ user_id: string; seller_id: number; last_list: string | null }>().catch(() => null)
  if (!link) return { kind: 'none' }
  const userId = Number(link.user_id)
  const sellerId = Number(link.seller_id)
  const seat = await checkSeat(DB, userId, sellerId)
  if (!seat.ok) {
    await unlinkBot(DB, botUserKey)
    return { kind: 'revoked' }
  }
  await DB.prepare("UPDATE kakao_bot_links SET last_used_at = datetime('now') WHERE bot_user_key = ?")
    .bind(botUserKey).run().catch(() => null)
  let lastList: number[] = []
  try {
    const parsed = JSON.parse(link.last_list || '[]')
    if (Array.isArray(parsed)) lastList = parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0)
  } catch { /* 비어 있음 */ }
  return { kind: 'ok', seat: { botUserKey, userId, sellerId, storeName: seat.storeName, lastList } }
}

/** 게이트가 꺼진 상태에서 "연결된 사람인가" 만 본다 — DDL 없이(테이블이 없으면 아니다). */
export async function hasBotLinkNoDdl(DB: D1Database, botUserKey: string): Promise<boolean> {
  const r = await DB.prepare('SELECT 1 AS x FROM kakao_bot_links WHERE bot_user_key = ? LIMIT 1')
    .bind(botUserKey).first<{ x: number }>().catch(() => null)
  return !!r
}

export async function unlinkBot(DB: D1Database, botUserKey: string): Promise<void> {
  await DB.prepare('DELETE FROM kakao_bot_links WHERE bot_user_key = ?').bind(botUserKey).run().catch(() => null)
  await DB.prepare('DELETE FROM kakao_bot_pending WHERE bot_user_key = ?').bind(botUserKey).run().catch(() => null)
}

export async function saveLastList(DB: D1Database, botUserKey: string, ids: number[]): Promise<void> {
  await DB.prepare('UPDATE kakao_bot_links SET last_list = ? WHERE bot_user_key = ?')
    .bind(JSON.stringify(ids.slice(0, 10)), botUserKey).run().catch(() => null)
}

export type PendingAction =
  | { action: 'redeem'; code: string }
  | { action: 'toggle'; productId: number; active: boolean }

/** 확인 대기 저장 — 봇 키당 하나(새 요청이 이전 것을 덮는다). */
export async function setPending(DB: D1Database, botUserKey: string, sellerId: number, p: PendingAction): Promise<void> {
  await DB.prepare(
    `INSERT INTO kakao_bot_pending (bot_user_key, action, payload, seller_id, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+${PENDING_TTL_SEC} seconds'))
     ON CONFLICT(bot_user_key) DO UPDATE SET action = excluded.action, payload = excluded.payload,
       seller_id = excluded.seller_id, expires_at = excluded.expires_at`
  ).bind(botUserKey, p.action, JSON.stringify(p), sellerId).run()
}

/**
 * 확인 대기를 **꺼내면서 지운다**(원자) — "네" 를 두 번 보내도 한 번만 실행된다.
 * 만료됐거나 다른 매장(연결이 바뀐 뒤)의 것이면 null.
 */
export async function takePending(DB: D1Database, botUserKey: string, sellerId: number): Promise<PendingAction | null> {
  const row = await DB.prepare(
    "DELETE FROM kakao_bot_pending WHERE bot_user_key = ? RETURNING payload, seller_id, expires_at > datetime('now') AS live"
  ).bind(botUserKey).first<{ payload: string | null; seller_id: number; live: number }>().catch(() => null)
  if (!row || !Number(row.live) || Number(row.seller_id) !== Number(sellerId)) return null
  try {
    const p = JSON.parse(row.payload || 'null') as PendingAction | null
    if (p && (p.action === 'redeem' || p.action === 'toggle')) return p
  } catch { /* 깨진 행 */ }
  return null
}

export async function clearPending(DB: D1Database, botUserKey: string): Promise<boolean> {
  const r = await DB.prepare('DELETE FROM kakao_bot_pending WHERE bot_user_key = ?').bind(botUserKey).run().catch(() => null)
  return !!r?.meta?.changes
}

/** 대시보드 — 이 매장에 연결된 채팅 계정. */
export async function listStoreLinks(DB: D1Database, sellerId: number) {
  await ensureKakaoBotTables(DB)
  const r = await DB.prepare(
    `SELECT l.bot_user_key, l.user_id, l.linked_at, l.last_used_at, u.name AS user_name
       FROM kakao_bot_links l LEFT JOIN users u ON CAST(u.id AS TEXT) = l.user_id
      WHERE l.seller_id = ? ORDER BY l.linked_at DESC LIMIT 50`
  ).bind(sellerId).all<{ bot_user_key: string; user_id: string; linked_at: string | null; last_used_at: string | null; user_name: string | null }>()
    .catch(() => ({ results: [] as Array<{ bot_user_key: string; user_id: string; linked_at: string | null; last_used_at: string | null; user_name: string | null }> }))
  return r.results || []
}

/** 대시보드 해제 — **이 매장의** 연결만 지운다(다른 매장 행은 키를 알아도 못 지운다). */
export async function revokeStoreLink(DB: D1Database, sellerId: number, botUserKey: string): Promise<boolean> {
  await ensureKakaoBotTables(DB)
  const r = await DB.prepare('DELETE FROM kakao_bot_links WHERE bot_user_key = ? AND seller_id = ?')
    .bind(botUserKey, sellerId).run()
  if (r.meta?.changes) {
    await DB.prepare('DELETE FROM kakao_bot_pending WHERE bot_user_key = ?').bind(botUserKey).run().catch(() => null)
    return true
  }
  return false
}
