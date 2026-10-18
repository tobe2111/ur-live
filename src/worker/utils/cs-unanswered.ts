/**
 * 💬 2026-10-18 — 카카오 채널 봇이 **답하지 못한 질문**을 모은다 (대표 "모두 다 하자" — 자동화 ③).
 *
 * 왜: 봇은 FAQ 키워드에 안 걸리면 폴백 문구만 보내고 끝났다. 손님이 무엇을 물었는지 아무 데도
 * 남지 않아서 FAQ 를 늘릴 근거가 없었다. ⇒ 미답변 발화를 정규화해 횟수만 센다. 주간 보고 루틴이
 * 이 목록을 읽고 "FAQ 에 추가할 만한 질문" 초안을 만든다(FAQ 자체를 고치는 것은 사람이다).
 *
 * 🔒 개인정보: 봇 사용자 키는 저장하지 않는다. 발화의 숫자 4자리 이상(전화·이용권 코드·주문번호)과
 *   이메일은 가린 뒤 저장한다. 그래서 같은 질문이 번호만 달라도 한 줄로 모인다.
 * 🧱 실패해도 봇 응답에는 영향이 없다(호출부가 응답 뒤로 미루고 오류를 삼킨다).
 */

export const CS_UNANSWERED_DDL = `CREATE TABLE IF NOT EXISTS cs_unanswered_questions (
  norm TEXT PRIMARY KEY,
  sample TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now'))
)`

/** 저장하지 않는 발화 — 상담원 요청·인사·너무 짧은 말은 FAQ 후보가 아니다. */
const SKIP_RE = /^(상담원|상담사|사람|직원)|^(안녕|ㅎㅇ|하이|hi|hello|감사|고마워|ㅇㅋ|네|넵|응|ㅇㅇ)/i

/** 개인정보 가리기 + 길이 제한. 저장·표시용 샘플. */
export function maskUtterance(raw: string): string {
  return String(raw || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[이메일]')
    .replace(/\d[\d\s-]{2,}\d/g, m => (m.replace(/\D/g, '').length >= 4 ? '#' : m))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

/** 같은 질문을 한 줄로 묶는 키 — 가린 뒤 공백·문장부호 제거, 소문자. 저장할 가치가 없으면 null. */
export function normalizeUnanswered(raw: string): { norm: string; sample: string } | null {
  const sample = maskUtterance(raw)
  const norm = sample.toLowerCase().replace(/[\s.,!?~·…'"()[\]{}]+/g, '')
  if (norm.length < 2 || SKIP_RE.test(sample)) return null
  return { norm: norm.slice(0, 120), sample }
}

const ensured = new WeakSet<object>()
async function ensure(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  await DB.prepare(CS_UNANSWERED_DDL).run()
  ensured.add(DB)
}

/** 미답변 1건 기록(같은 질문이면 횟수만 +1). 실패는 호출부가 삼킨다. */
export async function recordUnanswered(DB: D1Database, utterance: string): Promise<boolean> {
  const n = normalizeUnanswered(utterance)
  if (!n) return false
  await ensure(DB)
  await DB.prepare(
    `INSERT INTO cs_unanswered_questions (norm, sample) VALUES (?, ?)
     ON CONFLICT(norm) DO UPDATE SET hits = hits + 1, last_seen = datetime('now'), sample = excluded.sample`,
  ).bind(n.norm, n.sample).run()
  return true
}

export type UnansweredRow = { sample: string; hits: number; first_seen: string; last_seen: string }

/** 최근 N일 안에 다시 물은 질문을 많이 물은 순으로. */
export async function listUnanswered(DB: D1Database, days: number, limit: number): Promise<UnansweredRow[]> {
  await ensure(DB)
  const d = Math.min(90, Math.max(1, Math.floor(days)))
  const l = Math.min(200, Math.max(1, Math.floor(limit)))
  const r = await DB.prepare(
    `SELECT sample, hits, first_seen, last_seen FROM cs_unanswered_questions
     WHERE last_seen >= datetime('now', ?) ORDER BY hits DESC, last_seen DESC LIMIT ?`,
  ).bind(`-${d} days`, l).all<UnansweredRow>()
  return r.results || []
}
