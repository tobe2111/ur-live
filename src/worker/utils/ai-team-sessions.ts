/**
 * 🔗 작업실(세션) 연결 (2026-11-26 대표 "모든 세션들 모두 연결해서 한번에 관리하는게 좋지 않겠어? 새 세션을 만들더라도").
 *   이 레포에서 열리는 Claude Code 세션은 `.claude/hooks/ai-hq-report.sh` 가 시작·질문·턴 끝마다 한 줄씩 보낸다.
 *   새 세션도 레포의 훅이라 자동으로 붙는다. 어드민 `/admin/ai-team` 의 "열린 작업실" 이 이 표를 읽는다.
 *   - 세션 id 는 Claude Code 의 내부 id(UUID) — 클릭 링크는 만들 수 없다(그 id 로는 주소가 안 나온다).
 *   - 제목은 첫 질문 80자(그 뒤 질문은 제목을 바꾸지 않는다). 어드민 전용 화면이다.
 *   - per-request DDL 금지: ensure 는 인스턴스당 1회. 14일 지난 줄은 가끔 지운다. 머니 경로 없음.
 */

export const AI_SESSIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ai_team_sessions (
  session_id TEXT PRIMARY KEY,
  title TEXT,
  branch TEXT,
  state TEXT NOT NULL DEFAULT 'idle',
  last_summary TEXT,
  turns INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

export const AI_SESSION_EVENTS = ['start', 'prompt', 'stop'] as const
export type AiSessionEvent = (typeof AI_SESSION_EVENTS)[number]

export interface AiSessionInput {
  session_id: string
  event: AiSessionEvent
  title: string | null
  branch: string | null
  summary: string | null
}

export interface AiSessionRow {
  session_id: string
  title: string | null
  branch: string | null
  state: 'working' | 'idle'
  last_summary: string | null
  turns: number
  started_at: string
  updated_at: string
}

function shortText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

function titleText(v: unknown): string | null {
  const t = shortText(v, 80)
  return t && !t.startsWith('<') ? t : null
}

export function parseAiSession(body: unknown): AiSessionInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const id = b.session_id
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(id)) return null
  if (typeof b.event !== 'string' || !(AI_SESSION_EVENTS as readonly string[]).includes(b.event)) return null
  const branch = typeof b.branch === 'string' && /^[\w./-]{1,120}$/.test(b.branch) ? b.branch : null
  return {
    session_id: id,
    event: b.event as AiSessionEvent,
    // 첫 "질문"이 시스템 알림(<task-notification>… 같은 태그 글)이면 제목으로 쓰지 않는다 — 사람이 쓴 첫 질문을 기다린다.
    title: titleText(b.title),
    branch,
    summary: shortText(b.summary, 200),
  }
}

const ensured = new WeakSet<D1Database>()
async function ensure(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  await DB.prepare(AI_SESSIONS_TABLE_SQL).run()
  ensured.add(DB)
}

/** start → 줄 생성(idle) · prompt → working + 첫 제목 · stop → idle + 마지막 요약 */
export async function recordAiSession(DB: D1Database, s: AiSessionInput): Promise<void> {
  await ensure(DB)
  const state = s.event === 'prompt' ? 'working' : 'idle'
  await DB.prepare(
    `INSERT INTO ai_team_sessions (session_id, title, branch, state, last_summary, turns)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       title = CASE WHEN ai_team_sessions.title IS NULL OR ai_team_sessions.title LIKE '<%' THEN excluded.title ELSE ai_team_sessions.title END,
       branch = COALESCE(excluded.branch, ai_team_sessions.branch),
       state = excluded.state,
       last_summary = COALESCE(excluded.last_summary, ai_team_sessions.last_summary),
       turns = ai_team_sessions.turns + excluded.turns,
       updated_at = datetime('now')`,
  ).bind(s.session_id, s.event === 'prompt' ? s.title : null, s.branch, state, s.event === 'stop' ? s.summary : null, s.event === 'prompt' ? 1 : 0).run()
  if (Math.random() < 0.01) {
    await DB.prepare("DELETE FROM ai_team_sessions WHERE updated_at < datetime('now', '-14 days')").run()
  }
}

/** 최근 N시간 안에 움직인 세션. 'working' 인데 2시간 넘게 소식이 없으면 끊긴 것으로 본다(화면에서 idle). */
export async function listAiSessions(DB: D1Database, hours: number): Promise<AiSessionRow[]> {
  await ensure(DB)
  const h = Number.isFinite(hours) ? Math.min(Math.max(Math.trunc(hours), 1), 24 * 14) : 48
  const r = await DB.prepare(
    `SELECT session_id, title, branch,
            CASE WHEN state = 'working' AND updated_at < datetime('now','-2 hours') THEN 'idle' ELSE state END AS state,
            last_summary, turns, started_at, updated_at
       FROM ai_team_sessions WHERE updated_at >= datetime('now', ?) ORDER BY updated_at DESC LIMIT 60`,
  ).bind(`-${h} hours`).all<AiSessionRow>()
  return r.results ?? []
}
