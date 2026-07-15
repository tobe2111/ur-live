/**
 * 🆕 2026-07-15 소셜 자동화 — AI 초안 생성(플랫폼별).
 *
 * blog-ai.generateBlogDraft 와 동일 철학: grounding(PROMO_BRIEF) + 출력 검증(findForbidden)으로
 * 운영/내부 정보·폐기 용어를 원천 차단. 위반 시 폐기(1회 재시도). ANTHROPIC 키 없으면 NOT_CONFIGURED.
 *
 * ⚠️ 생성 결과는 항상 draft — 이 함수는 게시하지 않는다(social-publish 가 관리자 승인 후 게시).
 */
import { socialSystemPrompt, findForbidden, type SocialPlatform, type PromoTopic } from './social-brief'

export interface SocialDraft { title: string; body: string; hashtags: string[] }

/** JSON 관대 파싱(코드펜스/서두 텍스트 허용). */
function parseSocialJson(raw: string, platform: SocialPlatform): SocialDraft | null {
  let s = (raw || '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{'); const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    const title = String(o.title || '').trim()
    const body = String(o.body || '').trim()
    const hashtags = Array.isArray(o.hashtags)
      ? o.hashtags.map((t: unknown) => String(t).trim().replace(/^#/, '')).filter(Boolean).slice(0, 15)
      : []
    if (!body) return null
    // youtube 는 제목 필수, 나머지는 title 없으면 body 앞부분으로 라벨 대체
    const finalTitle = title || (platform === 'youtube' ? '' : body.slice(0, 24))
    if (platform === 'youtube' && !finalTitle) return null
    return { title: finalTitle, body, hashtags }
  } catch {
    return null
  }
}

async function callClaudeRaw(apiKey: string, system: string, user: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  }).catch(() => null)
  if (!res || !res.ok) return null
  const data = (await res.json().catch(() => null)) as { content?: Array<{ text?: string }> } | null
  const text = (data?.content || []).map((b) => b.text || '').join('').trim()
  return text || null
}

/**
 * 플랫폼별 홍보 초안 1개 생성. 운영정보 유출/폐기어 감지 시 폐기(1회 재시도).
 */
export async function generateSocialDraft(
  apiKey: string | undefined,
  platform: SocialPlatform,
  topic: PromoTopic,
): Promise<{ ok: true; draft: SocialDraft } | { ok: false; error: string }> {
  if (!apiKey) return { ok: false, error: 'NOT_CONFIGURED' }
  const system = socialSystemPrompt(platform)

  for (let attempt = 0; attempt < 2; attempt++) {
    const user = [
      `아래 주제로 유어딜 소비자 홍보용 ${platform} 게시물 초안을 만들어줘.`,
      `- 주제: ${topic.title}`,
      `- 앵글: ${topic.angle}`,
      `- 추천 태그(참고): ${topic.tags.join(', ')}`,
      attempt > 0 ? '- 주의: 앞선 시도가 금지어(운영/내부 정보·폐기 용어)를 포함해 폐기됐다. 절대 금지 규칙을 엄격히 지켜라.' : '',
    ].filter(Boolean).join('\n')

    const raw = await callClaudeRaw(apiKey, system, user)
    if (!raw) { if (attempt > 0) return { ok: false, error: 'AI 호출 실패' }; continue }
    const draft = parseSocialJson(raw, platform)
    if (!draft) { if (attempt > 0) return { ok: false, error: 'AI 응답 파싱 실패' }; continue }
    // 운영정보/폐기어 검증 — 제목·본문·해시태그 전체
    const hay = `${draft.title}\n${draft.body}\n${draft.hashtags.join(' ')}`
    const bad = findForbidden(hay)
    if (bad) { if (attempt > 0) return { ok: false, error: `금지어 감지(${bad}) — 홍보 외 정보 유출 방지로 폐기` }; continue }
    return { ok: true, draft }
  }
  return { ok: false, error: 'AI 초안 생성 실패' }
}
