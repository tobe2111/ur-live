# 백엔드 YouTube Live API 구현 가이드 (Node.js)

## 1. 패키지 설치

```bash
npm install express googleapis passport passport-google-oauth20 ws pg redis
npm install --save-dev @types/express @types/node @types/passport
```

## 2. 프로젝트 구조

```
backend/
├── src/
│   ├── controllers/
│   │   └── youtubeController.ts      # YouTube API 로직
│   ├── middleware/
│   │   └── auth.ts                   # 인증 미들웨어
│   ├── models/
│   │   └── Seller.ts                 # 셀러 모델
│   ├── services/
│   │   ├── youtubeService.ts         # YouTube API 서비스
│   │   └── websocketService.ts       # WebSocket 서버
│   ├── routes/
│   │   └── youtube.ts                # YouTube 라우트
│   └── app.ts                        # Express 앱
├── .env
└── package.json
```

## 3. 환경 변수 (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/livecommerce

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# JWT
JWT_SECRET=your-super-secret-key-change-this

# Redis (for session storage)
REDIS_URL=redis://localhost:6379
```

## 4. 핵심 코드 구현

### 4.1 YouTube Service (핵심!)

```typescript
// src/services/youtubeService.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const youtube = google.youtube('v3');

interface YouTubeCredentials {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

interface LiveBroadcastConfig {
  title: string;
  description: string;
  scheduledStartTime: string;
  thumbnailUrl?: string;
}

export class YouTubeService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * OAuth 토큰 저장
   */
  setCredentials(credentials: YouTubeCredentials) {
    this.oauth2Client.setCredentials(credentials);
  }

