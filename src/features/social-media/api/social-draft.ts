/**
 * 🆕 2026-07-15 소셜 자동화 — 초안 생성 오케스트레이션(라우트 + cron 공용).
 *
 * 주제 선택(미사용 우선) → AI 생성(검증) → draft 저장. 항상 비공개 초안(자동 발행 X).
 * 미검토 초안 과다(플랫폼별 ≥ MAX_PENDING)면 생성 중단(검토 유도).
 */
import type { Env } from '../../../worker/types/env'
import { PROMO_TOPICS, PLATFORM_MEDIA, type PromoTopic, type SocialPlatform } from './social-brief'
import { generateSocialDraft } from './social-content'
import { composeSocialDraft } from './social-compose'
import { createPost, countDrafts, usedTopicSlugs, reserveDraft, fillSupplyDraft, archivePost, audienceCounts } from './social-store'
import {
  isSocialAudience, parseAudienceMix, pickAudience, postSrcTag, linkLine, type SocialAudience,
} from './social-audience'
import { supplyFactsFromSettings, topicsFor, type SupplyAudience, type SupplyFacts } from './social-supply-brief'
import { composeSupplyDraft } from './social-supply-compose'
import { generateSupplyDraft } from './social-supply-content'
import { loadFunnel, pickTopicByPerformance, supplyScore } from './social-funnel'

const MAX_PENDING = 8 // 플랫폼별 미검토 초안 상한

/** 미사용 주제 우선 선택(다 썼으면 순환). topicSlug 지정 시 그 주제. */
export async function pickTopic(env: Env, platform: SocialPlatform, topicSlug?: string): Promise<PromoTopic> {
  if (topicSlug) {
    const t = PROMO_TOPICS.find((x) => x.slug === topicSlug)
    if (t) return t
  }
  const used = new Set(await usedTopicSlugs(env.DB, platform))
  const fresh = PROMO_TOPICS.find((t) => !used.has(t.slug))
  if (fresh) return fresh
  // 전부 사용됨 → 가장 오래된 순환(첫 항목). 중복 주제는 다른 앵글로 재생성됨.
  return PROMO_TOPICS[0]
}

export type CreateDraftResult =
  | { ok: true; id: number; title: string; platform: SocialPlatform }
  | { ok: false; error?: string; skipped?: string }

/** 공급 마케터가 읽는 설정 키(전부 어드민 `platform_settings` — 코드 수정 없이 바꾼다). */
const SUPPLY_SETTING_KEYS = [
  'social_audience_mix', 'fee_channel_rates_enabled', 'platform_fee_pct_direct', 'platform_fee_pct_brokered', 'commission_rate_default',
] as const

async function readSettings(DB: D1Database): Promise<Record<string, string>> {
  const marks = SUPPLY_SETTING_KEYS.map(() => '?').join(',')
  const r = await DB.prepare(`SELECT key, value FROM platform_settings WHERE key IN (${marks})`)
    .bind(...SUPPLY_SETTING_KEYS).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
  const out: Record<string, string> = {}
  for (const row of r.results || []) out[row.key] = row.value
  return out
}

/** 대상별 주제 사용량·성과(채널 무관). 인스타는 게시물 단위 귀속이 없어 성과 0 으로 센다(게시물 수만). */
async function topicUsage(DB: D1Database, audience: SupplyAudience): Promise<Record<string, { posts: number; score: number }>> {
  const posts = await DB.prepare(
    `SELECT topic_slug, src_tag, platform FROM social_posts WHERE audience = ? AND status != 'archived' AND topic_slug IS NOT NULL`
  ).bind(audience).all<{ topic_slug: string; src_tag: string | null; platform: string }>().catch(() => ({ results: [] as { topic_slug: string; src_tag: string | null; platform: string }[] }))
  const funnel = new Map((await loadFunnel(DB)).map((r) => [r.src, supplyScore(r)]))
  const usage: Record<string, { posts: number; score: number }> = {}
  for (const p of posts.results || []) {
    const u = (usage[p.topic_slug] ||= { posts: 0, score: 0 })
    u.posts += 1
    if (p.platform !== 'instagram' && p.src_tag) u.score += funnel.get(p.src_tag) ?? 0
  }
  return usage
}

