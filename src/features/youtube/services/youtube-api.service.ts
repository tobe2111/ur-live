/**
 * YouTube API Service
 * Handles YouTube Live API integration
 */

import type { 
  YouTubeOAuthTokens, 
  YouTubeChannel, 
  YouTubeBroadcast, 
  YouTubeStream, 
  YouTubeLiveSetup 
} from '../types'

// Raw API response shapes
interface OAuthErrorResponse {
  error?: string
  error_description?: string
}

interface OAuthTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
}

interface YouTubeApiErrorResponse {
  error?: {
    message?: string
  }
}

interface YouTubeThumbnail {
  url: string
}

interface YouTubeChannelItem {
  id: string
  snippet: {
    title: string
    description: string
    customUrl?: string
    thumbnails: {
      high?: YouTubeThumbnail
      default: YouTubeThumbnail
    }
  }
  statistics: {
    subscriberCount?: string
  }
}

interface YouTubeChannelListResponse {
  items: YouTubeChannelItem[]
}

interface YouTubeBroadcastItem {
  id: string
  snippet: {
    title: string
    description: string
    scheduledStartTime: string
    liveChatId?: string
    thumbnails?: {
      high?: YouTubeThumbnail
    }
  }
  status: {
    lifeCycleStatus: string
  }
}

interface YouTubeBroadcastListResponse {
  items: YouTubeBroadcastItem[]
}

interface YouTubeStreamItem {
  id: string
  snippet: {
    title: string
  }
  cdn: {
    ingestionInfo: {
      streamName: string
      ingestionAddress: string
      rtmpsIngestionAddress?: string
    }
    format: string
    ingestionType: string
  }
  status: {
    streamStatus: string
  }
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const YOUTUBE_OAUTH_BASE = 'https://oauth2.googleapis.com'

export class YouTubeAPIService {
  private clientId: string
  private clientSecret: string

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<YouTubeOAuthTokens> {
    const response = await fetch(`${YOUTUBE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    if (!response.ok) {
      const error = await response.json() as OAuthErrorResponse
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
    }

    const data = await response.json() as OAuthTokenResponse
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? '',
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<YouTubeOAuthTokens> {
    const response = await fetch(`${YOUTUBE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) {
      const error = await response.json() as OAuthErrorResponse
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
    }

    const data = await response.json() as OAuthTokenResponse
    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Keep the same refresh token
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope
    }
  }

