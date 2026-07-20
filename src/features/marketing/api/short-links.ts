/**
 * 🆕 2026-07-12 유어애즈 — 무료 단축 링크 서비스 (대표 요청 "무료 단축 링크 서비스").
 *
 *   결정(AskUserQuestion): 생성 = **유어애즈 무료 가입자**(익명 생성 금지 — 피싱/스팸 살포 방어의 핵심:
 *   생성자가 계정으로 추적되고 정지 가능) · 단축 URL = **urdeal.kr/l/{code}** (`/s/*` 는 셀러
 *   공개페이지가 선점이라 `/l/`). 리다이렉트 자체는 공개(무인증 302) + 클릭 일별 집계.
 *
 *   ⚠️ 오픈 리다이렉트 방어: 이 기능은 *의도된* 외부 리다이렉트다. 대신
 *     ① 생성은 로그인 계정만(추적/차단 가능) ② target 은 http/https 만(scheme 화이트리스트)
 *     ③ 자기 자신(/l/)으로의 재귀 차단 ④ active 플래그 + 어드민 비활성(모더레이션)
 *     ⑤ 계정당 링크 수 캡 + 생성 rate-limit.
 *   개인정보: 원시 IP/UA 저장 안 함 — 링크별 총클릭 + 일별 카운터만(클릭가드의 90일 원시로그와 다른 설계).
 */

export interface ShortLinkRow {
  id: number; code: string; target_url: string; title: string | null
  active: number; click_count: number; last_click_at: string | null; created_at: string
}

const MAX_LINKS_PER_ACCOUNT = 100      // 무료 계정당 캡(폭주/살포 방어 — 필요 시 플랜 연동은 후속)
const MAX_TARGET_LEN = 2048
const CODE_RE = /^[A-Za-z0-9_-]{4,30}$/  // 커스텀 코드 형식
// 예약어 — 혼동/사칭 방지(우리 서비스 경로·브랜드어).
const RESERVED_CODES = new Set(['api', 'ads', 'admin', 'login', 'signup', 'urdeal', 'urads', 'wholesale', 'seller', 'blog', 'l'])

const _schemaDone = new WeakSet<object>()
export async function ensureShortLinkSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_short_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    target_url TEXT NOT NULL,
    title TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    click_count INTEGER NOT NULL DEFAULT 0,
    last_click_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_short_link_daily (
    link_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(link_id, day)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_short_links_acct ON ad_short_links(account_id, id)').run().catch(() => null)
}

/** target URL 검증 — http/https 만, 길이 캡, 자기 자신(/l/) 재귀 차단. 실패 시 에러 메시지 반환. */
export function validateTargetUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const s = (raw || '').trim()
  if (!s) return { ok: false, error: '이동할 URL을 입력해주세요' }
  if (s.length > MAX_TARGET_LEN) return { ok: false, error: 'URL이 너무 깁니다 (2048자 이하)' }
  let u: URL
  try { u = new URL(s) } catch { return { ok: false, error: '올바른 URL 형식이 아닙니다 (https:// 포함 전체 주소)' } }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'http/https 주소만 단축할 수 있습니다' }
  // 자기 자신(/l/)으로의 재귀 리다이렉트 차단(무한 루프/체인 은닉 방지).
  if (u.pathname === '/l' || u.pathname.startsWith('/l/')) return { ok: false, error: '단축 링크를 다시 단축할 수 없습니다' }
  return { ok: true, url: u.toString() }
}

/** 무작위 코드 6자 — 혼동 문자(0/O/1/l/I) 제외 base56. */
export function genCode(): string {
  const ALPHA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = crypto.getRandomValues(new Uint8Array(6))
  let out = ''
  for (const b of buf) out += ALPHA[b % ALPHA.length]
  return out
}

export type CreateLinkResult = { ok: true; link: ShortLinkRow } | { ok: false; error: string }

export async function createShortLink(
  DB: D1Database, accountId: number,
  input: { target_url: string; title?: string; custom_code?: string },
): Promise<CreateLinkResult> {
  await ensureShortLinkSchema(DB)
  const target = validateTargetUrl(input.target_url)
  if (!target.ok) return { ok: false, error: target.error }
  const title = (input.title || '').trim().slice(0, 80) || null
  // 계정당 캡(폭주/살포 방어).
  const cnt = await DB.prepare('SELECT COUNT(*) AS c FROM ad_short_links WHERE account_id = ?').bind(accountId).first<{ c: number }>().catch(() => null)
  if ((Number(cnt?.c) || 0) >= MAX_LINKS_PER_ACCOUNT) return { ok: false, error: `링크 한도(${MAX_LINKS_PER_ACCOUNT}개)에 도달했습니다. 안 쓰는 링크를 삭제해주세요.` }

  const custom = (input.custom_code || '').trim()
  if (custom) {
    if (!CODE_RE.test(custom)) return { ok: false, error: '커스텀 코드는 4~30자 영문/숫자/-/_ 만 가능합니다' }
    if (RESERVED_CODES.has(custom.toLowerCase())) return { ok: false, error: '사용할 수 없는 코드입니다' }
  }

  // 커스텀은 1회 시도(중복=에러), 무작위는 충돌 시 재생성 3회.
  const attempts = custom ? [custom] : [genCode(), genCode(), genCode()]
  for (const code of attempts) {
    const r = await DB.prepare('INSERT OR IGNORE INTO ad_short_links (account_id, code, target_url, title) VALUES (?, ?, ?, ?)')
      .bind(accountId, code, target.url, title).run().catch(() => null)
    if (r?.meta?.changes === 1 && r.meta.last_row_id) {
      return { ok: true, link: { id: Number(r.meta.last_row_id), code, target_url: target.url, title, active: 1, click_count: 0, last_click_at: null, created_at: new Date().toISOString() } }
    }
    if (custom) return { ok: false, error: '이미 사용 중인 코드입니다' }
  }
  return { ok: false, error: '코드 생성에 실패했습니다. 다시 시도해주세요.' }
}

