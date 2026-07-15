/**
 * 🆕 2026-07-15 소셜 자동화 — 유튜브 숏폼 영상 "기획"(스토리보드/대본) 자동 생성.
 *
 * AI 가 만드는 건 **영상 기획**(장면별 내레이션·자막·비주얼 지시 + 제목/설명/태그)이다.
 * 실제 픽셀 렌더는 Worker 가 못 하므로 social-video-render(외부 provider)가 담당한다.
 * blog-ai 와 동일 grounding(PROMO_BRIEF) + 사람 톤(HUMAN_VOICE_RULES) + findForbidden 검증.
 */
import { PROMO_BRIEF, HUMAN_VOICE_RULES, findForbidden, type PromoTopic } from './social-brief'

export interface StoryboardScene {
  narration: string       // 나레이션(TTS/자막용)
  onScreenText: string    // 화면 자막(짧게)
  visualDirection: string // 비주얼 지시(어떤 화면/이미지)
  durationSec: number     // 장면 길이(초)
}
export interface Storyboard {
  title: string           // 영상 제목
  description: string      // 유튜브 설명란
  hashtags: string[]
  scenes: StoryboardScene[]
}

const VIDEO_SYSTEM = [
  PROMO_BRIEF,
  '',
  '## 사람처럼 쓰기(필수)', HUMAN_VOICE_RULES,
  '',
  '## 임무: 유어딜 홍보 세로 숏폼 영상(릴스/쇼츠 겸용, 9:16, 20~40초) 기획',
  '릴스·쇼츠에 그대로 올릴 수 있게 세로 화면 기준으로 설계한다. 3~6개 장면으로 나눠 각 장면의 나레이션·화면자막·비주얼을 정한다. 첫 3초 훅이 스크롤을 멈추게 하고, 자막만 봐도 이해되게(무음 시청 대비).',
  '나레이션은 말하듯 자연스럽게(광고 성우 톤 X). 화면자막은 8자 내외로 짧게.',
  '반드시 아래 JSON 만 출력(다른 말·코드펜스 X):',
  '{"title":"영상 제목(60자 이내)","description":"설명란(첫 줄 핵심+마지막 줄 유어딜 안내)","hashtags":["태그6~10개(#없이)"],"scenes":[{"narration":"...","onScreenText":"...","visualDirection":"...","durationSec":5}]}',
].join('\n')

function parseStoryboard(raw: string): Storyboard | null {
  let s = (raw || '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{'); const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  try {
    const o = JSON.parse(s) as Record<string, unknown>
    const title = String(o.title || '').trim()
    const description = String(o.description || '').trim()
    const hashtags = Array.isArray(o.hashtags) ? o.hashtags.map((t: unknown) => String(t).trim().replace(/^#/, '')).filter(Boolean).slice(0, 12) : []
    const scenesRaw: unknown[] = Array.isArray(o.scenes) ? o.scenes : []
    const scenes: StoryboardScene[] = scenesRaw.slice(0, 8).map((x: unknown) => {
      const sc = x as Record<string, unknown>
      const dur = Number(sc.durationSec)
      return {
        narration: String(sc.narration || '').trim(),
        onScreenText: String(sc.onScreenText || '').trim(),
        visualDirection: String(sc.visualDirection || '').trim(),
        durationSec: Number.isFinite(dur) && dur > 0 ? Math.min(15, Math.max(1, Math.round(dur))) : 5,
      }
    }).filter((sc) => sc.narration || sc.onScreenText)
    if (!title || scenes.length === 0) return null
    return { title, description, hashtags, scenes }
  } catch { return null }
}

async function callClaudeRaw(apiKey: string, user: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 1600, system: VIDEO_SYSTEM, messages: [{ role: 'user', content: user }] }),
  }).catch(() => null)
  if (!res || !res.ok) return null
  const data = (await res.json().catch(() => null)) as { content?: Array<{ text?: string }> } | null
  const text = (data?.content || []).map((b) => b.text || '').join('').trim()
  return text || null
}

/** 주제로 숏폼 스토리보드 1개 생성. 운영정보/폐기어 감지 시 폐기(1회 재시도). */
export async function generateStoryboard(
  apiKey: string | undefined, topic: PromoTopic,
): Promise<{ ok: true; storyboard: Storyboard } | { ok: false; error: string }> {
  if (!apiKey) return { ok: false, error: 'NOT_CONFIGURED' }
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = [
      `아래 주제로 유어딜 홍보 유튜브 숏폼 기획을 만들어줘.`,
      `- 주제: ${topic.title}`,
      `- 앵글: ${topic.angle}`,
      `- 추천 태그(참고): ${topic.tags.join(', ')}`,
      attempt > 0 ? '- 주의: 앞선 시도가 금지어(운영/내부 정보·폐기 용어)를 포함해 폐기됐다. 엄격히 지켜라.' : '',
    ].filter(Boolean).join('\n')
    const raw = await callClaudeRaw(apiKey, user)
    if (!raw) { if (attempt > 0) return { ok: false, error: 'AI 호출 실패' }; continue }
    const sb = parseStoryboard(raw)
    if (!sb) { if (attempt > 0) return { ok: false, error: 'AI 응답 파싱 실패' }; continue }
    const hay = `${sb.title}\n${sb.description}\n${sb.hashtags.join(' ')}\n${sb.scenes.map((s) => `${s.narration} ${s.onScreenText} ${s.visualDirection}`).join('\n')}`
    const bad = findForbidden(hay)
    if (bad) { if (attempt > 0) return { ok: false, error: `금지어 감지(${bad}) — 폐기` }; continue }
    return { ok: true, storyboard: sb }
  }
  return { ok: false, error: '스토리보드 생성 실패' }
}

/** 스토리보드를 설명란 텍스트로 요약(대본 포함) — social_posts.body 용. */
export function storyboardToBody(sb: Storyboard): string {
  const script = sb.scenes.map((s, i) => `${i + 1}. ${s.narration}${s.onScreenText ? ` (자막: ${s.onScreenText})` : ''}`).join('\n')
  return `${sb.description}\n\n[대본]\n${script}`
}
