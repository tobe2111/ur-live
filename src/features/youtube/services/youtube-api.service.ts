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
      backupIngestionAddress?: string
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
      }),
      signal: AbortSignal.timeout(20000)
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
      }),
      signal: AbortSignal.timeout(20000)
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
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20000)
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to fetch channels: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json() as YouTubeChannelListResponse
    if (!data.items) return []
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
            // 🛡️ 2026-05-11 Option D 최적화: enableAutoStart=true (수동 transition 15s 대기 제거).
            //   YouTube 가 stream active 감지 즉시 ready→live 자동 전환 → 라이브까지 25s → 3s.
            //   enableMonitorStream=false 라 testing 단계 없음, autoStart 가 ready→live 직행.
            //   autoStop=false: 브라우저 일시 disconnect (백그라운드/네트워크 blip) → YouTube 가
            //   "송출 끊김" 으로 판단, broadcast 자동 종료 → 셀러 의도와 무관하게 방송 끝남.
            //   현재: 셀러가 명시적으로 [방송 종료] 누를 때만 /live/:id/end → transitionToComplete.
            enableAutoStart: true,
            enableAutoStop: false,
            monitorStream: { enableMonitorStream: false },
            recordFromStart: true,
            enableDvr: true,
            enableContentEncryption: false,
            enableEmbed: true,
            latencyPreference: 'low'
          }
        }),
        signal: AbortSignal.timeout(20000)
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
        }),
        signal: AbortSignal.timeout(20000)
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
        backupIngestionAddress: data.cdn.ingestionInfo.backupIngestionAddress,
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
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20000)
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
        backupIngestionAddress: item.cdn.ingestionInfo.backupIngestionAddress,
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
    // 🛡️ 2026-05-07: persistent stream 에 묶여있는 이전 broadcast 가 'ready'/'live' 상태로
    //   남아있으면 YouTube 가 "스트림 키가 이미 할당됨" 에러를 노출. 새 broadcast 바인딩
    //   전에 stale broadcast 들을 모두 complete 로 전환.
    // 🛡️ 2026-05-13 (perf): endActiveBroadcastsForStream / createBroadcast / getStream 을
    //   가능한 한 병렬화 — 셀러 체감 속도 1.5-3s → 0.5-1.5s 단축.
    //   endActive 는 createBroadcast 와 동시에 시작 (어차피 새 broadcast 는 다른 ID).
    //   bindBroadcastToStream 만 두 결과 모두 필요 → 순차.
    const [, broadcast, stream] = await Promise.all([
      this.endActiveBroadcastsForStream(accessToken, persistentStreamId),
      this.createBroadcast(accessToken, title, description, scheduledStartTime, privacyStatus),
      this.getStream(accessToken, persistentStreamId),
    ])

    // Bind broadcast to existing stream (must run after both)
    await this.bindBroadcastToStream(accessToken, broadcast.id, stream.id)

    return {
      broadcast,
      stream,
      rtmpUrl: stream.ingestionInfo.ingestionAddress,
      backupRtmpUrl: stream.ingestionInfo.backupIngestionAddress,
      rtmpKey: stream.ingestionInfo.streamName,
      youtubeUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
      embedUrl: `https://www.youtube.com/embed/${broadcast.id}?autoplay=1`
    }
  }

  /**
   * End any active/upcoming broadcasts bound to a persistent stream.
   * YouTube allows only one broadcast per stream key at a time.
   */
  async endActiveBroadcastsForStream(
    accessToken: string,
    persistentStreamId: string
  ): Promise<void> {
    // YouTube API 는 단일 status 만 받음 — active + upcoming 두 list 동시 호출 (perf).
    const statusesToCheck: Array<'active' | 'upcoming'> = ['active', 'upcoming']
    const lists = await Promise.all(statusesToCheck.map(async (status) => {
      try {
        const res = await fetch(
          `${YOUTUBE_API_BASE}/liveBroadcasts?part=id,contentDetails,status&broadcastStatus=${status}&maxResults=20&mine=true`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15000)
          }
        )
        if (!res.ok) return [] as Array<{ id: string; lifecycle?: string; boundStreamId?: string }>
        const data = await res.json() as {
          items?: Array<{
            id: string
            contentDetails?: { boundStreamId?: string }
            status?: { lifeCycleStatus?: string }
          }>
        }
        return (data.items ?? []).map(it => ({
          id: it.id,
          lifecycle: it.status?.lifeCycleStatus,
          boundStreamId: it.contentDetails?.boundStreamId,
        }))
      } catch {
        return [] as Array<{ id: string; lifecycle?: string; boundStreamId?: string }>
      }
    }))

    // 🛡️ 2026-05-13: 진행 중 LIVE 방송은 절대 자동 종료 금지 (시청자 일방적 끊김 차단).
    //   호출자(create endpoint) 가 DB 측에서 1차 차단하지만 이중 방어.
    const targets = lists.flat().filter(item =>
      item.boundStreamId === persistentStreamId &&
      item.lifecycle !== 'complete' &&
      item.lifecycle !== 'revoked' &&
      item.lifecycle !== 'live' &&
      item.lifecycle !== 'liveStarting'
    )

    // stale broadcast 정리는 병렬 — 보통 0-1개, 많아도 빠르게 끝남
    await Promise.all(targets.map(item =>
      this.endBroadcast(accessToken, item.id).catch(() => { /* transition 실패 무시 */ })
    ))
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
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20000)
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
    const backupRtmpUrl = stream.ingestionInfo.backupIngestionAddress
    const rtmpKey = stream.ingestionInfo.streamName

    return {
      broadcast,
      stream,
      rtmpUrl,
      backupRtmpUrl,
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
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20000)
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
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20000)
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
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20000)
      }
    )

    if (!response.ok) {
      const error = await response.json() as YouTubeApiErrorResponse
      throw new Error(`Failed to get broadcast: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json() as YouTubeBroadcastListResponse
    const item = data.items?.[0]
    if (!item) throw new Error('Broadcast not found or not accessible')

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
