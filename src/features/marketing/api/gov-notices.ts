/**
 * 📢 공고 스캐너 — 나라장터 입찰공고 + 기업마당 지원사업 공고 (2026-07-22).
 *   파트너/매장 리드와 별개 엔티티 `gov_notices`. "상권활성화·소상공인·마케팅" 키워드 매일 스캔 →
 *   ⓐ 유어딜 직접 응모(B2G 반복 수주) ⓑ 상인회·파트너에 "이런 사업 떴어요" 전달(관계 영업).
 *   설계 SSOT: docs/design/partner-company-collection.md §12. ⚠️ 수집 ≠ 발송.
 */
import type { Env } from '@/worker/types/env'

/** 공고 종류. bid=나라장터 입찰 / grant=기업마당 지원사업. */
export const NOTICE_SOURCES = ['bid', 'grant'] as const
export const NOTICE_STATUSES = ['new', 'reviewing', 'applied', 'shared', 'skip', 'won'] as const

export interface GovNotice {
  source: string; notice_no: string     // 복합키 UNIQUE(source, notice_no)
  title: string; org?: string | null; biz_field?: string | null
  url?: string | null; amount?: string | null; region?: string | null
  start_date?: string | null; end_date?: string | null; posted_date?: string | null
  keyword?: string | null
}
export interface GovNoticeRow extends GovNotice { id: number; status: string; memo: string | null; collected_at: string }

const SELECT_COLS = 'id, source, notice_no, title, org, biz_field, url, amount, region, start_date, end_date, posted_date, keyword, status, memo, collected_at'

const _schemaDone = new WeakSet<object>()
export async function ensureNoticeSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS gov_notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    notice_no TEXT NOT NULL,
    title TEXT NOT NULL,
    org TEXT,
    biz_field TEXT,
    url TEXT,
    amount TEXT,
    region TEXT,
    start_date TEXT,
    end_date TEXT,
    posted_date TEXT,
    keyword TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    memo TEXT,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(source, notice_no)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_notices_source ON gov_notices(source, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_notices_posted ON gov_notices(posted_date)').run().catch(() => null)
}

export async function saveNotices(DB: D1Database, rows: GovNotice[]): Promise<number> {
  if (!rows.length) return 0
  await ensureNoticeSchema(DB)
  const clamp = (v: unknown, n: number): string | null => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null }
  const valid = rows.filter(r => r.source && r.notice_no && (r.title || '').trim().length >= 2)
  if (!valid.length) return 0
  const CHUNK = 50
  let saved = 0
  for (let i = 0; i < valid.length; i += CHUNK) {
    const slice = valid.slice(i, i + CHUNK)
    const stmts = slice.map(r => DB.prepare(
      `INSERT INTO gov_notices (source, notice_no, title, org, biz_field, url, amount, region, start_date, end_date, posted_date, keyword)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source, notice_no) DO UPDATE SET
         title = excluded.title, end_date = COALESCE(excluded.end_date, gov_notices.end_date),
         amount = COALESCE(excluded.amount, gov_notices.amount)`
    ).bind(
      clamp(r.source, 20), clamp(r.notice_no, 80), (r.title || '').slice(0, 300),
      clamp(r.org, 120), clamp(r.biz_field, 80), clamp(r.url, 400), clamp(r.amount, 40), clamp(r.region, 60),
      clamp(r.start_date, 20), clamp(r.end_date, 20), clamp(r.posted_date, 20), clamp(r.keyword, 40),
    ))
    const res = await DB.batch(stmts).catch(() => null)
    if (res) saved += slice.length
  }
  return saved
}

export async function listNotices(DB: D1Database, filter: { source?: string; status?: string; q?: string; limit?: number } = {}): Promise<GovNoticeRow[]> {
  await ensureNoticeSchema(DB)
  const where: string[] = ['1=1']; const binds: (string | number)[] = []
  if (filter.source && (NOTICE_SOURCES as readonly string[]).includes(filter.source)) { where.push('source = ?'); binds.push(filter.source) }
  if (filter.status && (NOTICE_STATUSES as readonly string[]).includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.q) { where.push('(LOWER(title) LIKE ? OR COALESCE(org,\'\') LIKE ?)'); const l = `%${filter.q.toLowerCase()}%`; binds.push(l, `%${filter.q}%`) }
  const limit = Math.min(1000, Math.max(1, filter.limit || 300))
  const r = await DB.prepare(`SELECT ${SELECT_COLS} FROM gov_notices WHERE ${where.join(' AND ')} ORDER BY posted_date DESC, id DESC LIMIT ?`).bind(...binds, limit).all<GovNoticeRow>().catch(() => null)
  return r?.results || []
}

export async function updateNotice(DB: D1Database, id: number, patch: { status?: string; memo?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureNoticeSchema(DB)
  const sets: string[] = []; const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    if (!(NOTICE_STATUSES as readonly string[]).includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
  }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push((patch.memo || '').slice(0, 500) || null) }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE gov_notices SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '공고를 찾을 수 없습니다' }
  return { ok: true }
}

export async function noticeStats(DB: D1Database): Promise<{ total: number; bid: number; grant: number; recent7: number; actionable: number }> {
  await ensureNoticeSchema(DB)
  const t = await DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN source='bid' THEN 1 ELSE 0 END) AS bid,
      SUM(CASE WHEN source='grant' THEN 1 ELSE 0 END) AS grant_,
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7,
      SUM(CASE WHEN status IN ('reviewing','applied') THEN 1 ELSE 0 END) AS actionable
    FROM gov_notices`).first<Record<string, number>>().catch(() => null)
  return { total: Number(t?.total) || 0, bid: Number(t?.bid) || 0, grant: Number(t?.grant_) || 0, recent7: Number(t?.recent7) || 0, actionable: Number(t?.actionable) || 0 }
}
