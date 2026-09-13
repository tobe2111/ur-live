/**
 * 📥 2026-09-08 (대표 "어드민으로 해"): 결재함 답을 어드민에서 받아 D1 에 보관한다.
 *   SSOT 는 여전히 docs/decisions/<slug>.md 의 `결정` 섹션이다. 이 테이블은 **대표 원문의 우편함**이고,
 *   커넥터 대리인 루틴(4시간)이 여기서 읽어 파일에 원문 그대로 옮기고 PR 로 머지한 뒤 `synced_at` 을 찍는다.
 *   - per-request DDL 금지(머니 룰 부수 규칙): ensure 는 인스턴스당 1회(WeakSet).
 *   - slug 는 파일명 규약(`YYYY-MM-DD-kebab`)만 허용 — 경로 조작·임의 키 차단.
 */

export const DECISION_ANSWERS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS decision_answers (
  slug TEXT PRIMARY KEY,
  answer TEXT NOT NULL,
  answered_by TEXT,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  synced_ref TEXT
)`

export const DECISION_SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]{1,80}$/
export const DECISION_ANSWER_MAX = 500

export function isValidDecisionSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && DECISION_SLUG_RE.test(slug)
}

/** 대표 원문 정규화: 앞뒤 공백만 벗긴다. 의역·요약 금지(원문이 곧 결정). */
export function normalizeDecisionAnswer(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.replace(/\r\n/g, '\n').trim()
  if (!t || t.length > DECISION_ANSWER_MAX) return null
  return t
}

export interface DecisionAnswerRow {
  slug: string
  answer: string
  answered_by: string | null
  answered_at: string
  synced_at: string | null
  synced_ref: string | null
}

const ensured = new WeakSet<D1Database>()
export async function ensureDecisionAnswers(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  await DB.prepare(DECISION_ANSWERS_TABLE_SQL).run()
  ensured.add(DB)
}

export async function listDecisionAnswers(DB: D1Database): Promise<DecisionAnswerRow[]> {
  await ensureDecisionAnswers(DB)
  const r = await DB.prepare(
    'SELECT slug, answer, answered_by, answered_at, synced_at, synced_ref FROM decision_answers ORDER BY answered_at DESC',
  ).all<DecisionAnswerRow>()
  return r.results ?? []
}

/** 같은 slug 에 다시 답하면 덮어쓰고 동기화 표시를 지운다(새 원문이 다시 파일로 가야 한다). */
export async function upsertDecisionAnswer(
  DB: D1Database,
  slug: string,
  answer: string,
  answeredBy: string | null,
): Promise<void> {
  await ensureDecisionAnswers(DB)
  await DB.prepare(
    `INSERT INTO decision_answers (slug, answer, answered_by, answered_at, synced_at, synced_ref)
     VALUES (?, ?, ?, datetime('now'), NULL, NULL)
     ON CONFLICT(slug) DO UPDATE SET
       answer = excluded.answer,
       answered_by = excluded.answered_by,
       answered_at = excluded.answered_at,
       synced_at = NULL,
       synced_ref = NULL`,
  ).bind(slug, answer, answeredBy).run()
}

export async function markDecisionAnswerSynced(DB: D1Database, slug: string, ref: string): Promise<boolean> {
  await ensureDecisionAnswers(DB)
  const r = await DB.prepare(
    "UPDATE decision_answers SET synced_at = datetime('now'), synced_ref = ? WHERE slug = ? AND synced_at IS NULL",
  ).bind(ref, slug).run()
  return (r.meta?.changes ?? 0) > 0
}
