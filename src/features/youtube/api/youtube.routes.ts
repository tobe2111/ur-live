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
  seller_id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  google_email: string
  access_token: string
  refresh_token: string
  expires_at: number
  default_stream_id?: string
  default_rtmp_url?: string
  default_rtmp_key?: string
  has_persistent_key?: number
  is_active: number
  created_at: string
  updated_at: string
}

const app = new Hono<{ Bindings: Bindings }>()

// 테이블 자동 생성 (마이그레이션 미적용 시 fallback)
// 🛡️ 2026-04-28: youtube-live.routes.ts 에서 import 가능하도록 export
export async function ensureYouTubeTables(DB: D1Database) {
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

  // seller_youtube_oauth 누락 컬럼 추가
  const oauthColumns = [
    'expires_at INTEGER NOT NULL DEFAULT 0',
    'google_email TEXT',
    'channel_title TEXT',
    'channel_thumbnail TEXT',
    'subscriber_count INTEGER DEFAULT 0',
    'default_stream_id TEXT',
    'default_rtmp_url TEXT',
    'default_rtmp_key TEXT',
    'has_persistent_key INTEGER DEFAULT 0',
    'is_active INTEGER DEFAULT 1',
    'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
  ]
  for (const col of oauthColumns) {
    try { await DB.prepare(`ALTER TABLE seller_youtube_oauth ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }

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
    'thumbnail_url TEXT',
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
 * 🛡️ 2026-04-28: youtube-live.routes.ts 에서 import 가능하도록 export
 */
export async function getValidAccessToken(
  db: D1Database,
  sellerId: number,
  youtubeService: YouTubeAPIService,
  channelOAuthId?: number
): Promise<string | null> {
  const auth = channelOAuthId
    ? await db.prepare(`
        SELECT * FROM seller_youtube_oauth
        WHERE seller_id = ? AND id = ? AND is_active = 1
        LIMIT 1
      `).bind(sellerId, channelOAuthId).first<SellerYouTubeAuth>()
    : await db.prepare(`
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

  let code: string | undefined
  try {
    const body = await c.req.json()
    code = body.code
  } catch (e) {
    console.error('[YouTube OAuth] Invalid JSON body:', e)
    return c.json({ success: false, error: 'Invalid request body', error_code: 'INVALID_BODY' }, 400)
  }

  if (!code) {
    return c.json({
      success: false,
      error: '인증 코드가 없습니다. 다시 시도해주세요.',
      error_code: 'NO_CODE'
    }, 400)
  }

  const clientId = c.env.YOUTUBE_CLIENT_ID
  const clientSecret = c.env.YOUTUBE_CLIENT_SECRET
  const redirectUri = c.env.YOUTUBE_REDIRECT_URI || 'https://live.ur-team.com/seller/youtube/callback'

  if (!clientId || !clientSecret) {
    return c.json({
      success: false,
      error: 'YouTube OAuth not configured',
      error_code: 'OAUTH_NOT_CONFIGURED'
    }, 500)
  }

  try {
    const youtubeService = new YouTubeAPIService(clientId, clientSecret)

    // Exchange code for tokens
    // 🛡️ 2026-04-27: invalid_grant 별도 catch — 가장 흔한 사유 (code 만료/재사용)
    let tokens
    try {
      tokens = await youtubeService.exchangeCodeForTokens(code, redirectUri)
    } catch (tokenErr) {
      const msg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr)
      console.error('[YouTube OAuth] Token exchange failed:', msg)
      // invalid_grant 면 400 + 사용자 친화 메시지
      if (msg.includes('invalid_grant') || msg.includes('expired')) {
        return c.json({
          success: false,
          error: '인증 코드가 만료되었거나 이미 사용됐습니다. 다시 연동을 시도해주세요.',
          error_code: 'INVALID_GRANT',
          detail: msg,
        }, 400)
      }
      return c.json({
        success: false,
        error: `Google 토큰 교환 실패: ${msg}`,
        error_code: 'TOKEN_EXCHANGE_FAILED',
      }, 502)
    }

    // Get user's channels
    const channels = await youtubeService.getChannels(tokens.access_token)

    if (channels.length === 0) {
      return c.json({
        success: false,
        error: '연결한 Google 계정에 YouTube 채널이 없습니다. YouTube Studio 에서 채널을 먼저 만들어주세요.',
        error_code: 'NO_CHANNELS'
      }, 400)
    }

    // Use the first channel (or let user select)
    const channel = channels[0]

    // Get Google email from token (decode ID token if available)
    // For now, use channel ID as identifier
    const googleEmail = channel.customUrl || `${channel.id}@youtube.com`

    // Save to database — manual upsert to avoid ON CONFLICT constraint dependency
    const existing = await c.env.DB.prepare(
      'SELECT id FROM seller_youtube_oauth WHERE seller_id = ? AND channel_id = ?'
    ).bind(sellerId, channel.id).first<{ id: number }>()

    if (existing) {
      // Only overwrite refresh_token if Google returned a new one (prompt=consent always does,
      // but guard against empty string wiping a valid existing token)
      const refreshTokenToSave = tokens.refresh_token || null
      const sql = refreshTokenToSave
        ? `UPDATE seller_youtube_oauth SET
             access_token = ?, refresh_token = ?, expires_at = ?,
             google_email = ?, channel_thumbnail = ?, subscriber_count = ?,
             is_active = 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        : `UPDATE seller_youtube_oauth SET
             access_token = ?, expires_at = ?,
             google_email = ?, channel_thumbnail = ?, subscriber_count = ?,
             is_active = 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
      const params = refreshTokenToSave
        ? [tokens.access_token, refreshTokenToSave, tokens.expires_at, googleEmail, channel.thumbnail, channel.subscriberCount, existing.id]
        : [tokens.access_token, tokens.expires_at, googleEmail, channel.thumbnail, channel.subscriberCount, existing.id]
      await c.env.DB.prepare(sql).bind(...params).run()
    } else {
      await c.env.DB.prepare(`
        INSERT INTO seller_youtube_oauth (
          seller_id, google_email, access_token, refresh_token, expires_at,
          channel_id, channel_title, channel_thumbnail, subscriber_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sellerId, googleEmail, tokens.access_token, tokens.refresh_token, tokens.expires_at,
        channel.id, channel.title, channel.thumbnail, channel.subscriberCount
      ).run()
    }

    return c.json({
      success: true,
      data: {
        channel,
        allChannels: channels
      }
    })
  } catch (error: unknown) {
    console.error('[YouTube OAuth] Unexpected error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return c.json({
      success: false,
      error: `YouTube 연동 중 오류: ${msg}`,
      error_code: 'UNEXPECTED'
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
        token_expired: a.expires_at < Date.now() + 5 * 60 * 1000,
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
// 🛡️ 2026-04-28 TD-006 (split): /live/* 5개 endpoint →
//   src/features/youtube/api/youtube-live.routes.ts (worker/index.ts 별도 mount)
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
