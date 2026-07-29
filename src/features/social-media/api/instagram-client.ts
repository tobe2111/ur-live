/**
 * 🆕 2026-07-15 Instagram Graph API — 게시(피드 이미지 / 릴스 영상).
 *
 * 공식 2단계: ① 미디어 컨테이너 생성(/{ig-user}/media) → ② 발행(/{ig-user}/media_publish).
 * 인스타는 텍스트-only 불가 — image_url(피드) 또는 video_url(릴스)이 필수.
 * 미디어 URL 은 공개 접근 가능해야 함(유어딜 R2/media.ur-team.com 사용 가능).
 * 요구: 비즈니스/크리에이터 계정 + FB 페이지 연결 + instagram_content_publish 권한(앱 심사).
 * docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 */
import type { PublishResult } from './threads-client'

const BASE = 'https://graph.facebook.com/v21.0'

export interface InstagramPublishInput {
  igUserId: string       // Instagram business account id (account_ref)
  accessToken: string
  caption: string
  mediaUrl: string
  mediaKind: 'image' | 'video'  // video → 릴스(REELS)
}

/** 릴스 컨테이너는 처리 시간이 필요 — 상태가 FINISHED 될 때까지 폴링(최대 ~60s). */
async function waitForContainer(igUserId: string, containerId: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${BASE}/${encodeURIComponent(containerId)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`).catch(() => null)
    const data = (await res?.json().catch(() => null)) as { status_code?: string } | null
    const st = data?.status_code
    if (st === 'FINISHED') return { ok: true }
    if (st === 'ERROR' || st === 'EXPIRED') return { ok: false, error: `릴스 처리 실패(${st})` }
    // 처리중(IN_PROGRESS) — 잠시 대기(3s)
    await new Promise((r) => setTimeout(r, 3000))
  }
  return { ok: false, error: '릴스 처리 시간 초과' }
}

export async function publishToInstagram(input: InstagramPublishInput): Promise<PublishResult> {
  const { igUserId, accessToken, caption, mediaUrl, mediaKind } = input
  if (!igUserId || !accessToken) return { ok: false, error: '인스타 계정/토큰이 없습니다' }
  if (!mediaUrl) return { ok: false, error: '인스타는 이미지/영상 URL 이 필수입니다' }

  // ① 컨테이너 생성
  const createParams = new URLSearchParams()
  createParams.set('access_token', accessToken)
  createParams.set('caption', (caption || '').slice(0, 2200))
  if (mediaKind === 'video') { createParams.set('media_type', 'REELS'); createParams.set('video_url', mediaUrl) }
  else { createParams.set('image_url', mediaUrl) }

  const createRes = await fetch(`${BASE}/${encodeURIComponent(igUserId)}/media`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: createParams.toString(),
  }).catch(() => null)
  if (!createRes) return { ok: false, error: '인스타 API 호출 실패(네트워크)' }
  const createData = (await createRes.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null
  if (!createRes.ok || !createData?.id) {
    return { ok: false, error: `인스타 컨테이너 생성 실패: ${createData?.error?.message || `HTTP ${createRes.status}`}` }
  }
  const creationId = createData.id

  // 릴스(영상)는 처리 완료까지 대기
  if (mediaKind === 'video') {
    const wait = await waitForContainer(igUserId, creationId, accessToken)
    if (!wait.ok) return { ok: false, error: wait.error }
  }

  // ② 발행
  const pubParams = new URLSearchParams()
  pubParams.set('access_token', accessToken)
  pubParams.set('creation_id', creationId)
  const pubRes = await fetch(`${BASE}/${encodeURIComponent(igUserId)}/media_publish`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: pubParams.toString(),
  }).catch(() => null)
  if (!pubRes) return { ok: false, error: '인스타 발행 호출 실패(네트워크)' }
  const pubData = (await pubRes.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null
  if (!pubRes.ok || !pubData?.id) {
    return { ok: false, error: `인스타 발행 실패: ${pubData?.error?.message || `HTTP ${pubRes.status}`}` }
  }
  return { ok: true, externalId: pubData.id }
}
