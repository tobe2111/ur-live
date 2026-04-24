/**
 * obs-websocket v5 minimal client (no external deps)
 *
 * OBS Studio 28+ 는 obs-websocket v5 를 기본 내장.
 * 셀러가 OBS → Tools → WebSocket Server Settings → Enable + password 설정.
 * 우리 앱이 ws://localhost:4455 (또는 사용자 지정 host:port) 연결 후 원격 제어.
 *
 * 중요: 브라우저에서 ws:// 는 Mixed Content 로 HTTPS 사이트에서 차단됨.
 *       → 로컬 개발 (http://localhost:5173) 에서만 동작.
 *       → 프로덕션 (https://live.ur-team.com) 에서 쓰려면 사용자가
 *         Chrome 플래그 변경 OR 브라우저 확장 프로그램 사용 필요.
 *       → 해결 방안은 별도 작업. 지금은 인프라만 구축.
 */

export interface OBSConnectConfig {
  host: string  // 기본 localhost
  port: number  // 기본 4455
  password?: string
}

export interface OBSStatus {
  outputActive: boolean       // 스트리밍 중인지
  outputTimecode?: string     // 방송 경과 시간
  outputBytes?: number        // 총 송출 바이트
  outputCongestion?: number   // 네트워크 혼잡도 (0~1)
  currentScene?: string
  sceneList?: string[]
}

type EventHandler = (status: Partial<OBSStatus>) => void

// OBS WS v5 op codes
const OP = {
  Hello: 0,          // server → client
  Identify: 1,       // client → server
  Identified: 2,     // server → client
  Reidentify: 3,
  Event: 5,
  Request: 6,
  RequestResponse: 7,
  RequestBatch: 8,
  RequestBatchResponse: 9,
}

export class OBSWebSocketClient {
  private ws: WebSocket | null = null
  private statusHandlers: EventHandler[] = []
  private requestSeq = 0
  private pendingRequests = new Map<string, (resp: any) => void>()
  private authenticated = false
  private connectionResolver: ((ok: boolean) => void) | null = null
  private status: OBSStatus = { outputActive: false }

  onStatusChange(h: EventHandler): () => void {
    this.statusHandlers.push(h)
    return () => { this.statusHandlers = this.statusHandlers.filter(x => x !== h) }
  }

  private emit() {
    this.statusHandlers.forEach(h => h({ ...this.status }))
  }

  async connect(config: OBSConnectConfig): Promise<boolean> {
    return new Promise(resolve => {
      this.connectionResolver = resolve
      const url = `ws://${config.host}:${config.port}`
      try {
        this.ws = new WebSocket(url)
      } catch {
        resolve(false); return
      }

      this.ws.onmessage = async (ev) => {
        let msg: any
        try { msg = JSON.parse(ev.data) } catch { return }

        if (msg.op === OP.Hello) {
          // Handshake. If password required, compute auth.
          const auth = msg.d.authentication
          const identifyPayload: any = { rpcVersion: 1, eventSubscriptions: 0xFFFF }
          if (auth && config.password) {
            const secret = await sha256Base64(config.password + auth.salt)
            const authStr = await sha256Base64(secret + auth.challenge)
            identifyPayload.authentication = authStr
          }
          this.ws?.send(JSON.stringify({ op: OP.Identify, d: identifyPayload }))
        } else if (msg.op === OP.Identified) {
          this.authenticated = true
          this.connectionResolver?.(true)
          this.connectionResolver = null
          // 초기 상태 로드
          await this.refreshStatus()
        } else if (msg.op === OP.Event) {
          const type = msg.d.eventType
          const data = msg.d.eventData
          if (type === 'StreamStateChanged') {
            this.status.outputActive = data.outputActive
            this.emit()
          } else if (type === 'CurrentProgramSceneChanged') {
            this.status.currentScene = data.sceneName
            this.emit()
          }
        } else if (msg.op === OP.RequestResponse) {
          const cb = this.pendingRequests.get(msg.d.requestId)
          if (cb) { this.pendingRequests.delete(msg.d.requestId); cb(msg.d) }
        }
      }

      this.ws.onerror = () => {
        if (this.connectionResolver) { this.connectionResolver(false); this.connectionResolver = null }
      }
      this.ws.onclose = () => {
        this.authenticated = false
        if (this.connectionResolver) { this.connectionResolver(false); this.connectionResolver = null }
      }
    })
  }

  disconnect() {
    try { this.ws?.close() } catch { /* ignore */ }
    this.ws = null
    this.authenticated = false
  }

  get isConnected(): boolean { return this.authenticated }

  private request<T = any>(type: string, data?: any): Promise<T | null> {
    if (!this.ws || !this.authenticated) return Promise.resolve(null)
    const requestId = `req-${++this.requestSeq}`
    return new Promise(resolve => {
      this.pendingRequests.set(requestId, (resp) => {
        if (resp.requestStatus?.result) resolve(resp.responseData as T)
        else resolve(null)
      })
      this.ws?.send(JSON.stringify({
        op: OP.Request,
        d: { requestType: type, requestId, requestData: data || {} }
      }))
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId)
          resolve(null)
        }
      }, 5000)
    })
  }

  async refreshStatus() {
    const [streamStatus, sceneList, currentScene] = await Promise.all([
      this.request<{ outputActive: boolean; outputTimecode?: string; outputBytes?: number; outputCongestion?: number }>('GetStreamStatus'),
      this.request<{ scenes: { sceneName: string }[] }>('GetSceneList'),
      this.request<{ currentProgramSceneName: string }>('GetCurrentProgramScene'),
    ])
    if (streamStatus) {
      this.status.outputActive = streamStatus.outputActive
      this.status.outputTimecode = streamStatus.outputTimecode
      this.status.outputBytes = streamStatus.outputBytes
      this.status.outputCongestion = streamStatus.outputCongestion
    }
    if (sceneList) this.status.sceneList = sceneList.scenes.map(s => s.sceneName)
    if (currentScene) this.status.currentScene = currentScene.currentProgramSceneName
    this.emit()
  }

  async setRtmpTarget(rtmpUrl: string, rtmpKey: string) {
    await this.request('SetStreamServiceSettings', {
      streamServiceType: 'rtmp_custom',
      streamServiceSettings: { server: rtmpUrl, key: rtmpKey }
    })
  }

  async startStreaming() { await this.request('StartStream') }
  async stopStreaming() { await this.request('StopStream') }
  async switchScene(sceneName: string) {
    await this.request('SetCurrentProgramScene', { sceneName })
  }
}

// WebCrypto SHA-256 → base64 (obs-websocket v5 auth 계산용)
async function sha256Base64(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  const bytes = new Uint8Array(hash)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

// localStorage 기반 저장/복원
const OBS_CONFIG_KEY = 'seller_obs_config'
export function saveOBSConfig(config: OBSConnectConfig) {
  try { localStorage.setItem(OBS_CONFIG_KEY, JSON.stringify(config)) } catch { /* ignore */ }
}
export function loadOBSConfig(): OBSConnectConfig | null {
  try {
    const v = localStorage.getItem(OBS_CONFIG_KEY)
    return v ? JSON.parse(v) : null
  } catch { return null }
}
export function clearOBSConfig() {
  try { localStorage.removeItem(OBS_CONFIG_KEY) } catch { /* ignore */ }
}
