/**
 * 🛡️ 2026-04-28 TD-006 (split): YouTube Live 관리 API (5 endpoints)
 *
 * 원본: youtube.routes.ts (467-925).
 *
 * - POST   /live/create                    — YouTube live 생성 + RTMP key 저장
 * - POST   /live/:id/start                 — 라이브 시작 (transition + scheduled→live)
 * - GET    /live/:id/status                — 라이브 상태 조회
 * - GET    /live/:id/youtube-stats         — YouTube 측 시청자/조회 수
 * - POST   /live/:id/end                   — 라이브 종료 (live→complete + 종료 메타)
 *
 * 마운트: app.route('/api/youtube/live', youtubeLiveRoutes) — 또는 동일 prefix.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { swallow } from '@/worker/utils/swallow'
import { YouTubeAPIService } from '../services/youtube-api.service'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { ensureYouTubeTables, getValidAccessToken } from './youtube.routes'

const app = new Hono<{ Bindings: Env }>()
app.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

app.post('/live/create', async (c) => {
  await ensureYouTubeTables(c.env.DB)
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  
  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  const { title, description, thumbnail_url, product_ids, scheduled_start_time, privacy_status, channel_id } = await c.req.json()

  if (!title) {
    return c.json({
      success: false,
      error: 'Title is required'
    }, 400)
  }

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'YouTube API not configured'
    }, 500)
  }

  const privacyStatus: 'public' | 'unlisted' | 'private' =
    privacy_status === 'unlisted' || privacy_status === 'private' ? privacy_status : 'public'

  try {
    const youtubeService = new YouTubeAPIService(clientId, clientSecret)

    // Get valid access token (channel_id로 특정 채널 지정 가능)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService, channel_id)

    if (!accessToken) {
      return c.json({
        success: false,
        error: 'YouTube authentication required',
        error_code: 'YOUTUBE_AUTH_REQUIRED'
      }, 401)
    }

    // Create YouTube live setup
    const scheduledTime = scheduled_start_time || new Date().toISOString()

    // Check if seller has a persistent stream key (OBS/Prism set once)
    const sellerAuth = channel_id
      ? await c.env.DB.prepare(`
          SELECT default_stream_id, default_rtmp_url, default_rtmp_key
          FROM seller_youtube_oauth
          WHERE seller_id = ? AND id = ? AND is_active = 1
          LIMIT 1
        `).bind(sellerId, channel_id).first() as any
      : await c.env.DB.prepare(`
          SELECT default_stream_id, default_rtmp_url, default_rtmp_key
          FROM seller_youtube_oauth
          WHERE seller_id = ? AND is_active = 1
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(sellerId).first() as any

    let liveSetup
    if (sellerAuth?.default_stream_id) {
      // Reuse persistent stream (no new RTMP key needed)
      liveSetup = await youtubeService.setupLiveStreamWithPersistentStream(
        accessToken,
        title,
        description || '',
        sellerAuth.default_stream_id,
        scheduledTime,
        privacyStatus
      )
    } else {
      // First time or no persistent stream — create new + save as default
      liveSetup = await youtubeService.setupLiveStream(
        accessToken,
        title,
        description || '',
        scheduledTime,
        privacyStatus
      )

      // Save as persistent stream for the specific channel (or active default)
      if (channel_id) {
        await c.env.DB.prepare(`
          UPDATE seller_youtube_oauth
          SET default_stream_id = ?, default_rtmp_url = ?, default_rtmp_key = ?, updated_at = CURRENT_TIMESTAMP
          WHERE seller_id = ? AND id = ? AND is_active = 1
        `).bind(liveSetup.stream.id, liveSetup.rtmpUrl, liveSetup.rtmpKey, sellerId, channel_id).run()
      } else {
        await c.env.DB.prepare(`
          UPDATE seller_youtube_oauth
          SET default_stream_id = ?, default_rtmp_url = ?, default_rtmp_key = ?, updated_at = CURRENT_TIMESTAMP
          WHERE seller_id = ? AND is_active = 1
        `).bind(liveSetup.stream.id, liveSetup.rtmpUrl, liveSetup.rtmpKey, sellerId).run()
      }
    }

    // Save to database
    const streamResult = await c.env.DB.prepare(`
      INSERT INTO live_streams (
        seller_id, title, description, status, thumbnail_url,
        youtube_video_id, youtube_broadcast_id, youtube_stream_key, youtube_live_chat_id,
        rtmp_url, rtmp_key, youtube_embed_url,
        scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      sellerId,
      title,
      description || '',
      'scheduled',
      thumbnail_url || null,
      liveSetup.broadcast.id,
      liveSetup.broadcast.id,
      liveSetup.stream.ingestionInfo.streamName,
      liveSetup.broadcast.liveChatId || null,
      liveSetup.rtmpUrl,
      liveSetup.rtmpKey,
      liveSetup.embedUrl,
      scheduledTime
    ).run()

    const streamId = streamResult.meta.last_row_id

    // Link products + 첫 상품 이미지를 방송 썸네일로 설정
    if (product_ids && product_ids.length > 0) {
      for (const productId of product_ids) {
        await c.env.DB.prepare(`
          INSERT INTO stream_products (stream_id, product_id, created_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(streamId, productId).run()
      }

      // 첫 번째 상품 이미지 → 방송 썸네일 + current_product_id 설정
      try {
        const firstProduct = await c.env.DB.prepare(
          'SELECT id, image_url FROM products WHERE id = ?'
        ).bind(product_ids[0]).first<{ id: number; image_url: string }>()

        if (firstProduct?.image_url) {
          await c.env.DB.prepare(
            "UPDATE live_streams SET thumbnail_url = ?, current_product_id = ? WHERE id = ?"
          ).bind(firstProduct.image_url, firstProduct.id, streamId).run()
        }
      } catch { /* thumbnail 컬럼 없을 수 있음 */ }
    }

    return c.json({
      success: true,
      data: {
        stream_id: streamId,
        youtube_url: liveSetup.youtubeUrl,
        embed_url: liveSetup.embedUrl,
        rtmp_url: liveSetup.rtmpUrl,
        rtmp_key: liveSetup.rtmpKey,
        broadcast: liveSetup.broadcast,
        stream: liveSetup.stream
      }
    })
  } catch (error: unknown) {
    console.error('[YouTube Live Create] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create live stream'
    }, 500)
  }
})

