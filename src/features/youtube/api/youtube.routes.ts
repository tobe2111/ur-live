/**
 * YouTube OAuth & Live Streaming API Routes
 * Prism-style zero-setup live streaming
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify as honoVerify } from 'hono/jwt'
import { YouTubeAPIService } from '../services/youtube-api.service'
import type { 
  YouTubeOAuthTokens, 
  YouTubeChannel, 
  YouTubeLiveSetup,
  SellerYouTubeAuth 
} from '../types'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  YOUTUBE_CLIENT_ID?: string
  YOUTUBE_CLIENT_SECRET?: string
  YOUTUBE_REDIRECT_URI?: string
}

interface JwtPayload {
  seller_id?: number | string
  sub?: number | string
  type?: string
  userType?: string
}

interface SellerYouTubeAuthRow {
  id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  google_email: string
  is_active: number
  created_at: string
}

const app = new Hono<{ Bindings: Bindings }>()

// 테이블 자동 생성 (마이그레이션 미적용 시 fallback)
async function ensureYouTubeTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS seller_youtube_oauth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        google_email TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        channel_id TEXT NOT NULL,
        channel_title TEXT,
        channel_thumbnail TEXT,
        subscriber_count INTEGER DEFAULT 0,
        default_stream_id TEXT,
        default_rtmp_url TEXT,
        default_rtmp_key TEXT,
        has_persistent_key INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(seller_id, channel_id)
      )
    `).run()
  } catch { /* already exists */ }

  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS stream_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stream_id, product_id)
      )
    `).run()
  } catch { /* already exists */ }

  // live_streams에 누락 컬럼 추가 (SQLite에서 이미 있으면 에러 → catch)
  const columns = [
    'youtube_broadcast_id TEXT',
    'youtube_stream_key TEXT',
    'youtube_live_chat_id TEXT',
    'rtmp_url TEXT',
    'rtmp_key TEXT',
    'youtube_embed_url TEXT',
    'youtube_url TEXT',
    'current_product_id INTEGER',
    'product_display_mode TEXT DEFAULT \'current_only\'',
  ]
  for (const col of columns) {
    try { await DB.prepare(`ALTER TABLE live_streams ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
}

