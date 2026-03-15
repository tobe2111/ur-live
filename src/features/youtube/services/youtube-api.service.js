/**
 * YouTube API Service
 * Handles YouTube Live API integration
 */
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_OAUTH_BASE = 'https://oauth2.googleapis.com';
export class YouTubeAPIService {
    clientId;
    clientSecret;
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }
    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code, redirectUri) {
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
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
        }
        const data = await response.json();
        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + data.expires_in * 1000,
            scope: data.scope
        };
    }
    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken) {
        const response = await fetch(`${YOUTUBE_OAUTH_BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token'
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
        }
        const data = await response.json();
        return {
            access_token: data.access_token,
            refresh_token: refreshToken, // Keep the same refresh token
            expires_at: Date.now() + data.expires_in * 1000,
            scope: data.scope
        };
    }
    /**
     * Get user's YouTube channels
     */
    async getChannels(accessToken) {
        const response = await fetch(`${YOUTUBE_API_BASE}/channels?part=snippet,contentDetails,statistics&mine=true`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch channels: ${error.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
        return data.items.map((item) => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
            subscriberCount: parseInt(item.statistics.subscriberCount || '0'),
            customUrl: item.snippet.customUrl
        }));
    }
    /**
     * Create a YouTube live broadcast
     */
    async createBroadcast(accessToken, title, description, scheduledStartTime, privacyStatus = 'public') {
        const response = await fetch(`${YOUTUBE_API_BASE}/liveBroadcasts?part=snippet,status,contentDetails`, {
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
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to create broadcast: ${error.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
        return {
            id: data.id,
            title: data.snippet.title,
            description: data.snippet.description,
            scheduledStartTime: data.snippet.scheduledStartTime,
            thumbnailUrl: data.snippet.thumbnails?.high?.url,
            status: this.mapBroadcastStatus(data.status.lifeCycleStatus),
            liveChatId: data.snippet.liveChatId
        };
    }
    /**
     * Create a YouTube live stream
     */
    async createStream(accessToken, title, resolution = '1080p') {
        const response = await fetch(`${YOUTUBE_API_BASE}/liveStreams?part=snippet,cdn,status`, {
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
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to create stream: ${error.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
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
        };
    }
    /**
     * Bind broadcast to stream
     */
    async bindBroadcastToStream(accessToken, broadcastId, streamId) {
        const response = await fetch(`${YOUTUBE_API_BASE}/liveBroadcasts/bind?id=${broadcastId}&part=id,contentDetails&streamId=${streamId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to bind broadcast: ${error.error?.message || 'Unknown error'}`);
        }
    }
    /**
     * Complete YouTube live setup (broadcast + stream + bind)
     */
    async setupLiveStream(accessToken, title, description, scheduledStartTime = new Date().toISOString()) {
        // Create broadcast
        const broadcast = await this.createBroadcast(accessToken, title, description, scheduledStartTime);
        // Create stream
        const stream = await this.createStream(accessToken, `${title} - Stream`);
        // Bind them together
        await this.bindBroadcastToStream(accessToken, broadcast.id, stream.id);
        // Construct RTMP URL
        const rtmpUrl = stream.ingestionInfo.ingestionAddress;
        const rtmpKey = stream.ingestionInfo.streamName;
        return {
            broadcast,
            stream,
            rtmpUrl,
            rtmpKey,
            youtubeUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
            embedUrl: `https://www.youtube.com/embed/${broadcast.id}?autoplay=1`
        };
    }
    /**
     * Transition broadcast to live
     */
    async transitionBroadcastToLive(accessToken, broadcastId) {
        const response = await fetch(`${YOUTUBE_API_BASE}/liveBroadcasts/transition?broadcastStatus=live&id=${broadcastId}&part=status`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to go live: ${error.error?.message || 'Unknown error'}`);
        }
    }
    /**
     * End broadcast
     */
    async endBroadcast(accessToken, broadcastId) {
        const response = await fetch(`${YOUTUBE_API_BASE}/liveBroadcasts/transition?broadcastStatus=complete&id=${broadcastId}&part=status`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to end broadcast: ${error.error?.message || 'Unknown error'}`);
        }
    }
    /**
     * Get broadcast details
     */
    async getBroadcast(accessToken, broadcastId) {
        const response = await fetch(`${YOUTUBE_API_BASE}/liveBroadcasts?part=snippet,status,contentDetails&id=${broadcastId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get broadcast: ${error.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
        const item = data.items[0];
        return {
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            scheduledStartTime: item.snippet.scheduledStartTime,
            thumbnailUrl: item.snippet.thumbnails?.high?.url,
            status: this.mapBroadcastStatus(item.status.lifeCycleStatus),
            liveChatId: item.snippet.liveChatId
        };
    }
    mapBroadcastStatus(status) {
        const statusMap = {
            'ready': 'created',
            'testing': 'created',
            'live': 'live',
            'complete': 'complete',
            'revoked': 'abandoned'
        };
        return statusMap[status] || 'created';
    }
    mapStreamStatus(status) {
        const statusMap = {
            'created': 'created',
            'ready': 'ready',
            'active': 'active',
            'inactive': 'inactive',
            'error': 'error'
        };
        return statusMap[status] || 'created';
    }
}
