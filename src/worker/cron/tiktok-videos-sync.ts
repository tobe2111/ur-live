/**
 * TikTok 비디오 자동 sync cron (T2)
 *
 * 매일 18:30 UTC 실행 — daily heavy task 그룹 직후 (정산 후, 한가한 시간).
 * 활성 연동 셀러 의 TikTok Display API 호출 → tiktok_videos_cache UPSERT.
 *
 * Rate limit 고려:
 *   - TikTok Display API: 6/min/app, 600/day/user
 *   - 매일 1회 sync × N 셀러 → 600 한도 안에 들어옴
 *   - 토큰 만료 셀러는 skip (403 응답 감지)
 *
 * 작성: 2026-04-26 (T2)
 * 마이그레이션: 0220 (seller_platform_links), 0221 (tiktok_videos_cache)
 */

import type { Env } from '../types/env'

const TIKTOK_VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/'

interface SellerLink {
  seller_id: number
  access_token: string
  token_expires_at: string | null
}

interface TikTokVideo {
  id: string
  title?: string
  cover_image_url?: string
  share_url?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
  create_time?: number
}

export async function handleTikTokVideosSync(env: Env): Promise<{
  sellers_synced: number
  videos_upserted: number
  errors: number
  expired: number
}> {
  const DB = env.DB
  let sellersSynced = 0
  let videosUpserted = 0
  let errors = 0
  let expired = 0

  let links: SellerLink[] = []
  try {
    const r = await DB.prepare(`
      SELECT seller_id, access_token, token_expires_at
      FROM seller_platform_links
      WHERE platform = 'tiktok' AND status = 'active' AND access_token IS NOT NULL
      LIMIT 200
    `).all<SellerLink>()
    links = r.results || []
  } catch {
    console.warn('[cron:tiktok-videos-sync] migration 0220 not applied')
    return { sellers_synced: 0, videos_upserted: 0, errors: 0, expired: 0 }
  }

  const now = new Date()

  for (const link of links) {
    // 토큰 만료 체크
    if (link.token_expires_at && new Date(link.token_expires_at) < now) {
      await DB.prepare(
        "UPDATE seller_platform_links SET status = 'expired' WHERE seller_id = ? AND platform = 'tiktok'"
      ).bind(link.seller_id).run().catch(() => {})
      expired++
      continue
    }

    try {
      const fields = 'id,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time'
      const res = await fetch(`${TIKTOK_VIDEO_LIST_URL}?fields=${fields}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${link.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ max_count: 20 }),
        signal: AbortSignal.timeout(8000),
      })

      if (res.status === 401 || res.status === 403) {
        await DB.prepare(
          "UPDATE seller_platform_links SET status = 'expired', sync_error = ? WHERE seller_id = ? AND platform = 'tiktok'"
        ).bind(`HTTP ${res.status}`, link.seller_id).run().catch(() => {})
        expired++
        continue
      }

      if (!res.ok) {
        errors++
        continue
      }

      const json: any = await res.json()
      const videos: TikTokVideo[] = json?.data?.videos || []

      for (const v of videos) {
        if (!v.id) continue
        try {
          await DB.prepare(`
            INSERT INTO tiktok_videos_cache
              (seller_id, video_id, title, cover_image_url, share_url,
               view_count, like_count, comment_count, share_count,
               tiktok_create_time, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT (seller_id, video_id) DO UPDATE SET
              title = excluded.title,
              cover_image_url = excluded.cover_image_url,
              share_url = excluded.share_url,
              view_count = excluded.view_count,
              like_count = excluded.like_count,
              comment_count = excluded.comment_count,
              share_count = excluded.share_count,
              fetched_at = excluded.fetched_at
          `).bind(
            link.seller_id, v.id,
            v.title ?? null, v.cover_image_url ?? null, v.share_url ?? null,
            v.view_count ?? 0, v.like_count ?? 0,
            v.comment_count ?? 0, v.share_count ?? 0,
            v.create_time ?? null,
          ).run()
          videosUpserted++
        } catch {
          // 0221 미적용 시
        }
      }

      await DB.prepare(
        "UPDATE seller_platform_links SET last_synced_at = datetime('now'), sync_error = NULL WHERE seller_id = ? AND platform = 'tiktok'"
      ).bind(link.seller_id).run().catch(() => {})
      sellersSynced++
    } catch (e) {
      errors++
      console.error(`[cron:tiktok-videos-sync] seller=${link.seller_id} failed:`, e)
    }
  }

  return { sellers_synced: sellersSynced, videos_upserted: videosUpserted, errors, expired }
}
