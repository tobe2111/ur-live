# YouTube Live Integration - Prism-Style Zero-Setup Guide

## 📋 Overview

This implementation provides a **zero-setup, Prism Live Studio-like experience** for sellers to start YouTube live broadcasts with a single click. The system automatically handles OAuth authentication, creates YouTube broadcasts, generates RTMP credentials, and manages the entire streaming workflow.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Seller Dashboard (React)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SellerLiveBroadcastPage.tsx                              │  │
│  │  - YouTube OAuth (one-time setup)                         │  │
│  │  - Product selection                                       │  │
│  │  - One-click "Start Live" button                          │  │
│  │  - Auto-generated RTMP credentials                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ API Calls
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│              Backend API (Cloudflare Workers)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  YouTube API Routes (youtube.routes.ts)                   │  │
│  │  - POST /api/youtube/oauth/callback                       │  │
│  │  - GET  /api/youtube/channels                             │  │
│  │  - POST /api/youtube/live/create                          │  │
│  │  - POST /api/youtube/live/:id/start                       │  │
│  │  - POST /api/youtube/live/:id/end                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  YouTube API Service (youtube-api.service.ts)             │  │
│  │  - OAuth token exchange & refresh                         │  │
│  │  - Channel list fetching                                  │  │
│  │  - Broadcast creation (liveBroadcasts.insert)            │  │
│  │  - Stream creation (liveStreams.insert)                  │  │
│  │  - Broadcast <-> Stream binding                           │  │
│  │  - Live transition & ending                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ Store/Retrieve Tokens
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│              Database (Cloudflare D1 - SQLite)                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  seller_youtube_oauth                                      │  │
│  │  - seller_id, google_email                                │  │
│  │  - access_token, refresh_token, expires_at                │  │
│  │  - channel_id, channel_title                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  live_streams                                              │  │
│  │  - seller_id, title, description                          │  │
│  │  - youtube_video_id, youtube_broadcast_id                 │  │
│  │  - rtmp_url, rtmp_key                                     │  │
│  │  - status (scheduled, live, ended)                        │  │
│  │  - started_at, ended_at                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ API Calls
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                  YouTube Live API (Google)                       │
│  - OAuth 2.0 authentication                                      │
│  - liveBroadcasts.insert (create broadcast)                      │
│  - liveStreams.insert (generate RTMP endpoint)                   │
│  - liveBroadcasts.bind (link broadcast to stream)                │
│  - liveBroadcasts.transition (live/complete)                     │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Setup Instructions

### 1. Google Cloud Console Configuration

1. **Create Project**
   - Go to: https://console.cloud.google.com/
   - Create a new project: "UR-Live YouTube Integration"

2. **Enable APIs**
   ```
   - YouTube Data API v3
   - YouTube Live Streaming API
   ```

3. **Create OAuth 2.0 Credentials**
   - Go to: APIs & Services > Credentials
   - Click: "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Authorized redirect URIs:
     ```
     https://live.ur-team.com/seller/youtube/callback
     http://localhost:5173/seller/youtube/callback
     ```
   - Save the **Client ID** and **Client Secret**

4. **Configure OAuth Consent Screen**
   - User type: External
   - App name: "UR-Live"
   - Support email: your-email@ur-team.com
   - Scopes:
     ```
     https://www.googleapis.com/auth/youtube
     https://www.googleapis.com/auth/youtube.force-ssl
     https://www.googleapis.com/auth/youtube.readonly
     ```

### 2. Environment Variables

Add to Cloudflare Pages settings:

```bash
# YouTube API Configuration
YOUTUBE_CLIENT_ID=your_client_id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=https://live.ur-team.com/seller/youtube/callback
```

Set using Wrangler:
```bash
npx wrangler pages secret put YOUTUBE_CLIENT_ID
npx wrangler pages secret put YOUTUBE_CLIENT_SECRET
npx wrangler pages secret put YOUTUBE_REDIRECT_URI
```

### 3. Database Migration

Run the migration to create necessary tables:

```bash
cd /home/user/webapp
npx wrangler d1 migrations apply toss-live-commerce-db --remote
```

Or manually:
```bash
npx wrangler d1 execute toss-live-commerce-db --remote --file=migrations/0105_add_seller_youtube_oauth.sql
```