/**
 * POST /api/youtube/live/:id/start
 * Transition broadcast to live
 */
app.post('/live/:id/start', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  
  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  const streamId = parseInt(c.req.param('id'))

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'YouTube API not configured'
    }, 500)
  }

  try {
    // Get stream info
    const stream = await c.env.DB.prepare(`
      SELECT * FROM live_streams WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first()

    if (!stream) {
      return c.json({
        success: false,
        error: 'Stream not found'
      }, 404)
    }

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    
    if (!accessToken) {
      return c.json({
        success: false,
        error: 'YouTube authentication required'
      }, 401)
    }

    // Check if YouTube already auto-started (enableAutoStart: true)
    const broadcast = await youtubeService.getBroadcast(accessToken, stream.youtube_broadcast_id as string)

    if (broadcast.status === 'live') {
      // Already live (auto-started by OBS/Prism RTMP) — just sync DB
      await c.env.DB.prepare(`
        UPDATE live_streams
        SET status = 'live', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(streamId).run()

      return c.json({ success: true, message: 'Stream is already live (auto-started)' })
    }

    // Not yet live — manually transition
    try {
      await youtubeService.transitionBroadcastToLive(accessToken, stream.youtube_broadcast_id as string)
    } catch (transitionError: unknown) {
      // If transition fails (e.g., no RTMP data yet), still update DB
      console.warn('[YouTube Live Start] Transition warning:', transitionError)
    }

    // Update database
    await c.env.DB.prepare(`
      UPDATE live_streams
      SET status = 'live', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(streamId).run()

    return c.json({ success: true, message: 'Stream is now live' })
  } catch (error: unknown) {
    console.error('[YouTube Live Start] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start stream'
    }, 500)
  }
})

/**
 * GET /api/youtube/live/:id/status
 * Check YouTube broadcast status and auto-sync to DB
 * Used by frontend polling to detect when OBS/Prism starts streaming
 */
app.get('/live/:id/status', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)

  if (!sellerId) {
    return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  }

  const streamId = parseInt(c.req.param('id'))
  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return c.json({ success: false, error: 'YouTube API not configured' }, 500)
  }

  try {
    const stream = await c.env.DB.prepare(`
      SELECT * FROM live_streams WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first()

    if (!stream) {
      return c.json({ success: false, error: 'Stream not found' }, 404)
    }

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)

    if (!accessToken) {
      return c.json({ success: false, error: 'YouTube authentication required' }, 401)
    }

    // Check YouTube broadcast status
    const broadcast = await youtubeService.getBroadcast(accessToken, stream.youtube_broadcast_id as string)
    const ytStatus = broadcast.status

    // Auto-sync: YouTube says live but our DB says scheduled → update DB
    if (ytStatus === 'live' && stream.status === 'scheduled') {
      await c.env.DB.prepare(`
        UPDATE live_streams
        SET status = 'live', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(streamId).run()

      return c.json({
        success: true,
        data: { status: 'live', youtube_status: ytStatus, synced: true }
      })
    }

    // Auto-sync: YouTube says complete but our DB says live → update DB
    if (ytStatus === 'complete' && stream.status === 'live') {
      await c.env.DB.prepare(`
        UPDATE live_streams
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(streamId).run()

      return c.json({
        success: true,
        data: { status: 'ended', youtube_status: ytStatus, synced: true }
      })
    }

    return c.json({
      success: true,
      data: { status: stream.status, youtube_status: ytStatus, synced: false }
    })
  } catch (error: unknown) {
    console.error('[YouTube Live Status] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check status'
    }, 500)
  }
})

/**
 * GET /api/youtube/live/:id/youtube-stats
 * YouTube Live API 로부터 실시간 시청자/좋아요 등 조회.
 * Step 3 대시보드에서 OBS 미연결 사용자도 metrics 확인 가능.
 */