  /**
   * 토큰 갱신
   */
  async refreshAccessToken(refreshToken: string): Promise<YouTubeCredentials> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    
    return credentials as YouTubeCredentials;
  }

  /**
   * 1. YouTube Live 방송 생성 (핵심 메서드!)
   */
  async createLiveBroadcast(config: LiveBroadcastConfig) {
    try {
      console.log('[YouTube Service] 🎥 라이브 방송 생성 시작');

      // Step 1: LiveBroadcast 생성
      const broadcastResponse = await youtube.liveBroadcasts.insert({
        auth: this.oauth2Client,
        part: ['snippet', 'contentDetails', 'status'],
        requestBody: {
          snippet: {
            title: config.title,
            description: config.description,
            scheduledStartTime: config.scheduledStartTime, // ISO 8601 format
          },
          contentDetails: {
            enableAutoStart: true, // 자동 시작
            enableAutoStop: true,  // 자동 종료
            recordFromStart: true, // 자동 녹화
            enableDvr: true,       // DVR 기능
            enableContentEncryption: false,
            enableEmbed: true,
            monitorStream: {
              enableMonitorStream: true
            }
          },
          status: {
            privacyStatus: 'public', // 'public', 'private', 'unlisted'
            selfDeclaredMadeForKids: false
          }
        }
      });

      const broadcast = broadcastResponse.data;
      console.log('[YouTube Service] ✅ Broadcast 생성:', broadcast.id);

      // Step 2: LiveStream 생성 (RTMP 스트림)
      const streamResponse = await youtube.liveStreams.insert({
        auth: this.oauth2Client,
        part: ['snippet', 'cdn', 'contentDetails', 'status'],
        requestBody: {
          snippet: {
            title: `${config.title} - Stream`
          },
          cdn: {
            frameRate: '30fps',
            ingestionType: 'rtmp',
            resolution: '1080p'
          },
          contentDetails: {
            isReusable: false // 재사용 불가 (보안)
          }
        }
      });

      const stream = streamResponse.data;
      console.log('[YouTube Service] ✅ Stream 생성:', stream.id);

      // Step 3: Broadcast와 Stream 연결 (바인딩)
      await youtube.liveBroadcasts.bind({
        auth: this.oauth2Client,
        part: ['id', 'contentDetails'],
        id: broadcast.id!,
        streamId: stream.id!
      });

      console.log('[YouTube Service] ✅ Broadcast-Stream 바인딩 완료');

      // Step 4: 썸네일 설정 (선택사항)
      if (config.thumbnailUrl) {
        try {
          await this.uploadThumbnail(broadcast.id!, config.thumbnailUrl);
        } catch (error) {
          console.warn('[YouTube Service] 썸네일 업로드 실패 (무시):', error);
        }
      }

      // RTMP 정보 반환
      const rtmpUrl = stream.cdn!.ingestionInfo!.ingestionAddress;
      const streamKey = stream.cdn!.ingestionInfo!.streamName;
      const youtubeUrl = `https://www.youtube.com/watch?v=${broadcast.id}`;

      return {
        success: true,
        data: {
          broadcastId: broadcast.id,
          streamId: stream.id,
          title: broadcast.snippet!.title,
          description: broadcast.snippet!.description,
          scheduledStartTime: broadcast.snippet!.scheduledStartTime,
          youtubeUrl,
          rtmpUrl,
          streamKey,
          status: broadcast.status!.lifeCycleStatus, // 'created', 'ready', 'testing', 'live', 'complete'
        }
      };

    } catch (error: any) {
      console.error('[YouTube Service] ❌ 방송 생성 실패:', error);
      
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * 2. 라이브 방송 시작 (상태 변경)
   */
  async startLiveBroadcast(broadcastId: string) {
    try {
      const response = await youtube.liveBroadcasts.transition({
        auth: this.oauth2Client,
        part: ['id', 'status'],
        broadcastStatus: 'live', // 'testing' → 'live'
        id: broadcastId
      });

      console.log('[YouTube Service] ✅ 방송 시작:', broadcastId);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('[YouTube Service] ❌ 방송 시작 실패:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 3. 라이브 방송 종료
   */
  async stopLiveBroadcast(broadcastId: string) {
    try {
      const response = await youtube.liveBroadcasts.transition({
        auth: this.oauth2Client,
        part: ['id', 'status'],
        broadcastStatus: 'complete', // 'live' → 'complete'
        id: broadcastId
      });

      console.log('[YouTube Service] ✅ 방송 종료:', broadcastId);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('[YouTube Service] ❌ 방송 종료 실패:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 4. 방송 상태 조회
   */
  async getBroadcastStatus(broadcastId: string) {
    try {
      const response = await youtube.liveBroadcasts.list({
        auth: this.oauth2Client,
        part: ['id', 'snippet', 'status', 'contentDetails'],
        id: [broadcastId]
      });

      const broadcast = response.data.items?.[0];
      
      if (!broadcast) {
        return {
          success: false,
          error: 'Broadcast not found'
        };
      }

      return {
        success: true,
        data: {
          id: broadcast.id,
          title: broadcast.snippet?.title,
          status: broadcast.status?.lifeCycleStatus,
          privacyStatus: broadcast.status?.privacyStatus,
          actualStartTime: broadcast.snippet?.actualStartTime,
          actualEndTime: broadcast.snippet?.actualEndTime,
          viewerCount: broadcast.statistics?.concurrentViewers
        }
      };
    } catch (error: any) {
      console.error('[YouTube Service] ❌ 상태 조회 실패:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 5. 채널 정보 조회
   */
  async getChannelInfo() {
    try {
      const response = await youtube.channels.list({
        auth: this.oauth2Client,
        part: ['id', 'snippet', 'contentDetails', 'statistics'],
        mine: true
      });

      const channel = response.data.items?.[0];
      
      if (!channel) {
        return {
          success: false,
          error: 'No YouTube channel found'
        };
      }

      return {
        success: true,
        data: {
          id: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
          subscriberCount: channel.statistics?.subscriberCount,
          videoCount: channel.statistics?.videoCount,
          viewCount: channel.statistics?.viewCount
        }
      };
    } catch (error: any) {
      console.error('[YouTube Service] ❌ 채널 조회 실패:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 6. 썸네일 업로드
   */
  private async uploadThumbnail(broadcastId: string, imageUrl: string) {
    // 이미지 다운로드
    const axios = require('axios');
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // YouTube에 업로드
    await youtube.thumbnails.set({
      auth: this.oauth2Client,
      videoId: broadcastId,
      media: {
        body: buffer
      }
    });

    console.log('[YouTube Service] ✅ 썸네일 업로드 완료');
  }

  /**
   * 7. 라이브 채팅 메시지 가져오기
   */
  async getLiveChatMessages(liveChatId: string) {
    try {
      const response = await youtube.liveChatMessages.list({
        auth: this.oauth2Client,
        part: ['id', 'snippet', 'authorDetails'],
        liveChatId,
        maxResults: 200
      });

      return {
        success: true,
        data: response.data.items
      };
    } catch (error: any) {
      console.error('[YouTube Service] ❌ 채팅 조회 실패:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 8. 라이브 채팅 메시지 전송
   */
  async sendLiveChatMessage(liveChatId: string, message: string) {
    try {
      const response = await youtube.liveChatMessages.insert({
        auth: this.oauth2Client,
        part: ['snippet'],
        requestBody: {
          snippet: {
            liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: message
            }
          }
        }
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      console.error('[YouTube Service] ❌ 채팅 전송 실패:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new YouTubeService();
```

### 4.2 YouTube Controller

```typescript
// src/controllers/youtubeController.ts
import { Request, Response } from 'express';
import youtubeService from '../services/youtubeService';
import { Seller } from '../models/Seller';

/**
 * 1. YouTube 채널 연결 (OAuth Callback)
 */
export async function connectYouTube(req: Request, res: Response) {
  try {
    const { code } = req.query;
    const sellerId = req.user?.id; // Passport 인증 미들웨어에서 추가

    if (!code || !sellerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing code or seller ID'
      });
    }

    // OAuth 토큰 교환
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code as string);
    
    // 토큰 저장 (DB)
    await Seller.update({
      youtube_access_token: tokens.access_token,
      youtube_refresh_token: tokens.refresh_token,
      youtube_token_expiry: new Date(tokens.expiry_date!),
      youtube_connected: true
    }, {
      where: { id: sellerId }
    });

    console.log('[YouTube Connect] ✅ 채널 연결 완료:', sellerId);

    // 채널 정보 조회
    youtubeService.setCredentials(tokens);
    const channelInfo = await youtubeService.getChannelInfo();

    return res.json({
      success: true,
      data: {
        connected: true,
        channel: channelInfo.data
      }
    });

  } catch (error: any) {
    console.error('[YouTube Connect] ❌ 연결 실패:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 2. 라이브 방송 생성 및 시작
 */
export async function startLive(req: Request, res: Response) {
  try {
    const sellerId = req.user?.id;
    const { title, description, products } = req.body;

    // 셀러 정보 조회
    const seller = await Seller.findByPk(sellerId);
    
    if (!seller || !seller.youtube_connected) {
      return res.status(400).json({
        success: false,
        error: 'YouTube channel not connected'
      });
    }

    // YouTube 서비스에 토큰 설정
    youtubeService.setCredentials({
      access_token: seller.youtube_access_token!,
      refresh_token: seller.youtube_refresh_token!,
      expiry_date: seller.youtube_token_expiry!.getTime()
    });

    // 자동 제목 생성 (상품 기반)
    const autoTitle = title || `🔥 오늘의 특가! ${products[0]?.name || ''} 라이브`;
    const autoDescription = description || `
실시간 라이브 쇼핑 방송!
지금 바로 구매하세요: https://live.ur-team.com

판매 상품:
${products.map((p: any) => `- ${p.name}: ${p.discount}% 할인`).join('\n')}
    `.trim();

    // 라이브 방송 생성
    const result = await youtubeService.createLiveBroadcast({
      title: autoTitle,
      description: autoDescription,
      scheduledStartTime: new Date().toISOString(), // 즉시 시작
      thumbnailUrl: products[0]?.image
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // DB에 방송 정보 저장
    const liveStream = await LiveStream.create({
      seller_id: sellerId,
      youtube_broadcast_id: result.data.broadcastId,
      youtube_stream_id: result.data.streamId,
      title: result.data.title,
      youtube_url: result.data.youtubeUrl,
      rtmp_url: result.data.rtmpUrl,
      stream_key: result.data.streamKey,
      status: 'ready',
      products: JSON.stringify(products)
    });

    console.log('[Start Live] ✅ 방송 생성 완료:', liveStream.id);

    return res.json({
      success: true,
      data: {
        stream: {
          id: liveStream.id,
          title: result.data.title,
          youtubeUrl: result.data.youtubeUrl,
          rtmpUrl: result.data.rtmpUrl,
          streamKey: result.data.streamKey,
          status: 'ready',
          products
        },
        prismDeepLink: `prism://connect?rtmp=${encodeURIComponent(result.data.rtmpUrl)}&key=${encodeURIComponent(result.data.streamKey)}`
      }
    });

  } catch (error: any) {
    console.error('[Start Live] ❌ 실패:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 3. 라이브 방송 종료
 */
export async function stopLive(req: Request, res: Response) {
  try {
    const { streamId } = req.params;
    const sellerId = req.user?.id;

    // 방송 정보 조회
    const liveStream = await LiveStream.findOne({
      where: { id: streamId, seller_id: sellerId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    // 셀러 정보 조회 (토큰)
    const seller = await Seller.findByPk(sellerId);
    
    youtubeService.setCredentials({
      access_token: seller!.youtube_access_token!,
      refresh_token: seller!.youtube_refresh_token!,
      expiry_date: seller!.youtube_token_expiry!.getTime()
    });

    // YouTube 방송 종료
    const result = await youtubeService.stopLiveBroadcast(liveStream.youtube_broadcast_id!);

    if (!result.success) {
      return res.status(500).json(result);
    }

    // DB 업데이트
    await liveStream.update({
      status: 'ended',
      ended_at: new Date()
    });

    console.log('[Stop Live] ✅ 방송 종료:', streamId);

    return res.json({
      success: true,
      message: 'Live stream ended'
    });

  } catch (error: any) {
    console.error('[Stop Live] ❌ 실패:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 4. 방송 상태 조회
 */
export async function getStreamStatus(req: Request, res: Response) {
  try {
    const { streamId } = req.params;
    const sellerId = req.user?.id;

    const liveStream = await LiveStream.findOne({
      where: { id: streamId, seller_id: sellerId }
    });

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        error: 'Live stream not found'
      });
    }

    // YouTube 실시간 상태 조회
    const seller = await Seller.findByPk(sellerId);
    youtubeService.setCredentials({
      access_token: seller!.youtube_access_token!,
      refresh_token: seller!.youtube_refresh_token!,
      expiry_date: seller!.youtube_token_expiry!.getTime()
    });

    const result = await youtubeService.getBroadcastStatus(liveStream.youtube_broadcast_id!);

    return res.json({
      success: true,
      data: {
        stream: liveStream,
        youtube: result.data
      }
    });

  } catch (error: any) {
    console.error('[Stream Status] ❌ 실패:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

### 4.3 Express 라우트

```typescript
// src/routes/youtube.ts
import express from 'express';
import * as youtubeController from '../controllers/youtubeController';
import { authenticateSeller } from '../middleware/auth';

const router = express.Router();

// YouTube 채널 연결
router.get('/connect', authenticateSeller, youtubeController.connectYouTube);

// 라이브 시작
router.post('/start-live', authenticateSeller, youtubeController.startLive);

// 라이브 종료
router.post('/stop-live/:streamId', authenticateSeller, youtubeController.stopLive);

// 방송 상태 조회
router.get('/status/:streamId', authenticateSeller, youtubeController.getStreamStatus);

export default router;
```

### 4.4 WebSocket 서버 (실시간 상품 업데이트)

```typescript
// src/services/websocketService.ts
import { Server } from 'ws';
import { Server as HTTPServer } from 'http';

export class WebSocketService {
  private wss: Server;
  private connections: Map<string, Set<WebSocket>> = new Map();

  constructor(server: HTTPServer) {
    this.wss = new Server({ server, path: '/ws/live' });
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const streamId = req.url?.split('/').pop();
      
      if (!streamId) {
        ws.close();
        return;
      }

      // 연결 저장
      if (!this.connections.has(streamId)) {
        this.connections.set(streamId, new Set());
      }
      this.connections.get(streamId)!.add(ws);

      console.log(`[WebSocket] 새 연결: Stream ${streamId}`);

      // 메시지 핸들러
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(streamId, data, ws);
        } catch (error) {
          console.error('[WebSocket] 메시지 파싱 실패:', error);
        }
      });

      // 연결 종료
      ws.on('close', () => {
        this.connections.get(streamId)?.delete(ws);
        console.log(`[WebSocket] 연결 종료: Stream ${streamId}`);
      });
    });
  }

  private handleMessage(streamId: string, data: any, sender: WebSocket) {
    switch (data.type) {
      case 'product_update':
        // 모든 클라이언트에게 상품 업데이트 브로드캐스트
        this.broadcast(streamId, {
          type: 'product_update',
          product: data.product,
          timestamp: Date.now()
        });
        break;

      case 'ping':
        sender.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  // 특정 스트림의 모든 클라이언트에게 메시지 전송
  broadcast(streamId: string, message: any) {
    const clients = this.connections.get(streamId);
    
    if (!clients) return;

    const messageStr = JSON.stringify(message);
    
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}
```

## 5. Express App 설정

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import youtubeRoutes from './routes/youtube';
import { WebSocketService } from './services/websocketService';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://live.ur-team.com'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/seller/youtube', youtubeRoutes);

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ 서버 시작: http://localhost:${PORT}`);
});

// WebSocket 서버
const wsService = new WebSocketService(server);

export default app;
```

## 6. 데이터베이스 모델

```typescript
// src/models/Seller.ts
import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export class Seller extends Model {
  public id!: number;
  public email!: string;
  public youtube_access_token?: string;
  public youtube_refresh_token?: string;
  public youtube_token_expiry?: Date;
  public youtube_connected!: boolean;
}

Seller.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  youtube_access_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  youtube_refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  youtube_token_expiry: {
    type: DataTypes.DATE,
    allowNull: true
  },
  youtube_connected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  sequelize,
  tableName: 'sellers'
});
```

## 7. 실행 방법

```bash
# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## 8. API 엔드포인트 요약

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seller/youtube/connect` | YouTube 채널 연결 |
| POST | `/api/seller/youtube/start-live` | 라이브 시작 |
| POST | `/api/seller/youtube/stop-live/:id` | 라이브 종료 |
| GET | `/api/seller/youtube/status/:id` | 방송 상태 조회 |

## 9. 다음 단계

1. Prism Live Studio 딥링크 통합
2. 토큰 자동 갱신 스케줄러
3. 에러 핸들링 강화
4. 로깅 및 모니터링

