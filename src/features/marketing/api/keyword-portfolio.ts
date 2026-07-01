/**
 * 🆕 2026-06-30 유어애즈 — 키워드 포트폴리오(발굴 키워드 저장·태그·메모).
 *   연관키워드/자동완성에서 찾은 키워드를 저장해 재방문·그룹 관리. 순수 DB(외부호출 0).
 *   테넌트 = ad_accounts.id (account_id 컬럼).
 */
const _schemaDone = new WeakSet<object>()
export async function ensureKeywordPortfolioSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_saved_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    tag TEXT,
    monthly_total INTEGER,
    comp_idx TEXT,
    memo TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(account_id, keyword)
  )`).run().catch(() => null)
}

export interface SavedKeyword { id: number; keyword: string; tag: string | null; monthly_total: number | null; comp_idx: string | null; memo: string | null; created_at: string }

const MAX_SAVED = 500

export async function saveKeyword(DB: D1Database, accountId: number, input: { keyword: string; monthly_total?: number | null; comp_idx?: string | null; tag?: string | null; memo?: string | null }): Promise<{ ok: boolean; error?: string }> {
  await ensureKeywordPortfolioSchema(DB)
  const kw = String(input.keyword || '').trim().slice(0, 60)
  if (kw.length < 1) return { ok: false, error: '키워드를 입력해주세요' }
  const count = await DB.prepare('SELECT COUNT(*) AS c FROM ad_saved_keywords WHERE account_id = ?').bind(accountId).first<{ c: number }>().catch(() => null)
  // 이미 저장된 키워드 갱신은 상한과 무관 — 신규일 때만 상한 검사.
  const exists = await DB.prepare('SELECT 1 FROM ad_saved_keywords WHERE account_id = ? AND keyword = ?').bind(accountId, kw).first().catch(() => null)
  if (!exists && (Number(count?.c) || 0) >= MAX_SAVED) return { ok: false, error: `저장 키워드는 최대 ${MAX_SAVED}개입니다` }
  const mt = input.monthly_total != null && Number.isFinite(input.monthly_total) ? Math.max(0, Math.round(input.monthly_total)) : null
  const comp = input.comp_idx != null ? String(input.comp_idx).slice(0, 10) : null
  const tag = input.tag != null ? String(input.tag).trim().slice(0, 30) || null : null
  const memo = input.memo != null ? String(input.memo).slice(0, 200) : null
  await DB.prepare(`INSERT INTO ad_saved_keywords (account_id, keyword, tag, monthly_total, comp_idx, memo)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, keyword) DO UPDATE SET
      tag = COALESCE(excluded.tag, ad_saved_keywords.tag),
      monthly_total = COALESCE(excluded.monthly_total, ad_saved_keywords.monthly_total),
      comp_idx = COALESCE(excluded.comp_idx, ad_saved_keywords.comp_idx),
      memo = COALESCE(excluded.memo, ad_saved_keywords.memo)`)
    .bind(accountId, kw, tag, mt, comp, memo).run().catch(() => null)
  return { ok: true }
}

export async function listSavedKeywords(DB: D1Database, accountId: number, tag?: string | null): Promise<SavedKeyword[]> {
  await ensureKeywordPortfolioSchema(DB)
  const r = await (tag
    ? DB.prepare('SELECT id, keyword, tag, monthly_total, comp_idx, memo, created_at FROM ad_saved_keywords WHERE account_id = ? AND tag = ? ORDER BY id DESC').bind(accountId, tag)
    : DB.prepare('SELECT id, keyword, tag, monthly_total, comp_idx, memo, created_at FROM ad_saved_keywords WHERE account_id = ? ORDER BY id DESC').bind(accountId)
  ).all<SavedKeyword>().catch(() => null)
  return r?.results || []
}

/** 저장된 태그 목록(중복 제거, null 제외) — 필터 UI 용. */
export async function listKeywordTags(DB: D1Database, accountId: number): Promise<string[]> {
  await ensureKeywordPortfolioSchema(DB)
  const r = await DB.prepare("SELECT DISTINCT tag FROM ad_saved_keywords WHERE account_id = ? AND tag IS NOT NULL AND tag != '' ORDER BY tag")
    .bind(accountId).all<{ tag: string }>().catch(() => null)
  return (r?.results || []).map(x => x.tag)
}

export async function deleteSavedKeyword(DB: D1Database, accountId: number, id: number): Promise<void> {
  await ensureKeywordPortfolioSchema(DB)
  await DB.prepare('DELETE FROM ad_saved_keywords WHERE id = ? AND account_id = ?').bind(id, accountId).run().catch(() => null)
}

export async function updateSavedKeyword(DB: D1Database, accountId: number, id: number, patch: { tag?: string | null; memo?: string | null }): Promise<{ ok: boolean }> {
  await ensureKeywordPortfolioSchema(DB)
  const sets: string[] = []
  const binds: (string | null)[] = []
  if (patch.tag !== undefined) { sets.push('tag = ?'); binds.push(patch.tag != null ? String(patch.tag).trim().slice(0, 30) || null : null) }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push(patch.memo != null ? String(patch.memo).slice(0, 200) : null) }
  if (!sets.length) return { ok: false }
  await DB.prepare(`UPDATE ad_saved_keywords SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).bind(...binds, id, accountId).run().catch(() => null)
  return { ok: true }
}
