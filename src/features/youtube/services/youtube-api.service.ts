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
            // 🛡️ 2026-05-13: enableAutoStart=true → false 로 변경.
            //   사고: stream 79/80/81 모두 streamStatus='active' + lifeCycleStatus='ready' 정체.
            //   원인 분석: YouTube auto-start 가 stream active 감지를 30-60s 늦게 처리하거나,
            //     enableAutoStart=true 와 우리 수동 transition 시도가 race → invalidTransition 응답.
            //   해결: enableAutoStart 끄고 우리가 명시적으로 streamStatus active 확인 후 transition 호출.
            //     YouTube docs 권장 패턴 (https://developers.google.com/youtube/v3/live/life-of-a-broadcast).
            //   autoStop=false: 브라우저 일시 disconnect (백그라운드/네트워크 blip) → YouTube 가
            //   "송출 끊김" 으로 판단, broadcast 자동 종료 → 셀러 의도와 무관하게 방송 끝남.
            //   현재: 셀러가 명시적으로 [방송 종료] 누를 때만 /live/:id/end → transitionToComplete.
            enableAutoStart: false,
            enableAutoStop: false,
            monitorStream: { enableMonitorStream: false },
            recordFromStart: true,
            enableDvr: true,
            enableContentEncryption: false,
            enableEmbed: true,
            // 🛡️ 2026-05-14 v3 (사용자 결정): 'normal' (15s) → 'low' (5-10s) 되돌림.
            //   normal 은 화질 +α 이지만 시청자 지연 15초 → 라이브 커머스 답답.
            //   진짜 화질 개선은 30fps (이미 적용) 가 더 영향 큼.
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
   * 🛡️ 2026-05-13: ingestionType 'webrtc' 옵션 추가 — YouTube WHIP direct ingest 활용.
   *   webrtc 선택 시 cdn.ingestionInfo.ingestionAddress 가 WHIP URL 형태로 반환 (rtmp 아닌 https).
   */
  async createStream(
    accessToken: string,
    title: string,
    resolution: '1080p' | '720p' | '480p' | 'variable' = '1080p',
    frameRate: '30fps' | '60fps' | 'variable' = '30fps',
    ingestionType: 'rtmp' | 'webrtc' = 'rtmp'
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
            frameRate,
            ingestionType,
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
   *
   * 🛡️ 2026-05-13 v3 (perf): cached RTMP info 받으면 getStream() 호출 생략.
   *   YouTube stream 의 RTMP URL/key 는 영구적 (한번 생성 후 안 바뀜) — 매번 재조회는 낭비.
   *   bind 실패 시에만 stream 정보 재확인 fallback.
   *   → 1.5s → ~0.8s (네트워크 왕복 한 번 제거)
   */
  async setupLiveStreamWithPersistentStream(
    accessToken: string,
    title: string,
    description: string,
    persistentStreamId: string,
    scheduledStartTime: string = new Date().toISOString(),
    privacyStatus: 'public' | 'unlisted' | 'private' = 'public',
    cachedRtmp?: { rtmpUrl: string; rtmpKey: string; backupRtmpUrl?: string }
  ): Promise<YouTubeLiveSetup> {
    // endActive + createBroadcast 만 병렬 — getStream 은 캐시 hit 시 skip
    const [, broadcast, fetchedStream] = await Promise.all([
      this.endActiveBroadcastsForStream(accessToken, persistentStreamId),
      this.createBroadcast(accessToken, title, description, scheduledStartTime, privacyStatus),
      cachedRtmp
        ? Promise.resolve(null as unknown as YouTubeStream | null)
        : this.getStream(accessToken, persistentStreamId),
    ])

    // RTMP info 결정 — 캐시 hit 면 그대로, miss 면 fetched stream 사용
    let rtmpUrl: string
    let rtmpKey: string
    let backupRtmpUrl: string | undefined
    let streamForReturn: YouTubeStream

    if (cachedRtmp && !fetchedStream) {
      rtmpUrl = cachedRtmp.rtmpUrl
      rtmpKey = cachedRtmp.rtmpKey
      backupRtmpUrl = cachedRtmp.backupRtmpUrl
      // 최소한의 stream 객체 — 외부에서 ingestionInfo 만 참조
      streamForReturn = {
        id: persistentStreamId,
        ingestionInfo: {
          ingestionAddress: cachedRtmp.rtmpUrl,
          backupIngestionAddress: cachedRtmp.backupRtmpUrl || cachedRtmp.rtmpUrl,
          streamName: cachedRtmp.rtmpKey,
        },
      } as YouTubeStream
    } else {
      const stream = fetchedStream!
      rtmpUrl = stream.ingestionInfo.ingestionAddress
      rtmpKey = stream.ingestionInfo.streamName
      backupRtmpUrl = stream.ingestionInfo.backupIngestionAddress
      streamForReturn = stream
    }

    // Bind broadcast to existing stream (must run after both)
    try {
      await this.bindBroadcastToStream(accessToken, broadcast.id, persistentStreamId)
    } catch (bindErr) {
      // 🛡️ 캐시 hit 인데 bind 실패 → stream 이 revoke 됐을 가능성. fresh fetch 후 1회 재시도.
      if (cachedRtmp) {
        const freshStream = await this.getStream(accessToken, persistentStreamId)
        await this.bindBroadcastToStream(accessToken, broadcast.id, freshStream.id)
        rtmpUrl = freshStream.ingestionInfo.ingestionAddress
        rtmpKey = freshStream.ingestionInfo.streamName
        backupRtmpUrl = freshStream.ingestionInfo.backupIngestionAddress
        streamForReturn = freshStream
      } else {
        throw bindErr
      }
    }

    return {
      broadcast,
      stream: streamForReturn,
      rtmpUrl,
      backupRtmpUrl,
      rtmpKey,
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
    privacyStatus: 'public' | 'unlisted' | 'private' = 'public',
    frameRate: '30fps' | '60fps' | 'variable' = '30fps',
    ingestionType: 'rtmp' | 'webrtc' = 'rtmp'
  ): Promise<YouTubeLiveSetup> {
    // Create broadcast
    const broadcast = await this.createBroadcast(
      accessToken,
      title,
      description,
      scheduledStartTime,
      privacyStatus
    )

    // 🛡️ 2026-05-14: WebRTC ingestion 은 cdn.resolution / cdn.frameRate 모두 'variable' 만 허용.
    //   '1080p' / '30fps' 등 고정값 보내면 "Invalid value for resolution|frame rate" 400.
    //   WebRTC 는 브라우저가 적응형 송출하므로 YouTube 가 자동 결정.
    const resolution: '1080p' | '720p' | '480p' | 'variable' =
      ingestionType === 'webrtc' ? 'variable' : '1080p'
    const effectiveFrameRate: '30fps' | '60fps' | 'variable' =
      ingestionType === 'webrtc' ? 'variable' : frameRate
    const stream = await this.createStream(
      accessToken,
      `${title} - Stream`,
      resolution,
      effectiveFrameRate,
      ingestionType
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
