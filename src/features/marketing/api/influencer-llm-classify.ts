/**
 * 🤖 2026-07-22 인플루언서 카테고리 LLM 분류(하이브리드) — 정규식 규칙의 근본 한계(문맥 미이해·브랜드채널 오분류)를
 *   보완. 채널 이름+소개글을 Claude Haiku(저비용)에 배치로 물어 정확 분류 + **비창작자(브랜드 공식/뉴스/기관)는
 *   '해당없음' → NULL** 로 걸러냄(세븐일레븐 같은 오분류 근본 해결). 커서 기반 전 풀 순회 + cron 자동 완주.
 *
 *   게이트: ANTHROPIC_API_KEY(블로그 AI 와 동일). 상태는 platform_settings(ads_llm_recat) — active/cursor.
 *   비용: 배치 50채널/콜, 20k ≈ 400콜(Haiku ~수달러). 클릭 1회 → active=1 → cron 이 완주까지 이어받음.
 */
import type { Env } from '@/worker/types/env'
import type { D1Database } from '@cloudflare/workers-types'

// 우리 15종 카테고리(분류 규칙 SSOT 와 동일 집합). LLM 은 이 중 하나 또는 '해당없음'(비창작자)만 반환.
export const LLM_CATEGORIES = ['맛집', '카페', '푸드', '외식창업', '뷰티', '네일', '숙소', '여행', '패션', '육아', '운동', '반려동물', 'IT/재테크', '리빙', '취미'] as const
const VALID = new Set<string>(LLM_CATEGORIES)

const STATE_KEY = 'ads_llm_recat'
const HAIKU = 'claude-haiku-4-5-20251001'

interface RecatState { active: number; cursor: number; scanned: number; changed: number; skipped: number; started?: string }
const EMPTY: RecatState = { active: 0, cursor: 0, scanned: 0, changed: 0, skipped: 0 }

async function readState(DB: D1Database): Promise<RecatState> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATE_KEY).first<{ value: string }>().catch(() => null)
  if (!row?.value) return { ...EMPTY }
  try { return { ...EMPTY, ...(JSON.parse(row.value) as Partial<RecatState>) } } catch { return { ...EMPTY } }
}
async function writeState(DB: D1Database, s: RecatState): Promise<void> {
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATE_KEY, JSON.stringify(s)).run().catch(() => null)
}
export async function getLlmRecatState(DB: D1Database): Promise<RecatState> { return readState(DB) }

type ChRow = { id: number; name: string | null; description: string | null; category: string | null }

/** 채널 배치(≤50)를 Claude 에 한 번 물어 id→카테고리(또는 null=비창작자) 맵 반환. 파싱 실패/키없음 → 빈 맵(무변경). */
export async function llmClassifyBatch(apiKey: string, rows: ChRow[]): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>()
  if (!apiKey || !rows.length) return out
  const list = rows.map(r => `- id ${r.id}: 이름="${(r.name || '').slice(0, 60)}" 소개="${(r.description || '').replace(/\s+/g, ' ').slice(0, 200)}"`).join('\n')
  const system = `너는 한국 소셜미디어 채널을 유어딜 마케팅 카테고리로 분류하는 분류기다. 각 채널을 아래 카테고리 중 정확히 하나로 분류하되, 개인 창작자/인플루언서가 아니면(브랜드 공식채널·기업·프랜차이즈·편의점·뉴스/언론·방송사·정부/기관·쇼핑몰) "해당없음"으로 분류하라.
카테고리: ${LLM_CATEGORIES.join(', ')}
반드시 JSON 배열로만 응답(다른 말/설명 절대 금지): [{"id":숫자,"category":"카테고리 또는 해당없음"}]`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: HAIKU, max_tokens: 2000, system, messages: [{ role: 'user', content: `다음 ${rows.length}개 채널을 분류하라:\n${list}` }] }),
    signal: AbortSignal.timeout(30000),
  }).catch(() => null)
  if (!res || !res.ok) return out
  const data = (await res.json().catch(() => null)) as { content?: Array<{ text?: string }> } | null
  let text = (data?.content || []).map(b => b.text || '').join('').trim()
  const s = text.indexOf('['), e = text.lastIndexOf(']') // 마크다운/설명 감싸도 배열만 추출
  if (s >= 0 && e > s) text = text.slice(s, e + 1)
  let parsed: Array<{ id?: number; category?: string }> | null = null
  try { parsed = JSON.parse(text) } catch { return out }
  if (!Array.isArray(parsed)) return out
  for (const p of parsed) {
    if (typeof p?.id !== 'number') continue
    const cat = (p.category || '').trim()
    out.set(p.id, VALID.has(cat) ? cat : null) // 유효 카테고리만, '해당없음'/불명 → null(비창작자·미분류)
  }
  return out
}

/**
 * 전 풀 LLM 재분류 — 커서부터 maxChannels 개를 50씩 배치로 분류 → 변경분만 UPDATE. 끝 도달 시 active=0·cursor=0.
 *   반복 호출(cron/버튼) 시 커서 이어받아 완주. active 플래그로 cron 이 자동 계속(완료 시 정지).
 */
export async function runLlmRecategorize(env: Env, maxChannels = 500): Promise<{ processed: number; changed: number; done: boolean }> {
  const apiKey = env.ANTHROPIC_API_KEY
  const DB = env.DB
  if (!apiKey) return { processed: 0, changed: 0, done: true }
  const st = await readState(DB)
  const rows = (await DB.prepare(`SELECT id, name, description, category FROM ad_influencer_leads
      WHERE account_id = 0 AND id > ? ORDER BY id ASC LIMIT ?`).bind(st.cursor, maxChannels)
    .all<ChRow>().catch(() => null))?.results || []
  if (!rows.length) { // 끝 도달 — 완료
    await writeState(DB, { ...st, active: 0, cursor: 0 })
    return { processed: 0, changed: 0, done: true }
  }
  let processed = 0, changed = 0, lastId = st.cursor
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const verdicts = await llmClassifyBatch(apiKey, batch)
    const ups = batch
      .map(r => ({ r, cat: verdicts.has(r.id) ? verdicts.get(r.id)! : r.category })) // 무판정(파싱실패)은 기존 유지
      .filter(x => x.cat !== x.r.category)
    if (ups.length) {
      await DB.batch(ups.map(x => DB.prepare('UPDATE ad_influencer_leads SET category = ? WHERE id = ? AND account_id = 0').bind(x.cat, x.r.id))).catch(() => null)
      changed += ups.length
    }
    processed += batch.length
    lastId = batch[batch.length - 1].id
  }
  const reachedEnd = rows.length < maxChannels
  await writeState(DB, {
    active: reachedEnd ? 0 : 1, cursor: reachedEnd ? 0 : lastId,
    scanned: st.scanned + processed, changed: st.changed + changed, skipped: st.skipped, started: st.started || new Date().toISOString(),
  })
  return { processed, changed, done: reachedEnd }
}

/** 스윕 시작 — active=1·커서/집계 리셋 후 첫 배치 실행(호출부가 waitUntil 로 감쌈). */
export async function startLlmRecategorize(env: Env, maxChannels = 500): Promise<{ processed: number; changed: number; done: boolean }> {
  await writeState(env.DB, { ...EMPTY, active: 1, started: new Date().toISOString() })
  return runLlmRecategorize(env, maxChannels)
}