export async function listMyLinks(DB: D1Database, accountId: number): Promise<ShortLinkRow[]> {
  await ensureShortLinkSchema(DB)
  const r = await DB.prepare('SELECT id, code, target_url, title, active, click_count, last_click_at, created_at FROM ad_short_links WHERE account_id = ? ORDER BY id DESC LIMIT 100')
    .bind(accountId).all<ShortLinkRow>().catch(() => null)
  return r?.results || []
}

/** 소유자 스코프 수정(활성 토글/제목) — WHERE account_id 로 IDOR 차단. */
export async function updateShortLink(DB: D1Database, accountId: number, id: number, patch: { active?: boolean; title?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureShortLinkSchema(DB)
  const sets: string[] = []
  const binds: (string | number | null)[] = []
  if (patch.active !== undefined) { sets.push('active = ?'); binds.push(patch.active ? 1 : 0) }
  if (patch.title !== undefined) { sets.push('title = ?'); binds.push(patch.title.trim().slice(0, 80) || null) }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE ad_short_links SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).bind(...binds, id, accountId).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '링크를 찾을 수 없습니다' }
  return { ok: true }
}

export async function deleteShortLink(DB: D1Database, accountId: number, id: number): Promise<{ ok: boolean; error?: string }> {
  await ensureShortLinkSchema(DB)
  const r = await DB.prepare('DELETE FROM ad_short_links WHERE id = ? AND account_id = ?').bind(id, accountId).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '링크를 찾을 수 없습니다' }
  await DB.prepare('DELETE FROM ad_short_link_daily WHERE link_id = ?').bind(id).run().catch(() => null)
  return { ok: true }
}

/** 공개 리다이렉트 해석 — active 링크의 target 반환(카운트는 별도 recordShortLinkClick, waitUntil 용). */
export async function resolveShortLink(DB: D1Database, code: string): Promise<{ id: number; target_url: string } | null> {
  if (!code || code.length > 30) return null
  await ensureShortLinkSchema(DB)
  return DB.prepare('SELECT id, target_url FROM ad_short_links WHERE code = ? AND active = 1')
    .bind(code).first<{ id: number; target_url: string }>().catch(() => null)
}

/** 클릭 집계 — 총계 원자 증분 + 일별 upsert. fail-soft(집계 실패가 리다이렉트를 못 막음). */
export async function recordShortLinkClick(DB: D1Database, linkId: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10)
  await DB.prepare("UPDATE ad_short_links SET click_count = click_count + 1, last_click_at = datetime('now') WHERE id = ?").bind(linkId).run().catch(() => null)
  await DB.prepare('INSERT INTO ad_short_link_daily (link_id, day, count) VALUES (?, ?, 1) ON CONFLICT(link_id, day) DO UPDATE SET count = count + 1')
    .bind(linkId, day).run().catch(() => null)
}

/** 소유자용 일별 통계(최근 30일) — 소유 검증 포함. */
export async function shortLinkStats(DB: D1Database, accountId: number, id: number): Promise<{ ok: boolean; error?: string; daily?: Array<{ day: string; count: number }> }> {
  await ensureShortLinkSchema(DB)
  const own = await DB.prepare('SELECT id FROM ad_short_links WHERE id = ? AND account_id = ?').bind(id, accountId).first<{ id: number }>().catch(() => null)
  if (!own) return { ok: false, error: '링크를 찾을 수 없습니다' }
  const r = await DB.prepare("SELECT day, count FROM ad_short_link_daily WHERE link_id = ? AND day >= date('now', '-30 days') ORDER BY day ASC")
    .bind(id).all<{ day: string; count: number }>().catch(() => null)
  return { ok: true, daily: r?.results || [] }
}

// ── 어드민 모더레이션 (피싱/스팸 신고 대응 — 비활성 처리) ─────────────────────
export async function adminListShortLinks(DB: D1Database, limit = 200): Promise<Array<ShortLinkRow & { account_id: number }>> {
  await ensureShortLinkSchema(DB)
  const r = await DB.prepare('SELECT id, account_id, code, target_url, title, active, click_count, last_click_at, created_at FROM ad_short_links ORDER BY id DESC LIMIT ?')
    .bind(Math.min(500, limit)).all<ShortLinkRow & { account_id: number }>().catch(() => null)
  return r?.results || []
}
export async function adminSetShortLinkActive(DB: D1Database, id: number, active: boolean): Promise<void> {
  await ensureShortLinkSchema(DB)
  await DB.prepare('UPDATE ad_short_links SET active = ? WHERE id = ?').bind(active ? 1 : 0, id).run().catch(() => null)
}