app.get('/live/:id/youtube-stats', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'YouTube API not configured' }, 500)

  try {
    const stream = await c.env.DB.prepare(
      'SELECT youtube_video_id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ youtube_video_id: string }>()
    if (!stream?.youtube_video_id) return c.json({ success: false, error: 'Stream not found' }, 404)

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    if (!accessToken) return c.json({ success: false, error: 'YouTube auth required' }, 401)

    // videos.list 로 liveStreamingDetails + statistics 조회
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,statistics&id=${stream.youtube_video_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return c.json({ success: false, error: `YouTube API ${res.status}` }, 500)
    const data = await res.json() as { items?: Array<{ liveStreamingDetails?: { concurrentViewers?: string; actualStartTime?: string }; statistics?: { viewCount?: string; likeCount?: string } }> }
    const item = data.items?.[0]

    return c.json({
      success: true,
      data: {
        concurrent_viewers: parseInt(item?.liveStreamingDetails?.concurrentViewers || '0'),
        total_views: parseInt(item?.statistics?.viewCount || '0'),
        like_count: parseInt(item?.statistics?.likeCount || '0'),
        actual_start_time: item?.liveStreamingDetails?.actualStartTime,
      }
    })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * POST /api/youtube/live/:id/end
 * End broadcast
 */
app.post('/live/:id/end', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  
  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  const streamId = parseInt(c.req.param('id'))

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'YouTube API not configured'
    }, 500)
  }

  try {
    const stream = await c.env.DB.prepare(`
      SELECT * FROM live_streams WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first()

    if (!stream) {
      return c.json({
        success: false,
        error: 'Stream not found'
      }, 404)
    }

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    
    if (!accessToken) {
      return c.json({
        success: false,
        error: 'YouTube authentication required'
      }, 401)
    }

    // End broadcast
    await youtubeService.endBroadcast(accessToken, stream.youtube_broadcast_id as string)

    // Update database
    await c.env.DB.prepare(`
      UPDATE live_streams 
      SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(streamId).run()

    return c.json({
      success: true,
      message: 'Stream ended successfully'
    })
  } catch (error: unknown) {
    console.error('[YouTube Live End] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end stream'
    }, 500)
  }
})

/**
 * GET /api/youtube/live/:id/chat?nextPageToken=...
 *
 * 🛡️ 2026-05-07: YouTube Live Chat ↔ 우리 채팅 동기화 (proxy).
 *
 * YouTube Live Chat API 는 셀러의 OAuth 토큰으로 호출. 시청자 측에서 직접 호출 시
 * 토큰 노출 — 그래서 서버 proxy 로 처리. 클라이언트는 nextPageToken 만 들고 polling.
 *
 * Quota 주의: 5건 / poll 호출. 권장 polling 간격 5-10초.
 */
app.get('/live/:id/chat', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  const nextPageToken = c.req.query('nextPageToken') || ''

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'YouTube API not configured' }, 500)

  try {
    const stream = await c.env.DB.prepare(
      'SELECT youtube_live_chat_id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ youtube_live_chat_id: string }>()

    if (!stream?.youtube_live_chat_id) {
      return c.json({ success: false, error: 'No live chat ID — broadcast not started yet' }, 404)
    }

    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    if (!accessToken) return c.json({ success: false, error: 'YouTube auth required' }, 401)

    const url = new URL('https://www.googleapis.com/youtube/v3/liveChat/messages')
    url.searchParams.set('liveChatId', stream.youtube_live_chat_id)
    url.searchParams.set('part', 'snippet,authorDetails')
    url.searchParams.set('maxResults', '50')
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const err = await res.text()
      return c.json({ success: false, error: `YouTube API ${res.status}: ${err.slice(0, 200)}` }, 500)
    }
    const data = await res.json() as {
      nextPageToken?: string
      pollingIntervalMillis?: number
      items?: Array<{
        id: string
        snippet?: { displayMessage?: string; publishedAt?: string; type?: string }
        authorDetails?: { displayName?: string; profileImageUrl?: string; isChatOwner?: boolean; isChatModerator?: boolean }
      }>
    }
    const items = (data.items ?? []).map(it => ({
      id: it.id,
      message: it.snippet?.displayMessage || '',
      author: it.authorDetails?.displayName || 'YouTube 사용자',
      avatar: it.authorDetails?.profileImageUrl,
      isOwner: !!it.authorDetails?.isChatOwner,
      isModerator: !!it.authorDetails?.isChatModerator,
      published_at: it.snippet?.publishedAt,
      type: it.snippet?.type || 'textMessageEvent',
    }))

    return c.json({
      success: true,
      data: {
        items,
        next_page_token: data.nextPageToken,
        polling_interval_ms: data.pollingIntervalMillis || 5000,
      }
    })
  } catch (error: unknown) {
    if (import.meta.env?.DEV) console.error('[YouTube Chat Sync] Error:', error)
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

export { app as youtubeLiveRoutes }
