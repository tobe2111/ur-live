import { DurableObject } from 'cloudflare:workers';
import type { WSMessage, ProductChangeMessage, ViewerCountMessage, StreamStatusMessage, Product, ProductOption } from './types';
import { moderateChat } from './shared/utils/chat-moderation';


// 🛡️ 2026-04-22: DO 당 최대 동시 WebSocket 수
const MAX_SESSIONS_PER_DO = 10_000;

// 🛡️ 2026-04-23 배치 164: chat rate limit 상수
const CHAT_MAX_LEN = 300;
const CHAT_RATE_LIMIT = 5;       // 5 msgs
const CHAT_RATE_WINDOW_MS = 3000; // per 3 seconds

interface ChatSession {
  ws: WebSocket;
  userId: string | null;
  recentTimes: number[]; // rate limit sliding window
}

export class LiveStreamDurableObject extends DurableObject {
  private sessions: Set<WebSocket>;
  private chatSessions: Map<WebSocket, ChatSession>;
  private viewerCount: number;
  private currentProduct: { product: Product; options: ProductOption[] } | null;
  private pinnedMessage: string | null;
  private blockedKeywords: string[];
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: Cloudflare.Env) {
    super(state, env);
    this.state = state;
    this.sessions = new Set();
    this.chatSessions = new Map();
    this.viewerCount = 0;
    this.currentProduct = null;
    this.pinnedMessage = null;
    this.blockedKeywords = [];

    state.blockConcurrencyWhile(async () => {
      try {
        const stored = await state.storage.get<any>('currentProduct');
        if (stored) this.currentProduct = stored;
        const pinned = await state.storage.get<string>('pinnedMessage');
        if (pinned) this.pinnedMessage = pinned;
        const blocked = await state.storage.get<string[]>('blockedKeywords');
        if (blocked) this.blockedKeywords = blocked;
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

      // 🛡️ Worker 가 검증한 user_id 전달받아 DO 세션에 바인딩
      const authedUserId = request.headers.get('x-auth-user-id');
      this.handleSession(server, authedUserId);

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

  handleSession(webSocket: WebSocket, userId: string | null = null) {
    webSocket.accept();
    this.sessions.add(webSocket);
    this.chatSessions.set(webSocket, { ws: webSocket, userId, recentTimes: [] });
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

    // 고정 공지 전송 (있는 경우)
    if (this.pinnedMessage) {
      webSocket.send(JSON.stringify({
        type: 'pinned_message',
        data: { message: this.pinnedMessage },
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
      this.chatSessions.delete(webSocket);
      // 🛡️ viewerCount 하한선 보장 (음수 방지)
      this.viewerCount = Math.max(0, this.viewerCount - 1);
      this.broadcastViewerCount();
    });

    webSocket.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      this.sessions.delete(webSocket);
      this.chatSessions.delete(webSocket);
      this.viewerCount = Math.max(0, this.viewerCount - 1);
    });
  }

  handleMessage(webSocket: WebSocket, message: Record<string, unknown>) {
    // 🛡️ 2026-04-23 배치 164: 채팅 메시지 처리 (WebSocket 전환 기초)
    //   클라이언트가 { type: 'chat_message', data: { text } } 전송 시 검증 후 브로드캐스트.
    //   - 익명 차단 (user_id 없으면 거부)
    //   - 길이/rate limit
    //   - XSS 방지를 위해 서버단에서 stripTags 후 브로드캐스트
    if (!message || typeof message !== 'object') return;

    if (message.type === 'chat_message') {
      const sess = this.chatSessions.get(webSocket);
      if (!sess) return;
      if (!sess.userId) {
        webSocket.send(JSON.stringify({ type: 'chat_error', data: { code: 'AUTH_REQUIRED' }, timestamp: Date.now() }));
        return;
      }

      const msgData = message.data as Record<string, unknown> | null | undefined;
      const text = typeof msgData?.text === 'string' ? msgData.text : '';
      const clean = text.replace(/<[^>]*>/g, '').trim();
      if (!clean || clean.length === 0) return;
      if (clean.length > CHAT_MAX_LEN) {
        webSocket.send(JSON.stringify({ type: 'chat_error', data: { code: 'TOO_LONG', max: CHAT_MAX_LEN }, timestamp: Date.now() }));
        return;
      }

      // Sliding window rate limit
      const now = Date.now();
      sess.recentTimes = sess.recentTimes.filter(t => now - t < CHAT_RATE_WINDOW_MS);
      if (sess.recentTimes.length >= CHAT_RATE_LIMIT) {
        webSocket.send(JSON.stringify({ type: 'chat_error', data: { code: 'RATE_LIMIT' }, timestamp: Date.now() }));
        return;
      }
      sess.recentTimes.push(now);

      // 셀러 커스텀 금지어 체크
      if (this.blockedKeywords.length > 0) {
        const cleanLower = clean.toLowerCase()
        const blocked = this.blockedKeywords.some(kw => cleanLower.includes(kw))
        if (blocked) {
          webSocket.send(JSON.stringify({ type: 'chat_error', data: { code: 'BLOCKED', category: 'custom' }, timestamp: now }))
          return
        }
      }

      // 🛡️ 2026-05-11 P4-#11: 욕설/스팸/광고 자동 필터 — block 카테고리는 broadcast 안 함.
      const modResult = moderateChat(clean);
      if (modResult.action === 'block') {
        webSocket.send(JSON.stringify({
          type: 'chat_error',
          data: { code: 'BLOCKED', category: modResult.category },
          timestamp: now,
        }));
        return;
      }

      this.broadcast({
        type: 'chat_message',
        data: {
          user_id: sess.userId,
          text: clean,
          display_name: typeof msgData?.display_name === 'string' ? String(msgData.display_name).slice(0, 30) : null,
        },
        timestamp: now,
      });
    }
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
        this.currentProduct = message.data as { product: Product; options: ProductOption[] };
        try { await this.state.storage.put('currentProduct', message.data); } catch {}
      }

      // 고정 공지 설정 (브로드캐스트 포함)
      if (message.type === 'set_pinned_message') {
        const msg = (message.data as { message: string | null })?.message ?? null
        this.pinnedMessage = msg ? String(msg).slice(0, 200) : null
        try { await this.state.storage.put('pinnedMessage', this.pinnedMessage ?? ''); } catch {}
        // 모든 접속자에게 즉시 전달
        this.broadcast({ type: 'pinned_message', data: { message: this.pinnedMessage }, timestamp: Date.now() } as WSMessage)
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
      }

      // 셀러 금지어 설정
      if (message.type === 'set_blocked_keywords') {
        const keywords = (message.data as { keywords: string[] })?.keywords
        this.blockedKeywords = Array.isArray(keywords)
          ? keywords.map(k => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 50)
          : []
        try { await this.state.storage.put('blockedKeywords', this.blockedKeywords); } catch {}
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
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
