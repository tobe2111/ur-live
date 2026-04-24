/**
 * YouTube OAuth & Channel Management Routes
 * Handles: auth-url, oauth callback, channel list, disconnect
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { YouTubeAPIService } from '../services/youtube-api.service'
import {
  type Bindings,
  type SellerYouTubeAuthRow,
  ensureYouTubeTables,
  getSellerIdFromToken,
} from './youtube-shared'

const app = new Hono<{ Bindings: Bindings }>()

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
 * GET /auth-url
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
 * POST /oauth/callback
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
  } catch {
    return c.json({ success: false, error: 'Invalid request body' }, 400)
  }

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
    console.error('[YouTube OAuth] Error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return c.json({
      success: false,
      error: msg
    }, 500)
  }
})

/**
 * GET /channels
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
      SELECT id, seller_id, google_email, access_token, refresh_token, expires_at, channel_id, channel_title, channel_thumbnail, subscriber_count, default_stream_id, default_rtmp_url, default_rtmp_key, has_persistent_key, is_active, created_at, updated_at FROM seller_youtube_oauth
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
 * DELETE /oauth/:id
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

export default app
