/**
 * 🆕 2026-07-15 YouTube Data API v3 — 영상 업로드(videos.insert, resumable).
 *
 * 흐름: ① (필요 시) OAuth 액세스 토큰 리프레시 → ② resumable 세션 생성(메타데이터)
 *       → ③ 영상 바이트 PUT 업로드. 영상 파일은 공개 media_url 에서 가져온다.
 *
 * ⚠️ Cloudflare Worker 는 영상을 "렌더링"하지 못한다(ffmpeg 없음) — 이 모듈은 이미 만들어진
 *    mp4(외부 렌더 provider 또는 대표 업로드 소재)를 받아 업로드만 한다. 숏폼 크기(≤200MB) 가정.
 * 쿼터: videos.insert = 1600 units(기본 10,000/일 → 하루 ~6개).
 * docs: https://developers.google.com/youtube/v3/docs/videos/insert
 */
import type { PublishResult } from './threads-client'

const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'
const MAX_BYTES = 200 * 1024 * 1024 // 200MB 안전 상한(숏폼)

/** Google OAuth refresh_token → 새 access_token. */
export async function refreshGoogleAccessToken(
  clientId: string | undefined, clientSecret: string | undefined, refreshToken: string,
): Promise<{ ok: boolean; accessToken?: string; expiresIn?: number; error?: string }> {
  if (!clientId || !clientSecret) return { ok: false, error: 'YOUTUBE_CLIENT_ID/SECRET 미설정' }
  const params = new URLSearchParams()
  params.set('client_id', clientId)
  params.set('client_secret', clientSecret)
  params.set('refresh_token', refreshToken)
  params.set('grant_type', 'refresh_token')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params.toString(),
  }).catch(() => null)
  const data = (await res?.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string } | null
  if (!res?.ok || !data?.access_token) return { ok: false, error: `토큰 리프레시 실패: ${data?.error || `HTTP ${res?.status}`}` }
  return { ok: true, accessToken: data.access_token, expiresIn: data.expires_in }
}

export interface YouTubeUploadInput {
  accessToken: string
  title: string
  description: string
  tags?: string[]
  videoUrl: string
  privacyStatus?: 'public' | 'unlisted' | 'private'
  categoryId?: string
}

export async function uploadToYouTube(input: YouTubeUploadInput): Promise<PublishResult> {
  const { accessToken, title, description, tags, videoUrl } = input
  if (!accessToken) return { ok: false, error: '유튜브 토큰이 없습니다' }
  if (!videoUrl) return { ok: false, error: '업로드할 영상 URL 이 없습니다' }
  if (!title) return { ok: false, error: '영상 제목이 없습니다' }

  // 영상 바이트 가져오기(크기 확인)
  const vidRes = await fetch(videoUrl).catch(() => null)
  if (!vidRes || !vidRes.ok) return { ok: false, error: `영상 소스 가져오기 실패(HTTP ${vidRes?.status || 'network'})` }
  const contentType = vidRes.headers.get('content-type') || 'video/*'
  const buf = await vidRes.arrayBuffer().catch(() => null)
  if (!buf) return { ok: false, error: '영상 다운로드 실패' }
  if (buf.byteLength > MAX_BYTES) return { ok: false, error: `영상이 너무 큽니다(${Math.round(buf.byteLength / 1024 / 1024)}MB > 200MB)` }

  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description: (description || '').slice(0, 5000),
      tags: (tags || []).slice(0, 15),
      categoryId: input.categoryId || '22', // People & Blogs
    },
    status: {
      privacyStatus: input.privacyStatus || 'private', // 기본 비공개 — 관리자가 확인 후 공개 전환
      selfDeclaredMadeForKids: false,
    },
  }

  // ① resumable 세션 생성
  const initRes = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(buf.byteLength),
      'x-upload-content-type': contentType,
    },
    body: JSON.stringify(metadata),
  }).catch(() => null)
  if (!initRes || !initRes.ok) {
    const err = (await initRes?.json().catch(() => null)) as { error?: { message?: string } } | null
    return { ok: false, error: `유튜브 업로드 세션 실패: ${err?.error?.message || `HTTP ${initRes?.status || 'network'}`}` }
  }
  const sessionUrl = initRes.headers.get('location')
  if (!sessionUrl) return { ok: false, error: '유튜브 업로드 세션 URL 없음' }

  // ② 영상 바이트 PUT
  const putRes = await fetch(sessionUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType, 'content-length': String(buf.byteLength) },
    body: buf,
  }).catch(() => null)
  if (!putRes || !putRes.ok) {
    const err = (await putRes?.json().catch(() => null)) as { error?: { message?: string } } | null
    return { ok: false, error: `유튜브 업로드 실패: ${err?.error?.message || `HTTP ${putRes?.status || 'network'}`}` }
  }
  const data = (await putRes.json().catch(() => null)) as { id?: string } | null
  if (!data?.id) return { ok: false, error: '유튜브 응답에 영상 ID 없음' }
  return { ok: true, externalId: data.id, externalUrl: `https://youtu.be/${data.id}` }
}
