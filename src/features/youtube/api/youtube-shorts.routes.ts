/**
 * YouTube Shorts Sync Routes
 * Handles: sync shorts from YouTube channel to local DB
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { YouTubeAPIService } from '../services/youtube-api.service'
import {
  type Bindings,
  getSellerIdFromToken,
  getValidAccessToken,
} from './youtube-shared'
import { logError } from '@/worker/utils/logger'

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
 * GET /shorts/sync
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
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) }
    )

    if (!searchRes.ok) throw new Error('YouTube API 오류')

    interface YTSearchResult { id?: { videoId?: string }; snippet?: { title?: string; thumbnails?: { high?: { url?: string }; default?: { url?: string } } } }
    interface YTSearchResponse { items?: YTSearchResult[] }
    const data = await searchRes.json() as YTSearchResponse
    const items: YTSearchResult[] = data.items || []
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
    logError('youtube.shorts.sync_failed', { error: (err as Error)?.message })
    return c.json({ success: false, error: '쇼츠 동기화 실패' }, 500)
  }
})

export default app
