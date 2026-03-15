import { DurableObject } from 'cloudflare:workers';
export class LiveStreamDurableObject extends DurableObject {
    sessions;
    viewerCount;
    currentProduct;
    constructor(state, env) {
        super(state, env);
        this.sessions = new Set();
        this.viewerCount = 0;
        this.currentProduct = null;
    }
    async fetch(request) {
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
    handleSession(webSocket) {
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
                const message = JSON.parse(msg.data);
                this.handleMessage(webSocket, message);
            }
            catch (err) {
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
    handleMessage(webSocket, message) {
        // 클라이언트로부터의 메시지 처리
        // 필요한 경우 추가 로직 구현
    }
    async handleBroadcast(request) {
        try {
            const message = await request.json();
            // 상품 변경 메시지인 경우 현재 상품 저장
            if (message.type === 'product_change') {
                this.currentProduct = message.data;
            }
            // 모든 연결된 클라이언트에게 브로드캐스트
            this.broadcast(message);
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }
        catch (err) {
            return new Response(JSON.stringify({
                success: false,
                error: err.message
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }
    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.sessions.forEach((session) => {
            try {
                session.send(messageStr);
            }
            catch (err) {
                console.error('Failed to send message:', err);
                this.sessions.delete(session);
            }
        });
    }
    broadcastViewerCount() {
        const message = {
            type: 'viewer_count',
            data: { count: this.viewerCount },
            timestamp: Date.now(),
        };
        this.broadcast(message);
    }
}