/**
 * 🎯 2026-10-15 공급(매장 사장님·소개 파트너) 초안 1개. 항상 비공개 draft — 발행은 별도 승인.
 * 순서: 번호 예약 → 그 번호로 유입 태그·링크 → (키 있으면 LLM, 없거나 실패면 결정론 작성기) → 채우기.
 */
export async function createSupplyDraft(
  env: Env, platform: SocialPlatform, audience: SupplyAudience, facts: SupplyFacts, topicSlug?: string, nonce = 0,
): Promise<CreateDraftResult> {
  const topics = topicsFor(audience)
  const topic = (topicSlug && topics.find((t) => t.slug === topicSlug))
    || pickTopicByPerformance(topics, await topicUsage(env.DB, audience))
  const id = await reserveDraft(env.DB, platform, audience, topic.slug)
  if (!id) return { ok: false, error: '초안 저장 실패' }
  const src = postSrcTag(platform, id)
  const link = linkLine(platform, audience, src)
  const gen = env.ANTHROPIC_API_KEY
    ? await generateSupplyDraft(env.ANTHROPIC_API_KEY, platform, audience, topic, facts, link)
    : { ok: false as const, error: 'NOT_CONFIGURED' }
  const composed = gen.ok ? gen : composeSupplyDraft(platform, audience, topic, facts, link, nonce)
  if (!composed.ok) { await archivePost(env.DB, id); return { ok: false, error: composed.error } }
  await fillSupplyDraft(env.DB, id, {
    title: composed.draft.title, body: composed.draft.body, hashtags: composed.draft.hashtags,
    media_kind: PLATFORM_MEDIA[platform], ai_generated: gen.ok, src_tag: src,
  })
  return { ok: true, id, title: composed.draft.title, platform }
}

export async function createSocialDraft(
  env: Env, platform: SocialPlatform, topicSlug?: string, audienceArg?: SocialAudience,
): Promise<CreateDraftResult> {
  // 과다 초안 방지
  const pending = await countDrafts(env.DB, platform)
  if (pending >= MAX_PENDING) return { ok: false, skipped: `미검토 초안이 ${pending}개 — 검토 후 생성` }

  // 🎯 2026-10-15 대상 고르기 — 지정이 없으면 어드민 혼합비(기본 매장 3 : 소개 파트너 2 : 손님 0)에서 가장 모자란 쪽.
  const settings = await readSettings(env.DB)
  const audience: SocialAudience = isSocialAudience(audienceArg)
    ? audienceArg
    : pickAudience(parseAudienceMix(settings.social_audience_mix), await audienceCounts(env.DB))
  if (audience !== 'consumer') {
    return createSupplyDraft(env, platform, audience, supplyFactsFromSettings(settings), topicSlug, pending)
  }

  const topic = await pickTopic(env, platform, topicSlug)

  // ✍️ 2026-08-01 (대표 "앤트로픽 없이도 초안 최대한 자연스럽게"): 키가 없으면 실패시키지 않고
  //   결정론 작성기(social-compose)로 만든다. 리뷰 생성기(buildStoreReviews)와 같은 구조 —
  //   키 있으면 Claude, 없으면 조합형. 두 경로 모두 같은 findForbidden 검증을 통과한다.
  //   AI 실패(호출/파싱/금지어)도 조용히 죽지 않고 조합형으로 내려간다.
  const gen = env.ANTHROPIC_API_KEY
    ? await generateSocialDraft(env.ANTHROPIC_API_KEY, platform, topic)
    : { ok: false as const, error: 'NOT_CONFIGURED' }
  const composed = gen.ok ? gen : composeSocialDraft(platform, topic, pending)
  if (!composed.ok) return { ok: false, error: composed.error }
  const usedAi = gen.ok

  const created = await createPost(env.DB, {
    platform, topic_slug: topic.slug, title: composed.draft.title, body: composed.draft.body,
    hashtags: composed.draft.hashtags, media_kind: PLATFORM_MEDIA[platform], ai_generated: usedAi,
  })
  if (!created.ok || !created.id) return { ok: false, error: created.error || '저장 실패' }
  return { ok: true, id: created.id, title: composed.draft.title, platform }
}
