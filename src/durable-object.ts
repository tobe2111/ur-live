import { DurableObject } from 'cloudflare:workers';
import type { WSMessage, ProductChangeMessage, ViewerCountMessage, StreamStatusMessage } from './types';

export class LiveStreamDurableObject extends DurableObject {
  private sessions: Set<WebSocket>;
  private viewerCount: number;
  private currentProduct: any;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.sessions = new Set();
    this.viewerCount = 0;
    this.currentProduct = null;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket 업그레이드 요청 처리
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.handleSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // HTTP API 요청 처리
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this.handleBroadcast(request);
    }

    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        viewerCount: this.viewerCount,
        currentProduct: this.currentProduct,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  handleSession(webSocket: WebSocket) {
    webSocket.accept();
    this.sessions.add(webSocket);
    this.viewerCount++;

    // 시청자 수 브로드캐스트
    this.broadcastViewerCount();

    // 현재 상품 정보 전송 (있는 경우)
    if (this.currentProduct) {
      webSocket.send(JSON.stringify({
        type: 'product_change',
        data: this.currentProduct,
        timestamp: Date.now(),
      }));
    }

    webSocket.addEventListener('message', (msg) => {
      try {
        const message = JSON.parse(msg.data as string);
        this.handleMessage(webSocket, message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });

    webSocket.addEventListener('close', () => {
      this.sessions.delete(webSocket);
      this.viewerCount--;
      this.broadcastViewerCount();
    });

    webSocket.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      this.sessions.delete(webSocket);
      this.viewerCount--;
    });
  }

  handleMessage(webSocket: WebSocket, message: any) {
    // 클라이언트로부터의 메시지 처리
    // 필요한 경우 추가 로직 구현
  }

  async handleBroadcast(request: Request): Promise<Response> {
    try {
      // 🛡️ 2026-04-22: DO 레벨 권한 확인 (worker 의 X-Internal-Auth 헤더 신뢰)
      // Worker 가 requireSeller/requireAdmin 통과 시에만 이 헤더를 세팅.
      // DO 는 Worker 신뢰 (같은 account binding).
      const internalAuth = request.headers.get('X-Internal-Auth');
      const authUserType = request.headers.get('X-Auth-User-Type');
      if (!internalAuth || (authUserType !== 'seller' && authUserType !== 'admin')) {
        return new Response(JSON.stringify({ success: false, error: 'Broadcast requires seller/admin auth' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const message: WSMessage = await request.json();

      // 상품 변경 메시지인 경우 현재 상품 저장
      if (message.type === 'product_change') {
        this.currentProduct = message.data;
      }

      // 모든 연결된 클라이언트에게 브로드캐스트
      this.broadcast(message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: (err as Error).message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  broadcast(message: WSMessage) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((session) => {
      try {
        session.send(messageStr);
      } catch (err) {
        console.error('Failed to send message:', err);
        this.sessions.delete(session);
      }
    });
  }

  broadcastViewerCount() {
    const message: ViewerCountMessage = {
      type: 'viewer_count',
      data: { count: this.viewerCount },
      timestamp: Date.now(),
    };
    this.broadcast(message);
  }
}
