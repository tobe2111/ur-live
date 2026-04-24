/**
 * YouTube Shared Types, Helpers, and DB Setup
 * Used by all youtube route sub-files.
 */

import { verify as honoVerify } from 'hono/jwt'
import { YouTubeAPIService } from '../services/youtube-api.service'
import type { SellerYouTubeAuth } from '../types'

export type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  YOUTUBE_CLIENT_ID?: string
  YOUTUBE_CLIENT_SECRET?: string
  YOUTUBE_REDIRECT_URI?: string
}

export interface JwtPayload {
  seller_id?: number | string
  sub?: number | string
  type?: string
  userType?: string
}

export interface SellerYouTubeAuthRow {
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

// 테이블 자동 생성 (마이그레이션 미적용 시 fallback)
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

/**
 * Helper: Extract seller ID from JWT
 * Uses hono/jwt verify to be compatible with seller login tokens
 */
export async function getSellerIdFromToken(authHeader: string | undefined, secret: string): Promise<number | null> {
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