// CORS configuration
app.use('/*', cors({
  origin: [
    'https://live.ur-team.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}))

/**
 * Helper: Extract seller ID from JWT
 * Uses hono/jwt verify to be compatible with seller login tokens
 */
async function getSellerIdFromToken(authHeader: string | undefined, secret: string): Promise<number | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  
  try {
    const token = authHeader.substring(7)
    
    // Use hono/jwt verify (same library used during login)
    let payload: JwtPayload
    try {
      payload = await honoVerify(token, secret, 'HS256') as JwtPayload
    } catch (verifyError) {
      // Try without algorithm specification as fallback
      try {
        payload = await honoVerify(token, secret, 'HS256') as JwtPayload
      } catch {
        console.error('[YouTube Auth] JWT verification failed:', verifyError)
        return null
      }
    }
    
    if (!payload) return null
    
    // Support both seller_id and sub fields
    const sellerId = payload.seller_id || payload.sub
    if (!sellerId) {
      console.error('[YouTube Auth] No seller_id in token payload:', Object.keys(payload))
      return null
    }
    
    // Verify this is a seller token
    if (payload.type !== 'seller' && payload.userType !== 'seller') {
      console.error('[YouTube Auth] Token type is not seller:', payload.type || payload.userType)
      return null
    }
    
    return Number(sellerId)
  } catch (error) {
    console.error('[YouTube Auth] JWT verification error:', error)
    return null
  }
}

/**
 * Helper: Get or refresh access token
 */
async function getValidAccessToken(
  db: D1Database,
  sellerId: number,
  youtubeService: YouTubeAPIService
): Promise<string | null> {
  const auth = await db.prepare(`
    SELECT * FROM seller_youtube_oauth 
    WHERE seller_id = ? AND is_active = 1 
    ORDER BY created_at DESC LIMIT 1
  `).bind(sellerId).first<SellerYouTubeAuth>()

  if (!auth) return null

  // Check if token is expired (with 5-minute buffer)
  if (auth.expires_at > Date.now() + 5 * 60 * 1000) {
    return auth.access_token
  }

  // Refresh token
  try {
    const tokens = await youtubeService.refreshAccessToken(auth.refresh_token)
    
    // Update database
    await db.prepare(`
      UPDATE seller_youtube_oauth 
      SET access_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(tokens.access_token, tokens.expires_at, auth.id).run()

    return tokens.access_token
  } catch (error) {
    console.error('[YouTube] Token refresh failed:', error)
    return null
  }
}

/**
 * GET /api/youtube/auth-url
 * Get YouTube OAuth authorization URL
 */
app.get('/auth-url', async (c) => {
  const clientId = c.env.YOUTUBE_CLIENT_ID
  const redirectUri = c.env.YOUTUBE_REDIRECT_URI || 'https://live.ur-team.com/seller/youtube/callback'

  if (!clientId) {
    return c.json({
      success: false,
      error: 'YouTube OAuth not configured'
    }, 500)
  }

  const scopes = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.readonly'
  ]

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes.join(' '))}&` +
    `access_type=offline&` +
    `prompt=consent`

  return c.json({
    success: true,
    data: {
      authUrl,
      redirectUri
    }
  })
})

/**
 * POST /api/youtube/oauth/callback
 * Handle OAuth callback
 */
app.post('/oauth/callback', async (c) => {
  await ensureYouTubeTables(c.env.DB)
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  
  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다',
      error_code: 'AUTH_REQUIRED'
    }, 401)
  }

  const { code } = await c.req.json()
  
  if (!code) {
    return c.json({
      success: false,
      error: 'Authorization code is required'
    }, 400)
  }

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  const redirectUri = c.env.YOUTUBE_REDIRECT_URI || 'https://live.ur-team.com/seller/youtube/callback'

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'YouTube OAuth not configured'
    }, 500)
  }

  try {
    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    
    // Exchange code for tokens
    const tokens = await youtubeService.exchangeCodeForTokens(code, redirectUri)
    
    // Get user's channels
    const channels = await youtubeService.getChannels(tokens.access_token)
    
    if (channels.length === 0) {
      return c.json({
        success: false,
        error: 'No YouTube channels found'
      }, 400)
    }

    // Use the first channel (or let user select)
    const channel = channels[0]

    // Get Google email from token (decode ID token if available)
    // For now, use channel ID as identifier
    const googleEmail = channel.customUrl || `${channel.id}@youtube.com`

    // Save to database
    const result = await c.env.DB.prepare(`
      INSERT INTO seller_youtube_oauth (
        seller_id, google_email, access_token, refresh_token, expires_at,
        channel_id, channel_title, channel_thumbnail, subscriber_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(seller_id, channel_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        channel_thumbnail = excluded.channel_thumbnail,
        subscriber_count = excluded.subscriber_count,
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      sellerId,
      googleEmail,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_at,
      channel.id,
      channel.title,
      channel.thumbnail,
      channel.subscriberCount
    ).run()

    return c.json({
      success: true,
      data: {
        channel,
        allChannels: channels
      }
    })
  } catch (error: unknown) {
    console.error('[YouTube OAuth] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to authenticate with YouTube'
    }, 500)
  }
})

/**
 * GET /api/youtube/channels
 * Get seller's YouTube channels
 */
app.get('/channels', async (c) => {
  await ensureYouTubeTables(c.env.DB)
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  
  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  try {
    const auth = await c.env.DB.prepare(`
      SELECT * FROM seller_youtube_oauth 
      WHERE seller_id = ? AND is_active = 1
      ORDER BY created_at DESC
    `).bind(sellerId).all()

    return c.json({
      success: true,
      data: (auth.results as unknown as (SellerYouTubeAuthRow & { default_stream_id?: string; default_rtmp_url?: string; default_rtmp_key?: string })[]).map((a) => ({
        id: a.id,
        channel_id: a.channel_id,
        channel_title: a.channel_title,
        channel_thumbnail: a.channel_thumbnail,
        subscriber_count: a.subscriber_count,
        google_email: a.google_email,
        is_active: a.is_active,
        created_at: a.created_at,
        default_rtmp_url: a.default_rtmp_url || null,
        default_rtmp_key: a.default_rtmp_key || null,
        has_persistent_key: !!a.default_stream_id,
      }))
    })
  } catch (error: unknown) {
    console.error('[YouTube Channels] Error:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch channels'
    }, 500)
  }
})

/**
 * POST /api/youtube/live/create
 * Create a new YouTube live broadcast (zero-setup)
 */
app.post('/live/create', async (c) => {
  await ensureYouTubeTables(c.env.DB)
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  
  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  const { title, description, product_ids, scheduled_start_time } = await c.req.json()

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

  try {
    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    
    // Get valid access token
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    
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
    const sellerAuth = await c.env.DB.prepare(`
      SELECT default_stream_id, default_rtmp_url, default_rtmp_key
      FROM seller_youtube_oauth
      WHERE seller_id = ? AND is_active = 1
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
        scheduledTime
      )
    } else {
      // First time or no persistent stream — create new + save as default
      liveSetup = await youtubeService.setupLiveStream(
        accessToken,
        title,
        description || '',
        scheduledTime
      )

      // Save as persistent stream for future use
      await c.env.DB.prepare(`
        UPDATE seller_youtube_oauth
        SET default_stream_id = ?, default_rtmp_url = ?, default_rtmp_key = ?, updated_at = CURRENT_TIMESTAMP
        WHERE seller_id = ? AND is_active = 1
      `).bind(
        liveSetup.stream.id,
        liveSetup.rtmpUrl,
        liveSetup.rtmpKey,
        sellerId
      ).run()
    }

    // Save to database
    const streamResult = await c.env.DB.prepare(`
      INSERT INTO live_streams (
        seller_id, title, description, status,
        youtube_video_id, youtube_broadcast_id, youtube_stream_key, youtube_live_chat_id,
        rtmp_url, rtmp_key, youtube_embed_url,
        scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      sellerId,
      title,
      description || '',
      'scheduled',
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

    // Link products if provided
    if (product_ids && product_ids.length > 0) {
      for (const productId of product_ids) {
        await c.env.DB.prepare(`
          INSERT INTO stream_products (stream_id, product_id, created_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(streamId, productId).run()
      }
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
        SET status = 'live', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
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
      SET status = 'live', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
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
        SET status = 'live', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
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
 * DELETE /api/youtube/oauth/:id
 * Disconnect YouTube account
 */
app.delete('/oauth/:id', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  
  if (!sellerId) {
    return c.json({
      success: false,
      error: '로그인이 필요합니다'
    }, 401)
  }

  const authId = parseInt(c.req.param('id'))

  try {
    await c.env.DB.prepare(`
      UPDATE seller_youtube_oauth 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND seller_id = ?
    `).bind(authId, sellerId).run()

    return c.json({
      success: true,
      message: 'YouTube account disconnected'
    })
  } catch (error: unknown) {
    console.error('[YouTube Disconnect] Error:', error)
    return c.json({
      success: false,
      error: 'Failed to disconnect YouTube account'
    }, 500)
  }
})

