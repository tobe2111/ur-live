/**
 * 🏢 2026-11-26 (대표 "유어딜 어드민 대시보드에 한 페이지에서 볼 수 있으면 좋겠는데?"):
 *   AI 팀 근무 기록. 각 팀 루틴이 일을 시작할 때·끝낼 때 한 줄씩 남기고, 어드민 `/admin/ai-team` 이 읽는다.
 *   - 팀 이름은 `.claude/agents/*.md` 의 12역할(`AI_TEAM_KEYS`)만 허용 — 임의 키로 화면이 오염되지 않게.
 *   - per-request DDL 금지: ensure 는 인스턴스당 1회(WeakSet). 머니 경로 없음.
 *   - 쌓이기만 하는 표라 읽을 때 최근 N줄만, 쓸 때 30일 넘은 줄을 가끔 지운다(1% 확률).
 */

export const AI_TEAM_KEYS = [
  'ceo-office', 'sales', 'partnerships', 'marketing', 'support', 'ops',
  'planning', 'design', 'dev', 'qa', 'finance', 'legal',
] as const
export type AiTeamKey = (typeof AI_TEAM_KEYS)[number]

export const AI_TEAM_STATES = ['started', 'done', 'failed'] as const
export type AiTeamState = (typeof AI_TEAM_STATES)[number]

export const AI_TEAM_ACTIVITY_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ai_team_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team TEXT NOT NULL,
  routine TEXT,
  state TEXT NOT NULL,
  summary TEXT,
  grade TEXT,
  session_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`
export const AI_TEAM_ACTIVITY_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_ai_team_activity_created ON ai_team_activity(created_at)'

export interface AiTeamActivityInput {
  team: AiTeamKey
  routine: string | null
  state: AiTeamState
  summary: string | null
  grade: string | null
  session_url: string | null
}

export interface AiTeamActivityRow extends AiTeamActivityInput {
  id: number
  created_at: string
}

function shortText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

/** 루틴이 보낸 본문을 검증한다. 틀리면 null(400). */
export function parseAiTeamActivity(body: unknown): AiTeamActivityInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const team = b.team
  const state = b.state
  if (typeof team !== 'string' || !(AI_TEAM_KEYS as readonly string[]).includes(team)) return null
  if (typeof state !== 'string' || !(AI_TEAM_STATES as readonly string[]).includes(state)) return null
  const grade = typeof b.grade === 'string' && /^E[1-5]$/.test(b.grade) ? b.grade : null
  const url = typeof b.session_url === 'string' && /^https:\/\/claude\.ai\/[A-Za-z0-9/_\-?=.&]{1,200}$/.test(b.session_url)
    ? b.session_url : null
  return {
    team: team as AiTeamKey,
    state: state as AiTeamState,
    routine: shortText(b.routine, 80),
    summary: shortText(b.summary, 300),
    grade,
    session_url: url,
  }
}

const ensured = new WeakSet<D1Database>()
export async function ensureAiTeamActivity(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  await DB.prepare(AI_TEAM_ACTIVITY_TABLE_SQL).run()
  await DB.prepare(AI_TEAM_ACTIVITY_INDEX_SQL).run()
  ensured.add(DB)
}

export async function recordAiTeamActivity(DB: D1Database, a: AiTeamActivityInput): Promise<void> {
  await ensureAiTeamActivity(DB)
  await DB.prepare(
    'INSERT INTO ai_team_activity (team, routine, state, summary, grade, session_url) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(a.team, a.routine, a.state, a.summary, a.grade, a.session_url).run()
  if (Math.random() < 0.01) {
    await DB.prepare("DELETE FROM ai_team_activity WHERE created_at < datetime('now', '-30 days')").run()
  }
}

export async function listAiTeamActivity(DB: D1Database, limit: number): Promise<AiTeamActivityRow[]> {
  await ensureAiTeamActivity(DB)
  const n = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 300) : 100
  const r = await DB.prepare(
    'SELECT id, team, routine, state, summary, grade, session_url, created_at FROM ai_team_activity ORDER BY id DESC LIMIT ?',
  ).bind(n).all<AiTeamActivityRow>()
  return r.results ?? []
}
