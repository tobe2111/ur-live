/**
 * WebSocket → RTMP Bridge (Cloudflare Durable Object)
 * Receives video chunks from browser, forwards to YouTube RTMP
 */

import { DurableObject } from 'cloudflare:workers'

interface StreamSession {
  streamId: number
  rtmpUrl: string
  rtmpKey: string
  ffmpegProcess?: any
  lastActivity: number
}

export class RTMPBridge extends DurableObject {
  private sessions: Map<string, StreamSession> = new Map()
  private connections: Set<WebSocket> = new Set()

  async fetch(request: Request) {
    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const url = new URL(request.url)
    const streamId = url.pathname.split('/').pop()

    if (!streamId) {
      return new Response('Stream ID required', { status: 400 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.handleWebSocket(server, parseInt(streamId))

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  async handleWebSocket(ws: WebSocket, streamId: number) {
    ws.accept()
    this.connections.add(ws)

    let session: StreamSession | null = null

    ws.addEventListener('message', async (event) => {
      try {
        if (typeof event.data === 'string') {
          // JSON control messages
          const data = JSON.parse(event.data)
          
          if (data.type === 'seller_join') {
            // Initialize RTMP session
            session = {
              streamId: data.streamId,
              rtmpUrl: data.rtmpUrl,
              rtmpKey: data.rtmpKey,
              lastActivity: Date.now()
            }
            this.sessions.set(`stream_${streamId}`, session)
            
            // Start FFmpeg process (conceptual - actual implementation needs Workers API)
            await this.startFFmpegBridge(session)
            
            ws.send(JSON.stringify({ type: 'connected', streamId }))
          } else if (data.type === 'switch_product') {
            // Broadcast to all viewers
            this.broadcast({
              type: 'switch_product',
              productIndex: data.productIndex
            }, ws)
          }
        } else {
          // Binary video data
          if (session?.ffmpegProcess) {
            // Forward to FFmpeg stdin → RTMP
            await this.pushToRTMP(session, event.data)
          }
        }
      } catch (error) {
        console.error('[RTMPBridge] Error:', error)
        ws.send(JSON.stringify({ type: 'error', message: String(error) }))
      }
    })

    ws.addEventListener('close', () => {
      this.connections.delete(ws)
      if (session) {
        this.stopFFmpegBridge(session)
        this.sessions.delete(`stream_${streamId}`)
      }
    })
  }

  /**
   * Start FFmpeg bridge
   * Note: This is conceptual - actual FFmpeg needs to run on a separate service
   * (e.g., Cloudflare Workers can't run FFmpeg, so use external service)
   */
  async startFFmpegBridge(session: StreamSession) {
    // In production, this would:
    // 1. Spawn FFmpeg process on external service (AWS Lambda, GCP Cloud Run, etc.)
    // 2. Or use WebRTC → Janus/Mediasoup → RTMP pipeline
    
    console.log(`[FFmpeg] Starting bridge for stream ${session.streamId}`)
    console.log(`[FFmpeg] RTMP: ${session.rtmpUrl}?${session.rtmpKey}`)

    // Conceptual FFmpeg command:
    // ffmpeg -f webm -i pipe:0 -c:v libx264 -preset veryfast -b:v 5000k -c:a aac -b:a 128k -f flv rtmp://...
  }

  /**
   * Push video data to RTMP
   */
  async pushToRTMP(session: StreamSession, data: ArrayBuffer) {
    // Forward binary data to FFmpeg stdin
    // This would write to the FFmpeg process pipe
    console.log(`[RTMP] Pushing ${data.byteLength} bytes`)
  }

  /**
   * Stop FFmpeg bridge
   */
  stopFFmpegBridge(session: StreamSession) {
    console.log(`[FFmpeg] Stopping bridge for stream ${session.streamId}`)
    // Kill FFmpeg process
  }

  /**
   * Broadcast message to all connected clients except sender
   */
  broadcast(message: any, except?: WebSocket) {
    const json = JSON.stringify(message)
    for (const ws of this.connections) {
      if (ws !== except && ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.send(json)
      }
    }
  }
}

// Export Durable Object
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url)
    
    if (url.pathname.startsWith('/ws/stream/')) {
      // Get Durable Object stub
      const id = env.RTMP_BRIDGE.idFromName('rtmp-bridge')
      const stub = env.RTMP_BRIDGE.get(id)
      return stub.fetch(request)
    }

    return new Response('Not found', { status: 404 })
  }
}
