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
import { createPost, countDrafts, usedTopicSlugs } from './social-store'

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

export async function createSocialDraft(env: Env, platform: SocialPlatform, topicSlug?: string): Promise<CreateDraftResult> {
  // 과다 초안 방지
  const pending = await countDrafts(env.DB, platform)
  if (pending >= MAX_PENDING) return { ok: false, skipped: `미검토 초안이 ${pending}개 — 검토 후 생성` }

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
