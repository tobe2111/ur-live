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
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { swallow } from '@/worker/utils/swallow'
import { YouTubeAPIService } from '../services/youtube-api.service'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { ensureYouTubeTables, getValidAccessToken } from './youtube.routes'
import { registerOmePush, stopOmePush, cleanupAllOmePushes, terminateOmeStream } from './ome-push'
import { trackQuota, getQuotaUsage, QUOTA_COST } from './youtube-quota'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAdmin } from '@/worker/middleware/auth'

const app = new Hono<{ Bindings: Env }>()
// 🛡️ 2026-05-12: 서브라우터 cors() 제거 — index.ts 전역 cors() 가 처리. 중복 제거.

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

// YouTube live 생성은 quota 비용 100 → 셀러당 시간당 5회로 제한
app.post('/live/create', rateLimit({ action: 'youtube_live_create', max: 5, windowSec: 3600 }), async (c) => {
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
    const scheduledTime = scheduled_start_time || new Date(Date.now() + 5 * 60 * 1000).toISOString()

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
      // 🛡️ 2026-05-11 P3-#10: setupLiveStream = liveBroadcasts.insert(50) + liveStreams.insert(50) + bind(50) = 150
      await trackQuota(c.env, QUOTA_COST.insert * 3, 'setup_live_stream', c.executionCtx)

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
      // 🛡️ 2026-05-11: /create 시점 OME push 등록 제거 — admission 만 권위 있는 등록 시점.
      //   이유: /create 와 admission 이 race 하면서 둘 다 Duplicate ID 충돌 → 영구 실패.
      //   admission 의 stopPush-first 가 clean state 를 보장.
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
              ).then(() => trackQuota(c.env, QUOTA_COST.thumbnailSet, 'thumbnail_set', c.executionCtx))
                .catch((e) => console.error('[create] thumbnail upload failed', e))
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

  const scheduledTime = scheduled_start_time || new Date(Date.now() + 5 * 60 * 1000).toISOString()

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
  if (!/^\d+$/.test(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
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
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
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
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
  // 🛡️ 2026-05-11 Option D: body 는 호환성 유지용으로 읽되 mode 분기 불필요 (autoStart=true 가 처리)
  await c.req.json().catch(() => ({}))

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

    // 🛡️ 2026-05-11 Option D 최적화: enableAutoStart=true 라 YouTube 가 데이터 도착 즉시
    //   ready→live 자동 전환. 수동 transition 호출 불필요 — best-effort 로 한 번만 시도.
    //   (autoStart 가 아직 트리거 안 됐을 가능성 대비 — 보통 즉시 성공)
    try {
      await youtubeService.transitionBroadcastToLive(accessToken, stream.youtube_broadcast_id as string)
      await trackQuota(c.env, QUOTA_COST.transition, 'transition_live', c.executionCtx)
    } catch (e) {
      // redundantTransition (이미 live) 또는 invalidTransition (아직 active 안 됨) — autoStart 가 처리
      const msg = (e as Error).message || ''
      if (!/redundantTransition|already|invalidTransition/i.test(msg)) {
        console.warn('[YouTube Live Start] Transition non-critical error:', msg)
      }
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
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
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
 * GET /api/youtube/live/:id/diagnose
 *
 * 🛡️ 2026-05-11: 라이브 파이프라인 전수 진단.
 *   한 stream 의 모든 단계 상태를 한 번에 노출:
 *     DB → OME publish → OME push → YouTube broadcast → 시청자 embed
 *   어디서 막혔는지 한 응답으로 즉시 확인 가능.
 */
app.get('/live/:id/diagnose', async (c) => {
  // 🛡️ 2026-05-11: admin_token 또는 셀러 JWT 둘 중 하나로 인증. admin_token 은
  //   DIAGNOSE_TOKEN env 와 일치해야 함 (정확 비교) — 셀러 외 (운영자) 가 진단하기 위함.
  const adminToken = c.req.query('admin_token')
  const expectedAdminToken = (c.env as { DIAGNOSE_TOKEN?: string }).DIAGNOSE_TOKEN
  let sellerId: number | null = null
  let bypassAuth = false
  if (adminToken && expectedAdminToken && adminToken === expectedAdminToken) {
    bypassAuth = true
  } else {
    sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인 또는 admin_token 필요' }, 401)
  }

  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)

  // 1. DB 레코드
  const dbStream = await (bypassAuth
    ? c.env.DB.prepare(`
        SELECT id, seller_id, status, started_at, ended_at, last_error,
               youtube_video_id, youtube_broadcast_id, youtube_stream_key,
               rtmp_url, rtmp_key, youtube_embed_url, title, created_at
        FROM live_streams WHERE id = ?
      `).bind(streamId)
    : c.env.DB.prepare(`
        SELECT id, seller_id, status, started_at, ended_at, last_error,
               youtube_video_id, youtube_broadcast_id, youtube_stream_key,
               rtmp_url, rtmp_key, youtube_embed_url, title, created_at
        FROM live_streams WHERE id = ? AND seller_id = ?
      `).bind(streamId, sellerId)
  ).first<{
    id: number; seller_id: number; status: string; started_at: string | null; ended_at: string | null;
    last_error: string | null; youtube_video_id: string | null; youtube_broadcast_id: string | null;
    youtube_stream_key: string | null; rtmp_url: string | null; rtmp_key: string | null;
    youtube_embed_url: string | null; title: string; created_at: string;
  }>()

  if (!dbStream) return c.json({ success: false, error: 'Stream not found' }, 404)

  const diagnostics: Record<string, unknown> = {
    db: {
      id: dbStream.id,
      title: dbStream.title,
      status: dbStream.status,
      started_at: dbStream.started_at,
      ended_at: dbStream.ended_at,
      last_error: dbStream.last_error,
      youtube_video_id: dbStream.youtube_video_id,
      youtube_broadcast_id: dbStream.youtube_broadcast_id,
      has_rtmp_key: !!dbStream.rtmp_key,
      rtmp_url: dbStream.rtmp_url,
      youtube_embed_url: dbStream.youtube_embed_url,
      created_at: dbStream.created_at,
    },
  }

  // 2. OME stream 인입 여부 + push 등록 여부
  if (c.env.OME_HOST && c.env.OME_API_TOKEN) {
    const auth = btoa(c.env.OME_API_TOKEN)
    const omeBase = `http://${c.env.OME_HOST}:8081/v1/vhosts/default/apps/app`
    // 2a. streams 조회
    try {
      const sRes = await fetch(`${omeBase}/streams`, { headers: { Authorization: `Basic ${auth}` } })
      const sData = sRes.ok ? await sRes.json().catch(() => null) as { response?: string[] } | null : null
      const streamName = `s${streamId}`
      diagnostics.ome_stream = {
        ome_reachable: sRes.ok,
        all_streams: sData?.response || [],
        this_stream_present: (sData?.response || []).includes(streamName),
        expected_name: streamName,
      }
    } catch (e) {
      diagnostics.ome_stream = { error: String((e as Error)?.message || e) }
    }
    // 2b. pushes 조회
    try {
      const pRes = await fetch(`${omeBase}:pushes`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const pData = pRes.ok ? await pRes.json().catch(() => null) as { response?: Array<{ id: string; state?: string; url?: string; sentBytes?: number; sentTime?: number }> } | null : null
      const pushId = `youtube-${streamId}`
      const ourPush = (pData?.response || []).find((p) => p.id === pushId)
      diagnostics.ome_push = {
        pushes_api_ok: pRes.ok,
        all_push_ids: (pData?.response || []).map((p) => p.id),
        our_push_present: !!ourPush,
        our_push_state: ourPush?.state,
        our_push_url: ourPush?.url,
        our_push_sent_bytes: ourPush?.sentBytes,
        expected_id: pushId,
      }
    } catch (e) {
      diagnostics.ome_push = { error: String((e as Error)?.message || e) }
    }
  } else {
    diagnostics.ome_stream = { error: 'OME_HOST or OME_API_TOKEN not configured' }
  }

  // 3. YouTube broadcast 상태
  if (dbStream.youtube_broadcast_id && c.env.YOUTUBE_CLIENT_ID && c.env.YOUTUBE_CLIENT_SECRET) {
    try {
      const youtubeService = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
      const accessToken = await getValidAccessToken(c.env.DB, dbStream.seller_id, youtubeService)
      if (accessToken) {
        const ytRes = await fetch(
          `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status,contentDetails&id=${encodeURIComponent(dbStream.youtube_broadcast_id)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        const ytData = ytRes.ok ? await ytRes.json().catch(() => null) as { items?: Array<{ id: string; status?: { lifeCycleStatus?: string; privacyStatus?: string }; contentDetails?: { enableAutoStart?: boolean; boundStreamId?: string } }> } | null : null
        const broadcast = ytData?.items?.[0]
        diagnostics.youtube_broadcast = {
          api_ok: ytRes.ok,
          api_status: ytRes.status,
          found: !!broadcast,
          life_cycle_status: broadcast?.status?.lifeCycleStatus,
          privacy_status: broadcast?.status?.privacyStatus,
          enable_auto_start: broadcast?.contentDetails?.enableAutoStart,
          bound_stream_id: broadcast?.contentDetails?.boundStreamId,
        }
        // 3b. liveStream status (RTMP 인입 받고 있는지)
        if (broadcast?.contentDetails?.boundStreamId) {
          const lsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/liveStreams?part=id,status&id=${encodeURIComponent(broadcast.contentDetails.boundStreamId)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          )
          const lsData = lsRes.ok ? await lsRes.json().catch(() => null) as { items?: Array<{ status?: { streamStatus?: string; healthStatus?: { status?: string } } }> } | null : null
          diagnostics.youtube_stream = {
            stream_status: lsData?.items?.[0]?.status?.streamStatus,
            health_status: lsData?.items?.[0]?.status?.healthStatus?.status,
          }
        }
      } else {
        diagnostics.youtube_broadcast = { error: 'no access token (OAuth expired?)' }
      }
    } catch (e) {
      diagnostics.youtube_broadcast = { error: String((e as Error)?.message || e) }
    }
  } else {
    diagnostics.youtube_broadcast = { error: 'no youtube_broadcast_id' }
  }

  // 4. 종합 진단
  const issues: string[] = []
  const ome_stream = diagnostics.ome_stream as { this_stream_present?: boolean }
  const ome_push = diagnostics.ome_push as { our_push_present?: boolean; our_push_state?: string; our_push_sent_bytes?: number }
  const yt = diagnostics.youtube_broadcast as { life_cycle_status?: string; enable_auto_start?: boolean }
  const ys = diagnostics.youtube_stream as { stream_status?: string; health_status?: string } | undefined

  if (!ome_stream?.this_stream_present) issues.push(`OME 에 stream "s${streamId}" 미존재 — 셀러가 송출 시작 안 했거나 OME admission 실패`)
  if (!ome_push?.our_push_present) issues.push(`OME 에 push "youtube-${streamId}" 미등록 — admission 의 startPush 실패. last_error 확인`)
  else if (!['pushing', 'pulling', 'connected'].includes(ome_push.our_push_state || '')) issues.push(`OME push state=${ome_push.our_push_state} (정상: pushing/pulling/connected)`)
  else if ((ome_push.our_push_sent_bytes ?? 0) === 0) issues.push(`OME push 등록은 됐지만 sentBytes=0 — RTMP 연결 실패 가능 (YouTube stream key 불일치?)`)
  if (yt?.life_cycle_status && !['live', 'testing'].includes(yt.life_cycle_status)) issues.push(`YouTube broadcast lifeCycleStatus=${yt.life_cycle_status} — RTMP 신호 미수신`)
  if (ys?.stream_status && ys.stream_status !== 'active') issues.push(`YouTube liveStream status=${ys.stream_status} (정상: active)`)
  if (yt?.life_cycle_status === 'testing') issues.push(`YouTube broadcast 가 testing 상태 — 시청자에게 검은 화면. transition 필요.`)

  diagnostics.summary = {
    healthy: issues.length === 0,
    issues,
  }

  return c.json({ success: true, data: diagnostics })
})

/**
 * POST /api/youtube/live/:id/_force-live
 *
 * 🛡️ 2026-05-11: ready 또는 testing 상태에 멈춘 broadcast 를 강제로 live 로 전환.
 *   admin_token 매칭 시 인증 우회. 정상 admission 의 transition 이 실패한 stream 응급 복구용.
 */
app.post('/live/:id/_force-live', async (c) => {
  const adminToken = c.req.query('admin_token')
  const expectedAdminToken = (c.env as { DIAGNOSE_TOKEN?: string }).DIAGNOSE_TOKEN
  if (!adminToken || !expectedAdminToken || adminToken !== expectedAdminToken) {
    return c.json({ success: false, error: 'admin_token required' }, 401)
  }
  const streamId = parseInt(c.req.param('id'))
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)

  const stream = await c.env.DB.prepare(
    'SELECT seller_id, youtube_broadcast_id FROM live_streams WHERE id = ?'
  ).bind(streamId).first<{ seller_id: number; youtube_broadcast_id: string | null }>()
  if (!stream?.youtube_broadcast_id) return c.json({ success: false, error: 'no broadcast id' }, 404)

  if (!c.env.YOUTUBE_CLIENT_ID || !c.env.YOUTUBE_CLIENT_SECRET) {
    return c.json({ success: false, error: 'YouTube not configured' }, 500)
  }

  const youtubeService = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
  const accessToken = await getValidAccessToken(c.env.DB, stream.seller_id, youtubeService)
  if (!accessToken) return c.json({ success: false, error: 'OAuth token unavailable' }, 401)

  const broadcastId = stream.youtube_broadcast_id
  const results: Record<string, { status: number; body?: string }> = {}

  // 🛡️ 2026-05-11: 1) broadcast contentDetails 를 monitorStream=false + autoStart=false 로 PATCH.
  //   기존 broadcast 가 monitorStream=true 로 만들어졌으면 testing 거쳐야 해서 transition 불가.
  //   PATCH 후 ready→live 직접 transition 가능.
  const patchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=contentDetails`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: broadcastId,
        contentDetails: {
          enableAutoStart: false,
          enableAutoStop: false,
          monitorStream: { enableMonitorStream: false },
          recordFromStart: true,
          enableDvr: true,
          enableEmbed: true,
          latencyPreference: 'low',
        },
      }),
    }
  )
  results.patch = { status: patchRes.status, body: patchRes.ok ? undefined : await patchRes.text().catch(() => '') }

  // 2) 짧은 대기 후 ready→live transition
  await new Promise(r => setTimeout(r, 2000))
  for (const status of ['live'] as const) {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=${status}&id=${encodeURIComponent(broadcastId)}&part=status`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
    )
    results[status] = { status: res.status, body: res.ok ? undefined : await res.text().catch(() => '') }
  }
  return c.json({ success: true, results })
})

/**
 * POST /api/youtube/live/_cleanup-pushes
 *
 * 🛡️ 2026-05-11: OME 에 누적된 모든 zombie push 정리 — admin 전용.
 *   admin_token 매칭 시 모든 push 삭제. 새 방송이 정상 등록되도록 clean state 보장.
 */
app.post('/live/_cleanup-pushes', async (c) => {
  const adminToken = c.req.query('admin_token')
  const expectedAdminToken = (c.env as { DIAGNOSE_TOKEN?: string }).DIAGNOSE_TOKEN
  if (!adminToken || !expectedAdminToken || adminToken !== expectedAdminToken) {
    return c.json({ success: false, error: 'admin_token required' }, 401)
  }
  const removed = await cleanupAllOmePushes(c.env)
  return c.json({ success: true, removed })
})

/**
 * GET /api/youtube/live/_quota
 * 🛡️ 2026-05-11 P3-#10: YouTube API quota 일일 사용량 조회 (admin 전용).
 *   80% / 95% 도달 시 응답에 warning 표시. 알림 채널 추가는 cron 에서 처리.
 */
app.get('/live/_quota', async (c) => {
  const adminToken = c.req.query('admin_token')
  const expectedAdminToken = (c.env as { DIAGNOSE_TOKEN?: string }).DIAGNOSE_TOKEN
  if (!adminToken || !expectedAdminToken || adminToken !== expectedAdminToken) {
    return c.json({ success: false, error: 'admin_token required' }, 401)
  }
  const usage = await getQuotaUsage(c.env)
  return c.json({ success: true, data: usage })
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
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
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
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)

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
          await trackQuota(c.env, QUOTA_COST.transition, 'transition_end', c.executionCtx)
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
 * POST /api/youtube/live/:id/end-beacon
 * 🛡️ 2026-05-11 P0-#1: sendBeacon 전용 종료 endpoint.
 *   탭/브라우저 닫힘 시 Authorization 헤더 못 보냄 → 토큰을 body 로 받아 검증.
 *   좀비 스트림 방지용 best-effort cleanup. 204 No Content 만 응답 (beacon 응답 무시됨).
 */
app.post('/live/:id/end-beacon', async (c) => {
  const streamId = parseInt(c.req.param('id'))
  if (!streamId) return c.body(null, 204)

  let body: { token?: string; reason?: string } = {}
  try { body = await c.req.json() } catch { /* ignore */ }

  // body 의 token 으로 인증 (sendBeacon 은 Authorization 헤더 불가)
  const sellerId = body.token ? await getSellerIdFromToken(`Bearer ${body.token}`, c.env.JWT_SECRET) : null
  if (!sellerId) return c.body(null, 204)

  try {
    const stream = await c.env.DB.prepare(`
      SELECT youtube_broadcast_id, status FROM live_streams WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first<{ youtube_broadcast_id: string | null; status: string }>()

    if (!stream || stream.status === 'ended') return c.body(null, 204)

    // YouTube broadcast 종료 (best-effort)
    if (stream.youtube_broadcast_id && c.env.YOUTUBE_CLIENT_ID && c.env.YOUTUBE_CLIENT_SECRET) {
      try {
        const yt = new YouTubeAPIService(c.env.YOUTUBE_CLIENT_ID, c.env.YOUTUBE_CLIENT_SECRET)
        const token = await getValidAccessToken(c.env.DB, sellerId, yt)
        if (token) await yt.endBroadcast(token, stream.youtube_broadcast_id)
      } catch (e) { console.warn('[end-beacon] YouTube end skip:', e) }
    }

    await c.env.DB.prepare(`
      UPDATE live_streams
      SET status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, last_error = ?
      WHERE id = ?
    `).bind(`auto-ended: ${body.reason || 'tab_close'}`, streamId).run()

    await stopOmePush(c.env, streamId)
  } catch (e) {
    console.error('[end-beacon] error', e)
  }
  return c.body(null, 204)
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
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
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
app.post('/admin/rotate-all-stream-keys', requireAdmin(), async (c) => {
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
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
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
  if (!Number.isFinite(streamId)) return c.json({ success: false, error: 'invalid id' }, 400)
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
  // youtube_whip_available: 항상 true — rtmp_key 있는 stream 이면 YouTube WHIP 직접 사용 가능.
  // 실제 rtmp_key 보유 여부는 /streaming/whip-token 에서 stream_id 기준으로 체크.
  return c.json({
    success: true,
    data: { ome_available: omeConfigured, youtube_whip_available: true },
  })
})

/**
 * POST /api/seller/youtube/streaming/whip-token
 * 브라우저 publish 시작 전 호출. WHIP endpoint URL 반환.
 *
 * 🚨 2026-05-12 (LIVE-START-FIX): Option D (YouTube WHIP direct) 제거.
 *   YouTube `a.upload.youtube.com/upload/streamer` 엔드포인트는 CORS 헤더가 없어 브라우저에서
 *   직접 POST 시 preflight 차단. WebRTC/WHIP 브라우저 publish 는 OME 경유만 가능.
 *   OME 서버가 RTMP 로 YouTube 에 재push. (이전: 모든 라이브 시작이 CORS 에러로 영구 실패)
 *
 * 시나리오:
 *   - OME 설정됨 → OME WHIP URL 반환 (정상 경로)
 *   - OME 미구성 + rtmp_key 있음 → OBS 등 외부 도구 안내 (OBS_REQUIRED)
 *   - 둘 다 없음 → 503
 */
app.post('/streaming/whip-token', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const { stream_id } = await c.req.json<{ stream_id: number }>()
  if (!stream_id || !Number.isFinite(stream_id)) {
    return c.json({ success: false, error: 'stream_id 가 필요합니다' }, 400)
  }

  // 본인 stream 검증
  const stream = await c.env.DB.prepare(`
    SELECT id, rtmp_url, rtmp_key, youtube_broadcast_id, status
    FROM live_streams WHERE id = ? AND seller_id = ?
  `).bind(stream_id, sellerId).first<{
    id: number; rtmp_url: string; rtmp_key: string;
    youtube_broadcast_id: string | null; status: string;
  }>()

  if (!stream) return c.json({ success: false, error: 'Stream not found' }, 404)

  // OME 가 없으면 브라우저 라이브 불가 (YouTube 직접 WHIP 은 CORS 차단)
  if (!c.env.OME_HOST || !c.env.OME_WEBHOOK_SECRET) {
    // rtmp_key 있으면 OBS 외부 도구로 송출 가능 — 명확히 안내
    if (stream.rtmp_key) {
      return c.json({
        success: false,
        error: '브라우저 라이브 미지원 환경입니다. OBS 등 외부 도구로 송출해주세요.',
        error_code: 'OBS_REQUIRED',
        rtmp_url: stream.rtmp_url,
      }, 503)
    }
    return c.json({ success: false, error: '미디어 서버 미구성', error_code: 'OME_NOT_CONFIGURED' }, 503)
  }
  // (참고: getQuotaUsage 는 YouTube WHIP direct 경로에서만 사용했음 — 제거됨)
  void getQuotaUsage;

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

  // 🛡️ 2026-05-12 (LIVE-FIX-2): 같은 stream name 의 zombie publisher 강제 종료.
  //   이전 publish 가 비정상 종료 (탭 닫힘 / 네트워크 끊김) 시 OME 가 즉시 정리 못 함 →
  //   다음 publish 가 409 Conflict 로 영구 실패. 새 토큰 발급 직전에 항상 정리.
  await terminateOmeStream(c.env, streamName)

  const whipUrl = `https://${c.env.OME_HOST}:3334/app/${streamName}?direction=whip&token=${encodeURIComponent(token)}`

  return c.json({
    success: true,
    data: {
      whip_url: whipUrl,
      mode: 'ome_whip',
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

  // 🛡️ 2026-05-11: admission(opening) 직후엔 OME stream 이 아직 OME 내부에 등록 안 됨.
  //   startPush 는 stream 존재가 전제 — 1500ms 지연으로 stream 인입 완료 시점을 기다림.
  //   /create 시점에도 push 등록을 시도하지만 stream 미존재로 실패할 가능성이 높음 → 여기가 실질적 등록 경로.
  if (env.OME_HOST && env.OME_API_TOKEN) {
    const reRegister = async () => {
      try {
        await new Promise((r) => setTimeout(r, 1500))
        const r = await registerOmePush(env, streamId, stream.rtmp_url, stream.rtmp_key)
        if (r.ok) {
          await env.DB.prepare(`UPDATE live_streams SET last_error = NULL WHERE id = ? AND last_error IS NOT NULL`)
            .bind(streamId).run().catch(() => {})
        } else {
          await env.DB.prepare(`UPDATE live_streams SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(`OME push 등록 실패 (${r.status}): ${(r.body || '').substring(0, 200)}`, streamId)
            .run().catch(() => {})
        }
      } catch (e) {
        console.error('[OME admission] push register failed', e)
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

  // 🛡️ 2026-05-11 Option D 최적화: enableAutoStart=true 라 OME push 시작 즉시 YouTube 가
  //   자동으로 ready→live 전환. 수동 transition 불필요 → 12s 대기 제거.
  //   /live/:id/status polling 이 라이브 상태 감지하면 DB sync.

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
