import { DurableObject } from 'cloudflare:workers';
import type { WSMessage, ProductChangeMessage, ViewerCountMessage, StreamStatusMessage } from './types';

// 🛡️ 2026-04-22: DO 당 최대 동시 WebSocket 수
const MAX_SESSIONS_PER_DO = 10_000;

export class LiveStreamDurableObject extends DurableObject {
  private sessions: Set<WebSocket>;
  private viewerCount: number;
  private currentProduct: any;
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.sessions = new Set();
    this.viewerCount = 0;
    this.currentProduct = null;

    // 🛡️ 2026-04-22: DO 재시작 시 currentProduct 복원 (DO storage persistence)
    // 이전: DO 가 재시작/migrate 되면 현재 상품 정보 손실 → 늦게 join 한 viewer 가 빈 화면.
    // 수정: state.storage 에 저장 → 재시작해도 마지막 상품 유지.
    state.blockConcurrencyWhile(async () => {
      try {
        const stored = await state.storage.get<any>('currentProduct');
        if (stored) this.currentProduct = stored;
      } catch {}
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket 업그레이드 요청 처리
    if (request.headers.get('Upgrade') === 'websocket') {
      // 🛡️ 세션 한도 초과 시 503 — DO 메모리 보호
      if (this.sessions.size >= MAX_SESSIONS_PER_DO) {
        return new Response('Stream at capacity', { status: 503 });
      }

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
      // 🛡️ viewerCount 하한선 보장 (음수 방지)
      this.viewerCount = Math.max(0, this.viewerCount - 1);
      this.broadcastViewerCount();
    });

    webSocket.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      this.sessions.delete(webSocket);
      this.viewerCount = Math.max(0, this.viewerCount - 1);
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

      // 상품 변경 메시지인 경우 현재 상품 저장 + DO storage persist
      if (message.type === 'product_change') {
        this.currentProduct = message.data;
        // 🛡️ 2026-04-22: storage 영속화 (DO 재시작 후 복원용)
        try { await this.state.storage.put('currentProduct', message.data); } catch {}
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