/**
 * GET /api/youtube/shorts/sync
 * YouTube 채널에서 Shorts 영상을 가져와 유어딜 shorts 테이블에 동기화
 */
app.get('/shorts/sync', async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인 필요' }, 401)

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'YouTube API 미설정' }, 500)

  try {
    const youtubeService = new YouTubeAPIService(clientId, clientSecret)
    const accessToken = await getValidAccessToken(c.env.DB, sellerId, youtubeService)
    if (!accessToken) return c.json({ success: false, error: 'YouTube 인증 필요' }, 401)

    // 채널 ID 가져오기
    const authRow = await c.env.DB.prepare(
      'SELECT channel_id FROM seller_youtube_oauth WHERE seller_id = ? AND is_active = 1 LIMIT 1'
    ).bind(sellerId).first<{ channel_id: string }>()

    if (!authRow) return c.json({ success: false, error: '연동된 채널 없음' }, 404)

    // YouTube Search API로 Shorts 가져오기
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&channelId=${authRow.channel_id}&type=video&` +
      `videoDuration=short&maxResults=20&order=date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!searchRes.ok) throw new Error('YouTube API 오류')

    const data = await searchRes.json() as any
    const items = data.items || []
    let synced = 0

    // shorts 테이블에 ensureTable
    try {
      await c.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS shorts (
          id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL,
          title TEXT NOT NULL, description TEXT, video_url TEXT NOT NULL,
          youtube_video_id TEXT, thumbnail_url TEXT, duration INTEGER DEFAULT 0,
          view_count INTEGER DEFAULT 0, like_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active', product_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()
    } catch { /* exists */ }

    for (const item of items) {
      const videoId = item.id?.videoId
      if (!videoId) continue

      // 이미 등록된 영상이면 스킵
      const existing = await c.env.DB.prepare(
        'SELECT id FROM shorts WHERE youtube_video_id = ? AND seller_id = ?'
      ).bind(videoId, sellerId).first()

      if (existing) continue

      await c.env.DB.prepare(`
        INSERT INTO shorts (seller_id, title, video_url, youtube_video_id, thumbnail_url, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).bind(
        sellerId,
        item.snippet?.title || 'YouTube Shorts',
        `https://youtube.com/shorts/${videoId}`,
        videoId,
        item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null
      ).run()

      synced++
    }

    return c.json({ success: true, data: { total: items.length, synced }, message: `${synced}개 쇼츠 동기화 완료` })
  } catch (err) {
    console.error('[YouTube Shorts Sync]', err)
    return c.json({ success: false, error: '쇼츠 동기화 실패' }, 500)
  }
})

export default app
