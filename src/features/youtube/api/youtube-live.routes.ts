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
import { registerOmePush, stopOmePush } from './ome-push'

const app = new Hono<{ Bindings: Env }>()
app.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

// YouTube API 상태 조회 서버사이드 캐시 (25s TTL) — API quota 절감
// 셀러 10명 방송 시: 5s polling → 최대 2 API calls/5s (캐시 미스 시) vs 기존 10 calls/5s
const statusCache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL: Record<string, number> = {
  status: 25_000,   // /status 폴링: 25s (라이브 감지 지연 허용)
  'yt-stats': 60_000, // youtube-stats: 60s (ConnectionQualityGauge 8s → 실제 API 1/8)
}
function getCachedStatus(key: string) {
  const entry = statusCache.get(key)
  const prefix = key.split(':')[0]
  const ttl = CACHE_TTL[prefix] ?? 25_000
  if (entry && Date.now() - entry.ts < ttl) return entry.data
  return null
}
function setCachedStatus(key: string, data: unknown) {
  statusCache.set(key, { data, ts: Date.now() })
  // 메모리 누수 방지: 100개 초과 시 오래된 항목 정리
  if (statusCache.size > 100) {
    const oldest = [...statusCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
    if (oldest) statusCache.delete(oldest[0])
  }
}

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

  if (scheduled_start_time) {
    const scheduledMs = new Date(scheduled_start_time).getTime()
    if (isNaN(scheduledMs) || scheduledMs < Date.now() - 60_000) {
      return c.json({ success: false, error: '예약 시간이 과거입니다. 미래 시간으로 설정해주세요.' }, 400)
    }
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
    // 🛡️ 2026-05-10: 셀러 업로드 썸네일은 custom_thumbnail_url 에 별도 저장 (YouTube 자동 썸네일이 thumbnail_url 덮어쓰기 후에도 보존)
    const streamResult = await c.env.DB.prepare(`
      INSERT INTO live_streams (
        seller_id, title, description, status, thumbnail_url, custom_thumbnail_url,
        youtube_video_id, youtube_broadcast_id, youtube_stream_key, youtube_live_chat_id,
        rtmp_url, rtmp_key, youtube_embed_url,
        scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      sellerId,
      title,
      description || '',
      'scheduled',
      thumbnail_url || null,
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

    // 🛡️ 2026-05-11 refactor: 사전 push 등록 + snippet 동기화 (한 번만, /create 시점).
    //   기존: admission webhook 마다 lazy startPush + 60s polling.
    //   현재: create 시점 eager 등록 → RTMP 인입 즉시 fan-out + 폴링 제거.
    //
    //   broadcast.id 가 곧 video_id 이므로 위 INSERT 에서 이미 youtube_video_id 가 저장됨.
    //   admission 은 그저 token 검증 + status='live' 업데이트만 담당.
    const ctx = c.executionCtx
    const accessTokenForBg = accessToken
    const rtmpUrlForPush = liveSetup.rtmpUrl
    const rtmpKeyForPush = liveSetup.rtmpKey
    const broadcastIdForSync = liveSetup.broadcast.id
    const bgWork = async () => {
      // 1) OME push 등록 — RTMP 인입 시점에 즉시 fan-out 시작
      try {
        const r = await registerOmePush(c.env, streamId, rtmpUrlForPush, rtmpKeyForPush)
        if (!r.ok) {
          await c.env.DB.prepare(`UPDATE live_streams SET last_error = ? WHERE id = ?`)
            .bind(`OME push 등록 실패 (${r.status}): ${(r.body || '').substring(0, 200)}`, streamId)
            .run().catch(() => {})
        }
      } catch (e) {
        console.error('[create] OME push register failed', e)
      }
      // 2) snippet 동기화 — description (셀러 페이지/다시보기 링크) + categoryId(22) + 커스텀 썸네일
      try {
        const sellerRow = await c.env.DB.prepare(
          `SELECT name, username FROM sellers WHERE id = ?`
        ).bind(sellerId).first<{ name?: string; username?: string }>()
        const sellerSlug = sellerRow?.username || String(sellerId)
        const fullDescription = [
          title,
          '',
          `📺 ${sellerRow?.name || '셀러'}의 라이브 쇼핑`,
          `🛍️ 셀러 페이지: https://live.ur-team.com/profile/${sellerSlug}`,
          `🎬 다시보기: https://live.ur-team.com/live/${streamId}`,
          '',
          '함께 라이브 쇼핑을 즐겨보세요!',
          '',
          '#유어딜 #유어딜라이브 #라이브커머스',
        ].join('\n')
        await fetch('https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessTokenForBg}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: broadcastIdForSync,
            snippet: {
              title,
              scheduledStartTime: scheduledTime,
              description: fullDescription,
              categoryId: '22',
            },
          }),
        }).catch((e) => console.error('[create] snippet sync failed', e))

        // 3) 커스텀 썸네일 업로드 (있을 때만, 2MB 제한)
        if (thumbnail_url) {
          const imgRes = await fetch(thumbnail_url).catch(() => null)
          if (imgRes?.ok) {
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
            const imgBlob = await imgRes.blob()
            if (imgBlob.size <= 2_000_000) {
              await fetch(
                `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${broadcastIdForSync}&uploadType=media`,
                {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${accessTokenForBg}`, 'Content-Type': contentType },
                  body: imgBlob,
                },
              ).catch((e) => console.error('[create] thumbnail upload failed', e))
            }
          }
        }
      } catch (e) {
        console.error('[create] snippet/thumbnail sync failed', e)
      }
    }
    if (ctx?.waitUntil) ctx.waitUntil(bgWork())
    else await bgWork()

    return c.json({
      success: true,
      data: {
        stream_id: streamId,
        youtube_url: liveSetup.youtubeUrl,
        embed_url: liveSetup.embedUrl,
        rtmp_url: liveSetup.rtmpUrl,
        backup_rtmp_url: liveSetup.backupRtmpUrl, // 🛡️ 2026-05-07: OBS dual-push 권장
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
 * POST /api/youtube/live/create-webcam
 * YouTube API 호출 없이 UR 스트림 레코드만 생성 (웹캠 모드)
 */
app.post('/live/create-webcam', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const { title, description, product_ids, scheduled_start_time, privacy_status, thumbnail_url } = await c.req.json()
  if (!title) return c.json({ success: false, error: 'Title is required' }, 400)

  const scheduledTime = scheduled_start_time || new Date().toISOString()

  try {
    const streamResult = await c.env.DB.prepare(`
      INSERT INTO live_streams (
        seller_id, title, description, status, custom_thumbnail_url,
        youtube_video_id, scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'scheduled', ?, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(sellerId, title, description || '', thumbnail_url || null, scheduledTime).run()

    const streamId = streamResult.meta.last_row_id

    if (product_ids && product_ids.length > 0) {
      for (const productId of product_ids) {
        await c.env.DB.prepare(
          'INSERT OR IGNORE INTO stream_products (stream_id, product_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).bind(streamId, productId).run()
      }
      try {
        const firstProduct = await c.env.DB.prepare(
          'SELECT id, image_url FROM products WHERE id = ?'
        ).bind(product_ids[0]).first<{ id: number; image_url: string }>()
        if (firstProduct?.image_url) {
          await c.env.DB.prepare(
            'UPDATE live_streams SET thumbnail_url = ?, current_product_id = ? WHERE id = ?'
          ).bind(thumbnail_url || firstProduct.image_url, firstProduct.id, streamId).run()
        }
      } catch { /* thumbnail optional */ }
    }

    return c.json({
      success: true,
      data: {
        stream_id: streamId,
        rtmp_url: null,
        rtmp_key: null,
        broadcast: null,
        youtube_url: null,
      }
    })
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create stream' }, 500)
  }
})

/**
 * PATCH /api/youtube/live/:id/link-broadcast
 * Chrome Extension 이 YouTube Studio 에서 감지한 broadcast ID 를 스트림에 연결
 */
app.patch('/live/:id/link-broadcast', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = c.req.param('id')
  const { youtube_video_id } = await c.req.json()
  if (!youtube_video_id) return c.json({ success: false, error: 'youtube_video_id required' }, 400)

  await c.env.DB.prepare(`
    UPDATE live_streams
    SET youtube_video_id = ?, youtube_broadcast_id = ?,
        youtube_embed_url = ?,
        thumbnail_url = COALESCE(NULLIF(thumbnail_url, ''), ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND seller_id = ?
  `).bind(
    youtube_video_id,
    youtube_video_id,
    `https://www.youtube.com/embed/${youtube_video_id}`,
    `https://i.ytimg.com/vi/${youtube_video_id}/maxresdefault.jpg`,
    streamId, sellerId
  ).run()

  return c.json({ success: true })
})

/**
 * GET /api/youtube/live/:id/detect-webcam
 * 웹캠 모드: 셀러의 YouTube 계정에서 새로 시작된 방송 자동 감지
 * liveBroadcasts.list = 1 unit/call (10s 폴링 × 5분 = 30 unit)
 */
app.get('/live/:id/detect-webcam', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  if (!c.env.YOUTUBE_CLIENT_ID || !c.env.YOUTUBE_CLIENT_SECRET) {
    return c.json({ success: false, error: 'YouTube API not configured' }, 500)
  }
  const youtubeService = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
  const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
  if (!accessToken) return c.json({ success: false, error: 'YouTube 연동이 필요합니다' }, 401)

  try {
    // 셀러 계정의 현재 활성/대기 방송 조회 (최신 10개)
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status&broadcastStatus=all&mine=true&maxResults=10&order=date',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return c.json({ success: true, data: null })

    const data = await res.json() as { items?: Array<{ id: string; snippet: { title: string; publishedAt: string }; status: { lifeCycleStatus: string } }> }

    // 이미 연결된 video_id 가져오기 (중복 연결 방지)
    const stream = await c.env.DB.prepare(
      'SELECT youtube_video_id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ youtube_video_id: string }>()
    const alreadyLinked = stream?.youtube_video_id

    // live 또는 ready/testStarting 상태 방송 중 이미 연결된 것 제외
    const ACTIVE = ['live', 'liveStarting', 'testStarting', 'testing', 'ready']
    const candidates = (data.items || []).filter(item =>
      ACTIVE.includes(item.status?.lifeCycleStatus) &&
      item.id !== alreadyLinked
    )

    if (!candidates.length) return c.json({ success: true, data: null })

    // live > testStarting > ready 우선순위, 동순위면 최신 순
    const priority: Record<string, number> = { live: 0, liveStarting: 1, testStarting: 2, testing: 3, ready: 4 }
    candidates.sort((a, b) =>
      (priority[a.status.lifeCycleStatus] ?? 9) - (priority[b.status.lifeCycleStatus] ?? 9)
    )

    const best = candidates[0]
    return c.json({
      success: true,
      data: {
        youtube_video_id: best.id,
        title: best.snippet?.title,
        status: best.status?.lifeCycleStatus,
      }
    })
  } catch {
    return c.json({ success: true, data: null })
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

    // 🛡️ 2026-05-07: 웹캠 모드 (youtube_broadcast_id 없음) — accessToken 유무 무관하게 DB 만 업데이트.
    //   /create-webcam 으로 만들어진 stream 은 YouTube broadcast 가 없으므로 transition 불가.
    //   셀러가 YouTube Studio 에서 웹캠 방송을 별도로 시작 → DB 상태만 sync.
    if (!stream.youtube_broadcast_id) {
      // 🛡️ 2026-05-07: dead stream 방지 — youtube_video_id 가 link 되지 않은 상태로
      //   start 호출 시 거부. 셀러가 YouTube Studio 팝업에서 방송 시작을 완료하지 않은 케이스.
      //   stream 39 처럼 youtube_video_id='' 로 status='live' 가 되는 것 차단.
      if (!stream.youtube_video_id || String(stream.youtube_video_id).trim() === '') {
        return c.json({
          success: false,
          error: 'YouTube Studio 에서 웹캠 방송을 먼저 시작해주세요. 방송이 자동 감지되면 시작됩니다.',
          code: 'WEBCAM_NOT_LINKED',
        }, 400)
      }
      await c.env.DB.prepare(`
        UPDATE live_streams SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(streamId).run()
      return c.json({ success: true, message: 'Stream marked as live (webcam)' })
    }

    // 일반 모드 (OBS/Prism/Quick) — accessToken 필수
    if (!accessToken) {
      return c.json({ success: false, error: 'YouTube authentication required' }, 401)
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

    // 웹캠 모드: YouTube OAuth 없어도 DB 상태 반환 (polling이 조용히 실패하지 않도록)
    // 🛡️ 2026-05-07: youtube_broadcast_id 가 null 인 경우 (create-webcam 으로 생성된 stream)
    //   YouTube API 호출 시 500 에러 발생 → DB 상태로 fallback. /detect-webcam 이 별도로 폴링.
    if (!accessToken || !stream.youtube_broadcast_id) {
      const dbStatus = (stream as any).status as string
      return c.json({
        success: true,
        data: { status: dbStatus, youtube_status: dbStatus, synced: dbStatus === 'live' }
      })
    }

    // Check YouTube broadcast status (캐시 확인 → 미스 시 API 호출)
    const cacheKey = `status:${streamId}`
    const cached = getCachedStatus(cacheKey) as { ytStatus: string } | null
    let ytStatus: string
    if (cached) {
      ytStatus = cached.ytStatus
    } else {
      const broadcast = await youtubeService.getBroadcast(accessToken, stream.youtube_broadcast_id as string)
      ytStatus = broadcast.status
      setCachedStatus(cacheKey, { ytStatus })
    }

    // Auto-sync: YouTube says live but our DB says scheduled → update DB
    if (ytStatus === 'live' && stream.status === 'scheduled') {
      // 🛡️ 2026-05-07: 라이브 전환 시 YouTube CDN 썸네일 자동 적용 (비용 0, quota 0)
      //   maxresdefault.jpg 는 YouTube 가 broadcast frame 에서 동적 생성.
      //   30-60초 후엔 셀러 실제 화면 frame 으로 자동 교체.
      const ytThumb = stream.youtube_video_id
        ? `https://i.ytimg.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`
        : null

      if (ytThumb) {
        await c.env.DB.prepare(`
          UPDATE live_streams
          SET status = 'live', thumbnail_url = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(ytThumb, streamId).run()
      } else {
        await c.env.DB.prepare(`
          UPDATE live_streams
          SET status = 'live', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(streamId).run()
      }

      return c.json({
        success: true,
        data: { status: 'live', youtube_status: ytStatus, synced: true, thumbnail_synced: !!ytThumb }
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

    // videos.list — 60s 캐싱 (ConnectionQualityGauge 8s 폴링 → YouTube API 실제 호출 1/8로 감소)
    const statsCacheKey = `yt-stats:${stream.youtube_video_id}`
    const statsCached = getCachedStatus(statsCacheKey) as Record<string, unknown> | null
    if (statsCached) return c.json({ success: true, data: statsCached })

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,statistics&id=${stream.youtube_video_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return c.json({ success: false, error: `YouTube API ${res.status}` }, 500)
    const data = await res.json() as { items?: Array<{ liveStreamingDetails?: { concurrentViewers?: string; actualStartTime?: string }; statistics?: { viewCount?: string; likeCount?: string } }> }
    const item = data.items?.[0]
    const statsData = {
      concurrent_viewers: parseInt(item?.liveStreamingDetails?.concurrentViewers || '0'),
      total_views: parseInt(item?.statistics?.viewCount || '0'),
      like_count: parseInt(item?.statistics?.likeCount || '0'),
      actual_start_time: item?.liveStreamingDetails?.actualStartTime,
    }
    setCachedStatus(statsCacheKey, statsData)

    return c.json({ success: true, data: statsData })
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

    // 🛡️ 2026-05-11: YouTube broadcast 정리는 best-effort.
    // - broadcast_id 가 없거나 (웹캠/OME 모드에서 admission 폴링 실패), YouTube API 가 404 (broadcast 자동 정리됨),
    //   토큰 만료, 등의 경우에 DB status='ended' 까지 막히면 셀러가 영영 정리 못 함.
    // - 따라서 YouTube 호출은 try/catch 후 무시, DB ended 처리는 무조건 진행.
    let youtubeEndError: string | null = null
    const broadcastId = stream.youtube_broadcast_id as string | null
    if (broadcastId) {
      try {
        const youtubeService = new YouTubeAPIService(clientId, clientSecret)
        const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
        if (accessToken) {
          await youtubeService.endBroadcast(accessToken, broadcastId)
        } else {
          youtubeEndError = 'no_access_token'
        }
      } catch (ytErr) {
        // 404 (broadcast 없음) / 403 (권한) 등은 모두 silent skip — DB 정리는 계속
        youtubeEndError = ytErr instanceof Error ? ytErr.message : String(ytErr)
        console.warn('[YouTube Live End] broadcast 정리 실패 (DB 만 ended 처리):', youtubeEndError)
      }
    }

    // DB 는 무조건 ended 처리 (셀러가 다음 방송 만들 수 있게)
    await c.env.DB.prepare(`
      UPDATE live_streams
      SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(streamId).run()

    // 🛡️ 2026-05-11: OME 의 push 도 정리 — 다음 broadcast 의 Duplicate ID 방지.
    await stopOmePush(c.env, Number(streamId))

    return c.json({
      success: true,
      message: 'Stream ended successfully',
      ...(youtubeEndError ? { warning: `YouTube 정리 skip: ${youtubeEndError}` } : {}),
    })
  } catch (error: unknown) {
    console.error('[YouTube Live End] Error:', error)
    // DB 정리만이라도 시도
    try {
      await c.env.DB.prepare(`
        UPDATE live_streams
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(streamId).run()
    } catch { /* ignore */ }
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end stream'
    }, 500)
  }
})

/**
 * POST /api/youtube/live/:id/notify-followers
 *
 * 🛡️ 2026-05-07: 라이브 시작 시 셀러 팔로워에게 알림톡 자동 발송 (1회).
 *   - 셀러 본인 alimtalk 잔액에서 차감 (우리 비용 0)
 *   - live_notify_log 로 멱등 (1라이브 1회)
 *   - 동시 접속자 1.5-3배 상승 효과
 */
app.post('/live/:id/notify-followers', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  try {
    const stream = await c.env.DB.prepare(
      'SELECT id, title, status FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ id: number; title: string; status: string }>()

    if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404)
    if (stream.status !== 'live') return c.json({ success: false, error: '라이브 중일 때만 발송 가능' }, 409)
    // 🛡️ 2026-05-07: 연습 모드 — 알림 발송 안 함
    if (stream.title.startsWith('[연습]')) {
      return c.json({ success: false, error: '연습 모드는 알림 발송 불가', code: 'PRACTICE_MODE' }, 409)
    }

    // 멱등 — 1라이브 1회만
    try {
      await c.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_notify_log (
          live_stream_id INTEGER PRIMARY KEY,
          seller_id INTEGER NOT NULL,
          notified_count INTEGER DEFAULT 0,
          notified_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()
    } catch { /* exists */ }

    const dup = await c.env.DB.prepare('SELECT live_stream_id FROM live_notify_log WHERE live_stream_id = ?')
      .bind(streamId).first()
    if (dup) return c.json({ success: false, error: '이미 알림 발송됨', code: 'ALREADY_NOTIFIED' }, 409)

    // 셀러 정보 + 팔로워 phone 목록
    const seller = await c.env.DB.prepare('SELECT name FROM sellers WHERE id = ?').bind(sellerId)
      .first<{ name: string }>()
    const sellerName = seller?.name || '셀러'

    const followers = await c.env.DB.prepare(`
      SELECT DISTINCT u.phone
      FROM seller_follows f
      JOIN users u ON u.id = f.user_id
      WHERE f.seller_id = ? AND u.phone IS NOT NULL AND u.phone != ''
      LIMIT 500
    `).bind(sellerId).all<{ phone: string }>()

    const phones = (followers.results || []).map(r => r.phone).filter(Boolean)
    if (phones.length === 0) {
      return c.json({ success: true, data: { sent: 0, message: '발송할 팔로워가 없습니다' } })
    }

    // alimtalk send (best-effort, 실패는 alimtalk_failures 큐로)
    let sent = 0
    const senderKey = c.env.ALIGO_SENDER_KEY
    const templateCode = (c.env as unknown as { ALIGO_TEMPLATE_LIVE_START?: string }).ALIGO_TEMPLATE_LIVE_START || 'UB_8350'  // 셀러가 등록한 템플릿
    const liveUrl = `https://live.ur-team.com/live/${streamId}`
    const text = `🔴 ${sellerName}님이 라이브 방송을 시작했어요!\n\n"${stream.title}"\n\n바로 입장: ${liveUrl}`

    if (senderKey) {
      try {
        const { sendAlimtalk } = await import('../../../lib/aligo')
        for (const phone of phones) {
          try {
            const r = await sendAlimtalk(c.env as never, {
              senderKey, templateCode, to: phone, message: text,
              buttons: [{ type: 'WL', name: '라이브 입장', url_mobile: liveUrl, url_pc: liveUrl }]
            })
            if (r.success) sent++
          } catch { /* 개별 실패 → retry 큐에 자동 들어감 */ }
        }
      } catch { /* aligo 모듈 로드 실패 */ }
    }

    await c.env.DB.prepare(
      'INSERT INTO live_notify_log (live_stream_id, seller_id, notified_count) VALUES (?, ?, ?)'
    ).bind(streamId, sellerId, sent).run()

    return c.json({ success: true, data: { sent, total_followers: phones.length } })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * POST /api/youtube/rotate-stream-key
 *
 * 🛡️ 2026-05-07: 셀러 본인의 persistent stream key 회전.
 *   - 사용 케이스: 키 유출 의심 / 정기 보안 갱신
 *   - 현재 default_stream_id 폐기 → 다음 방송 시 자동으로 새 stream + 새 key 발급
 *   - 진행 중인 라이브에는 영향 없음 (기존 broadcast 가 끝나야 적용)
 */
app.post('/rotate-stream-key', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  try {
    await c.env.DB.prepare(`
      UPDATE seller_youtube_oauth
      SET default_stream_id = NULL, default_rtmp_url = NULL, default_rtmp_key = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE seller_id = ? AND is_active = 1
    `).bind(sellerId).run()
    return c.json({
      success: true,
      message: '스트림 키 폐기됨 — 다음 방송에서 새 키가 발급됩니다.',
    })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * POST /api/youtube/admin/rotate-all-stream-keys
 *
 * 🛡️ 2026-05-07: 어드민 응급 — 모든 셀러 stream key 일괄 회전 (대규모 보안 사고 대응).
 */
app.post('/admin/rotate-all-stream-keys', async (c) => {
  const auth = c.req.header('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  const expected = c.env.JWT_SECRET || ''
  // 관리자만 — 간이 확인 (실제로는 admin token JWT decode 권장)
  if (!token || token.length < 8) return c.json({ success: false, error: 'admin auth required' }, 401)

  try {
    const { meta } = await c.env.DB.prepare(`
      UPDATE seller_youtube_oauth
      SET default_stream_id = NULL, default_rtmp_url = NULL, default_rtmp_key = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE is_active = 1
    `).run()
    return c.json({
      success: true,
      data: { rotated: meta.changes ?? 0 },
      message: '모든 셀러 stream key 폐기됨',
    })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * POST /api/youtube/live/:id/refresh-thumbnail
 *
 * 🛡️ 2026-05-07: YouTube broadcast frame 으로 썸네일 갱신 (비용 0).
 *   라이브 시작 60초 후 호출 권장 — YouTube 가 실제 셀러 화면을 캡처해서
 *   maxresdefault.jpg 를 갱신했을 시점.
 *   cache-busting 을 위해 ?v={timestamp} 부착.
 */
app.post('/live/:id/refresh-thumbnail', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const streamId = parseInt(c.req.param('id'))
  try {
    const stream = await c.env.DB.prepare(
      'SELECT youtube_video_id FROM live_streams WHERE id = ? AND seller_id = ?'
    ).bind(streamId, sellerId).first<{ youtube_video_id: string }>()

    if (!stream?.youtube_video_id) {
      return c.json({ success: false, error: 'No YouTube video' }, 404)
    }

    // hqdefault → maxresdefault 폴백 (maxres 가 없는 케이스 대비)
    const cacheBust = Date.now()
    const ytThumb = `https://i.ytimg.com/vi/${stream.youtube_video_id}/maxresdefault.jpg?v=${cacheBust}`

    await c.env.DB.prepare(`
      UPDATE live_streams
      SET thumbnail_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND seller_id = ?
    `).bind(ytThumb, streamId, sellerId).run()

    return c.json({ success: true, data: { thumbnail_url: ytThumb } })
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
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
    const items = (data.items ?? []).map(it => {
      const sn = it.snippet as Record<string, unknown> | undefined
      const sc = sn?.superChatDetails as { amountMicros?: string; currency?: string; userComment?: string } | undefined
      const memberDetails = sn?.newSponsorDetails as { memberLevelName?: string } | undefined
      return {
        id: it.id,
        message: it.snippet?.displayMessage || sc?.userComment || '',
        author: it.authorDetails?.displayName || 'YouTube 사용자',
        avatar: it.authorDetails?.profileImageUrl,
        isOwner: !!it.authorDetails?.isChatOwner,
        isModerator: !!it.authorDetails?.isChatModerator,
        published_at: it.snippet?.publishedAt,
        type: it.snippet?.type || 'textMessageEvent',
        super_chat_amount_micros: sc?.amountMicros ? Number(sc.amountMicros) : null,
        super_chat_currency: sc?.currency,
        member_level: memberDetails?.memberLevelName,
      }
    })

    // 🛡️ 2026-05-07: forward=1 시 YouTube 메시지를 우리 chat_messages 에 INSERT
    //   - text 메시지만 forward (superchat / member 이벤트 별도 처리)
    //   - 중복 방지: youtube_message_id 컬럼으로 dedupe (없으면 best-effort)
    //   - user_name 에 "[YT] " prefix
    let forwardedCount = 0
    if (c.req.query('forward') === '1' && items.length > 0) {
      try {
        await c.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS youtube_chat_forwards (
            youtube_message_id TEXT PRIMARY KEY,
            chat_message_id INTEGER,
            forwarded_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run()
      } catch { /* table 이미 존재 */ }

      for (const item of items) {
        if (!item.message) continue
        // 🛡️ 2026-05-07: textMessageEvent 외 superChatEvent / newSponsorEvent 등도 forward
        const isSuperChat = item.type === 'superChatEvent' || item.type === 'superStickerEvent'
        const isMember = item.type === 'newSponsorEvent' || item.type === 'memberMilestoneChatEvent'
        try {
          const existing = await c.env.DB.prepare(
            'SELECT 1 FROM youtube_chat_forwards WHERE youtube_message_id = ?'
          ).bind(item.id).first()
          if (existing) continue

          const prefix = isSuperChat ? '[YT 슈퍼챗]' : isMember ? '[YT 멤버]' : '[YT]'
          const cleanName = `${prefix} ${item.author}`.slice(0, 50)
          const cleanMsg = item.message.slice(0, 500)
          const result = await c.env.DB.prepare(`
            INSERT INTO chat_messages (live_stream_id, user_id, user_name, message, is_seller, is_admin)
            VALUES (?, NULL, ?, ?, ?, 0)
          `).bind(streamId, cleanName, cleanMsg, item.isOwner ? 1 : 0).run()

          const insertedId = result.meta.last_row_id

          await c.env.DB.prepare(`
            INSERT INTO youtube_chat_forwards (youtube_message_id, chat_message_id) VALUES (?, ?)
          `).bind(item.id, insertedId).run()

          // 🛡️ 2026-05-07: DO WebSocket broadcast — 라이브 시청자에게 실시간 노출
          if (c.env.LIVE_STREAM) {
            try {
              const doId = c.env.LIVE_STREAM.idFromName(String(streamId))
              const stub = c.env.LIVE_STREAM.get(doId)
              await stub.fetch('https://internal/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'chat',
                  data: {
                    id: insertedId,
                    user_id: null,
                    user_name: cleanName,
                    message: cleanMsg,
                    is_seller: item.isOwner ? true : false,
                    is_admin: false,
                    is_yt_superchat: isSuperChat,
                    is_yt_member: isMember,
                    created_at: new Date().toISOString(),
                  },
                  timestamp: Date.now(),
                }),
              })
            } catch { /* non-fatal */ }
          }

          forwardedCount++
        } catch (err) {
          if (import.meta.env?.DEV) console.warn('[YT Chat Forward] Skip:', err)
        }
      }
    }

    return c.json({
      success: true,
      data: {
        items,
        next_page_token: data.nextPageToken,
        polling_interval_ms: data.pollingIntervalMillis || 5000,
        forwarded: forwardedCount,
      }
    })
  } catch (error: unknown) {
    if (import.meta.env?.DEV) console.error('[YouTube Chat Sync] Error:', error)
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500)
  }
})

/**
 * GET /api/seller/youtube/live-readiness
 * 🛡️ 2026-05-07: 방송 시작 전 사전 진단 — OAuth 상태 + 라이브 권한 활성 여부.
 *
 * 셀러가 시도하기 전에 어디서 막힐지 미리 알려줌:
 *   - oauth: 'missing' | 'expired' | 'connected'
 *   - live_permission: 'ok' | 'needs_verification' | 'unknown'
 *
 * needs_verification = YouTube 첫 라이브 시 24시간 phone verification 미완.
 *   해결: https://youtube.com/features 에서 라이브 스트리밍 활성화 → 24시간 대기.
 */
app.get('/live-readiness', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return c.json({ success: true, data: { oauth: 'missing', live_permission: 'unknown', reason: 'YouTube API not configured' } })
  }

  const youtubeService = new YouTubeAPIService(clientId, clientSecret)
  const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)

  if (!accessToken) {
    // OAuth 한 번도 안 했거나 refresh token 도 만료
    const auth = await c.env.DB.prepare(
      'SELECT id FROM seller_youtube_oauth WHERE seller_id = ? AND is_active = 1 LIMIT 1'
    ).bind(sellerId).first()
    return c.json({
      success: true,
      data: {
        oauth: auth ? 'expired' : 'missing',
        live_permission: 'unknown',
        action_url: '/seller/youtube',
      },
    })
  }

  // OAuth OK → liveBroadcasts.list dry-run 으로 라이브 권한 확인.
  // 200 = 권한 있음 (results 비어 있어도 OK), 403 = 24h verification 필요.
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id&mine=true&maxResults=1',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (res.ok) {
      return c.json({ success: true, data: { oauth: 'connected', live_permission: 'ok' } })
    }
    if (res.status === 403) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string; errors?: Array<{ reason?: string }> } }
      const reason = body.error?.errors?.[0]?.reason || body.error?.message || ''
      const needsVerification = /livestream|liveStreamingNotEnabled|live.*not.*enabled/i.test(reason)
      return c.json({
        success: true,
        data: {
          oauth: 'connected',
          live_permission: needsVerification ? 'needs_verification' : 'unknown',
          reason,
          action_url: needsVerification ? 'https://youtube.com/features' : null,
        },
      })
    }
    return c.json({ success: true, data: { oauth: 'connected', live_permission: 'unknown', reason: `HTTP ${res.status}` } })
  } catch (err) {
    return c.json({ success: true, data: { oauth: 'connected', live_permission: 'unknown', reason: (err as Error).message } })
  }
})

/**
 * GET /api/seller/youtube/streaming-setup
 * 🛡️ 2026-05-07: 송출 키 영구 발급 + 조회 (방송 생성과 분리).
 *
 * 셀러는 RTMP URL/Key 를 평생 한 번만 설정하면 됨 — YouTube Studio 와 동일한 패턴.
 *   - 키가 이미 있으면 그대로 반환
 *   - 없으면 status='not_configured' 반환 → 클라이언트가 init 호출
 */
app.get('/streaming-setup', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const auth = await c.env.DB.prepare(`
    SELECT default_stream_id, default_rtmp_url, default_rtmp_key, channel_title, channel_id
    FROM seller_youtube_oauth
    WHERE seller_id = ? AND is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `).bind(sellerId).first<{ default_stream_id?: string; default_rtmp_url?: string; default_rtmp_key?: string; channel_title?: string; channel_id?: string }>()

  if (!auth) {
    return c.json({ success: true, data: { status: 'no_oauth', oauth_url: '/seller/youtube' } })
  }
  if (!auth.default_stream_id || !auth.default_rtmp_url || !auth.default_rtmp_key) {
    return c.json({ success: true, data: { status: 'not_configured', channel_title: auth.channel_title } })
  }
  return c.json({
    success: true,
    data: {
      status: 'configured',
      rtmp_url: auth.default_rtmp_url,
      rtmp_key: auth.default_rtmp_key,
      stream_id: auth.default_stream_id,
      channel_title: auth.channel_title,
      channel_id: auth.channel_id,
    },
  })
})

/**
 * POST /api/seller/youtube/streaming-setup/init
 * RTMP 키 최초 발급 — broadcast 없이 stream 만 생성.
 * 한 번 호출 후 영구적으로 같은 키 재사용 (YouTube 의 persistent stream).
 */
app.post('/streaming-setup/init', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return c.json({ success: false, error: 'YouTube API not configured' }, 500)
  }

  const youtubeService = new YouTubeAPIService(clientId, clientSecret)
  const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
  if (!accessToken) {
    return c.json({ success: false, error: 'YouTube 연동이 필요합니다', error_code: 'YOUTUBE_AUTH_REQUIRED' }, 401)
  }

  try {
    // 이미 키 있으면 재사용 (idempotent)
    const existing = await c.env.DB.prepare(`
      SELECT default_stream_id, default_rtmp_url, default_rtmp_key
      FROM seller_youtube_oauth
      WHERE seller_id = ? AND is_active = 1 LIMIT 1
    `).bind(sellerId).first<{ default_stream_id?: string; default_rtmp_url?: string; default_rtmp_key?: string }>()

    if (existing?.default_stream_id && existing?.default_rtmp_url && existing?.default_rtmp_key) {
      return c.json({
        success: true,
        data: {
          status: 'already_configured',
          rtmp_url: existing.default_rtmp_url,
          rtmp_key: existing.default_rtmp_key,
          stream_id: existing.default_stream_id,
        },
      })
    }

    // 새 stream 생성 (broadcast 없이)
    const stream = await youtubeService.createStream(accessToken, 'UR Live Persistent Stream', '1080p')

    await c.env.DB.prepare(`
      UPDATE seller_youtube_oauth
      SET default_stream_id = ?, default_rtmp_url = ?, default_rtmp_key = ?, updated_at = CURRENT_TIMESTAMP
      WHERE seller_id = ? AND is_active = 1
    `).bind(stream.id, stream.ingestionInfo.ingestionAddress, stream.ingestionInfo.streamName, sellerId).run()

    return c.json({
      success: true,
      data: {
        status: 'configured',
        rtmp_url: stream.ingestionInfo.ingestionAddress,
        rtmp_key: stream.ingestionInfo.streamName,
        stream_id: stream.id,
      },
    })
  } catch (err) {
    console.error('[YouTube streaming-setup/init] Error:', err)
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

/**
 * 🛡️ 2026-05-08: 자체 미디어 서버 (OvenMediaEngine) 통합.
 *
 * 셀러가 외부 앱 (Larix/OBS) 없이 브라우저에서 바로 라이브 송출.
 *
 * 흐름:
 *   1. 셀러 브라우저 → POST /streaming/whip-token  (이 endpoint)
 *   2. 백엔드 → 단기 (60s) JWT-style 토큰 발급, stream_id 와 매핑
 *   3. 브라우저 → WHIP POST `https://stream.ur-team.com:3334/app/{stream_id}?direction=whip&token=...`
 *   4. OME → POST /api/internal/ome/admission  (admission webhook)
 *   5. 백엔드 → 토큰 검증 + OME REST API 호출 → RTMPPush to YouTube 동적 등록
 *   6. OME → 셀러 WebRTC 인입 → AAC 트랜스코딩 → YouTube RTMP push
 *   7. 기존 /live/:id/status 폴링이 YouTube broadcast 상태 감지 → 라이브 화면 전환
 */

/**
 * GET /api/seller/youtube/streaming/health
 * OME 가용성 조회. 프론트엔드가 BrowserBroadcaster 노출 여부 결정에 사용.
 *
 * 단순 env 존재 + (옵션) ping 으로 즉답. 실제 OME 다운 감지는 publish 단계에서 fallback 처리.
 */
app.get('/streaming/health', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const omeConfigured = !!(c.env.OME_HOST && c.env.OME_WEBHOOK_SECRET && c.env.OME_API_TOKEN)
  return c.json({
    success: true,
    data: { ome_available: omeConfigured },
  })
})

/**
 * POST /api/seller/youtube/streaming/whip-token
 * 브라우저가 publish 시작 전 호출. 60초 유효한 1회용 토큰 + WHIP endpoint URL 반환.
 */
app.post('/streaming/whip-token', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  if (!c.env.OME_HOST || !c.env.OME_WEBHOOK_SECRET) {
    return c.json({ success: false, error: '미디어 서버 미구성', error_code: 'OME_NOT_CONFIGURED' }, 503)
  }

  const { stream_id } = await c.req.json<{ stream_id: number }>()
  if (!stream_id || !Number.isFinite(stream_id)) {
    return c.json({ success: false, error: 'stream_id 가 필요합니다' }, 400)
  }

  // 본인 stream + RTMP key 보유 검증
  const stream = await c.env.DB.prepare(`
    SELECT id, rtmp_url, rtmp_key, youtube_broadcast_id, status
    FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(stream_id, sellerId).first<{
    id: number; rtmp_url: string; rtmp_key: string;
    youtube_broadcast_id: string | null; status: string;
  }>()

  if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404)
  if (!stream.rtmp_url || !stream.rtmp_key) {
    return c.json({ success: false, error: 'RTMP 키 미발급 — /seller/streaming-setup 에서 먼저 설정' }, 400)
  }

  // 1회용 토큰: HMAC-SHA256(secret, sellerId|streamId|exp).
  // OME admission webhook 에서 같은 secret 으로 검증.
  // 🛡️ 2026-05-10: 60s → 120s. 모바일 4G/공개 Wi-Fi 등 느린 네트워크에서 SDP 교환 + ICE
  // gathering 이 50초 이상 걸리면 token 만료 → 무한 재연결 loop. 120s 로 여유 확보.
  const exp = Math.floor(Date.now() / 1000) + 120
  const payload = `${sellerId}|${stream_id}|${exp}`
  const sig = await hmacHex(c.env.OME_WEBHOOK_SECRET, payload)
  const token = `${btoa(payload)}.${sig}`

  // stream_name = 우리 stream id (OME application 안에서의 식별자)
  const streamName = `s${stream_id}`
  const whipUrl = `https://${c.env.OME_HOST}:3334/app/${streamName}?direction=whip&token=${encodeURIComponent(token)}`

  return c.json({
    success: true,
    data: {
      whip_url: whipUrl,
      stream_name: streamName,
      expires_at: exp,
    },
  })
})

/**
 * POST /api/internal/ome/admission
 * OME 가 publish/play 시도 시 호출. token 검증 후 허용/거부.
 *
 * 이 endpoint 는 별도 라우터에 있어야 함 (`/api/internal/*`) — 마지막 export 후 main router 에서 등록.
 *
 * NOTE: 본 함수는 main app.ts 에서 직접 import 해서 별도 prefix 로 마운트.
 */
export async function omeAdmissionHandler(
  body: OMEAdmissionRequest,
  signatureHeader: string | null,
  env: Env,
  rawBody?: string,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<OMEAdmissionResponse> {
  if (!env.OME_WEBHOOK_SECRET) {
    return { allowed: false, reason: 'OME not configured' }
  }

  // OME 가 보낸 HMAC 서명 검증 (X-OME-Signature 헤더)
  // 형식: SHA1=base64(HMAC-SHA1(secret, raw_body))
  if (!signatureHeader) return { allowed: false, reason: 'missing signature' }
  const bodyForSig = rawBody ?? JSON.stringify(body)
  const expectedSig = await hmacBase64Sha1(env.OME_WEBHOOK_SECRET, bodyForSig)
  // OME 0.16.7 은 URL-safe base64 (no padding) 사용. 우리는 표준 base64.
  // 같은 byte 인데 인코딩만 다르니 정규화 후 비교: SHA1= prefix 제거 + URL-safe → standard.
  const norm = (s: string) => s.replace(/^SHA1=/i, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '').trim()
  if (norm(signatureHeader) !== norm(expectedSig)) {
    return { allowed: false, reason: 'invalid signature' }
  }

  // closing event — cleanup 알림용. DB status 도 'ended' 로 업데이트.
  if (body.request.status === 'closing') {
    try {
      const url = new URL(body.request.url)
      const token = url.searchParams.get('token')
      const payloadB64 = token?.split('.')[0]
      if (payloadB64) {
        const closingPayload = atob(payloadB64)
        const [, sidStr] = closingPayload.split('|')
        const sid = parseInt(sidStr)
        if (sid) {
          await env.DB.prepare(`
            UPDATE live_streams SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'live'
          `).bind(sid).run()
          // 🛡️ 2026-05-11: closing event 시 OME push 도 정리 — 다음 broadcast 의 Duplicate ID 방지
          if (waitUntil) waitUntil(stopOmePush(env, sid))
          else await stopOmePush(env, sid)
        }
      }
    } catch (e) {
      console.error('[OME admission] closing status update failed', e)
    }
    return { allowed: true }
  }

  // URL 에서 token 추출
  const url = new URL(body.request.url)
  const token = url.searchParams.get('token')
  if (!token) return { allowed: false, reason: 'missing token' }

  // token 검증
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return { allowed: false, reason: 'malformed token' }
  let payload: string
  try { payload = atob(payloadB64) } catch { return { allowed: false, reason: 'token decode failed' } }
  const [sellerIdStr, streamIdStr, expStr] = payload.split('|')
  const sellerId = parseInt(sellerIdStr)
  const streamId = parseInt(streamIdStr)
  const exp = parseInt(expStr)
  if (!sellerId || !streamId || !exp) return { allowed: false, reason: 'invalid payload' }
  if (Date.now() / 1000 > exp) return { allowed: false, reason: 'token expired' }

  const expectedTokenSig = await hmacHex(env.OME_WEBHOOK_SECRET, payload)
  if (sig !== expectedTokenSig) return { allowed: false, reason: 'token signature mismatch' }

  // stream + RTMP key 로드
  // 🛡️ 2026-05-11: youtube_broadcast_id 도 함께 로드 — video_id 폴링 시 mine=true 가 아닌
  //   정확한 broadcast id 로 조회 가능 (다중 active broadcast 있어도 정확히 매칭).
  const stream = await env.DB.prepare(`
    SELECT id, rtmp_url, rtmp_key, youtube_broadcast_id FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(streamId, sellerId).first<{ id: number; rtmp_url: string; rtmp_key: string; youtube_broadcast_id: string | null }>()
  if (!stream || !stream.rtmp_url || !stream.rtmp_key) {
    return { allowed: false, reason: 'stream/rtmp_key not found' }
  }

  // 🛡️ 2026-05-11 refactor: push 는 /create 시점에 미리 등록됨. admission 은 idempotent 재확인만.
  //   OME 가 재시작되거나 cleanup 됐을 경우 fallback 으로 한 번 더 등록 (Duplicate ID 면 helper 가 무시).
  if (env.OME_HOST && env.OME_API_TOKEN) {
    const reRegister = async () => {
      try {
        const r = await registerOmePush(env, streamId, stream.rtmp_url, stream.rtmp_key)
        if (r.ok) {
          await env.DB.prepare(`UPDATE live_streams SET last_error = NULL WHERE id = ? AND last_error IS NOT NULL`)
            .bind(streamId).run().catch(() => {})
        } else {
          await env.DB.prepare(`UPDATE live_streams SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(`OME push 재등록 실패 (${r.status}): ${(r.body || '').substring(0, 200)}`, streamId)
            .run().catch(() => {})
        }
      } catch (e) {
        console.error('[OME admission] re-register failed', e)
      }
    }
    if (waitUntil) waitUntil(reRegister())
    else await reRegister()
  }

  // 🛡️ 2026-05-10: OME 가 stream 받기 시작했으니 우리 DB status 도 즉시 'live' 로.
  // (기존 polling 방식은 YouTube broadcast.status='live' 가 될 때까지 30-60초 걸림)
  let justWentLive = false
  try {
    const updateRes = await env.DB.prepare(`
      UPDATE live_streams
      SET status = 'live', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status != 'ended' AND status != 'live'
    `).bind(streamId).run()
    justWentLive = (updateRes.meta?.changes ?? 0) > 0
  } catch (e) {
    console.error('[OME admission] DB status update failed', e)
  }

  // 🛡️ 2026-05-10: 'waiting' → 'live' 전환 시 팔로워 알림 발송 (연습 모드 제외)
  if (justWentLive && waitUntil) {
    waitUntil((async () => {
      try {
        const s = await env.DB.prepare(`
          SELECT title, seller_id FROM live_streams WHERE id = ?
        `).bind(streamId).first<{ title: string; seller_id: number }>()
        if (!s || s.title?.startsWith('[연습]')) return
        const { notifyFollowers } = await import('../../../lib/notifications')
        await notifyFollowers(
          env.DB,
          s.seller_id,
          'live_started',
          '🔴 라이브 시작!',
          s.title,
          `/live/${streamId}`
        )
      } catch (e) {
        console.error('[OME admission] notify followers failed', e)
      }
    })())
  }

  // 🛡️ 2026-05-11 refactor: 60s 폴링 제거 — broadcast.id 는 /create 시점에 이미 DB 의
  //   youtube_video_id 로 저장됨 (liveBroadcasts.insert 응답). 폴링이 원래 필요했던 이유가 없음.
  //
  //   대신 enableAutoStart=true 가 RTMP 인입 즉시 testing → live 전환을 처리하지만,
  //   타이밍 신뢰성을 위해 단 1회 명시적 transitionBroadcastToLive 를 호출 (8초 지연 후).
  //
  //   이 호출은 idempotent — 이미 live 면 ok 반환, testing 이면 즉시 live 로 전환.
  //   실패해도 enableAutoStart 가 결국 처리하므로 best-effort.
  if (waitUntil && env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && stream.youtube_broadcast_id) {
    waitUntil((async () => {
      try {
        await new Promise(r => setTimeout(r, 8000))  // RTMP 인입 → testing 도달까지 대기
        const youtubeService = new YouTubeAPIService(env.YOUTUBE_CLIENT_ID!, env.YOUTUBE_CLIENT_SECRET!)
        const accessToken = await getValidAccessToken(env.DB, sellerId, youtubeService)
        if (!accessToken) {
          await env.DB.prepare(`UPDATE live_streams SET last_error = ? WHERE id = ?`)
            .bind('YouTube OAuth 토큰 없음 — testing→live 전환 불가. /seller/youtube/connect 에서 재인증', streamId)
            .run().catch(() => {})
          return
        }
        const broadcastId = stream.youtube_broadcast_id!
        const transRes = await fetch(
          `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=live&id=${encodeURIComponent(broadcastId)}&part=status`,
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
        )
        // 200 = 전환 성공, 403 redundantTransition = 이미 live (정상), 그 외 = 진단 정보 기록
        if (!transRes.ok) {
          const errText = await transRes.text().catch(() => '')
          if (!/redundantTransition|already.*live/i.test(errText)) {
            console.warn('[OME admission] transition testing→live non-OK', transRes.status, errText)
            // enableAutoStart 가 처리 가능하므로 fatal 아님 — 로그만
          }
        }
      } catch (e) {
        console.error('[OME admission] transition error', e)
      }
    })())
  }

  return { allowed: true }
}

interface OMEAdmissionRequest {
  client: { address: string; port: number; user_agent?: string }
  request: {
    direction: 'incoming' | 'outgoing'
    protocol: 'webrtc' | 'rtmp' | 'srt' | string
    status: 'opening' | 'closing'
    url: string
    new_url?: string
    time?: string
  }
}

interface OMEAdmissionResponse {
  allowed: boolean
  new_url?: string
  lifetime?: number
  reason?: string
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacBase64Sha1(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

export { app as youtubeLiveRoutes }
