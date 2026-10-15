/**
 * 🤖 2026-10-15 공급 모으기 — LLM 경로(키가 있을 때만). 키가 없거나 실패하면 호출부가 결정론 작성기로 내려간다.
 *
 * 손님용(`social-content.ts`)과 같은 골격이고 차이는 두 가지다:
 *   ① 브리프 — `supplyBrief()`(라이브 설정값으로 만든 사실)
 *   ② 검증 — `findSupplyViolation()`(꺼진 혜택·규모 과장·**설정에 없는 퍼센트**를 거른다)
 * 링크 줄은 모델이 쓰지 않는다 — 주소를 지어내면 귀속이 깨지므로 호출부가 본문 끝에 붙인다.
 */
import { HUMAN_VOICE_RULES, platformFormatRules, type SocialPlatform, type PromoTopic } from './social-brief'
import { callClaudeRaw, parseSocialJson, type SocialDraft } from './social-content'
import { supplyBrief, findSupplyViolation, type SupplyAudience, type SupplyFacts } from './social-supply-brief'
import { AUDIENCE_LABEL } from './social-audience'

/** 링크 줄을 붙일 자리를 남긴 본문 상한. */
const BODY_BUDGET: Record<SocialPlatform, number> = { threads: 380, instagram: 220, youtube: 1200 }

export function supplySystemPrompt(platform: SocialPlatform, audience: SupplyAudience, facts: SupplyFacts): string {
  return [
    `너는 유어딜(동네 가게 이용권 플랫폼)의 마케터다. 이번 글은 ${AUDIENCE_LABEL[audience]}에게 말한다.`,
    supplyBrief(audience, facts),
    `## 사람처럼 쓰기(필수)\n${HUMAN_VOICE_RULES}`,
    '- 주소(URL)를 쓰지 마라. 링크는 시스템이 붙인다.',
    `- 본문은 ${BODY_BUDGET[platform]}자 이내.`,
    `## 출력 형식\n${platformFormatRules(platform)}`,
  ].join('\n\n')
}

export async function generateSupplyDraft(
  apiKey: string | undefined,
  platform: SocialPlatform,
  audience: SupplyAudience,
  topic: PromoTopic,
  facts: SupplyFacts,
  link: string,
): Promise<{ ok: true; draft: SocialDraft } | { ok: false; error: string }> {
  if (!apiKey) return { ok: false, error: 'NOT_CONFIGURED' }
  const system = supplySystemPrompt(platform, audience, facts)
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = [
      `주제: ${topic.title}`,
      `앵글: ${topic.angle}`,
      `추천 태그(참고): ${topic.tags.join(', ')}`,
      attempt > 0 ? '주의: 앞선 시도가 금지 규칙(없는 혜택·규모·설정에 없는 숫자)을 어겨 폐기됐다. 브리프에 있는 사실만 써라.' : '',
    ].filter(Boolean).join('\n')
    const raw = await callClaudeRaw(apiKey, system, user)
    if (!raw) continue
    const parsed = parseSocialJson(raw, platform)
    if (!parsed) continue
    if (/https?:\/\//i.test(parsed.body)) continue
    const body = `${parsed.body.trim()}${platform === 'youtube' ? '\n' : '\n\n'}${link}`
    const limit = platform === 'threads' ? 500 : platform === 'instagram' ? 300 : 5000
    if (body.length > limit) continue
    const draft = { ...parsed, body }
    if (findSupplyViolation(`${draft.title}\n${draft.body}\n${draft.hashtags.join(' ')}`, audience, facts)) continue
    return { ok: true, draft }
  }
  return { ok: false, error: 'AI 초안 생성 실패' }
}