  /**
   * Get user's YouTube channels
   */
  async getChannels(accessToken: string): Promise<YouTubeChannel[]> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=snippet,contentDetails,statistics&mine=true`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to fetch channels: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json() as YouTubeChannelListResponse
    return data.items.map((item: YouTubeChannelItem) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
      subscriberCount: parseInt(item.statistics.subscriberCount || '0'),
      customUrl: item.snippet.customUrl
    }))
  }

  /**
   * Create a YouTube live broadcast
   */
  async createBroadcast(
    accessToken: string,
    title: string,
    description: string,
    scheduledStartTime: string,
    privacyStatus: 'public' | 'unlisted' | 'private' = 'public'
  ): Promise<YouTubeBroadcast> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/liveBroadcasts?part=snippet,status,contentDetails`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
            scheduledStartTime
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false
          },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
            recordFromStart: true,
            enableDvr: true,
            enableContentEncryption: false,
            enableEmbed: true,
            latencyPreference: 'low'
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to create broadcast: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json() as YouTubeBroadcastItem
    return {
      id: data.id,
      title: data.snippet.title,
      description: data.snippet.description,
      scheduledStartTime: data.snippet.scheduledStartTime,
      thumbnailUrl: data.snippet.thumbnails?.high?.url,
      status: this.mapBroadcastStatus(data.status.lifeCycleStatus),
      liveChatId: data.snippet.liveChatId
    }
  }

  /**
   * Create a YouTube live stream
   */
  async createStream(
    accessToken: string,
    title: string,
    resolution: '1080p' | '720p' | '480p' = '1080p'
  ): Promise<YouTubeStream> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/liveStreams?part=snippet,cdn,status`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          snippet: {
            title
          },
          cdn: {
            frameRate: '30fps',
            ingestionType: 'rtmp',
            resolution
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to create stream: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json() as YouTubeStreamItem
    return {
      id: data.id,
      title: data.snippet.title,
      ingestionInfo: {
        streamName: data.cdn.ingestionInfo.streamName,
        ingestionAddress: data.cdn.ingestionInfo.ingestionAddress,
        rtmpsIngestionAddress: data.cdn.ingestionInfo.rtmpsIngestionAddress
      },
      cdn: {
        format: data.cdn.format,
        ingestionType: data.cdn.ingestionType
      },
      status: this.mapStreamStatus(data.status.streamStatus)
    }
  }

  /**
   * Get an existing YouTube live stream by ID
   */
  async getStream(accessToken: string, streamId: string): Promise<YouTubeStream> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/liveStreams?part=snippet,cdn,status&id=${streamId}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to get stream: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json() as { items: YouTubeStreamItem[] }
    const item = data.items[0]
    if (!item) throw new Error('Stream not found')

    return {
      id: item.id,
      title: item.snippet.title,
      ingestionInfo: {
        streamName: item.cdn.ingestionInfo.streamName,
        ingestionAddress: item.cdn.ingestionInfo.ingestionAddress,
        rtmpsIngestionAddress: item.cdn.ingestionInfo.rtmpsIngestionAddress
      },
      cdn: {
        format: item.cdn.format,
        ingestionType: item.cdn.ingestionType
      },
      status: this.mapStreamStatus(item.status.streamStatus)
    }
  }

  /**
   * Setup live stream reusing a persistent stream (no new RTMP key needed)
   */
  async setupLiveStreamWithPersistentStream(
    accessToken: string,
    title: string,
    description: string,
    persistentStreamId: string,
    scheduledStartTime: string = new Date().toISOString(),
    privacyStatus: 'public' | 'unlisted' | 'private' = 'public'
  ): Promise<YouTubeLiveSetup> {
    // Create broadcast only (no new stream)
    const broadcast = await this.createBroadcast(
      accessToken,
      title,
      description,
      scheduledStartTime,
      privacyStatus
    )

    // Get existing persistent stream info
    const stream = await this.getStream(accessToken, persistentStreamId)

    // Bind broadcast to existing stream
    await this.bindBroadcastToStream(accessToken, broadcast.id, stream.id)

    return {
      broadcast,
      stream,
      rtmpUrl: stream.ingestionInfo.ingestionAddress,
      rtmpKey: stream.ingestionInfo.streamName,
      youtubeUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
      embedUrl: `https://www.youtube.com/embed/${broadcast.id}?autoplay=1`
    }
  }

  /**
   * Bind broadcast to stream
   */
  async bindBroadcastToStream(
    accessToken: string,
    broadcastId: string,
    streamId: string
  ): Promise<void> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/liveBroadcasts/bind?id=${broadcastId}&part=id,contentDetails&streamId=${streamId}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to bind broadcast: ${error.error?.message || 'Unknown error'}`)
    }
  }

  /**
   * Complete YouTube live setup (broadcast + stream + bind)
   */
  async setupLiveStream(
    accessToken: string,
    title: string,
    description: string,
    scheduledStartTime: string = new Date().toISOString(),
    privacyStatus: 'public' | 'unlisted' | 'private' = 'public'
  ): Promise<YouTubeLiveSetup> {
    // Create broadcast
    const broadcast = await this.createBroadcast(
      accessToken,
      title,
      description,
      scheduledStartTime,
      privacyStatus
    )

    // Create stream
    const stream = await this.createStream(
      accessToken,
      `${title} - Stream`
    )

    // Bind them together
    await this.bindBroadcastToStream(accessToken, broadcast.id, stream.id)

    // Construct RTMP URL
    const rtmpUrl = stream.ingestionInfo.ingestionAddress
    const rtmpKey = stream.ingestionInfo.streamName

    return {
      broadcast,
      stream,
      rtmpUrl,
      rtmpKey,
      youtubeUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
      embedUrl: `https://www.youtube.com/embed/${broadcast.id}?autoplay=1`
    }
  }

  /**
   * Transition broadcast to live
   */
  async transitionBroadcastToLive(accessToken: string, broadcastId: string): Promise<void> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/liveBroadcasts/transition?broadcastStatus=live&id=${broadcastId}&part=status`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to go live: ${error.error?.message || 'Unknown error'}`)
    }
  }

  /**
   * End broadcast
   */
  async endBroadcast(accessToken: string, broadcastId: string): Promise<void> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/liveBroadcasts/transition?broadcastStatus=complete&id=${broadcastId}&part=status`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to end broadcast: ${error.error?.message || 'Unknown error'}`)
    }
  }

  /**
   * Get broadcast details
   */
  async getBroadcast(accessToken: string, broadcastId: string): Promise<YouTubeBroadcast> {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/liveBroadcasts?part=snippet,status,contentDetails&id=${broadcastId}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to get broadcast: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json() as YouTubeBroadcastListResponse
    const item = data.items[0]
    
    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      scheduledStartTime: item.snippet.scheduledStartTime,
      thumbnailUrl: item.snippet.thumbnails?.high?.url,
      status: this.mapBroadcastStatus(item.status.lifeCycleStatus),
      liveChatId: item.snippet.liveChatId
    }
  }

  private mapBroadcastStatus(status: string): YouTubeBroadcast['status'] {
    const statusMap: Record<string, YouTubeBroadcast['status']> = {
      'ready': 'created',
      'testing': 'created',
      'live': 'live',
      'complete': 'complete',
      'revoked': 'abandoned'
    }
    return statusMap[status] || 'created'
  }

  private mapStreamStatus(status: string): YouTubeStream['status'] {
    const statusMap: Record<string, YouTubeStream['status']> = {
      'created': 'created',
      'ready': 'ready',
      'active': 'active',
      'inactive': 'inactive',
      'error': 'error'
    }
    return statusMap[status] || 'created'
  }
}