### 4. Deploy

```bash
npm run build
npm run deploy
```

## 📱 User Flow (Prism-Style)

### First-Time Setup (One-Time)

1. **Seller Dashboard** → Click "YouTube 라이브" button
2. **YouTube Connection** → Click "YouTube 계정 연동하기"
3. **Google OAuth** → Login with Google account
4. **Grant Permissions** → Allow YouTube access
5. **Redirect Back** → Automatically returns to dashboard
6. **Channel Connected** → Shows YouTube channel info

### Creating a Live Broadcast (Every Time)

1. **Click "라이브 방송 만들기"**
2. **Fill Form:**
   - Title: "신상품 특가 라이브!"
   - Description: Optional
   - Select Products: Choose 1+ products
3. **Click "방송 생성하기"**
4. **Broadcast Ready!** Modal shows:
   - YouTube URL
   - RTMP URL + Stream Key
   - Copy button for easy sharing
5. **Two Options:**
   - **Prism Live Studio:** Copy RTMP info, paste in Prism
   - **OBS Studio:** Copy RTMP URL/Key, configure in OBS
6. **Start Streaming** in Prism/OBS
7. **Click "방송 시작"** button in dashboard
8. **Go Live!** YouTube broadcast transitions to live
9. **End Broadcast** when done

## 🎯 Key Features

### Zero-Setup Philosophy

- ✅ **One-Click OAuth:** Single button to connect YouTube
- ✅ **Auto-Channel Detection:** Automatically fetches and selects default channel
- ✅ **RTMP Auto-Generation:** YouTube API generates RTMP credentials instantly
- ✅ **Pre-Filled Metadata:** Uses product info for title/description
- ✅ **Copy-Paste Ready:** RTMP info displayed with copy button
- ✅ **Mobile-First UI:** Responsive design for all devices

### Security & Privacy

- 🔒 **Secure Token Storage:** Refresh tokens stored in D1 database
- 🔒 **Automatic Token Refresh:** Expired tokens refreshed transparently
- 🔒 **Stream Key Hidden:** RTMP key only shown to authenticated seller
- 🔒 **JWT-Protected APIs:** All endpoints require seller authentication

### Developer Experience

- 🛠️ **TypeScript Types:** Full type safety across frontend/backend
- 🛠️ **Error Handling:** Comprehensive error messages and logging
- 🛠️ **Modular Design:** Clean separation of concerns
- 🛠️ **Testable Code:** Easy to unit test and mock

## 🔧 API Endpoints

### OAuth & Channels

```typescript
// Get OAuth authorization URL
GET /api/youtube/auth-url
Response: { success: true, data: { authUrl, redirectUri } }

// Handle OAuth callback
POST /api/youtube/oauth/callback
Body: { code: string }
Response: { success: true, data: { channel, allChannels } }

// List connected channels
GET /api/youtube/channels
Headers: { Authorization: "Bearer {seller_token}" }
Response: { success: true, data: YouTubeChannel[] }

// Disconnect channel
DELETE /api/youtube/oauth/:id
Headers: { Authorization: "Bearer {seller_token}" }
Response: { success: true, message: "Disconnected" }
```

### Live Streaming

```typescript
// Create new broadcast
POST /api/youtube/live/create
Headers: { Authorization: "Bearer {seller_token}" }
Body: {
  title: string
  description?: string
  product_ids: number[]
  scheduled_start_time?: string
}
Response: {
  success: true
  data: {
    stream_id: number
    youtube_url: string
    embed_url: string
    rtmp_url: string
    rtmp_key: string
    broadcast: YouTubeBroadcast
    stream: YouTubeStream
  }
}

// Start broadcast (transition to live)
POST /api/youtube/live/:id/start
Headers: { Authorization: "Bearer {seller_token}" }
Response: { success: true, message: "Stream is now live" }

// End broadcast
POST /api/youtube/live/:id/end
Headers: { Authorization: "Bearer {seller_token}" }
Response: { success: true, message: "Stream ended successfully" }
```

## 🐛 Common Issues & Solutions

### Issue: "YouTube authentication required"

**Cause:** No valid OAuth token found or token expired
**Solution:**
1. Go to `/seller/live-broadcast`
2. Click "YouTube 계정 연동하기"
3. Complete OAuth flow

