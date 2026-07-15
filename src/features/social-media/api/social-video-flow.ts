/**
 * 🆕 2026-07-15 소셜 자동화 — 유튜브 영상 플로우(기획 → 렌더 → media_url).
 *   라우트가 호출하는 오케스트레이션. 전부 fail-soft. 유튜브 초안 전용.
 */
import type { Env } from '../../../worker/types/env'
import { generateStoryboard, storyboardToBody, type Storyboard } from './social-video'
import { submitVideoRender, pollVideoRender, videoRenderEnabled } from './social-video-render'
import { getPost, setStoryboard, setRenderSubmitted, setRenderDone, setRenderFailed } from './social-store'
import { pickTopic } from './social-draft'
import { isSocialPlatform, type SocialPlatform } from './social-brief'

// 세로 숏폼(릴스/쇼츠) 대상 플랫폼 — 유튜브(쇼츠) + 인스타(릴스).
const VIDEO_PLATFORMS: SocialPlatform[] = ['youtube', 'instagram']
function isVideoPlatform(p: string): p is SocialPlatform {
  return isSocialPlatform(p) && VIDEO_PLATFORMS.includes(p)
}

/** ① 영상 기획(스토리보드) 생성 + 저장. */
export async function generateVideoPlan(env: Env, postId: number): Promise<{ ok: boolean; error?: string; storyboard?: Storyboard }> {
  if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'NOT_CONFIGURED' }
  const post = await getPost(env.DB, postId)
  if (!post) return { ok: false, error: '초안을 찾을 수 없습니다' }
  if (!isVideoPlatform(post.platform)) return { ok: false, error: '영상 기획은 유튜브 쇼츠·인스타 릴스 초안에만 가능합니다' }
  if (post.status === 'published') return { ok: false, error: '이미 발행된 게시물입니다' }
  const topic = await pickTopic(env, post.platform, post.topic_slug || undefined)
  const gen = await generateStoryboard(env.ANTHROPIC_API_KEY, topic)
  if (!gen.ok) return { ok: false, error: gen.error }
  await setStoryboard(env.DB, postId, JSON.stringify(gen.storyboard), storyboardToBody(gen.storyboard), gen.storyboard.title, gen.storyboard.hashtags)
  return { ok: true, storyboard: gen.storyboard }
}

/** ② 스토리보드 → 영상 렌더 제출(게이트 ON + provider 필요). */
export async function startVideoRender(env: Env, postId: number): Promise<{ ok: boolean; error?: string; status?: string; url?: string }> {
  if (!videoRenderEnabled(env)) return { ok: false, error: '영상 렌더가 비활성화되어 있습니다(SOCIAL_VIDEO_ENABLED OFF)' }
  const post = await getPost(env.DB, postId)
  if (!post) return { ok: false, error: '초안을 찾을 수 없습니다' }
  if (!isVideoPlatform(post.platform)) return { ok: false, error: '유튜브 쇼츠·인스타 릴스 전용' }
  if (!post.storyboard) return { ok: false, error: '먼저 영상 기획(스토리보드)을 생성하세요' }
  let sb: Storyboard
  try { sb = JSON.parse(post.storyboard) as Storyboard } catch { return { ok: false, error: '스토리보드 파싱 실패' } }
  const r = await submitVideoRender(env, sb)
  if (!r.ok || !r.providerJobId) return { ok: false, error: r.error === 'NOT_CONFIGURED' ? '영상 렌더 provider 가 설정되지 않았습니다' : (r.error || '렌더 제출 실패') }
  // 즉시 URL 이 오면 done 처리, 아니면 processing 기록
  if (r.url && r.status === 'done') { await setRenderDone(env.DB, postId, r.url); return { ok: true, status: 'done', url: r.url } }
  await setRenderSubmitted(env.DB, postId, r.providerJobId)
  return { ok: true, status: 'processing' }
}

/** ③ 렌더 상태 폴링 → done 시 media_url 세팅. */
export async function checkVideoRender(env: Env, postId: number): Promise<{ ok: boolean; error?: string; status?: string; url?: string }> {
  const post = await getPost(env.DB, postId)
  if (!post) return { ok: false, error: '초안을 찾을 수 없습니다' }
  if (post.render_status === 'done') return { ok: true, status: 'done', url: post.media_url || undefined }
  if (!post.render_provider_job) return { ok: true, status: post.render_status || 'none' }
  const r = await pollVideoRender(env, post.render_provider_job)
  if (!r.ok) return { ok: false, error: r.error }
  if (r.status === 'done' && r.url) { await setRenderDone(env.DB, postId, r.url); return { ok: true, status: 'done', url: r.url } }
  if (r.status === 'failed') { await setRenderFailed(env.DB, postId); return { ok: true, status: 'failed' } }
  return { ok: true, status: 'processing' }
}
