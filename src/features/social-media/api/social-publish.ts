/**
 * 🆕 2026-07-15 소셜 자동화 — 발행 오케스트레이터.
 *
 * 안전 3중 조건: ① 플랫폼 킬스위치 ON(env) ② 연결된 활성 계정 존재 ③ 포스트 status='approved'.
 * CAS 선점(claimForPublish: approved→publishing, external_id IS NULL)으로 단일 실행 보장(멱등).
 * 성공 → markPublished(external_id 기록) / 실패 → markFailed(approved 로 복귀, 재시도 가능). 전부 fail-soft.
 *
 * ⚠️ 자동 발행은 하지 않는다 — 이 함수는 관리자가 명시적으로 발행 버튼을 눌렀을 때만 호출된다.
 */
import type { Env } from '../../../worker/types/env'
import { isSocialPlatform, PLATFORM_LABEL, type SocialPlatform } from './social-brief'
import {
  getPost, claimForPublish, markPublished, markFailed, getAccountForPublish, updateAccountToken,
} from './social-store'
import { publishToThreads } from './threads-client'
import { publishToInstagram } from './instagram-client'
import { uploadToYouTube, refreshGoogleAccessToken } from './youtube-upload'

/** 플랫폼 킬스위치 — 기본 OFF. */
export function isPlatformEnabled(env: Env, platform: SocialPlatform): boolean {
  const e = env as unknown as Record<string, string | undefined>
  if (platform === 'threads') return e.SOCIAL_THREADS_ENABLED === 'true'
  if (platform === 'instagram') return e.SOCIAL_INSTAGRAM_ENABLED === 'true'
  if (platform === 'youtube') return e.SOCIAL_YOUTUBE_ENABLED === 'true'
  return false
}

export interface PublishOutcome { ok: boolean; externalId?: string; externalUrl?: string; error?: string }

/** 초안 본문 + 해시태그를 플랫폼 게시 텍스트로 합친다. */
function composeText(body: string, hashtags: string[]): string {
  const tags = (hashtags || []).filter(Boolean).map((t) => `#${t.replace(/^#/, '')}`).join(' ')
  return tags ? `${body}\n\n${tags}` : body
}

export async function publishPost(env: Env, postId: number): Promise<PublishOutcome> {
  const DB = env.DB
  const post = await getPost(DB, postId)
  if (!post) return { ok: false, error: '초안을 찾을 수 없습니다' }
  if (post.status === 'published' && post.external_id) {
    return { ok: true, externalId: post.external_id, externalUrl: post.external_url || undefined } // 멱등
  }
  if (post.status !== 'approved') return { ok: false, error: `발행 가능한 상태가 아닙니다(현재: ${post.status}). 먼저 승인하세요.` }
  if (!isSocialPlatform(post.platform)) return { ok: false, error: '알 수 없는 플랫폼' }
  const platform = post.platform

  if (!isPlatformEnabled(env, platform)) {
    return { ok: false, error: `${PLATFORM_LABEL[platform]} 발행이 비활성화되어 있습니다(env 킬스위치 OFF)` }
  }
  const kek = (env as unknown as { DATA_ENCRYPTION_KEY?: string }).DATA_ENCRYPTION_KEY
  const account = await getAccountForPublish(DB, kek, platform)
  if (!account || !account.access_token) {
    return { ok: false, error: `${PLATFORM_LABEL[platform]} 계정이 연결되어 있지 않습니다` }
  }

  // 미디어 요구 검증
  let hashtags: string[] = []
  try { hashtags = post.hashtags ? JSON.parse(post.hashtags) : [] } catch { hashtags = [] }
  if (platform === 'instagram' && !post.media_url) return { ok: false, error: '인스타는 이미지/영상 URL 이 필요합니다' }
  if (platform === 'youtube' && !post.media_url) return { ok: false, error: '유튜브는 영상 URL 이 필요합니다' }

  // CAS 선점 — 단일 실행 보장
  const claimed = await claimForPublish(DB, postId)
  if (!claimed) return { ok: false, error: '이미 발행 중이거나 발행된 초안입니다' }

  try {
    let result: PublishOutcome
    if (platform === 'threads') {
      const r = await publishToThreads({
        userId: account.account_ref || '', accessToken: account.access_token,
        text: composeText(post.body, hashtags), imageUrl: post.media_url || undefined,
      })
      result = r
    } else if (platform === 'instagram') {
      const r = await publishToInstagram({
        igUserId: account.account_ref || '', accessToken: account.access_token,
        caption: composeText(post.body, hashtags), mediaUrl: post.media_url || '',
        mediaKind: post.media_kind === 'video' ? 'video' : 'image',
      })
      result = r
    } else {
      // youtube — 토큰 만료 시 리프레시
      let accessToken = account.access_token
      const expired = account.token_expires_at ? Date.parse(account.token_expires_at) < Date.now() + 60_000 : false
      if (expired && account.refresh_token) {
        const e = env as unknown as { YOUTUBE_CLIENT_ID?: string; YOUTUBE_CLIENT_SECRET?: string }
        const rt = await refreshGoogleAccessToken(e.YOUTUBE_CLIENT_ID, e.YOUTUBE_CLIENT_SECRET, account.refresh_token)
        if (rt.ok && rt.accessToken) {
          accessToken = rt.accessToken
          const exp = rt.expiresIn ? new Date(Date.now() + rt.expiresIn * 1000).toISOString() : undefined
          await updateAccountToken(DB, kek, account.id, rt.accessToken, exp)
        }
      }
      const r = await uploadToYouTube({
        accessToken, title: post.title || '유어딜', description: composeText(post.body, hashtags),
        tags: hashtags, videoUrl: post.media_url || '', privacyStatus: 'private',
      })
      result = r
    }

    if (result.ok && result.externalId) {
      await markPublished(DB, postId, result.externalId, result.externalUrl || null)
      return result
    }
    await markFailed(DB, postId, result.error || '발행 실패')
    return { ok: false, error: result.error || '발행 실패' }
  } catch (e) {
    await markFailed(DB, postId, String(e).slice(0, 200))
    return { ok: false, error: '발행 중 오류가 발생했습니다' }
  }
}