### Issue: "Failed to create broadcast"

**Possible Causes:**
- YouTube API quota exceeded (10,000 units/day default)
- Invalid OAuth scopes
- Channel not eligible for live streaming

**Solutions:**
- Check YouTube API quota in Google Cloud Console
- Request quota increase if needed
- Ensure scopes include `youtube.force-ssl`
- Verify channel has live streaming enabled

### Issue: RTMP connection fails

**Possible Causes:**
- RTMP URL/Key copied incorrectly
- Firewall blocking port 1935
- Stream not ready yet

**Solutions:**
- Use the "Copy RTMP" button (don't manually copy)
- Check firewall settings for port 1935
- Wait 10-30 seconds after creating broadcast
- Test with RTMPS (port 443) instead

### Issue: "Token refresh failed"

**Cause:** Refresh token revoked or expired
**Solution:**
1. Disconnect YouTube account
2. Reconnect with fresh OAuth flow

## 📊 Database Schema

### seller_youtube_oauth

```sql
CREATE TABLE seller_youtube_oauth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  channel_id TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  channel_thumbnail TEXT,
  subscriber_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);
```

### live_streams (extended)

```sql
-- Added fields
ALTER TABLE live_streams ADD COLUMN youtube_broadcast_id TEXT;
ALTER TABLE live_streams ADD COLUMN youtube_stream_key TEXT;
ALTER TABLE live_streams ADD COLUMN youtube_live_chat_id TEXT;
ALTER TABLE live_streams ADD COLUMN rtmp_url TEXT;
ALTER TABLE live_streams ADD COLUMN rtmp_key TEXT;
ALTER TABLE live_streams ADD COLUMN youtube_embed_url TEXT;
```

## 🎨 UI Components

### SellerLiveBroadcastPage

**Key Sections:**
1. **YouTube Connection Status** - Shows connected channels or prompt to connect
2. **Create Live Form** - Title, description, product selection
3. **Broadcast Ready Modal** - RTMP credentials display
4. **Active Streams** - Currently live/scheduled broadcasts
5. **Recent Streams** - Past broadcasts with replay links

### YouTubeCallbackPage

**Purpose:** Handle OAuth redirect and show status
**States:**
- `loading` - Processing OAuth code
- `success` - Connected successfully, auto-redirect
- `error` - Show error message, manual redirect

## 🔐 Security Considerations

### Token Management

- **Access Tokens:** Expire after 1 hour, automatically refreshed
- **Refresh Tokens:** Valid indefinitely (until revoked), stored securely in D1
- **Stream Keys:** Never logged, only shown to authorized seller
- **JWT Validation:** All API calls verify seller authentication

### Rate Limiting

YouTube API quotas:
- **Default:** 10,000 units/day
- **Create Broadcast:** 1,600 units
- **Create Stream:** 1,600 units
- **List Channels:** 1 unit

**Recommendation:** Request quota increase to 100,000+ units/day for production

## 🚀 Future Enhancements

### Phase 2 Features

- [ ] **Real-time Product Overlay** - WebSocket-based product switching during live
- [ ] **Live Chat Integration** - Show YouTube live chat in dashboard
- [ ] **Viewer Analytics** - Real-time viewer count, engagement metrics
- [ ] **Multi-Camera Support** - Switch between multiple RTMP sources
- [ ] **Scheduled Broadcasts** - Auto-start at specific time
- [ ] **Auto-Thumbnails** - Generate thumbnails from product images
- [ ] **Prism Deep Link** - Direct integration with Prism Live Studio app
- [ ] **Mobile Streaming** - Native mobile app for streaming

### Phase 3 Features

- [ ] **AI-Powered Highlights** - Auto-generate highlight clips
- [ ] **Instant Replay** - Replay key moments during live
- [ ] **Interactive Polls** - Audience voting on next product
- [ ] **Influencer Collaboration** - Multi-host streaming
- [ ] **AR Product Preview** - 3D product overlays
- [ ] **Auto-Translation** - Real-time caption translation

## 📞 Support

For issues or questions:
- GitHub Issues: https://github.com/tobe2111/ur-live/issues
- Email: support@ur-team.com
- Slack: #youtube-live-support

## 📄 License

Proprietary - UR-Live Platform
© 2026 UR Team. All rights reserved.
