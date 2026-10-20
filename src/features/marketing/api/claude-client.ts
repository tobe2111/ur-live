/**
 * 🆕 2026-07-02 유어애즈 — Claude(Anthropic) 호출 공유 헬퍼.
 *   ai-marketer / content-studio 가 공유. 업스트림 원본 에러는 클라에 노출 안 함(상태코드 힌트만).
 *   미설정(ANTHROPIC_API_KEY 없음) 시 NOT_CONFIGURED.
 */
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export interface ClaudeResult { ok: boolean; text?: string; error?: string }

export async function callClaude(
  apiKey: string | undefined,
  opts: { system: string; user: string; maxTokens?: number; model?: string; temperature?: number },
): Promise<ClaudeResult> {
  if (!apiKey) return { ok: false, error: 'NOT_CONFIGURED' }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      max_tokens: Math.min(4000, Math.max(256, opts.maxTokens || 1400)),
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    }),
  }).catch(() => null)
  if (!res) return { ok: false, error: 'AI 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { content?: Array<{ text?: string }> } | null
  if (!res.ok) return { ok: false, error: `AI 생성에 실패했습니다 (HTTP ${res.status})` }
  const text = (data?.content || []).map(b => b.text || '').join('').trim()
  if (!text) return { ok: false, error: 'AI 응답이 비어 있습니다' }
  return { ok: true, text }
}

/** 응답에서 첫 JSON 객체를 관대하게 추출·파싱(코드펜스/서두 텍스트 허용). 실패 시 null. */
export function parseJsonLoose<T>(text: string): T | null {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(raw.slice(start, end + 1)) as T } catch { return null }
}
