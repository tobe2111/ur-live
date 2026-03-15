/**
 * YouTube Live Chat API Integration
 * Fetch and send chat messages
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import jwt from '@tsndr/cloudflare-worker-jwt';
const app = new Hono();
app.use('/*', cors({
    origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));
/**
 * Helper: Get seller ID from JWT
 */
async function getSellerIdFromToken(authHeader, secret) {
    if (!authHeader?.startsWith('Bearer '))
        return null;
    try {
        const token = authHeader.substring(7);
        const isValid = await jwt.verify(token, secret);
        if (!isValid)
            return null;
        const payload = jwt.decode(token).payload;
        return payload.seller_id || payload.sub || null;
    }
    catch (error) {
        return null;
    }
}
/**
 * Helper: Get valid YouTube access token
 */
async function getAccessToken(db, sellerId) {
    const auth = await db.prepare(`
    SELECT access_token, refresh_token, expires_at 
    FROM seller_youtube_oauth 
    WHERE seller_id = ? AND is_active = 1 
    ORDER BY created_at DESC LIMIT 1
  `).bind(sellerId).first();
    if (!auth)
        return null;
    // Check if expired
    if (auth.expires_at > Date.now() + 5 * 60 * 1000) {
        return auth.access_token;
    }
    // Refresh token (implementation needed)
    // For now, return existing token
    return auth.access_token;
}
/**
 * GET /api/youtube/chat/:streamId
 * Fetch live chat messages
 */
app.get('/chat/:streamId', async (c) => {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
        return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    }
    const streamId = parseInt(c.req.param('streamId'));
    try {
        // Get stream info
        const stream = await c.env.DB.prepare(`
      SELECT youtube_live_chat_id FROM live_streams 
      WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first();
        if (!stream || !stream.youtube_live_chat_id) {
            return c.json({ success: false, error: 'Stream not found or no chat ID' }, 404);
        }
        const liveChatId = stream.youtube_live_chat_id;
        const accessToken = await getAccessToken(c.env.DB, sellerId);
        if (!accessToken) {
            return c.json({ success: false, error: 'YouTube authentication required' }, 401);
        }
        // Fetch chat messages from YouTube API
        const response = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?` +
            `liveChatId=${liveChatId}&` +
            `part=snippet,authorDetails&` +
            `maxResults=100`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`YouTube API error: ${error.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
        // Transform messages
        const messages = data.items.map((item) => ({
            id: item.id,
            author: item.authorDetails.displayName,
            message: item.snippet.displayMessage,
            timestamp: new Date(item.snippet.publishedAt).getTime(),
            avatarUrl: item.authorDetails.profileImageUrl
        }));
        // Cache messages in database for faster retrieval
        for (const msg of messages) {
            await c.env.DB.prepare(`
        INSERT OR IGNORE INTO live_chat_cache (
          stream_id, chat_id, author, message, timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(streamId, msg.id, msg.author, msg.message, msg.timestamp).run();
        }
        return c.json({
            success: true,
            data: {
                messages,
                nextPageToken: data.nextPageToken,
                pollingIntervalMillis: data.pollingIntervalMillis || 5000
            }
        });
    }
    catch (error) {
        console.error('[YouTube Chat] Error:', error);
        return c.json({
            success: false,
            error: error.message || 'Failed to fetch chat messages'
        }, 500);
    }
});
/**
 * POST /api/youtube/chat/:streamId
 * Send chat message
 */
app.post('/chat/:streamId', async (c) => {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
        return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    }
    const streamId = parseInt(c.req.param('streamId'));
    const { message } = await c.req.json();
    if (!message) {
        return c.json({ success: false, error: 'Message is required' }, 400);
    }
    try {
        const stream = await c.env.DB.prepare(`
      SELECT youtube_live_chat_id FROM live_streams 
      WHERE id = ? AND seller_id = ?
    `).bind(streamId, sellerId).first();
        if (!stream || !stream.youtube_live_chat_id) {
            return c.json({ success: false, error: 'Stream not found or no chat ID' }, 404);
        }
        const liveChatId = stream.youtube_live_chat_id;
        const accessToken = await getAccessToken(c.env.DB, sellerId);
        if (!accessToken) {
            return c.json({ success: false, error: 'YouTube authentication required' }, 401);
        }
        // Send message to YouTube Live Chat
        const response = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                snippet: {
                    liveChatId,
                    type: 'textMessageEvent',
                    textMessageDetails: {
                        messageText: message
                    }
                }
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`YouTube API error: ${error.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
        return c.json({
            success: true,
            data: {
                messageId: data.id,
                message: data.snippet.textMessageDetails.messageText
            }
        });
    }
    catch (error) {
        console.error('[YouTube Chat Send] Error:', error);
        return c.json({
            success: false,
            error: error.message || 'Failed to send message'
        }, 500);
    }
});
/**
 * GET /api/youtube/chat/:streamId/cached
 * Get cached chat messages (faster, no API quota)
 */
app.get('/chat/:streamId/cached', async (c) => {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) {
        return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    }
    const streamId = parseInt(c.req.param('streamId'));
    const limit = parseInt(c.req.query('limit') || '50');
    try {
        const messages = await c.env.DB.prepare(`
      SELECT chat_id as id, author, message, timestamp 
      FROM live_chat_cache 
      WHERE stream_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).bind(streamId, limit).all();
        return c.json({
            success: true,
            data: {
                messages: messages.results.reverse() // Oldest first
            }
        });
    }
    catch (error) {
        console.error('[Cached Chat] Error:', error);
        return c.json({
            success: false,
            error: 'Failed to fetch cached messages'
        }, 500);
    }
});
export default app;
